# === YYB_GO 统一通知注入 begin ===
import atexit
import importlib
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

_YYB_KEY_NAMES = ("QYWX_KEY", "QYWX", "WEWORK_KEY")
_YYB_LOG_LIMIT = 40
_yyb_logs = []
_yyb_notification_sent = False
_yyb_footer_printed = False
_yyb_original_stdout = sys.stdout
_yyb_original_stderr = sys.stderr
_yyb_raw_servers = os.environ.get("YYB_GO", "")
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
    fallback = os.path.splitext(os.path.basename(source_path))[0] or "YYB_GO"
    try:
        with open(source_path, encoding="utf-8") as script_file:
            source = script_file.read()
        marker = "\n# === YYB_GO 统一通知注入 end ==="
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
    address = server.split("@", 1)[0].strip().rstrip("/")
    values.extend(
        [
            address,
            address.removeprefix("http://").removeprefix("https://"),
        ]
    )
    return [value for value in values if value]


def _yyb_display_name(server):
    return _yyb_display_names.get(server) or server.split("@", 1)[-1].strip() or server


def _yyb_load_display_names():
    for server in _yyb_servers:
        address, separator, openid = server.rpartition("@")
        address = address.strip().rstrip("/")
        openid = openid.strip()
        fallback = openid or server
        _yyb_display_names[server] = fallback
        if not separator or not address or not openid:
            continue
        if not address.startswith(("http://", "https://")):
            address = f"http://{address}"
        query = urllib.parse.urlencode({"openid": openid})
        request = urllib.request.Request(
            f"{address}/accounts/profile?{query}",
            headers={"Accept": "application/json"},
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
        r"(请求\s*YYB\s*Go\s*获取\s*code)\s*[:：].*$",
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
    title = os.path.basename(sys.argv[0]) if sys.argv else "YYB_GO"
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
# === YYB_GO 统一通知注入 end ===

# name: 浓五的酒馆
# cron: 0 0 11 * * *
# -*- coding: utf-8 -*-

"""
浓五的酒馆小程序动态 code 版

功能：
  1. 多端口本地服务获取微信 code
  2. 使用 code 换 token
  3. 每日签到
  4. 查询用户信息和积分
  5. PushPlus 推送
  6. 品赞代理，业务请求优先代理，失败直连兜底

环境变量：
  PLUSPLUS_TOKEN    PushPlus token，可选
  PROXY_API         品赞代理提取 API，可选
  PROXY_TYPE        http / socks5，默认 http
  YYB_GO             内网wxcode服务地址，多个换行分隔，格式：192.168.1.21:8088

依赖：
  pip install requests
  socks5 代理需：
  pip install requests[socks]
"""

import json
import os
import random
import time
import traceback
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple
from urllib.parse import quote

import requests

APP_NAME = "浓五的酒馆小程序"
APPID = "wxed3cf95a14b58a26"
PROMOTION_ID = "PI6a41ee59886bd1000a158d9b"

# 从环境变量 YYB_GO 读取内网服务，多条换行分隔
SERVERS = []
env_yyb_go = os.getenv("YYB_GO", "")
if env_yyb_go:
    raw_lines = re.split(r"\r?\n|&", env_yyb_go)
    SERVERS = [line.strip() for line in raw_lines if line.strip()]

# 校验无有效地址直接退出
if len(SERVERS) == 0:
    print("❌ 错误：未读取到环境变量 YYB_GO 或无有效IP端口！")
    print("配置示例（青龙环境变量值，每行一个）：")
    print("127.0.0.1:8088")
    print("192.168.1.21:8088")
    exit(1)

print(f"✅ 成功读取 {len(SERVERS)} 台内网wxcode服务：")
for item in SERVERS:
    print(f" - {item}")
print("-" * 60 + "\n")

PLUSPLUS_TOKEN = os.getenv("PLUSPLUS_TOKEN", "")
PROXY_API = os.getenv("PROXY_API", "")
PROXY_TYPE = os.getenv("PROXY_TYPE", "http").lower()

PROXY_RETRY_TIMES = 3
PROXY_VALIDATE_URL = "http://httpbin.org/ip"
PROXY_FETCH_INTERVAL = 3
ENABLE_DIRECT_FALLBACK = True
REQUEST_TIMEOUT = 30

BASE_URL = "https://stdcrm.dtmiller.com"
LOGIN_URL = f"{BASE_URL}/std-weixin-mp-service/miniApp/custom/login"
USER_INFO_URL = f"{BASE_URL}/scrm-promotion-service/mini/wly/user/info"
SIGN_INFO_URL = f"{BASE_URL}/scrm-promotion-service/promotion/sign/userinfo"
SIGN_TODAY_URL = f"{BASE_URL}/scrm-promotion-service/promotion/sign/today"
POINTS_RECORD_URL = f"{BASE_URL}/scrm-promotion-service/mini/point/wly/balance/detail"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 "
    "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI "
    "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) "
    "UnifiedPCWindowsWechat(0xf2541a1d) XWEB/19899"
)


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def sleep(seconds: float) -> None:
    time.sleep(seconds)


