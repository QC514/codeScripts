#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================
宝妈上班（张团小程序22）自动赚取贡献值脚本  [支持自动续期]
=============================================
功能:
  1. 自动调用 wolf-order/createContribution 赚取积分 (250积分/次)
  2. 每天运行前自动检测 uniIdToken(JWT) 有效期
  3. 即将过期/已过期时, 通过 VX_GO 取码服务自动续期:
       VX_GO /wx/code -> 微信登录 code
       -> uni-id-co loginByWeixin -> 新 uniIdToken
  4. 续期后的新 token 写入本地缓存, 并可写回青龙环境变量

平台: 青龙面板 (Python3)
原理: 基于 UniCloud (DCloud) API 逆向, HMAC-MD5 签名 (已验证通过)

------------------------------------------------------------
环境变量 (青龙面板添加):
  必需:
    VX_GO                - VX_GO 取码服务 (格式 地址#微信账号标识[#auth],
                            可多行=多账号; 每个微信独立取码并自动续期 token)
  可选:
    WOLF_UID              - 你自己的用户ID [多账号可留空! 脚本登录后会自动
                            从响应提取每个账号的 uid]
    WOLF_UNI_ID_TOKEN     - uniIdToken(JWT) [首次运行填一个即可; 之后脚本
                            自动续期, 可留空]
    WOLF_VX_GO_ENTRY     - 指定只跑 VX_GO 中某一行账号 (填完整行, 如
                            172.17.0.4:8000@xxx); 不填则遍历所有行
    WOLF_MAX_RUNS         - 每次运行最大调用次数 (默认 20)
    WOLF_QYWX_KEY         - 企业微信Webhook Key (运行结果通知, 可选)
    WOLF_APPID            - 目标小程序appid (默认 wxe6cb23a7f02277ed = 宝妈上班, 不变)
    WOLF_RENEW_HOURS      - 续期阈值(小时), token剩余低于此值即自动续期 (默认 12)
    QL_URL                - 青龙地址 (默认 http://127.0.0.1:5700, 脚本在青龙内运行可用)
    QL_CLIENT_ID          - 青龙应用ID (可选, 用于把新token写回青龙环境变量)
    QL_CLIENT_SECRET      - 青龙应用密钥 (可选)
  注意: SPACE_ID / CLIENT_SECRET / WX_APPID / UNI_APPID 是"宝妈上班"小程序专属,
        只要目标小程序不变就无需修改。
------------------------------------------------------------
说明:
  * accessToken(x-basement-token) 每次运行自动获取, 无需手动填写
  * clientSecret 已内置, 无需填写
  * 续期条件: token 剩余有效期 < WOLF_RENEW_HOURS (默认 12) 小时, 或 token 缺失/解析失败
  * 续期成功后写入脚本同目录 wolf_token_cache_{账号ref}.json (按账号隔离);
    下次运行优先使用各账号缓存中最新且有效的 token
"""

# === VX_GO 统一通知注入 begin ===
import atexit
import importlib
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

_YYB_KEY_NAMES = ("WOLF_QYWX_KEY", "QYWX_KEY", "QYWX", "WEWORK_KEY")
_YYB_LOG_LIMIT = 40
_yyb_logs = []
_yyb_notification_sent = False
_yyb_footer_printed = False
_yyb_original_stdout = sys.stdout
_yyb_original_stderr = sys.stderr
_yyb_raw_servers = os.environ.get("VX_GO", "")
_yyb_servers = [item.strip() for item in re.split(r"\r?\n|&", _yyb_raw_servers) if item.strip()]
_yyb_seen_accounts = []
_yyb_failed_accounts = set()
_yyb_current_account = None
_yyb_display_names = {}


def _yyb_now_text():
    from datetime import datetime

    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _yyb_display_width(text):
    width = 0
    for char in str(text):
        width += 2 if unicodedata.east_asian_width(char) in "WFA" else 1
    return width


def _yyb_emit_raw(line="", stream=None):
    target = stream or _yyb_original_stdout
    target.write(f"{line}\n")
    target.flush()
    if line:
        _yyb_logs.append(line)


def _yyb_emit_box(lines, account=False):
    top_left, horizontal, top_right = ("┌", "─", "┐") if account else ("╔", "═", "╗")
    bottom_left, bottom_right = ("└", "┘") if account else ("╚", "╝")
    vertical = "│" if account else "║"
    width = max(50, *(max(0, _yyb_display_width(line) + 1) for line in lines))
    _yyb_emit_raw(top_left + horizontal * width + top_right)
    for line in lines:
        padding = max(0, width - 1 - _yyb_display_width(line))
        _yyb_emit_raw(f"{vertical} {line}{' ' * padding}{vertical}")
    _yyb_emit_raw(bottom_left + horizontal * width + bottom_right)


def _yyb_script_title():
    source_path = globals().get("__file__") or (sys.argv[0] if sys.argv else "")
    fallback = os.path.splitext(os.path.basename(source_path))[0] or "VX_GO"
    try:
        with open(source_path, encoding="utf-8") as script_file:
            source = script_file.read()
        marker = "\n# === VX_GO 统一通知注入 end ==="
        source = source.split(marker, 1)[-1]
        name_match = re.search(r"(?m)^#\s*name:\s*(.+?)\s*$", source)
        doc_match = re.search(
            r'''(?s)(?:[rubfRUBF]*)?(?:"""|\'\'\')(.*?)(?:"""|\'\'\')''', source
        )
        if doc_match:
            for candidate in doc_match.group(1).splitlines():
                candidate = candidate.strip()
                if candidate and not set(candidate) <= {"=", "-", "*"}:
                    return candidate
        if name_match:
            return name_match.group(1).strip()
    except (OSError, UnicodeError):
        pass
    return fallback


