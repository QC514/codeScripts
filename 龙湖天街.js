// === YYB_GO 统一通知注入 begin ===
(function installYybOutputStyle() {
  const stateKey = Symbol.for("yyb.output.style");
  if (globalThis[stateKey]) return;

  const childProcess = require("child_process");
  const fs = require("fs");
  const path = require("path");
  const util = require("util");
  const state = {
    currentAccount: null,
    exiting: false,
    failedAccounts: new Set(),
    flushed: false,
    footerPrinted: false,
    logs: [],
    seenAccounts: [],
  };
  globalThis[stateKey] = state;

  const originalConsole = {
    error: console.error.bind(console),
    log: console.log.bind(console),
    warn: console.warn.bind(console),
  };
  const servers = (process.env.YYB_GO || "")
    .split(/\r?\n|&/)
    .map((item) => item.trim())
    .filter(Boolean);
  const displayNames = new Map();

  function nowText() {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Shanghai",
      year: "numeric",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
  }

  function displayWidth(text) {
    return Array.from(String(text)).reduce(
      (width, char) => width + (/[^\x00-\xff]/.test(char) ? 2 : 1),
      0,
    );
  }

  function emitRaw(line = "", method = "log") {
    originalConsole[method](line);
    if (line) state.logs.push(line);
  }

  function emitBox(lines, account = false) {
    const width = Math.max(50, ...lines.map((line) => displayWidth(line) + 1));
    const chars = account
      ? { bottomLeft: "└", bottomRight: "┘", horizontal: "─", topLeft: "┌", topRight: "┐", vertical: "│" }
      : { bottomLeft: "╚", bottomRight: "╝", horizontal: "═", topLeft: "╔", topRight: "╗", vertical: "║" };
    emitRaw(chars.topLeft + chars.horizontal.repeat(width) + chars.topRight);
    for (const line of lines) {
      const padding = Math.max(0, width - 1 - displayWidth(line));
      emitRaw(`${chars.vertical} ${line}${" ".repeat(padding)}${chars.vertical}`);
    }
    emitRaw(chars.bottomLeft + chars.horizontal.repeat(width) + chars.bottomRight);
  }

  function scriptTitle() {
    const fallback = path.basename(process.argv[1] || "YYB_GO", ".js");
    try {
      const source = fs.readFileSync(process.argv[1], "utf8");
      const match = source.match(/^\/\/\s*name:\s*(.+?)\s*$/m);
      return match ? match[1].trim() : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function titleIcon(title) {
    const icons = [
      ["回收", "♻️"],
      ["茶", "🧋"],
      ["酒", "🍺"],
      ["停车", "🚗"],
      ["养车", "🚗"],
      ["绿", "🌿"],
    ];
    const match = icons.find(([keyword]) => title.includes(keyword));
    return match ? match[1] : "🚀";
  }

  function emitStartup() {
    if (servers.length) {
      emitRaw(`✅ 成功读取 ${servers.length} 台内网wxcode服务：`);
      for (const server of servers) emitRaw(` - ${displayName(server)}`);
      emitRaw("-".repeat(60));
      emitRaw();
    }
    const title = scriptTitle();
    emitBox([
      `${titleIcon(title)} ${title}`,
      `🕒 启动时间: ${nowText()}`,
      `🔢 账号数量: ${servers.length}`,
    ]);
  }

  function serverValues(server) {
    const address = server.split("@", 1)[0].trim().replace(/\/+$/, "");
    return [server, address, address.replace(/^https?:\/\//, "")].filter(Boolean);
  }

  function displayName(server) {
    return displayNames.get(server) || server.split("@").pop().trim() || server;
  }

  function loadDisplayNames() {
    for (const server of servers) {
      const atIndex = server.lastIndexOf("@");
      let address = atIndex >= 0 ? server.slice(0, atIndex).trim().replace(/\/+$/, "") : "";
      const openid = atIndex >= 0 ? server.slice(atIndex + 1).trim() : "";
      const fallback = openid || server;
      displayNames.set(server, fallback);
      if (!address || !openid) continue;
      if (!/^https?:\/\//i.test(address)) address = `http://${address}`;
      try {
        const response = childProcess.spawnSync(
          "curl",
          [
            "--silent",
            "--show-error",
            "--max-time",
            "8",
            "--get",
            "--data-urlencode",
            `openid=${openid}`,
            `${address}/accounts/profile`,
          ],
          { encoding: "utf8", windowsHide: true },
        );
        if (response.status !== 0 || !response.stdout) continue;
        const payload = JSON.parse(response.stdout);
        const profile = payload && payload.code === 0 ? payload.data : null;
        const name = profile && (profile.nickname || profile.alias);
        if (name) displayNames.set(server, String(name).replace(/[\r\n]+/g, " ").trim() || fallback);
      } catch (_) {}
    }
  }

  function replaceServerNames(line) {
    let text = String(line);
    for (const server of servers) text = text.split(server).join(displayName(server));
    const candidates = servers.includes(state.currentAccount) ? [state.currentAccount] : servers;
    for (const server of candidates) {
      const values = serverValues(server).slice(1).sort((left, right) => right.length - left.length);
      for (const value of values) text = text.split(value).join(displayName(server));
    }
    return text;
  }

  function ensureAccount(server) {
    state.currentAccount = server;
    if (state.seenAccounts.includes(server)) return;
    state.seenAccounts.push(server);
    const index = servers.includes(server)
      ? servers.indexOf(server) + 1
      : state.seenAccounts.length;
    emitRaw();
    emitBox(
      [`🧩 账号 ${index} / ${servers.length || state.seenAccounts.length}`, `🌍 昵称 ${displayName(server)}`],
      true,
    );
  }

  function detectAccount(line) {
    for (const server of servers) {
      if (line.includes(server)) {
        ensureAccount(server);
        return;
      }
    }
    if (
      servers.includes(state.currentAccount) &&
      serverValues(state.currentAccount).some((value) => line.includes(value))
    )
      return;
    for (const server of servers) {
      if (serverValues(server).slice(1).some((value) => line.includes(value))) {
        ensureAccount(server);
        return;
      }
    }
    const match = line.match(/账号\s*(\d+)/);
    if (match && servers[Number(match[1]) - 1]) ensureAccount(servers[Number(match[1]) - 1]);
  }

  function isDuplicateConfig(line) {
    const text = line.trim();
    if (text.includes("成功读取") && (text.includes("内网") || text.includes("服务"))) return true;
    if (text.startsWith("-") && servers.some((server) => text.includes(server))) return true;
    return text.length >= 20 && /^[-=_━]+$/.test(text);
  }

  function logTag(line) {
    const context = line.split("{", 1)[0];
    const lower = context.toLowerCase();
    if (lower.includes("pushplus") || context.includes("推送")) return "PushPlus";
    if (context.includes("执行失败") || context.includes("执行异常")) return "账号";
    if (
      context.includes("代理") ||
      lower.includes("proxy") ||
      (/\d{1,3}(?:\.\d{1,3}){3}:\d+/.test(context) &&
        ["提取", "生成", "获取"].some((word) => context.includes(word)))
    )
      return "代理";
    if (context.includes("登录") || lower.includes("token") || context.includes("授权")) return "登录";
    if (lower.includes("code") || context.includes("取码")) return "取码";
    if (context.includes("签到") || lower.includes("sign")) return "签到";
    if (context.includes("积分") || context.includes("余额") || context.includes("账户")) return "账户";
    if (context.includes("等待") || context.includes("延迟") || lower.includes("sleep")) return "延迟";
    if (context.includes("账号")) return "账号";
    return "任务";
  }

  function normalizeLine(line, level) {
    let text = line.trim();
    if (!text) return "";
    let accountName = null;
    for (const name of displayNames.values()) {
      const prefix = `[${name}]`;
      if (text.startsWith(prefix)) {
        accountName = name;
        text = text.slice(prefix.length).trim();
        break;
      }
    }
    text = text.replace(/(请求\s*YYB\s*Go\s*获取\s*code)\s*[:：].*$/i, "$1");
    if (text.startsWith("[") || /^[^\w\s]{1,3}\s*\[[^\]]+\]/u.test(text)) return text;
    text = text.replace(/^(?:✅|❌|⚠️?|ℹ️?|🌐|🛠️?|⏳|🔐|🎯|🎰|💰|💸|📊|📡|📝|🔁|🚀)\s*/u, "");
    const lower = text.toLowerCase();
    const tag = logTag(text);
    let icon = "ℹ️";
    if (level === "error" || /(error|exception|traceback)/i.test(lower) || /(失败|错误|异常)/.test(text)) icon = "❌";
    else if (level === "warn" || /(警告|跳过|已签到|已经签到|不可用|未配置)/.test(text)) icon = "⚠️";
    else if (/(等待|延迟)/.test(text)) icon = "⏳";
    else if (tag === "签到" && text.includes("成功")) icon = "📊";
    else if (tag === "账户") icon = "💰";
    else if (/(成功|完成|通过|获得|提取到)/.test(text)) icon = "✅";
    else if (tag === "取码" && text.includes("请求")) icon = "🌐";
    else if (tag === "代理" && text.includes("生成")) icon = "🛠️";
    else if (tag === "代理") icon = "🌐";
    else if (tag === "登录") icon = "🔐";
    return `${icon} [${accountName || tag}] ${text}`;
  }

  function recordStatus(line) {
    if (!state.currentAccount || !line.startsWith("❌")) return;
    if (/(\[账号\]|\[主程序\]|\[登录\]|执行失败|执行异常)/.test(line)) {
      state.failedAccounts.add(state.currentAccount);
    }
  }

  function emitFooter() {
    if (state.footerPrinted) return;
    state.footerPrinted = true;
    const total = servers.length || state.seenAccounts.length;
    const failed = state.failedAccounts.size;
    const success = Math.max(0, total - failed);
    emitRaw();
    emitBox([
      `🏁 ${scriptTitle()}任务执行完成`,
      `✅ 成功: ${success}`,
      `❌ 失败: ${failed}`,
      `🕒 结束时间: ${nowText()}`,
    ]);
  }

  function processLine(line, level) {
    detectAccount(line);
    if (isDuplicateConfig(line)) return;
    line = replaceServerNames(line);
    if (/^[╔║╚┌│└]/u.test(line.trim())) return;
    if (line.includes("任务执行完成") || /^[✅❌🕒]\s*(成功|失败|结束时间)\s*[:：]/u.test(line.trim())) return;
    const normalized = normalizeLine(line, level);
    recordStatus(normalized);
    const pushEvent =
      logTag(line) === "PushPlus" &&
      !/^\s*[=\-*]/u.test(line) &&
      ["开始推送", "正在推送", "未配置", "跳过", "成功", "失败", "异常"].some(
        (keyword) => line.includes(keyword),
      );
    if (pushEvent) emitFooter();
    emitRaw(normalized, level === "error" ? "error" : level === "warn" ? "warn" : "log");
  }

  function compactJsonOutput(value) {
    const text = String(value);
    if (!/[\r\n]/.test(text)) return text;
    const ending = (text.match(/[\r\n]+$/) || [""])[0];
    const body = ending ? text.slice(0, -ending.length) : text;
    for (let index = 0; index < body.length; index += 1) {
      if (body[index] !== "{" && body[index] !== "[") continue;
      try {
        const payload = JSON.parse(body.slice(index));
        return `${body.slice(0, index)}${JSON.stringify(payload)}${ending}`;
      } catch (_) {}
    }
    return text;
  }

  function formatLogArgs(args) {
    const values = args.map((value) => {
      if (value instanceof Error) return value.stack || value.message;
      if (value === null || typeof value !== "object") return value;
      try {
        return JSON.stringify(value);
      } catch (_) {
        return util.inspect(value, {
          breakLength: Infinity,
          compact: true,
          depth: null,
          maxArrayLength: null,
          maxStringLength: null,
        });
      }
    });
    return util.format(...values);
  }

  function capture(level, args) {
    try {
      const text = compactJsonOutput(formatLogArgs(args));
      for (const line of text.split(/\r?\n/)) processLine(line, level);
    } catch (_) {}
  }

  console.log = (...args) => capture("log", args);
  console.warn = (...args) => capture("warn", args);
  console.error = (...args) => capture("error", args);

  function resolveKey() {
    const environmentKey = process.env.QYWX_KEY || process.env.QYWX || process.env.WEWORK_KEY;
    if (environmentKey) return environmentKey;
    for (const candidate of ["./sendNotify", "/ql/data/scripts/sendNotify"]) {
      try {
        const notifyPath = require.resolve(candidate);
        const source = fs.readFileSync(notifyPath, "utf8");
        const match = source.match(/QYWX_KEY\s*=\s*["']([^"']+)["']/);
        if (match) return match[1];
      } catch (_) {}
    }
    return null;
  }

  function trySendNotify(title, body) {
    for (const candidate of ["./sendNotify", "/ql/data/scripts/sendNotify"]) {
      try {
        const notifyModule = require(candidate);
        const sendNotify = typeof notifyModule === "function" ? notifyModule : notifyModule && notifyModule.sendNotify;
        if (typeof sendNotify === "function") {
          sendNotify(title, body);
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  function sendWebhook(key, title, body) {
    const payload = JSON.stringify({ msgtype: "text", text: { content: `【${title}】\n${body}` } });
    childProcess.spawnSync(
      "curl",
      ["--silent", "--max-time", "15", "--request", "POST", "--header", "Content-Type: application/json", "--data-binary", "@-", `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`],
      { input: payload, stdio: ["pipe", "ignore", "ignore"] },
    );
  }

  function flushNotification() {
    if (state.flushed) return;
    state.flushed = true;
    emitFooter();
    const title = path.basename(process.argv[1] || "YYB_GO");
    const body = state.logs.slice(-40).join("\n") || "任务执行完成，无日志输出。";
    if (trySendNotify(title, body)) return;
    const key = resolveKey();
    if (key) sendWebhook(key, title, body);
  }

  loadDisplayNames();
  emitStartup();
  const originalExit = process.exit.bind(process);
  process.exit = (code) => {
    if (state.exiting) return originalExit(code);
    state.exiting = true;
    flushNotification();
    return originalExit(code);
  };
  process.on("beforeExit", () => {
    if (state.exiting) return;
    state.exiting = true;
    flushNotification();
  });
})();
// === YYB_GO 统一通知注入 end ===

// name: 龙湖天街
// cron: 42 9 * * *

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// ====================== YYB Go 账号（环境变量 YYB_GO = 多行，每行 地址@微信账号标识） ======================
// 任何形如 [object Object] 或不含 @ 的脏行都会被自动跳过，不影响其他有效账号。
function buildServers() {
    const raw = String(process.env.YYB_GO || "").trim();
    if (!raw) {
        console.error("未配置环境变量 YYB_GO，请设置后重试（格式：地址@微信账号标识，多行换行）");
        process.exit(1);
    }
    console.log("YYB_GO 原始内容(前200字): " + raw.slice(0, 200).replace(/\r/g, "").replace(/\n/g, "\\n"));
    return raw
        .split(/\r?\n|&/)
        .map(s => String(s).trim())
        .filter(Boolean)
        .filter(line => {
            if (line === "[object Object]") {
                console.log("已跳过无效行: [object Object]");
                return false;
            }
            if (!line.includes("@")) {
                console.log("YYB_GO 格式应为 地址@微信账号标识，已跳过当前值: " + line);
                return false;
            }
            return true;
        });
}
const SERVERS = buildServers();
if (!SERVERS.length) {
    console.error("未配置有效的 YYB_GO 账号（每行格式：地址@微信账号标识）");
    process.exit(1);
}
function parseYybGoEntry(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return { server: "", ref: "" };
    const atIndex = value.indexOf("@");
    if (atIndex === -1) {
        console.log("YYB_GO 格式应为 地址@微信账号标识，当前值: " + value);
        return { server: "", ref: "" };
    }
    let server = value.slice(0, atIndex).trim();
    const ref = value.slice(atIndex + 1).trim();
    if (server.startsWith("http://")) server = server.slice(7);
    else if (server.startsWith("https://")) server = server.slice(8);
    server = server.replace(/\/+$/, "");
    if (!server || !ref) return { server: "", ref: "" };
    return { server, ref };
}
async function getCode(server) {
    const { server: parsedServer, ref } = parseYybGoEntry(server);
    if (!parsedServer || !ref) return null;
    const url = "http://" + parsedServer + "/wxapp/getCode";
    try {
        const { data } = await axios.post(url, { ref, app_id: MINI_APP_ID }, { timeout: 20000, proxy: false });
        const code = data && data.data && data.data.result && data.data.result.code;
        if (!data || data.code !== 0 || !code) {
            console.log(parsedServer + " 获取code失败: " + JSON.stringify(data));
            return null;
        }
        console.log(parsedServer + " 获取code成功");
        return code;
    } catch (e) {
        console.log(parsedServer + " 获取code异常: " + e.message);
        return null;
    }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
let userIdx = 1;

const MINI_APP_ID = "wx50282644351869da";
const PAGE_VERSION = "506";
const API_VERSION = "v1_25_0";
const APP_VERSION = "1.25.0";
const CHANNEL = "C2";
const BU_CODE = "C20400";
const BASE_HOST = "https://gw2c-hw-open.longfor.com/supera";
const MEMBER_HOST = `${BASE_HOST}/member`;
const TASK_HOST = "https://gw2c-hw-open.longfor.com/lmarketing-task-api-mvc-prod";
const MEMBER_GAIA_KEY = "98717e7a-a039-46af-8143-be7558a089c0";
const TASK_GAIA_KEY = "c06753f1-3e68-437d-b592-b94656ea5517";
const MINI_SIGN_SECRET = "Q74eKtH5LePYfSjIiflUbCL2gxjTa7rF";
const DX_MINI_CONFIG = {
    appId: "d1a43734fc59aeae9f1562dbd70fdf54",
    server: "https://ly-sta.longhu.net/udid/w1",
    cache: true,
    gps: true,
};
const DX_ALPHABET = "S0DOZN9bBJyPV-qczRa3oYvhGlUMrdjW7m2CkE5_FuKiTQXnwe6pg8fs4HAtIL1x=";
const DX_LID_KEY = "_dx_uzZo5y";
const DX_TOKEN_KEY = "_dx_raAh8q";
const DX_STORAGE = new Map();
const DX_KEY_MAP = {
    SDKVersion: "sv",
    accuracy: "ac",
    altitude: "att",
    available: "al",
    batteryLevel: "bl",
    benchmarkLevel: "bml",
    brand: "bd",
    BSSID: "bs",
    collectTime: "ct",
    discovering: "dc",
    fontSizeSetting: "fss",
    horizontalAccuracy: "ha",
    language: "lang",
    latitude: "lt",
    longitude: "lgt",
    model: "md",
    networkType: "nt",
    pixelRatio: "pr",
    platform: "pf",
    screenHeight: "sh",
    screenWidth: "sw",
    secure: "se",
    speed: "sp",
    signalStrength: "ss",
    statusBarHeight: "",
    supportMode: "sm",
    system: "sy",
    SSID: "si",
    version: "vs",
    verticalAccuracy: "va",
    windowHeight: "wh",
    windowWidth: "ww",
    gps: "gps",
};
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "longfor_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

function readCache() {
    try {
        if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
    } catch (e) {
        return {};
    }
}

function writeCache(cache) {
    try {
        fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
    } catch (e) {
        console.log(`写入token缓存失败: ${e.message || e}`);
    }
}

function shortValue(value = "") {
    const text = String(value || "");
    return text ? `${text.slice(0, 4)}***${text.slice(-4)}` : "";
}

function uuid() {
    return crypto.randomUUID().replace(/-/g, "");
}

function canonicalize(data = {}) {
    return Object.keys(data || {})
        .sort()
        .map((key) => {
            let value = data[key];
            if (Array.isArray(value)) {
                let text = "[";
                if (!value.length) text += "]";
                value.forEach((item, index) => {
                    if (Array.isArray(item)) text += JSON.stringify(item);
                    else if (typeof item === "object" && item !== null) text += `{${canonicalize(item)}}`;
                    else text += item;
                    text += index < value.length - 1 ? "," : "]";
                });
                value = text;
            } else if (typeof value === "object" && value !== null) {
                value = `{${canonicalize(value)}}`;
            }
            return `${value}`.trim() && `${value}` !== "null" ? `${key}=${value}` : "";
        })
        .filter(Boolean)
        .join("|");
}

function miniSign(data) {
    const timestamp = Date.now().toString();
    const body = canonicalize(JSON.parse(JSON.stringify(data || {})));
    const raw = `${body ? `${body}&` : ""}${timestamp}&${MINI_SIGN_SECRET}`;
    return {
        "X-LONGZHU-TimeStamp": timestamp,
        "X-Client-Type": "microApp",
        "X-LONGZHU-Sign": crypto.createHash("md5").update(raw).digest("hex"),
    };
}

function dxMakeLocalId(length = 32) {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let value = "";
    for (let i = 0; i < length; i++) value += chars.charAt(Math.floor(Math.random() * chars.length));
    return value;
}

function dxEncrypt(data) {
    const text = JSON.stringify(data) || "";
    let output = "";
    for (let index = 0; index < text.length; ) {
        const first = text.charCodeAt(index++);
        const second = text.charCodeAt(index++);
        const third = text.charCodeAt(index++);
        const a = first >> 2;
        const b = ((first & 3) << 4) | (second >> 4);
        let c = ((second & 15) << 2) | (third >> 6);
        let d = third & 63;
        if (Number.isNaN(second)) c = d = 64;
        else if (Number.isNaN(third)) d = 64;
        output += DX_ALPHABET.charAt(a) + DX_ALPHABET.charAt(b) + DX_ALPHABET.charAt(c) + DX_ALPHABET.charAt(d);
    }
    return output;
}

function dxSelectMethod(param) {
    return param && param.length > 1024 ? "POST" : "GET";
}

function dxShorten(data = {}) {
    const output = {};
    for (const key in data) output[DX_KEY_MAP[key] ? DX_KEY_MAP[key] : key] = data[key];
    return output;
}

function dxSystemInfo() {
    return {
        brand: "microsoft",
        model: "Windows WeChat",
        pixelRatio: 1,
        screenWidth: 414,
        screenHeight: 896,
        windowWidth: 414,
        windowHeight: 896,
        statusBarHeight: 0,
        language: "zh_CN",
        version: "8.0.58",
        system: "Windows 10 x64",
        platform: "windows",
        fontSizeSetting: 16,
        SDKVersion: "3.9.12",
        benchmarkLevel: 1,
        batteryLevel: 100,
    };
}

async function dxCollect(options = {}) {
    const start = Date.now();
    const data = {
        networkType: "wifi",
        ...dxSystemInfo(),
    };
    if (options.gps) data.gps = process.env.longfor_gps || "116.397128,39.916527";
    data.collectTime = Date.now() - start;
    return dxShorten(data);
}

class MiniDxConstId {
    constructor(options = {}) {
        this.options = { ...DX_MINI_CONFIG, ...(options || {}) };
        this.options.appId = this.options.appId || this.options.appKey;
        if (!this.options.server || !this.options.appId) throw new Error("missing dx server/appId");
    }

    getToken() {
        return DX_STORAGE.get(DX_TOKEN_KEY) || "";
    }

    setToken(token) {
        DX_STORAGE.set(DX_TOKEN_KEY, token);
    }

    async getLid() {
        const lid = DX_STORAGE.get(DX_LID_KEY) || `${Date.now()}${dxMakeLocalId()}`;
        DX_STORAGE.set(DX_LID_KEY, lid);
        return lid;
    }

    mergeOptions(extra = {}) {
        const data = { ...extra };
        ["appId", "userId", "openId", "scene"].forEach((key) => {
            if (this.options[key]) data[key] = encodeURIComponent(this.options[key]);
        });
        data.appKey = data.appId;
        delete data.appId;
        return data;
    }

    async request(param, token = "") {
        const method = dxSelectMethod(param);
        const options = {
            method,
            url: this.options.server,
            headers: {
                Param: method === "POST" ? "" : param,
                "If-None-Match": token,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 15000,
            validateStatus: () => true,
        };
        if (method === "POST") options.data = new URLSearchParams({ Param: param }).toString();
        else options.params = { Param: "" };
        const { data } = await axios.request(options);
        return data;
    }

    async detect() {
        const lid = await this.getLid();
        const collected = await dxCollect(this.options);
        const param = dxEncrypt(this.mergeOptions({ lid, ...collected }));
        const data = await this.request(param, "");
        if (Number(data.status) === 2) {
            this.setToken(data.data);
            return data.data;
        }
        throw new Error(`dx status: ${data.status}`);
    }

    async generate() {
        const lid = await this.getLid();
        const param = dxEncrypt(this.mergeOptions({ lid, cache: !!this.options.cache }));
        const data = await this.request(param, this.getToken());
        const status = Number(data.status);
        if (status === 1 || status === 2) {
            this.setToken(data.data);
            return data.data;
        }
        if (status === -4 && data.data) {
            DX_STORAGE.set(DX_LID_KEY, data.data);
            return this.detect();
        }
        return this.detect();
    }
}

async function getDxToken() {
    if (process.env.longfor_dx_token) return process.env.longfor_dx_token;
    return new MiniDxConstId().generate();
}

function ok(code) {
    return ["200", "0000", "10000"].includes(String(code));
}

function tokenError(error) {
    return /token|登录|授权|未登录|801007|900005|900006/i.test(String(error?.message || error));
}

class Task {
    constructor(account) {
        this.index = userIdx++;
        this.account = String(account || "").trim();
        this.server = this.account;
        this.token = "";
        this.lmid = "";
        this.expire = 0;
        this.activityNo = "";
    }

    applyToken(data = {}) {
        this.token = data.token || "";
        this.lmid = data.lmid || "";
        this.expire = Number(data.expire || 0);
    }

    getCachedToken() {
        const item = readCache()[this.account];
        if (!item?.token) return null;
        if (item.expireAt && Number(item.expireAt) < Date.now() + 60000) return null;
        return item;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readCache();
        cache[this.account] = {
            token: this.token,
            lmid: this.lmid,
            expireAt: this.expire ? Date.now() + this.expire * 1000 : 0,
            updatedAt: new Date().toISOString(),
        };
        writeCache(cache);
    }

    removeCachedToken() {
        const cache = readCache();
        if (cache[this.account]) {
            delete cache[this.account];
            writeCache(cache);
        }
        this.token = "";
        this.lmid = "";
        this.expire = 0;
    }

    miniHeaders(data = null, member = false) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Content-Type": "application/json",
            "lmToken": this.token || "",
            "X-LF-Bucode": BU_CODE,
            "X-LF-App-Version": APP_VERSION,
            "X-LF-RequestId": uuid(),
            "X-LF-Channel": CHANNEL,
            "X-LF-Api-Version": API_VERSION,
        };
        if (member) headers["X-Gaia-Api-Key"] = MEMBER_GAIA_KEY;
        if (data) Object.assign(headers, miniSign(data));
        return headers;
    }

    taskHeaders(dxToken = "") {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": "https://longzhu.longfor.com/longball-homeh5/",
            "Content-Type": "application/json;charset=UTF-8",
            "X-GAIA-API-KEY": TASK_GAIA_KEY,
            "token": this.token,
            "X-LF-UserToken": this.token,
            "X-LF-Channel": CHANNEL,
            "X-LF-Bu-Code": BU_CODE,
        };
        if (dxToken) {
            headers["X-LF-DXRisk-Token"] = dxToken;
            headers["X-LF-DXRisk-Source"] = 3;
            headers["X-LF-DXRisk-Captcha-Token"] = "";
        }
        return headers;
    }

    async miniPost(url, data, member = false) {
        const { data: result, status } = await axios.post(url, data, {
            headers: this.miniHeaders(data, member),
            timeout: 20000,
            validateStatus: () => true,
        });
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!ok(result?.code)) {
            const err = new Error(result?.msg || result?.message || JSON.stringify(result));
            err.code = result?.code;
            throw err;
        }
        return result.data;
    }

    async taskPost(pathname, data, dxToken = "") {
        const { data: result, status } = await axios.post(`${TASK_HOST}${pathname}`, data, {
            headers: this.taskHeaders(dxToken),
            timeout: 20000,
            validateStatus: () => true,
        });
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        return result;
    }

    async getLoginCode() {
        const code = await getCode(this.server);
        if (!code) console.log(`账号[${this.index}] 获取微信code失败：请检查 YYB_GO 格式是否为 地址@微信账号标识（每行一个）且 YYB Go 服务可访问`);
        return code;
    }

    async loginByWxCode() {
        const code = await this.getLoginCode();
        if (!code) {
            throw new Error(`获取微信code失败：请检查 YYB_GO 中该账号在 YYB Go 是否已绑定龙湖天街小程序（appId ${MINI_APP_ID}）`);
        }
        const checkData = {
            appId: MINI_APP_ID,
            thirdType: "WX_APPLET",
            fingerprint: "",
            authCode: code,
        };
        const check = await this.miniPost(`${BASE_HOST}/mine/${API_VERSION}/publicApi/login/checkLoginType`, checkData);
        const loginData = {
            appId: MINI_APP_ID,
            authCode: code,
            isNew: false,
            thirdType: "WX_APPLET",
            fingerprint: "",
            ticket: check?.ticket || "",
        };
        const login = await this.miniPost(`${BASE_HOST}/mine/${API_VERSION}/publicApi/login/loginByMiniApp`, loginData);
        this.applyToken(login);
        if (!this.token) throw new Error(`登录响应未返回 token: ${JSON.stringify(login)}`);
        this.saveCachedToken();
        console.log(`账号[${this.index}] 登录成功: token=${shortValue(this.token)} lmid=${shortValue(this.lmid)}`);
    }

    findActivityNo(payload) {
        return (JSON.stringify(payload || {}).match(/activity_no=([0-9]+)/) || [])[1] || "";
    }

    async getPageConfig() {
        const data = await this.miniPost(
            `${MEMBER_HOST}/api/bff/pages/${API_VERSION}/publicApi/v1/pageConfig`,
            { pageCode: "C2mine" },
            true
        );
        this.activityNo = this.findActivityNo(data);
        return data;
    }

    async checkToken() {
        try {
            await this.getPageConfig();
            return true;
        } catch (e) {
            return false;
        }
    }

    async getPageInfo() {
        const result = await this.taskPost("/openapi/task/v1/signature/page-info", { activity_no: this.activityNo });
        if (!ok(result?.code)) throw new Error(result?.message || result?.msg || JSON.stringify(result));
        return result.data || {};
    }

    todaySigned(pageInfo) {
        const today = Array.isArray(pageInfo?.seven_days_signs) ? pageInfo.seven_days_signs[0] : {};
        return Number(today?.sign_status) === 20;
    }

    rewardText(rewards = []) {
        if (!Array.isArray(rewards)) return "";
        return rewards
            .map((item) => {
                const num = item?.reward_num || item?.num || item?.amount;
                const name = item?.reward_name || item?.reward_type_name || item?.unit || "";
                return num ? `${name}${num}` : "";
            })
            .filter(Boolean)
            .join(",");
    }

    async signIn() {
        await this.getPageConfig();
        if (!this.activityNo) throw new Error("未在会员页配置中找到签到 activity_no");

        const pageInfo = await this.getPageInfo();
        console.log(`账号[${this.index}] 活动: ${pageInfo.task_name || "签到"} 今日=${this.todaySigned(pageInfo) ? "已签到" : "未签到"}`);
        if (this.todaySigned(pageInfo)) return;

        const dxToken = await getDxToken();
        console.log(`账号[${this.index}] 风控指纹${dxToken ? "获取成功" : "获取失败，直接尝试"}`);

        const result = await this.taskPost("/openapi/task/v1/signature/clock", { activity_no: this.activityNo }, dxToken);
        if (!ok(result?.code)) {
            const err = new Error(result?.message || result?.msg || JSON.stringify(result));
            err.code = result?.code;
            throw err;
        }
        console.log(`账号[${this.index}] 签到成功${this.rewardText(result?.data?.reward_info) ? `: ${this.rewardText(result.data.reward_info)}` : ""}`);
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached) {
            this.applyToken(cached);
            console.log(`账号[${this.index}] 使用缓存token: ${shortValue(this.token)}`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存token失效，重新登录`);
            }
        }
        if (!this.token) await this.loginByWxCode();
        if (!this.token) return;

        try {
            await this.signIn();
        } catch (e) {
            console.log(`账号[${this.index}] 签到失败${e.code ? `(${e.code})` : ""}: ${e.message || e}`);
            if (tokenError(e)) this.removeCachedToken();
        }
    }
}

!(async () => {
    for (const account of SERVERS) {
        const task = new Task(account);
        try {
            await task.run();
        } catch (e) {
            console.log(`账号[${task.index}] 处理异常已跳过: ${e.message || e}`);
        }
    }
})()
    .catch((e) => console.log(e.message || e))
