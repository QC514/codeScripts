# === YYB_GO 统一通知注入 begin ===
import atexit as _yyb_atexit
import importlib as _yyb_importlib
import json as _yyb_json
import os as _yyb_os
import re as _yyb_re
import sys as _yyb_sys
import unicodedata as _yyb_unicodedata
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
            _yyb_emit_raw(f" - {server}")
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
        [f"🧩 账号 {index} / {total}", f"🌍 来源 {server}"],
        account=True,
    )


def _yyb_detect_account(line):
    for server in _yyb_servers:
        if any(value in line for value in _yyb_server_match_values(server)):
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
    elif any(word in stripped for word in ("成功", "完成", "通过", "获得", "提取到")):
        icon = "✅"
    elif tag == "代理" and "生成" in stripped:
        icon = "🛠️"
    elif tag == "代理":
        icon = "🌐"
    elif tag == "登录":
        icon = "🔐"
    else:
        icon = "ℹ️"
    return f"{icon} [{tag}] {stripped}"


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

    _yyb_output_capture = True

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
    if not getattr(_yyb_sys.stdout, "_yyb_output_capture", False):
        _yyb_sys.stdout = _YybLogStream(_yyb_sys.stdout)
    if not getattr(_yyb_sys.stderr, "_yyb_output_capture", False):
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


_yyb_install_output_capture()
_yyb_emit_startup()
try:
    _yyb_os._exit = _yyb_patched_os_exit
except (AttributeError, TypeError):
    pass
_yyb_atexit.register(_yyb_push_notification)
# === YYB_GO 统一通知注入 end ===

# name: 三福
# cron: 0 40 8 * * *
import asyncio
import os
import random
import time

import requests

# ===================== 强制全局禁用系统代理环境变量，避免干扰 =====================
for env_key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
    if env_key in os.environ:
        del os.environ[env_key]

# ===================== 配置项 =====================
PLUSPLUS_TOKEN = os.getenv("PLUSPLUS_TOKEN", "")

# 从环境变量 YYB_GO 读取内网服务器，多条换行分隔
SERVERS = []
env_yyb_go = os.getenv("YYB_GO", "")
if env_yyb_go:
    # 兼容 \r\n 和 \n 换行，去除每行前后空格，过滤空行
    raw_lines = env_yyb_go.splitlines()
    SERVERS = [line.strip() for line in raw_lines if line.strip()]

# 校验是否存在有效服务地址
if len(SERVERS) == 0:
    print("❌ 错误：未读取到环境变量 YYB_GO 或无有效地址！")
    print("配置示例（变量值多条换行填写）：")
    print("192.168.1.21:8088")
    print("192.168.31.111:8088")
    exit(1)

print(f"✅ 成功读取 {len(SERVERS)} 台内网服务器：")
for item in SERVERS:
    print(f" - {item}")
print("-" * 50)

PROXY_API = os.getenv("PROXY_API", "")
PROXY_TYPE = os.getenv("PROXY_TYPE", "http")
PROXY_RETRY_TIMES = 3
PROXY_VALIDATE_URL = "http://httpbin.org/ip"
ENABLE_PER_ACCOUNT_PROXY = True
PROXY_FETCH_INTERVAL = 3000
ENABLE_DIRECT_FALLBACK = True

APPID = "wxfe13a2a5df88b058"
USER_AGENT_LIST = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 "
        "MicroMessenger/7.0.20.1781 NetType/WIFI MiniProgramEnv/Windows "
        "WindowsWechat/WMPF"
    ),
    (
        "Mozilla/5.0 (Linux; Android 14; 2512BPNDAC Build/UKQ1.230917.001; wv) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 "
        "Chrome/146.0.7680.153 Mobile Safari/537.36 XWEB/1460043 "
        "MMWEBSDK/20251006 MiniProgramEnv/android"
    ),
    (
        "Mozilla/5.0 (Linux; Android 13; Redmi K60 Build/TKQ1.221114.001; wv) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 "
        "Chrome/130.0.6723.102 Mobile Safari/537.36 XWEB/1300003 "
        "MMWEBSDK/20250901 MiniProgramEnv/android"
    ),
]
BASE_URL = "https://crm.sanfu.com"


