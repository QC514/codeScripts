#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信小程序十四合一任务 v1.0.3

功能：单文件整合抽奖助手、同程旅行、客徕拿乐购、口味王、巨惠好花红、DT生活、三福、可口可乐、腾讯地图、平和味道、蜜雪冰城、浓五酒馆、三得利、国乐酱酒十四个任务
VMPF 平台模式：账号来源 = 环境变量 qingyun_openid；取 code = POST {VMPF_URL}/api/wxapp/JSLogin（体 {Appid, Wxid}、头 X-Api-Key、Code==0 取 Data.code），支持模块开关、顺序执行、日志汇总与模块推送
十四个模块源码已内置在本文件里，不依赖外部任务脚本

更新说明:
### 2026.09.08
v1.0.5（VMPF 改造）:
- 取码平台由 YYB 应用宝服务改为 VMPF（WMPF 微信小程序协议服务平台）
- 账号来源改为环境变量 qingyun_openid（多账号用 & 或换行分隔），不再使用 YYB_API_BASE / YYB_LICENSE_KEY / YYB_OPENIDS
- 取 code = POST {VMPF_URL}/api/wxapp/JSLogin，体 {"Appid": 各模块 AppID, "Wxid": openid}，头 X-Api-Key，Code==0 取 Data.code
- VMPF_URL / VMPF_API_KEY / qingyun_openid 缺失即报错退出
- 旧平台不再提供 nickname/unionId：日志直接用 openid 作账号标识，unionId 留空

### 2026.07.30
v1.0.4:
- 适配应用宝新取码接口 /api/yyb/get-code（原 /api/wmpf/get-code）
- 账号来源改为环境变量 YYB_OPENIDS（回车分隔），不再拉取全部账号
- 未配置 YYB_OPENIDS 时不运行任何账号
- 请求增加 X-License-Key 鉴权头

### 2026.05.22
v1.0.2:
- 接入口味王模块，支持本地 wxcode 刷新 CK
- 为无内置推送的模块补充中心级推送

### 2026.05.17
v1.0.1:
- 接入腾讯地图、平和味道模块
- 移除万年县模块
- 移除腾讯地图和抽奖助手缓存

### 2026.05.12
v1.0.0:
- 单文件整合十一个 wxcode 任务模块
- 增加 globalConfig 模块开关、统一运行日志和汇总输出
- 移除旧账号凭据入口，仅保留 code 登录与推送配置

配置说明:
1. 模块开关:
    - 修改 globalConfig 里的 enable_* 控制对应模块
    - enable_notify=False 时会统一关闭支持推送的模块

2. VMPF 平台取码（账号来源与取 code 的唯一途径）:
    - VMPF_URL: 平台接口地址（必填，不含路径），如 http://127.0.0.1:5679
    - VMPF_API_KEY: API 密钥（必填，wmpf_xxx），通过请求头 X-Api-Key 鉴权
    - qingyun_openid: 指定运行的微信号 openid 列表（必填），多账号用 & 或换行分隔（每行=一个账号）
    - WXCODE_MODULE_DELAY: 模块间/账号间等待秒数，默认 3，避免连续取 code 过快

3. 常用环境变量:
    抽奖助手:
    - CJZS_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - CJZS_APPID: 小程序 AppID，默认 wx01bb1ef166cd3f4e
    - CJZS_PUSH: 推送开关，1 开启，0 关闭

    同程旅行:
    - TCLX_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - TCLX_APPID: 小程序 AppID，默认 wx336dcaf6a1ecf632
    - TCLX_PUSH: 推送开关，1 开启，0 关闭

    客徕拿:
    - KELAINA_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - KELAINA_APP_ID: 小程序 AppID，默认 wxd53de10d996cabff
    - KELAINA_DEVICE_ID: 登录用设备 ID，不填则自动生成
    - KELAINA_PUSH: 推送开关，1 开启，0 关闭

    口味王:
    - KWW_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - KWW_APPID: 小程序 AppID，默认 wxfb0905b0787971ad
    - KWW_PUSH: 推送开关，1 开启，0 关闭

    巨惠好花红:
    - JH_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - JH_APP_ID: 小程序 AppID，默认 wxcfe48e0e0f3e647c
    - JH_REMARK: 账号备注，默认 wxcode
    - JH_PUSH: 推送开关，1 开启，0 关闭

    DT生活:
    - DT_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - DT_APPID: 小程序 AppID，默认 wx51a2021dd921f747
    - PLUSPLUS_TOKEN: PushPlus 推送 token，不填则不推送

    三福:
    - SANFU_CODE_SERVERS: code 服务地址，默认 127.0.0.1:8088
    - SANFU_APPID: 小程序 AppID，默认 wxfe13a2a5df88b058
    - PLUSPLUS_TOKEN: PushPlus 推送 token，不填则不推送

    可口可乐:
    - KKKL_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - MTYL_APPID: 每天有乐 AppID，默认 wxd84920ac8965ee21
    - KKKL_APPID: 可口可乐吧 AppID，默认 wxa5811e0426a94686
    - MTYL_LOGIN_URL: 每天有乐 code 换 token 接口
    - KKKL_LOGIN_URL: 可口可乐吧 code 换 token 接口
    - KKKL_PUSH: 推送开关，1 开启，0 关闭

    腾讯地图:
    - TXMAP_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - TXMAP_APPID: 小程序 AppID，默认 wx7643d5f831302ab0

    平和味道:
    - PH_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - PH_SERVER: 微信服务端地址，默认空
    - PH_APPID: 活动微信公众号 AppID，默认 wx9277678c5cb30d2c
    - PH_ACTID: 签到活动 ID，默认 2053713870746574850
    - PH_QUIZ_ACTID: 答题活动 ID，默认空
    - PH_QUIZ_ANSWERS: 答案，默认空


    蜜雪冰城/浓五酒馆/三得利/国乐酱酒:
    - MNSG_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}

4. 日志说明:
    - 控制台会输出总开关状态、模块开始/结束、耗时和最终汇总
    - 各模块内部日志保持原任务输出，方便定位具体接口或账号异常
    - 推送由各模块或任务中心汇总；关闭 enable_notify 会统一关闭推送

定时规则建议 (Cron):
35 7 * * *

From: YaoHuo8648
Email: zheyizzf@188.com
Update: 2026.05.22
"""

from __future__ import annotations

import os
import sys
import time
import types
import io
import requests
from contextlib import contextmanager, redirect_stdout
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterator, List


SCRIPT_VERSION = "v1.0.5"
SCRIPT_NAME = "微信小程序十四合一任务"
SCRIPT_DIR = Path(__file__).resolve().parent
WXCODE_MODULE_DELAY = float(os.getenv("WXCODE_MODULE_DELAY", "3") or "0")

try:
    from notify import send as notify_send
except ImportError:
    notify_send = None


# ========================================
# VMPF 平台取码客户端（内联，不依赖外部 yyb.py / 本地 wxcode 服务）
# 账号与取 code 全部经由 VMPF（WMPF 微信小程序协议服务平台）
# 配置：VMPF_URL / VMPF_API_KEY（必填，缺失即报错退出）
#       qingyun_openid — 运行的微信号 openid 列表，多账号用 & 或换行分隔
# ========================================
VMPF_URL = (os.getenv("VMPF_URL") or "").strip().rstrip("/")
VMPF_API_KEY = (os.getenv("VMPF_API_KEY") or "").strip()
VMPF_TIMEOUT = int(os.getenv("VMPF_TIMEOUT", "30") or "30")
ACCOUNTS = [x.strip() for x in (os.getenv("qingyun_openid") or "").replace("&", "\n").split("\n") if x.strip()]
if not VMPF_URL or not VMPF_API_KEY or not ACCOUNTS:
    raise SystemExit("未配置 VMPF 平台环境变量（VMPF_URL / VMPF_API_KEY / qingyun_openid），请设置后重试（多账号使用 & 或换行分隔）")
PURE_VMPF_MODE = True


class VMPFClient:
    """精简 VMPF 客户端：解析 qingyun_openid 账号列表 + 按 openid/appid 取小程序 code"""

    def __init__(self, base_url: str = VMPF_URL, api_key: str = VMPF_API_KEY, timeout: int = VMPF_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def get_accounts(self):
        """从 qingyun_openid 环境变量读取指定 openid 列表（多账号用 & 或换行分隔）。
        旧平台不再提供 nickname/unionId，日志一律以 openid 作账号标识，unionId 留空。"""
        if not ACCOUNTS:
            log_global("VMPF", "未配置 qingyun_openid 环境变量，跳过运行")
            return []
        result = [{"openid": oid, "nickname": oid[:10], "unionId": ""} for oid in ACCOUNTS]
        log_global("VMPF", f"指定运行 {len(result)} 个微信号")
        return result

    def get_code(self, openid: str, appid: str) -> str:
        """按 openid + appid 通过 VMPF JSLogin 接口取 wx.login code：
        POST {VMPF_URL}/api/wxapp/JSLogin，体 {"Appid": appid, "Wxid": openid}，
        头 X-Api-Key；Code==0 时取 Data.code，失败返回空串。"""
        if not openid or not appid:
            return ""
        try:
            resp = requests.post(
                f"{self.base_url}/api/wxapp/JSLogin",
                headers={"Content-Type": "application/json", "X-Api-Key": self.api_key},
                json={"Appid": appid, "Wxid": openid},
                timeout=self.timeout,
            )
            payload = resp.json()
        except Exception as exc:
            log_global("VMPF", f"取 code 异常 [{appid}]: {exc}")
            return ""
        if not isinstance(payload, dict) or payload.get("Code", -1) != 0:
            log_global("VMPF", f"取 code 失败 [{appid}]: {str(payload)[:200]}")
            return ""
        code = (payload.get("Data") or {}).get("code")
        if not code:
            log_global("VMPF", f"取 code 失败 [{appid}]: 未返回 code: {str(payload)[:200]}")
            return ""
        return str(code)


# 模块级单例
_VMPF = VMPFClient()


# ========================================
# 取 code 注入映射表
# key -> (函数名列表, appid 变量名, 是否类方法)
# 中心层按 openid 绑定闭包并覆盖到内嵌模块命名空间
# ========================================
CODE_FN_MAP = {
    "cjzs":  (["get_wx_code"],            "APPID",          False),
    "tclx":  (["get_wx_code"],            "APPID",          False),
    "kln":   (["fetch_code"],             "APP_ID",         False),
    "kww":   (["get_wx_code"],            "KWW_APPID",      False),
    "jhhhh": (["fetch_code"],             "APPID",          True),   # JuhuiClient.fetch_code(self)
    "dtsh":  (["get_wx_code"],            "APP_ID",         False),
    "sanfu": (["get_code"],               "APPID",          False),
    "kkkl":  (["fetch_code"],             "__param__",      False),  # appid 由调用方传参
    "mxbc":  (["get_code"],               "MINI_APP_ID",    False),
    "nw":    (["get_code"],               "APPID",          False),
    "sdl":   (["get_code"],               "APPID",          False),
    "gy":    (["get_code"],               "APPID",          False),
    "phwd":  (["get_wx_code"],            "ACTIVITY_APPID", False),  # 原签名 get_wx_code(wxid)
    "txmap": (["get_wxcode"],             "APPID",          False),
}


def _make_code_fn(appid: str, openid: str, use_first_arg: bool = False):
    """生成覆盖用的取 code 闭包，统一签名兼容 (*args, **kwargs)"""
    def _code(*args, **kwargs):
        actual_appid = str(args[0] if (use_first_arg and args) else appid).strip()
        return _VMPF.get_code(openid, actual_appid)
    return _code


def _patch_module_code(module, key: str, openid: str, appid_override: str = "") -> str:
    """把当前 openid 绑定的取 code 闭包注入到内嵌模块，返回用到的 appid"""
    spec = CODE_FN_MAP.get(key)
    if not spec:
        log_global("注入", f"{key} 未配置 VMPF code 注入映射")
        return ""
    fn_names, appid_var, is_method = spec
    use_first_arg = appid_var == "__param__"
    appid = appid_override or ""
    if not appid and not use_first_arg:
        appid = str(getattr(module, appid_var, "") or "")
    if not appid and not use_first_arg:
        log_global("注入", f"{key} 读取 appid 失败（变量 {appid_var}）")
        return ""
    code_fn = _make_code_fn(appid, openid, use_first_arg=use_first_arg)
    if is_method:
        # jhhhh: JuhuiClient.fetch_code(self) -> 忽略 self，走闭包
        client_cls = getattr(module, "JuhuiClient", None)
        if client_cls is not None:
            setattr(client_cls, "fetch_code", lambda self, *a, **kw: code_fn())
        else:
            log_global("注入", f"{key} 未找到 JuhuiClient，无法注入 VMPF code")
            return ""
    else:
        for fn_name in fn_names:
            setattr(module, fn_name, code_fn)
    return appid or "__param__"


# ========================================
# 全局配置 (globalConfig)
# True=开启, False=关闭
# ========================================
globalConfig = {
    # --- 功能总开关 ---
    "enable_cjzs": False,        # 抽奖助手：code 登录、签到、参与抽奖、查询中奖
    "enable_tclx": True,        # 同程旅行：code 登录、签到页任务、花神祈福、刮刮乐
    "enable_kln": True,         # 客徕拿：code 登录、广告任务、乐豆汇总
    "enable_kww": False,         # 口味王：code 刷新 CK、会员任务
    "enable_jhhhh": True,       # 巨惠好花红：code 登录、签到、产品打卡
    "enable_dtsh": False,        # DT生活：code 登录、每日签到、积分查询
    "enable_sanfu": True,       # 三福：code 登录、签到、福币查询
    "enable_kkkl": True,        # 可口可乐：code 登录、每天有乐、可口可乐吧签到
    "enable_txmap": True,       # 腾讯地图：code 登录、每日签到
    "enable_phwd": False,        # 平和味道：微信 H5 签到、答题、抽奖

    "enable_mxbc": True,        # 蜜雪冰城：code 登录、雪王币任务
    "enable_nw": False,          # 浓五酒馆：code 登录、签到
    "enable_sdl": True,         # 三得利：code 登录、签到与积分
    "enable_gy": True,          # 国乐酱酒：code 登录、签到与积分
    "enable_notify": True,      # 推送总开关；关闭后会写入各模块 *_PUSH=0
    "stop_on_error": False,     # 单模块失败后是否停止后续模块

    # --- 模块入口配置 ---
    "modules": {
        "cjzs": {
            "name": "抽奖助手",
            "args": ["login"],  # 可改为 join/sign/winnings
            "use_lock": True,         # 沿用抽奖助手互斥锁，避免重复执行
            "center_notify": False,
        },
        "tclx": {
            "name": "同程旅行",
            "args": [],
            "center_notify": False,
        },
        "kln": {
            "name": "客徕拿",
            "args": [],
            "center_notify": False,
        },
        "kww": {
            "name": "口味王",
            "args": [],
            "entry": "run",
            "center_notify": False,
        },
        "jhhhh": {
            "name": "巨惠好花红",
            "args": [],
            "center_notify": False,
        },
        "dtsh": {
            "name": "DT生活",
            "args": [],
            "center_notify": False,
        },
        "sanfu": {
            "name": "三福",
            "args": [],
            "center_notify": False,
        },
        "kkkl": {
            "name": "可口可乐",
            "args": [],
            "center_notify": False,
        },
        "txmap": {
            "name": "腾讯地图",
            "args": [],
            "center_notify": True,
        },
        "phwd": {
            "name": "平和味道",
            "args": [],
            "center_notify": True,
        },

        "mxbc": {
            "name": "蜜雪冰城",
            "args": [],
            "center_notify": True,
        },
        "nw": {
            "name": "浓五酒馆",
            "args": [],
            "center_notify": True,
        },
        "sdl": {
            "name": "三得利",
            "args": [],
            "center_notify": True,
        },
        "gy": {
            "name": "国乐酱酒",
            "args": [],
            "center_notify": True,
        },
    },
}

NOTIFY_ENV_KEYS = ("CJZS_PUSH", "TCLX_PUSH", "KELAINA_PUSH", "KWW_PUSH", "JH_PUSH", "KKKL_PUSH")
MODULE_CACHE: Dict[str, types.ModuleType] = {}


def now_text() -> str:
    return datetime.now().strftime("%H:%M:%S")


def print_banner(title: str) -> None:
    line = "═" * 68
    print(f"\n{line}", flush=True)
    print(title, flush=True)
    print(line, flush=True)


def log_global(label: str, message: str) -> None:
    print(f"[{now_text()}] {label:<6} | {message}", flush=True)


class Tee:
    def __init__(self, *streams):
        self.streams = streams

    def write(self, data):
        for stream in self.streams:
            stream.write(data)
        return len(data)

    def flush(self):
        for stream in self.streams:
            stream.flush()


def enabled_modules(config: Dict) -> List[Dict]:
    items = []
    for key, module_config in config.get("modules", {}).items():
        if not config.get(f"enable_{key}", True):
            continue
        item = dict(module_config)
        item["key"] = key
        item.setdefault("args", [])
        item.setdefault("entry", "main")
        item.setdefault("use_lock", False)
        items.append(item)
    return items


def apply_notify_switch(enabled: bool) -> None:
    if enabled:
        return
    for key in NOTIFY_ENV_KEYS:
        os.environ[key] = "0"


def center_notify_content(result: Dict, output: str) -> str:
    lines = [
        f"模块: {result.get('name', '')}",
        f"状态: {result.get('status', '')}",
        f"耗时: {result.get('seconds', 0)} 秒",
        f"消息: {result.get('message') or '-'}",
    ]
    output = output.strip()
    if output:
        lines.extend(["", output])
    return "\n".join(lines)


def send_center_notify(item: Dict, result: Dict, output: str) -> None:
    if not item.get("center_notify") or not globalConfig.get("enable_notify", True):
        return
    if not notify_send:
        log_global("推送", f"{result.get('name', item.get('key', '模块'))} 未找到 notify 模块")
        return
    try:
        notify_send(f"{result.get('name', item.get('key', '模块'))}任务结果", center_notify_content(result, output))
        log_global("推送", f"{result.get('name', item.get('key', '模块'))} 已发送")
    except Exception as exc:
        log_global("推送", f"{result.get('name', item.get('key', '模块'))} 发送失败: {exc}")


def load_embedded_module(key: str):
    if key in MODULE_CACHE:
        return MODULE_CACHE[key]
    source = EMBEDDED_SOURCES.get(key)
    if not source:
        raise KeyError(f"未找到内置模块源码: {key}")
    module_name = f"_wxcode_center_{key}"
    module = types.ModuleType(module_name)
    module.__file__ = str(Path(__file__).resolve())
    module.__package__ = ""
    sys.modules[module_name] = module
    exec(compile(source, f"<{key}_embedded>", "exec"), module.__dict__)
    MODULE_CACHE[key] = module
    return module


@contextmanager
def patched_argv(args: List[str]) -> Iterator[None]:
    old_argv = sys.argv[:]
    sys.argv = [str(Path(__file__).resolve()), *[str(arg) for arg in args]]
    try:
        yield
    finally:
        sys.argv = old_argv


def normalize_exit_code(code) -> int:
    if code is None:
        return 0
    if isinstance(code, bool):
        return 0 if code else 1
    if isinstance(code, int):
        return code
    return 1


def call_entry(module, item: Dict) -> int:
    entry_name = str(item.get("entry") or "main")
    entry = getattr(module, entry_name, None)
    if not callable(entry):
        raise AttributeError(f"未找到入口函数: {entry_name}")
    with patched_argv(list(item.get("args") or [])):
        try:
            return normalize_exit_code(entry())
        except SystemExit as exc:
            return normalize_exit_code(exc.code)


def run_module(item: Dict) -> Dict:
    started = time.time()
    result = {
        "key": item.get("key", ""),
        "name": item.get("name", item.get("key", "未知模块")),
        "status": "失败",
        "version": "",
        "seconds": 0,
        "message": "",
    }
    module = None
    locked = False
    output = io.StringIO() if item.get("center_notify") else None
    key = str(item.get("key") or "")

    try:
        module = load_embedded_module(key)
        result["version"] = str(getattr(module, "SCRIPT_VERSION", getattr(module, "VERSION", "")) or "")
        if item.get("use_lock") and hasattr(module, "try_acquire_lock"):
            locked = bool(module.try_acquire_lock())
            if not locked:
                result["status"] = "跳过"
                result["message"] = "已有实例在运行"
                return result

        # 读取 qingyun_openid 指定的账号
        accounts = _VMPF.get_accounts()
        if not accounts:
            result["status"] = "失败"
            result["message"] = "未配置 qingyun_openid 或为空，跳过运行"
            return result

        # phwd 自带多账号循环，强制单账号以配合外层循环
        saved_ph_wxid = os.environ.get("PH_WXID")
        is_phwd = (key == "phwd")

        sub_results = []  # [{openid, nickname, exit_code}]
        for ai, acc in enumerate(accounts, 1):
            openid = acc.get("openid", "")
            nickname = acc.get("nickname", openid[:10])
            if not openid:
                continue
            # 注入当前 openid 的取 code 闭包
            injected_appid = _patch_module_code(module, key, openid)
            if PURE_VMPF_MODE and not injected_appid:
                exit_code = 1
                log_global("VMPF", f"{key} 未完成 VMPF code 注入，纯 VMPF 模式禁止回退本地 wxcode")
                sub_results.append({"openid": openid, "nickname": nickname, "exit_code": exit_code})
                continue
            if is_phwd:
                # 让 phwd 内部循环退化为单账号，避免重复用同一 openid 取 code
                os.environ["PH_WXID"] = openid
            log_global("账号", f"{ai}/{len(accounts)} {nickname} ({openid[:12]}...)")

            def _run_once():
                if output is None:
                    return call_entry(module, item)
                with redirect_stdout(Tee(sys.stdout, output)):
                    return call_entry(module, item)

            try:
                exit_code = _run_once()
            except Exception as exc:
                exit_code = 1
                log_global("账号", f"{nickname} 执行异常: {exc}")
            sub_results.append({"openid": openid, "nickname": nickname, "exit_code": exit_code})

            if ai < len(accounts) and WXCODE_MODULE_DELAY > 0:
                time.sleep(WXCODE_MODULE_DELAY)

        if is_phwd:
            # 恢复 PH_WXID
            if saved_ph_wxid is None:
                os.environ.pop("PH_WXID", None)
            else:
                os.environ["PH_WXID"] = saved_ph_wxid

        # 汇总子结果
        total = len(sub_results)
        ok = sum(1 for r in sub_results if r["exit_code"] == 0)
        if total and ok == total:
            result["status"] = "成功"
        elif ok > 0:
            result["status"] = "部分成功"
        else:
            result["status"] = "失败"
        result["message"] = f"账号 {total} 个，成功 {ok} / 失败 {total - ok}"
    except Exception as exc:
        result["message"] = str(exc)
    finally:
        if locked and module is not None:
            release_lock = getattr(module, "release_lock", None)
            if callable(release_lock):
                try:
                    release_lock()
                except Exception:
                    pass
        result["seconds"] = round(time.time() - started, 2)
        if output is not None:
            send_center_notify(item, result, output.getvalue())
    return result



def print_switches(config: Dict) -> None:
    print("-" * 36)
    for key, item in config.get("modules", {}).items():
        status = "运行" if config.get(f"enable_{key}", True) else "关闭"
        print(f"{item.get('name', key)}设置为: {status}", flush=True)
    print(f"推送通知设置为: {'开启' if config.get('enable_notify', True) else '关闭'}", flush=True)
    print(f"失败后停止: {'开启' if config.get('stop_on_error', False) else '关闭'}", flush=True)
    print("-" * 36)


def build_summary(results: List[Dict]) -> str:
    counts = {"成功": 0, "失败": 0, "跳过": 0}
    for item in results:
        status = str(item.get("status") or "")
        if status in counts:
            counts[status] += 1
    return " | ".join(f"{key} {counts[key]}" for key in ("成功", "失败", "跳过"))


def main() -> int:
    print_banner(f"{SCRIPT_NAME} {SCRIPT_VERSION}")
    log_global("时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log_global("模式", "纯 VMPF 模式，全部通过 VMPF 平台 JSLogin 获取 code 登录")
    log_global("VMPF", f"API: {VMPF_URL}")
    if not ACCOUNTS:
        log_global("VMPF", "未配置 qingyun_openid，将不运行任何账号（多账号使用 & 或换行分隔）")
    apply_notify_switch(bool(globalConfig.get("enable_notify", True)))
    print_switches(globalConfig)

    modules = enabled_modules(globalConfig)
    if not modules:
        log_global("结束", "没有开启任何模块")
        return 0

    results = []
    for index, item in enumerate(modules, 1):
        print_banner(f"{item['name']} {index}/{len(modules)}")
        result = run_module(item)
        results.append(result)
        version = f" {result['version']}" if result.get("version") else ""
        detail = f" | {result['message']}" if result.get("message") else ""
        log_global("结果", f"{result['name']}{version}: {result['status']}，耗时 {result['seconds']} 秒{detail}")
        if result["status"] == "失败" and globalConfig.get("stop_on_error", False):
            log_global("停止", "已开启失败后停止，后续模块不再执行")
            break
        if index < len(modules) and WXCODE_MODULE_DELAY > 0:
            log_global("等待", f"{WXCODE_MODULE_DELAY:g} 秒后执行下一个模块")
            time.sleep(WXCODE_MODULE_DELAY)

    print_banner("执行汇总")
    for item in results:
        version = f" {item['version']}" if item.get("version") else ""
        log_global(item["status"], f"{item['name']}{version} | {item['message'] or '-'}")
    log_global("完成", build_summary(results))
    return 1 if any(item.get("status") == "失败" for item in results) else 0

EMBEDDED_SOURCES = {
    'cjzs': r'''

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
抽奖助手自动任务 v1.0.0

功能：自动执行抽奖助手签到、抽奖参与与中奖记录查询任务
支持本地 wxcode 模块获取 code 登录当前微信账号
支持每日签到、批量参与抽奖与中奖推送

更新说明:
### 2026.05.10
v1.0.0:
- 接入本地 wxcode 模块获取 code 登录，移除旧版在线微信账号登录依赖
- 登录当前微信小程序账号并执行任务
- 保留每日签到、抽奖参与、中奖记录查询与统一推送

配置说明:
1. 本地 code 模块:
    - 安装并启用本目录的 wxcode_1.0_8.0.56.apk
    - 保持微信里「抽奖助手」小程序为当前登录账号
    - CJZS_CODE_URL 默认 http://127.0.0.1:8088/login?appId={appId}

2. AppID 设置 (可选):
    CJZS_APPID 默认 wx01bb1ef166cd3f4e

3. 推送设置 (可选):
    CJZS_PUSH = 0 关闭推送，默认开启
    青龙 notify.py 优先，PUSHPLUS_TOKEN 作为兜底通道

定时规则建议 (Cron):
35 7 * * *          # 每日登录、签到、抽奖与中奖查询

Update: 2026.05.10
"""

import requests
import json
import time
import os
import sys
import re
import hashlib
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any

try:
    from notify import send as notify_send
except ImportError:
    notify_send = None

# ============== 进程互斥锁 (防止青龙重复执行) ==============
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCK_FILE = os.path.join(SCRIPT_DIR, "lottery_run.lock")
# 锁超时时间(秒) - 超过此时间认为上次执行已异常退出
LOCK_TIMEOUT = 600


def try_acquire_lock() -> bool:
    """尝试获取执行锁,返回 True 表示可以执行,False 表示已有实例在运行"""
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE, "r") as f:
                old_pid = f.read().strip()
            # 检查旧进程是否还活着
            lock_mtime = os.path.getmtime(LOCK_FILE)
            age = time.time() - lock_mtime
            if age < LOCK_TIMEOUT:
                print(f"\n{'='*60}")
                print(f"  ⚠️ 检测到已有实例在运行，跳过此次执行")
                print(f"  PID: {old_pid} | 锁龄: {int(age)}秒前")
                print(f"  如需强制运行，请删除: {LOCK_FILE}")
                print(f"{'='*60}\n")
                return False
            else:
                print(f"[WARN] 旧锁文件已超时({int(age/60)}分钟), 将重新执行")
        except Exception:
            pass

    # 创建锁
    try:
        with open(LOCK_FILE, "w") as f:
            f.write(str(os.getpid()))
        return True
    except Exception as e:
        print(f"[WARN] 创建锁文件失败: {e}, 将继续执行")
        return True  # 创建失败也不阻塞


def release_lock():
    """释放执行锁"""
    try:
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)
    except Exception:
        pass

# ============== 配置 ==============
APPID = os.getenv("CJZS_APPID", "wx01bb1ef166cd3f4e").strip()
CODE_URL = (os.getenv("CJZS_CODE_URL") or "http://127.0.0.1:8088/login?appId={appId}").strip()
SCRIPT_VERSION = "v1.0.0"

# API 服务器
LOGIN_API = "https://lucky.nocode.com/v2external/user/login"


PUSH_SWITCH = os.getenv("CJZS_PUSH", "1").strip()
PUSHPLUS_TOKEN = os.getenv("PUSHPLUS_TOKEN", "").strip()

# 抽奖助手 API (来自源码分析)
API_HOST = "https://lucky.nocode.com"
API_VERSION = "v2"

# 调试模式：显示 API 返回的原始数据（用于排查问题）
DEBUG_MODE = True

# ============== 工具函数 ==============

def http_request(url: str, method: str = "GET", data: dict = None,
                 headers: dict = None, timeout: int = 30) -> dict:
    """发送 HTTP 请求"""
    if headers is None:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=timeout)
        else:
            response = requests.post(url, headers=headers, json=data, timeout=timeout)

        return response.json()
    except requests.exceptions.Timeout:
        return {"status": False, "message": "请求超时"}
    except requests.exceptions.ConnectionError:
        return {"status": False, "message": "连接失败,请检查服务地址"}
    except Exception as e:
        return {"status": False, "message": str(e)}


def now_text() -> str:
    return datetime.now().strftime("%H:%M:%S")


def print_banner(title: str) -> None:
    line = "═" * 68
    print(f"\n{line}", flush=True)
    print(title, flush=True)
    print(line, flush=True)


def log_global(label: str, message: str) -> None:
    print(f"[{now_text()}] {label:<4} | {message}", flush=True)


def build_notify_title() -> str:
    return f"抽奖助手自动任务 {SCRIPT_VERSION}"


def build_push_message(results: List[Dict[str, object]]) -> str:
    lines = ["抽奖助手自动任务", "━━━━━━━━━━━━━━━━━━━━", f"执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"]
    for item in results:
        lines.append("")
        lines.append(f"{item.get('name', '任务')} | {item.get('status', '未知')}")
        for line in item.get("lines", []):
            lines.append(f"• {line}")
    normal = sum(1 for item in results if item.get("status") != "失败")
    lines.append("")
    lines.append(f"任务结果: {normal}/{len(results)} 正常")
    return "\n".join(lines).strip()


def print_result_block(result: Dict[str, object]) -> None:
    print(f"[{result.get('name', '任务')}] {result.get('status', '未知')}", flush=True)
    for line in result.get("lines", []):
        print(f"  • {line}", flush=True)
    print("", flush=True)


def build_console_summary(results: List[Dict[str, object]]) -> str:
    if not results:
        return "无执行结果"
    counts = {"成功": 0, "部分成功": 0, "失败": 0}
    for item in results:
        status = str(item.get("status") or "")
        if status in counts:
            counts[status] += 1
    return " | ".join(f"{name} {counts[name]}" for name in ("成功", "部分成功", "失败"))


def send_notify_message(results: List[Dict[str, object]]) -> bool:
    if PUSH_SWITCH != "1":
        log_global("推送", "关闭")
        return False
    title = build_notify_title()
    message = build_push_message(results)
    if notify_send:
        try:
            notify_send(title, message)
            log_global("推送", "消息发送成功")
            return True
        except Exception as e:
            log_global("推送", f"消息发送失败 | {e}")
    if PUSHPLUS_TOKEN:
        return send_pushplus(title, message)
    log_global("推送", "未找到 notify 模块，跳过发送")
    return False


def send_pushplus(title: str, content: str) -> bool:
    """通过 PushPlus 发送通知"""
    if not PUSHPLUS_TOKEN:
        return False
    try:
        resp = requests.post(
            "http://www.pushplus.plus/send",
            json={"token": PUSHPLUS_TOKEN, "title": title, "content": content.replace("\n", "<br>"), "template": "html"},
            timeout=10
        )
        result = resp.json()
        if result.get("code") == 200:
            log_global("推送", "PushPlus 消息发送成功")
            return True
        else:
            log_global("推送", f"PushPlus 发送失败 | {result.get('msg', result)}")
            return False
    except Exception as e:
        log_global("推送", f"PushPlus 发送异常 | {e}")
        return False


def mask_text(text: str) -> str:
    text = str(text or "")
    if len(text) <= 8:
        return "***"
    return f"{text[:4]}...{text[-4:]}"


def extract_code(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    status = payload.get("status", payload.get("Status"))
    err = payload.get("err", payload.get("Err"))
    if status not in (None, "", True, 1, "1", 0, "0", 200, "200", "ok", "OK", "success", "SUCCESS"):
        return ""
    if err not in (None, "", 0, "0"):
        return ""
    items = [payload]
    for key in ("data", "Data", "result", "Result"):
        value = payload.get(key)
        if isinstance(value, dict):
            items.append(value)
        elif isinstance(value, str) and value.strip():
            return value.strip()
    for item in items:
        for key in ("code", "Code"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return ""


def get_wx_code() -> str:
    url = CODE_URL.format(appId=APPID, appid=APPID)
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        code = extract_code(resp.json())
        if code:
            print(f"  [OK] 获取 code 成功: {mask_text(code)}")
            return code
        print("  [ERROR] 获取 code 失败: 未返回 code")
    except Exception as e:
        print(f"  [ERROR] 获取 code 失败: {e}")
    return ""


def login_with_code(code: str) -> dict:
    """使用登录码获取 access_token"""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "xweb_xhr": "1",
        "platform": "wechat",
        "version": "2.9.34",
        "client-version": "4.1.8.67"
    }

    data = {
        "code": code,
        "platform": "wechat"
    }

    result = http_request(LOGIN_API, method="POST", data=data, headers=headers)

    if result.get("access_token"):
        return {
            "status": True,
            "access_token": result.get("access_token"),
            "data": result
        }

    return {
        "status": False,
        "message": result.get("message", "登录失败"),
        "data": result
    }


def get_token_info(access_token: str) -> dict:
    """解析 token 获取信息"""
    try:
        parts = access_token.split('.')
        if len(parts) >= 2:
            import base64
            import json as json_lib

            payload = parts[1] + '=' * (4 - len(parts[1]) % 4)
            decoded = base64.urlsafe_b64decode(payload)
            return json_lib.loads(decoded)
    except:
        pass
    return {}


def account_text(item: dict) -> str:
    wxid = str(item.get("wxid") or "").strip()
    nickname = str(item.get("nickname") or "").strip()
    if nickname and wxid and nickname != wxid:
        return f"{nickname} ({wxid})"
    return nickname or wxid or "当前账号"


def summarize_login_result(result: dict) -> Dict[str, object]:
    rows = result.get("results", []) if isinstance(result, dict) else []
    success = int(result.get("success", 0)) if isinstance(result, dict) else 0
    fail = int(result.get("fail", 0)) if isinstance(result, dict) else 1
    status = "成功" if success and not fail else "部分成功" if success else "失败"
    lines = [f"登录成功 {success} 个，失败 {fail} 个"]
    for row in rows:
        if row.get("status"):
            lines.append(f"账号: {account_text(row)}")
        else:
            lines.append(f"失败: {row.get('reason', '未知原因')}")
    return {"name": "账号登录", "status": status, "lines": lines}


def summarize_sign_results(results: list) -> Dict[str, object]:
    if not results:
        return {"name": "每日签到", "status": "失败", "lines": ["没有可用账号或未返回签到结果"]}
    errors = sum(1 for item in results if item.get("error"))
    signed = sum(len(item.get("signed_lotteries", [])) for item in results)
    claimed = sum(len(item.get("claimed_tasks", [])) for item in results)
    points = sum(int(item.get("total_points_gained", 0) or 0) for item in results)
    status = "失败" if errors == len(results) else "部分成功" if errors else "成功"
    lines = [f"账号 {len(results)} 个，签到抽奖 {signed} 个，任务奖励 {claimed} 个", f"愿望值增加 {points} 分"]
    for item in results:
        if item.get("error"):
            lines.append(f"{account_text(item)}: {item.get('error')}")
    return {"name": "每日签到", "status": status, "lines": lines}


def summarize_join_results(results: list) -> Dict[str, object]:
    if not results:
        return {"name": "参与抽奖", "status": "失败", "lines": ["没有可用账号或未返回参与结果"]}
    already = sum(int(item.get("already_joined", 0) or 0) for item in results)
    joined = sum(int(item.get("joined", 0) or 0) for item in results)
    signed = sum(int(item.get("signed", 0) or 0) for item in results)
    failed = sum(int(item.get("failed", 0) or 0) for item in results)
    status = "部分成功" if failed else "成功"
    lines = [f"已参与 {already} 个，本次参与 {joined} 个", f"签到抽奖 {signed} 个，失败 {failed} 个"]
    return {"name": "参与抽奖", "status": status, "lines": lines}


def summarize_winning_results(results: list) -> Dict[str, object]:
    if not results:
        return {"name": "中奖查询", "status": "失败", "lines": ["没有可用账号或未返回中奖结果"]}
    checked = sum(int(item.get("checked_count", 0) or 0) for item in results)
    winning = sum(int(item.get("winning_count", 0) or 0) for item in results)
    lines = [f"检查抽奖 {checked} 个，中奖记录 {winning} 条"]
    for item in results:
        if item.get("winning_count", 0) > 0:
            lines.append(f"{account_text(item)}: {item.get('winning_count')} 条中奖")
            for record in item.get("records", [])[:3]:
                prize = record.get("prize_name") or "未知奖品"
                lines.append(f"{record.get('lottery_name', '抽奖')[:28]}: {prize}")
    return {"name": "中奖查询", "status": "成功", "lines": lines}


def finish_run(summaries: List[Dict[str, object]]) -> None:
    print_banner("执行汇总")
    for item in summaries:
        print_result_block(item)
    log_global("结果", build_console_summary(summaries))
    send_notify_message(summaries)


# 签名密钥 (源自反编译小程序的 _config.default.token)
SIGN_TOKEN = "nuTW7z+c(H?MD+kbWR6XGnb6Be2v8ttU"
SIGN_BASE = f"{API_HOST}/{API_VERSION}"  # "https://lucky.nocode.com/v2"


def _sorted_query(params: dict) -> str:
    """将字典按 key 排序, 格式化为 key=value&key=value"""
    if not params:
        return ""
    items = []
    for k in sorted(params.keys()):
        v = params[k]
        if isinstance(v, (list, tuple)):
            v = str(v[0]) if v else ""
        elif not isinstance(v, str):
            v = str(v) if v is not None else ""
        items.append(f"{k}={v}")
    return "&".join(items)


def make_sign(url: str, method: str = "GET", body: dict = None) -> dict:
    """
    生成 API 签名 (从反编译小程序 @mina-modules/sign 逆向得出)

    签名字符串: sha1(method:path:queryParams:bodyHash:timestamp:secretToken:1)
    返回: {"timestamp": "...", "sign": "..."}
    """
    parsed = urlparse(url)
    method = method.lower()

    # 1. 提取 path (去掉 API_HOST/API_VERSION 前缀)
    if url.startswith(SIGN_BASE):
        path = url[len(SIGN_BASE):]
    else:
        path = parsed.path or "/"

    # path 中去掉 query string
    if "?" in path:
        path = path.split("?")[0]

    # 2. 提取并排序 URL 参数
    query_params = {}
    if parsed.query:
        for k, v in parse_qs(parsed.query).items():
            query_params[k] = v[0] if isinstance(v, list) and len(v) == 1 else v

    # 3. 对于 GET，需要合并 URL 参数和 body 参数
    if method == "get" and body:
        merged = dict(query_params)
        for k, v in body.items():
            merged[k] = v
        query_params = merged

    sorted_query = _sorted_query(query_params)

    # 4. bodyHash: GET 为空; POST 为 md5(sortedBody)
    body_hash = ""
    if method == "post" and body:
        sorted_body = _sorted_query(body)
        if sorted_body:
            body_hash = hashlib.md5(sorted_body.encode()).hexdigest()

    # 5. timestamp
    ts = int(time.time() * 1000)

    # 6. 组装签名字符串
    sign_str = f"{method}:{path}:{sorted_query}:{body_hash}:{ts}:{SIGN_TOKEN}:1"

    # SIGN debug 已关闭 (日志噪音太大)
    # if DEBUG_MODE:
    #     print(f"  [SIGN] {sign_str[:200]}")

    # 7. SHA1
    sign = hashlib.sha1(sign_str.encode()).hexdigest()

    return {"timestamp": str(ts), "sign": sign}


def build_api_headers(token: str, url: str = None, method: str = "GET", body: dict = None) -> dict:
    """构建 API 请求头 (含签名)"""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
        "X-Request-ID": f"{int(time.time() * 1000)}-{os.urandom(4).hex()}",
        "version": "2.9.34",
        "Client-Version": "4.1.8.67",
        "platform": "wechat"
    }

    # 添加签名 (除非 token 为空或等待登录)
    if url and token and token != "waiting_for_login":
        sign_headers = make_sign(url, method, body)
        headers.update(sign_headers)

    return headers


