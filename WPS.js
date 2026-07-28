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
    .split(/\r?\n/)
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
    const lower = line.toLowerCase();
    if (lower.includes("pushplus") || line.includes("推送")) return "PushPlus";
    if (line.includes("执行失败") || line.includes("执行异常")) return "账号";
    if (
      line.includes("代理") ||
      lower.includes("proxy") ||
      (/\d{1,3}(?:\.\d{1,3}){3}:\d+/.test(line) &&
        ["提取", "生成", "获取"].some((word) => line.includes(word)))
    )
      return "代理";
    if (line.includes("登录") || lower.includes("token") || line.includes("授权")) return "登录";
    if (lower.includes("code") || line.includes("取码")) return "取码";
    if (line.includes("签到") || lower.includes("sign")) return "签到";
    if (line.includes("积分") || line.includes("余额") || line.includes("账户")) return "账户";
    if (line.includes("等待") || line.includes("延迟") || lower.includes("sleep")) return "延迟";
    if (line.includes("账号")) return "账号";
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
    if (normalized.includes("PushPlus")) emitFooter();
    emitRaw(normalized, level === "error" ? "error" : level === "warn" ? "warn" : "log");
  }

  function capture(level, args) {
    try {
      const text = util.format(...args);
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

// name: WPS
// cron: 47 9 * * *

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// ====================== YYB Go 账号（环境变量 YYB_GO = 地址@微信账号标识，多行） ======================
const SERVERS = (process.env.YYB_GO || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
if (!SERVERS.length) {
    console.error("未配置环境变量 YYB_GO，请设置后重试（格式：地址@微信账号标识，多行换行）");
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
async function getCode(server, appId = MINI_APP_ID) {
    const { server: parsedServer, ref } = parseYybGoEntry(server);
    if (!parsedServer || !ref) return null;
    const url = "http://" + parsedServer + "/wxapp/getCode";
    try {
        const { data } = await axios.post(url, { ref, app_id: appId }, { timeout: 20000, proxy: false });
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

const MINI_APP_ID = "wx2f333d84a103825d";
const ACCOUNT_PLUGIN_APPID = "wxe5f87d6a233b5aab";
const WPS_MPID = "app_op_act";
const CLIENT_TYPE = 1;
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "wps_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}

const ACCOUNT_BASE = "https://account.wps.cn";
const PERSONAL_BUS = "https://personal-bus.wps.cn";
const PERSONAL_ACT = "https://personal-act.wps.cn";
const CLOCK_INFO = `${PERSONAL_BUS}/activity/clock_in/v1/info`;
const CLOCK_IN = `${PERSONAL_BUS}/activity/clock_in/v1/clock_in`;
const TASK_OUTLINE = `${PERSONAL_BUS}/activity/clock_in/v1/task/outline`;
const TASK_START_BROWSE = `${PERSONAL_BUS}/activity/clock_in/v1/task/start_browse`;
const TASK_FINISH_BROWSE = `${PERSONAL_BUS}/activity/clock_in/v1/task/finish_browse`;
const LOTTERY_TIMES = `${PERSONAL_BUS}/activity/clock_in/v1/task/lottery_times`;
const ACTIVITY_CONFIG = "https://personal-act.wpscdn.cn/srcapi/act/rubik-service/honeycomb-adapter/client/module-info?pid=113&mg_id=47736&id=48312";
const LOTTERY_PAGE = "https://personal-act.wps.cn/rubik2/portal/HD2024082815116866/YM2024082815122017";
const COMPONENT_ACTION = `${PERSONAL_ACT}/activity-rubik/activity/component_action`;
const LOTTERY_ACTIVITY = "HD2024082815116866";
const LOTTERY_PAGE_NO = "YM2024082815122017";
const LOTTERY_COMPONENT_NO = "ZJ2025092916516585";
const LOTTERY_COMPONENT_NODE_ID = "FN1766995952bvx3";

function readCache() {
  try {
    if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    console.log(`token缓存写入失败: ${e.message || e}`);
  }
}

function md5(text) {
  return crypto.createHash("md5").update(String(text)).digest("hex");
}

function hmacSha256Hex(text, key) {
  return crypto.createHmac("sha256", key).update(String(text)).digest("hex");
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function mask(value = "") {
  value = String(value);
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 3)}***`;
  return `${value.slice(0, 6)}***${value.slice(-6)}`;
}

function parseCookie(cookie = "") {
  if (!cookie || typeof cookie !== "string") return {};
  return Object.fromEntries(
    cookie
      .split(/;\s*/)
      .filter((v) => v.includes("="))
      .map((v) => [v.slice(0, v.indexOf("=")).trim(), v.slice(v.indexOf("=") + 1).trim()])
  );
}

function cookieHeader(cookies = {}) {
  return Object.entries(cookies)
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join(";");
}

function mergeSetCookie(setCookie = [], current = {}) {
  const cookies = { ...current };
  for (const line of Array.isArray(setCookie) ? setCookie : [setCookie]) {
    const first = String(line || "").split(";")[0];
    if (!first.includes("=")) continue;
    const key = first.slice(0, first.indexOf("=")).trim();
    const value = first.slice(first.indexOf("=") + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}

function parseAccount(raw) {
  const text = String(raw || "").trim();
  if (!text) return { openid: "", cookie: "", secret: "" };

  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      return {
        openid: data.openid || data.openId || data.account || "",
        cookie: data.cookie || data.Cookie || "",
        secret: data.secret || data.jsrsasign_secret || "",
      };
    } catch {}
  }

  for (const sep of ["#", "|"]) {
    if (text.includes(sep)) {
      const [openid, cookie, secret] = text.split(sep);
      return { openid: openid.trim(), cookie: (cookie || "").trim(), secret: (secret || "").trim() };
    }
  }

  if (text.includes("wps_sid=") || text.includes("kso_sid=")) return { openid: "", cookie: text, secret: "" };
  return { openid: text, cookie: "", secret: "" };
}

function canonicalJson(data = {}) {
  const sorted = {};
  Object.keys(data || {})
    .sort()
    .forEach((key) => {
      sorted[key] = data[key];
    });
  return JSON.stringify(sorted);
}

function makeSignature(data, config = {}) {
  const key = config.key || "";
  const ss = config.ss || "";
  if (!key || !ss) return {};
  const date = new Date().toUTCString();
  const payload = `${key}${md5(canonicalJson(data))}${date}`;
  return {
    Date: date,
    Signature: hmacSha256Hex(payload, ss),
  };
}

function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

function makePopToken(method, url, secret, cv = "") {
  if (!secret) return "";
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = {
    htm: String(method || "GET").toUpperCase(),
    htu: new URL(url).pathname,
    iat: Math.floor(Date.now() / 1000),
  };
  if (cv) body.cv = cv;
  const payload = base64url(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", Buffer.from(secret)).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function genEcKeyPair() {
  return crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
}

function signEc(privateKey, text) {
  return crypto
    .sign("sha256", Buffer.from(String(text)), {
      key: privateKey.export({ type: "pkcs8", format: "pem" }),
      dsaEncoding: "der",
    })
    .toString("base64url");
}

function deriveSecret(privateKey, serverJwkB64) {
  const jwk = JSON.parse(Buffer.from(serverJwkB64, "base64url").toString("utf8"));
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  return crypto.diffieHellman({ privateKey, publicKey }).toString("base64url");
}

async function accountRequest(method, urlPath, { data = null, cookies = {}, secret = "" } = {}) {
  const url = `${ACCOUNT_BASE}${urlPath}`;
  const headers = {
    platform: "wx_mini",
    app_name: "account_wx_mini_plugin",
    Cookie: `csrf=1234567890${cookieHeader(cookies) ? `;${cookieHeader(cookies)}` : ""}`,
    "X-CSRFToken": "1234567890",
    "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
    Referer: `https://servicewechat.com/${MINI_APP_ID}/249/page-frame.html`,
  };
  const pop = makePopToken(method, urlPath, secret, cookies.cv || "");
  if (pop) headers["X-Pop-Token"] = pop;
  const res = await axios({
    method,
    url,
    data,
    headers,
    timeout: 20000,
    validateStatus: () => true,
  });
  return { data: res.data, cookies: mergeSetCookie(res.headers["set-cookie"], cookies), status: res.status };
}

async function wpsRequest(method, url, { data = null, params = null, cookies = {}, secret = "", signed = false, clockConfig = {}, headers: extraHeaders = {} } = {}) {
  const csrf = "1234567890";
  const headers = {
    "X-CSRFToken": csrf,
    Cookie: `${cookieHeader(cookies)};csrf=${csrf}`,
    "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
    Referer: `https://servicewechat.com/${MINI_APP_ID}/249/page-frame.html`,
    ...extraHeaders,
  };
  const pop = makePopToken(method, url, secret, cookies.cv || "");
  if (pop) headers["X-Pop-Token"] = pop;
  if (signed) Object.assign(headers, makeSignature(data || {}, clockConfig));

  const res = await axios({
    method,
    url,
    data,
    params,
    headers,
    timeout: 20000,
    validateStatus: () => true,
  });
  return { data: res.data, cookies: mergeSetCookie(res.headers["set-cookie"], cookies), status: res.status };
}

function assertOk(res, action) {
  if (!res || res.result !== "ok") {
    throw new Error(`${action}失败: ${res?.msg || res?.result || JSON.stringify(res)}`);
  }
  return res.data ?? res;
}

class Task {
  constructor(raw) {
        this.server = raw;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
    this.index = userIdx++;
    const account = parseAccount(raw);
    this.openid = account.openid;
    this.cookies = parseCookie(account.cookie);
    this.secret = account.secret || "";
    this.uid = this.cookies.uid || "";
    this.clockConfig = {};
    this.cacheKey = this.openid || this.cookies.uid || (account.cookie ? md5(account.cookie).slice(0, 16) : `account_${this.index}`);
  }

  getCached() {
    return readCache()[this.cacheKey] || {};
  }

  saveCache(extra = {}) {
    const cache = readCache();
    cache[this.cacheKey] = {
      ...(cache[this.cacheKey] || {}),
      openid: this.openid || this.getCached().openid || "",
      uid: this.uid || this.cookies.uid || "",
      cookie: cookieHeader(this.cookies),
      secret: this.secret,
      ...extra,
      updatedAt: new Date().toISOString(),
    };
    writeCache(cache);
  }

  removeLogin() {
    const cache = readCache();
    if (cache[this.cacheKey]) {
      delete cache[this.cacheKey].cookie;
      delete cache[this.cacheKey].secret;
      writeCache(cache);
    }
    this.cookies = {};
    this.secret = "";
  }

  loadCache() {
    const cache = this.getCached();
    if (!this.openid && cache.openid) this.openid = cache.openid;
    if (!this.secret && cache.secret) this.secret = cache.secret;
    if (!Object.keys(this.cookies).length && cache.cookie) this.cookies = parseCookie(cache.cookie);
    this.uid = this.cookies.uid || cache.uid || this.uid || "";
  }

  async login() {
    if (!this.openid) throw new Error("缺少 openid，无法自动登录。可设置 wps=openid 或 wps=openid#Cookie");
    const authCode = await getCode(this.server, ACCOUNT_PLUGIN_APPID);
    const keyPair = genEcKeyPair();
    const body = {
      type: "wxapp",
      appid: ACCOUNT_PLUGIN_APPID,
      auth_code: authCode,
      public_key: base64url(JSON.stringify(keyPair.publicKey.export({ format: "jwk" }))),
      auth_code_sign: signEc(keyPair.privateKey, authCode),
      slv: "none",
    };
    const res = await accountRequest("POST", "/passport/secure/api/easy_login", { data: body });
    const data = assertOk(res.data, "WPS自动登录");
    if (data.further_action) throw new Error(`WPS登录需要额外操作: ${data.further_action}`);
    if (!data.jwk) throw new Error(`WPS登录未返回 jwk: ${JSON.stringify(res.data)}`);
    this.cookies = res.cookies;
    this.secret = deriveSecret(keyPair.privateKey, data.jwk);
    this.uid = data.user_id || this.cookies.uid || "";
    this.saveCache();
    console.log(`账号[${this.index}] WPS登录成功: ${mask(this.uid || this.cookies.wps_sid)}`);
  }

  async ensureLogin() {
    this.loadCache();
    if (this.cookies.kso_sid && this.cookies.wps_sid && this.secret) return;
    await this.login();
  }

  async request(method, url, options = {}) {
    await this.ensureLogin();
    const res = await wpsRequest(method, url, {
      ...options,
      cookies: this.cookies,
      secret: this.secret,
      clockConfig: this.clockConfig,
    });
    this.cookies = res.cookies;
    this.saveCache();
    if (res.data?.msg === "empty wps_sid" || res.data?.result === "userNotLogin") {
      if (!this.openid) throw new Error("WPS登录态失效，且缺少 openid 无法刷新");
      console.log(`账号[${this.index}] WPS登录态失效，重新登录`);
      this.removeLogin();
      await this.login();
      const retry = await wpsRequest(method, url, {
        ...options,
        cookies: this.cookies,
        secret: this.secret,
        clockConfig: this.clockConfig,
      });
      this.cookies = retry.cookies;
      this.saveCache();
      return retry.data;
    }
    return res.data;
  }

  async loadClockConfig() {
    const res = await axios.get(ACTIVITY_CONFIG, {
      timeout: 15000,
      validateStatus: () => true,
      headers: {
        "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
        Referer: `https://servicewechat.com/${MINI_APP_ID}/249/page-frame.html`,
      },
    });
    if (res.data?.result === "ok" && res.data?.data?.value) {
      this.clockConfig = res.data.data.value;
      if (!this.clockConfig.key && this.clockConfig.s_key) this.clockConfig.key = this.clockConfig.s_key;
    }
  }

  async userInfo() {
    const data = assertOk(await this.request("POST", "https://account.wps.cn/p/auth/check"), "查询用户信息");
    this.uid = data.userid || data.id || this.uid || this.cookies.uid || "";
    this.saveCache({ nickname: data.nickname || data.username || "" });
    console.log(`账号[${this.index}] 用户: ${mask(data.nickname || data.username || this.uid)}`);
  }

  async sign() {
    const body = { client_type: CLIENT_TYPE };
    const res = await this.request("POST", CLOCK_IN, { data: body, signed: true });
    if (res.result === "ok") {
      const data = res.data || {};
      console.log(`账号[${this.index}] 签到成功: 连续${data.continuous_days ?? data.continuousDays ?? "未知"}天`);
      return;
    }
    if (res.msg === "already clocked in today") {
      console.log(`账号[${this.index}] 今日已签到`);
      return;
    }
    throw new Error(`签到失败: ${res.msg || JSON.stringify(res)}`);
  }

  async clockInfo() {
    try {
      const res = await this.request("GET", CLOCK_INFO, {
        params: {
          client_type: CLIENT_TYPE,
          page_index: 0,
          page_size: 10,
        },
      });
      if (res.result === "ok") {
        const d = res.data || {};
        if (d.s_key) this.clockConfig.key = d.s_key;
        console.log(`账号[${this.index}] 签到信息: 连续${d.continuous_days ?? 0}天，累计${d.clock_in_total_num ?? "未知"}人打卡`);
      }
    } catch (e) {
      console.log(`账号[${this.index}] 查询签到信息失败: ${e.message || e}`);
    }
  }

  async getMainCode() {
    if (!this.openid) return "";
    return getCode(this.server, MINI_APP_ID);
  }

  async taskOutline() {
    const authCode = await this.getMainCode();
    if (!authCode) throw new Error("缺少 openid，无法获取任务 auth_code");
    const res = await this.request("GET", TASK_OUTLINE, {
      params: {
        mp_id: WPS_MPID,
        auth_code: authCode,
      },
    });
    return assertOk(res, "查询任务列表") || {};
  }

  async lotteryTimes() {
    const res = await this.request("GET", LOTTERY_TIMES, {
      params: {
        position: "wx_xcx_clock_activity",
      },
    });
    if (res.result === "ok") {
      console.log(`账号[${this.index}] 可抽奖次数: ${res.data ?? 0}`);
      return Number(res.data || 0);
    }
    console.log(`账号[${this.index}] 查询抽奖次数失败: ${res.msg || JSON.stringify(res)}`);
    return 0;
  }

  flattenTasks(outline = {}) {
    const tasks = [];
    const collect = (type, item) => {
      if (!item) return;
      if (Array.isArray(item)) {
        item.forEach((v) => collect(type, v));
      } else if (typeof item === "object") {
        tasks.push({ ...item, type });
      }
    };
    for (const [type, value] of Object.entries(outline)) collect(type, value);
    return tasks;
  }

  async doBrowseTask(task) {
    const authCode = await this.getMainCode();
    const clientType = task.client_type || "wechat";
    const startBody = {
      mp_id: WPS_MPID,
      auth_code: authCode,
      browse_app_id: task.app_id || MINI_APP_ID,
      client_type: clientType,
      version: "new",
    };
    if (clientType !== "wechat" && task.path) startBody.path = task.path;
    const start = await this.request("POST", TASK_START_BROWSE, { data: startBody });
    if (start.result !== "ok" && start.msg !== "任务已完成") {
      console.log(`账号[${this.index}] 浏览任务启动失败[${task.title || task.task_id || task.app_id}]: ${start.msg || JSON.stringify(start)}`);
      return false;
    }

    await await sleep(16000, 17000);

    const finish = await this.request("POST", TASK_FINISH_BROWSE, {
      data: {
        mp_id: WPS_MPID,
        auth_code: await this.getMainCode(),
        app_id: clientType === "wechat_web" ? MINI_APP_ID : task.app_id || MINI_APP_ID,
        client_type: clientType,
        path: clientType === "wechat_web" ? task.path || "" : "",
        version: "new",
        user_id: Number(this.uid || this.cookies.uid || 0),
      },
    });
    if (finish.result === "ok" || finish.msg === "任务已完成") {
      console.log(`账号[${this.index}] 浏览任务完成: ${task.title || task.task_id || task.app_id || task.path || ""}`);
      return true;
    }
    console.log(`账号[${this.index}] 浏览任务完成失败[${task.title || task.task_id || task.app_id}]: ${finish.msg || JSON.stringify(finish)}`);
    return false;
  }

  async browseTasks() {
    let outline;
    try {
      outline = await this.taskOutline();
    } catch (e) {
      console.log(`账号[${this.index}] 查询任务列表失败: ${e.message || e}`);
      return;
    }
    const tasks = this.flattenTasks(outline).filter((t) => t.type === "browse" && Number(t.status || 0) !== 1);
    if (!tasks.length) {
      console.log(`账号[${this.index}] 暂无待完成浏览任务`);
      return;
    }
    console.log(`账号[${this.index}] 待浏览任务: ${tasks.length}个`);
    for (const task of tasks) {
      try {
        await this.doBrowseTask(task);
      } catch (e) {
        console.log(`账号[${this.index}] 浏览任务异常: ${e.message || e}`);
      }
    }
  }

  async tryLotteryOnce(index) {
    const actCsrf = randomHex(16);
    const body = {
      component_uniq_number: {
        activity_number: LOTTERY_ACTIVITY,
        page_number: LOTTERY_PAGE_NO,
        component_number: LOTTERY_COMPONENT_NO,
        component_node_id: LOTTERY_COMPONENT_NODE_ID,
        filter_params: {},
      },
      component_type: 45,
      component_action: "lottery_v2.exec",
      lottery_v2: {
        session_id: 1,
      },
    };
    const cookies = { ...this.cookies, act_csrf_token: actCsrf };
    const res = await wpsRequest("POST", COMPONENT_ACTION, {
      data: body,
      cookies,
      secret: this.secret,
      headers: {
        "Content-Type": "application/json",
        "X-Act-Csrf-Token": actCsrf,
        Referer: LOTTERY_PAGE,
      },
    }).catch((e) => ({ data: { result: "error", msg: e.message || String(e) }, cookies: this.cookies }));
    this.cookies = mergeSetCookie([], { ...this.cookies, ...res.cookies });
    this.saveCache();

    const result = res.data;
    if (result?.result === "ok" && result.data?.lottery_v2?.success) {
      const reward = result.data.lottery_v2;
      console.log(`账号[${this.index}] 抽奖[${index}]成功: ${reward.reward_name || reward.reward_type || JSON.stringify(reward).slice(0, 120)}`);
      return true;
    }
    const detail = result?.data?.lottery_v2?.error_code ? `错误码${result.data.lottery_v2.error_code}` : result?.msg || JSON.stringify(result);
    console.log(`账号[${this.index}] 抽奖[${index}]失败: ${detail}`);
    return false;
  }

  async lottery() {
    const count = await this.lotteryTimes();
    const limit = Math.min(count, Number(process.env.wps_lottery_limit || 5));
    for (let i = 1; i <= limit; i++) {
      const ok = await this.tryLotteryOnce(i);
      if (!ok) break;
      await await sleep(1000, 1800);
    }
  }

  async run() {
    console.log(`\n账号[${this.index}] ${mask(this.openid || this.cacheKey)}`);
    await this.ensureLogin();
    await this.loadClockConfig();
    await this.userInfo();
    await this.clockInfo();
    await this.sign();
    await this.browseTasks();
    await this.lottery();
  }
}

!(async () => {
  
  if (!SERVERS.length) return;
  for (const account of SERVERS) {
    try {
      await new Task(account).run();
    } catch (e) {
      console.log(`账号执行失败: ${e.message || e}`);
    }
  }
})()
  .catch((e) => console.log(`脚本异常: ${e.message || e}`))