def _yyb_title_icon(title):
    for keyword, icon in (
        ("回收", "♻️"),
        ("甜心", "🍰"),
        ("茶", "🧋"),
        ("酒", "🍺"),
        ("停车", "🚗"),
        ("养车", "🚗"),
        ("绿", "🌿"),
        ("雀巢", "☕"),
    ):
        if keyword in title:
            return icon
    return "🚀"


def _yyb_emit_startup():
    if _yyb_servers:
        _yyb_emit_raw(f"✅ 成功读取 {len(_yyb_servers)} 台内网wxcode服务：")
        for server in _yyb_servers:
            _yyb_emit_raw(f" - {_yyb_display_name(server)}")
        _yyb_emit_raw("-" * 60)
        _yyb_emit_raw()

    title = _yyb_script_title()
    _yyb_emit_box(
        [
            f"{_yyb_title_icon(title)} {title}",
            f"🕒 启动时间: {_yyb_now_text()}",
            f"🔢 账号数量: {len(_yyb_servers)}",
        ]
    )


def _yyb_server_match_values(server):
    values = [server]
    address = re.split(r"[@#]", server, maxsplit=1)[0].strip().rstrip("/")
    values.extend(
        [
            address,
            address.removeprefix("http://").removeprefix("https://"),
        ]
    )
    return [value for value in values if value]


def _yyb_display_name(server):
    if server in _yyb_display_names:
        return _yyb_display_names[server]
    _parts = re.split(r"[@#]", server, maxsplit=2)
    return _parts[1].strip() if len(_parts) >= 2 and _parts[1].strip() else server


def _yyb_load_display_names():
    for server in _yyb_servers:
        _parts = re.split(r"[@#]", server, maxsplit=2)
        address = _parts[0].strip().rstrip("/") if _parts else ""
        openid = _parts[1].strip() if len(_parts) > 1 else ""
        auth = (_parts[2].strip() if len(_parts) > 2 else "") or os.environ.get("auth", "") or os.environ.get("AUTH", "")
        separator = len(_parts) >= 2
        fallback = openid or server
        _yyb_display_names[server] = fallback
        if not separator or not address or not openid:
            continue
        if not address.startswith(("http://", "https://")):
            address = f"http://{address}"
        query = urllib.parse.urlencode({"openid": openid})
        _headers = {"Accept": "application/json"}
        if auth:
            _headers["Authorization"] = f"Bearer {auth}"
        request = urllib.request.Request(
            f"{address}/accounts/profile?{query}",
            headers=_headers,
        )
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                payload = json.loads(response.read().decode("utf-8"))
            data = payload.get("data") if payload.get("code") == 0 else None
            if isinstance(data, dict):
                name = data.get("nickname") or data.get("alias") or fallback
                name = re.sub(r"[\r\n]+", " ", str(name)).strip()
                _yyb_display_names[server] = name or fallback
        except Exception:
            pass


def _yyb_replace_server_names(line):
    text = str(line)
    for server in _yyb_servers:
        text = text.replace(server, _yyb_display_name(server))
    candidates = (
        [_yyb_current_account] if _yyb_current_account in _yyb_servers else _yyb_servers
    )
    for server in candidates:
        values = sorted(_yyb_server_match_values(server)[1:], key=len, reverse=True)
        for value in values:
            text = text.replace(value, _yyb_display_name(server))
    return text


def _yyb_ensure_account(server):
    global _yyb_current_account

    if server in _yyb_seen_accounts:
        _yyb_current_account = server
        return
    _yyb_seen_accounts.append(server)
    _yyb_current_account = server
    index = (
        _yyb_servers.index(server) + 1
        if server in _yyb_servers
        else len(_yyb_seen_accounts)
    )
    total = len(_yyb_servers) or len(_yyb_seen_accounts)
    _yyb_emit_raw()
    _yyb_emit_box(
        [f"🧩 账号 {index} / {total}", f"🌍 昵称 {_yyb_display_name(server)}"],
        account=True,
    )


def _yyb_detect_account(line):
    for server in _yyb_servers:
        if server in line:
            _yyb_ensure_account(server)
            return
    if _yyb_current_account in _yyb_servers and any(
        value in line for value in _yyb_server_match_values(_yyb_current_account)
    ):
        return
    for server in _yyb_servers:
        if any(value in line for value in _yyb_server_match_values(server)[1:]):
            _yyb_ensure_account(server)
            return
    match = re.search(r"账号\s*(\d+)", line)
    if match and _yyb_servers:
        index = int(match.group(1)) - 1
        if 0 <= index < len(_yyb_servers):
            _yyb_ensure_account(_yyb_servers[index])


def _yyb_is_duplicate_config(line):
    stripped = line.strip()
    if "成功读取" in stripped and ("内网" in stripped or "服务" in stripped):
        return True
    if stripped.startswith("-") and any(server in stripped for server in _yyb_servers):
        return True
    if len(stripped) >= 20 and set(stripped) <= {"-", "=", "_", "━"}:
        return True
    return False


