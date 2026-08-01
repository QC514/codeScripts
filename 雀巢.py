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

_YYB_KEY_NAMES = ("QYWX_KEY", "QYWX", "WEWORK_KEY")
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

# name: 雀巢
# cron: 0 40 13 * * *
# -*- coding: utf-8 -*-
# ==============================================
# 雀巢会员俱乐部自动任务脚本（青龙面板专用版）
# 版本: v2.1.0
# 更新日期: 2026-05-13
# 功能: 自动完成每日签到、浏览官网、浏览视频号任务
# 适配: 雀巢小程序  | 品赞代理 | PushPlus推送
# ==============================================
#
# 【使用前必读】
# 1. 必须先部署好code获取服务（本地/远程均可）
# 2. 品赞代理为可选配置，无代理可使用直连模式
# 3. 脚本仅用于学习交流，请勿用于商业用途
#
# ==============================================
# 【一、依赖安装】
# 青龙面板执行以下命令安装依赖：
# pip install httpx[http2] httpx-socks python-dotenv
# ==============================================
#
# 【二、环境变量配置（青龙面板-环境变量）】
# ┌───────────────┬──────────┬─────────────────────────────────────┐
# │ 变量名         │ 必填/可选 │ 说明                                │
# ├───────────────┼──────────┼─────────────────────────────────────┤
# │ PROXY_API     │ 可选     │ 品赞代理提取API链接                  │
# │ PROXY_TYPE    │ 可选     │ 代理类型：http(默认) 或 socks5       │
# │ PLUSPLUS_TOKEN│ 可选     │ PushPlus推送Token，用于接收任务结果  │
# │ VX_GO         │ 必填     │ 内网wxcode服务地址，多个换行分隔     │
# └───────────────┴──────────┴─────────────────────────────────────┘
#
# VX_GO示例值（多行换行）：
# 127.0.0.1:8088
# 192.168.1.21:8088
# 10.30.9.49:8088
#
# ==============================================
#
# 【三、青龙面板部署步骤】
# 1. 上传脚本：进入青龙面板-脚本管理-新建脚本，粘贴全部代码保存
# 2. 配置环境变量：进入环境变量-添加变量，按上面表格配置
# 3. 设置定时任务：进入定时任务-添加任务，命令填写：python3 quechao.py
#    推荐定时：0 8 * * * （每天早上8点执行）
# 4. 测试运行：点击任务右侧的运行按钮，查看日志确认是否正常执行
#
# ==============================================
#
# 【四、自定义配置说明（脚本内修改）】
# 1. 代理开关：
#    ENABLE_PER_ACCOUNT_PROXY = True  # 每个账号独立代理（推荐）
#    ENABLE_DIRECT_FALLBACK = True    # 代理失败自动切换直连
#
# 2. 关闭代理：清空PROXY_API环境变量即可自动使用直连模式
#
# ==============================================
#
# 【五、常见问题排查】
# 1. ❌ 获取code失败
#    - 检查code服务是否正常运行
#    - 确认VX_GO内服务器地址和端口是否正确
#    - 测试配置格式：VX_GO=yyb-go:8000@你的openid
#
# 2. ❌ 获取token失败
#    - 确认code未过期（有效期5分钟）
#    - 检查网络是否能访问 crm.nestlechinese.com
#    - 关闭系统代理，使用脚本内置代理或直连
#
# 3. ❌ 代理相关问题
#    - 确认品赞API链接是否正确
#    - 检查代理IP是否有剩余
#    - 尝试切换代理类型为socks5
#
# ==============================================
#
# 【六、更新日志】
# v2.1.0 (2026-05-13)
# - 优化青龙面板日志格式，code参数专业打印
# - 恢复品赞代理系统，支持单账号独立代理
# - 移除失效的2026年签到接口，解决多余错误提示
# - 精简代码，移除所有失效的抽奖功能
#
# v2.0.0 (2026-05-12)
# - 修复displayVersion大小写错误
# - 新增token有效性验证
# - 同步最新抓包的接口和请求头
#
# ==============================================
#
# 【七、免责声明】
# 本脚本仅供个人学习和研究使用，请勿用于商业用途
# 使用本脚本产生的任何风险由使用者自行承担
# 如有侵权，请联系作者删除
#
# ==============================================