# ============== 核心功能 ==============

def extract_login_identity(login_result: dict) -> dict:
    token = login_result.get("access_token", "")
    data = login_result.get("data")
    sources = []
    if isinstance(data, dict):
        sources.append(data)
        for key in ("user", "data", "profile"):
            value = data.get(key)
            if isinstance(value, dict):
                sources.append(value)
    token_info = get_token_info(token)
    if token_info:
        sources.append(token_info)

    account_key = ""
    nickname = ""
    for source in sources:
        if not nickname:
            for key in ("nickname", "nick_name", "name", "username"):
                value = source.get(key)
                if value:
                    nickname = str(value).strip()
                    break
        if not account_key:
            for key in ("id", "user_id", "uid", "sub", "openid", "open_id", "unionid", "union_id"):
                value = source.get(key)
                if value:
                    account_key = str(value).strip()
                    break
    if not account_key:
        account_key = "wxcode_" + hashlib.md5(token.encode()).hexdigest()[:12]
    return {"wxid": account_key, "nickname": nickname or account_key}


def login_single_account(wxid: str = "", nickname: str = "") -> dict:
    """登录当前微信账号"""
    print(f"\n{'='*50}")
    print("[登录] 本地 wxcode 当前微信账号")

    print(f"[1/2] 获取登录码...")
    code = get_wx_code()

    if not code:
        print(f"[FAIL] 获取登录码失败")
        return {"status": False, "wxid": wxid or "wxcode", "reason": "获取登录码失败"}

    print(f"[2/2] 登录获取 token...")
    result = login_with_code(code)

    if result.get("status"):
        token = result["access_token"]
        identity = extract_login_identity(result)
        wxid = identity["wxid"]
        nickname = nickname or identity["nickname"]
        print(f"[OK] 登录成功!")

        token_info = get_token_info(token)
        expire_time = 0
        if "exp" in token_info:
            expire_time = token_info["exp"]

        return {
            "status": True,
            "wxid": wxid,
            "nickname": nickname,
            "access_token": token,
            "expire_time": expire_time,
            "login_time": datetime.now().isoformat()
        }
    else:
        print(f"[FAIL] 登录失败: {result.get('message')}")
        return {
            "status": False,
            "wxid": wxid or "wxcode",
            "reason": result.get("message", "登录失败")
        }


def run_login() -> dict:
    """登录本地 wxcode 当前账号"""
    print("\n" + "="*60)
    print("  抽奖助手本地 wxcode 登录")
    print("="*60)

    print("\n[步骤1] 获取当前微信账号 code 并登录...")
    result = login_single_account()
    results = []
    account_tokens = {}
    success_count = 0
    fail_count = 0
    results.append(result)

    if result.get("status"):
        success_count = 1
        wxid = result["wxid"]
        account_tokens[wxid] = {
            "nickname": result.get("nickname", wxid),
            "access_token": result["access_token"],
            "expire_time": result.get("expire_time", 0),
            "login_time": result.get("login_time", "")
        }
    else:
        fail_count = 1

    print("\n" + "="*60)
    print("  登录结果汇总")
    print("="*60)
    print("总计: 1 个账号")
    print(f"新登录: {success_count} 个")
    print(f"失败: {fail_count} 个")

    if success_count > 0:
        print(f"\n成功登录的账号:")
        for r in results:
            if r.get("status"):
                print(f"  ✓ {r.get('nickname', r.get('wxid'))} ({r.get('wxid')})")

    if fail_count > 0:
        print(f"\n登录失败的账号:")
        for r in results:
            if not r.get("status"):
                print(f"  ✗ {r.get('wxid')} - {r.get('reason', '未知原因')}")

    return {
        "status": success_count > 0,
        "total": 1,
        "success": success_count,
        "fail": fail_count,
        "results": results,
        "tokens": account_tokens
    }


# ============== 抽奖参与功能 (来自源码分析) ==============

def get_lottery_list(token: str, size: int = 20, from_id: str = None) -> dict:
    """获取随机/推荐抽奖列表"""
    params = f"type=detail&size={size}"
    if from_id:
        params += f"&from_id={from_id}&position=swipe"
    url = f"{API_HOST}/{API_VERSION}/lottery/random?{params}"
    headers = build_api_headers(token, url)

    return http_request(url, headers=headers)


def get_suggest_lottery(token: str) -> dict:
    """获取用户推荐抽奖"""
    url = f"{API_HOST}/{API_VERSION}/user/suggest/lottery"
    headers = build_api_headers(token, url)

    return http_request(url, headers=headers)


def get_daily_public_lottery(token: str) -> dict:
    """获取每日公开抽奖"""
    url = f"{API_HOST}/{API_VERSION}/lottery/daily_public"
    headers = build_api_headers(token, url)

    return http_request(url, headers=headers)


def get_public_lottery(token: str, no_card: int = 0) -> dict:
    """获取公开抽奖列表(主列表,HAR验证有效)"""
    url = f"{API_HOST}/{API_VERSION}/public?no_card={no_card}"
    headers = build_api_headers(token, url)

    result = http_request(url, headers=headers)

    if DEBUG_MODE:
        keys = list(result.keys()) if result else []
        sq = result.get("square")
        sq_count = len(sq) if isinstance(sq, list) else 0
        err = result.get("error") or result.get("errors") or result.get("message")
        status = f"square={sq_count}, keys={keys}"
        if err:
            status += f", error={str(err)[:100]}"
        if err and "unauthorized" in str(err).lower():
            print(f"  ⚠ Token 可能已过期! 错误: {str(err)[:200]}")
        print(f"  [DEBUG] /v2/public → {status}")

    return result


def get_lottery_lucky_users(token: str, lottery_id: str, page: int = 1, size: int = 21) -> dict:
    """获取某个抽奖的中奖用户列表"""
    url = f"{API_HOST}/{API_VERSION}/lottery/{lottery_id}/lucky_users?page={page}&size={size}"
    headers = build_api_headers(token, url)

    return http_request(url, headers=headers)


def get_lottery_result(token: str, lottery_id: str) -> dict:
    """获取抽奖结果"""
    url = f"{API_HOST}/{API_VERSION}/lottery/{lottery_id}/result"
    headers = build_api_headers(token, url)

    return http_request(url, headers=headers)


def get_lottery_lucky_base(token: str, lottery_id: str) -> dict:
    """获取抽奖基础信息(包含中奖信息)"""
    url = f"{API_HOST}/{API_VERSION}/lottery/{lottery_id}/lucky_base"
    headers = build_api_headers(token, url)

    return http_request(url, headers=headers)


def get_lottery_detail(token: str, lottery_id: str) -> dict:
    """获取抽奖详情"""
    url = f"{API_HOST}/{API_VERSION}/lottery/{lottery_id}"
    headers = build_api_headers(token, url)

    result = http_request(url, headers=headers)

    if DEBUG_MODE and not result.get("data") and result.get("error"):
        print(f"    [DEBUG] 详情API错误: {str(result.get('error'))[:150]}")

    return result


def join_lottery(token: str, lottery_id: str, data: dict = None) -> dict:
    """参与抽奖"""
    url = f"{API_HOST}/{API_VERSION}/lottery/{lottery_id}/join"

    if data is None:
        data = {"form_id": "join_lottery"}
    elif isinstance(data, dict) and "form_id" not in data:
        data["form_id"] = "join_lottery"

    headers = build_api_headers(token, url, "POST", data)

    return http_request(url, method="POST", data=data, headers=headers)


def feel_lucky(token: str, lottery_id: str) -> dict:
    """广告抽奖/Feel Lucky 参与"""
    url = f"{API_HOST}/{API_VERSION}/lottery/{lottery_id}/feel_lucky"
    headers = build_api_headers(token, url, "POST", {})

    return http_request(url, method="POST", data={}, headers=headers)


# ============== 签到功能 (HAR验证) ==============

def get_daily_bonus(token: str) -> dict:
    """获取每日签到状态 (HAR: /v2/daily_bonus)
    返回: {step, is_signed, total_points, suggest, ...}"""
    url = f"{API_HOST}/{API_VERSION}/daily_bonus"
    headers = build_api_headers(token, url)

    result = http_request(url, headers=headers)

    if DEBUG_MODE:
        data = result.get("data", {})
        if data:
            signed = data.get("is_signed", False)
            step = data.get("step", 0)
            points = data.get("total_points", 0)
            suggest = data.get("suggest", {})
            suggest_id = suggest.get("data_id", "") if isinstance(suggest, dict) else ""
            print(f"  [签到状态] 已签={signed} 连续={step}天 积分={points} 推荐={suggest_id}")

    return result


def get_sign_lottery_list(token: str) -> dict:
    """获取签到抽奖列表 (HAR: /v2/public/sign_lottery)

    返回格式:
      - {"data":{"open_lottery":"xxx"}}       ← 当前进行中的
      - {"data":{"lottery_list":[...]}}        ← 列表(含sign_list已签日期)
    每个lottery: join_type=sign, sign_list=[签过的日期], prizes为奖品"""
    url = f"{API_HOST}/{API_VERSION}/public/sign_lottery"
    headers = build_api_headers(token, url)

    result = http_request(url, headers=headers)

    if DEBUG_MODE:
        data = result.get("data", {})
        open_id = data.get("open_lottery", "")
        lottery_list = data.get("lottery_list", [])

        open_n = 1 if open_id else 0
        list_n = len(lottery_list) if isinstance(lottery_list, list) else 0
        print(f"  [签到抽奖] open={open_n} list={list_n}")

        today_str = datetime.now().strftime("%Y-%m-%d")
        for lt in (lottery_list if isinstance(lottery_list, list) else []):
            sid = lt.get("id", "")
            sname = lt.get("sponsor", {}).get("name", "")[:30]
            slist = lt.get("sign_list", [])
            signed = today_str in slist
            print(f"    {sid} [{sname}] 已签={signed} 状态={lt.get('state','?')}")

    return result


def lottery_sign(token: str, lottery_id: str) -> dict:
    """签到打卡 (HAR: POST /v2/lottery/{id}/sign, body={})

    返回: {"data":{"point":5}}  ← 签到成功+愿望值; {"data":{}} ← 成功(无积分)"""
    url = f"{API_HOST}/{API_VERSION}/lottery/{lottery_id}/sign"
    headers = build_api_headers(token, url, "POST", {})

    return http_request(url, method="POST", data={}, headers=headers)


def get_reward_tasks(token: str) -> dict:
    """获取奖励任务列表 (HAR: /v2/reward_tasks?add_mini=true)"""
    url = f"{API_HOST}/{API_VERSION}/reward_tasks?add_mini=true"
    headers = build_api_headers(token, url)

    return http_request(url, headers=headers)


def claim_task_reward(token: str, task_id: int) -> dict:
    """领取任务奖励 (HAR: POST /v2/reward_tasks/{id}/rewards)"""
    url = f"{API_HOST}/{API_VERSION}/reward_tasks/{task_id}/rewards"
    data = {"form_id": "xxx"}
    headers = build_api_headers(token, url, "POST", data)

    return http_request(url, method="POST", data=data, headers=headers)


def do_daily_sign(token: str) -> dict:
    """执行每日签到+签到抽奖完整流程 [HAR验证版]

    流程:
      1. 查询每日签到状态 (daily_bonus)
      2. 获取签到抽奖列表 (sign_lottery)  
      3. 逐个签到未签的抽奖 (lottery/{id}/sign)
      4. 检查任务并领取奖励 (reward_tasks)"""

    print("\n" + "=" * 60)
    print("  🔔 每日签到 + 签到抽奖 [HAR验证版]")
    print("=" * 60)

    results = {
        "signed_lotteries": [],
        "claimed_tasks": [],
        "total_points_gained": 0,
        "daily_bonus_step": 0
    }

    # ===== Step 1: 查询签到状态 =====
    print("\n[1/5] 查询每日签到状态 (/v2/daily_bonus)...")
    try:
        daily = get_daily_bonus(token)
        if daily.get("data"):
            d = daily["data"]
            results["daily_bonus_step"] = d.get("step", 0)
            daily_signed = d.get("is_signed", False)
            total_points = d.get("total_points", 0)
            suggest = d.get("suggest", {})
            suggest_id = suggest.get("data_id", "") if isinstance(suggest, dict) else ""

            print(f"  {'✓ 已签到' if daily_signed else '✗ 未签到'}")
            print(f"  连续签到: {results['daily_bonus_step']} 天, 愿望积分: {total_points}")
            if suggest_id:
                print(f"  推荐抽奖: {suggest_id} - {suggest.get('title', '')}")
    except Exception as e:
        print(f"  ⚠ 获取失败: {e}")

    # ===== Step 2: 获取签到抽奖列表 =====
    print("\n[2/5] 获取签到抽奖列表 (/v2/public/sign_lottery)...")
    sign_lotteries = []
    open_lottery_id = ""
    today_str = datetime.now().strftime("%Y-%m-%d")

    try:
        sign_result = get_sign_lottery_list(token)

        # 调试: 打印签名API完整返回
        if DEBUG_MODE:
            resp_keys = list(sign_result.keys())
            if "data" not in sign_result:
                print(f"  [DEBUG] sign_lottery 异常返回, keys={resp_keys}, body={json.dumps(sign_result, ensure_ascii=False)[:300]}")
            elif not sign_result.get("data"):
                print(f"  [DEBUG] sign_lottery data 为空, keys={resp_keys}")

        data = sign_result.get("data", {})

        open_lottery_id = data.get("open_lottery", "")
        lottery_list = data.get("lottery_list", [])
        if isinstance(lottery_list, list):
            sign_lotteries = lottery_list

        # 确保 open_lottery 也在列表中
        if open_lottery_id and not sign_lotteries:
            sign_lotteries = [{"id": open_lottery_id}]
        elif open_lottery_id:
            all_ids = [lt.get("id", "") for lt in sign_lotteries]
            if open_lottery_id not in all_ids:
                sign_lotteries.append({"id": open_lottery_id})

        print(f"  当前进行中: {open_lottery_id or '无'} | 签到抽奖: {len(sign_lotteries)} 个")

    except Exception as e:
        print(f"  ✗ 获取失败: {e}")

    # ===== Step 3: 逐个签到 =====
    if not sign_lotteries:
        print("\n[3/5] 没有需要签到的抽奖")
        print("  (可能今日已全部签到, 或API返回空列表)")
    else:
        print(f"\n[3/5] 开始签到 ({len(sign_lotteries)} 个)...")

        for lottery in sign_lotteries:
            lottery_id = lottery.get("id", "")
            sign_list = lottery.get("sign_list", [])

            if not lottery_id:
                continue

            # 检查今天是否已签到
            if today_str in sign_list:
                print(f"  [{lottery_id}] 今日已签到，跳过")
                continue

            sponsor = lottery.get("sponsor", {}).get("name", "")
            sponsor_str = f" {sponsor[:25]}" if sponsor else ""
            state = lottery.get("state", -1)
            print(f"  [{lottery_id}]{sponsor_str} [state={state}] → 签到中...")

            try:
                sign_result = lottery_sign(token, lottery_id)

                if sign_result.get("data") is not None:
                    point = sign_result.get("data", {}).get("point", 0)
                    if point > 0:
                        print(f"    ✓ 签到成功! +{point} 愿望值")
                    else:
                        print(f"    ✓ 签到成功!")
                    results["total_points_gained"] += point
                    results["signed_lotteries"].append({
                        "id": lottery_id, "name": sponsor, "point": point
                    })
                elif sign_result.get("error"):
                    err = sign_result.get("error", {})
                    msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
                    print(f"    ✗ 签到失败: {msg}")
                else:
                    print(f"    ✓ 签到成功!")
                    results["signed_lotteries"].append({
                        "id": lottery_id, "name": sponsor, "point": 0
                    })

            except Exception as e:
                print(f"    ✗ 异常: {e}")

            time.sleep(0.5)

    # ===== Step 4: 确认积分 =====
    print(f"\n[4/5] 确认积分...")
    try:
        updated = get_daily_bonus(token)
        if updated.get("data"):
            results["daily_bonus_step"] = updated["data"].get("step", results["daily_bonus_step"])
    except Exception:
        pass

    # ===== Step 5: 领取任务奖励 =====
    print(f"\n[5/5] 检查任务奖励 (/v2/reward_tasks)...")
    try:
        tasks_result = get_reward_tasks(token)
        task_groups = tasks_result.get("data", [])

        if isinstance(task_groups, list):
            for group in task_groups:
                tasks = group.get("data", [])
                if not isinstance(tasks, list):
                    continue

                for task in tasks:
                    task_id = task.get("id")
                    task_name = task.get("task_name", "")
                    state = task.get("state", 0)  # 0=未完成 1=已完成未领取 2=已领取

                    # 只有 state=1 才能领取
                    if state != 1:
                        continue

                    rewards = task.get("rewards", [])
                    rw_parts = []
                    for rw in rewards:
                        rw_parts.append(f"{rw.get('count', 0)} {rw.get('type', 'reward')}")
                    reward_desc = " + ".join(rw_parts) if rw_parts else "无奖励"

                    print(f"  [task {task_id}] {task_name[:30]} ({reward_desc}) → 领取中...")

                    try:
                        claim = claim_task_reward(token, task_id)
                        if claim.get("result") == True:
                            print(f"    ✓ 领取成功!")
                            results["claimed_tasks"].append({
                                "id": task_id, "name": task_name, "reward": reward_desc
                            })
                        else:
                            fail_msg = str(claim.get("error", claim))[:80]
                            print(f"    ✗ 领取失败: {fail_msg}")
                    except Exception as e:
                        print(f"    ✗ 领取异常: {e}")

                    time.sleep(0.3)

    except Exception as e:
        print(f"  ⚠ 任务检查失败: {e}")
        import traceback
        traceback.print_exc()

    # ===== 汇总 =====
    print("\n" + "=" * 60)
    print("  签到结果汇总")
    print("=" * 60)
    signed_n = len(results["signed_lotteries"])
    claimed_n = len(results["claimed_tasks"])
    points = results["total_points_gained"]
    step = results["daily_bonus_step"]

    print(f"每日签到: 连续 {step} 天")
    print(f"签到抽奖: {signed_n} 个" + (f", 获得 +{points} 愿望值" if points > 0 else ""))
    print(f"任务奖励: {claimed_n} 个")

    for sl in results["signed_lotteries"]:
        name = sl.get("name", "")
        p = f" +{sl.get('point', 0)}" if sl.get("point", 0) > 0 else ""
        print(f"  ✓ {sl['id']}{'(' + name + ')' if name else ''}{p}")
    for ct in results["claimed_tasks"]:
        print(f"  ✓ {ct['name'][:35]}: {ct['reward']}")

    return results


def do_daily_sign_all(tokens: Dict[str, Dict[str, object]]) -> list:
    """为所有已登录账号执行每日签到+签到抽奖"""
    print("\n" + "=" * 60)
    print("  🔔 批量账号每日签到")
    print("=" * 60)

    if not tokens:
        print("[ERROR] 没有可用 token")
        return []

    # 检查 token 有效性
    now = time.time()
    valid_tokens = {}
    for wxid, info in tokens.items():
        if info.get("expire_time", 0) == 0 or info.get("expire_time", 0) > now:
            valid_tokens[wxid] = info
        else:
            print(f"[WARN] Token 已过期，跳过: {wxid}")

    if not valid_tokens:
        print("[ERROR] 没有有效的 tokens，请重新登录")
        return []

    print(f"\n共有 {len(valid_tokens)} 个有效账号")

    all_results = []
    for i, (wxid, info) in enumerate(valid_tokens.items(), 1):
        nickname = info.get("nickname", "")
        print(f"\n{'#' * 50}")
        print(f"处理账号 {i}/{len(valid_tokens)}: {nickname} ({wxid})")
        print(f"{'#' * 50}")

        try:
            result = do_daily_sign(info["access_token"])
            result["wxid"] = wxid
            result["nickname"] = nickname
            all_results.append(result)
        except Exception as e:
            print(f"  ✗ 签到异常: {e}")
            all_results.append({
                "wxid": wxid, "nickname": nickname, "error": str(e),
                "signed_lotteries": [], "claimed_tasks": [], "total_points_gained": 0
            })

        time.sleep(1.5)

    # 总汇总
    print("\n" + "=" * 60)
    print("  所有账号签到汇总")
    print("=" * 60)

    for r in all_results:
        nick = r.get("nickname", r.get("wxid", ""))
        error = r.get("error", "")

        if error:
            print(f"\n{nick}: ✗ {error}")
        else:
            signed = len(r.get("signed_lotteries", []))
            points = r.get("total_points_gained", 0)
            claimed = len(r.get("claimed_tasks", []))
            step = r.get("daily_bonus_step", 0)

            print(f"\n{nick}: 连续{step}天 | 签到{signed}个" + (f" | +{points}分" if points > 0 else "") + (f" | 领取{claimed}个" if claimed > 0 else ""))

    return all_results


def check_if_joined(lottery_detail: dict) -> bool:
    """检查是否已参与抽奖"""
    if isinstance(lottery_detail, dict):
        # /v2/public 使用 joined 字段
        if lottery_detail.get("joined", False):
            return True
        # 其他接口可能用 is_participator
        return lottery_detail.get("is_participator", False) or lottery_detail.get("data", {}).get("is_participator", False)
    return False


def get_lottery_type(lottery: dict) -> str:
    """获取抽奖类型"""
    lottery_type = lottery.get("join_type", "") or lottery.get("type", "") or lottery.get("lottery_type", "")

    # 类型映射
    type_mapping = {
        "none": "普通抽奖",
        "phone": "手机授权抽奖",
        "normal": "普通抽奖",
        "ads": "广告抽奖",
        "ads_video": "视频广告抽奖",
        "video": "视频抽奖",
        "game": "游戏抽奖",
        "form": "表单抽奖",
        "password": "密码抽奖",
        "assist": "助力抽奖",
        "sign": "签到抽奖",
        "active_task": "活动任务抽奖",
        "condition_task": "条件任务抽奖",
        "offline": "离线抽奖",
        "verify": "验证抽奖",
        "wecom": "企业微信抽奖",
        "wecom_groupchat": "企业微信群聊抽奖",
        "official_cash": "公众号现金抽奖",
        "lucky_cash": "拼手气红包"
    }

    return type_mapping.get(lottery_type, lottery_type or "普通抽奖")


# 需要人工交互的抽奖类型，脚本无法自动参与
SPECIAL_TYPES = {
    "ads": "需要看广告",
    "ads_video": "需要看视频广告",
    "video": "需要看视频",
    "game": "需要玩游戏",
    "form": "需要填写表单",
    "password": "需要输入密码",
    "assist": "需要好友助力",
    "sign": "需要签到",
    "active_task": "需要完成任务",
    "condition_task": "需要满足条件",
    "verify": "需要验证",
    "offline": "线下抽奖",
    "wecom": "企业微信抽奖",
    "wecom_groupchat": "企业微信群聊抽奖",
}


def can_auto_join(lottery: dict) -> tuple:
    """检查抽奖是否可以自动参与
    Returns: (can_join: bool, reason: str)
    """
    join_type = lottery.get("join_type", "") or lottery.get("type", "") or lottery.get("lottery_type", "")
    draw_type = lottery.get("draw_type", "")

    # 检查 join_type 的特殊类型
    if join_type in SPECIAL_TYPES:
        return False, f"{SPECIAL_TYPES[join_type]}"

    # draw_type 检查：来源码分析，game/party/ontime 需要特殊处理
    if draw_type == "game":
        return False, "游戏抽奖(draw_type=game)"
    if join_type == "phone" and not lottery.get("phone_authorized"):
        return False, "需要手机授权"

    return True, ""


def join_all_lotteries(token: str, max_count: int = 50, skip_joined: bool = True) -> dict:
    """遍历并参与所有可参与的抽奖 (v2.0 - HAR验证版)"""
    print("\n" + "="*60)
    print("  遍历参与抽奖 [v2.0]")
    print("="*60)

    all_lotteries = []
    results = []

    # 1. 获取公开抽奖（主列表，HAR验证有效）
    print("\n[1/5] 获取公开抽奖列表(/v2/public)...")
    try:
        public_result = get_public_lottery(token)
        # /v2/public 返回 top-level: square, public_lottery
        if public_result.get("square"):
            square_items = [x for x in public_result["square"] if isinstance(x, dict)]
            all_lotteries.extend(square_items)
            print(f"  square: {len(square_items)} 个")
        else:
            print(f"  ⚠ square 为空, 完整响应: {json.dumps(public_result, ensure_ascii=False)[:300]}")
        pl = public_result.get("public_lottery", {})
        for sub_key in ["daily_list", "square_list", "recommend", "recommend_card_list"]:
            items = pl.get(sub_key, []) if isinstance(pl, dict) else []
            if items:
                filtered = [x for x in items if isinstance(x, dict)]
                if filtered:
                    all_lotteries.extend(filtered)
                    print(f"  {sub_key}: {len(filtered)} 个")
                elif any(isinstance(x, str) for x in items):
                    str_count = sum(1 for x in items if isinstance(x, str))
                    print(f"  {sub_key}: 跳过 {str_count} 个字符串(非标准对象)")
        print(f"  公开抽奖共获取到 {len(all_lotteries)} 个")
    except Exception as e:
        print(f"  ✗ 获取公开抽奖失败: {e}")
        import traceback
        traceback.print_exc()

    # 2. 获取随机抽奖（滑动推荐）
    print("\n[2/5] 获取随机抽奖列表(/v2/lottery/random)...")
    try:
        prev_id = None
        for i in range(3):  # 获取3组随机抽奖
            result = get_lottery_list(token, size=20, from_id=prev_id)
            data = result.get("data", [])
            if DEBUG_MODE and not data:
                print(f"    [DEBUG] random #{i+1} 返回空, keys={list(result.keys())}, "
                      f"error={result.get('error', result.get('errors', 'none'))}")
            if isinstance(data, list) and data:
                filtered = [x for x in data if isinstance(x, dict)]
                if filtered:
                    all_lotteries.extend(filtered)
                    prev_id = filtered[-1].get("id")
            else:
                break
            time.sleep(0.5)
        print(f"  随机抽奖共获取到 {len(all_lotteries)} 个")
    except Exception as e:
        print(f"  ✗ 获取随机抽奖失败: {e}")

    # 3. 获取每日公开抽奖
    print("\n[3/5] 获取每日公开抽奖...")
    try:
        daily_result = get_daily_public_lottery(token)
        if daily_result.get("data"):
            data = daily_result.get("data", [])
            if isinstance(data, list):
                filtered = [x for x in data if isinstance(x, dict)]
                if filtered:
                    all_lotteries.extend(filtered)
            elif isinstance(data, dict):
                inner = data.get("data", [])
                filtered = [x for x in inner if isinstance(x, dict)]
                if filtered:
                    all_lotteries.extend(filtered)
        print(f"  每日公开抽奖: {len(all_lotteries)} 个总计")
    except Exception as e:
        print(f"  获取每日公开抽奖失败: {e}")

    # 4. 获取用户推荐抽奖
    print("\n[4/5] 获取用户推荐抽奖...")
    try:
        suggest_result = get_suggest_lottery(token)
        if suggest_result.get("data"):
            data = suggest_result.get("data", [])
            if isinstance(data, list):
                filtered = [x for x in data if isinstance(x, dict)]
                if filtered:
                    all_lotteries.extend(filtered)
            elif isinstance(data, dict):
                inner = data.get("data", [])
                filtered = [x for x in inner if isinstance(x, dict)]
                if filtered:
                    all_lotteries.extend(filtered)
        print(f"  推荐抽奖: {len(all_lotteries)} 个总计")
    except Exception as e:
        print(f"  获取推荐抽奖失败: {e}")

    # 去重
    seen_ids = set()
    unique_lotteries = []
    for lottery in all_lotteries:
        if not isinstance(lottery, dict):
            continue
        lottery_id = lottery.get("id") or lottery.get("lottery_id")
        if lottery_id and lottery_id not in seen_ids:
            seen_ids.add(lottery_id)
            unique_lotteries.append(lottery)

    print(f"\n去重后共有 {len(unique_lotteries)} 个抽奖")

    # 限制数量
    if len(unique_lotteries) > max_count:
        print(f"  限制参与前 {max_count} 个抽奖")
        unique_lotteries = unique_lotteries[:max_count]

    # 遍历参与
    print("\n开始遍历参与抽奖...")
    joined_count = 0
    signed_count = 0
    sign_points_gained = 0
    skip_count = 0
    fail_count = 0
    already_joined_count = 0

    for i, lottery in enumerate(unique_lotteries, 1):
        if not isinstance(lottery, dict):
            continue
        lottery_id = lottery.get("id") or lottery.get("lottery_id")
        lottery_name = lottery.get("title") or lottery.get("name") or f"抽奖#{lottery_id}"
        lottery_type = get_lottery_type(lottery)

        print(f"\n[{i}/{len(unique_lotteries)}] {lottery_name[:30]} ({lottery_type})")
        print(f"    ID: {lottery_id}")

        # 检查特殊类型：需要人工交互的抽奖
        can_join, reason = can_auto_join(lottery)
        if not can_join:
            # 签到类型：使用签到API自动处理
            if lottery.get("join_type", "") == "sign":
                print(f"    📝 签到抽奖 → 签到中...")
                try:
                    sign_result = lottery_sign(token, lottery_id)
                    if sign_result.get("data") is not None:
                        point = sign_result.get("data", {}).get("point", 0)
                        if point > 0:
                            print(f"    ✓ 签到成功! +{point} 愿望值")
                        else:
                            print(f"    ✓ 签到成功!")
                        signed_count += 1
                        sign_points_gained += point
                        results.append({
                            "lottery_id": lottery_id,
                            "name": lottery_name,
                            "status": "signed",
                            "point": point
                        })
                    elif sign_result.get("error"):
                        err = sign_result.get("error", {})
                        msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
                        print(f"    ✗ 签到失败: {msg}")
                        fail_count += 1
                    else:
                        print(f"    ✓ 签到成功!")
                        signed_count += 1
                        results.append({
                            "lottery_id": lottery_id,
                            "name": lottery_name,
                            "status": "signed",
                            "point": 0
                        })
                except Exception as e:
                    print(f"    ✗ 签到异常: {e}")
                    fail_count += 1
                continue
            print(f"    ⏭ {reason}，脚本无法自动参与")
            skip_count += 1
            continue

        # 获取详情（优先获取，列表数据一般不含奖品名/标题）
        try:
            detail_result = get_lottery_detail(token, lottery_id)
            detail = detail_result.get("data", detail_result)

            if isinstance(detail, dict):
                # === 提取奖品名 ===
                prize_name = ""
                prizes = detail.get("prizes", None)
                if isinstance(prizes, dict):
                    prize_arr = prizes.get("data", [])
                    if prize_arr and isinstance(prize_arr[0], dict):
                        prize_name = prize_arr[0].get("name", "")
                if not prize_name and isinstance(prizes, list) and prizes:
                    prize_name = prizes[0].get("name", "") if isinstance(prizes[0], dict) else ""

                if prize_name:
                    print(f"    🎁 奖品: {prize_name[:80]}")

                # === 检查是否已参与 ===
                is_participator = (lottery.get("is_participator", False)
                                   or lottery.get("joined", False)
                                   or detail.get("is_participator", False)
                                   or detail.get("joined", False))

                if skip_joined and is_participator:
                    print(f"    ⏭ 已参与，跳过")
                    skip_count += 1
                    already_joined_count += 1
                    continue

                # 检查抽奖状态
                status = detail.get("status") or detail.get("lottery_status", "")
                if status in ["ended", "closed", "finished"]:
                    print(f"    ⏭ 已结束,跳过")
                    skip_count += 1
                    continue

                # 检查参与条件
                join_type = detail.get("join_type", "")
                if join_type == "phone" and not detail.get("phone_authorized"):
                    print(f"    ⏭ 需要手机授权,跳过")
                    skip_count += 1
                    continue

        except Exception as e:
            print(f"    ⚠ 获取详情失败: {e}")
            # 获取详情失败时，回退到列表数据判断
            is_participator = lottery.get("is_participator", False) or lottery.get("joined", False)
            if skip_joined and is_participator:
                print(f"    ⏭ 已参与(列表判断)，跳过")
                skip_count += 1
                already_joined_count += 1
                continue

        # 尝试参与
        try:
            join_result = join_lottery(token, lottery_id, {})

            if join_result.get("result") == True:
                print(f"    ✓ 参与成功!")
                joined_count += 1
                results.append({
                    "lottery_id": lottery_id,
                    "name": lottery_name,
                    "status": "success"
                })
            elif join_result.get("data") or join_result.get("status") == True:
                print(f"    ✓ 参与成功!")
                joined_count += 1
                results.append({
                    "lottery_id": lottery_id,
                    "name": lottery_name,
                    "status": "success"
                })
            elif join_result.get("error"):
                error_msg = join_result.get("error", {}).get("message", "")
                print(f"    ✗ 参与失败: {error_msg}")
                fail_count += 1
                results.append({
                    "lottery_id": lottery_id,
                    "name": lottery_name,
                    "status": "fail",
                    "error": error_msg
                })
            elif join_result.get("errors"):
                error_msg = join_result.get("errors", [{}])[0].get("message", "")
                print(f"    ✗ 参与失败: {error_msg}")
                fail_count += 1
            else:
                print(f"    ✗ 参与失败: 未知错误")
                fail_count += 1

        except Exception as e:
            print(f"    ✗ 参与异常: {e}")
            fail_count += 1

        # 避免请求过快
        time.sleep(0.8)

    # 结果汇总
    print("\n" + "="*60)
    print("  参与结果汇总")
    print("="*60)
    print(f"总抽奖数: {len(unique_lotteries)}")
    print(f"已参与: {already_joined_count}")
    print(f"本次参与: {joined_count}")
    print(f"签到成功: {signed_count}" + (f" (+{sign_points_gained}愿望值)" if sign_points_gained > 0 else ""))
    print(f"跳过: {skip_count - already_joined_count}")
    print(f"失败: {fail_count}")

    return {
        "total": len(unique_lotteries),
        "already_joined": already_joined_count,
        "joined": joined_count,
        "signed": signed_count,
        "sign_points": sign_points_gained,
        "skipped": skip_count - already_joined_count,
        "failed": fail_count,
        "results": results
    }


def join_lottery_for_all_accounts(tokens: Dict[str, Dict[str, object]], max_count: int = 50):
    """为所有已登录账号参与抽奖"""
    print("\n" + "="*60)
    print("  批量账号参与抽奖")
    print("="*60)

    if not tokens:
        print("[ERROR] 没有可用 token")
        return

    # 检查 token 有效性
    now = time.time()
    valid_tokens = {}
    for wxid, info in tokens.items():
        expire_time = info.get("expire_time", 0)
        if expire_time == 0 or expire_time > now:
            valid_tokens[wxid] = info
        else:
            print(f"[WARN] Token 已过期,跳过: {wxid}")

    if not valid_tokens:
        print("[ERROR] 没有有效的 tokens,请重新登录")
        return

    print(f"\n共有 {len(valid_tokens)} 个有效账号")

    all_results = []
    for i, (wxid, info) in enumerate(valid_tokens.items(), 1):
        print(f"\n{'='*50}")
        print(f"处理账号 {i}/{len(valid_tokens)}: {info.get('nickname', wxid)}")
        print(f"{'='*50}")

        result = join_all_lotteries(info["access_token"], max_count=max_count)
        result["wxid"] = wxid
        result["nickname"] = info.get("nickname", "")
        all_results.append(result)

        time.sleep(2)

    # 总汇总
    print("\n" + "="*60)
    print("  所有账号参与汇总")
    print("="*60)
    total_joined = sum(r.get("joined", 0) for r in all_results)
    total_failed = sum(r.get("failed", 0) for r in all_results)
    total_already = sum(r.get("already_joined", 0) for r in all_results)

    for r in all_results:
        print(f"\n{r.get('nickname', r.get('wxid'))}:")
        print(f"  已参与: {r.get('already_joined', 0)}")
        print(f"  本次参与: {r.get('joined', 0)}")
        print(f"  失败: {r.get('failed', 0)}")

    print(f"\n总计:")
    print(f"  已参与: {total_already}")
    print(f"  本次参与: {total_joined}")
    print(f"  失败: {total_failed}")

    return all_results


