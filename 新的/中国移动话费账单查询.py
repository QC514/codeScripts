#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中国移动 10086 微信小程序 - 青龙适配（VMPF 协议改造版）

改造说明：
  1. 从 YYB code 服务改为 VMPF（WMPF 协议服务平台）取 code
     （POST {VMPF_URL}/api/wxapp/JSLogin）
  2. 鉴权改为 VMPF API Key（请求头 X-Api-Key）
  3. 账号引用改为 qingyun_openid（VMPF 内的账号 Wxid）
  4. 通知保持三级兜底（青龙 notify → SendNotify.py → 日志）

账号来源：
  - VMPF：POST {VMPF_URL}/api/wxapp/JSLogin （需配置 VMPF_API_KEY + qingyun_openid）

缓存文件：zgydcookie.json
缓存结构：
{
  "openid": {
    "nickname": "昵称",
    "token": "sessionId",
    "expire": 0
  }
}

环境变量：
  VMPF_URL        VMPF 服务地址（必填），如 http://127.0.0.1:5679
  VMPF_API_KEY    VMPF API 密钥（必填），wmpf_xxx
  qingyun_openid  调用的 VMPF 账号 Wxid 列表（必填），多账号用 & 或换行分隔
  WXAPP_APPID     小程序 AppID，默认 wx43aab19a93a3a6f2
  CMCC_REALFEE_PAGE 话费接口 realFeePage，默认 1
  CMCC_TIMEOUT    HTTP 超时，默认 20
  DEBUG           1 时打印额外调试信息

可选通知：
  若青龙环境存在 /ql/scripts/notify.py 或同目录 SendNotify.py，
  则自动调用通知；否则仅打印日志。