import asyncio
import json
import os
import random
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# 强制全局禁用所有系统代理环境变量
for env_var in [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "http_proxy",
    "https_proxy",
    "ALL_PROXY",
    "all_proxy",
    "NO_PROXY",
    "no_proxy",
]:
    os.environ.pop(env_var, None)

try:
    import httpx
    from httpx import AsyncHTTPTransport
    from httpx_socks import AsyncProxyTransport
except ImportError:
    print("❌ 缺少依赖库，请执行：pip install httpx[http2] httpx-socks python-dotenv")
    sys.exit(1)

# ===================== 配置项 =====================
# 从环境变量 VX_GO 读取内网wxcode服务地址，多条换行分隔
SERVERS = []
env_yyb_go = os.getenv("VX_GO", "")
if env_yyb_go:
    raw_lines = re.split(r"\r?\n|&", env_yyb_go)
    SERVERS = [line.strip() for line in raw_lines if line.strip()]

# 无有效地址直接退出并提示
if len(SERVERS) == 0:
    print("❌ 错误：未读取到环境变量 VX_GO 或无有效服务地址！")
    print("配置示例（青龙环境变量VX_GO值，每行一个地址）：")
    print("127.0.0.1:8088")
    print("192.168.1.21:8088")
    print("10.30.9.49:8088")
    sys.exit(1)

print(f"✅ 成功读取 {len(SERVERS)} 台内网wxcode服务：")
for item in SERVERS:
    print(f" - {item}")
print("-" * 60 + "\n")


def parse_yyb_go_entry(raw_value: str) -> Tuple[str, str, str]:
    value = str(raw_value or "").strip()
    if not value:
        return "", "", ""
    parts = re.split(r"[@#]", value, maxsplit=2)
    server = parts[0].strip()
    ref = parts[1].strip() if len(parts) > 1 else ""
    auth = (parts[2].strip() if len(parts) > 2 else "") or os.environ.get("auth", "") or os.environ.get("AUTH", "")
    server = server.removeprefix("http://").removeprefix("https://").rstrip("/")
    return server, ref, auth


async def get_code_via_yyb(server_entry: str, appid: str) -> Optional[str]:
    server, ref, auth = parse_yyb_go_entry(server_entry)
    if not server:
        print(f"❌ [{server_entry}] 获取code失败 | 服务地址为空")
        return None
    if not ref:
        print(f"❌ [{server_entry}] 获取code失败 | 缺少openid/ref")
        return None

    url = f"http://{server}/wx/code"
    try:
        _headers = {"Authorization": f"Bearer {auth}"} if auth else None
        async with httpx.AsyncClient(timeout=20.0, trust_env=False) as client:
            response = await client.post(url, json={"openid": ref, "appid": appid, "data": {}}, headers=_headers)
            res = response.json()

        code = ((res.get("data") or {}).get("result") or {}).get("code")
        if res.get("code") != 0 or not code:
            print(f"❌ [{server_entry}] 获取code失败 | 返回异常: {str(res)[:200]}")
            return None

        print(f"✅ [{server}] 获取code成功")
        return code
    except json.JSONDecodeError:
        print(f"❌ [{server_entry}] 获取code失败 | 响应不是JSON格式")
        return None
    except Exception as e:
        print(f"❌ [{server_entry}] 获取code异常 | 原因: {str(e)}")
        return None


PLUSPLUS_TOKEN = os.getenv("PLUSPLUS_TOKEN", "")

# 品赞代理配置（环境变量，可选）
PROXY_API = os.getenv("PROXY_API", "")
PROXY_TYPE = os.getenv("PROXY_TYPE", "http")
PROXY_RETRY_TIMES = 3
PROXY_VALIDATE_URL = "http://httpbin.org/ip"

# 核心代理开关
ENABLE_PER_ACCOUNT_PROXY = True
PROXY_FETCH_INTERVAL = 3000
ENABLE_DIRECT_FALLBACK = True