# ============== 中奖记录查询功能 ==============

def get_user_profile(token: str) -> dict:
    """获取用户资料"""
    url = f"{API_HOST}/{API_VERSION}/user/profile"
    headers = build_api_headers(token, url)

    return http_request(url, headers=headers)


def query_winning_records(token: str, max_check: int = 100) -> dict:
    """查询用户的中奖记录

    实现逻辑:
    1. 获取用户参与过的抽奖列表
    2. 对每个已参与的抽奖,查询中奖用户列表
    3. 检查当前用户是否在中奖列表中
    """
    print("\n" + "="*60)
    print("  查询中奖记录")
    print("="*60)

    # 获取用户信息
    print("\n[1/3] 获取用户信息...")
    user_profile = get_user_profile(token)
    user_data = user_profile.get("data", {})

    if isinstance(user_data, dict):
        user_id = user_data.get("id") or user_data.get("user_id")
        nickname = user_data.get("nickname", "未知用户")
    else:
        # 尝试从 token 解析用户 ID
        token_info = get_token_info(token)
        user_id = token_info.get("sub") or token_info.get("user_id")
        nickname = "未知用户"

    if not user_id:
        print("[ERROR] 无法获取用户 ID")
        return {"status": False, "message": "无法获取用户 ID", "records": []}

    print(f"[OK] 用户: {nickname} (ID: {user_id})")

    # 获取参与过的抽奖 - 通过详情 API 确认参与状态
    print("\n[2/3] 获取已参与的抽奖...")
    all_lotteries = []

    # 来源1: 公开抽奖列表（HAR验证有效，与参与循环一致）
    try:
        public = get_public_lottery(token)
        square = public.get("square", [])
        daily_list = public.get("daily_list", [])
        public_lottery = public.get("public_lottery", [])
        if isinstance(square, list):
            all_lotteries.extend(square)
        if isinstance(daily_list, list):
            all_lotteries.extend(daily_list)
        if isinstance(public_lottery, list):
            all_lotteries.extend(public_lottery)
        print(f"  公开抽奖: {len(square)}+{len(daily_list)} 个")
    except Exception as e:
        print(f"  获取公开抽奖失败: {e}")

    # 来源2: 随机抽奖
    try:
        prev_id = None
        for i in range(3):
            random_result = get_lottery_list(token, size=20, from_id=prev_id)
            data = random_result.get("data", [])
            if isinstance(data, list) and data:
                all_lotteries.extend(data)
                prev_id = data[-1].get("id")
            time.sleep(0.3)
    except Exception as e:
        print(f"  获取随机抽奖失败: {e}")

    # 来源3: 每日公开
    try:
        daily_result = get_daily_public_lottery(token)
        data = daily_result.get("data", [])
        if isinstance(data, list):
            all_lotteries.extend(data)
        elif isinstance(data, dict):
            all_lotteries.extend(data.get("data", []))
    except Exception as e:
        print(f"  获取每日公开失败: {e}")

    # 来源4: 推荐抽奖
    try:
        suggest_result = get_suggest_lottery(token)
        data = suggest_result.get("data", [])
        if isinstance(data, list):
            all_lotteries.extend(data)
        elif isinstance(data, dict):
            all_lotteries.extend(data.get("data", []))
    except Exception:
        pass

    # 去重
    seen_ids = set()
    unique_lotteries = []
    for lottery in all_lotteries:
        lottery_id = lottery.get("id") or lottery.get("lottery_id")
        if lottery_id and lottery_id not in seen_ids:
            seen_ids.add(lottery_id)
            unique_lotteries.append(lottery)

    # 通过详情 API 逐个确认参与状态（列表数据不含 is_participator）
    print(f"  去重共 {len(unique_lotteries)} 个，正在确认参与状态...")
    participated_lotteries = []
    for lottery in unique_lotteries:
        lottery_id = lottery.get("id") or lottery.get("lottery_id")
        try:
            detail_result = get_lottery_detail(token, lottery_id)
            detail = detail_result.get("data", detail_result)
            if isinstance(detail, dict):
                if detail.get("is_participator") or detail.get("joined"):
                    # 从详情中提取奖品名
                    prizes = detail.get("prizes", {})
                    if isinstance(prizes, dict):
                        prize_arr = prizes.get("data", [])
                        if prize_arr and isinstance(prize_arr[0], dict):
                            lottery["prize_name"] = prize_arr[0].get("name", "")
                    participated_lotteries.append(lottery)
        except Exception:
            pass
        time.sleep(0.3)

    print(f"[OK] 找到 {len(participated_lotteries)} 个已参与/已结束的抽奖")

    if not participated_lotteries:
        print("[INFO] 没有找到已参与的抽奖")
        return {"status": True, "records": [], "message": "没有已参与的抽奖"}

    # 限制检查数量
    if len(participated_lotteries) > max_check:
        print(f"  限制检查前 {max_check} 个抽奖")
        participated_lotteries = participated_lotteries[:max_check]

    # 查询每个抽奖的中奖情况
    print(f"\n[3/3] 查询中奖情况 (共 {len(participated_lotteries)} 个)...")
    winning_records = []
    checked_count = 0

    for lottery in participated_lotteries:
        lottery_id = lottery.get("id") or lottery.get("lottery_id")
        lottery_name = lottery.get("title") or lottery.get("name") or f"抽奖#{lottery_id}"
        lottery_type = get_lottery_type(lottery)

        checked_count += 1
        if checked_count % 10 == 0:
            print(f"  已检查 {checked_count}/{len(participated_lotteries)} 个...")

        try:
            # 查询中奖用户列表
            lucky_result = get_lottery_lucky_users(token, lottery_id, page=1, size=100)
            lucky_data = lucky_result.get("data", {})

            if isinstance(lucky_data, dict):
                lucky_users = lucky_data.get("data", []) or lucky_data.get("lucky_users", []) or lucky_data.get("users", [])
            elif isinstance(lucky_data, list):
                lucky_users = lucky_data
            else:
                lucky_users = []

            # 检查当前用户是否在中奖列表中
            is_winner = False
            prize_info = None

            for user in lucky_users:
                if not isinstance(user, dict):
                    continue

                lucky_user_id = user.get("user_id") or user.get("id") or user.get("wxid")
                if str(lucky_user_id) == str(user_id):
                    is_winner = True
                    prize_info = {
                        "prize_name": user.get("prize_name", ""),
                        "prize_level": user.get("prize_level", ""),
                        "prize_id": user.get("prize_id", ""),
                        "win_time": user.get("created_at", "") or user.get("win_time", "")
                    }
                    break

            if is_winner:
                print(f"  ✓ [{lottery_name[:30]}] 中奖! 奖品: {prize_info.get('prize_name', '未知奖品')}")
                winning_records.append({
                    "lottery_id": lottery_id,
                    "lottery_name": lottery_name,
                    "lottery_type": lottery_type,
                    "prize_name": prize_info.get("prize_name", ""),
                    "prize_level": prize_info.get("prize_level", ""),
                    "win_time": prize_info.get("win_time", ""),
                    "status": "won"
                })

        except Exception as e:
            # 静默处理错误,继续检查下一个
            pass

        time.sleep(0.5)

    # 显示结果
    print("\n" + "="*60)
    print("  中奖记录查询结果")
    print("="*60)

    if winning_records:
        print(f"\n🎉 恭喜! 共找到 {len(winning_records)} 条中奖记录:\n")
        for i, record in enumerate(winning_records, 1):
            print(f"[{i}] {record['lottery_name'][:40]}")
            print(f"    奖品: {record['prize_name'] or '未知奖品'}")
            if record.get('prize_level'):
                print(f"    奖项: {record['prize_level']}")
            if record.get('win_time'):
                print(f"    时间: {record['win_time']}")
            print()
    else:
        print("\n😔 未找到中奖记录")
        print("   提示: 只检查了已参与或已结束的抽奖")

    print(f"\n检查完成: {checked_count} 个抽奖")
    print(f"中奖记录: {len(winning_records)} 条")

    return {
        "status": True,
        "records": winning_records,
        "checked_count": checked_count,
        "winning_count": len(winning_records)
    }


def query_winning_for_all_accounts(tokens: Dict[str, Dict[str, object]], max_check: int = 100):
    """为所有已登录账号查询中奖记录"""
    print("\n" + "="*60)
    print("  批量查询中奖记录")
    print("="*60)

    if not tokens:
        print("[ERROR] 没有可用 token")
        return

    # 检查 token 有效性
    now = time.time()
    valid_tokens = {}
    for wxid, info in tokens.items():
        expire_time = info.get("expire_time", 0)
        if expire_time == 0 or expire_time > now:
            valid_tokens[wxid] = info
        else:
            print(f"[WARN] Token 已过期,跳过: {wxid}")

    if not valid_tokens:
        print("[ERROR] 没有有效的 tokens,请重新登录")
        return

    print(f"\n共有 {len(valid_tokens)} 个有效账号")

    all_results = []
    for i, (wxid, info) in enumerate(valid_tokens.items(), 1):
        print(f"\n{'='*50}")
        print(f"查询账号 {i}/{len(valid_tokens)}: {info.get('nickname', wxid)}")
        print(f"{'='*50}")

        result = query_winning_records(info["access_token"], max_check=max_check)
        result["wxid"] = wxid
        result["nickname"] = info.get("nickname", "")
        all_results.append(result)

        time.sleep(2)

    # 总汇总
    print("\n" + "="*60)
    print("  所有账号中奖汇总")
    print("="*60)

    total_winning = sum(r.get("winning_count", 0) for r in all_results)
    total_checked = sum(r.get("checked_count", 0) for r in all_results)

    for r in all_results:
        winning_count = r.get("winning_count", 0)
        records = r.get("records", [])
        print(f"\n{r.get('nickname', r.get('wxid'))}:")
        print(f"  检查抽奖: {r.get('checked_count', 0)} 个")
        print(f"  中奖记录: {winning_count} 条")
        if winning_count > 0 and records:
            for record in records[:3]:  # 只显示前3条
                print(f"    - {record['lottery_name'][:30]}: {record['prize_name'] or '未知奖品'}")
            if winning_count > 3:
                print(f"    ... 还有 {winning_count - 3} 条记录")

    print(f"\n总计:")
    print(f"  检查抽奖: {total_checked} 个")
    print(f"  中奖记录: {total_winning} 条")

    return all_results


# ============== 主函数 ==============