def mask(value: Any) -> str:
    value = str(value or "")
    if len(value) <= 12:
        return value
    return f"{value[:6]}...{value[-6:]}"


def json_preview(data: Any, limit: int = 800) -> str:
    try:
        return json.dumps(data, ensure_ascii=False)[:limit]
    except Exception:
        return str(data)[:limit]


def to_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def log_title() -> None:
    print()
    print("╔" + "═" * 50 + "╗")
    print("║ 🍺 浓五的酒馆小程序动态 code 版                ║")
    print(f"║ 🕒 启动时间: {now_text():<32}║")
    print(f"║ 🔢 账号数量: {len(SERVERS):<34}║")
    print("╚" + "═" * 50 + "╝")


def log_account_header(index: int, total: int, server: str) -> None:
    print()
    print("┌" + "─" * 50 + "┐")
    print(f"│ 🧩 账号 {index} / {total:<37}│")
    print(f"│ 🌍 来源 {server:<40}│")
    print("└" + "─" * 50 + "┘")


def direct_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    return session


def parse_proxy_response(text: Any) -> Dict[str, Any] | None:
    if not isinstance(text, str):
        text = json.dumps(text, ensure_ascii=False)

    text = text.strip()
    if not text:
        return None

    try:
        data = json.loads(text)
        proxy_obj = None

        if isinstance(data.get("data"), list) and data["data"]:
            proxy_obj = data["data"][0]
        elif isinstance(data.get("data"), dict):
            proxy_obj = data["data"]
        elif data.get("ip") and data.get("port"):
            proxy_obj = data
        elif isinstance(data.get("result"), dict):
            proxy_obj = data["result"]

        if proxy_obj:
            host = proxy_obj.get("ip") or proxy_obj.get("host")
            port = proxy_obj.get("port")
            if host and port:
                return {
                    "host": str(host),
                    "port": int(port),
                    "username": proxy_obj.get("user")
                    or proxy_obj.get("username")
                    or "",
                    "password": proxy_obj.get("pass")
                    or proxy_obj.get("password")
                    or "",
                }
    except Exception:
        pass

    if ":" in text:
        parts = text.split(":")
        if len(parts) >= 2:
            return {
                "host": parts[0],
                "port": int(parts[1]),
                "username": parts[2] if len(parts) > 2 else "",
                "password": parts[3] if len(parts) > 3 else "",
            }

    return None