"""

import base64
import json
import logging
import os
import re
import ssl
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import requests
from Crypto.Cipher import AES
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

# ========== VMPF 协议配置 ==========
VMPF_URL = os.getenv("VMPF_URL", "").rstrip("/")
VMPF_API_KEY = os.getenv("VMPF_API_KEY", "")
QINGYUN_OPENID = os.getenv("qingyun_openid", "")

APP_ID = os.getenv("WXAPP_APPID", "wx43aab19a93a3a6f2")
REAL_FEE_PAGE = os.getenv("CMCC_REALFEE_PAGE", "1")
TIMEOUT = int(os.getenv("CMCC_TIMEOUT", "20"))
DEBUG = os.getenv("DEBUG", "0") == "1"

BASE_URL = "https://wx.online-cmcc.cn"
MP_PREFIX = "wechat86-applet"
OPERATION_BASE = (
    f"{BASE_URL}/wmhnewcenter/{MP_PREFIX}/newdirect/execute"
    "?channelMark=wechat&service=esb&"
)
LOGIN_URL = f"{BASE_URL}/wmhnewcenter/{MP_PREFIX}/login"
FARE_URL = OPERATION_BASE + "operation=getRealFee"
FLOW_URL = OPERATION_BASE + "operation=queryFlowInfo"
FLOW_DETAIL_URL = OPERATION_BASE + "operation=queryFlowInfo4HomePage"
VOICE_DETAIL_URL = OPERATION_BASE + "operation=queryVoiceInfo"

# app-service.js 中的 X-APPLET-ASK-CONFIG
ASK_CONFIG = ",".join([
    "feeCard",
    "callBalance",
    "broadband",
    "noReal",
    "noPuk",
    "fareLink",
    "recommendCard",
    "xmeFloatBar",
    "showGrayUI",
    "NBEJXHSN",
    "commodityDisableProvince",
    "txCooperateOffingPro",
    "netAge",
    "oneKeyLogin",
    "miniSubscribePopup",
    "wmhHideDetail",
    "wmhHideDetailMarket",
    "domainNameSelection",
    "wmhHideDetailWeChat",
    "hideStarProvince",
])

# app-service.js c71e 模块 AesDecryptNew 默认密钥（已反混淆）
AES_KEY = b"1234123412ABCDEF"
AES_IV = b"ABCDEF1234123412"

COOKIE_FILE = Path(__file__).resolve().with_name("zgydcookie.json")

logger = logging.getLogger("cmcc-wxapp")
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)


class CompatibleTLSAdapter(HTTPAdapter):
    """兼容部分国内运营商接口的 TLS 握手（解决 SSLV3_ALERT_HANDSHAKE_FAILURE）"""

    def _make_ssl_context(self):
        ctx = create_urllib3_context()
        ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        if hasattr(ssl, "OP_LEGACY_SERVER_CONNECT"):
            ctx.options |= ssl.OP_LEGACY_SERVER_CONNECT
        return ctx

    def init_poolmanager(self, *args, **kwargs):
        kwargs["ssl_context"] = self._make_ssl_context()
        return super().init_poolmanager(*args, **kwargs)

    def proxy_manager_for(self, *args, **kwargs):
        kwargs["ssl_context"] = self._make_ssl_context()
        return super().proxy_manager_for(*args, **kwargs)


# 真实微信小程序 User-Agent（来自抓包）
REAL_UA = (
    "Mozilla/5.0 (Linux; Android 16; 2308CPXD0C Build/BP2A.250605.031.A3; wv) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.189 "
    "Mobile Safari/537.36 XWEB/1500117 MMWEBSDK/20260502 MMWEBID/6435 "
    "MicroMessenger/8.0.76.3141(0x28004C54) WeChat/arm64 Weixin "
    "NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android"
)

session = requests.Session()
session.mount("https://", CompatibleTLSAdapter())
session.mount("http://", CompatibleTLSAdapter())
session.headers.update({
    "User-Agent": REAL_UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": f"https://servicewechat.com/{APP_ID}/526/page-frame.html",
})

# ========== VMPF 协议统一底层 ==========
def vmpf_request(endpoint: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    VMPF 协议统一底层：调用 {VMPF_URL}/api/wxapp/{endpoint}
    使用 API Key 鉴权（X-Api-Key）。
    统一响应：{"Code":0,"Success":true,"Message":"...","Data":{...}}
    """
    if not VMPF_URL:
        raise RuntimeError("未配置 VMPF_URL")
    if not VMPF_API_KEY:
        raise RuntimeError("未配置 VMPF_API_KEY")

    url = f"{VMPF_URL}/api/wxapp/{endpoint}"
    headers = {"X-Api-Key": VMPF_API_KEY}

    resp = session.post(url, json=body or {}, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    obj = resp.json()

    code = obj.get("Code")
    if code != 0:
        if code == -5:
            raise RuntimeError("VMPF 账号会话已过期，请在 VMPF 管理后台重新扫码登录")
        if code == -7:
            raise RuntimeError("VMPF API Key 额度已用尽，请在 VMPF 后台重置额度")
        raise RuntimeError(f"VMPF {endpoint} 失败：{obj}")

    data = obj.get("Data") or {}
    return {"data": data, "raw": obj}


def load_cache() -> Dict[str, Dict[str, Any]]:
    if not COOKIE_FILE.exists():
        return {}
    try:
        obj = json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
        return obj if isinstance(obj, dict) else {}
    except Exception as exc:
        logger.warning("读取 %s 失败：%s", COOKIE_FILE, exc)
        return {}


def save_cache(cache: Dict[str, Dict[str, Any]]) -> None:
    tmp = COOKIE_FILE.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp.replace(COOKIE_FILE)


def decrypt_new(encrypt_data: str) -> Any:
    """
    对应小程序：
      AesDecryptNew(Base64Decode(encryptData))

    实际流程：
      1. Base64Decode(encryptData) -> UTF-8 字符串（内容是密文的 Base64）
      2. 再 Base64 解码得到二进制密文
      3. AES-CBC / PKCS7 解密，密钥 1234123412ABCDEF，IV ABCDEF1234123412
    """
    # 第一层：Base64 -> UTF-8 字符串
    try:
        inner_b64 = base64.b64decode(encrypt_data).decode("utf-8").strip()
    except Exception as exc:
        raise RuntimeError(f"encryptData 第一层 Base64 解码失败：{exc}") from exc

    # 第二层：该字符串本身是 Base64 密文
    try:
        ciphertext = base64.b64decode(inner_b64)
    except Exception as exc:
        raise RuntimeError(f"encryptData 第二层 Base64 解码失败：{exc}") from exc

    if len(ciphertext) % AES.block_size != 0:
        raise RuntimeError(
            f"密文长度不是 AES 块大小整数倍：{len(ciphertext)}"
        )

    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    plain = cipher.decrypt(ciphertext)

    if not plain:
        return ""

    pad = plain[-1]
    if 1 <= pad <= AES.block_size and plain.endswith(bytes([pad]) * pad):
        plain = plain[:-pad]

    text = plain.decode("utf-8")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def _header_ci(headers: requests.structures.CaseInsensitiveDict, name: str) -> str:
    return str(headers.get(name, ""))


def unwrap_response(resp: requests.Response) -> Any:
    """
    对齐小程序 axios response interceptor：
    lrsbhbg8=true -> encryptData 解密
    status in [0,1001] -> data
    returnCode == '0' -> object
    """
    if resp.status_code >= 400:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:500]}")

    try:
        obj = resp.json()
    except Exception:
        raise RuntimeError(f"响应不是 JSON：{resp.text[:500]}")

    lrsbh = _header_ci(resp.headers, "lrsbhbg8").lower()
    if lrsbh == "true" and isinstance(obj, dict) and obj.get("encryptData"):
        obj = decrypt_new(obj["encryptData"])

    if not isinstance(obj, dict):
        return obj

    status = obj.get("status")
    if status in (0, 1001, "0", "1001"):
        return obj.get("data")

    rc = str(obj.get("returnCode", obj.get("rtnCode", "")))
    if rc in ("0", "0000"):
        return obj.get("object") or obj.get("data") or obj

    # 登录接口或某些直返接口可能已经是业务对象。
    if "sessionId" in obj or "appletUser" in obj or "resultData" in obj:
        return obj

    raise RuntimeError(str(obj)[:1000])