# 固定配置
APPID = "wxc5db704249c9bb31"
APP_VERSION = "491"
XWEB_VERSION = "19823"
TOKEN_CLIENT_ID = "wechatMini"
TOKEN_CLIENT_SECRET = "secret"
TOKEN_GRANT_TYPE = "wechat_auth_code"
TOKEN_URL = "https://crm.nestlechinese.com/openapi/identityservice/connect/token"

# UA池
USER_AGENT_LIST = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 "
        "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI "
        "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) "
        "UnifiedPCWindowsWechat(0xf2541923) XWEB/19823"
    ),
    (
        "Mozilla/5.0 (Linux; Android 14; 2512BPNDAC Build/UKQ1.230917.001; wv) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 "
        "Chrome/146.0.7680.153 Mobile Safari/537.36 "
        f"XWEB/{XWEB_VERSION} MMWEBSDK/20251006 MiniProgramEnv/android"
    ),
]

# 跳过的任务GUID
SKIP_TASK_GUIDS = {
    "38C8BBDA3DAE4CD685B270D939E5063D",
    "36EFECD2AD8C44278317ED567EB24DD9",
}


# ===================== 工具函数 =====================
def sleep(ms: int) -> asyncio.Future:
    return asyncio.sleep(ms / 1000)


def random_int(min_val: int, max_val: int) -> int:
    return random.randint(min_val, max_val)


def get_ua() -> str:
    return random.choice(USER_AGENT_LIST)


def build_direct_transport() -> AsyncHTTPTransport:
    return AsyncHTTPTransport()


# ===================== 品赞代理系统 =====================
def parse_proxy_response(text: str) -> Optional[Dict[str, Any]]:
    text = text.strip()
    if not text:
        return None

    try:
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
    except json.JSONDecodeError:
        if ":" in text:
            parts = text.split(":")
            if len(parts) >= 2:
                return {
                    "host": parts[0],
                    "port": int(parts[1]),
                    "username": parts[2] if len(parts) >= 3 else "",
                    "password": parts[3] if len(parts) >= 4 else "",
                }
    return None


async def validate_proxy(proxy_info: Dict[str, Any]) -> bool:
    if not proxy_info:
        return False

    try:
        transport = build_proxy_transport(proxy_info)
        async with httpx.AsyncClient(transport=transport, timeout=15.0) as client:
            response = await client.get(PROXY_VALIDATE_URL)
            if response.status_code == 200:
                ip = response.json().get("origin", "未知")
                print(f"✅ 代理验证通过 | 出口IP: {ip}")
                return True
    except Exception as e:
        print(f"⚠️ 代理验证失败 | 原因: {str(e)}")
    return False


def build_proxy_transport(proxy_info: Dict[str, Any]) -> Optional[AsyncProxyTransport]:
    if not proxy_info:
        return None

    host = proxy_info["host"]
    port = proxy_info["port"]
    username = proxy_info["username"]
    password = proxy_info["password"]

    try:
        if PROXY_TYPE == "socks5":
            proxy_url = (
                f"socks5://{username}:{password}@{host}:{port}"
                if username and password
                else f"socks5://{host}:{port}"
            )
        else:
            proxy_url = (
                f"http://{username}:{password}@{host}:{port}"
                if username and password
                else f"http://{host}:{port}"
            )

        return AsyncProxyTransport.from_url(proxy_url)
    except Exception as e:
        print(f"❌ 代理生成失败 | 原因: {str(e)}")
        return None


async def get_valid_proxy(account_name: str) -> Optional[Dict[str, Any]]:
    if not PROXY_API:
        print(f"ℹ️ [{account_name}] 未配置代理 | 使用直连模式")
        return None

    print(f"🔌 [{account_name}] 正在获取专属代理...")

    for i in range(PROXY_RETRY_TIMES):
        try:
            async with httpx.AsyncClient(
                timeout=15.0, transport=build_direct_transport()
            ) as client:
                response = await client.get(PROXY_API)
            proxy_info = parse_proxy_response(response.text)

            if not proxy_info:
                print(f"⚠️ [{account_name}] 第{i + 1}次获取代理失败 | 响应格式错误")
                continue

            if await validate_proxy(proxy_info):
                return proxy_info
            else:
                print(f"⚠️ [{account_name}] 第{i + 1}次代理不可用 | 重试中...")

        except Exception as e:
            print(f"⚠️ [{account_name}] 第{i + 1}次获取代理异常 | 原因: {str(e)}")

        if i < PROXY_RETRY_TIMES - 1:
            await sleep(2000)

    print(f"❌ [{account_name}] 代理获取失败 | 切换直连模式")
    return None