def build_proxy_dict(proxy_info: Dict[str, Any] | None) -> Dict[str, str] | None:
    if not proxy_info:
        return None

    host = proxy_info["host"]
    port = proxy_info["port"]
    username = proxy_info.get("username", "")
    password = proxy_info.get("password", "")

    auth = ""
    if username and password:
        auth = f"{quote(username)}:{quote(password)}@"

    scheme = "socks5" if PROXY_TYPE == "socks5" else "http"
    proxy_url = f"{scheme}://{auth}{host}:{port}"

    print(f"🛠️ [代理] 生成 {scheme.upper()} 代理 {host}:{port}")

    return {
        "http": proxy_url,
        "https": proxy_url,
    }


def validate_proxy(proxies: Dict[str, str] | None) -> Tuple[bool, str]:
    if not proxies:
        return False, ""

    try:
        response = requests.get(PROXY_VALIDATE_URL, proxies=proxies, timeout=15)
        if response.status_code == 200:
            try:
                ip = response.json().get("origin", "未知")
            except Exception:
                ip = "未知"
            print(f"✅ [代理] 验证通过，出口 IP: {ip}")
            return True, ip
    except Exception as exc:
        print(f"⚠️ [代理] 验证失败: {exc}")

    return False, ""


def get_valid_proxy(account_name: str) -> Tuple[Dict[str, str] | None, str]:
    if not PROXY_API:
        print(f"⚠️ [代理] {account_name} 未配置 PROXY_API，使用直连")
        return None, ""

    print(f"🌐 [代理] {account_name} 正在获取品赞代理...")

    for index in range(1, PROXY_RETRY_TIMES + 1):
        try:
            response = direct_session().get(PROXY_API, timeout=15)
            proxy_info = parse_proxy_response(response.text)

            if not proxy_info:
                print(f"⚠️ [代理] 第 {index} 次代理解析失败")
                continue

            print(f"✅ [代理] 提取到 {proxy_info['host']}:{proxy_info['port']}")
            proxies = build_proxy_dict(proxy_info)

            ok, ip = validate_proxy(proxies)
            if ok:
                return proxies, ip

            print(f"⚠️ [代理] 第 {index} 次代理不可用")
        except Exception as exc:
            print(f"⚠️ [代理] 第 {index} 次获取代理异常: {exc}")

        if index < PROXY_RETRY_TIMES:
            sleep(2)

    print("⚠️ [代理] 获取失败，使用直连")
    return None, ""


def request_with_proxy(
    method: str,
    url: str,
    *,
    proxies: Dict[str, str] | None = None,
    server: str = "",
    **kwargs,
) -> requests.Response:
    kwargs.setdefault("timeout", REQUEST_TIMEOUT)

    if proxies:
        try:
            return requests.request(method, url, proxies=proxies, **kwargs)
        except Exception as exc:
            print(f"⚠️ [代理] {server} 代理请求失败: {exc}")
            if not ENABLE_DIRECT_FALLBACK:
                raise
            print("🔁 [兜底] 切换直连重试")

    session = direct_session()
    return session.request(method, url, **kwargs)


def send_pushplus(title: str, content: str) -> None:
    if not PLUSPLUS_TOKEN:
        print("⚠️ [PushPlus] 未配置 PLUSPLUS_TOKEN，跳过推送")
        return

    try:
        requests.post(
            "https://www.pushplus.plus/send",
            json={
                "token": PLUSPLUS_TOKEN,
                "title": title,
                "content": content,
                "template": "txt",
            },
            timeout=10,
        )
        print("✅ [PushPlus] 推送成功")
    except Exception as exc:
        print(f"❌ [PushPlus] 推送失败: {exc}")


def parse_yyb_go_entry(raw_value):
    raw_value = (raw_value or "").strip()
    if not raw_value:
        return None, None

    if "@" not in raw_value:
        print(f"❌ 配置错误：YYB_GO 格式应为 地址@微信账号标识，当前值：{raw_value}")
        return None, None

    server, ref = raw_value.split("@", 1)
    server = server.strip()
    ref = ref.strip()

    if server.startswith("http://"):
        server = server[7:]
    elif server.startswith("https://"):
        server = server[8:]

    server = server.rstrip("/")

    if not server or not ref:
        print(f"❌ 配置错误：YYB_GO 缺少地址或微信账号标识，当前值：{raw_value}")
        return None, None

    return server, ref