def _yyb_log_tag(line):
    context = line.split("{", 1)[0]
    lowered = context.lower()
    if "pushplus" in lowered or "推送" in context:
        return "PushPlus"
    if "执行失败" in context or "执行异常" in context:
        return "账号"
    if (
        "代理" in context
        or "proxy" in lowered
        or (
            re.search(r"\d{1,3}(?:\.\d{1,3}){3}:\d+", context)
            and any(word in context for word in ("提取", "生成", "获取"))
        )
    ):
        return "代理"
    if "登录" in context or "token" in lowered or "授权" in context:
        return "登录"
    if "code" in lowered or "取码" in context:
        return "取码"
    if "签到" in context or "sign" in lowered:
        return "签到"
    if "积分" in context or "余额" in context or "账户" in context:
        return "账户"
    if "等待" in context or "延迟" in context or "sleep" in lowered:
        return "延迟"
    if "账号" in context:
        return "账号"
    return "任务"


def _yyb_normalize_line(line, stderr=False):
    stripped = line.strip()
    if not stripped:
        return ""
    account_name = None
    for name in _yyb_display_names.values():
        prefix = f"[{name}]"
        if stripped.startswith(prefix):
            account_name = name
            stripped = stripped[len(prefix) :].strip()
            break
    stripped = re.sub(
        r"(请求\s*(?:YYB|VX)\s*Go\s*获取\s*code)\s*[:：].*$",
        r"\1",
        stripped,
        flags=re.IGNORECASE,
    )
    if stripped.startswith("["):
        return stripped
    if re.match(r"^[^\w\s]{1,3}\s*\[[^]]+\]", stripped):
        return stripped

    for prefix in (
        "✅",
        "❌",
        "⚠️",
        "⚠",
        "ℹ️",
        "ℹ",
        "🌐",
        "🛠️",
        "🛠",
        "⏳",
        "🔐",
        "🎯",
        "🎰",
        "💰",
        "💸",
        "📊",
        "📡",
        "📝",
        "🔁",
        "🚀",
    ):
        if stripped.startswith(prefix):
            stripped = stripped[len(prefix) :].strip()
            break

    lowered = stripped.lower()
    tag = _yyb_log_tag(stripped)
    if stderr or any(word in lowered for word in ("error", "exception", "traceback")):
        icon = "❌"
    elif any(word in stripped for word in ("失败", "错误", "异常")):
        icon = "❌"
    elif any(
        word in stripped
        for word in (
            "警告",
            "跳过",
            "已签到",
            "已经签到",
            "不可用",
            "未配置",
        )
    ):
        icon = "⚠️"
    elif any(word in stripped for word in ("等待", "延迟")):
        icon = "⏳"
    elif tag == "签到" and "成功" in stripped:
        icon = "📊"
    elif tag == "账户":
        icon = "💰"
    elif any(word in stripped for word in ("成功", "完成", "通过", "获得", "提取到")):
        icon = "✅"
    elif tag == "取码" and "请求" in stripped:
        icon = "🌐"
    elif tag == "代理" and "生成" in stripped:
        icon = "🛠️"
    elif tag == "代理":
        icon = "🌐"
    elif tag == "登录":
        icon = "🔐"
    else:
        icon = "ℹ️"
    return f"{icon} [{account_name or tag}] {stripped}"


def _yyb_record_status(line):
    if not _yyb_current_account:
        return
    fatal = line.startswith("❌") and any(
        word in line
        for word in ("[账号]", "[主程序]", "[登录]", "执行失败", "执行异常")
    )
    if fatal:
        _yyb_failed_accounts.add(_yyb_current_account)


def _yyb_emit_footer():
    global _yyb_footer_printed

    if _yyb_footer_printed:
        return
    _yyb_footer_printed = True
    total = len(_yyb_servers) or len(_yyb_seen_accounts)
    failed = len(_yyb_failed_accounts)
    success = max(0, total - failed)
    title = _yyb_script_title().split("（", 1)[0].split("(", 1)[0]
    _yyb_emit_raw()
    _yyb_emit_box(
        [
            f"🏁 {title}任务执行完成",
            f"✅ 成功: {success}",
            f"❌ 失败: {failed}",
            f"🕒 结束时间: {_yyb_now_text()}",
        ]
    )


def _yyb_process_line(line, stream, stderr=False):
    stripped = line.rstrip("\r")
    _yyb_detect_account(stripped)
    if _yyb_is_duplicate_config(stripped):
        return
    stripped = _yyb_replace_server_names(stripped)
    if stripped.startswith(("╔", "║", "╚", "┌", "│", "└")):
        return
    if "任务执行完成" in stripped or re.match(
        r"^[✅❌🕒]\s*(成功|失败|结束时间)\s*[:：]", stripped
    ):
        return

    normalized = _yyb_normalize_line(stripped, stderr=stderr)
    _yyb_record_status(normalized)
    push_event = (
        _yyb_log_tag(stripped) == "PushPlus"
        and not re.match(r"^\s*[=\-*]", stripped)
        and any(
            keyword in stripped
            for keyword in (
                "开始推送",
                "正在推送",
                "未配置",
                "跳过",
                "成功",
                "失败",
                "异常",
            )
        )
    )
    if push_event:
        _yyb_emit_footer()
    _yyb_emit_raw(normalized, stream=stream)


def _yyb_compact_json_output(text):
    value = str(text)
    if "\n" not in value and "\r" not in value:
        return value
    body = value.rstrip("\r\n")
    ending = value[len(body) :]
    decoder = json.JSONDecoder()
    for index, char in enumerate(body):
        if char not in "[{":
            continue
        try:
            payload, end = decoder.raw_decode(body[index:])
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if body[index + end :].strip():
            continue
        compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        return f"{body[:index]}{compact}{ending}"
    return value


