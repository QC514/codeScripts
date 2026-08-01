// === VX_GO 统一通知注入 begin ===
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
  const servers = (process.env.VX_GO || "")
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
    const fallback = path.basename(process.argv[1] || "VX_GO", ".js");
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
    const address = server.split(/[@#]/)[0].trim().replace(/\/+$/, "");
    return [server, address, address.replace(/^https?:\/\//, "")].filter(Boolean);
  }

  function displayName(server) {
    return displayNames.get(server) || (server.split(/[@#]/)[1] || "").trim() || server;
  }

  function loadDisplayNames() {
    for (const server of servers) {
      const parts = server.split(/[@#]/);
      let address = (parts[0] || "").trim().replace(/\/+$/, "");
      const openid = (parts[1] || "").trim();
      const auth = (parts[2] || "").trim() || (process.env.auth || process.env.AUTH || "").trim();
      const fallback = openid || server;
      displayNames.set(server, fallback);
      if (!address || !openid) continue;
      if (!/^https?:\/\//i.test(address)) address = `http://${address}`;
      try {
        const curlArgs = [
            "--silent",
            "--show-error",
            "--max-time",
            "8",
            "--get",
            "--data-urlencode",
            `openid=${openid}`,
          ];
        if (auth) curlArgs.push("--header", `Authorization: Bearer ${auth}`);
        curlArgs.push(`${address}/accounts/profile`);
        const response = childProcess.spawnSync(
          "curl",
          curlArgs,
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
    text = text.replace(/(请求\s*(?:YYB|VX)\s*Go\s*获取\s*code)\s*[:：].*$/i, "$1");
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
    const title = path.basename(process.argv[1] || "VX_GO");
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
// === VX_GO 统一通知注入 end ===

// name: 腾讯地图
// cron: 19 8 * * *

const axios = require("axios");
const crypto = require("crypto");
// ====================== VX Go 账号（环境变量 VX_GO = 地址#微信账号标识[#auth]，多行） ======================
const SERVERS = (process.env.VX_GO || "")
    .split(/\r?\n|&/)
    .map(s => s.trim())
    .filter(Boolean);
if (!SERVERS.length) {
    console.error("未配置环境变量 VX_GO，请设置后重试（格式：地址#微信账号标识[#auth]，多行换行）");
    process.exit(1);
}
function parseYybGoEntry(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return { server: "", ref: "", auth: "" };
    const parts = value.split(/[@#]/);
    if (parts.length < 2) {
        console.log("VX_GO 格式应为 地址#微信账号标识[#auth]，当前值: " + value);
        return { server: "", ref: "", auth: "" };
    }
    let server = parts[0].trim();
    const ref = parts[1].trim();
    const auth = (parts[2] || "").trim() || (process.env.auth || process.env.AUTH || "").trim();
    if (server.startsWith("http://")) server = server.slice(7);
    else if (server.startsWith("https://")) server = server.slice(8);
    server = server.replace(/\/+$/, "");
    if (!server || !ref) return { server: "", ref: "", auth: "" };
    return { server, ref, auth };
}
async function getCode(server) {
    const { server: parsedServer, ref, auth } = parseYybGoEntry(server);
    if (!parsedServer || !ref) return null;
    const url = "http://" + parsedServer + "/wx/code";
    try {
        const { data } = await axios.post(url, { ref, app_id: 'wx7643d5f831302ab0' }, { timeout: 20000, proxy: false, headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
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

const APP = { name: "腾讯地图", appid: "wx7643d5f831302ab0", version: 545 };

const MINI_LOGIN_BASE = "https://miniapp.map.qq.com";
const MAP_BASE = "https://mmapgwh.map.qq.com";
const LOGIN_ACCESS_KEY = "1";
const LOGIN_SECRET_KEY = "4300eec60bedec22a73408a0d76b03ec";
const TMAP_SECRET = "3a9875e795c3ecff15f617085e72d4cc";
const CHECKIN_TOKEN = "e643d512f085d621bf6c9e80310d0498";
const ACTIVITY_ID = 1721983577;
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

function splitAccounts(value = "") {
    return String(value)
        .split(/\n|&/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function short(value, max = 320) {
    if (value === undefined || value === null) return "";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

function md5(value) {
    return crypto.createHash("md5").update(String(value)).digest("hex");
}

function sha256(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const n = (Math.random() * 16) | 0;
        return (char === "x" ? n : (n & 3) | 8).toString(16);
    });
}

function sortedQuery(data) {
    const normalized = {};
    Object.keys(data)
        .sort()
        .forEach((key) => {
            if (data[key] !== undefined && data[key] !== null) normalized[key] = data[key];
        });
    return Object.keys(normalized)
        .map((key) => `${key}=${normalized[key]}`)
        .join("&");
}

function formatCoin(value) {
    const num = Number(value || 0);
    return `${num}(${(num / 100).toFixed(2)})`;
}

function parseAccount(raw) {
    const text = String(raw || "").trim();
    if (!text) return {};
    if (text.startsWith("{")) {
        const data = JSON.parse(text);
        return { raw: text, openid: data.openid || data.openId || "", remark: data.remark || data.name || "" };
    }
    const [openid, remark] = text.split("#").map((item) => item.trim());
    return { raw: text, openid, remark };
}

async function request(options) {
    const res = await axios.request({
        timeout: 20000,
        validateStatus: () => true,
        ...options,
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json, text/plain, */*",
            Referer: `https://servicewechat.com/${APP.appid}/${APP.version}/page-frame.html`,
            ...(options.headers || {}),
        },
    });
    return { status: res.status, headers: res.headers || {}, data: res.data };
}

async function getWxCode(server) {
        return await getCode(server);
    }


function loginSign({ appId, sessionId = "-1", openId, userId, postBody }) {
    const reqId = md5(`${Math.random()} ${Date.now()}`);
    const reqTime = Date.now().toString().slice(0, 10);
    const signParams = {
        appId,
        reqId,
        reqTime,
        userId,
        openID: openId,
        sessionID: sessionId,
        accessKey: LOGIN_ACCESS_KEY,
        businessStr: JSON.stringify(postBody),
    };
    const signText = `${sortedQuery(signParams)}&secretKey=${LOGIN_SECRET_KEY}`;
    const headers = {
        "mapservice-sign-version": "v2",
        "mapservice-sign": sha256(signText),
        "mapservice-reqid": reqId,
        "mapservice-reqtime": reqTime,
        "mapservice-appid": appId,
        "mapservice-accesskey": LOGIN_ACCESS_KEY,
        "mapservice-sessionid": sessionId,
    };
    if (sessionId && sessionId !== "-1") {
        headers["mapservice-openid"] = openId;
        headers["mapservice-userid"] = userId;
    }
    return headers;
}

function mapH5Sign(apiPath, user) {
    const reqId = uuid();
    const reqTime = Date.now();
    const normalizedPath = apiPath.split("?")[0];
    const signBase = `mapinst=0&mapnonce=0&reqid=${reqId}&reqtime=${reqTime}`;
    const defaultSign = md5(`${signBase}${normalizedPath}0${TMAP_SECRET}`);
    const headers = {
        "tmap-reqid": reqId,
        "tmap-reqtime": reqTime,
        "tmap-userid": Number(user.user_id) || Number(user.userId) || 0,
        "tmap-login-ssid": user.session_id || user.sessionId || 0,
        "tmap-imei": 0,
        "tmap-qimei": 0,
        "tmap-qimei36": 0,
        "tmap-nonce": 0,
        "tmap-install-id": 0,
        "tmap-sign": 0,
        "tmap-default-sign": defaultSign,
        "tmap-app-version": 0,
        "tmap-channel": 0,
        "tmap-engine": "web",
        "tmap-mini-login-ssid": user.map_session_id || user.mapSessionId || "",
        "tmap-app-id": user.appId || APP.appid,
    };
    if (user.openid || user.openId) headers["tmap-openid"] = user.openid || user.openId;
    return headers;
}

function checkinHeader(user) {
    const requestId = uuid();
    const timestamp = Math.floor(Date.now() / 1000);
    const signText = `request_id=${requestId}&from_source=${APP.appid}&timestamp=${timestamp}&token=${CHECKIN_TOKEN}`;
    return {
        user_id: user.openid || user.openId,
        from_source: APP.appid,
        request_id: requestId,
        timestamp,
        sign: sha256(signText).toUpperCase(),
    };
}

class TencentMap {
    constructor(rawAccount, index) {
        this.server = rawAccount;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = index;
        this.account = parseAccount(rawAccount);
        this.loginInfo = {};
        this.userInfo = {};
    }

    async miniLogin() {
        const code = await getWxCode(this.server);
        const body = {
            seqid: uuid(),
            app_id: APP.appid,
            auth_code: code,
            devHeader: {},
        };
        const { status, data } = await request({
            method: "POST",
            url: `${MINI_LOGIN_BASE}/minLogin/v2/login`,
            headers: {
                "content-type": "application/json",
                ...loginSign({ appId: APP.appid, postBody: body }),
            },
            data: body,
        });
        if (status !== 200 || Number(data?.err_code) !== 0) throw new Error(`登录失败 HTTP ${status}: ${short(data)}`);
        this.loginInfo = { ...data, appId: APP.appid };
        console.log(`登录：成功 userId=${data.user_id || "未知"}，openid=${data.openid || "未知"}`);
    }

    async queryUser() {
        const user = this.loginInfo;
        const body = {
            seqid: uuid(),
            app_id: APP.appid,
            userId: user.user_id,
            openId: user.openid,
            source: "mini-tencentmap",
        };
        const { status, data } = await request({
            method: "POST",
            url: `${MINI_LOGIN_BASE}/minLogin/v2/getUserInfo`,
            headers: {
                "content-type": "application/json",
                ...loginSign({
                    appId: APP.appid,
                    sessionId: user.session_id,
                    userId: user.user_id,
                    openId: user.openid,
                    postBody: body,
                }),
            },
            data: body,
        });
        if (status !== 200 || Number(data?.err_code) !== 0) {
            console.log(`用户信息：查询失败 HTTP ${status}: ${short(data)}`);
            return;
        }
        this.userInfo = data || {};
        console.log(`用户信息：${data.nickname || "微信用户"}，userId=${data.userid || user.user_id}`);
    }

    async mapApi(apiPath, data) {
        const { status, data: body } = await request({
            method: "POST",
            url: `${MAP_BASE}${apiPath}`,
            headers: {
                "content-type": "application/json",
                ...checkinHeader(this.loginInfo),
                ...mapH5Sign(apiPath, this.loginInfo),
            },
            data,
        });
        if (status !== 200 || Number(body?.code) !== 0) throw new Error(`${apiPath} HTTP ${status}: ${short(body)}`);
        return body.data || {};
    }

    async queryBalance(prefix = "现金余额") {
        const data = await this.mapApi("/activity/v1/withdraw/home", {
            activity_id: ACTIVITY_ID,
            game_id: 4,
            rule_id: "tencent_map_withdraw",
        });
        console.log(
            `${prefix}：金币=${formatCoin(data.coins)}，可提现=${formatCoin(data.withdrawable_amount)}，门槛=${formatCoin(data.current_withdraw_threshold)}，奖池=${formatCoin(data.jackpot_amount)}`
        );
        return data;
    }

    async queryAssets() {
        const data = await this.mapApi("/activity/v1/assert/home", { activity_id: ACTIVITY_ID });
        console.log(
            `资产信息：金币=${formatCoin(data.coins)}，优惠券=${data.coupons_total || 0}，抽奖券=${data.lottery_ticket_total || 0}`
        );
        return data;
    }

    todayKey() {
        const now = new Date();
        const year = now.getFullYear();
        const month = `${now.getMonth() + 1}`.padStart(2, "0");
        const day = `${now.getDate()}`.padStart(2, "0");
        return `${year}${month}${day}`;
    }

    async queryCalendar(prefix = "签到状态") {
        const data = await this.mapApi("/activity/v1/checkin/calendar", {
            activity_id: ACTIVITY_ID,
            game_id: 1,
            rule_id: "tencent_map_checkin",
        });
        const today = data.calendar?.[this.todayKey()] || {};
        const prizes = Array.isArray(today.prizes)
            ? today.prizes.map((item) => `${item.name || item.type || "奖励"}:${item.amount ?? ""}`).join("，")
            : "";
        console.log(`${prefix}：今日${today.checkin ? "已签" : "未签"}，周期已签=${data.checkin_days || 0}/${data.period || 0}${prizes ? `，奖励=${prizes}` : ""}`);
        return { data, today };
    }

    async checkin() {
        const { today } = await this.queryCalendar("签到前");
        if (today.checkin) {
            console.log("签到：今日已签到");
            return;
        }
        const data = await this.mapApi("/activity/v1/checkin", {
            activity_id: ACTIVITY_ID,
            game_id: 1,
            rule_id: "tencent_map_checkin",
            nick: this.userInfo.nickname || "微信用户",
        });
        const prizes = Array.isArray(data.prizes)
            ? data.prizes.map((item) => `${item.name || item.type || "奖励"}:${item.amount ?? ""}`).join("，")
            : short(data);
        console.log(`签到：成功${prizes ? `，${prizes}` : ""}`);
    }

    async run() {
        console.log(`\n========== ${APP.name} 账号[${this.index}] ${this.account.remark || this.openid} ==========`);
        await this.miniLogin();
        await this.queryUser();
        await this.queryBalance("签到前现金余额");
        await this.queryAssets();
        await this.checkin();
        await this.queryBalance("签到后现金余额");
        await this.queryCalendar("签到后");
    }
}

(async () => {
    const accounts = SERVERS;
    if (!accounts.length) {
        console.log(`未配置 VX_GO`);
        
        return;
    }
    console.log(`共找到${accounts.length}个账号`);
    for (let i = 0; i < accounts.length; i++) {
        const runner = new TencentMap(accounts[i], i + 1);
        try {
            await runner.run();
        } catch (e) {
            console.log(`账号[${i + 1}] 执行失败：${e.message || e}`);
        }
        await await sleep(800);
    }
    
})().catch(async (e) => {
    console.log(`脚本异常：${e.stack || e.message || e}`);
    
});
