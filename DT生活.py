# === YYB_GO 统一通知注入 begin ===
import atexit as _yyb_atexit
import importlib as _yyb_importlib
import json as _yyb_json
import os as _yyb_os
import re as _yyb_re
import sys as _yyb_sys
import unicodedata as _yyb_unicodedata
import urllib.parse as _yyb_url_parse
import urllib.request as _yyb_url_request

_YYB_KEY_NAMES = ("QYWX_KEY", "QYWX", "WEWORK_KEY")
_YYB_LOG_LIMIT = 40
_yyb_logs = []
_yyb_notification_sent = False
_yyb_footer_printed = False
_yyb_original_stdout = _yyb_sys.stdout
_yyb_original_stderr = _yyb_sys.stderr
_yyb_raw_servers = _yyb_os.environ.get("YYB_GO", "")
_yyb_servers = [item.strip() for item in _yyb_raw_servers.splitlines() if item.strip()]
_yyb_seen_accounts = []
_yyb_failed_accounts = set()
_yyb_current_account = None
_yyb_display_names = {}


def _yyb_now_text():
    from datetime import datetime as _yyb_datetime

    return _yyb_datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _yyb_display_width(text):
    width = 0
    for char in str(text):
        width += 2 if _yyb_unicodedata.east_asian_width(char) in "WFA" else 1
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
    source_path = globals().get("__file__") or (
        _yyb_sys.argv[0] if _yyb_sys.argv else ""
    )
    fallback = _yyb_os.path.splitext(_yyb_os.path.basename(source_path))[0] or "YYB_GO"
    try:
        with open(source_path, encoding="utf-8") as script_file:
            source = script_file.read()
        marker = "\n# === YYB_GO 统一通知注入 end ==="
        source = source.split(marker, 1)[-1]
        name_match = _yyb_re.search(r"(?m)^#\s*name:\s*(.+?)\s*$", source)
        doc_match = _yyb_re.search(
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
        query = _yyb_url_parse.urlencode({"openid": openid})
        request = _yyb_url_request.Request(
            f"{address}/accounts/profile?{query}",
            headers={"Accept": "application/json"},
        )
        try:
            with _yyb_url_request.urlopen(request, timeout=8) as response:
                payload = _yyb_json.loads(response.read().decode("utf-8"))
            data = payload.get("data") if payload.get("code") == 0 else None
            if isinstance(data, dict):
                name = data.get("nickname") or data.get("alias") or fallback
                name = _yyb_re.sub(r"[\r\n]+", " ", str(name)).strip()
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
    match = _yyb_re.search(r"账号\s*(\d+)", line)
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
    lowered = line.lower()
    if "pushplus" in lowered or "推送" in line:
        return "PushPlus"
    if "执行失败" in line or "执行异常" in line:
        return "账号"
    if (
        "代理" in line
        or "proxy" in lowered
        or (
            _yyb_re.search(r"\d{1,3}(?:\.\d{1,3}){3}:\d+", line)
            and any(word in line for word in ("提取", "生成", "获取"))
        )
    ):
        return "代理"
    if "登录" in line or "token" in lowered or "授权" in line:
        return "登录"
    if "code" in lowered or "取码" in line:
        return "取码"
    if "签到" in line or "sign" in lowered:
        return "签到"
    if "积分" in line or "余额" in line or "账户" in line:
        return "账户"
    if "等待" in line or "延迟" in line or "sleep" in lowered:
        return "延迟"
    if "账号" in line:
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
    stripped = _yyb_re.sub(
        r"(请求\s*YYB\s*Go\s*获取\s*code)\s*[:：].*$",
        r"\1",
        stripped,
        flags=_yyb_re.IGNORECASE,
    )
    if stripped.startswith("["):
        return stripped
    if _yyb_re.match(r"^[^\w\s]{1,3}\s*\[[^]]+\]", stripped):
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
    if "任务执行完成" in stripped or _yyb_re.match(
        r"^[✅❌🕒]\s*(成功|失败|结束时间)\s*[:：]", stripped
    ):
        return

    normalized = _yyb_normalize_line(stripped, stderr=stderr)
    _yyb_record_status(normalized)
    if "PushPlus" in normalized:
        _yyb_emit_footer()
    _yyb_emit_raw(normalized, stream=stream)


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
        self._buffer += str(text)
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            _yyb_process_line(line, self._stream, self._stderr)
        return len(text)

    def writelines(self, lines):
        for line in lines:
            self.write(line)


def _yyb_install_output_capture():
    if not getattr(_yyb_sys.stdout, "_yyb_capture_installed", False):
        _yyb_sys.stdout = _YybLogStream(_yyb_sys.stdout)
    if not getattr(_yyb_sys.stderr, "_yyb_capture_installed", False):
        _yyb_sys.stderr = _YybLogStream(_yyb_sys.stderr, stderr=True)


def _yyb_flush_captured_output():
    _yyb_sys.stdout.flush()
    _yyb_sys.stderr.flush()


def _yyb_resolve_key():
    for name in _YYB_KEY_NAMES:
        key = _yyb_os.environ.get(name)
        if key:
            return key
    for candidate in ("sendNotify.js", "/ql/data/scripts/sendNotify.js"):
        try:
            with open(candidate, encoding="utf-8") as notify_file:
                source = notify_file.read()
            match = _yyb_re.search(r"QYWX_KEY\s*=\s*['\"]([^'\"]+)['\"]", source)
            if match:
                return match.group(1)
        except (OSError, UnicodeError):
            continue
    return None


def _yyb_build_notification():
    _yyb_flush_captured_output()
    title = _yyb_os.path.basename(_yyb_sys.argv[0]) if _yyb_sys.argv else "YYB_GO"
    body = "\n".join(_yyb_logs[-_YYB_LOG_LIMIT:])
    return title, body or "任务执行完成，无日志输出。"


def _yyb_push_notification():
    global _yyb_notification_sent

    if _yyb_notification_sent:
        return
    _yyb_notification_sent = True
    _yyb_emit_footer()
    try:
        title, body = _yyb_build_notification()
        try:
            notify_module = _yyb_importlib.import_module("sendNotify")
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
        payload = _yyb_json.dumps(
            {"msgtype": "text", "text": {"content": f"【{title}】\n{body}"}},
            ensure_ascii=False,
        ).encode("utf-8")
        request = _yyb_url_request.Request(
            f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={key}",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with _yyb_url_request.urlopen(request, timeout=15):
            pass
    except Exception:
        pass


_yyb_original_os_exit = _yyb_os._exit


def _yyb_patched_os_exit(code=0):
    _yyb_push_notification()
    _yyb_original_os_exit(code)


_yyb_load_display_names()
_yyb_install_output_capture()
_yyb_emit_startup()
try:
    _yyb_os._exit = _yyb_patched_os_exit
except (AttributeError, TypeError):
    pass
_yyb_atexit.register(_yyb_push_notification)
# === YYB_GO 统一通知注入 end ===

# name: DT生活
# cron: 0 0 8 * * *
import json
import os
import random
import time
from datetime import datetime

import requests

# ===================== 新增：彻底关闭InsecureRequestWarning警告 =====================
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
# ==================================================================================

# ===================== 配置项 =====================
# 基础配置
APP_ID = "wx51a2021dd921f747"
PLUSPLUS_TOKEN = os.getenv("PLUSPLUS_TOKEN", "")

# 从环境变量 YYB_GO 读取内网登录接口，多条换行分隔
CODE_URL_LIST = []
env_yyb_go = os.getenv("YYB_GO", "")
if env_yyb_go:
    # 兼容 \r\n 和 \n 换行，去除每行前后空格，过滤空行
    raw_lines = env_yyb_go.splitlines()
    CODE_URL_LIST = [line.strip() for line in raw_lines if line.strip()]

# 校验是否存在有效服务地址
if len(CODE_URL_LIST) == 0:
    print("❌ 错误：未读取到环境变量 YYB_GO 或无有效地址！")
    print("配置示例（变量值多条换行填写）：")
    print("http://192.168.1.21:8088/login")
    print("http://192.168.1.7:8088/login")
    exit(1)

print(f"✅ 成功读取 {len(CODE_URL_LIST)} 台内网服务地址：")
for item in CODE_URL_LIST:
    print(f" - {item}")
print("-" * 50)

# 品赞代理配置（青龙环境变量）
PROXY_API = os.getenv("PROXY_API", "")  # 代理提取API链接
PROXY_TYPE = os.getenv("PROXY_TYPE", "http")  # 代理类型: http 或 socks5
PROXY_RETRY_TIMES = 3  # 单个账号代理获取重试次数
PROXY_VALIDATE_URL = "http://httpbin.org/ip"  # 代理验证地址
# 核心开关：每个账号独立获取专属代理（True=每个账号一个新IP，False=所有账号共用一个IP）
ENABLE_PER_ACCOUNT_PROXY = True
# 账号间代理获取间隔（秒，避免频繁调用代理API被限流）
PROXY_FETCH_INTERVAL = 3
# 兜底开关：代理请求失败后，自动切换直连重试
ENABLE_DIRECT_FALLBACK = True

# 业务接口（固定）
LOGIN_URL = "https://ebeikeapi.ebeck.cn/api/v2/user/userLogin"
SIGN_URL = "https://ebeikeapi.ebeck.cn/api/v2/user/userSign"
TOTAL_POINTS_URL = "https://ebeikeapi.ebeck.cn/api/v2/user/userPointsGoldInfo"

# 随机UA池（防风控）
USER_AGENT_LIST = [
    (
        "Mozilla/5.0 (Linux; Android 14; 2512BPNDAC Build/UKQ1.230917.001; wv) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 "
        "Chrome/146.0.7680.153 Mobile Safari/537.36 XWEB/1460043 "
        "MMWEBSDK/20251006 MMWEBID/2089 MicroMessenger/8.0.66.2980"
        "(0x28004234) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN "
        "ABI/arm64 MiniProgramEnv/android"
    ),
    (
        "Mozilla/5.0 (Linux; Android 13; Redmi K60 Build/TKQ1.221114.001; wv) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 "
        "Chrome/130.0.6723.102 Mobile Safari/537.36 XWEB/1300003 "
        "MMWEBSDK/20250901 MiniProgramEnv/android"
    ),
    (
        "Mozilla/5.0 (Linux; Android 12; MI 11 Build/SKQ1.211006.001; wv) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 "
        "Chrome/125.0.6422.111 Mobile Safari/537.36 XWEB/1250002 "
        "MMWEBSDK/20250801 MiniProgramEnv/android"
    ),
]
# ======================================================


# ====================== 品赞IP代理系统（每个账号独立获取）======================
def parse_proxy_response(text):
    """解析代理API响应（支持品赞等多种格式）"""
    text = text.strip()
    if not text:
        return None

    # 尝试JSON解析
    try:
        data = json.loads(text)
        proxy_obj = None

        # 品赞标准格式: {code: 0, data: [{ip: "x.x.x.x", port: 12345}]}
        if (
            data.get("data")
            and isinstance(data["data"], list)
            and len(data["data"]) > 0
        ):
            proxy_obj = data["data"][0]
        # 普通JSON格式: {ip: "x.x.x.x", port: 12345}
        elif data.get("ip") and data.get("port"):
            proxy_obj = data
        # 嵌套格式: {result: {ip: "x.x.x.x", port: 12345}}
        elif (
            data.get("result")
            and data["result"].get("ip")
            and data["result"].get("port")
        ):
            proxy_obj = data["result"]

        if proxy_obj:
            return {
                "host": proxy_obj.get("ip"),
                "port": proxy_obj.get("port"),
                "username": proxy_obj.get("user") or proxy_obj.get("username", ""),
                "password": proxy_obj.get("pass") or proxy_obj.get("password", ""),
            }
    except json.JSONDecodeError:
        pass

    # 尝试纯文本解析 (ip:port 或 ip:port:user:pass)
    if ":" in text:
        parts = text.split(":")
        if len(parts) >= 2 and parts[1].isdigit():
            return {
                "host": parts[0].strip(),
                "port": int(parts[1]),
                "username": parts[2].strip() if len(parts) > 2 else "",
                "password": parts[3].strip() if len(parts) > 3 else "",
            }

    return None


def build_proxy_config(proxy_info):
    """生成requests库的代理配置（支持HTTP/SOCKS5）"""
    if not proxy_info:
        return None

    host = proxy_info["host"]
    port = proxy_info["port"]
    username = proxy_info["username"]
    password = proxy_info["password"]

    auth = ""
    if username and password:
        auth = f"{username}:{password}@"

    if PROXY_TYPE == "socks5":
        proxy_url = f"socks5://{auth}{host}:{port}"
        print(f"🔧 生成SOCKS5代理：socks5://{auth}{host}:{port}")
    else:
        proxy_url = f"http://{auth}{host}:{port}"
        print(f"🔧 生成HTTP代理：{proxy_url}")

    return {"http": proxy_url, "https": proxy_url}


def validate_proxy(proxy_config):
    """验证代理是否可用"""
    if not proxy_config:
        return False
    try:
        response = requests.get(
            PROXY_VALIDATE_URL, proxies=proxy_config, timeout=15, verify=False
        )
        is_success = response.status_code == 200
        if is_success:
            origin_ip = response.json().get("origin", "未知")
            print(f"✅ 代理验证通过，出口IP：{origin_ip}")
        return is_success
    except Exception as e:
        print(f"⚠️ 代理验证失败，原因：{str(e)}")
        return False


def get_valid_proxy(account_name):
    """获取有效代理（每个账号独立调用）"""
    if not PROXY_API:
        print(f"ℹ️ [{account_name}] 未配置代理API，使用直连")
        return None

    print(f"🔌 [{account_name}] 正在从品赞API获取专属代理 ({PROXY_TYPE})...")

    for i in range(PROXY_RETRY_TIMES):
        try:
            # 获取代理API用直连，避免循环依赖
            response = requests.get(
                PROXY_API,
                timeout=15,
                proxies={"http": None, "https": None},
                verify=False,
            )
            proxy_info = parse_proxy_response(response.text)

            if not proxy_info:
                print(f"⚠️ [{account_name}] 第{i + 1}次获取代理失败：响应格式无法解析")
                continue

            print(
                f"✅ [{account_name}] 提取到专属代理："
                f"{proxy_info['host']}:{proxy_info['port']}"
            )

            # 生成代理配置并验证
            proxy_config = build_proxy_config(proxy_info)
            is_valid = validate_proxy(proxy_config)
            if is_valid:
                return proxy_config
            else:
                print(f"⚠️ [{account_name}] 第{i + 1}次获取的代理不可用，正在重试...")

        except Exception as e:
            print(f"⚠️ [{account_name}] 第{i + 1}次获取代理异常：{str(e)}")

        # 重试间隔
        if i < PROXY_RETRY_TIMES - 1:
            time.sleep(2)

    print(f"❌ [{account_name}] 连续多次获取代理失败，使用直连")
    return None


# ======================================================


def parse_yyb_go_entry(raw_value):
    value = str(raw_value or "").strip()
    if not value:
        return "", ""
    at_index = value.rfind("@")
    if at_index == -1:
        return value, ""
    server = value[:at_index].strip()
    ref = value[at_index + 1 :].strip()
    server = server.removeprefix("http://").removeprefix("https://").rstrip("/")
    return server, ref


def get_wx_code(code_url):
    """通过YYB Go获取对应账号的微信Code【强制直连，不走代理】"""
    server, ref = parse_yyb_go_entry(code_url)
    if not server:
        print("❌ 获取Code失败：服务地址为空")
        return None
    if not ref:
        print(f"❌ 获取Code失败：{code_url} 缺少openid/ref")
        return None

    try:
        res = requests.post(
            f"http://{server}/wxapp/getCode",
            json={"ref": ref, "app_id": APP_ID},
            timeout=20,
            proxies={"http": None, "https": None},
        )
        data = res.json()
        code = ((data.get("data") or {}).get("result") or {}).get("code")
        if data.get("code") == 0 and code:
            print(f"✅ {server} 获取Code成功")
            return code
        print(f"❌ 获取Code失败：{str(data)[:200]}")
    except Exception as e:
        print(f"❌ 获取Code失败：{str(e)}")
    return None


def refresh_token(code_url, proxy_config, account_name):
    """通过对应接口刷新Token【支持代理+直连兜底】"""
    code = get_wx_code(code_url)
    if not code:
        return None, None

    # 每次随机UA
    headers = {
        "Content-Type": "application/json",
        "charset": "utf-8",
        "User-Agent": random.choice(USER_AGENT_LIST),
    }

    try:
        payload = {
            "code": code,
            "appId": APP_ID,
            "client": "wxmp",
            "version": "251",
            "pid": "",
            "channeltype": "",
        }

        # 优先代理请求
        if proxy_config:
            print(f"🌐 [{account_name}] 正在使用专属代理发起登录请求...")
            try:
                res = requests.post(
                    LOGIN_URL,
                    json=payload,
                    headers=headers,
                    proxies=proxy_config,
                    timeout=20,
                    verify=False,
                )
            except Exception as e:
                if ENABLE_DIRECT_FALLBACK:
                    print(f"⚠️ [{account_name}] 代理登录失败，切换直连重试...")
                    res = requests.post(
                        LOGIN_URL,
                        json=payload,
                        headers=headers,
                        proxies={"http": None, "https": None},
                        timeout=20,
                        verify=False,
                    )
                else:
                    raise e
        else:
            res = requests.post(
                LOGIN_URL,
                json=payload,
                headers=headers,
                proxies={"http": None, "https": None},
                timeout=20,
                verify=False,
            )

        data = res.json()
        token = data.get("data", {}).get("token", "")
        if token:
            print("✅ Token获取成功")
            return token, headers
    except Exception as e:
        print(f"❌ Token获取异常：{str(e)}")

    print("❌ Token获取失败")
    return None, None


def get_user_info(token, headers, proxy_config, account_name):
    """获取用户信息+总积分【支持代理+直连兜底】"""
    try:
        payload = {"version": "251", "client": "wxmp", "token": token}
        req_headers = {**headers, "Authorization": f"Bearer {token}"}

        # 优先代理请求
        if proxy_config:
            try:
                res = requests.post(
                    TOTAL_POINTS_URL,
                    json=payload,
                    headers=req_headers,
                    proxies=proxy_config,
                    timeout=20,
                    verify=False,
                )
            except Exception as e:
                if ENABLE_DIRECT_FALLBACK:
                    print(f"⚠️ [{account_name}] 代理查询用户信息失败，切换直连重试...")
                    res = requests.post(
                        TOTAL_POINTS_URL,
                        json=payload,
                        headers=req_headers,
                        proxies={"http": None, "https": None},
                        timeout=20,
                        verify=False,
                    )
                else:
                    raise e
        else:
            res = requests.post(
                TOTAL_POINTS_URL,
                json=payload,
                headers=req_headers,
                proxies={"http": None, "https": None},
                timeout=20,
                verify=False,
            )

        data = res.json()
        d = data.get("data", {})
        return d.get("nickname", "未知"), d.get("mobile", "未知"), d.get("points", 0)
    except Exception as e:
        print(f"❌ 查询用户信息异常：{str(e)}")
        return "未知", "未知", 0


def push_plusplus(title, content):
    """PlusPlus推送（带状态返回）"""
    if not PLUSPLUS_TOKEN:
        print("ℹ️ 未配置PLUSPLUS_TOKEN，不推送")
        return False
    try:
        data = {"token": PLUSPLUS_TOKEN, "title": title, "content": content}
        res = requests.post(
            "https://www.pushplus.plus/send", json=data, timeout=10, verify=False
        )
        result = res.json()
        return result.get("code") == 200
    except Exception as e:
        print(f"❌ PushPlus推送异常：{str(e)}")
        return False


def do_sign(token, headers, proxy_config, account_name):
    """执行签到【支持代理+直连兜底】"""
    try:
        payload = {"version": "251", "client": "wxmp", "token": token}

        # 优先代理请求
        if proxy_config:
            try:
                res = requests.post(
                    SIGN_URL,
                    json=payload,
                    headers=headers,
                    proxies=proxy_config,
                    timeout=20,
                    verify=False,
                )
            except Exception as e:
                if ENABLE_DIRECT_FALLBACK:
                    print(f"⚠️ [{account_name}] 代理签到失败，切换直连重试...")
                    res = requests.post(
                        SIGN_URL,
                        json=payload,
                        headers=headers,
                        proxies={"http": None, "https": None},
                        timeout=20,
                        verify=False,
                    )
                else:
                    raise e
        else:
            res = requests.post(
                SIGN_URL,
                json=payload,
                headers=headers,
                proxies={"http": None, "https": None},
                timeout=20,
                verify=False,
            )

        return res.json()
    except Exception as e:
        print(f"❌ 签到异常：{str(e)}")
        return None


def run_account(code_url, index, global_proxy_config):
    """执行单个账号（对应接口）"""
    account_name = f"账号{index}"
    print("\n=======================================================")
    print(f"🚀 开始执行 {account_name} | 接口：{code_url}")
    print("=======================================================")

    # 核心逻辑：每个账号独立获取专属代理
    proxy_config = global_proxy_config
    proxy_status = "未使用代理"
    if ENABLE_PER_ACCOUNT_PROXY:
        proxy_config = get_valid_proxy(account_name)
        proxy_status = "使用专属代理" if proxy_config else "使用直连"
        # 代理获取后加间隔，避免频繁请求
        time.sleep(PROXY_FETCH_INTERVAL)

    token, headers = refresh_token(code_url, proxy_config, account_name)
    if not token:
        return {
            "account": account_name,
            "success": False,
            "proxy_status": proxy_status,
            "error": "Token获取失败",
        }

    # 随机延迟 3~8 秒
    delay = random.uniform(3, 8)
    print(f"⏳ 签到前等待：{delay:.1f}秒")
    time.sleep(delay)

    try:
        # 执行签到
        data = do_sign(token, headers, proxy_config, account_name)
        if not data:
            return {
                "account": account_name,
                "success": False,
                "proxy_status": proxy_status,
                "error": "签到请求异常",
            }

        sign_msg = data.get("msg", "完成")
        get_points = data.get("data", {}).get("points", 0)
        sign_num = data.get("data", {}).get("sign_num", 0)

        # 获取用户信息
        nickname, uid, total_points = get_user_info(
            token, headers, proxy_config, account_name
        )

        # 控制台简洁展示
        print(f"👤 账户昵称：{nickname}")
        print(f"🆔 账号UID：{uid}")
        print(f"📊 签到结果：{sign_msg}")
        print(f"📅 累计签到：{sign_num} 次")
        print(f"🎁 本次获得：{get_points} 积分")
        print(f"💰 账户总积分：{total_points} 分")

        # 带Emoji图标的推送内容
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        push_title = f"✅ DT生活签到 {account_name}"
        push_content = (
            f"🕒 执行时间：{now}\n\n"
            f"🔌 代理状态：{proxy_status}\n"
            f"👤 账户昵称：{nickname}\n"
            f"🆔 账号UID：{uid}\n"
            f"📊 签到结果：{sign_msg}\n"
            f"📅 累计签到：{sign_num} 次\n"
            f"🎁 本次获得：{get_points} 积分\n"
            f"💰 账户总积分：{total_points} 分"
        )

        # 推送并显示状态
        push_ok = push_plusplus(push_title, push_content)
        print("✅ 推送成功" if push_ok else "❌ 推送失败")

        return {
            "account": account_name,
            "success": True,
            "proxy_status": proxy_status,
            "nickname": nickname,
            "uid": uid,
            "sign_msg": sign_msg,
            "sign_num": sign_num,
            "get_points": get_points,
            "total_points": total_points,
        }

    except Exception as e:
        print(f"❌ 签到异常：{str(e)}")
        return {
            "account": account_name,
            "success": False,
            "proxy_status": proxy_status,
            "error": str(e),
        }


if __name__ == "__main__":
    print("===== DT生活签到（环境变量YYB_GO读取内网多服务+独立代理版）=====\n")

    # 兼容旧逻辑：如果关闭了单账号代理，就全局获取一个共用代理
    global_proxy_config = None
    if not ENABLE_PER_ACCOUNT_PROXY:
        global_proxy_config = get_valid_proxy("全局共用")

    # 循环执行所有内网服务账号
    all_results = []
    for i, url in enumerate(CODE_URL_LIST, 1):
        result = run_account(url, i, global_proxy_config)
        all_results.append(result)
        # 账号间间隔2秒
        time.sleep(2)

    # 汇总结果
    print("\n🎉 所有账号执行完毕！")