def main():
    """青龙面板入口函数"""

    mode = sys.argv[1] if len(sys.argv) > 1 else "login"
    print_banner(build_notify_title())
    log_global("模式", mode)
    log_global("时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log_global("推送", "开启" if PUSH_SWITCH == "1" else "关闭")

    if mode == "login":
        summaries = []
        login_result = run_login()
        tokens = login_result.get("tokens", {})
        summaries.append(summarize_login_result(login_result))
        sign_results = do_daily_sign_all(tokens)
        summaries.append(summarize_sign_results(sign_results))
        join_results = join_lottery_for_all_accounts(tokens)
        summaries.append(summarize_join_results(join_results or []))
        winning_results = query_winning_for_all_accounts(tokens, max_check=50)
        summaries.append(summarize_winning_results(winning_results or []))
        finish_run(summaries)
    elif mode == "join":
        max_count = int(sys.argv[2]) if len(sys.argv) > 2 else 50
        login_result = run_login()
        finish_run([summarize_login_result(login_result), summarize_join_results(join_lottery_for_all_accounts(login_result.get("tokens", {}), max_count=max_count) or [])])
    elif mode == "single":
        result = login_single_account()
        finish_run([summarize_login_result({"success": 1 if result.get("status") else 0, "fail": 0 if result.get("status") else 1, "results": [result]})])
    elif mode == "winnings" or mode == "lucky":
        max_check = int(sys.argv[2]) if len(sys.argv) > 2 else 100
        login_result = run_login()
        finish_run([summarize_login_result(login_result), summarize_winning_results(query_winning_for_all_accounts(login_result.get("tokens", {}), max_check=max_check) or [])])
    elif mode == "sign":
        login_result = run_login()
        finish_run([summarize_login_result(login_result), summarize_sign_results(do_daily_sign_all(login_result.get("tokens", {})))])
    else:
        print("用法:")
        print("  python lottery_login.py                    # 登录当前微信账号并执行全部任务")
        print("  python lottery_login.py login              # 同默认")
        print("  python lottery_login.py join               # 登录当前账号并参与抽奖")
        print("  python lottery_login.py join 30            # 指定参与数量")
        print("  python lottery_login.py single             # 登录当前微信账号")
        print("  python lottery_login.py sign               # 登录当前账号并每日签到")
        print("  python lottery_login.py winnings           # 登录当前账号并查询中奖记录")
        print("  python lottery_login.py winnings 50        # 指定检查抽奖数量")


if __name__ == "__main__":
    if try_acquire_lock():
        try:
            main()
        finally:
            release_lock()
''',
    'tclx': r'''

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
同程旅行自动任务 v1.0.2

功能：自动执行同程旅行签到页相关任务（wxcode 单账号版）
支持签到状态查询、里程瓜分报名、连续打卡报名与进度查询
支持花神祈福、卡牌查询、刮刮乐抽奖与推送汇总
支持本地 wxcode 模块获取 code 登录

更新说明:
### 2026.05.06
v1.0.2:
- 接入本地 wxcode 模块获取 code 登录，移除旧版 CK 登录兼容
- 整合签到、里程瓜分、连续打卡、短剧数据、花神祈福、卡牌查询与刮刮乐任务

### 2026.04.25
v1.0.1:
- 新增连续打卡断签后的续约恢复

### 2026.04.22
v1.0.0:
- 切换到新版接口体系
- 区分里程瓜分、连续打卡两套任务流
- 补上基础签到流程

配置说明:
1. 本地 code 模块:
    - 安装并启用本目录的 wxcode_1.0_8.0.56.apk
    - 保持微信里「同程旅行」小程序为当前登录账号
    - TCLX_CODE_URL 默认 http://127.0.0.1:8088/login?appId={appId}


3. 推送开关:
    TCLX_PUSH = 0 关闭推送，默认开启

4. 短剧基础参数（可选）:
    TCLX_DRAMA_REFID = 123456
    兼容别名: DRAMA_WXREFID

定时规则建议 (Cron):
35 7 * * *          # 仅跑一次，适合只做每日签到和报名
35 7,12,19 * * *    # 每天补跑 3 次，适合补里程瓜分和连续打卡状态刷新

From: YaoHuo8648
Email: zheyizzf@188.com
Update: 2026.05.06
"""

import json
import os
import random
import sys
import time
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import requests

try:
    from notify import send as notify_send
except ImportError:
    notify_send = None

SCRIPT_VERSION = "v1.0.2"
BASE_URL = "https://wx.17u.cn"
REQUEST_TIMEOUT = 20
DEFAULT_TC_REFERER = "page%2Fhome%2Fmall%2Fmall"
DEFAULT_TCXCX_VERSION = "7.9.3"
SIGN_CENTER_TC_REFERER = "page%2FAC%2Fsign%2Fmsindex%2Fmsindex"
SIGN_CENTER_XCX_VERSION = "7.9.7"
DRAMA_TC_REFERER = "page%2Factivetemplate%2Frealshot%2Frealshot"
DRAMA_XCX_VERSION = "7.9.7"
SIGN_PAGE_REFERER = "https://wx.17u.cn/memberft/student/studentcard/signIn?refid=2000845209"
SIGN_CENTER_MINI_PROGRAM_REFERER = "https://servicewechat.com/wx336dcaf6a1ecf632/898/page-frame.html"
MINI_PROGRAM_REFERER = "https://servicewechat.com/wx336dcaf6a1ecf632/894/page-frame.html"
DRAMA_MINI_PROGRAM_REFERER = "https://servicewechat.com/wx336dcaf6a1ecf632/898/page-frame.html"
MONEY_SAVE_REFERER = "https://wx.17u.cn/memberft/student/studentcard/moneySave?refid=2000654094"
SIGN_CENTER_TASK_SCHEME_GUID = "task-2025-nflygijg"
MONEY_SAVE_LOTTERY_GUID = "fission-sch-2025-dxneldyh"
FLOWER_BLESS_WEB_REFERER = "https://wx.17u.cn/wxweb/"

# 花神助力：收集 sponsorEncryptUserKey
_FLOWER_SPONSOR_KEYS: List[str] = []
_FLOWER_PRIORITY_KEY: str = ""  # 优先助力的目标 key
_FLOWER_PRIORITY_MATCH = os.getenv("TCLX_FLOWER_PRIORITY", "").strip()

def getenv_first(names: List[str], default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and str(value).strip() != "":
            return str(value).strip()
    return default


DRAMA_REFID = getenv_first(["TCLX_DRAMA_REFID", "DRAMA_WXREFID"], "123456") or "123456"
MOBILE_USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 11; IN2020 Build/RP1A.201005.001; wv) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 "
    "Mobile Safari/537.36 XWEB/1160117 MMWEBSDK/20241202 MMWEBID/9077 "
    "MicroMessenger/8.0.56.2781(0x28003841) WeChat/arm64 Weixin GPVersion/1 "
    "NetType/4G Language/zh_CN ABI/arm64 MiniProgramEnv/android"
)
PUSH_SWITCH = os.getenv("TCLX_PUSH", "1").strip()
CODE_URL = (os.getenv("TCLX_CODE_URL") or "http://127.0.0.1:8088/login?appId={appId}").strip()
TC_LOGIN_URL = "https://wx.17u.cn/wechatappapi/wxUser/login"
APPID = (os.getenv("TCLX_APPID") or "wx336dcaf6a1ecf632").strip()
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


@dataclass
class AccountConfig:
    cookie: str
    tc_sec_tk: str
    remark: str = ""
    tc_referer: str = DEFAULT_TC_REFERER
    tc_xcx_version: str = DEFAULT_TCXCX_VERSION
    open_id: str = ""
    union_id: str = ""
    sec_token: str = ""

    def __post_init__(self) -> None:
        self.cookie = self.cookie.strip()
        self.tc_sec_tk = self.tc_sec_tk.strip()
        self.remark = self.remark.strip()
        self.tc_referer = (self.tc_referer or DEFAULT_TC_REFERER).strip()
        self.tc_xcx_version = (self.tc_xcx_version or DEFAULT_TCXCX_VERSION).strip()




def now_text() -> str:
    return datetime.now().strftime("%H:%M:%S")


def print_banner(title: str) -> None:
    line = "═" * 68
    print(f"\n{line}", flush=True)
    print(title, flush=True)
    print(line, flush=True)


def log_global(label: str, message: str) -> None:
    print(f"[{now_text()}] {label:<4} | {message}", flush=True)





def mask_text(value: str) -> str:
    text = str(value or "").strip()
    if len(text) <= 8:
        return text or "未知"
    return f"{text[:4]}...{text[-4:]}"


def account_label(account: AccountConfig) -> str:
    return account.remark or mask_text(account.open_id or account.union_id)


def build_account(
    cookie: str,
    tc_sec_tk: str,
    remark: str = "",
    tc_referer: str = DEFAULT_TC_REFERER,
    tc_xcx_version: str = DEFAULT_TCXCX_VERSION,
    open_id: str = "",
    union_id: str = "",
    sec_token: str = "",
) -> Optional[AccountConfig]:
    account = AccountConfig(
        cookie=cookie,
        tc_sec_tk=tc_sec_tk,
        remark=remark,
        tc_referer=tc_referer,
        tc_xcx_version=tc_xcx_version,
        open_id=open_id,
        union_id=union_id,
        sec_token=sec_token,
    )
    if not account.cookie or not account.tc_sec_tk or not account.open_id or not account.sec_token:
        return None
    return account


def prioritize_flower_accounts(accounts: List[AccountConfig]) -> List[AccountConfig]:
    if not accounts or not _FLOWER_PRIORITY_MATCH:
        return accounts

    def is_priority(account: AccountConfig) -> bool:
        target = _FLOWER_PRIORITY_MATCH.lower()
        candidates = [account.remark, account.open_id]
        return any(target == str(item or "").lower() or target in str(item or "").lower() for item in candidates)

    priority_accounts = [account for account in accounts if is_priority(account)]
    if not priority_accounts:
        return accounts

    normal_accounts = [account for account in accounts if account not in priority_accounts]
    log_global("花神", f"优先账号已前置: {account_label(priority_accounts[0])}")
    return priority_accounts + normal_accounts


def extract_code(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    status = payload.get("status")
    err = payload.get("err")
    if status not in (None, "", True, 1, "1", 200, "200", "ok", "OK", "success", "SUCCESS"):
        return ""
    if err not in (None, "", 0, "0"):
        return ""
    items = [payload]
    for key in ("data", "Data", "result"):
        if isinstance(payload.get(key), dict):
            items.append(payload[key])
    for item in items:
        code = str(item.get("code") or item.get("Code") or "").strip()
        if code:
            return code
    return ""


def get_wx_code() -> str:
    url = CODE_URL.format(appId=APPID, appid=APPID)
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        code = extract_code(resp.json())
        if code:
            log_global("登录", f"获取 code 成功: {mask_text(code)}")
        return code
    except Exception as e:
        log_global("登录", f"获取 code 失败: {e}")
        return ""


def tc_login(code: str, scene: str = "1001") -> dict:
    """用 code 换取登录凭证"""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36",
        "Referer": "https://servicewechat.com"
    }
    payload = {"code": code, "scene": scene}
    try:
        resp = requests.post(TC_LOGIN_URL, headers=headers, json=payload, timeout=30)
        if resp.status_code != 200:
            return None
        data = resp.json()
        content = data.get("content", {})
        if content.get("openId") and content.get("sectoken"):
            return {
                "openId": content.get("openId", ""),
                "unionId": content.get("unionId", ""),
                "memberId": content.get("memberId", ""),
                "encryOpenId": content.get("encryOpenId", ""),
                "aesOpenId": content.get("aesOpenId", ""),
                "aesUnionId": content.get("aesUnionId", ""),
                "sectoken": content.get("sectoken", ""),
                "expts": content.get("expts", 0),
            }
        return None
    except Exception as e:
        log_global("登录", f"登录失败: {e}")
        return None


def generate_cookie(login_data: dict) -> str:
    """生成 Cookie"""
    cookie_parts = []
    if login_data.get("openId"):
        cookie_parts.append(f"tcopenid={login_data['openId']}")
    if login_data.get("unionId"):
        cookie_parts.append(f"tcunionid={login_data['unionId']}")
    if login_data.get("sectoken"):
        cookie_parts.append(f"tcsectoken={login_data['sectoken']}")
    if login_data.get("memberId"):
        cookie_parts.append(f"tcuserid={login_data['memberId']}")
    return "; ".join(cookie_parts)


def auto_login_accounts() -> List[AccountConfig]:
    code = get_wx_code()
    if not code:
        return []
    login_data = tc_login(code)
    if not login_data:
        log_global("登录", "code 登录失败")
        return []
    account = build_account(
        cookie=generate_cookie(login_data),
        tc_sec_tk=login_data["sectoken"],
        remark=mask_text(login_data.get("openId", "")),
        open_id=login_data["openId"],
        union_id=login_data["unionId"],
        sec_token=login_data["sectoken"],
    )
    if not account:
        log_global("登录", "构建账号配置失败")
        return []
    log_global("登录", f"登录成功: {account_label(account)}")
    return [account]



def build_push_message(results: List[Dict[str, object]]) -> str:
    lines = ["同程旅行自动任务", "━━━━━━━━━━━━━━━━━━━━"]
    success = sum(1 for item in results if item.get("status") != "失败")
    for item in results:
        lines.append("")
        lines.append(f"{item.get('name', '账号')} | {item.get('status', '未知')}")
        for line in item.get("lines", []):
            lines.append(f"• {line}")
    lines.append("")
    lines.append(f"账号结果: {success}/{len(results)} 正常")
    return "\n".join(lines).strip()


def build_notify_title() -> str:
    return f"同程旅行自动任务 {SCRIPT_VERSION}"


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "User-Agent": MOBILE_USER_AGENT,
        }
    )
    return session




def build_apmat(open_id: str, stamp: Optional[str] = None, nonce: Optional[str] = None) -> str:
    return f"{open_id}|{stamp or datetime.now().strftime('%Y%m%d%H%M')}|{nonce or str(random.randint(100000, 999999))}"


def build_wxmpsign_headers(account: AccountConfig, stamp: Optional[str] = None, nonce: Optional[str] = None) -> Dict[str, str]:
    return {
        "apmat": build_apmat(account.open_id, stamp=stamp, nonce=nonce),
        "TCReferer": account.tc_referer,
        "TCSecTk": account.tc_sec_tk,
        "TCxcxVersion": account.tc_xcx_version,
        "platform": "WX_MP",
        "osType": "0",
        "secToken": account.sec_token,
        "TC-MALL-PLATFORM-CODE": "WX_MP",
        "TC-MALL-USER-TOKEN": account.sec_token,
        "TCPrivacy": "1",
        "charset": "utf-8",
        "Referer": MINI_PROGRAM_REFERER,
        "Accept-Encoding": "gzip, deflate, br",
    }


def build_qiushi_headers(account: AccountConfig, stamp: Optional[str] = None, nonce: Optional[str] = None) -> Dict[str, str]:
    return {
        "xweb_xhr": "1",
        "apmat": build_apmat(account.open_id, stamp=stamp, nonce=nonce),
        "TC-OS-TYPE": "0",
        "TC-USER-TOKEN": account.sec_token,
        "TC-PLATFORM-CODE": "WX_MP",
        "TCSecTk": account.tc_sec_tk,
        "TCReferer": SIGN_CENTER_TC_REFERER,
        "TCxcxVersion": SIGN_CENTER_XCX_VERSION,
        "osType": "0",
        "secToken": account.sec_token,
        "platform": "WX_MP",
        "TCPrivacy": "1",
        "Referer": SIGN_CENTER_MINI_PROGRAM_REFERER,
        "Accept-Encoding": "gzip, deflate, br",
    }


def build_drama_headers(account: AccountConfig, stamp: Optional[str] = None, nonce: Optional[str] = None) -> Dict[str, str]:
    return {
        "xweb_xhr": "1",
        "apmat": build_apmat(account.open_id, stamp=stamp, nonce=nonce),
        "TC-OS-TYPE": "0",
        "TC-USER-TOKEN": account.sec_token,
        "TC-PLATFORM-CODE": "WX_MP",
        "TCSecTk": account.tc_sec_tk,
        "TCReferer": DRAMA_TC_REFERER,
        "TCxcxVersion": DRAMA_XCX_VERSION,
        "osType": "0",
        "secToken": account.sec_token,
        "platform": "WX_MP",
        "TCPrivacy": "1",
        "Referer": DRAMA_MINI_PROGRAM_REFERER,
        "Accept-Encoding": "gzip, deflate, br",
    }


def build_activity_task_headers(account: AccountConfig) -> Dict[str, str]:
    return {
        "TC-OS-TYPE": "1",
        "TC-PLATFORM-CODE": "WX_MP",
        "TC-USER-TOKEN": account.sec_token,
        "platform": "WX_MP",
        "accountSystem": "1",
        "osType": "1",
        "secToken": account.sec_token,
        "Origin": BASE_URL,
        "Referer": FLOWER_BLESS_WEB_REFERER,
        "Cookie": account.cookie,
        "Accept-Encoding": "gzip, deflate, br",
    }


def build_sign_task_headers(account: AccountConfig) -> Dict[str, str]:
    return {
        "TC-OS-TYPE": "0",
        "TC-PLATFORM-CODE": "WX_MP",
        "TC-USER-TOKEN": account.sec_token,
        "platform": "WX_MP",
        "accountSystem": "1",
        "openId": account.open_id,
        "userKey": account.union_id,
        "userToken": account.sec_token,
        "userTokenMode": "1",
        "Origin": BASE_URL,
        "Referer": SIGN_PAGE_REFERER,
        "Cookie": account.cookie,
    }


def build_lottery_headers(account: AccountConfig) -> Dict[str, str]:
    return {
        "accountSystem": "1",
        "anonymity": "0",
        "secToken": account.sec_token,
        "versionType": "0",
        "userToken": account.sec_token,
        "openId": account.open_id,
        "userTokenMode": "1",
        "osType": "0",
        "userKey": account.union_id,
        "platform": "WX_H5",
        "Origin": BASE_URL,
        "Referer": MONEY_SAVE_REFERER,
        "Cookie": account.cookie,
    }


def unwrap_response(payload: Optional[Dict[str, object]], ok_codes: Tuple[int, ...]) -> Tuple[Optional[Dict[str, object]], str]:
    if not isinstance(payload, dict):
        return None, "响应为空"
    code = payload.get("code", payload.get("rspCode", payload.get("RspCode")))
    if code not in ok_codes:
        return None, str(
            payload.get("msg")
            or payload.get("message")
            or payload.get("Message")
            or f"code={code}"
        )
    data = payload.get("data", payload.get("Data"))
    if data is None:
        return {}, ""
    if isinstance(data, dict):
        return data, ""
    return {"items": data}, ""


def extract_cash_task_state(task_info: Dict[str, object]) -> Dict[str, object]:
    act_detail = task_info.get("actDetail") or {}
    calendar_info = task_info.get("calendarInfo") or {}
    help_detail = task_info.get("helpDetail") or {}
    prize_list = task_info.get("prizeList") or []
    visit_state = calendar_info.get("isTodayVisit")
    share_state = calendar_info.get("todayShareState")
    continue_days = int(calendar_info.get("continueSignCount") or 0)
    stages = []
    for item in prize_list:
        if not isinstance(item, dict):
            continue
        min_day = int(item.get("minDay") or 0)
        min_amount = item.get("minAmount")
        prize_name = str(item.get("prizeName") or "")
        if min_day > 0:
            stages.append((min_day, format_cash_prize_text(min_day, min_amount, prize_name)))
    stages.sort(key=lambda item: item[0])
    stage_done = sum(1 for min_day, _ in stages if continue_days >= min_day)
    current_stage = 0
    current_stage_day = 0
    current_stage_text = ""
    next_stage_day = 0
    next_stage_prize = ""
    for index, (min_day, prize_text) in enumerate(stages, start=1):
        if continue_days < min_day:
            current_stage = index
            current_stage_day = min_day
            current_stage_text = prize_text
            next_stage_day = min_day
            next_stage_prize = prize_text
            break
    if stages and current_stage == 0:
        current_stage = len(stages)
        current_stage_day = stages[-1][0]
        current_stage_text = stages[-1][1]
    return {
        "join_state": int(task_info.get("userJoinState") or 0),
        "continue_days": continue_days,
        "need_visit": int(visit_state if visit_state is not None else 0) == 0,
        "need_share": int(share_state if share_state is not None else -1) == 0,
        "calendar": str(help_detail.get("todayCalendar") or ""),
        "user_id": str(task_info.get("userId") or ""),
        "help_count": int(help_detail.get("totalHelpCount") or 0),
        "help_limit": int(act_detail.get("swellMaxHelp") or 0),
        "stage_done": stage_done,
        "stage_total": len(stages),
        "next_stage_day": next_stage_day,
        "next_stage_prize": next_stage_prize,
        "current_stage": current_stage,
        "current_stage_day": current_stage_day,
        "current_stage_text": current_stage_text,
    }


def cash_task_needs_restart(task_info: Dict[str, object]) -> bool:
    if int(task_info.get("userJoinState") or 0) != 1:
        return False
    calendar_info = task_info.get("calendarInfo") or {}
    if not isinstance(calendar_info, dict):
        return False
    is_today_visit = int(calendar_info.get("isTodayVisit") or 0)
    unsign_count = int(calendar_info.get("unsignCount") or 0)
    user_state = int(calendar_info.get("userState") or 0)
    return is_today_visit == 0 and (unsign_count > 0 or user_state == 2)


def format_cash_prize_text(min_day: int, min_amount: object, prize_name: str) -> str:
    min_text = format_cash_amount(min_amount or prize_name)
    max_map = {7: "17.88", 15: "38.88", 20: "58.88", 35: "88.88"}
    max_text = max_map.get(min_day, min_text)
    return f"{min_text}-{max_text}（保底{min_text}）"


def format_cash_amount(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return "0"
    try:
        number = float(text)
    except (TypeError, ValueError):
        return text
    return f"{number:.2f}".rstrip("0").rstrip(".")


def extract_calendar_day_info(calendar_data: Dict[str, object], today_text: str) -> Dict[str, object]:
    date_info = calendar_data.get("dateInfo") or {}
    if isinstance(date_info, dict):
        return date_info.get(today_text) or {}
    if isinstance(date_info, list):
        for item in date_info:
            if isinstance(item, dict) and str(item.get("date") or "") == today_text:
                return item
    return {}


def extract_sign_state(
    sign_data: Dict[str, object],
    top_data: Dict[str, object],
    calendar_data: Optional[Dict[str, object]] = None,
) -> Dict[str, int]:
    calendar_data = calendar_data or {}
    today_text = str(calendar_data.get("today") or datetime.now().strftime("%Y-%m-%d"))
    today_info = extract_calendar_day_info(calendar_data, today_text)
    today_signed = sign_data.get("todaySigned")
    if today_signed is None:
        today_signed = calendar_data.get("todaySigned")
    if today_signed is None:
        today_signed = today_info.get("isSigned")
    sign_days = int(sign_data.get("signDays") or 0)
    continued_days = int(sign_data.get("periodContinuedSignDays") or sign_days)
    return {
        "today_signed": int(today_signed or 0),
        "today_mileage": int(sign_data.get("signMileage") or today_info.get("mileage") or 0),
        "sign_days": sign_days,
        "continued_days": continued_days,
        "tomorrow_mileage": int(sign_data.get("tomorrowMileage") or 0),
        "remain_coin": int(top_data.get("remainCoin") or 0),
    }


def extract_drama_base_state(base_data: Dict[str, object]) -> Dict[str, object]:
    return {
        "ext_info": str(base_data.get("extInfo") or ""),
        "is_risk": int(base_data.get("isRisk") or 0),
        "rule_img_url": str(base_data.get("ruleImgUrl") or ""),
        "user_rule_id": str(base_data.get("userRuleId") or ""),
        "user_day_limit": int(base_data.get("userDayLimit") or 0),
    }


def extract_drama_income_state(income_data: Dict[str, object]) -> Dict[str, object]:
    return {
        "mileage_balance": int(income_data.get("mileageBalance") or 0),
        "mileage_balance_amount": str(income_data.get("mileageBalanceAmount") or ""),
        "today_mileage_income": int(income_data.get("todayMileageIncome") or 0),
        "user_day_limit": int(income_data.get("userDayLimit") or 0),
        "today_watch_count": int(income_data.get("todayWatchCount") or 0),
    }


def extract_drama_visit_notice(notice_data: Dict[str, object]) -> Dict[str, object]:
    reward = notice_data.get("visitMileageReward")
    if reward is None:
        reward = notice_data.get("rewardMileage")
    return {
        "visit_mileage_reward": int(reward or 0),
        "notice_title": str(notice_data.get("title") or notice_data.get("noticeTitle") or ""),
        "notice_content": str(notice_data.get("content") or notice_data.get("noticeContent") or ""),
    }



class TongCheng:
    def __init__(self, account: AccountConfig, account_index: int = 0, silent: bool = False):
        self.account = account
        self.account_index = account_index
        self.silent = silent
        self.session = build_session()
        self.status = "成功"
        self.error_count = 0
        self.summary_lines: List[str] = []
        self.display_name = f"账号{account_index or 1} [{account_label(account)}]"

    def log(self, label: str, message: str) -> None:
        if self.silent:
            return
        print(f"[{now_text()}] {self.display_name} | {label:<4} | {message}", flush=True)

    def add_line(self, line: str, error: bool = False) -> None:
        self.summary_lines.append(line)
        if error:
            self.error_count += 1


    def request_json(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, object]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Optional[Dict[str, object]]:
        url = path if path.startswith("http") else f"{BASE_URL}{path}"
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=payload if method.upper() != "GET" else None,
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            self.log("请求", f"{path} 失败 | {exc}")
            return None

    def post_wxmpsign(self, path: str, payload: Dict[str, object]) -> Tuple[Optional[Dict[str, object]], str]:
        return unwrap_response(self.request_json("POST", path, payload, build_wxmpsign_headers(self.account)), (200,))

    def get_wxmpsign(self, path: str) -> Tuple[Optional[Dict[str, object]], str]:
        return unwrap_response(self.request_json("GET", path, headers=build_wxmpsign_headers(self.account)), (200,))

    def post_qiushi(self, path: str, payload: Dict[str, object]) -> Tuple[Optional[Dict[str, object]], str]:
        return unwrap_response(self.request_json("POST", path, payload, build_qiushi_headers(self.account)), (0,))

    def post_drama(self, path: str, payload: Dict[str, object]) -> Tuple[Optional[Dict[str, object]], str]:
        return unwrap_response(self.request_json("POST", path, payload, build_drama_headers(self.account)), (0,))

    def get_drama(self, path: str) -> Tuple[Optional[Dict[str, object]], str]:
        return unwrap_response(self.request_json("GET", path, headers=build_drama_headers(self.account)), (0,))

    def post_sign_task(self, path: str, payload: Dict[str, object]) -> Tuple[Optional[Dict[str, object]], str]:
        return unwrap_response(self.request_json("POST", path, payload, build_sign_task_headers(self.account)), (0,))

    def post_lottery(self, path: str, payload: Dict[str, object]) -> Tuple[Optional[Dict[str, object]], str]:
        return unwrap_response(self.request_json("POST", path, payload, build_lottery_headers(self.account)), (0,))

    def post_activity_task(self, path: str, payload: Dict[str, object]) -> Tuple[Optional[Dict[str, object]], str]:
        return unwrap_response(self.request_json("POST", path, payload, build_activity_task_headers(self.account)), (0,))

    def query_sign_state(self) -> Tuple[Optional[Dict[str, int]], str]:
        today = datetime.now().date()
        calendar_payload = {
            "beginDate": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "endDate": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
        }
        top_data, top_msg = self.post_wxmpsign("/wxmpsign/home/top", {})
        sign_data, sign_msg = self.post_wxmpsign("/wxmpsign/sign/getSignInfo", {})
        calendar_data, calendar_msg = self.post_wxmpsign("/wxmpsign/sign/signCalendar", calendar_payload)
        if top_data is None or sign_data is None or calendar_data is None:
            return None, top_msg or sign_msg or calendar_msg or "查询失败"
        return extract_sign_state(sign_data, top_data, calendar_data), ""

    def load_sign_state(self) -> None:
        state, message = self.query_sign_state()
        if state is None:
            self.add_line(f"基础签到: 查询失败 | {message}", error=True)
            return
        status_text = "已签"
        if not int(state["today_signed"]):
            response = self.request_json(
                "POST",
                "/wxmpsign/sign/saveSignInfo",
                {},
                build_wxmpsign_headers(self.account),
            )
            if not isinstance(response, dict):
                self.add_line(
                    f"基础签到: 未签 | 今日里程 {state['today_mileage']} | 连签 {state['continued_days']} 天 | 签到失败: 请求失败",
                    error=True,
                )
                return
            code = int(response.get("code", -1))
            submit_message = str(response.get("msg") or response.get("message") or "")
            refreshed_state, refresh_msg = self.query_sign_state()
            if refreshed_state is not None:
                state = refreshed_state
            elif refresh_msg:
                self.log("签到", f"刷新状态失败 | {refresh_msg}")
            if int(state["today_signed"]):
                status_text = "签到成功" if code == 200 else "已签"
            else:
                error_text = submit_message or f"code={code}"
                self.add_line(
                    f"基础签到: 未签 | 今日里程 {state['today_mileage']} | 连签 {state['continued_days']} 天 | 签到失败: {error_text}",
                    error=True,
                )
                return
        self.add_line(
            f"基础签到: {status_text} | 今日里程 {state['today_mileage']} | 连签 {state['continued_days']} 天 | 当前里程 {state['remain_coin']}"
        )

    def run_share_mileage(self) -> None:
        config_data, config_msg = self.get_wxmpsign("/wxmpsign/share/mileage/getShareMileageConfig")
        if config_data is None:
            self.add_line(f"里程瓜分: 查询失败 | {config_msg or '请求失败'}", error=True)
            return
        now = datetime.now()
        info_payload = {
            "startDate": now.strftime("%Y-%m-%d 00:00:00"),
            "limitAmount": 1,
            "endDate": now.strftime("%Y-%m-%d 23:59:59"),
        }
        info_data, info_msg = self.post_wxmpsign("/wxmpsign/share/mileage/getUserParticipationInfo", info_payload)
        if info_data is None:
            self.add_line(f"里程瓜分: 查询失败 | {info_msg or '请求失败'}", error=True)
            return
        items = info_data.get("items", [])
        pay_amount = int(config_data.get("payMileageAmount") or 0)
        if items:
            self.add_line(f"里程瓜分: 已报名 | 参与门槛 {pay_amount} 里程")
            return
        response = self.request_json(
            "POST",
            "/wxmpsign/share/mileage/participateInShareMileage",
            {},
            build_wxmpsign_headers(self.account),
        )
        if not isinstance(response, dict):
            self.add_line("里程瓜分: 报名失败 | 请求失败", error=True)
            return
        code = int(response.get("code", -1))
        message = str(response.get("msg") or response.get("message") or "")
        if code == 200:
            self.add_line(f"里程瓜分: 报名成功 | 扣除 {pay_amount} 里程")
        elif code == 2003:
            self.add_line(f"里程瓜分: 报名失败 | {message}")
        else:
            self.add_line(f"里程瓜分: 报名失败 | {message or f'code={code}'}", error=True)

    def get_act_info(self) -> Optional[Dict[str, object]]:
        act_data, act_msg = self.post_sign_task("/platformflowpool/signTask/getActInfo", {})
        if act_data is None:
            self.add_line(f"连续打卡: 查询失败 | {act_msg or '请求失败'}", error=True)
            return None
        return act_data.get("cashAwardAct") or {}

    def get_task_info(self, act_id: str) -> Tuple[Optional[Dict[str, object]], str]:
        return self.post_sign_task("/platformflowpool/signTask/getTaskInfo", {"actId": act_id})

    def ensure_cash_started(self, cash_act: Dict[str, object]) -> Optional[Dict[str, object]]:
        act_id = str(cash_act.get("actId") or "")
        if not act_id:
            self.add_line("现金打卡: 未找到活动ID", error=True)
            return None
        task_data, task_msg = self.get_task_info(act_id)
        if task_data is None:
            self.add_line(f"现金打卡: 查询失败 | {task_msg or '请求失败'}", error=True)
            return None
        needs_restart = cash_task_needs_restart(task_data)
        if int(task_data.get("userJoinState") or 0) == 0 or needs_restart:
            start_data, start_msg = self.post_sign_task("/platformflowpool/signTask/startTask", {"actId": act_id})
            if start_data is None:
                action = "续打" if needs_restart else "报名"
                self.add_line(f"现金打卡: {action}失败 | {start_msg or '请求失败'}", error=True)
                return task_data
            action = "断档续打" if needs_restart else "现金活动报名"
            self.log("打卡", f"{action}成功 | {start_data.get('userId', '')}")
            task_data, task_msg = self.get_task_info(act_id)
            if task_data is None:
                action = "续打" if needs_restart else "报名"
                self.add_line(f"现金打卡: {action}后查询失败 | {task_msg or '请求失败'}", error=True)
                return None
        return task_data

    def advance_cash_task(self, task_data: Dict[str, object]) -> Dict[str, object]:
        act_id = str((task_data.get("actDetail") or {}).get("actId") or "")
        if not act_id:
            return task_data
        state = extract_cash_task_state(task_data)
        user_id = state["user_id"]
        updated = False
        if state["need_visit"] and user_id:
            visit_data, visit_msg = self.post_sign_task("/platformflowpool/signTask/actionVisit", {"userId": user_id})
            if visit_data is not None:
                updated = True
                self.log("打卡", "已补今日打卡状态")
            elif visit_msg:
                self.log("打卡", f"今日打卡补录失败 | {visit_msg}")
        if state["need_share"] and user_id:
            share_data, share_msg = self.post_sign_task("/platformflowpool/signTask/actionShare", {"userId": user_id})
            if share_data is not None:
                updated = True
                self.log("打卡", "已回写连续打卡分享状态")
            elif share_msg:
                self.log("打卡", f"连续打卡分享回写失败 | {share_msg}")
        if not updated:
            return task_data
        refreshed, refresh_msg = self.get_task_info(act_id)
        if refreshed is not None:
            return refreshed
        if refresh_msg:
            self.log("打卡", f"刷新现金打卡状态失败 | {refresh_msg}")
        return task_data

    def summarize_cash_task(self, task_data: Optional[Dict[str, object]]) -> None:
        if task_data is None:
            return
        task_data = self.advance_cash_task(task_data)
        state = extract_cash_task_state(task_data)
        join_state = int(state["join_state"])
        join_text = {0: "未报名", 1: "已报名", 2: "已结束"}.get(join_state, "未知")
        continue_days = int(state["continue_days"])
        current_stage = int(state["current_stage"])
        current_stage_day = int(state["current_stage_day"])
        current_stage_text = str(state["current_stage_text"])
        stage_total = int(state["stage_total"])
        parts = [f"现金打卡: {join_text}"]
        if stage_total > 0 and current_stage > 0 and current_stage_day > 0:
            parts.append(f"阶段 {current_stage}/{stage_total}")
            parts.append(f"进度 {min(continue_days, current_stage_day)}/{current_stage_day}")
            if current_stage_text:
                parts.append(f"{current_stage_day}天后领{current_stage_text}")
        else:
            parts.append(f"连签 {continue_days} 天")
        self.add_line(" | ".join(parts))

    def load_sign_center_tasks(self) -> Tuple[List[Dict[str, object]], str]:
        payload = {
            "detailGuid": "",
            "pageNum": 1,
            "pageSize": 999,
            "schemeGuid": SIGN_CENTER_TASK_SCHEME_GUID,
        }
        data, message = self.post_qiushi("/qiushiinnerapi/task/detailList", payload)
        if data is None:
            return [], message or "查询失败"
        tasks = data.get("taskDetails") or []
        scheme_guid = str((data.get("taskScheme") or {}).get("schemeGuid") or SIGN_CENTER_TASK_SCHEME_GUID)
        if not isinstance(tasks, list):
            return [], "任务数据格式异常"
        return [item for item in tasks if isinstance(item, dict)], scheme_guid

    def get_sign_share_detail(self) -> Tuple[Optional[Dict[str, object]], str]:
        return self.post_qiushi("/qiushiinnerapi/fission/sign/detail", {"shareGuid": ""})

    def summarize_sign_share_detail(self) -> None:
        data, message = self.get_sign_share_detail()
        if data is None:
            self.add_line(f"签到分享: 查询失败 | {message or '请求失败'}", error=True)
            return

        today_mileage = int(data.get("todaySignMileageCount") or 0)
        is_display = int(data.get("isDisplay") or 0)
        is_share_self = int(data.get("isShareSelf") or 0)
        self.add_line(
            f"签到分享: 今日里程 {today_mileage} | 展示 {is_display} | 自助分享 {is_share_self}"
        )

    def get_drama_base_data(self) -> Tuple[Optional[Dict[str, object]], str]:
        return self.post_drama("/platformflowpool/drama/getBaseData", {"refid": DRAMA_REFID})

    def get_drama_mileage_income(self) -> Tuple[Optional[Dict[str, object]], str]:
        return self.post_drama("/platformflowpool/drama/getMileageIncome", {})

    def get_drama_visit_notice(self) -> Tuple[Optional[Dict[str, object]], str]:
        return self.post_drama("/platformflowpool/drama/getVisitNotice", {})

    def receive_drama_visit_reward(self) -> Tuple[Optional[Dict[str, object]], str]:
        return self.post_drama("/platformflowpool/drama/recVisitReward", {})

    def clear_drama_visit_notice(self) -> Tuple[Optional[Dict[str, object]], str]:
        return self.post_drama("/platformflowpool/drama/clearVisitNotice", {})

    def get_drama_history_watch(self) -> Tuple[List[Dict[str, object]], str]:
        data, message = self.post_drama(
            "/platformflowpool/drama/getHistoryWatch",
            {"pageIndex": 1, "pageSize": 10},
        )
        if data is None:
            return [], message or "查询失败"
        items = data.get("list") or []
        if not isinstance(items, list):
            return [], "历史记录数据格式异常"
        return [item for item in items if isinstance(item, dict)], ""

    def get_drama_user_rule(self, user_rule_id: str) -> Tuple[Optional[Dict[str, object]], str]:
        if not user_rule_id:
            return None, "规则ID为空"
        return self.get_drama(f"/qiushiinnerapi/userRule/getById/{user_rule_id}")

    def load_drama_recommend_top(self) -> Tuple[List[Dict[str, object]], str]:
        data, message = self.post_drama(
            "/platformflowpool/drama/getRecommendTop",
            {"pageSize": 3, "pageIndex": 1},
        )
        if data is None:
            return [], message or "查询失败"
        items = data.get("list") or []
        if not isinstance(items, list):
            return [], "短剧数据格式异常"
        return [item for item in items if isinstance(item, dict)], ""

    def summarize_drama_business(self) -> None:
        base_data, base_msg = self.get_drama_base_data()
        if base_data is None:
            self.add_line(f"短剧赚里程: 基础数据失败 | {base_msg or '请求失败'}", error=True)
            return

        base_state = extract_drama_base_state(base_data)
        if int(base_state["is_risk"]):
            self.add_line("短剧赚里程: 当前账号命中风控，页面未放行")
            return

        income_data, income_msg = self.get_drama_mileage_income()
        if income_data is None:
            self.add_line(f"短剧收益: 查询失败 | {income_msg or '请求失败'}", error=True)
        else:
            income_state = extract_drama_income_state(income_data)
            income_parts = [
                f"短剧收益: 今日已赚 {income_state['today_mileage_income']} 里程",
                f"余额 {income_state['mileage_balance']}",
            ]
            if income_state["user_day_limit"] > 0:
                income_parts.append(f"日上限 {income_state['user_day_limit']}")
            if income_state["today_watch_count"] > 0:
                income_parts.append(f"已看 {income_state['today_watch_count']} 集")
            self.add_line(" | ".join(income_parts))

        notice_data, notice_msg = self.get_drama_visit_notice()
        if notice_data is None:
            self.add_line(f"短剧访问奖励: 通知查询失败 | {notice_msg or '请求失败'}", error=True)
        else:
            notice_state = extract_drama_visit_notice(notice_data)
            reward_data, reward_msg = self.receive_drama_visit_reward()
            reward_text = "未领取"
            if reward_data is not None:
                reward_amount = int(
                    reward_data.get("visitMileageReward")
                    or reward_data.get("rewardMileage")
                    or 0
                )
                reward_text = f"领取 {reward_amount} 里程" if reward_amount > 0 else "无可领奖励"
                refresh_income, _ = self.get_drama_mileage_income()
                if refresh_income is not None:
                    income_state = extract_drama_income_state(refresh_income)
                    reward_text += f" | 最新今日收益 {income_state['today_mileage_income']}"
            elif reward_msg:
                reward_text = f"领取失败: {reward_msg}"
                self.error_count += 1

            title = notice_state["notice_title"] or "无标题通知"
            self.add_line(f"短剧访问奖励: {reward_text} | 通知 {title}")

            if notice_state["notice_title"] or notice_state["notice_content"]:
                clear_data, clear_msg = self.clear_drama_visit_notice()
                if clear_data is None and clear_msg:
                    self.log("短剧", f"通知清理失败 | {clear_msg}")

        if base_state["user_rule_id"]:
            rule_data, rule_msg = self.get_drama_user_rule(base_state["user_rule_id"])
            if rule_data is not None:
                rule_title = str(rule_data.get("title") or rule_data.get("name") or "短剧规则")
                self.add_line(f"短剧规则: {rule_title} | 规则ID {base_state['user_rule_id']}")
            elif rule_msg:
                self.log("短剧", f"规则读取失败 | {rule_msg}")

    def _build_flower_headers(self) -> Dict[str, str]:
        return {
            "TC-OS-TYPE": "1",
            "TC-PLATFORM-CODE": "WX_MP",
            "TC-USER-TOKEN": self.account.sec_token,
            "platform": "WX_MP",
            "accountSystem": "1",
            "osType": "1",
            "secToken": self.account.sec_token,
            "Referer": "https://wx.17u.cn/wxweb/",
            "Cookie": self.account.cookie,
            "Accept-Encoding": "gzip, deflate, br",
        }

    def get_flower_home(self) -> Tuple[Optional[Dict[str, object]], str]:
        result, err = unwrap_response(
            self.request_json("GET", "/platformflowpool/flowerGod/home", None, self._build_flower_headers()),
            (0,),
        )
        if result is None or not isinstance(result, dict):
            return None, err or "查询花神祈福主页失败"
        # debug: 检查 sponsorEncryptUserKey 是否存在
        raw_vals = {
            k: result.get(k)
            for k in result
            if "sponsor" in str(k).lower() or "encrypt" in str(k).lower() or "key" in str(k).lower()
        }
        return result, ""

    def get_flower_card_list(self) -> Tuple[Optional[List[Dict[str, object]]], str]:
        result, err = unwrap_response(
            self.request_json("GET", "/platformflowpool/flowerGod/cardList", None, self._build_flower_headers()),
            (0,),
        )
        if result is None:
            return None, err or "查询卡牌列表失败"
        if isinstance(result, list):
            return result, ""
        if isinstance(result, dict):
            for key in ("data", "items", "values", "cardList", "list"):
                candidate = result.get(key)
                if isinstance(candidate, list) and candidate:
                    return candidate, ""
        return None, f"卡牌列表格式异常 raw_keys={list(result.keys()) if isinstance(result, dict) else type(result).__name__}"

    def post_flower_draw(self) -> Tuple[Optional[Dict[str, object]], str]:
        result, err = unwrap_response(
            self.request_json("POST", "/platformflowpool/flowerGod/drawCard", {"usage": "common"}, self._build_flower_headers()),
            (0,),
        )
        if result is None or not isinstance(result, dict):
            return None, err or "抽签失败"
        return result, ""

    def post_flower_helper_assist(self, sponsor_key: str) -> Tuple[bool, str]:
        payload = {"sponsorEncryptUserKey": sponsor_key}
        resp = self.request_json("POST", "/platformflowpool/flowerGod/helperAssist", payload, self._build_flower_headers())
        if not isinstance(resp, dict):
            return False, "响应为空"
        code = resp.get("code")
        if code != 0:
            return False, str(resp.get("msg") or f"code={code}")
        return True, ""

    def run_flower_draw(self, draw_count: int) -> Tuple[int, int, List[str]]:
        success = 0
        failed = 0
        cards: List[str] = []

        for _ in range(draw_count):
            result, err = self.post_flower_draw()
            if result is None:
                failed += 1
                self.log("花神抽签", f"失败 | {err}")
                continue

            card_name = str(result.get("cardName") or result.get("name") or "未知卡牌")
            reward_name = str(result.get("rewardName") or result.get("prizeName") or "")
            if reward_name:
                reward_amt = result.get("rewardAmt") or result.get("prizeAmt") or ""
                card_label = f"{card_name}({reward_name}{reward_amt})"
            else:
                card_label = card_name
            cards.append(card_label)
            self.log("花神抽签", f"获得: {card_label}")
            success += 1
            time.sleep(random.uniform(0.8, 1.5))

        return success, failed, cards

    def run_flower_bless(self) -> None:
        home, err = self.get_flower_home()
        if home is None:
            self.add_line(f"花神祈福: 查询失败 | {err or '未获取到数据'}", error=True)
            return

        remain_draw = int(home.get("remainDrawCount") or 0)
        activity_status = home.get("activityStatus")

        card_list = home.get("cardList") or []
        owned_count = 0
        total_cards = 0
        if isinstance(card_list, list):
            total_cards = len(card_list)
            for c in card_list:
                if isinstance(c, dict) and int(c.get("cardCount") or 0) > 0:
                    owned_count += 1

        task_list = home.get("taskList") or []
        task_lines: List[str] = []
        finished_tasks = 0
        if isinstance(task_list, list):
            for t in task_list:
                if not isinstance(t, dict):
                    continue
                title = str(t.get("taskTitle") or "未命名").strip()
                tt = t.get("taskType")
                detail = ""
                if tt == 2:
                    detail = "赠花签(社交)"
                elif tt == 3:
                    done = int(t.get("helpTaskCompletedCount") or 0)
                    need = int(t.get("targetHelpCount") or 4)
                    detail = f"助力{done}/{need}人(社交)" if done < need else "助力已完成"
                    if done >= need:
                        finished_tasks += 1
                else:
                    detail = f"类型={tt}"
                bt = bool(t.get("buttonState"))
                state = "✅" if bt else "⏳"
                task_lines.append(f"  {state} {title} [{detail}]")
                if bt:
                    finished_tasks += 1

        self.add_line(f"花神祈福: 状态={activity_status} | 集齐{owned_count}/{total_cards} | 可抽{remain_draw}签 | 任务{finished_tasks}/{len(task_list)}")
        for tl in task_lines:
            self.add_line(tl)

        # 花神助力：优先处理 TCLX_FLOWER_PRIORITY 指定账号
        sponsor_key = str(home.get("sponsorEncryptUserKey") or "")
        if not sponsor_key:
            # 兜底搜所有可能的 key 字段
            for k in home:
                if "sponsor" in str(k).lower() or "encrypt" in str(k).lower():
                    v = home.get(k)
                    if v and str(v).strip():
                        sponsor_key = str(v)
                        break
        if sponsor_key:
            global _FLOWER_PRIORITY_KEY
            self.log("花神Key", f"当前账号sponsorKey={mask_text(sponsor_key)}")

            # 判断当前账号是否为优先目标
            is_priority = False
            if _FLOWER_PRIORITY_MATCH:
                acc_id = _FLOWER_PRIORITY_MATCH.lower()
                if (acc_id in (self.account.remark or "").lower()
                        or acc_id in (self.account.open_id or "").lower()):
                    is_priority = True
                    _FLOWER_PRIORITY_KEY = sponsor_key
                    self.log("花神Key", f"✅ 当前账号为优先目标! priorityKey={mask_text(sponsor_key)}")

            helped = False
            # 1️⃣ 如果存在优先目标 key 且当前不是优先账号，先去助力它
            if _FLOWER_PRIORITY_KEY and _FLOWER_PRIORITY_KEY != sponsor_key:
                ok, msg = self.post_flower_helper_assist(_FLOWER_PRIORITY_KEY)
                if ok:
                    self.log("花神助力", f"🎯 已助力优先目标 {mask_text(_FLOWER_PRIORITY_KEY)}")
                    helped = True
                    time.sleep(random.uniform(0.5, 1.0))
                else:
                    self.log("花神助力", f"优先助力失败 | {msg}")

            # 2️⃣ 帮完优先目标后，再找一个普通账号助力
            if not helped:
                for other_key in _FLOWER_SPONSOR_KEYS:
                    if other_key == sponsor_key or other_key == _FLOWER_PRIORITY_KEY:
                        continue
                    ok, msg = self.post_flower_helper_assist(other_key)
                    if ok:
                        self.log("花神助力", f"已助力好友 {mask_text(other_key)}")
                        helped = True
                        break
                    else:
                        self.log("花神助力", f"助力失败 | {msg}")
            if not helped and (_FLOWER_PRIORITY_KEY or _FLOWER_SPONSOR_KEYS):
                self.log("花神助力", "无可助力对象或全部失败")

            if sponsor_key not in _FLOWER_SPONSOR_KEYS:
                _FLOWER_SPONSOR_KEYS.append(sponsor_key)
        else:
            self.log("花神Key", f"‼️ 未获取到sponsorEncryptUserKey | home keys={[k for k in home][:10]}")

        if remain_draw > 0:
            self.log("花神抽卡", f"准备抽 {remain_draw} 签")
            ok, fail, cards = self.run_flower_draw(remain_draw)
            self.add_line(f"花神抽签: 成功 {ok} 次 | 失败 {fail} 次")
            if cards:
                preview = "、".join(cards[:4])
                if len(cards) > 4:
                    preview += f" 等共{len(cards)}张"
                self.add_line(f"花神新卡: {preview}")

        cards_detail, cd_err = self.get_flower_card_list()
        if cards_detail and not cd_err:
            rewards: List[str] = []
            for c in cards_detail:
                if not isinstance(c, dict):
                    continue
                rname = str(c.get("rewardName") or "")
                rtype_val = c.get("rewardAmt") or c.get("rewardSubTitle") or ""
                if rname:
                    rewards.append(f"{rname} {rtype_val}".strip())
            if rewards:
                preview_r = "、".join(rewards[:4])
                self.add_line(f"花神可兑奖励: {preview_r}")
        elif cd_err:
            self.log("花神卡", f"卡牌列表 | {cd_err}")

    def run_sign_center_tasks(self) -> None:
        tasks, scheme_guid = self.load_sign_center_tasks()
        if not tasks:
            self.add_line("签到页任务: 未获取到任务或全部为空")
            return

        success = 0
        skipped = 0
        failed = 0
        success_titles: List[str] = []

        for task in tasks:
            detail_guid = str(task.get("detailGuid") or "")
            title = str(task.get("title") or "未命名任务")
            reward = str(task.get("prizeTitle") or "")
            status = int(task.get("status") or 0)
            if not detail_guid:
                skipped += 1
                continue

            payload = {
                "detailGuid": detail_guid,
                "pageNum": 1,
                "pageSize": 999,
                "schemeGuid": scheme_guid or SIGN_CENTER_TASK_SCHEME_GUID,
            }

            self.log("任务", f"处理签到页任务 | {title}")

            if status == 0:
                start_data, start_msg = self.post_qiushi("/qiushiinnerapi/task/startTask", payload)
                if start_data is None:
                    failed += 1
                    self.log("任务", f"开始失败 | {title} | {start_msg or '请求失败'}")
                    continue
                time.sleep(random.uniform(0.8, 1.5))

                finish_data, finish_msg = self.post_qiushi("/qiushiinnerapi/task/finishTask", payload)
                if finish_data is None:
                    failed += 1
                    self.log("任务", f"完成失败 | {title} | {finish_msg or '请求失败'}")
                    continue
                time.sleep(random.uniform(0.5, 1.0))
            elif status != 1:
                skipped += 1
                self.log("任务", f"跳过任务 | {title} | 状态 {status}")
                continue

            prize_data, prize_msg = self.post_qiushi("/qiushiinnerapi/task/sendTaskPrize", payload)
            if prize_data is None:
                failed += 1
                self.log("任务", f"领奖失败 | {title} | {prize_msg or '请求失败'}")
                continue

            success += 1
            success_titles.append(f"{title}({reward}里程)" if reward else title)
            self.log("任务", f"任务完成 | {title}")
            time.sleep(random.uniform(0.8, 1.4))

        self.add_line(f"签到页任务: 成功 {success} 个 | 跳过 {skipped} 个 | 失败 {failed} 个")
        if success_titles:
            preview = "、".join(success_titles[:4])
            if len(success_titles) > 4:
                preview += " 等"
            self.add_line(f"签到页任务详情: {preview}")

    def get_money_save_lottery_state(self) -> Tuple[Optional[Dict[str, object]], str]:
        return self.post_lottery("/qiushiinnerapi/fission/lottery/list", {"schGuid": MONEY_SAVE_LOTTERY_GUID})

    def run_money_save_lottery(self) -> None:
        data, message = self.get_money_save_lottery_state()
        if data is None:
            self.add_line(f"刮刮乐: 查询失败 | {message or '请求失败'}", error=True)
            return

        lottery_count = int(data.get("lotteryCount") or 0)
        if lottery_count <= 0:
            self.add_line("刮刮乐: 暂无可用次数")
            return

        prize_texts: List[str] = []
        failed = 0

        for _ in range(lottery_count):
            latest_data, latest_msg = self.get_money_save_lottery_state()
            if latest_data is None:
                failed += 1
                self.log("刮卡", f"刷新状态失败 | {latest_msg or '请求失败'}")
                continue

            current_count = int(latest_data.get("lotteryCount") or 0)
            if current_count <= 0:
                break

            block_list = latest_data.get("blockList") or []
            empty_blocks = [
                int(item.get("index"))
                for item in block_list
                if isinstance(item, dict) and int(item.get("isOccupy") or 0) == 0 and item.get("index") is not None
            ]
            if not empty_blocks:
                self.log("刮卡", "没有可用卡位，结束")
                break

            block_index = empty_blocks[0]
            result, lottery_msg = self.post_lottery(
                "/qiushiinnerapi/fission/lottery/lottery",
                {"schGuid": MONEY_SAVE_LOTTERY_GUID, "blockIndex": block_index},
            )
            if result is None:
                failed += 1
                self.log("刮卡", f"执行失败 | 卡位 {block_index} | {lottery_msg or '请求失败'}")
                continue

            title = str(result.get("resTitle") or result.get("prizeName") or "未知奖励")
            subtitle = str(result.get("resSubtitle") or "").strip()
            prize_text = f"{title}({subtitle})" if subtitle and subtitle != title else title
            prize_texts.append(prize_text)
            self.log("刮卡", f"获得奖励 | {prize_text}")
            time.sleep(random.uniform(0.8, 1.5))

        self.add_line(f"刮刮乐: 成功 {len(prize_texts)} 次 | 失败 {failed} 次")
        if prize_texts:
            preview = "、".join(prize_texts[:4])
            if len(prize_texts) > 4:
                preview += " 等"
            self.add_line(f"刮刮乐奖励: {preview}")

    def run(self) -> bool:
        self.load_sign_state()
        time.sleep(random.uniform(1, 2))
        self.run_share_mileage()
        time.sleep(random.uniform(1, 2))
        cash_act = self.get_act_info()
        if cash_act is not None:
            cash_task = self.ensure_cash_started(cash_act)
            self.summarize_cash_task(cash_task)
        time.sleep(random.uniform(1, 2))
        self.run_sign_center_tasks()
        time.sleep(random.uniform(1, 2))
        self.summarize_sign_share_detail()
        time.sleep(random.uniform(0.8, 1.5))
        self.summarize_drama_business()
        time.sleep(random.uniform(0.8, 1.5))
        self.run_flower_bless()
        time.sleep(random.uniform(1, 2))
        self.run_money_save_lottery()
        if self.error_count and self.summary_lines:
            self.status = "部分成功"
        if self.error_count >= max(1, len(self.summary_lines)):
            self.status = "失败"
        return self.status != "失败"

    def to_result(self) -> Dict[str, object]:
        return {
            "name": self.display_name,
            "status": self.status,
            "lines": self.summary_lines or ["无结果"],
        }



def print_result_block(result: Dict[str, object]) -> None:
    print(f"[{result['name']}] {result['status']}", flush=True)
    for line in result["lines"]:
        print(f"  • {line}", flush=True)
    print("", flush=True)


def build_console_summary(results: List[Dict[str, object]]) -> str:
    if not results:
        return "无执行结果"
    counts = {"成功": 0, "部分成功": 0, "失败": 0}
    for item in results:
        status = str(item.get("status") or "")
        if status in counts:
            counts[status] += 1
    return " | ".join(f"{name} {counts[name]}" for name in ("成功", "部分成功", "失败"))


def main() -> int:
    print_banner(build_notify_title())
    log_global("模式", "本地 code 自动登录")
    accounts = auto_login_accounts()
    
    if not accounts:
        log_global("错误", "自动登录失败，没有获取到任何账号")
        log_global("提示", "请检查本地 wxcode 模块是否已启用")
        return 1

    accounts = prioritize_flower_accounts(accounts)
    
    log_global("时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log_global("账号", f"已加载 {len(accounts)} 个账号")
    log_global("推送", "开启" if PUSH_SWITCH == "1" else "关闭")

    results = []
    for index, account in enumerate(accounts, start=1):
        print_banner(f"处理账号 {index}/{len(accounts)}")
        try:
            client = TongCheng(account, account_index=index)
            client.run()
            result = client.to_result()
            results.append(result)
            print_result_block(result)
        except Exception as exc:
            name = f"账号{index} [{account_label(account)}]"
            log_global("异常", f"{name} | {exc}")
            result = {"name": name, "status": "失败", "lines": [f"执行异常: {exc}"]}
            results.append(result)
            print_result_block(result)
        if index < len(accounts):
            delay = random.uniform(3, 6)
            log_global("等待", f"{delay:.1f} 秒后处理下一个账号")
            time.sleep(delay)

    print_banner("执行汇总")
    log_global("结果", build_console_summary(results))

    if PUSH_SWITCH == "1":
        message = build_push_message(results)
        if notify_send:
            try:
                notify_send(build_notify_title(), message)
                log_global("推送", "消息发送成功")
            except Exception as exc:
                log_global("推送", f"消息发送失败 | {exc}")
        else:
            log_global("推送", "未找到 notify 模块，跳过发送")
    return 1 if any(item.get("status") == "失败" for item in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())



''',
    'kln': r'''

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
客徕拿乐购自动任务 v1.0.0

功能：自动执行客徕拿乐观看广告领乐豆任务
支持本地 wxcode 登录、账号信息查询、广告开始、广告回调、乐豆余额汇总、青龙 notify 推送

更新说明:
### 2026.05.01
v1.0.0:
- 修复广告接口
- 接入本地 code 模块，使用 code 直接登录
- 优化账号展示，优先使用接口返回的脱敏手机号
- 优化控制台输出和推送汇总排版

配置说明:
1. wxcode 本地模块设置:
    - 安装并启用本目录的 `wxcode_1.0_8.0.56.apk`
    - 保持微信里「客徕拿乐购」小程序为对应登录账号
    - `KELAINA_APP_ID`：默认 `wxd53de10d996cabff`
    - `KELAINA_CODE_URL`：默认 `http://127.0.0.1:8088/login?appId={appId}`


3. 推送设置:
    KELAINA_PUSH=1 开启推送
    KELAINA_PUSH=0 关闭推送

定时规则建议 (Cron):
15 8 * * *

From: YaoHuo8648
Email: zheyizzf@188.com
Update: 2026.05.01
"""

import base64
import datetime
import json
import os
import secrets
import time
import urllib.parse

import requests


APP_NAME = "客徕拿"
VERSION = "v1.0.0"
REQUEST_TIMEOUT = 20
APP_ID = os.getenv("KELAINA_APP_ID", "wxd53de10d996cabff").strip()
CODE_URL = os.getenv("KELAINA_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
LOGIN_URL = "https://www.ljgglp.com/api.php/Login/loginWxXcx"
PUSH_SWITCH = os.getenv("KELAINA_PUSH", "1")

try:
    from notify import send as notify_send
except ImportError:
    notify_send = None


def now():
    return datetime.datetime.now().strftime("%H:%M:%S")


def banner(title):
    print("\n" + "=" * 56)
    print(title.center(48))
    print("=" * 56)


def task_title():
    return f"{APP_NAME}自动任务 {VERSION}"


def notify_title():
    return f"{APP_NAME}任务汇总 {VERSION}"


def summary_main_text(summary):
    lines = []
    for line in summary.splitlines():
        if line == "记录:":
            break
        lines.append(line)
    return "\n".join(lines).strip()


def build_notify_content(start_time, summaries):
    items = [item for item in (summary_main_text(summary) for summary in summaries) if item]
    body = ("\n" + "-" * 28 + "\n").join(items)
    return "\n\n".join(item for item in [f"开始时间: {start_time}", body] if item).strip()


def console_summary_lines(summaries):
    lines = []
    for summary in summaries:
        item_lines = summary_main_text(summary).splitlines()
        if not item_lines:
            continue
        if lines:
            lines.append("-" * 28)
        lines.extend(item_lines)
    return lines or ["无账号汇总"]


def decode_jwt(token):
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False, None, None, None
        payload = parts[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload).decode())
        uid = data.get("uid") or data.get("id") or data.get("user_id")
        device_id = data.get("deviceId") or data.get("device_id")
        exp = data.get("exp_time") or data.get("exp")
        return True, uid, device_id, exp
    except Exception:
        return False, None, None, None


def extract_code(payload):
    if not isinstance(payload, dict):
        return ""
    status = payload.get("status")
    err = payload.get("err")
    if status not in (None, "", True, 1, "1", 200, "200", "ok", "OK", "success", "SUCCESS"):
        return ""
    if err not in (None, "", 0, "0"):
        return ""
    items = [payload]
    for key in ("data", "Data", "result"):
        if isinstance(payload.get(key), dict):
            items.append(payload[key])
    for item in items:
        code = str(item.get("code") or item.get("Code") or "").strip()
        if code:
            return code
    return ""


def find_token(payload):
    if isinstance(payload, str):
        return payload.strip() if decode_jwt(payload.strip())[0] else ""
    if isinstance(payload, list):
        for item in payload:
            token = find_token(item)
            if token:
                return token
        return ""
    if not isinstance(payload, dict):
        return ""
    for key in ("userToken", "token", "ck"):
        token = str(payload.get(key) or "").strip()
        if token and decode_jwt(token)[0]:
            return token
    for key in ("data", "result", "user", "userInfo", "info"):
        token = find_token(payload.get(key))
        if token:
            return token
    return ""


def summarize_response(data):
    if not isinstance(data, dict):
        return "无响应数据"
    parts = []
    for key in ("status", "code", "info", "msg", "message"):
        value = data.get(key)
        if value not in (None, ""):
            parts.append(f"{key}={value}")
    return " | ".join(parts) or "响应中无关键字段"


def ts2date(exp):
    if not exp:
        return "未知"
    beijing_time = datetime.datetime.fromtimestamp(exp, datetime.timezone(datetime.timedelta(hours=8)))
    return beijing_time.strftime("%Y-%m-%d %H:%M:%S")



def build_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; MI 8 Build/QKQ1.190828.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.7444.173 Mobile Safari/537.36 XWEB/1420283 MMWEBSDK/20241202 MMWEBID/1077 MicroMessenger/8.0.56.2800(0x28003832) WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64 MiniProgramEnv/android",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": f"https://servicewechat.com/{APP_ID}/1/page-frame.html",
        "charset": "utf-8",
    }


def make_device_id():
    return os.getenv("KELAINA_DEVICE_ID", "").strip() or secrets.token_hex(16)


def fetch_code():
    url = CODE_URL.format(appId=APP_ID, appid=APP_ID)
    try:
        response = requests.get(url, timeout=10)
        payload = response.json()
    except Exception as e:
        print(f"[{now()}] [登录] 获取 code 失败: {e}")
        return ""
    code = extract_code(payload)
    if code:
        print(f"[{now()}] [登录] 获取 code 成功: {code[:10]}...{code[-6:]}")
    else:
        print(f"[{now()}] [登录] 获取 code 失败: {summarize_response(payload)}")
    return code


def login_with_code(code, device_id):
    try:
        response = requests.get(
            LOGIN_URL,
            headers=build_headers(),
            params={"code": code, "deviceId": device_id},
            timeout=REQUEST_TIMEOUT,
        ).json()
    except Exception as e:
        print(f"[{now()}] [登录] code 登录失败: {e}")
        return ""
    token = find_token(response)
    if not token:
        print(f"[{now()}] [登录] code 登录失败: {summarize_response(response)}")
        return ""
    return token


def get_code_token():
    device_id = make_device_id()
    code = fetch_code()
    if not code:
        return ""
    token = login_with_code(code, device_id)
    success, uid, _, exp = decode_jwt(token)
    if not success:
        print(f"[{now()}] [登录] token 解析失败")
        return ""
    print(f"[{now()}] [登录] 登录成功 | UID: {mask_id(uid)} | 过期: {ts2date(exp)}")
    return token


def mask_id(uid):
    value = str(uid or "")
    if not value:
        return "未知账号"
    if len(value) == 1:
        return "*"
    if len(value) <= 4:
        return f"{value[:1]}***{value[-1:]}"
    if len(value) <= 6:
        return f"{value[:2]}***{value[-2:]}"
    return f"{value[:3]}***{value[-3:]}"


def mask_phone(phone):
    value = str(phone or "").strip()
    if not value:
        return ""
    if "*" in value:
        return value
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) >= 11:
        return f"{digits[:3]}****{digits[-4:]}"
    return value