class _YybLogStream:
    """Format, mirror, and collect complete output lines."""

    _yyb_capture_installed = True

    def __init__(self, stream, stderr=False):
        self._stream = stream
        self._stderr = stderr
        self._buffer = ""

    def __getattr__(self, name):
        return getattr(self._stream, name)

    def flush(self):
        if self._buffer:
            _yyb_process_line(self._buffer, self._stream, self._stderr)
            self._buffer = ""
        self._stream.flush()

    def write(self, text):
        value = str(text)
        accepted = len(value)
        self._buffer += _yyb_compact_json_output(value)
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            _yyb_process_line(line, self._stream, self._stderr)
        return accepted

    def writelines(self, lines):
        for line in lines:
            self.write(line)


def _yyb_install_output_capture():
    if not getattr(sys.stdout, "_yyb_capture_installed", False):
        sys.stdout = _YybLogStream(sys.stdout)
    if not getattr(sys.stderr, "_yyb_capture_installed", False):
        sys.stderr = _YybLogStream(sys.stderr, stderr=True)


def _yyb_flush_captured_output():
    sys.stdout.flush()
    sys.stderr.flush()


def _yyb_resolve_key():
    for name in _YYB_KEY_NAMES:
        key = os.environ.get(name)
        if key:
            return key
    for candidate in ("sendNotify.js", "/ql/data/scripts/sendNotify.js"):
        try:
            with open(candidate, encoding="utf-8") as notify_file:
                source = notify_file.read()
            match = re.search(r"QYWX_KEY\s*=\s*['\"]([^'\"]+)['\"]", source)
            if match:
                return match.group(1)
        except (OSError, UnicodeError):
            continue
    return None


def _yyb_build_notification():
    _yyb_flush_captured_output()
    title = os.path.basename(sys.argv[0]) if sys.argv else "VX_GO"
    body = "\n".join(_yyb_logs[-_YYB_LOG_LIMIT:])
    return title, body or "任务执行完成，无日志输出。"


def _yyb_push_notification():
    global _yyb_notification_sent

    if _yyb_notification_sent:
        return
    _yyb_notification_sent = True
    _yyb_flush_captured_output()
    _yyb_emit_footer()
    try:
        title, body = _yyb_build_notification()
        try:
            notify_module = importlib.import_module("sendNotify")
            send_notify = getattr(notify_module, "sendNotify", None)
        except ImportError:
            send_notify = None
        if callable(send_notify):
            try:
                send_notify(title, body)
                return
            except Exception:
                pass
        key = _yyb_resolve_key()
        if not key:
            return
        payload = json.dumps(
            {"msgtype": "text", "text": {"content": f"【{title}】\n{body}"}},
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib.request.Request(
            f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=15):
            pass
    except Exception:
        pass


_yyb_original_os_exit = os._exit


def _yyb_patched_os_exit(code=0):
    _yyb_push_notification()
    _yyb_original_os_exit(code)


_yyb_load_display_names()
_yyb_install_output_capture()
_yyb_emit_startup()
try:
    os._exit = _yyb_patched_os_exit
except (AttributeError, TypeError):
    pass
atexit.register(_yyb_push_notification)
# === VX_GO 统一通知注入 end ===

import base64
import hashlib
import hmac
import json
import os
import random
import re
import sys
import time

import requests

# ============ 常量配置 (已从wxapkg提取 / 已逆向验证) ============
SPACE_ID = "mp-50d375d9-5c5e-4271-8517-b09cb093334b"
CLIENT_SECRET = "Gf/DmFLzvUNIqaty2aIXEQ=="  # 从wxapkg提取, HMAC-MD5签名密钥
API_URL = "https://api.next.bspapp.com/client"
WX_APPID = "wxe6cb23a7f02277ed"
UNI_APPID = "__UNI__AE9315F"
APP_NAME = "张团--小程序22"

# ============ 从环境变量读取 ============
# 注意: 以下专属于使用者自己的配置, 不写默认值, 避免误用他人服务/账号
UID = os.environ.get("WOLF_UID", "")
UNI_ID_TOKEN = os.environ.get("WOLF_UNI_ID_TOKEN", "")
MAX_RUNS = int(os.environ.get("WOLF_MAX_RUNS", "20"))
RENEW_HOURS = float(os.environ.get("WOLF_RENEW_HOURS", "12"))

TARGET_APPID = os.environ.get("WOLF_APPID", "wxe6cb23a7f02277ed")

# 青龙写回 (可选)
QL_URL = os.environ.get("QL_URL", "http://127.0.0.1:5700")
QL_CLIENT_ID = os.environ.get("QL_CLIENT_ID", "")
QL_CLIENT_SECRET = os.environ.get("QL_CLIENT_SECRET", "")

# accessToken (运行时自动获取, 有效期10分钟)
_access_token = ""
_token_expire_time = 0

# token 缓存文件 (集中存放在脚本同目录下的专用文件夹, 不与脚本混放)
TOKEN_CACHE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "wolf_token_caches"
)
CACHE_PATH = os.path.join(TOKEN_CACHE_DIR, "wolf_token_cache.json")


# ============ VX_GO 取码服务 (地址#微信账号标识[#auth] 多行) ============
VX_GO_RAW = os.environ.get("VX_GO", "")