def get_code(server: str) -> str | None:
    parsed_server, ref = parse_yyb_go_entry(server)
    if not parsed_server or not ref:
        return None

    url = f"http://{parsed_server}/wxapp/getCode"
    print(f"[{parsed_server}] 请求YYB Go获取code：{url}")

    try:
        res = requests.post(
            url,
            json={"ref": ref, "app_id": APPID},
            timeout=20,
            proxies={"http": None, "https": None},
        )
        data = res.json()
        code = ((data.get("data") or {}).get("result") or {}).get("code")

        if data.get("code") != 0 or not code:
            print(f"[{parsed_server}] 获取code失败：{data}")
            return None

        print(f"[{parsed_server}] 获取code成功")
        return code
    except Exception as exc:
        print(f"[{parsed_server}] 获取code异常：{exc}")
        return None


def common_headers() -> Dict[str, str]:
    return {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }


def login_by_code(
    server: str, code: str, proxies: Dict[str, str] | None
) -> Tuple[str | None, Dict[str, Any] | None]:
    try:
        print("🔐 [登录] 使用 code 换 token")
        response = request_with_proxy(
            "POST",
            LOGIN_URL,
            headers=common_headers(),
            json={
                "code": code,
                "appId": APPID,
            },
            proxies=proxies,
            server=server,
        )

        try:
            data = response.json()
        except Exception:
            data = {"raw": response.text[:800]}

        print(f"🔍 [登录] 响应数据: {json_preview(data, 300)}")

        if data.get("code") == 0 and data.get("data"):
            token = data["data"]
            print(f"✅ [登录] token 获取成功: {mask(token)}")
            return token, data

        print(f"❌ [登录] 登录失败: {json_preview(data)}")
        return None, data
    except Exception as exc:
        print(f"❌ [登录] 请求异常: {exc}")
        return None, None


def api_get(
    server: str, url: str, token: str, proxies: Dict[str, str] | None
) -> Dict[str, Any]:
    headers = common_headers()
    headers["Authorization"] = f"Bearer {token}"

    response = request_with_proxy(
        "GET",
        url,
        headers=headers,
        proxies=proxies,
        server=server,
    )
    try:
        return response.json()
    except Exception:
        return {
            "code": -1,
            "msg": f"JSON解析失败: {response.text[:300]}",
        }