# ===================== 工具函数 =====================
async def sleep(ms):
    await asyncio.sleep(ms / 1000)


def random_int(min_val, max_val):
    return random.randint(min_val, max_val)


def get_ua():
    return random.choice(USER_AGENT_LIST)


# ====================== 品赞IP代理系统 ======================
def parse_proxy_response(text):
    text = text.strip()
    if not text:
        return None
    try:
        import json

        data = json.loads(text)
        proxy_obj = None
        if (
            data.get("data")
            and isinstance(data["data"], list)
            and len(data["data"]) > 0
        ):
            proxy_obj = data["data"][0]
        elif data.get("ip") and data.get("port"):
            proxy_obj = data
        elif (
            data.get("result")
            and data["result"].get("ip")
            and data["result"].get("port")
        ):
            proxy_obj = data["result"]

        if proxy_obj:
            return {
                "host": proxy_obj["ip"],
                "port": int(proxy_obj["port"]),
                "username": proxy_obj.get("user") or proxy_obj.get("username") or "",
                "password": proxy_obj.get("pass") or proxy_obj.get("password") or "",
            }
    except (TypeError, ValueError, KeyError):
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


def build_proxy_dict(proxy_info):
    if not proxy_info:
        return None
    host = proxy_info["host"]
    port = proxy_info["port"]
    username = proxy_info["username"]
    password = proxy_info["password"]

    auth = ""
    if username and password:
        auth = f"{requests.utils.quote(username)}:{requests.utils.quote(password)}@"

    if PROXY_TYPE == "socks5":
        proxy_url = f"socks5://{auth}{host}:{port}"
    else:
        proxy_url = f"http://{auth}{host}:{port}"

    return {"http": proxy_url, "https": proxy_url}


def validate_proxy(proxies):
    if not proxies:
        return False
    try:
        res = requests.get(
            PROXY_VALIDATE_URL, proxies=proxies, timeout=15, verify=False
        )
        if res.status_code == 200:
            print(f"✅ 代理验证通过，出口IP：{res.json().get('origin', '未知')}")
            return True
        return False
    except Exception as e:
        print(f"⚠️ 代理验证失败，原因：{str(e)[:60]}")
        return False


async def get_valid_proxy(account_name):
    if not PROXY_API:
        print(f"ℹ️ [{account_name}] 未配置代理API，使用直连")
        return None
    print(f"🔌 [{account_name}] 正在从品赞API获取专属代理 ({PROXY_TYPE})...")

    for i in range(PROXY_RETRY_TIMES):
        try:
            res = requests.get(PROXY_API, timeout=15, proxies={})
            proxy_info = parse_proxy_response(res.text)

            if not proxy_info:
                print(f"⚠️ [{account_name}] 第{i + 1}次获取代理失败：响应格式无法解析")
                continue
            print(
                f"✅ [{account_name}] 提取到专属代理："
                f"{proxy_info['host']}:{proxy_info['port']}"
            )

            proxies = build_proxy_dict(proxy_info)
            if validate_proxy(proxies):
                return proxies
            else:
                print(f"⚠️ [{account_name}] 第{i + 1}次获取的代理不可用，正在重试...")
        except Exception as e:
            print(f"⚠️ [{account_name}] 第{i + 1}次获取代理异常：{str(e)[:60]}")

        if i < PROXY_RETRY_TIMES - 1:
            await sleep(2000)
    print(f"❌ [{account_name}] 连续多次获取代理失败，使用直连")
    return None


# ===================== PushPlus通知 =====================
def send_pushplus_notification(title, content):
    if not PLUSPLUS_TOKEN:
        return
    try:
        url = "https://www.pushplus.plus/send"
        data = {
            "token": PLUSPLUS_TOKEN,
            "title": title,
            "content": content,
            "template": "txt",
        }
        requests.post(url, json=data, timeout=5)
        print("✅ 通知推送成功")
    except Exception as e:
        print(f"❌ 通知推送失败：{str(e)}")