class Main:
    def __init__(self, token=None, index=1):
        success, uid, device_id, exp = decode_jwt(token)
        if not success:
            raise ValueError("JWT 解析失败")
        self.index = index
        self.uid = uid
        self.device_id = device_id or make_device_id()
        self.exp = exp
        self.token = token
        self.display_name = mask_id(uid) or f"账号{index}"
        self.userPhone = ""
        self.userName = ""
        self.balance = "-"
        self.todayCount = 0
        self.maxCount = 10
        self.status = "待执行"
        self.records = []
        self.headers = build_headers()
        self.cookies = {"PHPSESSID": secrets.token_hex(13)}
        self.data = {"deviceId": self.device_id, "userToken": self.token}
        self.log(f"token 解析成功 | UID: {mask_id(uid)} | 过期: {ts2date(exp)}", False)

    def log(self, msg, notify=True):
        line = f"[{now()}] [{self.display_name}] {msg}"
        print(line, flush=True)
        if notify:
            self.records.append(msg)

    def post_json(self, url, data, cookies=None):
        return requests.post(
            url,
            headers=self.headers,
            cookies=cookies,
            data=data,
            timeout=REQUEST_TIMEOUT,
        ).json()

    def data_with_uid(self):
        data = self.data.copy()
        data["uid"] = self.uid
        return data

    def apply_user_info(self, data):
        phone = mask_phone(data.get("user_phone") or data.get("userPhone"))
        self.userName = data.get("user_name") or data.get("userName") or self.userName
        self.userPhone = phone or self.userPhone
        if self.userPhone:
            self.display_name = self.userPhone
        self.balance = data.get("ld_number") or data.get("balance") or self.balance
        self.todayCount = int(float(data.get("todayCount") or self.todayCount or 0))
        self.maxCount = int(float(data.get("maxCount") or self.maxCount or 10))

    def login(self):
        try:
            response = self.post_json("https://www.ljgglp.com/api.php/Lg/adWatchInfo", self.data_with_uid())
            if response.get("status") == 1:
                self.apply_user_info(response.get("data", {}))
                self.status = "账号信息正常"
                self.log(f"账号信息 | 用户: {self.userName or '-'} | 乐豆: {self.balance} | 广告: {self.todayCount}/{self.maxCount}")
                return True
            self.log(f"账号信息查询失败: {response.get('info', response)}")
        except Exception as e:
            self.log(f"账号信息查询异常: {e}")
        return False

    def kgg(self):
        try:
            if self.todayCount >= self.maxCount:
                self.status = "今日广告已完成"
                self.log(f"今日广告已完成 | 进度: {self.todayCount}/{self.maxCount}")
                return
            for _ in range(self.todayCount, self.maxCount):
                data = self.data_with_uid()
                start = self.post_json("https://www.ljgglp.com/api.php/Lg/adWatchStart", data)
                if start.get("status") != 1:
                    self.status = "广告开始失败"
                    self.log(f"广告开始失败: {start.get('info', start)}")
                    break
                play_token = start.get("data", {}).get("playToken")
                if not play_token:
                    self.status = "playToken获取失败"
                    self.log(f"playToken获取失败: {start}")
                    break
                self.log(f"广告开始 | 等待 35 秒 | 当前进度: {self.todayCount}/{self.maxCount}", False)
                time.sleep(35)
                data["playToken"] = play_token
                response = self.post_json("https://www.ljgglp.com/api.php/Lg/adWatchCallback", data, self.cookies)
                info = response.get("info", "")
                if response.get("status") == 1:
                    result = response.get("data", {})
                    self.todayCount = int(float(result.get("todayCount") or self.todayCount + 1))
                    self.balance = result.get("ld_number", self.balance)
                    reward = result.get("reward")
                    reward_text = f" | 奖励: {reward}" if reward is not None else ""
                    self.status = "广告执行成功"
                    self.log(f"{info or '观看成功'}{reward_text} | 进度: {self.todayCount}/{self.maxCount} | 乐豆: {self.balance}")
                    if self.todayCount >= self.maxCount:
                        break
                else:
                    self.status = "广告回调失败"
                    self.log(f"广告回调失败: {info or response}")
                    break
        except Exception as e:
            self.status = "广告执行异常"
            self.log(f"看广告异常: {e}")

    def push_summary(self):
        lines = [
            f"账号: {self.display_name}",
            f"状态: {self.status}",
            f"用户: {self.userName or '-'}",
            f"手机号: {self.userPhone or '-'}",
            f"乐豆: {self.balance}",
            f"广告: {self.todayCount}/{self.maxCount}",
        ]
        if self.records:
            lines.append("记录:")
            lines.extend(f"- {item}" for item in self.records[-6:])
        return "\n".join(lines)


def send_notify(content):
    if PUSH_SWITCH == "0":
        print(f"[{now()}] [推送] 已关闭")
        return
    if not notify_send:
        print(f"[{now()}] [推送] 未找到 notify 模块")
        return
    try:
        notify_send(notify_title(), content)
        print(f"[{now()}] [推送] 已发送")
    except Exception as e:
        print(f"[{now()}] [推送] 发送失败: {e}")


def main():
    start_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    banner(task_title())
    print(f"开始时间: {start_time}")
    print("登录方式: 本地 wxcode")
    token = get_code_token()
    if not token:
        raise ValueError("code 登录失败，未获取到 token")
    summaries = []
    banner("账号 1/1")
    try:
        task = Main(token, index=1)
        if task.login():
            task.kgg()
        summaries.append(task.push_summary())
    except Exception as e:
        print(f"[{now()}] [账号1] 执行异常: {e}")
        summaries.append(f"账号: 账号1\n状态: 执行异常\n原因: {e}")
    banner("执行汇总")
    notify_content = build_notify_content(start_time, summaries)
    for line in console_summary_lines(summaries):
        print(line)
    send_notify(notify_content)


if __name__ == "__main__":
    main()
''',
    'kww': r'''
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
口味王会员中心自动签到 v1.0.2

功能：自动执行口味王会员中心签到、嫩青果园任务、5.2/13.14秒挑战、藏宝图任务（wxcode 单账号版）
支持本地 wxcode 刷新 CK、固定代理、API 动态代理、青龙 notify 推送

更新说明:
### 2026.05.22
v1.0.2:
- 修复签到接口
- 新增嫩青果园签到、答题、浏览任务及奖励领取
- 跳过消费扫码、赠送好友和需真实游戏交互的任务
- 新增收取青果、旅行、投入能量
- 修复挑战和藏宝图遇到 100050 时刷新活动登录后重试

### 2026.05.20
v1.0.1:
- 修复挑战阶段判断，增加 13.14秒挑战

### 2026.05.19
v1.0.0:
- 集成代理系统
- 增加青龙 notify 推送
- 增加 5.2秒挑战任务
- 增加藏宝图抽图

配置说明:
1. 账号变量 (fang_kww):
    格式: 备注#cookie[#代理地址]
    示例: 账号1#wdata4=xxx; w_ts=xxx; _ac=xxx; tokenId=xxx; wdata3=xxx; createdAtToday=true; isNotLoginUser=false; dcustom=xxx#http://127.0.0.1:8080
    wxcode 模式只取当前微信账号；fang_kww 保留手动 cookie 入口

2. 如何抓取 fang_kww:
    ① 打开微信小程序：口味王会员中心
    ② 使用抓包工具抓取 89420-1-activity.m.dexfu.cn 请求
    ③ 找到请求头 Cookie
    ④ 按 备注#cookie 格式填入环境变量

3. 代理设置 (可选，不用代理就不用管):
    - 固定代理：填在 fang_kww 单账号最后，用 # 分隔
    - 动态代理：添加环境变量 KWW_PROXY_API = 你的品赞/通用提取链接
    - 代理类型: KWW_PROXY_TYPE = http 或 socks5 (默认 socks5)

4. 可选设置:
    KWW_BET_AMOUNT=300 百万积分默认投注积分

5. 推送设置:
    KWW_PUSH=1 开启推送
    KWW_PUSH=0 关闭推送

定时规则建议 (Cron):
10 8,15 * * *