def run_account(index: int, total: int, server: str) -> Dict[str, Any]:
    result = {
        "server": server,
        "success": False,
        "proxyStatus": "未使用代理",
        "proxyIp": "-",
        "token": "-",
        "userInfo": "-",
        "initialScore": 0,
        "finalScore": 0,
        "signMsg": "-",
        "signDetails": [],
        "error": "",
    }

    log_account_header(index, total, server)

    proxies, proxy_ip = get_valid_proxy(server)
    result["proxyStatus"] = "使用专属代理" if proxies else "使用直连"
    result["proxyIp"] = proxy_ip or "-"

    sleep(PROXY_FETCH_INTERVAL)

    delay = random.randint(2, 6)
    print(f"⏳ [延迟] 启动延迟 {delay}s")
    sleep(delay)

    code = get_code(server)
    if not code:
        result["error"] = "获取 code 失败"
        return result

    token, raw_login = login_by_code(server, code, proxies)
    if not token:
        result["error"] = f"登录失败: {json_preview(raw_login)}"
        return result

    result["token"] = mask(token)

    try:
        print("🔍 [用户] 开始查询用户信息...")
        user_info_resp = api_get(server, USER_INFO_URL, token, proxies)

        print(f"🔍 [用户] 响应数据: {json_preview(user_info_resp, 200)}")

        if user_info_resp.get("code") == 0 and user_info_resp.get("data"):
            member_data = user_info_resp["data"].get("member", {})
            grade_data = user_info_resp["data"].get("grade", {})
            points_balance = to_int(member_data.get("points", 0))
            member_name = member_data.get("nick_name", "未知")
            member_level = grade_data.get("level_name", "普通会员")

            result["initialScore"] = points_balance
            result["userInfo"] = (
                f"{member_name} {member_level} 当前积分{points_balance}"
            )

            print(f"✅ [用户] {result['userInfo']}")
        else:
            error_msg = user_info_resp.get("msg") or "获取用户信息失败"
            result["userInfo"] = error_msg
            print(f"⚠️ [用户] {result['userInfo']}")
            print(f"⚠️ [用户] 完整响应: {json_preview(user_info_resp, 500)}")

        sleep(2)

        # 获取签到信息
        sign_info_resp = api_get(
            server, f"{SIGN_INFO_URL}?promotionId={PROMOTION_ID}", token, proxies
        )

        print(f"🔍 [签到信息] 响应数据: {json_preview(sign_info_resp, 300)}")

        if sign_info_resp.get("code") == 0 and sign_info_resp.get("data"):
            sign_data = sign_info_resp["data"]
            sign_days = to_int(sign_data.get("signDays", 0))
            today_sign = sign_data.get("today", False)
            next_continuous_day = to_int(sign_data.get("nextContinuousDay", 0))
            sign_day_prize_name = sign_data.get("signDayPrizeName", "未知")

            print(
                f"📊 [签到] 已签到{sign_days}天，今日{'已' if today_sign else '未'}签到"
            )
            print(f"📊 [签到] 下次连续签到: {next_continuous_day}天")

            # 执行签到
            sign_today_resp = api_get(
                server, f"{SIGN_TODAY_URL}?promotionId={PROMOTION_ID}", token, proxies
            )

            print(f"🔍 [签到] 响应数据: {json_preview(sign_today_resp, 300)}")

            if sign_today_resp.get("code") == 0 and sign_today_resp.get("data"):
                today_data = sign_today_resp["data"]
                prize = today_data.get("prize", {})
                goods_name = prize.get("goodsName", "无奖励")

                result["signMsg"] = f"签到成功 获得{goods_name} 连续{sign_days + 1}天"
                print(f"✅ [签到] {result['signMsg']}")
            else:
                error_msg = sign_today_resp.get("msg") or "签到失败"
                result["signMsg"] = error_msg
                print(f"⚠️ [签到] {result['signMsg']}")
        else:
            error_msg = sign_info_resp.get("msg") or "获取签到信息失败"
            result["signMsg"] = error_msg
            print(f"⚠️ [签到] {result['signMsg']}")

        sleep(2)

        # 获取最终用户信息
        final_user_info_resp = api_get(server, USER_INFO_URL, token, proxies)

        if final_user_info_resp.get("code") == 0 and final_user_info_resp.get("data"):
            member_data = final_user_info_resp["data"].get("member", {})
            points_balance = to_int(member_data.get("points", 0))

            result["finalScore"] = points_balance
            score_change = points_balance - result["initialScore"]

            if score_change > 0:
                print(f"✅ [最终] 积分{points_balance} (本次+{score_change})")
            else:
                print(f"✅ [最终] 积分{points_balance}")
        else:
            print("⚠️ [最终] 获取最终用户信息失败")

        sleep(2)

        # 获取积分记录
        points_records_resp = api_get(
            server, f"{POINTS_RECORD_URL}?type=0&pageNo=1&pageSize=10", token, proxies
        )

        if points_records_resp.get("code") == 0 and points_records_resp.get("data"):
            records_data = points_records_resp["data"]
            records_list = records_data.get("list", [])

            if records_list:
                result["signDetails"] = []
                print(f"📋 [明细] 最近{len(records_list)}条积分记录：")
                for item in records_list[:5]:
                    source_remark = item.get("sourceRemark", "")
                    number = to_int(item.get("number", 0))
                    created_time = item.get("createdTime", "")

                    result["signDetails"].append(
                        {
                            "type": source_remark,
                            "points": number,
                            "time": created_time,
                        }
                    )

                    print(f"  {created_time} {source_remark} {number}积分")
            else:
                print("ℹ️ [明细] 暂无积分记录")
        else:
            print(f"⚠️ [明细] 获取积分记录失败：{points_records_resp.get('msg')}")

        result["success"] = True
        return result

    except Exception as exc:
        result["error"] = traceback.format_exc().strip()
        print(f"❌ [账号] 执行失败: {exc}")
        return result