def parse_yyb_go_entry(raw):
    value = (raw or "").strip()
    if not value:
        return None, None, None
    parts = re.split(r"[@#]", value, maxsplit=2)
    if len(parts) < 2:
        print(f"  [VX_GO] 格式应为 地址#微信账号标识[#auth], 当前值: {value}")
        return None, None, None
    server = parts[0].strip()
    ref = parts[1].strip()
    auth = (parts[2].strip() if len(parts) > 2 else "") or os.environ.get("auth", "") or os.environ.get("AUTH", "")
    if server.startswith("http://"):
        server = server[7:]
    elif server.startswith("https://"):
        server = server[8:]
    server = server.rstrip("/")
    if not server or not ref:
        return None, None, None
    return server, ref, auth


def get_yyb_go_code(entry):
    """通过 VX_GO 服务获取指定账号的微信登录 code (entry 格式: 地址#微信账号标识[#auth])"""
    if not entry:
        return None
    server, ref, auth = parse_yyb_go_entry(entry)
    if not server or not ref:
        print(f"  [VX_GO] 无效 entry: {entry}")
        return None
    try:
        url = f"http://{server}/wx/code"
        _headers = {"Authorization": f"Bearer {auth}"} if auth else None
        r = requests.post(
            url, json={"openid": ref, "appid": TARGET_APPID, "data": {}}, timeout=20, headers=_headers
        ).json()
        code = r.get("data", {}).get("code")
        if r.get("code") != 0 or not code:
            print(
                f"  [VX_GO] 取码失败 ({ref}): "
                f"{json.dumps(r, ensure_ascii=False)[:200]}"
            )
            return None
        print(f"  [VX_GO] 取码成功 ({server})")
        return code
    except Exception as e:
        print(f"  [VX_GO] 取码异常: {e}")
        return None


# ============ 签名算法 (HMAC-MD5, 已验证通过) ============
def generate_sign(body_data):
    sorted_keys = sorted(body_data.keys())
    parts = []
    for k in sorted_keys:
        v = str(body_data[k])
        if v:  # 跳过空值
            parts.append(f"{k}={v}")
    sign_string = "&".join(parts)
    return hmac.new(
        CLIENT_SECRET.encode("utf-8"),
        sign_string.encode("utf-8"),
        digestmod=hashlib.md5,
    ).hexdigest()


def _headers(extra=None):
    h = {
        "Content-Type": "application/json",
        "charset": "utf-8",
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 12; Redmi K30 Pro Build/SKQ1.211006.001; wv) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.178 "
            "Mobile Safari/537.36 MicroMessenger/8.0.71"
        ),
        "Referer": f"https://servicewechat.com/{WX_APPID}/3/page-frame.html",
    }
    if extra:
        h.update(extra)
    return h


def get_access_token():
    """调用 anonymousAuthorize 获取 accessToken (有效期600秒, 每次运行自动获取)"""
    global _access_token, _token_expire_time
    if _access_token and time.time() < _token_expire_time - 30:
        return _access_token
    timestamp = int(time.time() * 1000)
    body = {
        "method": "serverless.auth.user.anonymousAuthorize",
        "params": "{}",
        "spaceId": SPACE_ID,
        "timestamp": timestamp,
    }
    h = _headers({"x-serverless-sign": generate_sign(body)})
    try:
        resp = requests.post(API_URL, json=body, headers=h, timeout=30).json()
        if resp.get("success"):
            data = resp.get("data", {})
            _access_token = data.get("accessToken", "")
            _token_expire_time = time.time() + data.get("expiresInSecond", 600)
            return _access_token
        print(f"  [accessToken] 获取失败: {json.dumps(resp, ensure_ascii=False)[:200]}")
        return None
    except Exception as e:
        print(f"  [accessToken] 异常: {e}")
        return None


def build_client_info():
    return {
        "PLATFORM": "mp-weixin",
        "OS": "android",
        "APPID": UNI_APPID,
        "DEVICEID": str(random.randint(10**18, 10**19 - 1)),
        "scene": 1011,
        "appId": UNI_APPID,
        "appName": APP_NAME,
        "appVersion": "1.0.0",
        "appVersionCode": "100",
        "appLanguage": "zh-Hans",
        "hostVersion": "8.0.71",
        "hostName": "WeChat",
        "uniPlatform": "mp-weixin",
        "uniCompilerVersion": "5.07",
        "uniRuntimeVersion": "5.07",
        "deviceType": "phone",
        "deviceBrand": "redmi",
        "deviceModel": "Redmi K30 Pro",
        "osName": "android",
        "osVersion": "12",
        "locale": "zh-Hans",
        "LOCALE": "zh-Hans",
    }