From: YaoHuo8648
Email: zheyizzf@188.com
Update: 2026.05.22
"""

import base64
import datetime
import hashlib
import json
import os
import secrets
import sys
import time
import urllib.parse

import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

APP_NAME = "口味王会员中心"
VERSION = "v1.0.2"
ENV_NAME = "fang_kww"
REQUEST_TIMEOUT = 20
PUSH_SWITCH = os.getenv("KWW_PUSH", "1")
PROXY_API_URL = os.getenv("KWW_PROXY_API", "").strip()
PROXY_TYPE = os.getenv("KWW_PROXY_TYPE", "socks5").strip() or "socks5"
KWW_APPID = os.getenv("KWW_APPID", "wxfb0905b0787971ad").strip()
KWW_CODE_URL = os.getenv("KWW_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
KWW_LOGIN_URL = os.getenv("KWW_LOGIN_URL", "https://mmcs-capi.kwwblcj.com/customer-restapi/auth/login").strip()
KWW_USER_SIGN_URL = os.getenv("KWW_USER_SIGN_URL", "https://mmcs-capi.kwwblcj.com/customer-restapi/info/advertisementDetail/getUserSign").strip()
KWW_ACTIVITY_CACHE_KEY = ""

ACTIVITY_HOST = "https://89420-1-activity.m.dexfu.cn"
LOGIN_HOST = "https://89420-activity.dexfu.cn"
SIGN_PROJECT_ID = "p16480c32"
SIGN_REFERER = f"{ACTIVITY_HOST}/projectx/{SIGN_PROJECT_ID}/index.html?appID=89420&version=hg&from=login&spm=89420.1.1.1"
SIGN_INDEX_URL = f"{ACTIVITY_HOST}/projectx/{SIGN_PROJECT_ID}/main/index.do?user_type=0&is_from_share=1"
SIGN_URL = f"{ACTIVITY_HOST}/projectx/{SIGN_PROJECT_ID}/main/sign.do?user_type=0&is_from_share=1"
ORCHARD_PROJECT_ID = "p124e3402"
ORCHARD_REFERER = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/index.html?appID=89420&version=hg&from=login&spm=89420.1.1.1"
ORCHARD_HOME_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/main/index.do"
ORCHARD_CHARGE_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/main/charge.do"
ORCHARD_TRAVEL_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/collectCard/startTravel.do"
ORCHARD_FEED_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/main/feed.do"
ORCHARD_SIGN_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/checkin_1/doSign.do"
ORCHARD_TASK_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/task_1/queryTasks.do"
ORCHARD_DO_TASK_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/task_1/doCompleted.do"
ORCHARD_SEND_PRIZE_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/task_1/sendPrize.do"
ORCHARD_ANSWER_JOIN_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/answer/join.do"
ORCHARD_ANSWER_SUBMIT_URL = f"{ACTIVITY_HOST}/projectx/{ORCHARD_PROJECT_ID}/answer/submit.do"
ORCHARD_TASK_TOKEN = "test_token"
ORCHARD_SKIP_TASK_CODES = {"third_scan", "common_sendEnergy", "browse_aoYun"}
TREASURE_REFERER = f"{ACTIVITY_HOST}/projectx/p20b473c4/index.html?appID=89420&version=hg&from=login&spm=89420.1.1.1"
TREASURE_HOME_URL = f"{ACTIVITY_HOST}/projectx/p20b473c4/game/index.do"
TREASURE_GUIDE_URL = f"{ACTIVITY_HOST}/projectx/p20b473c4/game/guide.do"
TREASURE_OPEN_MAP_URL = f"{ACTIVITY_HOST}/projectx/p20b473c4/game/openMap.do"
TREASURE_DRAW_URL = f"{ACTIVITY_HOST}/projectx/p20b473c4/game/draw.do"
TREASURE_SP_LOG_URL = f"{ACTIVITY_HOST}/projectx/p20b473c4/userSpLogList.query"
TREASURE_TASK_URL = f"{ACTIVITY_HOST}/projectx/p20b473c4/customTask1/queryTasks.do"
TREASURE_FINISH_TASK_URL = f"{ACTIVITY_HOST}/projectx/p20b473c4/customTask1/finishTask.do"
TREASURE_SEND_PRIZE_URL = f"{ACTIVITY_HOST}/projectx/p20b473c4/customTask1/sendPrize.do"
TREASURE_SELECT_CELL_IDS = "1,4,5,6,7"
TREASURE_SP_ID = "sp_xyz"
TREASURE_TASK_TOKEN = "test_token"
TREASURE_TASK_SIGN_SALT = "3ccbe88578b3531e"
TREASURE_FINISH_TASK_CODES = {"subscribe"}
CHALLENGE_REFERER = f"{ACTIVITY_HOST}/projectx/pd13d36dd/index.html?appID=89420&version=hg&from=login&spm=89420.1.1.1"
CHALLENGE_FRONT_URL = f"{ACTIVITY_HOST}/projectx/pd13d36dd/coop_frontVariable.query"
CHALLENGE_INDEX_URL = f"{ACTIVITY_HOST}/projectx/pd13d36dd/challenge/index.do"
CHALLENGE_REPORT_URL = f"{ACTIVITY_HOST}/projectx/pd13d36dd/challenge/resultReport.do"
DEFAULT_CHALLENGE_KEY = "kww@52#second%"
BET_PROJECT_ID = "pbd0c9a23"
BET_REFERER = f"{ACTIVITY_HOST}/projectx/{BET_PROJECT_ID}/index.html?appID=89420&version=hg&from=login&spm=89420.1.1.1"
BET_INDEX_URL = f"{ACTIVITY_HOST}/projectx/{BET_PROJECT_ID}/game/index.do"
BET_CLAIM_URL = f"{ACTIVITY_HOST}/projectx/{BET_PROJECT_ID}/game/claimCredits.do"
BET_COST_URL = f"{ACTIVITY_HOST}/projectx/{BET_PROJECT_ID}/credits/creditsCost.do"
BET_QUERY_URL = f"{ACTIVITY_HOST}/projectx/{BET_PROJECT_ID}/credits/queryStatus.do"
BET_SUBMIT_URL = f"{ACTIVITY_HOST}/projectx/{BET_PROJECT_ID}/game/bet.do"
BET_TASK_URL = f"{ACTIVITY_HOST}/projectx/{BET_PROJECT_ID}/customTask1/queryTasks.do"
BET_FIXED_SIGN_URL = f"{ACTIVITY_HOST}/projectx/{BET_PROJECT_ID}/customTask1/finishFixedTimeSignTask.do"
BET_AMOUNT = os.getenv("KWW_BET_AMOUNT", "300").strip()
BASE_HEADERS = {
    "Connection": "keep-alive",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090c37) XWEB/9129",
    "Accept": "*/*",
    "Origin": ACTIVITY_HOST,
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Referer": SIGN_REFERER,
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

try:
    from notify import send as notify_send
except ImportError:
    notify_send = None


def now():
    return datetime.datetime.now().strftime("%H:%M:%S")


def timestamp_ms():
    return int(time.time() * 1000)


def banner(title):
    print("\n" + "=" * 56)
    print(title.center(48))
    print("=" * 56)


def notify_title():
    return f"{APP_NAME}任务汇总 {VERSION}"


def is_proxy_text(value):
    value = str(value or "").strip().lower()
    return "://" in value or (":" in value and value.rsplit(":", 1)[-1].isdigit())


def build_proxy(proxy):
    proxy = str(proxy or "").strip()
    if not proxy:
        return {}
    if "://" not in proxy:
        proxy = f"http://{proxy}"
    return {"http": proxy, "https": proxy}


def proxy_from_obj(obj):
    if not isinstance(obj, dict) or "ip" not in obj or "port" not in obj:
        return {}
    user = str(obj.get("account") or obj.get("user") or obj.get("username") or "")
    password = str(obj.get("password") or obj.get("pass") or "")
    auth = ""
    if user and password:
        auth = f"{urllib.parse.quote(user, safe='')}:{urllib.parse.quote(password, safe='')}@"
    return build_proxy(f"{PROXY_TYPE}://{auth}{obj['ip']}:{obj['port']}")


def parse_proxy_response(text):
    text = str(text or "").strip()
    try:
        data = json.loads(text)
        items = [data]
        if isinstance(data, dict):
            for key in ("data", "result"):
                if key in data:
                    items.append(data[key])
        while items:
            item = items.pop(0)
            if isinstance(item, list) and item:
                items.append(item[0])
            elif isinstance(item, dict):
                proxy = proxy_from_obj(item)
                if proxy:
                    return proxy
                if isinstance(item.get("list"), list) and item["list"]:
                    items.append(item["list"][0])
    except json.JSONDecodeError:
        pass
    first = text.split()[0] if text else ""
    if is_proxy_text(first):
        return build_proxy(first if "://" in first else f"{PROXY_TYPE}://{first}")
    return {}


def get_api_proxy():
    if not PROXY_API_URL:
        return {}
    try:
        response = requests.get(PROXY_API_URL, timeout=REQUEST_TIMEOUT)
        proxy = parse_proxy_response(response.text)
        if proxy:
            print(f"[{now()}] [代理] 动态代理已获取")
            return proxy
        print(f"[{now()}] [代理] 动态代理响应无法解析")
    except Exception as e:
        print(f"[{now()}] [代理] 动态代理获取失败: {e}")
    return {}


def extract_code(payload):
    if not isinstance(payload, dict):
        return ""
    for item in (payload, payload.get("data"), payload.get("Data"), payload.get("result"), payload.get("Result")):
        if isinstance(item, dict):
            code = item.get("code") or item.get("Code")
            if code:
                return str(code)
    return ""


def payload_message(payload, default="请求失败"):
    if not isinstance(payload, dict):
        return default
    return str(payload.get("msg") or payload.get("message") or payload.get("Message") or default)


def kww_api_headers(token=""):
    headers = {
        "Connection": "keep-alive",
        "X-Version": "22",
        "channel-type": "weixin",
        "xweb_xhr": "1",
        "X-Timestamp": str(timestamp_ms()),
        "X-App-Id": KWW_APPID,
        "User-Agent": BASE_HEADERS["User-Agent"],
        "brand-type": "kww",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Referer": f"https://servicewechat.com/{KWW_APPID}/235/page-frame.html",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    headers["Authorization"] = f"Bearer {token}" if token else ""
    return headers


def mask_phone(value):
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) == 11 and digits.startswith("1"):
        return f"{digits[:3]}****{digits[-4:]}"
    return ""


def cookie_items(cookie):
    items = {}
    for item in str(cookie or "").split(";"):
        if "=" not in item:
            continue
        key, value = item.strip().split("=", 1)
        items[key.strip()] = value.strip()
    return items


def cookie_string(items):
    return "; ".join(f"{key}={value}" for key, value in items.items() if value is not None)


def cookie_dcustom_values(cookie):
    dcustom = urllib.parse.unquote(cookie_items(cookie).get("dcustom", ""))
    return urllib.parse.parse_qs(dcustom)


def activity_login_cookie_by_key(open_id, cache_key, project_id, proxies=None, session=None, cookie=""):
    if not open_id or not cache_key:
        return cookie
    login_session = session if hasattr(getattr(session, "cookies", None), "set") else requests.Session()
    login_session.cookies.clear()
    for key, value in cookie_items(cookie).items():
        try:
            login_session.cookies.set(key, value)
        except Exception:
            pass
    activity_url = f"{LOGIN_HOST}/projectx/{project_id}/index.html?appID=89420&version=hg"
    login_url = (
        f"{LOGIN_HOST}/customActivity/kww/custom/autoLoginNew"
        f"?appId=89420&redirectUrl={urllib.parse.quote(activity_url, safe='')}"
        f"&openId={urllib.parse.quote(open_id, safe='')}&userId={urllib.parse.quote(cache_key, safe='')}"
    )
    headers = {
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": BASE_HEADERS["User-Agent"],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/wxpic,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    try:
        login_session.get(login_url, headers=headers, allow_redirects=True, proxies=proxies or None, timeout=REQUEST_TIMEOUT)
    except Exception:
        return cookie
    merged = cookie_items(cookie)
    for item in getattr(login_session, "cookies", []):
        merged[item.name] = item.value
    return cookie_string(merged)


def activity_login_cookie(cookie, project_id, proxies=None, session=None):
    values = cookie_dcustom_values(cookie)
    open_id = (values.get("decodeOpenId") or values.get("kwwDecodeOpenId") or [""])[0]
    member_id = (values.get("memberId") or values.get("kwwMemberId") or [""])[0]
    cache_key = KWW_ACTIVITY_CACHE_KEY or (f"{member_id}_h5" if member_id else f"{open_id}_h5")
    return activity_login_cookie_by_key(open_id, cache_key, project_id, proxies=proxies, session=session, cookie=cookie)


def get_wx_code(session=requests):
    data = session.get(KWW_CODE_URL.format(appId=KWW_APPID, appid=KWW_APPID), timeout=REQUEST_TIMEOUT).json()
    code = extract_code(data)
    if not code:
        raise RuntimeError(payload_message(data, "获取 code 失败"))
    return code


def login_with_code(code, proxies=None, session=requests):
    data = session.post(KWW_LOGIN_URL, json={"code": code}, headers=kww_api_headers(), proxies=proxies or None, timeout=REQUEST_TIMEOUT).json()
    if str(data.get("code")) not in {"0", "200"}:
        raise RuntimeError(payload_message(data, "code 登录失败"))
    token = (data.get("data") or {}).get("token") or (data.get("data") or {}).get("accessToken")
    if not token:
        raise RuntimeError("code 登录未返回 token")
    return str(token)


def get_user_sign(token, proxies=None, session=requests):
    data = session.get(KWW_USER_SIGN_URL, params={"redirectType": "h5"}, headers=kww_api_headers(token), proxies=proxies or None, timeout=REQUEST_TIMEOUT).json()
    if str(data.get("code")) not in {"0", "200"}:
        raise RuntimeError(payload_message(data, "获取签名数据失败"))
    sign_data = data.get("data") or {}
    open_id = sign_data.get("openId") or sign_data.get("decodeOpenId") or sign_data.get("kwwDecodeOpenId")
    cache_key = sign_data.get("cacheKey")
    if not cache_key:
        member_id = sign_data.get("originMemberId") or sign_data.get("memberId") or sign_data.get("kwwMemberId")
        cache_key = f"{member_id}_h5" if member_id else f"{open_id}_h5"
    if not open_id or not cache_key:
        raise RuntimeError("签名数据缺少 openId/cacheKey")
    return str(open_id), str(cache_key)


def refresh_cookie_by_code(project_id=ORCHARD_PROJECT_ID, proxies=None, session=None):
    global KWW_ACTIVITY_CACHE_KEY
    login_session = session or requests.Session()
    code = get_wx_code(session=login_session)
    token = login_with_code(code, proxies=proxies, session=login_session)
    open_id, cache_key = get_user_sign(token, proxies=proxies, session=login_session)
    KWW_ACTIVITY_CACHE_KEY = cache_key
    return activity_login_cookie_by_key(open_id, cache_key, project_id, proxies=proxies, session=login_session)


def phone_from_cookie(cookie):
    items = cookie_items(cookie)
    for key in ("phone", "mobile", "mobilePhone", "memberPhone", "userPhone", "tel"):
        phone = mask_phone(items.get(key))
        if phone:
            return phone
    dcustom = urllib.parse.unquote(items.get("dcustom", ""))
    values = urllib.parse.parse_qs(dcustom)
    for key in ("phone", "mobile", "mobilePhone", "memberPhone", "userPhone", "tel"):
        phone = mask_phone((values.get(key) or [""])[0])
        if phone:
            return phone
    return ""


def display_name_from_cookie(name, cookie):
    return phone_from_cookie(cookie) or mask_phone(name) or name


def parse_env(value=None):
    raw = os.getenv(ENV_NAME, "") if value is None else str(value or "")
    accounts = []
    for line in raw.replace("\n", "&").split("&"):
        line = line.strip()
        if not line:
            continue
        parts = [part.strip() for part in line.split("#") if part.strip()]
        fixed_proxy = ""
        if parts and is_proxy_text(parts[-1]):
            fixed_proxy = parts.pop()
        if len(parts) == 2:
            name, cookie = parts
        else:
            print(f"警告：跳过无效行（需要 备注#cookie[#代理]）：{line}")
            continue
        if fixed_proxy and not is_proxy_text(fixed_proxy):
            print(f"警告：跳过无效代理账号：{line}")
            continue
        if cookie:
            accounts.append((name, cookie, fixed_proxy))
    return accounts


def build_headers(cookie, referer=None):
    headers = BASE_HEADERS.copy()
    headers["Cookie"] = cookie
    if referer:
        headers["Referer"] = referer
    return headers


def request_json(session, method, url, cookie, proxies=None, referer=None, params=None, data=None, json_body=None):
    headers = build_headers(cookie, referer=referer)
    if method == "POST":
        if json_body is None:
            headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
            response = session.post(
                url,
                params=params,
                data=urllib.parse.urlencode(data or {}),
                headers=headers,
                proxies=proxies or None,
                timeout=REQUEST_TIMEOUT,
            )
        else:
            headers["Content-Type"] = "application/json"
            response = session.post(
                url,
                params=params,
                json=json_body,
                headers=headers,
                proxies=proxies or None,
                timeout=REQUEST_TIMEOUT,
            )
    else:
        response = session.get(
            url,
            params=params,
            headers=headers,
            proxies=proxies or None,
            timeout=REQUEST_TIMEOUT,
        )
    if response.status_code != 200:
        return False, {"message": f"HTTP {response.status_code}"}
    try:
        return True, json.loads(response.text)
    except json.JSONDecodeError:
        return False, {"message": "响应非 JSON"}


def timed_params(extra=None):
    params = {"user_type": 0, "is_from_share": 1, "_t": timestamp_ms()}
    if extra:
        params.update(extra)
    return params


def response_message(data, default):
    return data.get("message") or data.get("desc") or default


def need_activity_refresh(data):
    msg = response_message(data, "")
    return str(data.get("code")) == "100050" or "请重新进活动" in msg


def activity_refresh_hint():
    return "请重新进活动，需重新刷新CK"


def safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def sign(cookie, proxies=None, session=requests):
    session.get(
        SIGN_INDEX_URL,
        headers=build_headers(cookie, referer=SIGN_REFERER),
        params={"_t": timestamp_ms()},
        proxies=proxies or None,
        timeout=REQUEST_TIMEOUT,
    )
    response = session.get(
        SIGN_URL,
        headers=build_headers(cookie, referer=SIGN_REFERER),
        params={"_t": timestamp_ms()},
        proxies=proxies or None,
        timeout=REQUEST_TIMEOUT,
    )
    text = response.text.strip()
    if response.status_code != 200:
        return False, f"HTTP {response.status_code}"
    return parse_sign_result(text)


def parse_sign_result(text):
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return False, "响应非 JSON"
    message = data.get("message") or data.get("desc") or ""
    if data.get("success") is True:
        payload = data.get("data") or {}
        parts = ["签到成功"]
        if payload.get("signCredits") is not None:
            parts.append(f"签到积分 {payload.get('signCredits')}")
        if payload.get("newLuckCreditsNum") is not None:
            parts.append(f"存钱罐 {payload.get('newLuckCreditsNum')}")
        return True, "，".join(parts)
    if str(data.get("code")) == "3003" or "已签到" in message or "已经签到" in message:
        return True, message or "今日已签到"
    return False, message or "签到失败"


def orchard_reward_options(data):
    return (((data.get("data") or {}).get("options")) or [])


def format_reward_totals(rewards):
    return "，".join(f"{name}+{count}" for name, count in rewards.items() if count)


def add_reward_totals(rewards, options):
    for item in options:
        name = item.get("optionName") or "奖励"
        count = safe_int(item.get("sendCount"))
        if count:
            rewards[name] = rewards.get(name, 0) + count


def format_reward_options(options):
    parts = []
    for item in options:
        name = str(item.get("optionName") or "奖励")
        count = safe_int(item.get("sendCount"))
        parts.append(name if count and str(count) in name else f"{name}+{count}" if count else name)
    return "，".join(parts)


def orchard_sign(cookie, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "POST",
        ORCHARD_SIGN_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"_t": timestamp_ms()},
        data={"token": ORCHARD_TASK_TOKEN, "user_type": 1, "is_from_share": 1},
    )
    msg = response_message(data, "嫩青果园签到失败")
    if not ok:
        return False, msg
    if data.get("success") is True:
        options = orchard_reward_options(data)
        reward_text = format_reward_options(options)
        return True, f"签到成功，{reward_text}" if reward_text else "签到成功"
    if str(data.get("code")) == "3003" or "已签到" in msg or "已经签到" in msg:
        return True, msg or "今日已签到"
    return False, msg


def orchard_task_items(data):
    return (((data.get("data") or {}).get("item")) or [])


def orchard_skip_task(task):
    code = str(task.get("code") or "")
    title = str(task.get("title") or "")
    jump_url = str(task.get("jumpUrl") or "")
    return (
        code in ORCHARD_SKIP_TASK_CODES
        or "p8a0bdd7b" in jump_url
        or "邀请" in title
        or "赠送" in title
        or "消费" in title
        or "扫码" in title
    )


def orchard_query_tasks(cookie, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "GET",
        ORCHARD_TASK_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"user_type": 1, "is_from_share": 1, "_t": timestamp_ms()},
    )
    if not ok or data.get("success") is not True:
        return False, data, response_message(data, "嫩青果园任务查询失败")
    return True, data, ""


def orchard_complete_task(cookie, task_code, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "POST",
        ORCHARD_DO_TASK_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"_t": timestamp_ms()},
        data={"taskCode": task_code, "token": ORCHARD_TASK_TOKEN, "user_type": 1, "is_from_share": 1},
    )
    msg = response_message(data, "任务完成失败")
    if data.get("success") is True:
        return True, "", ((data.get("data") or {}).get("prizePendingCode"))
    if "已完成" in msg or "已做过" in msg:
        return True, msg, None
    return False, msg, None


def orchard_answer_task(cookie, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "GET",
        ORCHARD_ANSWER_JOIN_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"token": ORCHARD_TASK_TOKEN, "user_type": 1, "is_from_share": 1, "_t": timestamp_ms()},
    )
    msg = response_message(data, "获取题目失败")
    if not ok or data.get("success") is not True:
        if "已完成" in msg or "已做过" in msg:
            return True, msg, None
        return False, msg, None
    payload = data.get("data") or {}
    answers = []
    for question in payload.get("questions") or []:
        option = next((item for item in question.get("options") or [] if item.get("correct")), None)
        if option:
            answers.append({"id": question.get("id"), "optionId": option.get("id")})
    if not answers:
        return False, "未获取到正确答案", None
    submit_data = {
        "data": answers,
        "recordId": payload.get("recordId"),
        "token": ORCHARD_TASK_TOKEN,
        "user_type": "1",
        "is_from_share": "1",
        "_t": timestamp_ms(),
    }
    ok, data = request_json(
        session,
        "POST",
        ORCHARD_ANSWER_SUBMIT_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"_t": submit_data["_t"]},
        json_body=submit_data,
    )
    msg = response_message(data, "提交答案失败")
    if data.get("success") is True:
        return True, "", ((data.get("data") or {}).get("prizePendingCode"))
    if "已完成" in msg or "已做过" in msg:
        return True, msg, None
    return False, msg, None


def orchard_send_prize(cookie, task_code, prize_pending_code, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "POST",
        ORCHARD_SEND_PRIZE_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"_t": timestamp_ms()},
        data={
            "taskCode": task_code,
            "prizePendingCode": prize_pending_code,
            "token": ORCHARD_TASK_TOKEN,
            "user_type": 1,
            "is_from_share": 1,
        },
    )
    msg = response_message(data, "任务领奖失败")
    if data.get("success") is True:
        return True, "", orchard_reward_options(data)
    if "已领取" in msg:
        return True, msg, []
    return False, msg, []


def orchard_tasks(cookie, proxies=None, session=requests):
    ok, data, msg = orchard_query_tasks(cookie, proxies=proxies, session=session)
    if not ok:
        return False, msg
    completed = 0
    claimed = 0
    skipped = 0
    rewards = {}
    pending = []
    seen_pending = set()
    for task in orchard_task_items(data):
        code = task.get("code")
        title = task.get("title") or code
        prize_pending_code = task.get("prizePendingCode")
        if orchard_skip_task(task):
            skipped += 1
            continue
        if safe_int(task.get("taskStatus")) == 1 and prize_pending_code and task.get("sendPrize") is False:
            pending.append((code, prize_pending_code))
            continue
        if safe_int(task.get("taskStatus")) != 0:
            continue
        if code == "common_answer":
            ok, msg, prize_pending_code = orchard_answer_task(cookie, proxies=proxies, session=session)
        else:
            ok, msg, prize_pending_code = orchard_complete_task(cookie, code, proxies=proxies, session=session)
        if not ok:
            return False, f"{title}: {msg}"
        completed += 1
        if prize_pending_code:
            pending.append((code, prize_pending_code))
    for task_code, prize_pending_code in pending:
        key = (task_code, prize_pending_code)
        if key in seen_pending:
            continue
        seen_pending.add(key)
        ok, msg, options = orchard_send_prize(cookie, task_code, prize_pending_code, proxies=proxies, session=session)
        if not ok:
            return False, f"{task_code}: {msg}"
        claimed += 1
        add_reward_totals(rewards, options)
    parts = [f"完成 {completed} 个" if completed else "无新完成任务"]
    parts.append(f"领奖 {claimed} 个" if claimed else "无待领奖励")
    reward_text = format_reward_totals(rewards)
    if reward_text:
        parts.append(f"奖励 {reward_text}")
    if skipped:
        parts.append(f"跳过 {skipped} 个")
    return True, "，".join(parts)


def orchard_home(cookie, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "GET",
        ORCHARD_HOME_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"user_type": 1, "is_from_share": 1, "_t": timestamp_ms()},
    )
    if not ok or data.get("success") is not True:
        return False, data, response_message(data, "嫩青果园查询失败")
    return True, data, ""


def orchard_collect_green(cookie, proxies=None, session=requests):
    ok, data, msg = orchard_home(cookie, proxies=proxies, session=session)
    if not ok:
        return False, msg
    tree = ((data.get("data") or {}).get("treeInfo") or {})
    can_charge = safe_int(tree.get("canChargeNum"))
    if can_charge <= 0:
        return True, "当前无青果可收取"
    ok, charged = request_json(
        session,
        "GET",
        ORCHARD_CHARGE_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"validate": "true", "token": ORCHARD_TASK_TOKEN, "user_type": 1, "is_from_share": 1, "_t": timestamp_ms()},
    )
    msg = response_message(charged, "收取青果失败")
    if charged.get("success") is True:
        return True, f"收取青果 {can_charge}"
    if str(charged.get("code")) == "2008" or "无青果" in msg:
        return True, msg
    return False, msg


def orchard_start_travel(cookie, proxies=None, session=requests):
    ok, data, msg = orchard_home(cookie, proxies=proxies, session=session)
    if not ok:
        return False, msg
    green_num = safe_int((data.get("data") or {}).get("greenFruitNum"))
    if green_num < 200:
        return True, f"青果 {green_num}，不足 200，跳过旅行"
    ok, traveled = request_json(
        session,
        "GET",
        ORCHARD_TRAVEL_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"greenFruitNum": 200, "token": ORCHARD_TASK_TOKEN, "user_type": 1, "is_from_share": 1, "_t": timestamp_ms()},
    )
    msg = response_message(traveled, "旅行失败")
    if traveled.get("success") is True:
        return True, "旅行成功"
    if "青果失败" in msg or "青果不足" in msg:
        return True, msg
    return False, msg


def orchard_feed_energy(cookie, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "GET",
        ORCHARD_FEED_URL,
        cookie,
        proxies=proxies,
        referer=ORCHARD_REFERER,
        params={"token": ORCHARD_TASK_TOKEN, "user_type": 1, "is_from_share": 1, "_t": timestamp_ms()},
    )
    msg = response_message(data, "投入能量失败")
    if data.get("success") is True:
        return True, "投入能量成功"
    if str(data.get("code")) in {"2006", "2007"} or "消耗中" in msg or "能量不足" in msg or "已满" in msg:
        return True, msg
    return False, msg


def parse_treasure_draw_data(data):
    if data.get("success") is not True:
        return False, response_message(data, "抽图失败")
    sum_info = ((data.get("data") or {}).get("sumInfo") or {})
    parts = ["抽图成功"]
    if sum_info.get("heart") is not None:
        parts.append(f"心数 {sum_info.get('heart')}")
    if sum_info.get("heartRewardXyz"):
        parts.append(f"奖励 {sum_info.get('heartRewardXyz')}")
    if sum_info.get("directRewardXyz"):
        parts.append(f"直接奖励 {sum_info.get('directRewardXyz')}")
    return True, "，".join(parts)


def parse_treasure_draw_result(text):
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return False, "响应非 JSON"
    return parse_treasure_draw_data(data)


def timestamp_date(value):
    return datetime.datetime.fromtimestamp(safe_int(value) / 1000).date()


def treasure_today_xyz(data, today=None):
    today = today or datetime.date.today()
    items = (((data.get("data") or {}).get("list")) or [])
    total = 0
    for item in items:
        if str(item.get("changedType")) != "+":
            continue
        if timestamp_date(item.get("createTimestamp")) == today:
            total += safe_int(item.get("quantity"))
    return total


def treasure_home(cookie, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "GET",
        TREASURE_HOME_URL,
        cookie,
        proxies=proxies,
        referer=TREASURE_REFERER,
        params=timed_params(),
    )
    if not ok or data.get("success") is not True:
        return False, data, response_message(data, "藏宝图查询失败")
    return True, data, ""


def treasure_sp_log(cookie, proxies=None, session=requests, page_num=1):
    ok, data = request_json(
        session,
        "GET",
        TREASURE_SP_LOG_URL,
        cookie,
        proxies=proxies,
        referer=TREASURE_REFERER,
        params=timed_params({"spId": TREASURE_SP_ID, "pageSize": 200, "pageNum": page_num}),
    )
    if not ok or data.get("success") is not True:
        return False, data, response_message(data, "心愿值明细查询失败")
    return True, data, ""


def treasure_today_reward(cookie, proxies=None, session=requests):
    page_num = 1
    today = datetime.date.today()
    total = 0
    while page_num <= 5:
        ok, data, msg = treasure_sp_log(cookie, proxies=proxies, session=session, page_num=page_num)
        if not ok:
            return False, 0, msg
        total += treasure_today_xyz(data, today=today)
        items = (((data.get("data") or {}).get("list")) or [])
        if not (data.get("data") or {}).get("haveMore"):
            break
        if any(timestamp_date(item.get("createTimestamp")) < today for item in items):
            break
        page_num += 1
    return True, total, ""


def treasure_summary(cookie, draw_count, proxies=None, session=requests, home=None):
    total_xyz = None
    if home is None:
        ok, home, _ = treasure_home(cookie, proxies=proxies, session=session)
    if home:
        total_xyz = safe_int((home.get("data") or {}).get("userLeftXyz"))
    ok, today_xyz, reward_msg = treasure_today_reward(cookie, proxies=proxies, session=session)
    parts = [f"抽图 {draw_count} 次" if draw_count else "无藏宝图次数"]
    if ok:
        parts.append(f"今日奖励 {today_xyz}")
    elif reward_msg:
        parts.append(reward_msg)
    if total_xyz is not None:
        parts.append(f"总心愿值 {total_xyz}")
    return "，".join(parts)


def treasure_status(cookie, proxies=None, session=requests):
    ok, home, msg = treasure_home(cookie, proxies=proxies, session=session)
    if not ok:
        return False, msg
    info = home.get("data") or {}
    left_map = safe_int((info.get("mapInfo") or {}).get("leftMap"))
    parts = [f"剩余抽图 {left_map} 次"]
    ok, today_xyz, reward_msg = treasure_today_reward(cookie, proxies=proxies, session=session)
    if ok:
        parts.append(f"今日奖励 {today_xyz}")
    elif reward_msg:
        parts.append(reward_msg)
    parts.append(f"总心愿值 {safe_int(info.get('userLeftXyz'))}")
    return True, "，".join(parts)


def build_treasure_task_sign(user_id, task_code, timestamp):
    raw = f"{user_id}_{task_code}_{timestamp}_{TREASURE_TASK_SIGN_SALT}"
    return hashlib.md5(raw.encode()).hexdigest()


def treasure_task_items(data):
    return (((data.get("data") or {}).get("item")) or [])


def is_invite_task(task):
    code = str(task.get("code") or "").lower()
    title = str(task.get("title") or "")
    return code.startswith("invite") or "邀请" in title


def treasure_task_reward_count(task):
    return sum(safe_int(item.get("sendCount")) for item in (task.get("options") or []))


def treasure_query_tasks(cookie, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "GET",
        TREASURE_TASK_URL,
        cookie,
        proxies=proxies,
        referer=TREASURE_REFERER,
        params=timed_params({"user_type": 1}),
    )
    if not ok or data.get("success") is not True:
        return False, data, response_message(data, "藏宝图任务查询失败")
    return True, data, ""


def treasure_finish_task(cookie, user_id, task_code, timestamp, proxies=None, session=requests):
    finish_params = timed_params({
        "user_type": 1,
        "taskCode": task_code,
        "timestamp": timestamp,
        "sign": build_treasure_task_sign(user_id, task_code, timestamp),
        "token": TREASURE_TASK_TOKEN,
    })
    ok, data = request_json(
        session,
        "POST",
        TREASURE_FINISH_TASK_URL,
        cookie,
        proxies=proxies,
        referer=TREASURE_REFERER,
        params={"playwayId": "customTask1", "_t": finish_params["_t"]},
        data=finish_params,
    )
    if not ok or data.get("success") is not True:
        return False, response_message(data, "任务完成失败")
    return True, ""


def treasure_send_prize(cookie, task, proxies=None, session=requests):
    prize_params = timed_params({
        "user_type": 1,
        "prizePendingCode": task.get("prizePendingCode"),
        "taskId": task.get("id"),
        "taskCode": task.get("code"),
        "token": TREASURE_TASK_TOKEN,
    })
    ok, data = request_json(
        session,
        "POST",
        TREASURE_SEND_PRIZE_URL,
        cookie,
        proxies=proxies,
        referer=TREASURE_REFERER,
        params={"playwayId": "customTask1", "_t": prize_params["_t"]},
        data=prize_params,
    )
    if not ok or data.get("success") is not True:
        return False, response_message(data, "任务领奖失败")
    return True, ""


def treasure_tasks(cookie, proxies=None, session=requests):
    ok, home, msg = treasure_home(cookie, proxies=proxies, session=session)
    if not ok:
        return False, msg
    user_id = ((home.get("data") or {}).get("userId") or "")
    ok, tasks, msg = treasure_query_tasks(cookie, proxies=proxies, session=session)
    if not ok:
        return False, msg
    timestamp = ((tasks.get("data") or {}).get("timestamp") or timestamp_ms())
    finished = []
    for task in treasure_task_items(tasks):
        if is_invite_task(task) or task.get("code") not in TREASURE_FINISH_TASK_CODES:
            continue
        if safe_int(task.get("taskStatus")) != 0 or not user_id:
            continue
        ok, msg = treasure_finish_task(
            cookie,
            user_id,
            task.get("code"),
            timestamp,
            proxies=proxies,
            session=session,
        )
        if not ok:
            return False, f"{task.get('title') or task.get('code')}{msg}"
        finished.append(task.get("title") or task.get("code"))
    if finished:
        ok, tasks, msg = treasure_query_tasks(cookie, proxies=proxies, session=session)
        if not ok:
            return False, msg
    claimed = []
    for task in treasure_task_items(tasks):
        if is_invite_task(task) or not task.get("prizePendingCode"):
            continue
        if safe_int(task.get("taskStatus")) != 1 or task.get("sendPrize") is not False:
            continue
        ok, msg = treasure_send_prize(cookie, task, proxies=proxies, session=session)
        if not ok:
            return False, f"{task.get('title') or task.get('code')}{msg}"
        claimed.append(f"{task.get('title') or task.get('code')}+{treasure_task_reward_count(task)}")
    if claimed:
        return True, "领取" + "，".join(claimed)
    if finished:
        return True, "已完成" + "，".join(finished)
    return True, "无可处理藏宝图任务"


def treasure_draw_record(cookie, record_id, proxies=None, session=requests):
    draw_params = timed_params({
        "recordId": record_id,
        "selectCellIds": TREASURE_SELECT_CELL_IDS,
    })
    ok, drawn = request_json(
        session,
        "POST",
        TREASURE_DRAW_URL,
        cookie,
        proxies=proxies,
        referer=TREASURE_REFERER,
        params={"_t": draw_params["_t"]},
        data=draw_params,
    )
    if not ok:
        return False, response_message(drawn, "抽图失败")
    return parse_treasure_draw_data(drawn)


def treasure_map(cookie, proxies=None, session=requests, refresh_retry=True):
    ok, home, msg = treasure_home(cookie, proxies=proxies, session=session)
    if not ok:
        return False, msg
    info = home.get("data") or {}
    if safe_int(info.get("newGuideFlag"), 1) == 0:
        guide_params = timed_params({"flag": 1})
        ok, guide = request_json(
            session,
            "POST",
            TREASURE_GUIDE_URL,
            cookie,
            proxies=proxies,
            referer=TREASURE_REFERER,
            params={"_t": guide_params["_t"]},
            data=guide_params,
        )
        if ok and guide.get("success") is True:
            ok, home, msg = treasure_home(cookie, proxies=proxies, session=session)
            if not ok:
                return False, msg
        elif not ok or guide.get("success") is not True:
            return False, response_message(guide, "藏宝图引导失败")
    map_info = ((home.get("data") or {}).get("mapInfo") or {})
    left_map = safe_int(map_info.get("leftMap"))
    results = []
    if safe_int(map_info.get("status")) == 0 and map_info.get("openMapRecordId"):
        draw_ok, draw_msg = treasure_draw_record(
            cookie,
            map_info.get("openMapRecordId"),
            proxies=proxies,
            session=session,
        )
        if not draw_ok:
            if refresh_retry and "请重新进活动" in draw_msg:
                return treasure_map(activity_login_cookie(cookie, "p20b473c4", proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
            if "请重新进活动" in draw_msg:
                return True, activity_refresh_hint()
            return False, draw_msg
        results.append(draw_msg)
    if left_map <= 0 and not results:
        return True, treasure_summary(cookie, 0, proxies=proxies, session=session, home=home)
    for _ in range(left_map):
        open_params = timed_params()
        ok, opened = request_json(
            session,
            "POST",
            TREASURE_OPEN_MAP_URL,
            cookie,
            proxies=proxies,
            referer=TREASURE_REFERER,
            params={"_t": open_params["_t"]},
            data=open_params,
        )
        if not ok or opened.get("success") is not True:
            if refresh_retry and need_activity_refresh(opened):
                return treasure_map(activity_login_cookie(cookie, "p20b473c4", proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
            if need_activity_refresh(opened):
                return True, activity_refresh_hint()
            return False, response_message(opened, "开图失败")
        record_id = ((opened.get("data") or {}).get("recordId"))
        if not record_id:
            return False, "开图缺少 recordId"
        draw_ok, draw_msg = treasure_draw_record(
            cookie,
            record_id,
            proxies=proxies,
            session=session,
        )
        if not draw_ok:
            if refresh_retry and "请重新进活动" in draw_msg:
                return treasure_map(activity_login_cookie(cookie, "p20b473c4", proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
            if "请重新进活动" in draw_msg:
                return True, activity_refresh_hint()
            return False, draw_msg
        results.append(draw_msg)
    return True, treasure_summary(cookie, len(results), proxies=proxies, session=session)


def build_challenge_cipher(key, bits=256, timestamp=None, nonce=None, stage="STAGE1", level=0):
    key_bytes = str(key or DEFAULT_CHALLENGE_KEY).encode()
    key_bytes = key_bytes[:bits // 8].ljust(bits // 8, b"\0")
    nonce = nonce or secrets.token_bytes(12)
    payload = json.dumps(
        {"stage": stage, "level": level, "timestamp": timestamp or timestamp_ms()},
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode()
    return base64.b64encode(nonce + AESGCM(key_bytes).encrypt(nonce, payload, None)).decode()


def challenge_target(data, level):
    payload = data.get("data") or {}
    stage_times = payload.get("stageTimes") or {}
    server_time = safe_int(payload.get("serverTime")) or timestamp_ms()
    if safe_int(stage_times.get("stage1EndTime")) and server_time > safe_int(stage_times.get("stage1EndTime")):
        return "STAGE2", level
    return "STAGE1", 0


def challenge_succeeded(data, stage="STAGE1", level=0):
    payload = data.get("data") or {}
    if stage == "STAGE1":
        return ((payload.get("stage1") or {}).get("todaySucceeded")) is True
    if stage == "STAGE2":
        members = ((payload.get("stage2") or {}).get("members") or [])
        self_member = next((item for item in members if item.get("isSelf") is True), {})
        return safe_int(self_member.get("progressStatus")) >= level
    return False


def challenge_invite_code(data):
    return (((data.get("data") or {}).get("stage2") or {}).get("inviteCode") or "")


def challenge_run(cookie, level=1, proxies=None, session=requests, refresh_retry=True):
    ok, front = request_json(
        session,
        "GET",
        CHALLENGE_FRONT_URL,
        cookie,
        proxies=proxies,
        referer=CHALLENGE_REFERER,
        params=timed_params(),
    )
    if not ok or front.get("success") is not True:
        return False, response_message(front, "挑战配置查询失败")
    config = front.get("data") or {}
    aes_key = config.get("challenge_report_aes_key") or DEFAULT_CHALLENGE_KEY
    aes_bits = safe_int(config.get("challenge_report_aes_bits"), 256)
    ok, index = request_json(
        session,
        "GET",
        CHALLENGE_INDEX_URL,
        cookie,
        proxies=proxies,
        referer=CHALLENGE_REFERER,
        params=timed_params(),
    )
    if not ok or index.get("success") is not True:
        return False, response_message(index, "挑战查询失败")
    stage, target_level = challenge_target(index, level)
    invite_code = challenge_invite_code(index)
    if challenge_succeeded(index, stage, target_level):
        return True, "今日已挑战成功"
    report_params = timed_params({"cipherText": build_challenge_cipher(aes_key, aes_bits, stage=stage, level=target_level)})
    ok, report = request_json(
        session,
        "POST",
        CHALLENGE_REPORT_URL,
        cookie,
        proxies=proxies,
        referer=CHALLENGE_REFERER,
        params={"_t": report_params["_t"]},
        data=report_params,
    )
    if not ok or report.get("success") is not True:
        if refresh_retry and need_activity_refresh(report):
            return challenge_run(
                activity_login_cookie(cookie, "pd13d36dd", proxies=proxies, session=session),
                level=level,
                proxies=proxies,
                session=session,
                refresh_retry=False,
            )
        if need_activity_refresh(report):
            return True, activity_refresh_hint()
        return False, response_message(report, "挑战上报失败")
    next_params = timed_params({"inviteCode": invite_code} if invite_code else None)
    ok, index = request_json(
        session,
        "GET",
        CHALLENGE_INDEX_URL,
        cookie,
        proxies=proxies,
        referer=CHALLENGE_REFERER,
        params=next_params,
    )
    if ok and index.get("success") is True and challenge_succeeded(index, stage, target_level):
        return True, "挑战成功"
    return True, "挑战已上报"


def challenge_52(cookie, proxies=None, session=requests):
    return challenge_run(cookie, level=1, proxies=proxies, session=session)


def challenge_1314(cookie, proxies=None, session=requests):
    return challenge_run(cookie, level=2, proxies=proxies, session=session)


def million_bet_amount():
    amount = safe_int(BET_AMOUNT, 300)
    return min(max(amount, 300), 30000)


def million_bet_index(cookie, proxies=None, session=requests):
    ok, data = request_json(
        session,
        "GET",
        BET_INDEX_URL,
        cookie,
        proxies=proxies,
        referer=BET_REFERER,
        params={"user_type": 1, "is_from_share": 1, "_t": timestamp_ms()},
    )
    if not ok or data.get("success") is not True:
        return False, data, response_message(data, "百万积分查询失败")
    return True, data, ""


def million_claim(cookie, proxies=None, session=requests, refresh_retry=True):
    ok, data = request_json(
        session,
        "POST",
        BET_CLAIM_URL,
        cookie,
        proxies=proxies,
        referer=BET_REFERER,
        params={"_t": timestamp_ms()},
        data={"user_type": "1", "is_from_share": "1"},
    )
    msg = response_message(data, "百万积分领取失败")
    if data.get("success") is True:
        credits = safe_int((data.get("data") or {}).get("carveUpCredits"))
        return True, f"领取积分 {credits}" if credits else "暂无可领取积分"
    if "已领取" in msg or "未到领取时间" in msg or "未开始" in msg or "昨日未投注" in msg:
        return True, msg
    if refresh_retry and need_activity_refresh(data):
        return million_claim(activity_login_cookie(cookie, BET_PROJECT_ID, proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
    if need_activity_refresh(data):
        return True, activity_refresh_hint()
    return False, msg


def million_bet(cookie, proxies=None, session=requests, refresh_retry=True):
    ok, data, msg = million_bet_index(cookie, proxies=proxies, session=session)
    if not ok:
        if refresh_retry and need_activity_refresh(data):
            return million_bet(activity_login_cookie(cookie, BET_PROJECT_ID, proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
        return False, msg
    info = data.get("data") or {}
    record = info.get("userTodayBetRecord")
    if isinstance(record, dict) and record:
        return True, f"今日已投注 {record.get('costCredits', '?')} 积分"
    left_credits = safe_int(info.get("userLeftCredits"))
    card_cost = safe_int(info.get("oneCarveUpCardNeedCredits"), 300)
    limit = safe_int(info.get("carveUpCardQuantityLimit"), 100)
    amount = million_bet_amount()
    if left_credits < amount:
        return True, f"积分不足，当前 {left_credits}，需要 {amount}"
    quantity = min(amount // card_cost, limit)
    if quantity <= 0:
        return True, "积分不足，跳过投注"
    ok, ready = request_json(
        session,
        "POST",
        BET_CLAIM_URL,
        cookie,
        proxies=proxies,
        referer=BET_REFERER,
        params={"_t": timestamp_ms()},
        data={"user_type": "1", "is_from_share": "1"},
    )
    if need_activity_refresh(ready):
        if refresh_retry:
            return million_bet(activity_login_cookie(cookie, BET_PROJECT_ID, proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
        return True, "活动登录失效，跳过投注防止扣积分"
    cost_credits = quantity * card_cost
    cost_params = {
        "toPlaywayId": "game",
        "toActionId": "bet",
        "desc": "bet_cost_credits_desc",
        "credits": str(cost_credits),
        "user_type": "1",
        "is_from_share": "1",
        "_t": timestamp_ms(),
    }
    ok, ticket_data = request_json(
        session,
        "GET",
        BET_COST_URL,
        cookie,
        proxies=proxies,
        referer=BET_REFERER,
        params=cost_params,
    )
    msg = response_message(ticket_data, "投注票据获取失败")
    if ticket_data.get("success") is not True:
        if "已投" in msg or "已下注" in msg or "已经投" in msg:
            return True, msg
        if refresh_retry and need_activity_refresh(ticket_data):
            return million_bet(activity_login_cookie(cookie, BET_PROJECT_ID, proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
        if need_activity_refresh(ticket_data):
            return True, activity_refresh_hint()
        return False, msg
    ticket = ticket_data.get("data") or ""
    if not ticket:
        return False, "投注票据为空"
    request_json(
        session,
        "GET",
        BET_QUERY_URL,
        cookie,
        proxies=proxies,
        referer=BET_REFERER,
        params={"ticketNum": ticket, "user_type": "1", "is_from_share": "1", "_t": timestamp_ms()},
    )
    bet_data = {
        "ticket": ticket,
        "oneCarveUpCardNeedCredits": str(card_cost),
        "quantity": str(quantity),
        "costCredits": str(cost_credits),
        "token": ORCHARD_TASK_TOKEN,
        "user_type": "1",
        "is_from_share": "1",
    }
    ok, result = request_json(
        session,
        "POST",
        BET_SUBMIT_URL,
        cookie,
        proxies=proxies,
        referer=BET_REFERER,
        params={"_t": timestamp_ms()},
        data=bet_data,
    )
    msg = response_message(result, "投注失败")
    if result.get("success") is True:
        return True, f"投注成功，消耗 {cost_credits} 积分，获得 {quantity} 张瓜分卡"
    if "已投" in msg or "已下注" in msg or "已经投" in msg or "无效凭证" in msg:
        return True, msg
    if refresh_retry and need_activity_refresh(result):
        return million_bet(activity_login_cookie(cookie, BET_PROJECT_ID, proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
    if need_activity_refresh(result):
        return True, activity_refresh_hint()
    return False, msg


def million_fixed_time_sign(cookie, proxies=None, session=requests, refresh_retry=True):
    ok, data = request_json(
        session,
        "GET",
        BET_TASK_URL,
        cookie,
        proxies=proxies,
        referer=BET_REFERER,
        params={"user_type": 0, "is_from_share": 1, "_t": timestamp_ms()},
    )
    msg = response_message(data, "定时打卡查询失败")
    if data.get("success") is not True:
        if refresh_retry and need_activity_refresh(data):
            return million_fixed_time_sign(activity_login_cookie(cookie, BET_PROJECT_ID, proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
        if need_activity_refresh(data):
            return True, activity_refresh_hint()
        return False, msg
    payload = data.get("data") or {}
    current = safe_int(payload.get("currentTimestamp")) or timestamp_ms()
    start = safe_int(payload.get("fixedTimeSignTaskStartTimestamp"))
    end = safe_int(payload.get("fixedTimeSignTaskEndTimestamp"))
    if safe_int(payload.get("fixedTimeSignTaskStatus")) == 1:
        return True, "当前时段已打卡"
    if start and end and not (start <= current <= end):
        return True, "当前不在打卡时间窗口"
    ok, result = request_json(
        session,
        "POST",
        BET_FIXED_SIGN_URL,
        cookie,
        proxies=proxies,
        referer=BET_REFERER,
        params={"_t": timestamp_ms()},
        data={"taskCode": "fixed_time_sign", "token": ORCHARD_TASK_TOKEN, "user_type": "0", "is_from_share": "1"},
    )
    msg = response_message(result, "定时打卡失败")
    if result.get("success") is True:
        reward = safe_int((result.get("data") or {}).get("reward"))
        return True, f"打卡成功，翻倍卡+{reward}" if reward else "打卡成功"
    if "今日尚未投注" in msg:
        return True, msg
    if refresh_retry and need_activity_refresh(result):
        return million_fixed_time_sign(activity_login_cookie(cookie, BET_PROJECT_ID, proxies=proxies, session=session), proxies=proxies, session=session, refresh_retry=False)
    if need_activity_refresh(result):
        return True, activity_refresh_hint()
    return False, msg


def default_task_defs():
    return [
        ("签到", sign),
        ("嫩青果园签到", orchard_sign),
        ("嫩青果园任务", orchard_tasks),
        ("收取青果", orchard_collect_green),
        ("嫩青果旅行", orchard_start_travel),
        ("投入能量", orchard_feed_energy),
        ("5.2秒挑战", challenge_52),
        ("13.14秒挑战", challenge_1314),
        ("藏宝图任务", treasure_tasks),
        ("藏宝图", treasure_map),
        ("藏宝图汇总", treasure_status),
        ("百万积分领取", million_claim),
        ("百万积分投注", million_bet),
        ("百万积分打卡", million_fixed_time_sign),
    ]


TASK_PROJECTS = {
    "签到": SIGN_PROJECT_ID,
    "嫩青果园签到": ORCHARD_PROJECT_ID,
    "嫩青果园任务": ORCHARD_PROJECT_ID,
    "收取青果": ORCHARD_PROJECT_ID,
    "嫩青果旅行": ORCHARD_PROJECT_ID,
    "投入能量": ORCHARD_PROJECT_ID,
    "5.2秒挑战": "pd13d36dd",
    "13.14秒挑战": "pd13d36dd",
    "藏宝图任务": "p20b473c4",
    "藏宝图": "p20b473c4",
    "藏宝图汇总": "p20b473c4",
    "百万积分领取": BET_PROJECT_ID,
    "百万积分投注": BET_PROJECT_ID,
    "百万积分打卡": BET_PROJECT_ID,
}


def account_summary(account, status, task_msgs):
    lines = [f"账号: {account}", f"状态: {status}"]
    for title, message in task_msgs:
        lines.append(f"{title}: {message}")
    return "\n".join(lines)


def build_notify_content(start_time, summaries):
    body = ("\n" + "-" * 28 + "\n").join(summaries)
    return "\n\n".join(item for item in [f"开始时间: {start_time}", body] if item).strip()


def send_notify(content):
    if PUSH_SWITCH == "0":
        print(f"[{now()}] [推送] 已关闭")
        return
    if not notify_send:
        print(f"[{now()}] [推送] 未找到 notify 模块")
        return
    try:
        notify_send(notify_title(), content)
        print(f"[{now()}] [推送] 已发送")
    except Exception as e:
        print(f"[{now()}] [推送] 发送失败: {e}")


def run():
    start_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    banner(f"{APP_NAME}自动签到 {VERSION}")
    print(f"开始时间: {start_time}")
    print(f"账号变量: {ENV_NAME}")
    print(f"动态代理: {'已配置' if PROXY_API_URL else '未配置'}")

    accounts = parse_env()
    account_sessions = {}
    code_proxy = {}
    if not accounts:
        print("未检测到 fang_kww，尝试使用本地 wxcode 刷新 CK")
        code_proxy = get_api_proxy()
        try:
            code_session = requests.Session()
            cookie = refresh_cookie_by_code(proxies=code_proxy, session=code_session)
            remark = os.getenv("KWW_REMARK", "wxcode").strip() or "wxcode"
            accounts = [(remark, cookie, "")]
            account_sessions[remark] = code_session
            print("wxcode 刷新 CK 成功")
        except Exception as e:
            print(f"wxcode 刷新 CK 失败: {e}")
            return

    print(f"账号数量: {len(accounts)}")
    summaries = []
    for idx, (name, cookie, fixed_proxy) in enumerate(accounts, 1):
        banner(f"账号 {idx}/{len(accounts)}")
        proxies = build_proxy(fixed_proxy) or code_proxy or get_api_proxy()
        task_session = account_sessions.get(name) or requests.Session()
        account = display_name_from_cookie(name, cookie) or f"账号 {idx}"
        task_msgs = []
        task_ok = []
        current_project = ""
        for title, func in default_task_defs():
            project_id = TASK_PROJECTS.get(title, "")
            if project_id and project_id != current_project:
                cookie = activity_login_cookie(cookie, project_id, proxies=proxies, session=task_session)
                current_project = project_id
            print(f"[{now()}] [{account}] {title}开始")
            try:
                ok, msg = func(cookie, proxies=proxies, session=task_session)
                task_ok.append(ok)
                task_msgs.append((title, msg))
                print(f"[{now()}] [{account}] {title}结果: {msg}")
            except Exception as e:
                task_ok.append(False)
                task_msgs.append((title, f"异常: {e}"))
                print(f"[{now()}] [{account}] {title}异常: {e}")
        status = "执行完成" if all(task_ok) else "执行失败"
        summaries.append(account_summary(account, status, task_msgs))

    banner("执行汇总")
    for idx, summary in enumerate(summaries, 1):
        print(summary)
        if idx < len(summaries):
            print("-" * 28)
    send_notify(build_notify_content(start_time, summaries))


if __name__ == "__main__":
    run()

''',
    'jhhhh': r'''

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
巨惠好花红自动任务 v1.0.0

功能：自动执行巨惠好花红每日任务

更新说明:
### 2026.05.02
v1.0.0:
- 增加青龙 notify 推送和统一摘要排版
- 接入本地 code 模块，使用 code 直接登录

配置说明:
1. code 模块设置:
    - `JH_APP_ID`：默认 `wxcfe48e0e0f3e647c`
    - `JH_CODE_URL`：默认 `http://127.0.0.1:8088/login?appId={appId}`
    - 返回值需包含 `code` 字段


3. 其他配置:
    - `JH_REMARK`：账号备注，默认 wxcode
    - `JH_DELAY`：任务间隔秒数
    - `JH_TIMEOUT`：请求超时秒数
    - `JH_PUSH=0`：关闭青龙 notify 推送

定时规则建议 (Cron):
# 早中晚各执行一轮，兼顾签到、失败补跑和晚间收尾
10 8 * * *

From: YaoHuo8648
Email: zheyizzf@188.com
Update: 2026.05.02
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.parse
from dataclasses import dataclass
from typing import Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    from notify import send as notify_send
except Exception:
    notify_send = None


def env_float(key: str, default: str) -> float:
    try:
        return float((os.getenv(key) or default).strip())
    except Exception:
        return float(default)


APPID = (os.getenv("JH_APP_ID") or "wxcfe48e0e0f3e647c").strip()
API_BASE = (os.getenv("JH_API_BASE") or "https://wlshj.longdingbigdata.com/api/").strip().rstrip("/") + "/"
CODE_URL = (os.getenv("JH_CODE_URL") or "http://127.0.0.1:8088/login?appId={appId}").strip()
PUSH_SWITCH = (os.getenv("JH_PUSH") or "1").strip()
TIMEOUT = env_float("JH_TIMEOUT", "15")
DELAY = env_float("JH_DELAY", "1")

HEADERS = {
    "Content-Type": "application/json",
    "X-Source": "9ed24b559c4b4c3c",
    "Form-type": "routine",
}


@dataclass
class Account:
    name: str
    token: str


def log(message: str) -> None:
    print(message, flush=True)


def mask_token(token: str, prefix: int = 8, suffix: int = 6) -> str:
    value = (token or "").strip()
    if len(value) <= prefix + suffix:
        return value
    return f"{value[:prefix]}...{value[-suffix:]}"


def mask_uid(uid: str) -> str:
    value = str(uid or "").strip()
    if not value:
        return "未知"
    if len(value) <= 2:
        return "*" * len(value)
    if len(value) <= 6:
        return f"{value[0]}{'*' * (len(value) - 2)}{value[-1]}"
    return f"{value[:3]}***{value[-3:]}"


def summarize_response(data: object) -> str:
    if not isinstance(data, dict):
        return "无响应数据"
    parts = []
    for key in ("status", "code", "msg", "message"):
        value = data.get(key)
        if value not in (None, ""):
            parts.append(f"{key}={value}")
    return " | ".join(parts) or "响应中无关键字段"


def clean_token(value: str) -> str:
    return re.sub(r"(?i)^bearer\s+", "", (value or "").strip())



def extract_code(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    status = payload.get("status")
    err = payload.get("err")
    if status not in (None, "", True, 1, "1", 200, "200", "ok", "OK", "success", "SUCCESS"):
        return ""
    if err not in (None, "", 0, "0"):
        return ""
    containers = [payload]
    for key in ("data", "Data", "result"):
        if isinstance(payload.get(key), dict):
            containers.append(payload[key])
    for item in containers:
        code = str(item.get("code") or item.get("Code") or "").strip()
        if code:
            return code
    return ""





def is_ok(data: object) -> bool:
    return isinstance(data, dict) and str(data.get("status")) in ("200", "0", "true", "True")


class JuhuiClient:
    def __init__(self, account: Account, index: int):
        self.account = account
        self.index = index
        self.token = account.token
        self.display_name = account.name or f"账号{index}"
        self.session = self.create_session()
        self.profile: Dict = {}

    def create_session(self) -> requests.Session:
        session = requests.Session()
        retry = Retry(total=2, connect=2, read=2, backoff_factor=0.4, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=None)
        adapter = HTTPAdapter(max_retries=retry, pool_connections=4, pool_maxsize=4)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.headers.update({"User-Agent": "Mozilla/5.0 MicroMessenger MiniProgram", "Accept": "application/json, text/plain, */*"})
        return session


    def log(self, message: str) -> None:
        log(f"[{self.display_name}] {message}")

    def log_block(self, title: str, lines: List[str]) -> None:
        if not lines:
            return
        self.log(f"【{title}】")
        for line in lines:
            self.log(f"  {line}")

    def request(self, method: str, path: str, token: str = "", data: Optional[Dict] = None) -> Optional[Dict]:
        url = path if path.startswith("http") else f"{API_BASE}{path.lstrip('/')}"
        headers = dict(HEADERS)
        if token:
            headers["X-Token"] = f"Bearer {clean_token(token)}"
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, params=data or None, timeout=TIMEOUT)
            else:
                response = self.session.post(url, headers=headers, json=data or {}, timeout=TIMEOUT)
            return response.json()
        except Exception as exc:
            self.log(f"请求失败: {path} | {exc}")
            return None

    def fetch_code(self) -> str:
        url = CODE_URL.format(appId=APPID, appid=APPID)
        try:
            response = self.session.get(url, timeout=10)
            payload = response.json()
        except Exception as exc:
            self.log(f"获取 code 失败: {exc}")
            return ""
        code = extract_code(payload)
        if code:
            self.log(f"获取 code 成功: {mask_token(code, 10, 6)}")
        else:
            self.log(f"获取 code 失败: {summarize_response(payload)}")
        return code

    def login_with_code(self, code: str) -> Optional[Dict]:
        self.request("POST", "auth/mp_login_type", data={"code": code, "spread": ""})
        auth_data = {
            "auth": {
                "type": "routine",
                "auth": {
                    "code": code,
                    "nickName": self.account.name or "user",
                    "avatarUrl": "",
                    "gender": 0,
                    "language": "zh_CN",
                    "country": "China",
                    "spread": "",
                    "spread_code": "",
                },
            }
        }
        data = self.request("POST", "auth", data=auth_data)
        result = ((data or {}).get("data") or {}).get("result") or {}
        token = str(result.get("token") or "").strip()
        if not token:
            self.log(f"code 登录失败: {summarize_response(data)}")
            return None
        return {"token": token, "user": result.get("user") or {}}

    def load_profile_by_token(self, token: str, silent: bool = False) -> Optional[Dict]:
        data = self.request("GET", "user", token)
        if not is_ok(data) or not isinstance((data or {}).get("data"), dict):
            if not silent:
                self.log(f"读取账号信息失败: {summarize_response(data)}")
            return None
        return data["data"]

    def apply_profile_name(self, profile: Dict) -> None:
        nickname = str(profile.get("nickname") or profile.get("nickName") or profile.get("name") or "").strip()
        uid = str(profile.get("uid") or profile.get("id") or "").strip()
        self.display_name = self.account.name or nickname or mask_uid(uid) or f"账号{self.index}"

    def login_by_code(self) -> bool:
        code = self.fetch_code()
        if not code:
            return False
        login_data = self.login_with_code(code)
        if not login_data:
            return False
        self.token = login_data["token"]
        self.profile = login_data["user"]
        self.apply_profile_name(self.profile)
        self.log(f"code 登录成功: {mask_token(self.token)}")
        return True

    def load_profile(self) -> Optional[Dict]:
        profile = self.load_profile_by_token(self.token)
        if not profile:
            return None
        self.profile = profile
        self.apply_profile_name(profile)
        uid = str(profile.get("uid") or "").strip()
        self.log(f"账号信息: uid={mask_uid(uid)}")
        return profile

    def sign(self) -> Dict:
        data = self.request("GET", "user/sign/info", self.token)
        if not is_ok(data):
            self.log(f"获取签到信息失败: {summarize_response(data)}")
            return {"result": "获取签到信息失败", "points": 0, "assets": {}, "ok": False}
        payload = data.get("data") or {}
        user_info = payload.get("userInfo") or {}
        assets = {
            "streak": payload.get("sign_num"),
            "total": payload.get("count"),
            "integral": user_info.get("integral", 0),
            "money": user_info.get("now_money", "0.00"),
            "pea": user_info.get("flower_pea", "0.00"),
        }
        self.log(f"连续签到: {assets['streak']}天 | 累计: {assets['total']}次 | 积分: {assets['integral']} | 余额: {assets['money']}元 | 花豆: {assets['pea']}")
        if payload.get("is_sign"):
            self.log("今日已签到")
            return {"result": "今日已签到", "points": 0, "assets": assets, "ok": True}
        result = self.request("POST", "user/sign/create", self.token)
        if is_ok(result):
            points = ((result.get("data") or {}).get("integral") or 0)
            self.log(f"签到成功: +{points}积分")
            return {"result": f"签到成功 +{points}积分", "points": points, "assets": assets, "ok": True}
        self.log(f"签到失败: {summarize_response(result)}")
        return {"result": "签到失败", "points": 0, "assets": assets, "ok": False}

    def product_payload_to_list(self, payload: object) -> List[Dict]:
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
        if isinstance(payload, dict):
            if isinstance(payload.get("list"), list):
                return [item for item in payload["list"] if isinstance(item, dict)]
            if payload.get("res_type"):
                return [payload]
        return []

    def get_products(self) -> List[Dict]:
        result = self.request("POST", "user/ad/product/list", self.token)
        products = self.product_payload_to_list((result or {}).get("data")) if is_ok(result) else []
        if products:
            return products
        fallback = []
        for res_type in (1000, 1001, 1002):
            item = self.request("POST", f"user/ad/product/{res_type}", self.token)
            if is_ok(item):
                fallback.extend(self.product_payload_to_list((item or {}).get("data")))
        return fallback

    def punch_products(self) -> List[str]:
        lines = []
        products = self.get_products()
        if not products:
            self.log("未获取到产品打卡列表")
            return ["未获取到产品打卡列表"]
        for product in products:
            res_type = product.get("res_type")
            title = str(product.get("title") or res_type or "未知产品")
            sign_day = product.get("sign_day") or 365
            if not res_type:
                continue
            detail = self.request("POST", f"user/ad/product/{res_type}", self.token)
            if not is_ok(detail):
                if isinstance(detail, dict) and str(detail.get("status")) == "400":
                    finish = self.request("POST", "user/ad/finish", self.token, {"res_type": res_type})
                    line = f"{title}: 已参与并打卡" if is_ok(finish) else f"{title}: 报名失败"
                else:
                    line = f"{title}: 查询失败"
                self.log(line)
                lines.append(line)
                continue
            payload = detail.get("data") or {}
            if isinstance(payload, list):
                payload = payload[0] if payload and isinstance(payload[0], dict) else {}
            period = payload.get("period") or []
            signed_count = sum(1 for item in period if isinstance(item, dict) and item.get("sign") == 1)
            today = time.strftime("%Y-%m-%d")
            already = any(isinstance(item, dict) and item.get("date") == today and item.get("sign") == 1 for item in period)
            if already:
                line = f"{title}: 已打卡 ({signed_count}/{sign_day}天)"
            else:
                finish = self.request("POST", "user/ad/finish", self.token, {"res_type": res_type})
                line = f"{title}: 打卡成功 ({signed_count + 1}/{sign_day}天)" if is_ok(finish) else f"{title}: 打卡失败"
            self.log(line)
            lines.append(line)
            time.sleep(max(DELAY, 0.2))
        return lines

    def build_report(self, sign_report: Dict, product_lines: List[str]) -> Dict:
        assets = sign_report.get("assets") or {}
        return {
            "name": self.display_name,
            "sign": sign_report.get("result") or "未知",
            "sign_points": sign_report.get("points") or 0,
            "integral": assets.get("integral", "-"),
            "money": assets.get("money", "-"),
            "pea": assets.get("pea", "-"),
            "products": product_lines,
        }

    def run(self) -> Optional[Dict]:
        self.log("开始 code 登录")
        if not self.login_by_code():
            self.log("登录失败，跳过当前账号")
            return None
        self.load_profile()
        sign_report = self.sign()
        time.sleep(max(DELAY, 0.2))
        product_lines = self.punch_products()
        report = self.build_report(sign_report, product_lines)
        self.log_block("本轮摘要", render_account_summary(report))
        self.log("账号执行结束")
        return report


def render_account_summary(report: Dict) -> List[str]:
    lines = [
        f"账号: {report['name']}",
        f"签到: {report['sign']}",
        f"资产: 积分 {report['integral']} | 余额 {report['money']}元 | 花豆 {report['pea']}",
    ]
    lines.extend(f"产品: {line}" for line in report.get("products") or [])
    return lines


def build_push_lines(reports: List[Dict], success: int, total: int, elapsed: int) -> List[str]:
    lines = ["━" * 18]
    for report in reports:
        lines.extend(render_account_summary(report))
        lines.append("─" * 18)
    lines.append(f"完成: {success}/{total}")
    lines.append(f"耗时: {elapsed} 秒")
    return lines


def send_notify(reports: List[Dict], success: int, total: int, elapsed: int) -> None:
    if PUSH_SWITCH != "1" or not notify_send or not reports:
        return
    try:
        notify_send("巨惠好花红自动任务 v1.0.0", "\n".join(build_push_lines(reports, success, total, elapsed)))
    except Exception as exc:
        log(f"警告: 推送失败: {exc}")


def main() -> int:
    start_ts = time.time()
    log("=" * 60)
    log("巨惠好花红自动任务 v1.0.0")
    log("=" * 60)
    log("登录方式: 本地 wxcode")
    remark = (os.getenv("JH_REMARK") or "wxcode").strip() or "wxcode"
    accounts = [Account(remark, "")]
    reports = []
    success = 0
    for index, account in enumerate(accounts, 1):
        log("")
        log("=" * 40)
        log(f"账号 {index}/{len(accounts)}")
        log("=" * 40)
        try:
            report = JuhuiClient(account, index).run()
        except Exception as exc:
            log(f"[账号{index}] 异常: {exc}")
            report = None
        if report:
            reports.append(report)
            success += 1
        time.sleep(max(DELAY, 0))
    elapsed = int(time.time() - start_ts)
    log("=" * 60)
    log(f"执行完成: {success}/{len(accounts)}")
    log(f"耗时: {elapsed} 秒")
    send_notify(reports, success, len(accounts), elapsed)
    return 0 if success == len(accounts) else 1


if __name__ == "__main__":
    sys.exit(main())
''',
    'dtsh': r'''
import os
import json
import random
import time

import requests

SCRIPT_VERSION = "v1.0.0"
APP_ID = os.getenv("DT_APPID", "wx51a2021dd921f747").strip()
CODE_URL = os.getenv("DT_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
PLUSPLUS_TOKEN = os.getenv("PLUSPLUS_TOKEN", "").strip()
LOGIN_URL = "https://ebeikeapi.ebeck.cn/api/user/userLogin"
SIGN_URL = "https://ebeikeapi.ebeck.cn/api/user/userSign"
TOTAL_POINTS_URL = "https://ebeikeapi.ebeck.cn/api/user/userPointsGoldInfo"
USER_AGENT_LIST = [
    "Mozilla/5.0 (Linux; Android 14; 2512BPNDAC Build/UKQ1.230917.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.153 Mobile Safari/537.36 XWEB/1460043 MMWEBSDK/20251006 MMWEBID/2089 MicroMessenger/8.0.66.2980(0x28004234) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android",
    "Mozilla/5.0 (Linux; Android 13; Redmi K60 Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 XWEB/1300003 MMWEBSDK/20250901 MiniProgramEnv/android",
    "Mozilla/5.0 (Linux; Android 12; MI 11 Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.111 Mobile Safari/537.36 XWEB/1250002 MMWEBSDK/20250801 MiniProgramEnv/android",
]
HEADERS = {"Content-Type": "application/json", "charset": "utf-8", "User-Agent": random.choice(USER_AGENT_LIST)}


def wxcode_url():
    return CODE_URL.format(appId=APP_ID, appid=APP_ID)


def get_wx_code():
    try:
        data = requests.get(wxcode_url(), timeout=10).json()
        code = data.get("code")
        if not code and isinstance(data.get("data"), dict):
            code = data["data"].get("code")
        if code:
            print("获取 code 成功")
            return code
    except Exception as exc:
        print(f"获取 code 失败: {exc}")
    return ""


def refresh_token():
    code = get_wx_code()
    if not code:
        return ""
    try:
        data = requests.post(LOGIN_URL, json={"code": code, "appId": APP_ID, "client": "wxmp"}, headers=HEADERS, timeout=15).json()
        token = data.get("data", {}).get("token", "")
        if token:
            print("Token 获取成功")
            return token
    except Exception as exc:
        print(f"Token 获取失败: {exc}")
    return ""


def get_user_info(token):
    try:
        data = requests.post(TOTAL_POINTS_URL, json={"version": "251", "client": "wxmp", "token": token}, headers=HEADERS, timeout=15).json().get("data", {})
        nickname = data.get("nickname") or data.get("name") or data.get("userName") or "未知用户"
        uid = data.get("mobile") or data.get("uid") or "未知UID"
        points = data.get("points", 0)
        return nickname, uid, points
    except Exception:
        return "未知用户", "未知UID", 0


def push_plusplus(title, content):
    if not PLUSPLUS_TOKEN:
        return
    try:
        requests.post("https://www.pushplus.plus/send", json={"token": PLUSPLUS_TOKEN, "title": title, "content": content}, timeout=10)
    except Exception:
        pass


def main():
    print("\n=======================================================")
    print("开始执行 DT生活签到")
    print("=======================================================")
    token = refresh_token()
    if not token:
        return 1
    delay = random.uniform(3, 8)
    print(f"签到延迟：{delay:.1f}秒")
    time.sleep(delay)
    try:
        data = requests.post(SIGN_URL, json={"version": "251", "client": "wxmp", "token": token}, headers=HEADERS, timeout=15).json()
        sign_msg = data.get("msg", "完成")
        get_points = data.get("data", {}).get("points", 0)
        sign_num = data.get("data", {}).get("sign_num", 0)
        nickname, uid, total_points = get_user_info(token)
        print(f"账户昵称：{nickname}")
        print(f"账号UID：{uid}")
        print(f"签到结果：{sign_msg}")
        print(f"累计签到：{sign_num} 次")
        print(f"本次获得：{get_points} 积分")
        print(f"账户总积分：{total_points} 分")
        push_content = f"昵称：{nickname}\nUID：{uid}\n签到结果：{sign_msg}\n累计签到：{sign_num}次\n本次获得：{get_points}积分\n总积分：{total_points}分"
        push_plusplus("DT生活签到结果", push_content)
        return 0
    except Exception as exc:
        print(f"DT生活签到异常: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
''',
    'sanfu': r'''
import asyncio
import os
import random

import requests

SCRIPT_VERSION = "v1.0.0"
PLUSPLUS_TOKEN = os.getenv("PLUSPLUS_TOKEN", "").strip()
SERVERS = [item.strip() for item in os.getenv("SANFU_CODE_SERVERS", "127.0.0.1:8088").split(",") if item.strip()]
APPID = os.getenv("SANFU_APPID", "wxfe13a2a5df88b058").strip()
BASE_URL = "https://crm.sanfu.com"
USER_AGENT_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781 NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF",
    "Mozilla/5.0 (Linux; Android 14; 2512BPNDAC Build/UKQ1.230917.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.153 Mobile Safari/537.36 XWEB/1460043 MMWEBSDK/20251006 MiniProgramEnv/android",
    "Mozilla/5.0 (Linux; Android 13; Redmi K60 Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 XWEB/1300003 MMWEBSDK/20250901 MiniProgramEnv/android",
]


async def sleep(ms):
    await asyncio.sleep(ms / 1000)


def random_int(min_val, max_val):
    return random.randint(min_val, max_val)


def get_ua():
    return random.choice(USER_AGENT_LIST)


def send_plusplus_notification(title, content):
    if not PLUSPLUS_TOKEN:
        return
    try:
        requests.post("https://www.pushplus.plus/send", json={"token": PLUSPLUS_TOKEN, "title": title, "content": content, "template": "txt"}, timeout=10)
        print("通知推送成功")
    except Exception as exc:
        print(f"通知推送失败：{exc}")


def get_code(server):
    request_url = f"http://{server}/login"
    print(f"[{server}] 请求登录服务：{request_url}")
    try:
        data = requests.get(request_url, params={"appId": APPID}, timeout=20).json()
        code = data.get("code")
        if not code and isinstance(data.get("data"), dict):
            code = data["data"].get("code")
        if data.get("err") not in (None, 0, "0") or not code:
            message = data.get("msg") or data.get("message") or str(data)[:120]
            print(f"[{server}] 返回异常：{message}")
            return ""
        print(f"[{server}] 获取 code 成功")
        return str(code)
    except Exception as exc:
        print(f"[{server}] 请求异常: {str(exc)[:60]}")
        return ""


def wx_login(js_code, ua, server):
    headers = {"Host": "crm.sanfu.com", "Content-Type": "application/json", "User-Agent": ua, "xweb_xhr": "1", "Referer": f"https://servicewechat.com/{APPID}/385/page-frame.html", "Accept": "*/*"}
    payload = {"code": js_code, "appid": APPID, "shoId": "", "userId": "", "sourceWxsceneid": 1027, "sourceUrl": "pages/ucenter_index/ucenter_index"}
    try:
        response = requests.post(f"{BASE_URL}/ms-sanfu-wechat-customer-core/customer/core/wxMiniAppLogin", json=payload, headers=headers, timeout=20)
        return response.json()
    except Exception as exc:
        print(f"[{server}] 登录异常: {str(exc)[:60]}")
        return None


def common_request(url, method="GET", body=None, sid="", ua="", server=""):
    headers = {"Host": "crm.sanfu.com", "Content-Type": "application/json", "User-Agent": ua, "Referer": f"https://servicewechat.com/{APPID}/385/page-frame.html"}
    req_url = f"{BASE_URL}{url}"
    body = dict(body or {})
    body["sid"] = sid
    try:
        if method.upper() == "POST":
            response = requests.post(req_url, json=body, headers=headers, timeout=20)
        else:
            response = requests.get(req_url, params=body, headers=headers, timeout=20)
        return response.json()
    except Exception as exc:
        print(f"[{server}] 请求异常: {str(exc)[:60]}")
        return None


async def run_account(server):
    result = {"server": server, "success": False, "signMsg": "", "scoreMsg": "", "error": ""}
    print(f"\n===== 三福 - {server} 账号 =====")
    ua = get_ua()
    try:
        start_delay = random_int(2000, 6000)
        print(f"[{server}] 启动延迟 {start_delay / 1000}s")
        await sleep(start_delay)
        code = get_code(server)
        if not code:
            result["error"] = "获取 code 失败"
            return result
        login_data = wx_login(code, ua, server)
        if not login_data or login_data.get("code") != 200:
            result["error"] = login_data.get("msg", "登录失败") if login_data else "登录无响应"
            print(f"[{server}] 登录失败：{result['error']}")
            return result
        sid = login_data["data"].get("sid", "")
        if not sid:
            result["error"] = "未获取到 sid"
            return result
        print(f"[{server}] 登录成功获取 sid")
        await sleep(random_int(3000, 8000))
        sign_data = common_request("/ms-sanfu-wechat-common/customer/onSign", method="POST", body={"signWay": 0}, sid=sid, ua=ua, server=server)
        if sign_data and sign_data.get("code") == 200:
            fubi = sign_data["data"].get("fubi", 0)
            keep_day = sign_data["data"].get("onKeepSignDay", 0)
            result["signMsg"] = f"签到成功！连续签到{keep_day}天，获得{fubi}福币"
            print(f"[{server}] {result['signMsg']}")
        else:
            msg = sign_data.get("msg", "未知错误") if sign_data else "接口无响应"
            result["signMsg"] = f"已签到：{msg}" if "签到过" in msg or "已签到" in msg else f"签到失败：{msg}"
            print(f"[{server}] {result['signMsg']}")
        await sleep(random_int(2000, 5000))
        info_data = common_request("/ms-sanfu-wechat-customer/customer/index/baseInfo", method="GET", body={}, sid=sid, ua=ua, server=server)
        if info_data and info_data.get("code") == 200:
            cur_fubi = info_data["data"].get("fubi", 0)
            result["scoreMsg"] = f"当前账号总福币：{cur_fubi}个"
            print(f"[{server}] {result['scoreMsg']}")
        result["success"] = True
    except Exception as exc:
        result["error"] = str(exc)
        print(f"[{server}] 执行异常：{str(exc)[:60]}")
    return result


async def async_main():
    print("===== 三福动态 code 签到 =====\n")
    results = []
    for server in SERVERS:
        results.append(await run_account(server))
        await sleep(2000)
    notify_content = "### 三福任务执行结果\n"
    for item in results:
        notify_content += f"\n#### {item['server']}\n"
        notify_content += f"- 执行状态：{'成功' if item['success'] else '失败'}\n"
        if item["success"]:
            notify_content += f"- 签到结果：{item['signMsg']}\n- 福币信息：{item['scoreMsg']}\n"
        else:
            notify_content += f"- 失败原因：{item['error']}\n"
    send_plusplus_notification("三福任务完成", notify_content)
    print("\n===== 所有账号执行完成 =====")
    return 0 if any(item["success"] for item in results) else 1


def main():
    return asyncio.run(async_main())


if __name__ == "__main__":
    raise SystemExit(main())
''',
    'kkkl': r'''
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
可口可乐签到 v1.0.0

功能：每天有乐 + 可口可乐吧小程序自动 code 登录、签到、积分查询
支持本地 wxcode 获取 code，不再读取旧 token 账号变量

更新说明:
### 2026.05.12
v1.0.0:
- 改为 wxcode 本地获取 code 登录
- 删除旧 token 账号入口
- 保留每天有乐、可口可乐吧签到和积分查询
- 每天有乐和可口可乐吧独立容错，单边登录失败时跳过对应子任务
- 按抓包修正每天有乐 userLoginByCode 登录和可口可乐吧 jwtString 授权

配置说明:
1. code 登录:
    - KKKL_CODE_URL: wxcode 本地登录地址，默认 http://127.0.0.1:8088/login?appId={appId}
    - MTYL_APPID: 每天有乐 AppID，默认 wxd84920ac8965ee21
    - KKKL_APPID: 可口可乐吧 AppID，默认 wxa5811e0426a94686
    - MTYL_LOGIN_URL: 每天有乐 code 换 token 接口
    - KKKL_LOGIN_URL: 可口可乐吧 code 换 token 接口

2. 运行参数:
    - sign: 签到，默认模式
    - query: 查询账号与积分

3. 推送设置:
    - KKKL_PUSH: 推送开关，1 开启，0 关闭

定时规则建议 (Cron):
20 8 * * *

From: YaoHuo8648
Email: zheyizzf@188.com
Update: 2026.05.12
"""