# ===================== 业务函数 =====================
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


def get_code(server):
    parsed_server, ref = parse_yyb_go_entry(server)
    if not parsed_server or not ref:
        return None

    url = f"http://{parsed_server}/wxapp/getCode"
    payload = {"ref": ref, "app_id": APPID}
    print(f"[{parsed_server}] 请求YYB Go获取code：{url}")

    try:
        res = requests.post(
            url,
            json=payload,
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


def wx_login(js_code, user_agent, proxies, server):
    headers = {
        "Host": "crm.sanfu.com",
        "Content-Type": "application/json",
        "User-Agent": user_agent,
        "xweb_xhr": "1",
        "Referer": f"https://servicewechat.com/{APPID}/385/page-frame.html",
        "Accept": "*/*",
    }
    login_url = f"{BASE_URL}/ms-sanfu-wechat-customer-core/customer/core/wxMiniAppLogin"
    payload = {
        "code": js_code,
        "appid": APPID,
        "shoId": "",
        "userId": "",
        "sourceWxsceneid": 1027,
        "sourceUrl": "pages/ucenter_index/ucenter_index",
    }

    try:
        response = None
        if proxies:
            print(f"🌐 [{server}] 正在使用专属代理发起登录请求...")
            try:
                response = requests.post(
                    login_url,
                    json=payload,
                    headers=headers,
                    proxies=proxies,
                    timeout=20,
                )
            except Exception as e:
                print(f"⚠️ [{server}] 代理登录失败，切换直连重试...")
                response = requests.post(
                    login_url, json=payload, headers=headers, proxies={}, timeout=20
                )
        else:
            response = requests.post(
                login_url, json=payload, headers=headers, proxies={}, timeout=20
            )

        print(f"[{server}] 登录接口返回：{response.text[:300]}")
        return response.json()
    except Exception as e:
        print(f"❌ [{server}] 登录异常: {str(e)[:60]}")
        return None


# 核心修复：改用sid鉴权，删除无效token头
def common_request(
    url, method="GET", body=None, sid="", user_agent="", proxies=None, server=""
):
    headers = {
        "Host": "crm.sanfu.com",
        "Content-Type": "application/json",
        "User-Agent": user_agent,
        "Referer": f"https://servicewechat.com/{APPID}/385/page-frame.html",
    }
    req_url = f"{BASE_URL}{url}"
    if body is None:
        body = {}
    # 自动带入sid做登录鉴权
    body["sid"] = sid

    try:
        response = None
        if proxies:
            try:
                if method.upper() == "POST":
                    response = requests.post(
                        req_url, json=body, headers=headers, proxies=proxies, timeout=20
                    )
                else:
                    response = requests.get(
                        req_url,
                        params=body,
                        headers=headers,
                        proxies=proxies,
                        timeout=20,
                    )
            except Exception as e:
                print(f"⚠️ [{server}] 代理请求失败，切换直连重试...")
                if method.upper() == "POST":
                    response = requests.post(
                        req_url, json=body, headers=headers, proxies={}, timeout=20
                    )
                else:
                    response = requests.get(
                        req_url, params=body, headers=headers, proxies={}, timeout=20
                    )
        else:
            if method.upper() == "POST":
                response = requests.post(
                    req_url, json=body, headers=headers, proxies={}, timeout=20
                )
            else:
                response = requests.get(
                    req_url, params=body, headers=headers, proxies={}, timeout=20
                )
        return response.json()
    except Exception as e:
        print(f"❌ [{server}] 请求异常: {str(e)[:60]}")
        return None


# ===================== 单个账号执行 =====================
async def run_account(server, global_proxy_agent):
    result = {
        "server": server,
        "success": False,
        "signMsg": "",
        "scoreMsg": "",
        "error": "",
        "proxyStatus": "未使用代理",
    }
    print(f"\n===== 三福 - {server} 账号 =====")
    user_agent = get_ua()
    proxy_agent = global_proxy_agent
    if ENABLE_PER_ACCOUNT_PROXY:
        proxy_agent = await get_valid_proxy(server)
        result["proxyStatus"] = "使用专属代理" if proxy_agent else "使用直连"
        await sleep(PROXY_FETCH_INTERVAL)

    try:
        start_delay = random_int(2000, 6000)
        print(f"⏳ [{server}] 启动延迟 {start_delay / 1000}s")
        await sleep(start_delay)

        # 1. 获取code
        code = get_code(server)
        if not code:
            result["error"] = "获取code失败"
            print(f"❌ [{server}] 获取code失败")
            return result

        # 2. 登录获取sid
        login_data = wx_login(code, user_agent, proxy_agent, server)
        if not login_data or login_data.get("code") != 200:
            result["error"] = (
                login_data.get("msg", "登录失败") if login_data else "登录无响应"
            )
            print(f"❌ [{server}] 登录失败：{result['error']}")
            return result
        sid = login_data["data"].get("sid", "")
        if not sid:
            result["error"] = "未获取到sid，无法继续"
            print(f"❌ [{server}] 未获取到sid，无法继续")
            return result
        print(f"✅ [{server}] 登录成功获取sid")
        await sleep(random_int(3000, 8000))

        # 3. 每日签到
        sign_data = common_request(
            "/ms-sanfu-wechat-common/customer/onSign",
            method="POST",
            body={"signWay": 0},
            sid=sid,
            user_agent=user_agent,
            proxies=proxy_agent,
            server=server,
        )
        if sign_data and sign_data.get("code") == 200:
            fubi = sign_data["data"].get("fubi", 0)
            keep_day = sign_data["data"].get("onKeepSignDay", 0)
            result["signMsg"] = f"签到成功！连续签到{keep_day}天，获得{fubi}福币"
            print(f"✅ [{server}] {result['signMsg']}")
        else:
            msg = sign_data.get("msg", "未知错误") if sign_data else "接口无响应"
            result["signMsg"] = f"签到失败：{msg}"
            print(f"❌ [{server}] {result['signMsg']}")
        await sleep(random_int(2000, 5000))

        # 4. 查询福币
        info_data = common_request(
            "/ms-sanfu-wechat-customer/customer/index/baseInfo",
            method="GET",
            body={},
            sid=sid,
            user_agent=user_agent,
            proxies=proxy_agent,
            server=server,
        )
        if info_data and info_data.get("code") == 200:
            cur_fubi = info_data["data"].get("fubi", 0)
            result["scoreMsg"] = f"当前账号总福币：{cur_fubi}个"
            print(f"🎯 [{server}] {result['scoreMsg']}")

        result["success"] = True
        print(f"✅ [{server}] 账号执行完成")
    except Exception as e:
        result["error"] = str(e)
        print(f"❌ [{server}] 执行异常：{str(e)[:60]}")
    return result


# ===================== 主程序 =====================
async def main():
    print(
        "===== 三福动态code签到（环境变量YYB_GO多内网+品赞代理+sid鉴权修复版）=====\n"
    )
    global_proxy_agent = None
    if not ENABLE_PER_ACCOUNT_PROXY:
        global_proxy_agent = await get_valid_proxy("全局共用")

    results = []
    for server in SERVERS:
        res = await run_account(server, global_proxy_agent)
        results.append(res)
        await sleep(2000)

    notify_content = "### 三福多账号任务执行结果\n"
    for res in results:
        notify_content += f"\n#### {res['server']}\n"
        notify_content += f"- 代理状态：{res['proxyStatus']}\n"
        notify_content += f"- 执行状态：{'成功' if res['success'] else '失败'}\n"
        if res["success"]:
            notify_content += f"- 签到结果：{res['signMsg']}\n"
            notify_content += f"- 福币信息：{res['scoreMsg']}\n"
        else:
            notify_content += f"- 失败原因：{res['error']}\n"

    send_pushplus_notification("三福多账号任务完成", notify_content)
    print("\n===== 所有账号执行完成 =====")


if __name__ == "__main__":
    asyncio.run(main())