def common_headers(
    token: Optional[str] = None,
    province_code: str = "",
) -> Dict[str, str]:
    headers = {
        "X-APPLET-ASK-CONFIG": ASK_CONFIG,
        "Lrsbhbg8": "ZS93dUFVa2kzaEpQSjM0SG55MUFDdz09",
        "X-EMERGENCY-NEW": "yes",
        "Content-Type": "application/json;charset=UTF-8",
        "charset": "utf-8",
    }
    if province_code:
        headers["X-EMERGENCY-PROVINCE"] = str(province_code)
    if token:
        headers["X-WECHAT86-APPLET-JWT"] = token
        headers["X-CORE-APPLET-TOKEN"] = token
    return headers


def get_accounts() -> list:
    """获取账号列表：VMPF 模式，解析 qingyun_openid（多账号用 & 或换行分隔）"""
    raw = QINGYUN_OPENID
    if not raw:
        raise RuntimeError("未配置 qingyun_openid，无法确定要查询的账号")

    wxids = [
        item.strip()
        for item in raw.replace("&", "\n").splitlines()
        if item.strip()
    ]
    if not wxids:
        raise RuntimeError("qingyun_openid 配置为空，无法确定要查询的账号")

    accounts = []
    for wxid in wxids:
        accounts.append({"openid": wxid, "nickname": wxid[:8] + "..."})
    return accounts


def get_wx_code(openid: str) -> str:
    """通过 VMPF JSLogin 接口获取微信登录 code"""
    resp_obj = vmpf_request("JSLogin", {"Appid": APP_ID, "Wxid": openid})
    data = resp_obj.get("data") or {}
    code = data.get("code")
    if not code:
        raise RuntimeError(f"VMPF JSLogin 未返回 code：{resp_obj}")
    return str(code)


def login_by_code(wx_code: str) -> Dict[str, Any]:
    headers = common_headers()
    headers["X-WX-Code"] = wx_code
    # 真实小程序登录时会带空 JWT
    headers["X-WECHAT86-APPLET-JWT"] = ""

    resp = session.get(
        LOGIN_URL,
        headers=headers,
        timeout=TIMEOUT,
    )
    data = unwrap_response(resp)
    if not isinstance(data, dict):
        raise RuntimeError(f"登录返回格式异常：{data!r}")

    session_id = data.get("sessionId")
    applet_user = data.get("appletUser") or {}
    if not session_id:
        raise RuntimeError(f"登录未返回 sessionId：{data}")

    telephone = str(applet_user.get("telephone") or "").strip()
    province_code = str(applet_user.get("provinceCode") or "").strip()
    openid = str(applet_user.get("openid") or "").strip()
    phone_status = str(applet_user.get("phoneStatus") or "").strip()

    logger.info(
        "登录成功：phone=%s province=%s openid=%s phoneStatus=%s",
        telephone[:3] + "****" + telephone[7:] if len(telephone) == 11 else telephone,
        province_code,
        openid[:8] + "..." if len(openid) > 8 else openid,
        phone_status,
    )

    return {
        "token": str(session_id),
        "telephone": telephone,
        "provinceCode": province_code,
        "openid": openid,
        "phoneStatus": phone_status,
        "user": applet_user,
        "raw": data,
    }