from __future__ import annotations

import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Tuple

import requests

SCRIPT_VERSION = "v1.0.0"
PUSH_SWITCH = os.getenv("KKKL_PUSH", "1").strip()
CODE_URL = os.getenv("KKKL_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
MTYL_APPID = os.getenv("MTYL_APPID", "wxd84920ac8965ee21").strip()
KKKL_APPID = os.getenv("KKKL_APPID", "wxa5811e0426a94686").strip()
MTYL_LOGIN_URL = os.getenv("MTYL_LOGIN_URL", "https://bcportal.app.swirecocacola.com/portal-gateway-prod/portal-applets/wechat/userLoginByCode").strip()
KKKL_LOGIN_URL = os.getenv("KKKL_LOGIN_URL", "https://member-api.icoke.cn/api/sp-portal/store/icoke/wechat/loginNoCache/{code}").strip()
REQUEST_TIMEOUT = float(os.getenv("KKKL_TIMEOUT", "20"))

try:
    from notify import send as notify_send
except ImportError:
    notify_send = None


def log(message: str, tag: str = "") -> None:
    prefix = f"[{datetime.now().strftime('%H:%M:%S')}]"
    if tag:
        prefix += f"[{tag}]"
    print(f"{prefix} {message}", flush=True)


def mask_phone(phone: str) -> str:
    text = str(phone)
    return f"{text[:3]}****{text[-4:]}" if len(text) >= 7 else text


def find_value(data: Any, keys: Tuple[str, ...]) -> str:
    if isinstance(data, dict):
        for key in keys:
            value = data.get(key)
            if value not in (None, ""):
                return str(value)
        for value in data.values():
            found = find_value(value, keys)
            if found:
                return found
    if isinstance(data, list):
        for item in data:
            found = find_value(item, keys)
            if found:
                return found
    return ""


def response_message(data: Any) -> str:
    return find_value(data, ("message", "msg", "errmsg", "errMsg")) or str(data)[:120]


def happy_bottle_text(data: Any) -> str:
    amount = find_value(data, ("point", "points", "reward", "rewardPoint", "rewardPoints"))
    return f"{amount} 快乐瓶" if amount else "快乐瓶"


def fetch_code(appid: str) -> str:
    url = CODE_URL.format(appId=appid, appid=appid)
    data = requests.get(url, timeout=REQUEST_TIMEOUT).json()
    code = find_value(data, ("code",))
    if not code:
        raise RuntimeError(f"获取 code 失败: {response_message(data)}")
    return code


def login_mtyl(code: str) -> Dict[str, str]:
    url = MTYL_LOGIN_URL.format(code=code, appId=MTYL_APPID, appid=MTYL_APPID)
    data = requests.post(url, json={"code": code, "sync": 1}, timeout=REQUEST_TIMEOUT).json()
    token = find_value(data, ("token", "Token", "accessToken", "access_token"))
    if not token:
        raise RuntimeError(f"每天有乐登录失败: {response_message(data)}")
    openid = find_value(data, ("koOpenid", "openId", "openid"))
    return {"token": token, "openid": openid}


def login_kkkl(code: str) -> str:
    url = KKKL_LOGIN_URL.format(code=code)
    data = requests.get(url, timeout=REQUEST_TIMEOUT).json()
    token = find_value(data, ("jwtString", "authorization", "Authorization", "token", "accessToken"))
    if not token:
        raise RuntimeError(f"可口可乐吧登录失败: {response_message(data)}")
    return token


def make_account() -> Dict[str, str]:
    name = os.getenv("KKKL_REMARK", "wxcode").strip() or "wxcode"
    account = {"name": name, "mtyl_token": "", "mtyl_openid": "", "kkkl_token": "", "mtyl_error": "", "kkkl_error": ""}
    try:
        mtyl_login = login_mtyl(fetch_code(MTYL_APPID))
        if isinstance(mtyl_login, dict):
            account["mtyl_token"] = mtyl_login.get("token", "")
            account["mtyl_openid"] = mtyl_login.get("openid", "")
        else:
            account["mtyl_token"] = str(mtyl_login)
        if not account["mtyl_token"]:
            raise RuntimeError("每天有乐登录结果缺少 token")
    except Exception as exc:
        account["mtyl_error"] = str(exc)
        log(f"[每天有乐]登录失败，跳过: {exc}", name)
    try:
        account["kkkl_token"] = login_kkkl(fetch_code(KKKL_APPID))
        if not account["kkkl_token"]:
            raise RuntimeError("可口可乐吧登录结果缺少 token")
    except Exception as exc:
        account["kkkl_error"] = str(exc)
        log(f"[可口可乐吧]登录失败，跳过: {exc}", name)
    if not account["mtyl_token"] and not account["kkkl_token"]:
        detail = "；".join(item for item in (account["mtyl_error"], account["kkkl_error"]) if item)
        raise RuntimeError(f"可口可乐登录失败: {detail}" if detail else "可口可乐登录失败")
    return account


MTYL_HEADERS_BASE = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Content-Type": "application/json",
    "Env-Version": "release",
    "Referer": f"https://servicewechat.com/{MTYL_APPID}/338/page-frame.html",
    "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/android",
    "X-Requested-With": "XMLHttpRequest",
    "Xweb_Xhr": "1",
}

KKKL_HEADERS_BASE = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Charset": "utf-8",
    "Referer": f"https://servicewechat.com/{KKKL_APPID}/501/page-frame.html",
    "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/android",
}


def mtyl_info(token: str, tag: str) -> Tuple[bool, str, str]:
    headers = {**MTYL_HEADERS_BASE, "Token": token}
    url = "https://bcportal.app.swirecocacola.com/portal-gateway-prod/portal-applets/applets/getMember"
    try:
        data = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT).json()
        phone = find_value(data, ("phone", "mobile"))
        if not phone:
            raise RuntimeError(response_message(data))
        log(f"[每天有乐]登录成功|账号>>> {mask_phone(phone)}", tag)
        return True, phone, ""
    except Exception as exc:
        log(f"[每天有乐]获取账号信息失败|{exc}", tag)
        return False, "", str(exc)


def mtyl_sign(token: str, openid: str, tag: str) -> str:
    headers = {**MTYL_HEADERS_BASE, "Token": token}
    params = {"koOpenid": openid} if openid else {}
    url = "https://bcportal.app.swirecocacola.com/portal-gateway-prod/portal-applets/applets/sign"
    try:
        data = requests.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT).json()
        message = response_message(data)
        if message == "操作成功":
            message = f"签到成功-获得 {happy_bottle_text(data)}"
        return f"[每天有乐][{tag}]|{message}"
    except Exception as exc:
        return f"[每天有乐][{tag}]签到失败|{exc}"


def kkkl_info(token: str, tag: str) -> Tuple[bool, str, str]:
    headers = {**KKKL_HEADERS_BASE, "Authorization": token}
    url = "https://member-api.icoke.cn/api/icoke-customer/icoke/mini/customer/main/base/info"
    try:
        data = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT).json()
        mobile = find_value(data, ("mobile", "phone"))
        if not mobile:
            raise RuntimeError(response_message(data))
        log(f"[可口可乐吧]登录成功|账号>>> {mask_phone(mobile)}", tag)
        return True, mobile, ""
    except Exception as exc:
        log(f"[可口可乐吧]获取账号信息失败|{exc}", tag)
        return False, "", str(exc)


def kkkl_sign(token: str, tag: str) -> str:
    headers = {**KKKL_HEADERS_BASE, "Authorization": token}
    url = "https://member-api.icoke.cn/api/icoke-sign/icoke/mini/sign/main/sign"
    try:
        data = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT).json()
        if data.get("isSuccess") or data.get("success") is True:
            return f"[可口可乐吧][{tag}]|签到成功-获得 {happy_bottle_text(data)}"
        return f"[可口可乐吧][{tag}]|{response_message(data)}"
    except Exception as exc:
        return f"[可口可乐吧][{tag}]签到失败|{exc}"


def kkkl_query_points(token: str, tag: str) -> str:
    headers = {**KKKL_HEADERS_BASE, "Authorization": token}
    url = "https://member-api.icoke.cn/api/icoke-customer/icoke/mini/customer/main/points"
    try:
        data = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT).json()
        return str(data.get("point", find_value(data, ("point", "points")) or "未知"))
    except Exception as exc:
        return f"查询失败|{exc}"


def process_account(account: Dict[str, str]) -> Dict[str, Any]:
    name = account["name"]
    log("开始执行签到任务", name)
    messages = []
    if account.get("mtyl_token"):
        messages.append(mtyl_sign(account["mtyl_token"], account.get("mtyl_openid", ""), name))
    else:
        messages.append(f"[每天有乐][{name}]|跳过: {account.get('mtyl_error') or '未获取到 token'}")
    if account.get("kkkl_token"):
        messages.append(kkkl_sign(account["kkkl_token"], name))
    else:
        messages.append(f"[可口可乐吧][{name}]|跳过: {account.get('kkkl_error') or '未获取到 token'}")
    for message in messages:
        log(message)
        time.sleep(1)
    status = "成功" if account.get("mtyl_token") and account.get("kkkl_token") else "部分成功"
    return {"name": name, "status": status, "messages": messages}


def process_query(account: Dict[str, str]) -> Dict[str, str]:
    name = account["name"]
    details = []
    ok_count = 0
    if account.get("mtyl_token"):
        mtyl_ok, phone, mtyl_error = mtyl_info(account["mtyl_token"], name)
        if mtyl_ok:
            ok_count += 1
            details.append(f"每天有乐账号：{mask_phone(phone)}")
        else:
            details.append(f"每天有乐账号信息获取失败：{mtyl_error}")
    else:
        details.append(f"每天有乐跳过：{account.get('mtyl_error') or '未获取到 token'}")
    if account.get("kkkl_token"):
        kkkl_ok, phone, kkkl_error = kkkl_info(account["kkkl_token"], name)
        if kkkl_ok:
            ok_count += 1
            point = kkkl_query_points(account["kkkl_token"], name)
            details.append(f"可口可乐吧账号：{mask_phone(phone)}")
            details.append(f"昵称：{name}")
            details.append(f"快乐瓶：{point}")
        else:
            details.append(f"可口可乐吧账号信息获取失败：{kkkl_error}")
    else:
        details.append(f"可口可乐吧跳过：{account.get('kkkl_error') or '未获取到 token'}")
    status = "成功" if ok_count else "失败"
    return {"name": name, "status": status, "detail": "\n".join(details)}


def run_sign(accounts: List[Dict[str, str]]) -> None:
    log("可口可乐任务开始")
    results = [process_account(account) for account in accounts]
    content = "\n".join(message for item in results for message in item.get("messages", []))
    if PUSH_SWITCH == "1" and content and notify_send:
        notify_send("可口可乐签到任务汇总", content)
    log("可口可乐任务完成")


def run_query(accounts: List[Dict[str, str]]) -> None:
    for account in accounts:
        print(process_query(account)["detail"])