def build_notify(results: List[Dict[str, Any]]) -> str:
    success_count = sum(1 for item in results if item["success"])
    fail_count = len(results) - success_count

    total_score = sum(item.get("finalScore", 0) for item in results)

    content = f"""🍺 浓五的酒馆多账号任务结果

━━━━━━━━━━━━━━━━━━━━
🏁 总结：{success_count} 成功 / {fail_count} 失败
💎 总积分：{total_score}
🕒 时间：{now_text()}
━━━━━━━━━━━━━━━━━━━━
"""

    for idx, res in enumerate(results, 1):
        icon = "✅" if res["success"] else "❌"

        content += f"""
🧩 账号 {idx}
🌍 来源：{res["server"]}
🌐 代理：{res["proxyStatus"]}
📡 出口IP：{res["proxyIp"]}
🔐 Token：{res["token"]}
👤 用户：{res["userInfo"]}
📝 签到：{res["signMsg"]}
"""

        score_change = res["finalScore"] - res["initialScore"]
        if score_change > 0:
            content += (
                f"📊 积分变化：{res['initialScore']} -> {res['finalScore']} "
                f"(+{score_change})\n"
            )
        else:
            content += f"📊 当前积分：{res['finalScore']}\n"

        if res.get("signDetails"):
            content += "📋 积分记录：\n"
            for detail in res["signDetails"][:3]:
                content += (
                    f"   {detail['time']} {detail['type']} {detail['points']}积分\n"
                )

        content += f"""{icon} 结果：{"成功" if res["success"] else "失败"}
"""

        if not res["success"]:
            content += f"❌ 原因：{res['error']}\n"

        content += "━━━━━━━━━━━━━━━━━━━━\n"

    return content


def main() -> None:
    log_title()

    results: List[Dict[str, Any]] = []

    for index, server in enumerate(SERVERS, 1):
        try:
            result = run_account(index, len(SERVERS), server)
            results.append(result)
        except Exception as exc:
            print(f"❌ [主程序] {server} 执行异常: {exc}")
            results.append(
                {
                    "server": server,
                    "success": False,
                    "proxyStatus": "-",
                    "proxyIp": "-",
                    "token": "-",
                    "userInfo": "-",
                    "initialScore": 0,
                    "finalScore": 0,
                    "signMsg": "-",
                    "signDetails": [],
                    "error": traceback.format_exc().strip(),
                }
            )

        if index < len(SERVERS):
            print("⏳ [间隔] 等待 2s 后处理下一个账号")
            sleep(2)

    success_count = sum(1 for item in results if item["success"])
    fail_count = len(results) - success_count

    total_score = sum(item.get("finalScore", 0) for item in results)

    print()
    print("╔" + "═" * 50 + "╗")
    print("║ 🏁 浓五的酒馆任务执行完成                      ║")
    print(f"║ ✅ 成功: {success_count:<39}║")
    print(f"║ ❌ 失败: {fail_count:<39}║")
    print(f"║ 💎 总积分: {total_score:<38}║")
    print(f"║ 🕒 结束时间: {now_text():<32}║")
    print("╚" + "═" * 50 + "╝")

    send_pushplus("🍺 浓五的酒馆多账号任务完成", build_notify(results))


if __name__ == "__main__":
    main()