def login_account(account: Dict[str, str], cache: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    openid = account["openid"]
    nickname = account["nickname"]
    old = cache.get(openid) or {}

    token = old.get("token")
    expire = old.get("expire", 0)
    if token and (not expire or int(expire) > int(time.time())):
        return {
            "token": token,
            "telephone": old.get("telephone", ""),
            "provinceCode": old.get("provinceCode", ""),
            "openid": openid,
            "phoneStatus": old.get("phoneStatus", "1"),
            "cached": True,
        }

    code = get_wx_code(openid)
    login = login_by_code(code)
    login["cached"] = False

    cache[openid] = {
        "nickname": nickname,
        "token": login["token"],
        "expire": 0,
        "telephone": login.get("telephone", ""),
        "provinceCode": login.get("provinceCode", ""),
        "phoneStatus": login.get("phoneStatus", ""),
    }
    save_cache(cache)
    return login


def business_get(
    url: str,
    token: str,
    params: Optional[Dict[str, Any]] = None,
    province_code: str = "",
) -> Any:
    resp = session.get(
        url,
        headers=common_headers(token, province_code=province_code),
        params=params or {},
        timeout=TIMEOUT,
    )
    return unwrap_response(resp)


def query_fare(token: str, province_code: str = "") -> Dict[str, Any]:
    data = business_get(
        FARE_URL,
        token,
        params={"realFeePage": REAL_FEE_PAGE},
        province_code=province_code,
    )

    if not isinstance(data, dict):
        raise RuntimeError(f"话费返回格式异常：{data!r}")

    # 尝试多种可能的数据结构
    if "curFee" in data or "realFee" in data:
        fare_data = data
    elif isinstance(data.get("realFeeQryRsp"), dict):
        fare_data = data["realFeeQryRsp"]
    elif isinstance(data.get("resultData"), dict):
        fare_data = data["resultData"]
    elif isinstance(data.get("data"), dict):
        fare_data = data["data"]
    else:
        fare_data = data

    def num(name: str) -> Optional[float]:
        val = fare_data.get(name)
        if val is None or val == "":
            return None
        try:
            if isinstance(val, str):
                val = val.strip()
                if val == "":
                    return None
            return float(val)
        except Exception:
            return None

    # 尝试所有可能的字段名
    possible_fee_fields = ["curFee", "realFee", "currentFee", "balance", "fee", "balanceFee", "userFee", "accountFee"]
    fee_value = None
    for field in possible_fee_fields:
        v = fare_data.get(field) or data.get(field)
        if v is not None and v != "":
            try:
                fee_value = float(v) if isinstance(v, (int, float)) else float(v.strip())
                break
            except Exception:
                pass

    if fee_value is None:
        logger.warning("未找到话费余额字段")

    return {
        "curFee": fee_value,
        "realFee": num("realFee"),
        "curFeeTotal": num("curFeeTotal"),
        "payType": fare_data.get("payType"),
        "nextSettleDate": fare_data.get("nextSettleDate"),
        "oprTime": fare_data.get("oprTime"),
        "raw": fare_data,
        "rawResponse": data,
    }


def query_voice_detail(token: str, province_code: str = "") -> Dict[str, Any]:
    """查询语音详细分类"""
    try:
        resp = session.get(
            VOICE_DETAIL_URL,
            headers=common_headers(token, province_code=province_code),
            params={},
            timeout=TIMEOUT,
        )
        data = resp.json()
        
        # 处理 rtnCode 格式（部分接口用 rtnCode 而非 returnCode）
        if isinstance(data, dict):
            rtn_code = str(data.get("rtnCode", data.get("returnCode", "")))
            if rtn_code in ("0", "0000"):
                result = data.get("data") or data.get("object") or data
                return result if isinstance(result, dict) else {}
        
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.warning("语音明细查询失败: %s", exc)
        return {}


def query_flow(token: str, province_code: str = "") -> Dict[str, Any]:
    voice_classification = 1 if province_code in {"250", "230", "871"} else 0

    data = business_get(
        FLOW_URL,
        token,
        params={
            "directionalFlow": 1,
            "videoFlag": 1,
            "voiceClassification": voice_classification,
        },
        province_code=province_code,
    )

    if isinstance(data, dict) and isinstance(data.get("resultData"), dict):
        result = data["resultData"]
    else:
        result = data

    if not isinstance(result, dict):
        raise RuntimeError(f"流量返回格式异常：{result!r}")

    flow_sum_info = result.get("flowSumInfo") or []
    if not isinstance(flow_sum_info, list):
        flow_sum_info = []

    cards: Dict[str, Dict[str, Any]] = {}
    for item in flow_sum_info:
        if isinstance(item, dict) and item.get("cardId") is not None:
            cards[str(item["cardId"])] = item

    domestic = cards.get("00", {})
    common = cards.get("01", {})
    voice = cards.get("04", {})

    return {
        "domestic": {
            "sum": number_or_none(domestic.get("flowSum")),
            "used": number_or_none(domestic.get("flowUse")),
            "remain": number_or_none(domestic.get("flowRemain")),
            "unit": number_or_none(domestic.get("unit")),
            "raw": domestic,
        },
        "common": {
            "sum": number_or_none(common.get("flowSum")),
            "used": number_or_none(common.get("flowUse")),
            "remain": number_or_none(common.get("flowRemain")),
            "unit": number_or_none(common.get("unit")),
            "raw": common,
        },
        "voice": {
            "sum": number_or_none(voice.get("flowSum")),
            "used": number_or_none(voice.get("flowUse")),
            "remain": number_or_none(voice.get("flowRemain")),
            "unit": number_or_none(voice.get("unit")),
            "raw": voice,
        },
        "all_cards": cards,
        "raw": result,
    }


def number_or_none(v: Any) -> Optional[float]:
    if v is None or v == "" or v == "N":
        return None
    try:
        return float(v)
    except Exception:
        return None


def format_number(v: Any) -> str:
    if v is None or v == "":
        return "--"
    try:
        num_value = float(v)
    except (TypeError, ValueError):
        return str(v)
    if abs(num_value - round(num_value)) < 1e-9:
        return str(int(round(num_value)))
    return f"{num_value:.2f}".rstrip("0").rstrip(".")


def flow_to_display(value: Any, unit_code: Any) -> str:
    """将流量值转换为可读格式
    根据API返回数据推断：
    - unit=1: 原始值为MB（如127594.88 MB = 124.6 GB）
    - unit=2: 原始值为KB
    - unit=4: 分钟（语音）
    - unit=5: 条数（短信/彩信）
    - unit=6: GB
    """
    if value is None or value == "":
        return "--"
    try:
        num_value = float(value)
    except (TypeError, ValueError):
        return "--"
    try:
        u = int(unit_code)
    except Exception:
        u = 1

    # 根据单位代码转换为MB
    if u == 1:
        # 原始值已经是MB
        mb = num_value
    elif u == 2:
        # KB -> MB
        mb = num_value / 1024.0
    elif u == 4:
        # 分钟，直接返回
        return f"{format_number(num_value)} 分钟"
    elif u == 5:
        # 条数
        return f"{format_number(num_value)} 条"
    elif u == 6:
        # GB -> MB
        mb = num_value * 1024.0
    else:
        # 默认按MB处理
        mb = num_value

    # 如果超过1024MB，显示为GB
    if mb >= 1024:
        return f"{format_number(mb / 1024)} GB"
    return f"{format_number(mb)} MB"


def mask_phone(phone: str) -> str:
    phone = str(phone or "")
    if len(phone) == 11 and phone.isdigit():
        return phone[:3] + "****" + phone[7:]
    return phone or "--"


def format_fee(v: Optional[float]) -> str:
    return "--" if v is None else f"{v:.2f} 元"


def build_message(
    nickname: str,
    login: Dict[str, Any],
    fare: Dict[str, Any],
    flow: Dict[str, Any],
    voice_detail: Dict[str, Any] = None,
) -> str:
    if voice_detail is None:
        voice_detail = {}
    
    phone = login.get("telephone", "")
    province = login.get("provinceCode", "")
    f = flow.get("domestic", {})
    common = flow.get("common", {})
    v = flow.get("voice", {})
    
    if voice_detail and isinstance(voice_detail, dict):
        for key in ["resultData", "data", "voiceInfo", "voiceDetail"]:
            if key in voice_detail and isinstance(voice_detail[key], dict):
                voice_detail = voice_detail[key]
                break

    # 构建流量详情
    flow_lines = []
    if f.get('remain') is not None:
        flow_lines.append(f"国内流量：{flow_to_display(f.get('remain'), f.get('unit'))} (已用 {format_number(f.get('used'))} {flow_to_unit(f.get('unit'))})")
    if common.get('remain') is not None:
        flow_lines.append(f"通用流量：{flow_to_display(common.get('remain'), common.get('unit'))} (已用 {format_number(common.get('used'))} {flow_to_unit(common.get('unit'))})")

    # 检查其他流量卡片（如定向流量等）
    CARD_NAME_MAP = {
        "00": "国内流量",
        "01": "通用流量",
        "02": "国内其他",
        "03": "定向流量B",
        "04": "语音通话",
        "05": "短信",
        "06": "彩信",
        "07": "WLAN",
        "08": "国内定向",
    }
    # WLAN 特殊处理：虽然 unit=4，但应显示为 MB
    CARD_UNIT_OVERRIDE = {"07": "1"}
    for card_id, card_data in flow.get("all_cards", {}).items():
        if card_id not in ("00", "01", "04") and card_data.get("flowRemain"):
            card_name = CARD_NAME_MAP.get(card_id, f"流量{card_id}")
            remain = card_data.get("flowRemain")
            used = card_data.get("flowUse")
            unit = CARD_UNIT_OVERRIDE.get(card_id, card_data.get("unit"))
            if remain is not None:
                flow_lines.append(f"{card_name}：{flow_to_display(remain, unit)} (已用 {format_number(used)} {flow_to_unit(unit)})")

    lines = [
        f"中国移动 余量通知 - {nickname}",
        f"手机号：{mask_phone(phone)}",
        f"话费余额：{format_fee(fare.get('curFee'))}",
        f"流量剩余：",
    ]
    lines.extend(flow_lines)

    # 语音详情 - 优先使用明细数据
    voice_remain = v.get('remain')
    voice_used = v.get('used')
    
    # 尝试从 voice_detail 中解析子分类
    voice_common = None
    voice_other = None
    if voice_detail:
        # 检查是否有子分类
        for key in ["domesticCommon", "commonVoice", "generalVoice", "国内通用"]:
            if key in voice_detail:
                voice_common = voice_detail[key]
                break
        for key in ["domesticOther", "otherVoice", "其他Voice", "国内其他"]:
            if key in voice_detail:
                voice_other = voice_detail[key]
                break
    
    if voice_remain is not None:
        if voice_common or voice_other:
            # 有子分类数据，分别显示
            if voice_common:
                c_remain = voice_common.get("flowRemain") or voice_common.get("remain")
                c_used = voice_common.get("flowUse") or voice_common.get("used")
                lines.append(f"国内通用语音：{format_number(c_remain)} 分钟 (已用 {format_number(c_used)} 分钟)")
            if voice_other:
                o_remain = voice_other.get("flowRemain") or voice_other.get("remain")
                o_used = voice_other.get("flowUse") or voice_other.get("used")
                lines.append(f"国内其他语音：{format_number(o_remain)} 分钟 (已用 {format_number(o_used)} 分钟)")
            if not voice_common and not voice_other:
                lines.append(f"语音剩余：{format_number(voice_remain)} 分钟 (已用 {format_number(voice_used)} 分钟)")
        else:
            lines.append(f"语音剩余：{format_number(voice_remain)} 分钟 (已用 {format_number(voice_used)} 分钟)")
    else:
        lines.append("语音剩余：--")

    if province:
        lines.append(f"归属省份代码：{province}")

    return "\n".join(lines)


def flow_to_unit(unit_code: Any) -> str:
    """将流量单位代码转换为可读字符串"""
    if unit_code is None:
        return ""
    try:
        u = int(unit_code)
    except Exception:
        return ""
    if u == 1:
        return "MB"
    elif u == 2:
        return "KB"
    elif u == 4:
        return "分钟"
    elif u == 5:
        return "条"
    elif u == 6:
        return "GB"
    return ""


# ========== 三级本地通知兜底 ==========
def send_local_notify(title: str, content: str) -> None:
    """
    三级通知兜底：青龙 notify 模块 → 同目录 SendNotify.py → 仅打印日志
    任何环节缺失不报错，退出码 0
    """
    # 第一级：青龙自带 notify 模块
    try:
        from notify import send as ql_send
        ql_send(title, content)
        logger.info("通知已发送（青龙 notify 模块）")
        return
    except ImportError:
        pass
    except Exception as exc:
        logger.warning("青龙 notify 模块调用失败：%s", exc)

    # 第二级：同目录 SendNotify.py
    send_notify_path = Path(__file__).resolve().parent / "SendNotify.py"
    if send_notify_path.exists():
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location("SendNotify", str(send_notify_path))
            mod = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(mod)
            send = getattr(mod, "send", None)
            if callable(send):
                send(title, content)
                logger.info("通知已发送（SendNotify.py）")
                return
        except Exception as exc:
            logger.warning("SendNotify.py 调用失败：%s", exc)

    # 第三级：仅打印日志
    logger.info("===== 通知 =====\n%s\n%s\n================", title, content)


def is_login_error(exc: Exception) -> bool:
    text = str(exc).lower()
    keys = [
        "login",
        "token",
        "session",
        "jwt",
        "未登录",
        "登录",
        "会话",
        "鉴权",
        "401",
        "403",
        "1001",
        "wmh5002",
        "wmh5003",
        "重新鉴权",
        "重新登陆",
        "重新登录",
        "请重新登录",
    ]
    return any(k.lower() in text for k in keys)


def query_all(account: Dict[str, str], cache: Dict[str, Dict[str, Any]]) -> Tuple[str, Dict[str, Any]]:
    nickname = account["nickname"]

    login = login_account(account, cache)
    try:
        prov = login.get("provinceCode", "")
        fare = query_fare(login["token"], prov)
        flow = query_flow(login["token"], prov)
        voice_detail = query_voice_detail(login["token"], prov)
        return nickname, {
            "login": login,
            "fare": fare,
            "flow": flow,
            "voice_detail": voice_detail,
        }
    except Exception as exc:
        if not login.get("cached") or not is_login_error(exc):
            raise

        logger.info("%s：缓存 token 可能失效，重新获取 code 登录", nickname)

        # 清掉失效缓存，避免反复用坏 token
        cache.pop(account["openid"], None)
        save_cache(cache)

        code = get_wx_code(account["openid"])
        fresh = login_by_code(code)
        cache[account["openid"]] = {
            "nickname": nickname,
            "token": fresh["token"],
            "expire": 0,
            "telephone": fresh.get("telephone", ""),
            "provinceCode": fresh.get("provinceCode", ""),
            "phoneStatus": fresh.get("phoneStatus", ""),
        }
        save_cache(cache)

        prov = fresh.get("provinceCode", "")
        fare = query_fare(fresh["token"], prov)
        flow = query_flow(fresh["token"], prov)
        voice_detail = query_voice_detail(fresh["token"], prov)

        return nickname, {
            "login": fresh,
            "fare": fare,
            "flow": flow,
            "voice_detail": voice_detail,
        }


def main() -> int:
    logger.info("开始执行：CMCC 微信小程序余量查询")

    cache = load_cache()

    try:
        accounts = get_accounts()
    except Exception as exc:
        logger.error("获取账号失败：%s", exc)
        return 1

    if not accounts:
        logger.warning("没有可用账号")
        return 0

    logger.info("共获取 %d 个账号", len(accounts))

    notifications = []
    failed = 0

    for index, account in enumerate(accounts, 1):
        openid = account["openid"]
        nickname = account["nickname"]

        try:
            _, result = query_all(account, cache)
            fare = result["fare"]
            text = build_message(
                nickname,
                result["login"],
                fare,
                result["flow"],
                result.get("voice_detail", {}),
            )
            logger.info("\n%s", text)
            notifications.append(text)
        except Exception as exc:
            failed += 1
            logger.exception("%s 执行失败：%s", nickname, exc)
            notifications.append(
                f"中国移动余量通知 - {nickname}\n执行失败：{exc}"
            )

    title = "中国移动余量通知"
    content = "\n\n".join(notifications)
    send_local_notify(title, content)

    logger.info("执行完成：成功 %d，失败 %d", len(accounts) - failed, failed)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