# ===================== PushPlus推送函数 =====================
async def send_plusplus_notification(title: str, content: str) -> None:
    if not PLUSPLUS_TOKEN:
        return

    try:
        async with httpx.AsyncClient(
            timeout=5.0, transport=build_direct_transport()
        ) as client:
            response = await client.post(
                "https://www.pushplus.plus/send",
                json={
                    "token": PLUSPLUS_TOKEN,
                    "title": title,
                    "content": content,
                    "template": "txt",
                },
            )
        if response.status_code == 200:
            print("✅ 通知推送成功")
    except Exception as e:
        print(f"❌ 通知推送失败 | 原因: {str(e)}")


# ===================== 核心业务类 =====================
class QueChaoBot:
    def __init__(self, server: str, proxy_info: Optional[Dict[str, Any]] = None):
        self.server = server
        self.proxy_info = proxy_info
        self.base_url = "https://crm.nestlechinese.com"
        self.token = None
        self.ua = get_ua()
        self.client = None

    async def get_code(self) -> Optional[str]:
        """从本地服务获取code（青龙优化版日志）"""
        return await get_code_via_yyb(self.server, APPID)

    async def get_token_by_code(self, code: str) -> Optional[str]:
        """通过code换取token（简洁日志）"""
        print(f"🔑 [{self.server}] 正在换取token...")

        headers = {
            "Host": "crm.nestlechinese.com",
            "Connection": "keep-alive",
            "User-Agent": self.ua,
            "xweb_xhr": "1",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "*/*",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Referer": f"https://servicewechat.com/{APPID}/{APP_VERSION}/page-frame.html",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }

        form_data = {
            "client_id": TOKEN_CLIENT_ID,
            "client_secret": TOKEN_CLIENT_SECRET,
            "grant_type": TOKEN_GRANT_TYPE,
            "auth_code": code,
        }

        try:
            transport = (
                build_proxy_transport(self.proxy_info)
                if self.proxy_info
                else build_direct_transport()
            )
            mode = "代理" if self.proxy_info else "直连"

            async with httpx.AsyncClient(
                transport=transport, headers=headers, timeout=20.0, http2=True
            ) as client:
                response = await client.post(TOKEN_URL, data=form_data)

            if response.status_code != 200:
                raise Exception(f"HTTP错误: {response.status_code}")

            res = response.json()
            if (
                res.get("access_token")
                and res.get("token_type", "Bearer").lower() == "bearer"
            ):
                self.token = res["access_token"]
                print(f"✅ [{self.server}] 获取token成功 | 模式: {mode}")
                return self.token
            else:
                raise Exception(f"业务错误: {res.get('error', '未知错误')}")
        except Exception as e:
            print(f"⚠️ [{self.server}] {mode}获取token失败 | 原因: {str(e)}")

            if self.proxy_info and ENABLE_DIRECT_FALLBACK:
                print(f"🌐 [{self.server}] 切换直连重试...")
                try:
                    async with httpx.AsyncClient(
                        headers=headers,
                        timeout=20.0,
                        http2=True,
                        transport=build_direct_transport(),
                    ) as client:
                        response = await client.post(TOKEN_URL, data=form_data)

                    res = response.json()
                    if res.get("access_token"):
                        self.token = res["access_token"]
                        print(f"✅ [{self.server}] 直连获取token成功")
                        return self.token
                    else:
                        raise Exception(f"直连业务错误: {res.get('error', '未知错误')}")
                except Exception as e2:
                    print(f"❌ [{self.server}] 直连获取token失败 | 原因: {str(e2)}")

        return None

    async def __aenter__(self):
        transport = (
            build_proxy_transport(self.proxy_info)
            if self.proxy_info
            else build_direct_transport()
        )
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._get_base_headers(),
            transport=transport,
            http2=True,
            timeout=30.0,
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    def _get_base_headers(self) -> Dict[str, str]:
        headers = {
            "Host": "crm.nestlechinese.com",
            "displayVersion": "0",
            "User-Agent": self.ua,
            "xweb_xhr": "1",
            "Content-Type": "application/json",
            "Accept": "*/*",
            "Referer": f"https://servicewechat.com/{APPID}/{APP_VERSION}/page-frame.html",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }

        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        return headers

    def check_response(self, response_data: Dict[str, Any]) -> bool:
        if response_data.get("errcode") != 200:
            print(
                f"❌ [{self.server}] 请求失败 | "
                f"原因: {response_data.get('errmsg', '未知错误')}"
            )
            return False
        return True

    async def get_user_balance(self) -> Optional[int]:
        try:
            response = await self.client.post(
                "/openapi/pointsservice/api/Points/getuserbalance", content="{}"
            )
            response_data = response.json()

            if self.check_response(response_data):
                return response_data.get("data")
            return None
        except Exception as e:
            print(f"❌ [{self.server}] 获取积分失败 | 原因: {str(e)}")
            return None

    async def daily_sign(self) -> Tuple[bool, str]:
        try:
            response = await self.client.post(
                "/openapi/activityservice/api/sign2025/sign",
                content='{"rule_id":1,"goods_rule_id":1}',
            )
            response_data = response.json()

            if response_data.get("errcode") == 201:
                sign_msg = "今日已签到"
                print(f"ℹ️ [{self.server}] {sign_msg}")
                return True, sign_msg

            if self.check_response(response_data):
                data = response_data.get("data", {})
                sign_day = data.get("sign_day", 0)
                sign_points = data.get("sign_points", 0)
                sign_msg = f"签到成功 | 连续{sign_day}天 | +{sign_points}积分"
                print(f"✅ [{self.server}] {sign_msg}")
                return True, sign_msg
            else:
                sign_msg = f"签到失败: {response_data.get('errmsg', '未知错误')}"
                print(f"❌ [{self.server}] {sign_msg}")
                return False, sign_msg

        except Exception as e:
            sign_msg = f"签到异常: {str(e)}"
            print(f"❌ [{self.server}] {sign_msg}")
            return False, sign_msg

    async def get_task_list(self) -> List[Dict[str, Any]]:
        try:
            response = await self.client.post(
                "/openapi/activityservice/api/task/getlist", content="{}"
            )
            response_data = response.json()

            if self.check_response(response_data):
                tasks = response_data.get("data", [])
                uncompleted_tasks = [
                    task
                    for task in tasks
                    if task.get("task_status") == 0
                    and task.get("task_guid") not in SKIP_TASK_GUIDS
                ]
                print(f"📋 [{self.server}] 待完成任务: {len(uncompleted_tasks)}个")
                return uncompleted_tasks
            return []
        except Exception as e:
            print(f"❌ [{self.server}] 获取任务列表失败 | 原因: {str(e)}")
            return []

    async def complete_task(self, task_guid: str, task_desc: str) -> Tuple[bool, str]:
        try:
            response = await self.client.post(
                "/openapi/activityservice/api/task/add",
                content=f'{{"task_guid":"{task_guid}"}}',
            )
            response_data = response.json()

            if self.check_response(response_data):
                msg = f"完成【{task_desc}】 | +2积分"
                print(f"✅ [{self.server}] {msg}")
                return True, msg
            else:
                msg = f"【{task_desc}】失败: {response_data.get('errmsg', '未知错误')}"
                print(f"❌ [{self.server}] {msg}")
                return False, msg

        except Exception as e:
            msg = f"【{task_desc}】异常: {str(e)}"
            print(f"❌ [{self.server}] {msg}")
            return False, msg

    async def run(self) -> Dict[str, Any]:
        result = {
            "server": self.server,
            "success": False,
            "proxy_status": "直连" if not self.proxy_info else "专属代理",
            "sign_msg": "",
            "task_msgs": [],
            "initial_score": 0,
            "final_score": 0,
            "gained_score": 0,
            "error": "",
        }

        print(f"\n{'=' * 40}")
        print(f"[{self.server}] 开始执行任务")
        print(f"{'=' * 40}")

        try:
            await sleep(random_int(2000, 5000))

            # 1. 获取code（关键日志已优化）
            code = await self.get_code()
            if not code:
                result["error"] = "获取code失败"
                return result

            # 2. 获取token
            token = await self.get_token_by_code(code)
            if not token:
                result["error"] = "获取token失败"
                return result

            # 3. 执行业务
            async with self:
                initial_balance = await self.get_user_balance()
                if initial_balance is None:
                    result["error"] = "获取初始积分失败"
                    return result

                result["initial_score"] = initial_balance
                print(f"💰 [{self.server}] 初始积分: {initial_balance}")

                # 每日签到
                sign_success, sign_msg = await self.daily_sign()
                result["sign_msg"] = sign_msg
                await sleep(1000)

                # 完成日常任务
                tasks = await self.get_task_list()
                task_msgs = []
                for task in tasks:
                    task_guid = task.get("task_guid", "")
                    task_desc = task.get(
                        "task_sub_desc", task.get("task_title", "未知任务")
                    )
                    if task_guid:
                        success, msg = await self.complete_task(task_guid, task_desc)
                        task_msgs.append(msg)
                        await sleep(1000)
                result["task_msgs"] = task_msgs

                # 获取最终积分
                final_balance = await self.get_user_balance()
                if final_balance is not None:
                    result["final_score"] = final_balance
                    result["gained_score"] = final_balance - initial_balance
                    print(
                        f"📊 [{self.server}] 今日新增: "
                        f"{result['gained_score']}积分 | 当前: {final_balance}"
                    )

                result["success"] = True
                print(f"✅ [{self.server}] 任务执行完成")

        except Exception as e:
            result["error"] = str(e)
            print(f"❌ [{self.server}] 执行异常 | 原因: {str(e)}")

        return result


# ===================== 主程序 =====================
async def main():
    print("===== 雀巢会员俱乐部每日任务 =====\n")
    print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔌 待执行账号: {len(SERVERS)} 个")
    print(
        "🌐 代理模式: "
        f"{'单账号独立代理' if ENABLE_PER_ACCOUNT_PROXY else '全局共用代理'}\n"
    )

    global_proxy_info = None
    if not ENABLE_PER_ACCOUNT_PROXY and PROXY_API:
        global_proxy_info = await get_valid_proxy("全局共用")

    results = []
    for index, server in enumerate(SERVERS):
        proxy_info = global_proxy_info
        if ENABLE_PER_ACCOUNT_PROXY:
            proxy_info = await get_valid_proxy(server)
            await sleep(PROXY_FETCH_INTERVAL)

        bot = QueChaoBot(server, proxy_info)
        result = await bot.run()
        results.append(result)

        if index < len(SERVERS) - 1:
            print("\n⏳ 等待2秒后执行下一个账号...")
            await sleep(2000)

    # 汇总结果
    notify_content = "### 雀巢每日任务执行结果\n"
    for res in results:
        notify_content += f"\n#### {res['server']}\n"
        notify_content += f"- 代理状态：{res['proxy_status']}\n"
        notify_content += f"- 执行状态：{'成功' if res['success'] else '失败'}\n"
        if res["success"]:
            notify_content += f"- 签到结果：{res['sign_msg']}\n"
            task_summary = (
                "; ".join(res["task_msgs"]) if res["task_msgs"] else "无未完成任务"
            )
            notify_content += f"- 任务完成：{task_summary}\n"
            notify_content += f"- 初始积分：{res['initial_score']}\n"
            notify_content += f"- 最终积分：{res['final_score']}\n"
            notify_content += f"- 今日新增：{res['gained_score']} 积分\n"
        else:
            notify_content += f"- 失败原因：{res['error']}\n"

    await send_plusplus_notification("雀巢每日任务完成", notify_content)

    print("\n" + "=" * 40)
    print("🎉 所有账号执行完成")
    print(f"📊 成功: {sum(1 for r in results if r['success'])}/{len(results)} 个")
    print(
        f"💰 今日总新增: {sum(r['gained_score'] for r in results if r['success'])} 积分"
    )
    print("=" * 40)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️ 用户中断执行")
    except Exception as e:
        print(f"\n❌ 程序异常: {str(e)}")