def main() -> int:
    print(f"\n可口可乐签到 {SCRIPT_VERSION}")
    try:
        accounts = [make_account()]
        mode = sys.argv[1].lower() if len(sys.argv) > 1 and sys.argv[1].lower() in ("sign", "query") else "sign"
        if mode == "query":
            run_query(accounts)
        else:
            run_sign(accounts)
        return 0
    except Exception as exc:
        log(f"执行失败：{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
''',
    'mxbc': r'''
import base64
import hashlib
import os
import time

import requests

SCRIPT_VERSION = "v1.0.0"
TASK = "蜜雪冰城"
APP_ID = "d82be6bbc1da11eb9dd000163e122ecb"
MINI_APP_ID = "wx7696c66d2245d107"
CODE_URL = os.getenv("MNSG_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
UA = "Mozilla/5.0 (Linux; Android 15; 22061218C Build/AQ3A.250226.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36 XWEB/1460075 MMWEBSDK/20260202 MicroMessenger/8.0.71.3080 WeChat/arm64"
PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCtypUdHZJKlQ9L
L6lIJSphnhqjke7HclgWuWDRWvzov30du235cCm13mqJ3zziqLCwstdQkuXo9sOP
Ih94t6nzBHTuqYA1whrUnQrKfv9X4/h3QVkzwT+xWflE+KubJZoe+daLKkDeZjVW
nUku8ov0E5vwADACfntEhAwiSZUALX9UgNDTPbj5ESeII+VztZ/KOFsRHMTfDb1G
IR/dAc1mL5uYbh0h2Fa/fxRPgf7eJOeWGiygesl3CWj0Ue13qwX9PcG7klJXfToI
576MY+A7027a0aZ49QhKnysMGhTdtFCksYG0lwPz3bIR16NvlxNLKanc2h+ILTFQ
bMW/Y3DRAgMBAAECggEBAJGTfX6rE6zX2bzASsu9HhgxKN1VU6/L70/xrtEPp4SL
SpHKO9/S/Y1zpsigr86pQYBx/nxm4KFZewx9p+El7/06AX0djOD7HCB2/+AJq3iC
5NF4cvEwclrsJCqLJqxKPiSuYPGnzji9YvaPwArMb0Ff36KVdaHRMw58kfFys5Y2
HvDqh4x+sgMUS7kSEQT4YDzCDPlAoEFgF9rlXnh0UVS6pZtvq3cR7pR4A9hvDgX9
wU6zn1dGdy4MEXIpckuZkhwbqDLmfoHHeJc5RIjRP7WIRh2CodjetgPFE+SV7Sdj
ECmvYJbet4YLg+Qil0OKR9s9S1BbObgcbC9WxUcrTgECgYEA/Yj8BDfxcsPK5ebE
9N2teBFUJuDcHEuM1xp4/tFisoFH90JZJMkVbO19rddAMmdYLTGivWTyPVsM1+9s
tq/NwsFJWHRUiMK7dttGiXuZry+xvq/SAZoitgI8tXdDXMw7368vatr0g6m7ucBK
jZWxSHjK9/KVquVr7BoXFm+YxaECgYEAr3sgVNbr5ovx17YriTqe1FLTLMD5gPrz
ugJj7nypDYY59hLlkrA/TtWbfzE+vfrN3oRIz5OMi9iFk3KXFVJMjGg+M5eO9Y8m
14e791/q1jUuuUH4mc6HttNRNh7TdLg/OGKivE+56LEyFPir45zw/dqwQM3jiwIz
yPz/+bzmfTECgYATxrOhwJtc0FjrReznDMOTMgbWYYPJ0TrTLIVzmvGP6vWqG8rI
S8cYEA5VmQyw4c7G97AyBcW/c3K1BT/9oAj0wA7wj2JoqIfm5YPDBZkfSSEcNqqy
5Ur/13zUytC+VE/3SrrwItQf0QWLn6wxDxQdCw8J+CokgnDAoehbH6lTAQKBgQCE
67T/zpR9279i8CBmIDszBVHkcoALzQtU+H6NpWvATM4WsRWoWUx7AJ56Z+joqtPK
G1WztkYdn/L+TyxWADLvn/6Nwd2N79MyKyScKtGNVFeCCJCwoJp4R/UaE5uErBNn
OH+gOJvPwHj5HavGC5kYENC1Jb+YCiEDu3CB0S6d4QKBgQDGYGEFMZYWqO6+LrfQ
ZNDBLCI2G4+UFP+8ZEuBKy5NkDVqXQhHRbqr9S/OkFu+kEjHLuYSpQsclh6XSDks
5x/hQJNQszLPJoxvGECvz5TN2lJhuyCupS50aGKGqTxKYtiPHpWa8jZyjmanMKnE
dOGyw/X4SFyodv8AEloqd81yGg==
-----END PRIVATE KEY-----"""


def log(message):
    print(f"[{TASK}] {message}")


def read_asn1_length(data, offset):
    first = data[offset]
    offset += 1
    if first < 0x80:
        return first, offset
    size = first & 0x7F
    return int.from_bytes(data[offset:offset + size], "big"), offset + size


def read_asn1_value(data, offset, tag):
    if data[offset] != tag:
        raise ValueError("私钥格式错误")
    length, offset = read_asn1_length(data, offset + 1)
    return data[offset:offset + length], offset + length


def parse_rsa_private_key():
    body = "".join(line for line in PRIVATE_KEY.splitlines() if "-----" not in line)
    der = base64.b64decode(body)
    pkcs8, _ = read_asn1_value(der, 0, 0x30)
    _, offset = read_asn1_value(pkcs8, 0, 0x02)
    _, offset = read_asn1_value(pkcs8, offset, 0x30)
    private_octets, _ = read_asn1_value(pkcs8, offset, 0x04)
    rsa_seq, _ = read_asn1_value(private_octets, 0, 0x30)
    offset = read_asn1_value(rsa_seq, 0, 0x02)[1]
    modulus, offset = read_asn1_value(rsa_seq, offset, 0x02)
    _, offset = read_asn1_value(rsa_seq, offset, 0x02)
    private_exp, _ = read_asn1_value(rsa_seq, offset, 0x02)
    return int.from_bytes(modulus, "big"), int.from_bytes(private_exp, "big")


def rsa_sign(content):
    modulus, private_exp = parse_rsa_private_key()
    key_len = (modulus.bit_length() + 7) // 8
    digest = hashlib.sha256(content.encode()).digest()
    digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + digest
    padding_len = key_len - len(digest_info) - 3
    if padding_len < 8:
        raise ValueError("RSA 私钥长度不足")
    encoded = b"\x00\x01" + (b"\xff" * padding_len) + b"\x00" + digest_info
    signature = pow(int.from_bytes(encoded, "big"), private_exp, modulus).to_bytes(key_len, "big")
    return base64.urlsafe_b64encode(signature).decode().rstrip("=")


def get_code(appid):
    data = requests.get(CODE_URL.format(appId=appid, appid=appid), timeout=15).json()
    code = data.get("code")
    if not code and isinstance(data.get("data"), dict):
        code = data["data"].get("code")
    if not code:
        raise RuntimeError(data.get("msg") or data.get("message") or "code失败")
    return str(code)


def main():
    try:
        log("开始执行")
        code = get_code(MINI_APP_ID)
        t1 = int(time.time() * 1000)
        session = requests.post("https://mxsa.mxbc.net/api/v1/app/code2Session", json={"code": code, "miniAppId": MINI_APP_ID, "t": t1, "appId": APP_ID, "sign": rsa_sign(f"appId={APP_ID}&code={code}&miniAppId={MINI_APP_ID}&t={t1}")}, headers={"version": "2.8.27"}, timeout=20).json()
        openid = session["data"]["openid"]
        unionid = session["data"]["unionid"]
        t2 = int(time.time() * 1000)
        login = requests.post("https://mxsa.mxbc.net/api/v2/app/loginByAuthCode", json={"authCode": code, "openId": openid, "unionid": unionid, "third": "wxmini", "miniAppId": MINI_APP_ID, "t": t2, "appId": APP_ID, "sign": rsa_sign(f"appId={APP_ID}&authCode={code}&miniAppId={MINI_APP_ID}&openId={openid}&t={t2}&third=wxmini&unionid={unionid}")}, headers={"version": "2.8.27", "x-ssos-cid": unionid}, timeout=20).json()
        token = login["data"]["accessToken"]
        def points():
            t = int(time.time() * 1000)
            res = requests.get("https://mxsa.mxbc.net/api/v1/customer/info", params={"t": t, "appId": APP_ID, "sign": rsa_sign(f"appId={APP_ID}&t={t}")}, headers={"Access-Token": token, "version": "2.8.27", "User-Agent": UA}, timeout=20).json()
            return int(res.get("data", {}).get("customerPoint", 0)) if res.get("code") == 0 else 0
        before = points()
        log(f"当前雪王币：{before}")
        t3 = int(time.time() * 1000)
        requests.get("https://mxsa.mxbc.net/api/v1/duiba/getLoginUrl", params={"appId": APP_ID, "t": t3, "sign": rsa_sign(f"appId={APP_ID}&t={t3}"), "dbredirect": ""}, headers={"Access-Token": token, "version": "2.8.27", "User-Agent": UA}, timeout=20)
        time.sleep(1.5)
        after = points()
        log(f"本次获得：{max(0, after - before)} | 当前：{after}")
        return 0
    except Exception as exc:
        log(f"执行失败：{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
''',
    'nw': r'''
import os
import random

import requests

SCRIPT_VERSION = "v1.0.0"
TASK = "浓五酒馆"
APPID = "wxed3cf95a14b58a26"
BASE = "https://stdcrm.dtmiller.com"
CODE_URL = os.getenv("MNSG_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
UA_LIST = ["Mozilla/5.0 (Linux; Android 15) Chrome/146.0 Mobile MicroMessenger/8.0.71", "Mozilla/5.0 (Linux; Android 14) Chrome/145.0 Mobile MicroMessenger/8.0.70"]


def log(message):
    print(f"[{TASK}] {message}")


def get_code():
    data = requests.get(CODE_URL.format(appId=APPID, appid=APPID), timeout=15).json()
    code = data.get("code")
    if not code and isinstance(data.get("data"), dict):
        code = data["data"].get("code")
    if not code:
        raise RuntimeError(data.get("msg") or data.get("message") or "code失败")
    return str(code)


def sign_message(data):
    msg = str(data.get("msg") or data.get("message") or "")
    return "签到成功" if msg.lower() == "success" else (msg or "完成")


def main():
    try:
        log("开始执行")
        ua = random.choice(UA_LIST)
        token = requests.post(BASE + "/std-weixin-mp-service/miniApp/custom/login", json={"code": get_code(), "appId": APPID}, headers={"User-Agent": ua}, timeout=20).json()["data"]
        user = requests.get(BASE + "/scrm-promotion-service/mini/wly/user/info", headers={"Authorization": f"Bearer {token}", "User-Agent": ua}, timeout=20).json()
        log(f"用户：{user['data']['member']['nick_name']}")
        sign = requests.get(BASE + "/scrm-promotion-service/promotion/sign/today?promotionId=PI69eb321d37c48c000a05ee4e", headers={"Authorization": f"Bearer {token}", "User-Agent": ua}, timeout=20).json()
        log(sign_message(sign))
        return 0
    except Exception as exc:
        log(f"执行失败：{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
''',
    'sdl': r'''
import os
import json
import random
import time

import requests

SCRIPT_VERSION = "v1.0.0"
TASK = "三得利"
APPID = "wxb33ed03c6c715482"
CODE_URL = os.getenv("MNSG_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
UA_LIST = [
    "Mozilla/5.0 (Linux; Android 14; 2512BPNDAC Build/UKQ1.230917.001; wv) AppleWebKit/537.36 Mobile MicroMessenger/8.0.66 MiniProgramEnv/android",
    "Mozilla/5.0 (Linux; Android 13; Redmi K60 Build/TKQ1.221114.001; wv) AppleWebKit/537.36 Mobile MicroMessenger/8.0.56 MiniProgramEnv/android",
]


def log(message):
    print(f"[{TASK}] {message}")


def dict_data(payload):
    data = payload.get("data") if isinstance(payload, dict) else {}
    return data if isinstance(data, dict) else {}


def response_msg(payload, default="完成"):
    return payload.get("msg", default) if isinstance(payload, dict) else default


def get_code():
    data = requests.get(CODE_URL.format(appId=APPID, appid=APPID), timeout=15).json()
    code = data.get("code")
    if not code and isinstance(data.get("data"), dict):
        code = data["data"].get("code")
    if not code:
        raise RuntimeError(data.get("msg") or data.get("message") or "code失败")
    return str(code)


def main():
    ua = random.choice(UA_LIST)
    def headers(token=""):
        data = {"content-type": "application/json;charset=UTF-8", "HH-FROM": "20230130307725", "HH-APP": APPID, "HH-VERSION": "0.6.1", "X-VERSION": "2.3.5", "HH-CI": "saas-wechat-app", "appPublishType": "1", "componentSend": "1", "User-Agent": ua, "Referer": f"https://servicewechat.com/{APPID}/72/page-frame.html"}
        if token:
            data["Authorization"] = f"Bearer {token}"
        return data
    try:
        log("开始执行")
        time.sleep(random.randint(2, 6))
        login = requests.post("https://xiaodian.miyatech.com/api/user/login/wx-jc", json={"jsCode": get_code(), "clientId": "saas-wechat-app", "myUnionId": "", "appPublishType": 1}, headers=headers(), timeout=20).json()
        token = dict_data(login).get("tokenInfo", {}).get("access_token")
        if not token:
            raise RuntimeError(response_msg(login, "登录失败"))
        def post_api(url, body):
            return requests.post(f"https://xiaodian.miyatech.com/api{url}", json=body, headers=headers(token), timeout=20).json()
        sign = post_api("/coupon/auth/signIn", {"miniappId": 159})
        log(f"签到结果：{dict_data(sign).get('integralToastText') or response_msg(sign)}")
        save = post_api("/user/auth/user/collect/record/save", {"sceneValue": "1104"})
        if isinstance(save, dict) and save.get("code") == 200:
            log(f"收藏成功：{dict_data(save).get('integralToastText', '')}")
        info = post_api("/user/member/info", {})
        log(f"当前积分：{dict_data(info).get('currentScore', 0)}")
        return 0
    except Exception as exc:
        log(f"执行失败：{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
''',
    'gy': r'''
import os
import random
import time

import requests

SCRIPT_VERSION = "v1.0.0"
TASK = "国乐酱酒"
APPID = "wxeff120e4d11594c0"
BASE = "https://member.guoyuejiu.com"
CODE_URL = os.getenv("MNSG_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
UA = "Mozilla/5.0 (Linux; Android 15; 22061218C Build/AQ3A.250226.002; wv) AppleWebKit/537.36 Chrome/146.0.7680.177 Mobile MicroMessenger/8.0.71"


def log(message):
    print(f"[{TASK}] {message}")


def get_code():
    data = requests.get(CODE_URL.format(appId=APPID, appid=APPID), timeout=15).json()
    code = data.get("code")
    if not code and isinstance(data.get("data"), dict):
        code = data["data"].get("code")
    if not code:
        raise RuntimeError(data.get("msg") or data.get("message") or "code失败")
    return str(code)


def dict_data(payload):
    data = payload.get("data") if isinstance(payload, dict) else {}
    return data if isinstance(data, dict) else {}


def response_msg(payload, default="请求失败"):
    return str(payload.get("msg") or payload.get("message") or default) if isinstance(payload, dict) else default


def task_msg(payload, default="完成"):
    msg = response_msg(payload, default)
    return "签到成功" if msg.lower() == "success" else msg


def main():
    try:
        log("开始执行")
        time.sleep(1.5 + random.random() * 1.5)
        login = requests.post(f"{BASE}/api/user/wxLogin", json={"avatarUrl": "https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg/132", "city": "", "country": "", "gender": 0, "nickName": "微信用户", "province": "", "code": get_code(), "source": 2}, headers={"User-Agent": UA}, timeout=20).json()
        token = dict_data(login).get("authorization")
        if not token:
            msg = response_msg(login, "登录失败")
            raise RuntimeError("登录未返回 authorization" if msg.lower() == "success" else msg)
        sign = requests.get(f"{BASE}/api/sign/daily/sign", headers={"Authorization": "Mer" + token, "User-Agent": UA}, timeout=20).json()
        log(f"签到结果：{task_msg(sign)}")
        info = requests.get(f"{BASE}/api/user/info", headers={"Authorization": "Mer" + token, "User-Agent": UA}, timeout=20).json()
        log(f"当前积分：{dict_data(info).get('score', 0)}")
        return 0
    except Exception as exc:
        log(f"执行失败：{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
''',
    'phwd': r'''
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
@name   平和味道 - 每日一听自动签到 + 答题
@note   立群中国(spring.liqunchina.com)微信H5活动签到/答题/抽奖
        青龙面板适配，本地 wxcode 模式仅执行当前微信账号

环境变量:
  PH_CODE_URL     wxcode本地登录地址 (默认 http://127.0.0.1:8088/login?appId={appId})
  PH_SERVER       微信服务端地址 (默认 )
  PH_APPID        活动微信公众号appid (默认 wx9277678c5cb30d2c)
  PH_ACTID        签到活动ID (默认 2053713870746574850)
  PH_DRAW         是否抽奖 True/False (默认 False)
  PH_WXID         指定wxid，本地 wxcode 模式无需配置
  PH_LNG          经度 (默认 119.91238403320312)
  PH_LAT          纬度 (默认 29.18408966064453)
  PH_QUIZ_ACTID   答题活动ID (为空则跳过答题)
  PH_QUIZ_PAPERID 答题试卷ID (消费者卷)
  PH_QUIZ_ANSWERS 答案，格式: questionId:答案,questionId:答案 (如 205xxx:A,206xxx:B)

cron: 30 7 * * *
new Env('平和味道每日签到')
"""

import requests
import json
import time
import base64
import os
import random
import string
from datetime import datetime

# ==================== 用户配置区（每期活动需修改） ====================

# --- 签到活动 ---
CODE_URL = os.environ.get("PH_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
WECHAT_SERVER = os.environ.get("PH_SERVER", "").rstrip("/")
ACTIVITY_APPID = os.environ.get("PH_APPID", "wx9277678c5cb30d2c")
ACT_ID = os.environ.get("PH_ACTID", "2053713870746574850")
MANUAL_WXIDS = os.environ.get("PH_WXID", "")
DEFAULT_LNG = float(os.environ.get("PH_LNG", "119.91238403320312"))
DEFAULT_LAT = float(os.environ.get("PH_LAT", "29.18408966064453"))

# --- 答题活动（只需配置actId和答案） ---
# 答题活动actId，为空则跳过答题环节
QUIZ_ACT_ID = os.environ.get("PH_QUIZ_ACTID", "")
# 答案，按题目顺序填，逗号分隔。如: A 或 A,B,C
# 不配置则自动获取题目并选第一项提交
QUIZ_ANSWERS = os.environ.get("PH_QUIZ_ANSWERS", "")

BASE_URL = "https://spring.liqunchina.com"

# ==================== 日志 ====================

def log(msg, level="INFO"):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prefix = {"INFO": "", "WARN": "[WARN] ", "ERROR": "[ERROR] "}
    print(f"[{ts}] {prefix.get(level, '')}{msg}")

# ==================== 微信服务端 ====================

def http_request(url, method="GET", json_data=None, timeout=30):
    try:
        if method == "GET":
            resp = requests.get(url, timeout=timeout)
        else:
            resp = requests.post(url, json=json_data, timeout=timeout)
        return resp.json()
    except Exception as e:
        log(f"HTTP请求异常 {url}: {e}", "ERROR")
        return {}


def get_online_accounts():
    """获取在线微信账号列表
    survival字段不一定实时，改为：获取所有账号，靠后续get/code探测谁可用
    """
    if not WECHAT_SERVER:
        return []
    url = f"{WECHAT_SERVER}/api/v1/wx/user/status"
    result = http_request(url)
    if not result.get("status"):
        log(f"获取账号列表失败: {result.get('message', result.get('msg', '未知'))}", "ERROR")
        return []
    accounts_data = result.get("data", {})
    online = []
    offline = []
    for wxid_key, info in accounts_data.items():
        if isinstance(info, dict) and "wxid" in info and "nickname" in info:
            if info.get("survival") == 1:
                online.append(info)
            else:
                offline.append(info)
    if online:
        return online
    log(f"survival全0，将尝试全部 {len(offline)} 个账号")
    return offline


def extract_code(data):
    if not isinstance(data, dict):
        return ""
    for item in (data, data.get("data"), data.get("Data"), data.get("result"), data.get("Result")):
        if isinstance(item, dict):
            code = item.get("code") or item.get("Code")
            if code:
                return str(code)
    return ""


def get_wx_code(wxid):
    """从微信服务端API获取OAuth code"""
    if not WECHAT_SERVER:
        try:
            data = requests.get(CODE_URL.format(appId=ACTIVITY_APPID, appid=ACTIVITY_APPID), timeout=15).json()
        except Exception as e:
            log(f"[{wxid}] 本地wxcode异常: {e}", "ERROR")
            return None
        wx_code = extract_code(data)
        if wx_code:
            log(f"[{wxid}] 获取code成功: {wx_code[:20]}...")
            return wx_code
        log(f"[{wxid}] 获取code失败: {data.get('msg') or data.get('message') or data}", "ERROR")
        return None
    url = f"{WECHAT_SERVER}/api/v1/wx/app/get/code"
    payload = {"wxid": wxid, "appid": ACTIVITY_APPID}
    result = http_request(url, method="POST", json_data=payload)
    code_val = result.get("Code") if result.get("Code") is not None else result.get("code")
    data = result.get("Data") or result.get("data")
    success = result.get("Success") or result.get("success")

    if (isinstance(code_val, int) and code_val == 0) or success:
        wx_code = data.get("code", "") if isinstance(data, dict) else ""
        if wx_code:
            log(f"[{wxid}] 获取code成功: {wx_code[:20]}...")
            return wx_code
    msg = result.get("Message") or result.get("message", "")
    log(f"[{wxid}] 获取code失败: {msg}", "ERROR")
    return None

# ==================== 活动通用接口 ====================

def get_jwt_token(wx_code):
    """用微信code换取JWT Token（code一次性，必须立即使用）"""
    url = f"{BASE_URL}/service/weixin/mp/access/validateCodeV2"
    params = {"code": wx_code, "state": ""}
    try:
        resp = requests.get(url, params=params, timeout=30)
        result = resp.json()
    except Exception as e:
        log(f"获取JWT异常: {e}", "ERROR")
        return None

    if result.get("code") == 0:
        token = result.get("data", "")
        if isinstance(token, str) and token.startswith("eyJ"):
            return token
    msg = result.get("msg", "")
    log(f"换取JWT失败: {msg}", "ERROR")
    return None


def create_session(token):
    """创建带认证的requests Session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": BASE_URL,
        "Referer": f"{BASE_URL}/front/weixin-act-fans-voice-202605-front/",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4_2 like Mac OS X) "
                      "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 "
                      "MicroMessenger/8.0.73(0x18004926) NetType/WIFI Language/zh_CN",
    })
    return session

# ==================== 签到活动接口 ====================

def generate_action_id(length=42):
    """生成heart_talk所需的actionId"""
    random_bytes = os.urandom(length)
    action_id = base64.b64encode(random_bytes).decode("utf-8")[:56]
    action_id = action_id.replace("+", "").replace("/", "").replace("=", "")
    if len(action_id) < 40:
        action_id += "".join(random.choices(string.ascii_letters + string.digits, k=40 - len(action_id)))
    return action_id


def participation_verify(session, act_id=None):
    """参与验证"""
    aid = act_id or ACT_ID
    url = f"{BASE_URL}/service/activity/act/participation/verify"
    params = {"actId": aid, "lng": DEFAULT_LNG, "lat": DEFAULT_LAT}
    try:
        resp = session.post(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            log("参与验证通过")
            return True
        log(f"参与验证失败: {result}", "WARN")
        return False
    except Exception as e:
        log(f"参与验证异常: {e}", "ERROR")
        return False


def participation_verify_v2(session, act_id):
    """答题活动参与验证(v2版本)"""
    url = f"{BASE_URL}/service/activity/act/participation/verify/v2"
    params = {"actId": act_id, "sourceId": ""}
    try:
        resp = session.post(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            log("答题活动参与验证通过")
            return True
        log(f"答题活动参与验证失败: {result}", "WARN")
        return False
    except Exception as e:
        log(f"答题活动参与验证异常: {e}", "ERROR")
        return False


def get_daily_tasks(session):
    """获取每日任务列表"""
    url = f"{BASE_URL}/service/weixin-act-fans-voice/fans/task/daily"
    payload = {"actId": ACT_ID, "latitude": DEFAULT_LAT, "longitude": DEFAULT_LNG}
    try:
        resp = session.post(url, json=payload, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            tasks = result.get("data", {}).get("tasks", [])
            log(f"获取任务列表: {len(tasks)}个")
            return tasks
        log(f"获取任务失败: {result}", "ERROR")
        return []
    except Exception as e:
        log(f"获取任务异常: {e}", "ERROR")
        return []


def do_task_action(session, task_id, action_type, action_id):
    """执行任务动作"""
    url = f"{BASE_URL}/service/weixin-act-fans-voice/fans/task/action"
    payload = {
        "actId": ACT_ID,
        "taskId": task_id,
        "actionType": action_type,
        "actionId": action_id,
    }
    try:
        resp = session.post(url, json=payload, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            data = result.get("data", {})
            rewarded = data.get("rewarded", False)
            points = data.get("rewardPoints", 0)
            if rewarded:
                log(f"任务完成 +{points}分 ({action_type})")
            else:
                log(f"任务已做过 ({action_type})")
            return rewarded, points
        else:
            log(f"任务失败: {result}", "WARN")
            return False, 0
    except Exception as e:
        log(f"任务异常: {e}", "ERROR")
        return False, 0


def get_task_record(session, task_type):
    """查询任务完成记录"""
    url = f"{BASE_URL}/service/weixin-act-fans-voice/fans/task/record"
    params = {"actId": ACT_ID, "taskType": task_type}
    try:
        resp = session.post(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            return result.get("data", [])
        return []
    except:
        return []


def get_point_balance(session):
    """查询积分余额"""
    url = f"{BASE_URL}/service/weixin-act-point/point/getByActId"
    params = {"actId": ACT_ID, "type": 0}
    try:
        resp = session.get(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            data = result.get("data", {})
            return data.get("balancePoint", 0), data.get("totalPoint", 0)
        return 0, 0
    except:
        return 0, 0


def get_lucky_config(session):
    """查询抽奖配置"""
    url = f"{BASE_URL}/service/weixin-act-point/point/lucky/config"
    params = {"actId": ACT_ID, "type": 0}
    try:
        resp = session.get(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            return result.get("data", {})
        return None
    except:
        return None


def generate_device_token(length=32):
    """生成Device-Token"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def do_lucky_draw(session):
    """执行抽奖"""
    config = get_lucky_config(session)
    if not config:
        log("无法获取抽奖配置，跳过", "WARN")
        return

    lucky_id = config.get("luckyId", "")
    point_cost = config.get("point", 100)
    max_times = config.get("maxTimes", 3)
    used_times = config.get("luckyDrawTimes", 0)
    remaining = max_times - used_times

    if remaining <= 0:
        log(f"今日抽奖次数已用完({used_times}/{max_times})")
        return

    balance, _ = get_point_balance(session)
    possible = min(remaining, balance // point_cost)

    if possible <= 0:
        log(f"积分不足抽奖(余额{balance}, 需{point_cost}/次)")
        return

    log(f"可抽奖{possible}次(每次{point_cost}积分)，开始抽奖...")

    for i in range(possible):
        try:
            url = f"{BASE_URL}/service/weixin-act-point/point/lucky/draw"
            params = {
                "actId": ACT_ID,
                "luckyId": lucky_id,
                "type": 0,
                "lat": DEFAULT_LAT,
                "lng": DEFAULT_LNG,
            }
            device_token = generate_device_token()
            resp = session.post(
                url,
                params=params,
                headers={
                    "Content-Type": "application/json;charset=UTF-8",
                    "Device-Token": device_token,
                },
                timeout=30,
            )
            result = resp.json()
            if result.get("code") == 0:
                data = result.get("data", {})
                prize = data.get("prizeName", data.get("name", "未中奖"))
                log(f"第{i+1}次抽奖: {prize}")
            else:
                msg = result.get("msg", "")
                log(f"第{i+1}次抽奖失败: {msg}")
        except Exception as e:
            log(f"第{i+1}次抽奖异常: {e}", "ERROR")

        time.sleep(1)

    balance, _ = get_point_balance(session)
    log(f"抽奖后积分余额: {balance}")

# ==================== 奖品查询接口 ====================

def query_prizes(session):
    """查询中奖记录（待领奖 + 已领奖 + 全部）"""
    log("--- 奖品查询 ---")

    # 待领奖 (status=1)
    pending = _query_prizes_by_status(session, 1)
    if pending:
        log(f"待领奖: {len(pending)}个")
        for p in pending:
            name = p.get("prizeName", p.get("phaseName", "未知奖品"))
            act_name = p.get("actName", "")
            log(f"  * {name} (活动: {act_name})")
    else:
        log("待领奖: 无")

    # 已领奖 (status=2)
    claimed = _query_prizes_by_status(session, 2)
    if claimed:
        log(f"已领奖: {len(claimed)}个")
        for p in claimed:
            name = p.get("prizeName", p.get("phaseName", "未知奖品"))
            act_name = p.get("actName", "")
            log(f"  * {name} (活动: {act_name})")
    else:
        log("已领奖: 无")

    return pending, claimed


def _query_prizes_by_status(session, status):
    """按状态查询中奖记录 status=1待领 2已领"""
    url = f"{BASE_URL}/service/activity/act/phase/win-record/listByStatus"
    params = {"status": status}
    try:
        resp = session.get(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            return result.get("data", [])
        return []
    except:
        return []


def query_all_prizes(session, page_size=50):
    """查询全部中奖记录（分页）"""
    url = f"{BASE_URL}/service/activity/act/phase/win-record/listPage"
    params = {"current": 1, "size": page_size}
    try:
        resp = session.get(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            data = result.get("data", {})
            records = data.get("records", [])
            total = data.get("total", 0)
            return records, total
        return [], 0
    except:
        return [], 0

# ==================== 答题活动接口 ====================

def get_quiz_papers(session, act_id):
    """通过活动ID自动获取试卷列表（消费者卷/零售商卷）"""
    url = f"{BASE_URL}/service/activity/act/phase/mapping/listByActId"
    params = {"actId": act_id}
    try:
        resp = session.get(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            phases = result.get("data", [])
            consumer_paper = None
            retailer_paper = None
            for phase in phases:
                if phase.get("phaseType") == "PAPER":
                    remarks = phase.get("remarks", "")
                    phase_id = phase.get("phaseId", "")
                    phase_name = phase.get("phaseName", "")
                    if remarks == "consumer":
                        consumer_paper = phase_id
                        log(f"  发现消费者卷: {phase_name} ({phase_id})")
                    elif remarks == "retailer":
                        retailer_paper = phase_id
                        log(f"  发现零售商卷: {phase_name} ({phase_id})")
            # 如果没有remarks区分，取第一个PAPER类型
            if not consumer_paper and not retailer_paper:
                for phase in phases:
                    if phase.get("phaseType") == "PAPER":
                        consumer_paper = phase.get("phaseId", "")
                        log(f"  发现试卷: {phase.get('phaseName','')} ({consumer_paper})")
                        break
            return consumer_paper, retailer_paper
        log(f"获取试卷列表失败: {result}", "ERROR")
        return None, None
    except Exception as e:
        log(f"获取试卷列表异常: {e}", "ERROR")
        return None, None


def check_retailer(session):
    """检查当前用户是否为零售商"""
    url = f"{BASE_URL}/service/weixin/retailer/info/getByUserId"
    try:
        resp = session.get(url, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            data = result.get("data")
            if data and isinstance(data, dict):
                return True
        return False
    except:
        return False


def get_paper_info(session, paper_id):
    """获取试卷信息（题目+选项）"""
    url = f"{BASE_URL}/service/activity/paper/{paper_id}"
    try:
        resp = session.get(url, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            return result.get("data", {})
        log(f"获取试卷失败: {result}", "ERROR")
        return None
    except Exception as e:
        log(f"获取试卷异常: {e}", "ERROR")
        return None


def get_answer_detail(session, paper_id):
    """查询答题记录（判断是否已答过）"""
    url = f"{BASE_URL}/service/activity/paper/answer/detail/{paper_id}"
    params = {"sourceId": ""}
    try:
        resp = session.get(url, params=params, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            data = result.get("data", {})
            status = data.get("status", 0)
            answer_list = data.get("actPaperAnswerItemList", [])
            return status, answer_list
        return 0, []
    except:
        return 0, []


def save_paper_answer(session, paper_id, answer_list):
    """提交答题答案"""
    url = f"{BASE_URL}/service/activity/paper/answer/save"
    payload = {
        "paperId": paper_id,
        "sourceId": "",
        "actPaperAnswerItemList": answer_list,
    }
    try:
        resp = session.post(url, json=payload, timeout=30)
        result = resp.json()
        if result.get("code") == 0:
            data = result.get("data", {})
            answer_id = data.get("answerId", "")
            correct = data.get("correctCount", 0)
            log(f"答题提交成功 answerId={answer_id} 正确数={correct}")
            return True
        log(f"答题提交失败: {result}", "ERROR")
        return False
    except Exception as e:
        log(f"答题提交异常: {e}", "ERROR")
        return False


def parse_quiz_answers(answers_str):
    """解析答案配置
    简单模式: A 或 A,B,C（按题目顺序对应）
    高级模式: questionId:答案值,questionId:答案值（指定题ID）
    返回: list模式返回['A','B'] 或 dict模式返回{qid:'A'}
    """
    if not answers_str:
        return None
    # 如果包含冒号，走高级模式
    if ':' in answers_str:
        result = {}
        for pair in answers_str.split(","):
            pair = pair.strip()
            if ":" in pair:
                qid, ans = pair.split(":", 1)
                result[qid.strip()] = ans.strip()
        return result
    # 简单模式：按顺序的答案字母
    return [a.strip() for a in answers_str.split(",") if a.strip()]


def run_quiz(session):
    """执行答题流程（自动获取试卷和题目）"""
    if not QUIZ_ACT_ID:
        log("答题活动ID未配置，跳过答题")
        return

    log("--- 答题活动 ---")

    # 1. 参与验证(v2)
    participation_verify_v2(session, QUIZ_ACT_ID)
    time.sleep(0.5)

    # 2. 自动获取试卷列表
    consumer_paper, retailer_paper = get_quiz_papers(session, QUIZ_ACT_ID)
    if not consumer_paper and not retailer_paper:
        log("未找到试卷，跳过答题", "ERROR")
        return
    time.sleep(0.5)

    # 3. 判断用户身份，选择试卷
    is_retailer = check_retailer(session)
    paper_id = retailer_paper if (is_retailer and retailer_paper) else consumer_paper
    paper_type = "零售商卷" if (is_retailer and retailer_paper) else "消费者卷"
    if not paper_id:
        log("无可用试卷，跳过", "ERROR")
        return
    log(f"用户身份: {'零售商' if is_retailer else '消费者'} -> {paper_type} ({paper_id})")
    time.sleep(0.5)

    # 4. 检查是否已答过
    status, existing_answers = get_answer_detail(session, paper_id)
    if status == 1 and existing_answers:
        log(f"{paper_type}已答过，跳过")
        return
    time.sleep(0.5)

    # 5. 获取试卷题目
    paper_info = get_paper_info(session, paper_id)
    if not paper_info:
        log("无法获取试卷信息，跳过", "ERROR")
        return

    questions = paper_info.get("actPaperQuestionList", [])
    if not questions:
        log("试卷无题目，跳过")
        return
    log(f"获取到 {len(questions)} 道题")

    # 6. 解析用户配置的答案
    parsed_answers = parse_quiz_answers(QUIZ_ANSWERS)
    is_dict = isinstance(parsed_answers, dict)
    is_list = isinstance(parsed_answers, list)

    # 7. 构建答案列表
    answer_list = []
    for idx, q in enumerate(questions):
        question_id = q.get("id", "")
        title = q.get("title", "")
        options_str = q.get("options", "[]")

        options = []
        try:
            options = json.loads(options_str)
        except:
            pass

        ans_value = None

        # 优先级1: dict模式(题ID:答案)
        if is_dict and question_id in parsed_answers:
            ans_value = parsed_answers[question_id]
            log(f"  Q{idx+1}: {title[:25]}... -> {ans_value}")
        # 优先级2: list模式(按顺序)
        elif is_list and idx < len(parsed_answers):
            ans_value = parsed_answers[idx]
            log(f"  Q{idx+1}: {title[:25]}... -> {ans_value}")
        # 优先级3: 自动选第一项
        elif options:
            ans_value = options[0].get("value", "A")
            opt_name = options[0].get("name", "")
            log(f"  Q{idx+1}: {title[:25]}... -> {ans_value}({opt_name[:8]})[自动]")
        else:
            log(f"  Q{idx+1}: {title[:25]}... -> 跳过(无选项)", "ERROR")
            continue

        answer_list.append({
            "questionId": question_id,
            "answer": json.dumps({"value": ans_value, "text": ""}, ensure_ascii=False),
        })

    if not answer_list:
        log("无有效答案，跳过提交", "ERROR")
        return

    # 8. 提交答案
    time.sleep(0.5)
    save_paper_answer(session, paper_id, answer_list)

# ==================== 签到主流程 ====================

def run_checkin(session):
    """执行签到任务流程"""
    log("--- 每日签到 ---")

    # 1. 参与验证
    participation_verify(session)
    time.sleep(0.5)

    # 2. 获取任务列表
    tasks = get_daily_tasks(session)
    if not tasks:
        log("无任务数据", "ERROR")
        return

    # 3. 遍历执行未完成任务
    total_earned = 0
    for task in tasks:
        task_id = task.get("taskId", "")
        task_type = task.get("taskType", "")
        task_name = task.get("taskName", "")
        completed = task.get("completed", False)
        rewarded = task.get("rewarded", False)
        points = task.get("rewardPoints", 0)

        if completed and rewarded:
            log(f"  跳过(已完成): {task_name}")
            continue

        if task_type == "meditation":
            action_type = "play"
            action_id = f"meditation_{datetime.now().strftime('%Y%m%d')}"
        elif task_type == "read_article":
            action_type = "click"
            config_str = task.get("taskConfig", "{}")
            try:
                config = json.loads(config_str)
                action_id = config.get("articleId", f"article_{task.get('round', 1)}")
            except:
                action_id = f"article_{task.get('round', 1)}"
        elif task_type == "heart_talk":
            action_type = "upload"
            records = get_task_record(session, "heart_talk")
            if records:
                action_id = records[0].get("actionId", generate_action_id())
            else:
                action_id = generate_action_id()
        else:
            log(f"  未知类型: {task_type}, 跳过", "WARN")
            continue

        log(f"  执行: {task_name} -> {action_type}")
        rewarded, earned = do_task_action(session, task_id, action_type, action_id)
        if rewarded:
            total_earned += earned
        time.sleep(1)

    time.sleep(0.5)
    balance, total = get_point_balance(session)
    log(f"签到完成: 本次+{total_earned}分, 余额{balance}, 累计{total}")

    # 4. 抽奖
    time.sleep(0.5)
    do_lucky_draw(session)

# ==================== 单账号主流程 ====================

def run_account(wxid, nickname=""):
    """执行单个账号的签到+答题流程"""
    tag = nickname or wxid[:12]
    log(f"========== [{tag}] 开始 ==========")

    # 1. 获取微信code
    wx_code = get_wx_code(wxid)
    if not wx_code:
        log(f"[{tag}] 获取code失败，跳过", "ERROR")
        return False

    # 2. 换取JWT（最多重试2次）
    token = get_jwt_token(wx_code)
    if not token:
        log(f"[{tag}] 第1次换token失败，重试...", "WARN")
        time.sleep(2)
        wx_code = get_wx_code(wxid)
        if wx_code:
            token = get_jwt_token(wx_code)

    if not token:
        log(f"[{tag}] 换取Token最终失败，跳过", "ERROR")
        return False

    session = create_session(token)

    # 3. 执行签到
    run_checkin(session)

    # 4. 执行答题
    if QUIZ_ACT_ID:
        time.sleep(1)
        run_quiz(session)

    # 5. 奖品查询
    time.sleep(0.5)
    query_prizes(session)

    log(f"========== [{tag}] 结束 ==========")
    return True

# ==================== 入口 ====================

def main():
    log("=" * 50)
    log("平和味道 - 每日签到 + 答题")
    log(f"签到活动ID: {ACT_ID}")
    if QUIZ_ACT_ID:
        log(f"答题活动ID: {QUIZ_ACT_ID}")
        if QUIZ_ANSWERS:
            log(f"答案覆盖: {QUIZ_ANSWERS}")
        else:
            log("答案: 自动(选第一项)")
    else:
        log("答题活动: 未配置(跳)")
    log("流程: 签到 -> 抽奖 -> 答题 -> 奖品查询")
    log(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("=" * 50)

    # 获取账号列表
    accounts = []

    if MANUAL_WXIDS:
        wxid_list = [w.strip() for w in MANUAL_WXIDS.split("&") if w.strip()]
        for w in wxid_list:
            accounts.append({"wxid": w, "nickname": w[:10]})
        log(f"手动指定 {len(accounts)} 个账号")
    else:
        if WECHAT_SERVER:
            accounts = get_online_accounts()
            log(f"在线账号: {len(accounts)} 个")
            for a in accounts:
                log(f"  - {a.get('nickname', '?')} ({a.get('wxid', '?')[:15]}...)")
        else:
            accounts = [{"wxid": "wxcode", "nickname": "wxcode"}]
            log("未配置PH_SERVER，使用本地wxcode")

    if not accounts:
        log("无可用账号，退出", "ERROR")
        return

    # 顺序执行每个账号
    success_count = 0
    fail_count = 0

    for i, account in enumerate(accounts):
        wxid = account.get("wxid", "")
        nickname = account.get("nickname", "")

        if not wxid:
            continue

        log(f"\n>>> 账号 {i+1}/{len(accounts)} <<<")

        try:
            ok = run_account(wxid, nickname)
            if ok:
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            log(f"[{nickname or wxid[:12]}] 执行异常: {e}", "ERROR")
            fail_count += 1

        if i < len(accounts) - 1:
            log("等待3秒...")
            time.sleep(3)

    # 汇总
    log("=" * 50)
    log(f"执行完毕: 成功 {success_count}, 失败 {fail_count}, 共 {len(accounts)} 个账号")
    log("=" * 50)

    print(f"\n【平和味道签到】成功{success_count}个 失败{fail_count}个")


if __name__ == "__main__":
    main()

''',
    'txmap': r'''
import hashlib
import json
import os
import random
import time

import requests

SCRIPT_VERSION = "v1.0.0"
TASK = "腾讯地图"
LOGIN_API_URL = "https://miniapp.map.qq.com/minLogin/v2/login"
CHECKTOKEN_API_URL = "https://miniapp.map.qq.com/minLogin/v2/checkToken"
USERINFO_API_URL = "https://miniapp.map.qq.com/minLogin/v2/getUserInfo"
CHECKIN_URL = "https://mmapgwh.map.qq.com/activity/v1/checkin"
APPID = os.getenv("TXMAP_APPID", "wx7643d5f831302ab0").strip()
CODE_URL = os.getenv("TXMAP_CODE_URL", "http://127.0.0.1:8088/login?appId={appId}").strip()
TOKEN = "e643d512f085d621bf6c9e80310d0498"
TMAP_KEY_SUFFIX = "03a9875e795c3ecff15f617085e72d4cc"
TMAP_MINI_LOGIN_SSID_FIXED = "4ddc120a0937a2c720f83cc9ddf2a044"
LOGIN_ACCESS_KEY = "1"
LOGIN_SECRET_KEY = "4300eec60bedec22a73408a0d76b03ec"
ACTIVITY_ID = 1721983577
GAME_ID = 1
RULE_ID = "tencent_map_checkin"
NICK = "　　　　　　"


def log(message):
    print(f"[{TASK}] {message}")


def md5_text(value):
    return hashlib.md5(value.encode("utf-8")).hexdigest()


def sha256_lower(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_upper(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest().upper()


def req_id():
    return md5_text(f"{random.random()} {int(time.time() * 1000)}")


def extract_code(data):
    if not isinstance(data, dict):
        return ""
    for item in (data, data.get("data"), data.get("Data"), data.get("result"), data.get("Result")):
        if isinstance(item, dict):
            code = item.get("code") or item.get("Code")
            if code:
                return str(code)
    return ""


def get_wxcode():
    data = requests.get(CODE_URL.format(appId=APPID, appid=APPID), timeout=15).json()
    code = extract_code(data)
    if not code:
        raise RuntimeError(data.get("msg") or data.get("message") or "code失败")
    return code


def build_login_sign(app_id, post_body, session_id=None, user_id=None, open_id=None):
    rid = req_id()
    req_time = str(int(time.time()))
    actual_sid = session_id if session_id is not None else "-1"
    args = {
        "appId": app_id,
        "reqId": rid,
        "reqTime": req_time,
        "userId": user_id,
        "openID": open_id,
        "sessionID": actual_sid,
        "accessKey": LOGIN_ACCESS_KEY,
        "businessStr": json.dumps(post_body, separators=(",", ":")),
    }
    joined = "&".join(f"{key}={args[key]}" for key in sorted(args) if args[key] is not None)
    sign = sha256_lower(f"{joined}&secretKey={LOGIN_SECRET_KEY}")
    headers = {
        "mapservice-sign-version": "v2",
        "mapservice-sign": sign,
        "mapservice-reqid": rid,
        "mapservice-reqtime": req_time,
        "mapservice-appid": app_id,
        "mapservice-accesskey": LOGIN_ACCESS_KEY,
        "mapservice-sessionid": actual_sid,
    }
    if actual_sid != "-1" and open_id is not None and user_id is not None:
        headers["mapservice-openid"] = open_id
        headers["mapservice-userid"] = str(user_id)
    return headers


def sign_header(open_id):
    rid = req_id()
    timestamp = str(int(time.time()))
    sign = sha256_upper(f"request_id={rid}&from_source={APPID}&timestamp={timestamp}&token={TOKEN}")
    return {"user_id": open_id, "from_source": APPID, "request_id": rid, "timestamp": timestamp, "sign": sign}


def map_h5_sign(uri, login_ssid="", user_id=0):
    rid = req_id()
    req_time = str(int(time.time() * 1000))
    uri_clean = uri.split("?")[0]
    default_sign = md5_text(f"mapinst=0&mapnonce=0&reqid={rid}&reqtime={req_time}{uri_clean}{TMAP_KEY_SUFFIX}")
    return {
        "tmap-reqid": rid,
        "tmap-reqtime": req_time,
        "tmap-userid": str(user_id) if user_id else "0",
        "tmap-login-ssid": login_ssid,
        "tmap-default-sign": default_sign,
    }


def login_with_code(auth_code):
    seq_id = req_id()
    post_body = {"seqid": seq_id, "app_id": APPID, "auth_code": auth_code, "devHeader": {}}
    headers = build_login_sign(APPID, post_body)
    body = json.dumps(post_body, separators=(",", ":"))
    data = requests.post(LOGIN_API_URL, data=body, headers={**headers, "Content-Type": "application/json"}, timeout=10).json()
    if data.get("err_code") == 0:
        return {
            "session_id": data["session_id"],
            "user_id": data["user_id"],
            "openid": data["openid"],
            "union_id": data.get("union_id", ""),
            "map_open_id": data.get("map_open_id", ""),
            "map_session_id": data.get("map_session_id", ""),
        }
    raise RuntimeError(f"登录失败: {data.get('err_msg', data)}")


def check_token(session_id, user_id, open_id):
    post_body = {"app_id": APPID, "token": session_id, "version": 1}
    headers = build_login_sign(APPID, post_body, session_id=session_id, user_id=user_id, open_id=open_id)
    try:
        body = json.dumps(post_body, separators=(",", ":"))
        data = requests.post(CHECKTOKEN_API_URL, data=body, headers={**headers, "Content-Type": "application/json"}, timeout=10).json()
        return data.get("errcode") == 0
    except Exception:
        return False


def get_user_info(session_id, user_id, open_id):
    seq_id = req_id()
    post_body = {"seqid": seq_id, "app_id": APPID, "userId": user_id, "openId": open_id, "source": "mini-tencentmap"}
    headers = build_login_sign(APPID, post_body, session_id=session_id, user_id=user_id, open_id=open_id)
    body = json.dumps(post_body, separators=(",", ":"))
    data = requests.post(USERINFO_API_URL, data=body, headers={**headers, "Content-Type": "application/json"}, timeout=10).json()
    if data.get("err_code") == 0:
        return {"appid": data.get("appid", ""), "nickname": data.get("nickname", "微信用户"), "head_portrait": data.get("head_portrait", "")}
    raise RuntimeError(f"获取用户信息失败: {data}")


def full_login():
    session_data = login_with_code(get_wxcode())
    user_info = get_user_info(session_data["session_id"], session_data["user_id"], session_data["openid"])
    return {
        "userId": session_data["user_id"],
        "openId": session_data["openid"],
        "sessionId": session_data["session_id"],
        "unionId": session_data.get("union_id", ""),
        "mapOpenId": session_data.get("map_open_id", ""),
        "mapSessionId": session_data.get("map_session_id", ""),
        "appId": user_info.get("appid", APPID),
        "nickname": user_info.get("nickname", "微信用户"),
        "headPortrait": user_info.get("head_portrait", ""),
        "loginTime": int(time.time()),
    }


def send_checkin(userid, login_ssid, openid, nickname):
    sign = sign_header(openid)
    map_sign = map_h5_sign("/activity/v1/checkin", login_ssid=login_ssid, user_id=userid)
    headers = {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "Host": "mmapgwh.map.qq.com",
        "Referer": f"https://servicewechat.com/{APPID}/483/page-frame.html",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 MicroMessenger/7.0.20.1781 MiniProgramEnv/Windows",
        "from_source": APPID,
        "request_id": sign["request_id"],
        "sign": sign["sign"],
        "timestamp": sign["timestamp"],
        "tmap-app-id": APPID,
        "tmap-app-version": "0",
        "tmap-channel": "0",
        "tmap-default-sign": map_sign["tmap-default-sign"],
        "tmap-engine": "web",
        "tmap-imei": "0",
        "tmap-install-id": "0",
        "tmap-login-ssid": login_ssid,
        "tmap-mini-login-ssid": TMAP_MINI_LOGIN_SSID_FIXED,
        "tmap-nonce": "0",
        "tmap-openid": openid,
        "tmap-qimei": "0",
        "tmap-qimei36": "0",
        "tmap-reqid": map_sign["tmap-reqid"],
        "tmap-reqtime": map_sign["tmap-reqtime"],
        "tmap-sign": "0",
        "tmap-userid": str(userid),
        "user_id": openid,
        "xweb_xhr": "1",
    }
    payload = {"activity_id": ACTIVITY_ID, "game_id": GAME_ID, "rule_id": RULE_ID, "nick": nickname or NICK}
    data = requests.post(CHECKIN_URL, headers=headers, json=payload, timeout=10).json()
    if data.get("code") == 0:
        prizes = data.get("data", {}).get("prizes", [])
        prize = prizes[0].get("name", "未获得奖品") if prizes else "未获得奖品"
        return True, f"签到成功: {prize}"
    msg = str(data.get("msg") or data.get("message") or "")
    if data.get("code") in (11011, "11011") or "已签到" in msg or "已经签到" in msg:
        return True, msg if "已签到" in msg else f"今日已签到: {msg or '已完成'}"
    return False, f"签到失败(code={data.get('code')}): {data.get('msg') or data.get('message') or data}"


def main():
    try:
        log("开始执行")
        login = full_login()
        log(f"登录成功: {str(login['userId'])[:6]}...")
        ok, message = send_checkin(login["userId"], login.get("sessionId") or login.get("mapSessionId", ""), login["openId"], login.get("nickname", "微信用户"))
        log(message)
        return 0 if ok else 1
    except Exception as exc:
        log(f"执行失败：{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
''',
}

if __name__ == "__main__":
    sys.exit(main())