def call_api(function_target, function_args, retry_on_token_expired=True):
    """调用 UniCloud 云函数 (自动注入 clientInfo/uniIdToken/accessToken/签名)"""
    token = get_access_token()
    if not token:
        return None
    args = json.loads(json.dumps(function_args))
    if "clientInfo" not in args:
        args["clientInfo"] = build_client_info()
    if "uniIdToken" not in args:
        args["uniIdToken"] = UNI_ID_TOKEN
    ts = int(time.time() * 1000)
    body = {
        "method": "serverless.function.runtime.invoke",
        "params": json.dumps(
            {"functionTarget": function_target, "functionArgs": args},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        "spaceId": SPACE_ID,
        "timestamp": ts,
        "token": token,
    }
    h = _headers({"x-basement-token": token, "x-serverless-sign": generate_sign(body)})
    try:
        resp = requests.post(API_URL, json=body, headers=h, timeout=30).json()
        if retry_on_token_expired and not resp.get("success"):
            err = resp.get("error", {})
            if err.get("code") == "GATEWAY_INVALID_TOKEN":
                print("  [call_api] accessToken 过期, 刷新重试...")
                global _access_token, _token_expire_time
                _access_token = ""
                _token_expire_time = 0
                return call_api(
                    function_target, function_args, retry_on_token_expired=False
                )
        return resp
    except Exception as e:
        print(f"  [call_api] 异常: {e}")
        return None


# ============ token 续期 ============
def jwt_remaining_hours(token):
    """返回 JWT 剩余有效小时数; 无法解析返回 None"""
    try:
        p = token.split(".")[1]
        p += "=" * (4 - len(p) % 4)
        payload = json.loads(base64.urlsafe_b64decode(p))
        exp = payload.get("exp", 0)
        return (exp - int(time.time())) / 3600
    except Exception:
        return None


def cache_path_for(entry):
    """按账号隔离 token 缓存: 用 entry 的 ref 部分生成独立缓存文件"""
    _, ref, _ = parse_yyb_go_entry(entry)
    if not ref:
        ref = "default"
    safe = re.sub(r"[^A-Za-z0-9]", "_", ref)[:48]
    os.makedirs(TOKEN_CACHE_DIR, exist_ok=True)
    return os.path.join(TOKEN_CACHE_DIR, f"wolf_token_cache_{safe}.json")


def load_cache(path=None):
    try:
        p = path or CACHE_PATH
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return None


def save_cache(token, path=None):
    try:
        p = path or CACHE_PATH
        os.makedirs(os.path.dirname(p), exist_ok=True)
        rem = jwt_remaining_hours(token)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "token": token,
                    "saved_at": int(time.time()),
                    "expired": int(time.time()) + (rem * 3600 if rem else 0),
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        print(f"  [cache] 已写入本地缓存, 有效期剩余约 {rem:.1f}h")
    except Exception as e:
        print(f"  [cache] 写入失败: {e}")


def fetch_wx_code(entry):
    """获取微信登录 code (仅通过 VX_GO 取码服务)"""
    return get_yyb_go_code(entry)


def renew_token(entry):
    """完整续期: VX_GO取码 -> uni-id-co loginByWeixin -> 新 uniIdToken"""
    if not entry:
        print("  [续期] 缺少 VX_GO 账号配置 (entry 为空)")
        return None
    print("  [续期] 步骤1: 从 VX_GO 获取微信登录 code ...")
    code = fetch_wx_code(entry)
    if not code:
        return None
    print(f"  [续期] 拿到 code: {code[:12]}...")

    print("  [续期] 步骤2: 匿名授权获取 accessToken ...")
    at = get_access_token()
    if not at:
        return None

    print("  [续期] 步骤3: loginByWeixin 换取新 uniIdToken ...")
    fa = {
        "method": "loginByWeixin",
        "params": [{"code": code}],
        "clientInfo": build_client_info(),
    }
    ts = int(time.time() * 1000)
    body = {
        "method": "serverless.function.runtime.invoke",
        "params": json.dumps(
            {"functionTarget": "uni-id-co", "functionArgs": fa},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        "spaceId": SPACE_ID,
        "timestamp": ts,
        "token": at,
    }
    h = _headers({"x-basement-token": at, "x-serverless-sign": generate_sign(body)})
    try:
        resp = requests.post(API_URL, json=body, headers=h, timeout=30).json()
    except Exception as e:
        print(f"  [续期] loginByWeixin 异常: {e}")
        return None
    if not resp.get("success"):
        print(
            f"  [续期] loginByWeixin 失败: {json.dumps(resp, ensure_ascii=False)[:200]}"
        )
        return None
    data = resp.get("data", {})
    new_token = (
        data.get("newToken", {}).get("token")
        or data.get("token")
        or data.get("uniIdToken")
    )
    if not new_token:
        print(
            f"  [续期] 响应中未找到 token: {json.dumps(resp, ensure_ascii=False)[:200]}"
        )
        return None
    print("  [续期] 成功获取新 uniIdToken ✅")
    return new_token


def resolve_token(entry, allow_env=True):
    """
    解析指定账号应使用的 token (按账号隔离缓存):
      优先取 (env, 仅单账号) / 该账号缓存中剩余有效期最长且仍有效的一个。
      若最佳 token 剩余 < RENEW_HOURS 或不存在, 则触发续期。
    多账号模式必须 allow_env=False: 否则 WOLF_UNI_ID_TOKEN(某一个账号的身份)
    会被其它账号复用, 导致所有账号操作同一个 uid。
    返回 (token, source)
    """
    candidates = []
    env_tok = UNI_ID_TOKEN.strip()
    if allow_env and env_tok:
        candidates.append(("env", env_tok))
    cache = load_cache(cache_path_for(entry))
    if cache and cache.get("token"):
        candidates.append(("cache", cache["token"]))

    best, best_src, best_rem = None, None, -1
    for src, tok in candidates:
        rem = jwt_remaining_hours(tok)
        if rem is not None and rem > 0 and rem > best_rem:
            best, best_src, best_rem = tok, src, rem

    # 需要续期的情况
    if best is None or best_rem < RENEW_HOURS:
        reason = (
            "无有效token" if best is None else f"剩余 {best_rem:.1f}h < {RENEW_HOURS}h"
        )
        print(f"[token] 需要续期 ({reason})")
        new_tok = renew_token(entry)
        if new_tok:
            save_cache(new_tok, cache_path_for(entry))
            return new_tok, "renewed"
        # 续期失败, 退回已有最佳 token (若仍有用)
        if best:
            print(f"[token] 续期失败, 退回 {best_src} token (剩余 {best_rem:.1f}h)")
            return best, best_src
        return None, None

    print(f"[token] 使用 {best_src} token, 剩余约 {best_rem:.1f}h")
    return best, best_src


# ============ 青龙环境变量写回 (可选) ============
def update_qinglong_env(name, value):
    if not QL_CLIENT_ID or not QL_CLIENT_SECRET:
        return False
    try:
        # 1) 获取青龙 openapi token
        r = requests.get(
            f"{QL_URL}/open/auth/token",
            params={"client_id": QL_CLIENT_ID, "client_secret": QL_CLIENT_SECRET},
            timeout=15,
        ).json()
        if r.get("code") != 200:
            print(f"  [青龙] 获取token失败: {r.get('message')}")
            return False
        ql_token = r["data"]["token"]
        # 2) 查找环境变量
        r = requests.get(
            f"{QL_URL}/api/env",
            params={"searchValue": name, "token": ql_token},
            timeout=15,
        ).json()
        env_id = None
        if r.get("code") == 200:
            for item in r.get("data", {}).get("content", []):
                if item.get("name") == name:
                    env_id = item["id"]
                    break
        # 3) 更新或创建
        if env_id:
            body = [
                {
                    "id": env_id,
                    "name": name,
                    "value": value,
                    "remarks": "auto-renewed by wolf_bmbsh",
                }
            ]
            r = requests.put(
                f"{QL_URL}/api/env", json=body, params={"token": ql_token}, timeout=15
            ).json()
        else:
            body = [
                {"name": name, "value": value, "remarks": "auto-renewed by wolf_bmbsh"}
            ]
            r = requests.post(
                f"{QL_URL}/api/env", json=body, params={"token": ql_token}, timeout=15
            ).json()
        if r.get("code") == 200:
            print(f"  [青龙] 已更新环境变量 {name}")
            return True
        print(f"  [青龙] 更新环境变量失败: {r.get('message')}")
        return False
    except Exception as e:
        print(f"  [青龙] 写回异常: {e}")
        return False


# ============ 业务逻辑 ============
def create_contribution():
    return call_api(
        "wolf-order", {"method": "createContribution", "params": [{"uid": UID}]}
    )


def get_daily_count():
    now_ts = int(time.time() * 1000)
    beijing = (int(time.time()) + 8 * 3600) % 86400
    today_start_ms = (int(time.time()) - beijing) * 1000
    return call_api(
        "DCloud-clientDB",
        {
            "command": {
                "$db": [
                    {"$method": "collection", "$param": ["wolf-contribution"]},
                    {
                        "$method": "where",
                        "$param": [
                            f'uid=="{UID}" && create_time>{today_start_ms} && type==0'
                        ],
                    },
                    {"$method": "count", "$param": []},
                ]
            }
        },
    )


def get_user_info():
    return call_api(
        "DCloud-clientDB",
        {
            "command": {
                "$db": [
                    {"$method": "collection", "$param": ["uni-id-users"]},
                    {"$method": "where", "$param": ["'_id' == $cloudEnv_uid"]},
                    {
                        "$method": "field",
                        "$param": [
                            "uid,_id,mobile,nickname,my_invite_code,money,score,level"
                        ],
                    },
                    {"$method": "get", "$param": []},
                ]
            }
        },
    )


def extract_uid():
    """从当前登录账号的 uni-id-users 记录中提取该账号的 uid (用于区分多账号)"""
    ui = get_user_info()
    if ui and ui.get("success"):
        u = ui.get("data", {}).get("data", [])
        if u:
            u = u[0]
            uid = u.get("uid") or u.get("_id")
            if uid:
                return str(uid)
    return None


# 注: 通知已统一由文件顶部「VX_GO 统一通知注入」块在退出时收集完整日志并推送,
#     任何退出路径 (成功/失败/零成功/异常) 都会发送, 无需此处单独 send_notify。


# ============ 主流程 ============
def run_account(entry, allow_env=True):
    """为单个 VX_GO 账号执行完整流程, 返回汇总 dict"""
    server, ref, _ = parse_yyb_go_entry(entry)
    if not server or not ref:
        print(f"\n  [账号] 跳过无效 entry: {entry}")
        return {
            "entry": entry,
            "ok": False,
            "reason": "无效 entry",
            "earned": 0,
            "success": 0,
        }
    print(f"\n{'#' * 60}\n# 账号: {server} @ {ref}\n{'#' * 60}")

    # 1) token (按账号隔离; 多账号模式禁用 env 共享)
    print("\n[1/4] 解析并校验 uniIdToken ...")
    token, src = resolve_token(entry, allow_env=allow_env)
    if not token:
        print("  无法获取有效 token, 跳过该账号")
        return {
            "entry": entry,
            "ok": False,
            "reason": "no token",
            "earned": 0,
            "success": 0,
        }
    global UNI_ID_TOKEN, UID
    UNI_ID_TOKEN = token  # 后续业务调用使用续期后的 token

    # 2) 提取本账号 uid
    print("\n[2/4] 获取本账号 uid ...")
    acc_uid = extract_uid()
    if not acc_uid:
        print("  无法获取该账号 uid, 跳过")
        return {
            "entry": entry,
            "ok": False,
            "reason": "no uid",
            "earned": 0,
            "success": 0,
        }
    UID = acc_uid
    print(f"  本账号 uid: {acc_uid}")

    # 3) 查询今日状态
    print("\n[3/4] 查询今日状态 ...")
    dc = get_daily_count()
    if dc and dc.get("success"):
        print(f"  今日已领取次数: {dc.get('data', {}).get('total', '?')}")
    else:
        print(
            f"  查询失败: {json.dumps(dc, ensure_ascii=False)[:150] if dc else 'None'}"
        )
    ui = get_user_info()
    if ui and ui.get("success"):
        u = ui.get("data", {}).get("data", [])
        if u:
            u = u[0]
            print(
                f"  昵称: {u.get('nickname')} | 积分: {u.get('score')} | "
                f"余额: {u.get('money')}"
            )

    # 4) 自动赚取
    print(f"\n[4/4] 开始自动赚取 (最多 {MAX_RUNS} 次) ...")
    total_earned, success_count, consecutive_fail = 0, 0, 0
    for i in range(MAX_RUNS):
        print(f"\n  [{i + 1}/{MAX_RUNS}] createContribution ...")
        res = create_contribution()
        if not res:
            consecutive_fail += 1
            print("  网络异常")
            if consecutive_fail >= 3:
                print("  连续3次失败, 终止")
                break
            time.sleep(random.randint(10, 20))
            continue
        if not res.get("success"):
            consecutive_fail += 1
            print(f"  API失败: {json.dumps(res, ensure_ascii=False)[:150]}")
            if consecutive_fail >= 3:
                print("  连续3次失败, 终止")
                break
            time.sleep(random.randint(10, 20))
            continue
        d = res.get("data", {})
        if d.get("errCode") == 0:
            inner = d.get("data", {})
            total_earned += inner.get("cons", 0)
            success_count += 1
            consecutive_fail = 0
            print(
                f"  发放成功! 贡献值: {inner.get('cons')}, "
                f"今日总次数: {inner.get('count')}"
            )
        else:
            msg = d.get("errMsg", "未知")
            print(f"  失败 (errCode={d.get('errCode')}): {msg}")
            if any(
                kw in msg for kw in ["上限", "超过", "限制", "已达", "满了", "次数"]
            ):
                print("  已达上限, 终止")
                break
            consecutive_fail += 1
            if consecutive_fail >= 3:
                print("  连续3次业务失败, 终止")
                break
        if i < MAX_RUNS - 1:
            delay = random.randint(30, 60)
            print(f"  等待 {delay}s ...")
            time.sleep(delay)

    print(f"\n  本账号完成: 成功 {success_count} 次, 贡献值 {total_earned}")
    return {
        "entry": entry,
        "ok": True,
        "src": src,
        "earned": total_earned,
        "success": success_count,
        "uid": acc_uid,
    }


def main():
    print("=" * 50)
    print("  宝妈上班 自动赚取贡献值 (多账号版, 含自动续期)")
    print("=" * 50)

    if not VX_GO_RAW:
        print("  缺少 VX_GO 配置, 退出")
        sys.exit(1)

    entries = [e for e in re.split(r"\r?\n|&", VX_GO_RAW) if e.strip()]
    if not entries:
        print("  VX_GO 为空, 退出")
        sys.exit(1)

    # 兼容: 指定 WOLF_VX_GO_ENTRY 则只跑该行 (便于单独调试某个账号)
    sel = os.environ.get("WOLF_VX_GO_ENTRY", "").strip()
    if sel:
        entries = [sel]
        print(f"  (已指定 WOLF_VX_GO_ENTRY, 仅运行: {sel})")
    print(f"  共 {len(entries)} 个账号待运行\n")

    # 多账号模式必须禁用 env token 共享: 否则第2/3...个账号会复用 WOLF_UNI_ID_TOKEN
    # (第一个账号的身份), 导致所有账号都在操作同一个 uid。多账号下每个账号只用自己
    # 通过 VX_GO 取码续期得到的隔离缓存 token。
    allow_env = len(entries) == 1
    if not allow_env and UNI_ID_TOKEN.strip():
        print(
            "  [多账号] 已禁用 WOLF_UNI_ID_TOKEN 共享, "
            "每个账号将各自通过 VX_GO 取码续期\n"
        )

    results = []
    for idx, entry in enumerate(entries, 1):
        print(f"\n\n========== 账号 {idx}/{len(entries)} ==========")
        results.append(run_account(entry, allow_env=allow_env))

    # 汇总
    print("\n\n" + "=" * 50)
    print("  全部账号运行完毕 - 汇总")
    print("=" * 50)
    tot_earned = sum(r.get("earned", 0) for r in results)
    tot_success = sum(r.get("success", 0) for r in results)
    for r in results:
        if r.get("ok"):
            print(
                f"  [OK] {r['entry']}  uid={r.get('uid')}  "
                f"成功 {r['success']} 次, 贡献值 {r['earned']}"
            )
        else:
            print(f"  [跳过] {r['entry']}  ({r.get('reason')})")
    print(f"\n  总计: 成功 {tot_success} 次, 贡献值 {tot_earned} (1积分=1元)")

    # 串号自检: 多账号却出现重复 uid, 说明仍有账号复用了同一 token
    uids = [r.get("uid") for r in results if r.get("uid")]
    if len(entries) > 1 and len(uids) != len(set(uids)):
        dup = [u for u in set(uids) if uids.count(u) > 1]
        print(
            f"\n  ⚠️ 检测到重复 uid {dup}: 仍有账号在共用同一身份 token, "
            "请检查对应微信是否已在 VX_GO 登录授权!"
        )

    # 单账号模式下, 若续期成功则写回青龙环境变量 (多账号不写回, 避免覆盖)
    if len(results) == 1 and results[0].get("src") == "renewed":
        update_qinglong_env("WOLF_UNI_ID_TOKEN", UNI_ID_TOKEN)
    # 通知由顶部「VX_GO 统一通知注入」块在退出时统一推送


if __name__ == "__main__":
    main()
