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

// name: 顾家
// cron: 50 9 * * *

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
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
        const { data } = await axios.post(url, { ref, app_id: MINI_APP_ID }, { timeout: 20000, proxy: false, headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
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

const MINI_APP_ID = "wx0770280d160f09fe";
const PAGE_VERSION = "286";
const API_BASE = "https://mc.kukahome.com/club-server";
const INTEGRAL_BASE = "https://mc.kukahome.com/integral-server";
const BRAND_CODE = "K001";
const SMALL_APPLICATION_ID = "667516";
const SMALL_CRYPTO = "FH3yRrHG2RfexND8";
const VERSION_NUMBER = "2.8.6";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "gujiajiaju_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

function md5(input) {
  return crypto.createHash("md5").update(String(input)).digest("hex");
}

function readTokenCache() {
  try {
    if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeTokenCache(cache) {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    console.log(`写入token缓存失败: ${e.message || e}`);
  }
}

function isObject(val) {
  return Object.prototype.toString.call(val) === "[object Object]";
}

function buildParameterBase(data) {
  if (!data) return null;
  if (Array.isArray(data) || typeof data === "string") return null;
  if (!isObject(data)) return null;
  const keys = Object.keys(data).sort((a, b) => {
    const ac = [...a].map((ch) => ch.charCodeAt(0));
    const bc = [...b].map((ch) => ch.charCodeAt(0));
    for (let i = 0; i < Math.min(ac.length, bc.length); i++) {
      if (ac[i] !== bc[i]) return ac[i] - bc[i];
    }
    return ac.length - bc.length;
  });
  const pairs = [];
  for (const key of keys) {
    const value = data[key];
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) continue;
    if (typeof value === "object" && value !== null) {
      pairs.push(`${key}=${JSON.stringify(value)}`);
      continue;
    }
    if (typeof value === "number" && value === 0) {
      pairs.push(`${key}=0`);
      continue;
    }
    pairs.push(`${key}=${value}`);
  }
  return pairs.length ? pairs.join("&") : null;
}

function buildParameterSign(data, timestamp) {
  const base = buildParameterBase(data);
  if (!base) return "";
  const salt = String(timestamp).substring(4, 10);
  return md5(md5(base) + salt);
}

class Task {
  constructor(openid) {
        this.server = openid;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
    this.index = userIdx++;
    this.openid = String(openid || "").trim();
    this.tmpToken = "";
    this.accessToken = "";
    this.memberId = "";
    this.userInfo = {};
  }

  cacheKey() {
    return this.openid;
  }

  getCachedToken() {
    const cache = readTokenCache();
    return cache[this.cacheKey()] || null;
  }

  saveCachedToken() {
    if (!this.accessToken || !this.memberId) return;
    const cache = readTokenCache();
    cache[this.cacheKey()] = {
      accessToken: this.accessToken,
      memberId: this.memberId,
      nickName: this.userInfo.nickName || "",
      mobile: this.userInfo.mobile || "",
      updatedAt: new Date().toISOString(),
    };
    writeTokenCache(cache);
  }

  clearCachedToken() {
    const cache = readTokenCache();
    delete cache[this.cacheKey()];
    writeTokenCache(cache);
    this.tmpToken = "";
    this.accessToken = "";
    this.memberId = "";
    this.userInfo = {};
  }

  applyToken(data = {}) {
    this.accessToken = data.accessToken || data.token || this.accessToken;
    this.memberId = String(data.memberId || this.memberId || "");
  }

  async request({ method = "POST", url, data = {}, params = {}, withAuth = true, withTmpToken = true }) {
    const timestamp = Date.now();
    const sign = md5(`${SMALL_APPLICATION_ID}${SMALL_CRYPTO}${timestamp}`).toLowerCase();
    const bodyForSign = method.toUpperCase() === "GET" ? params : data;
    const parameterSign = buildParameterSign(bodyForSign, timestamp);
    const headers = {
      "User-Agent": USER_AGENT,
      Referer: `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Customer": this.memberId || "",
      brandCode: BRAND_CODE,
      appid: SMALL_APPLICATION_ID,
      sign,
      timestamp,
      versionNumber: VERSION_NUMBER,
    };
    if (parameterSign) headers.parameterSign = parameterSign;
    if (withAuth && this.accessToken) headers.AccessToken = this.accessToken;
    if (withTmpToken && this.tmpToken) headers.tmpToken = this.tmpToken;

    const res = await axios.request({
      method,
      url,
      data,
      params,
      headers,
      timeout: 20000,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
    const result = res.data || {};
    if (result.code !== undefined && ![0, 401, 402, 515].includes(Number(result.code))) {
      throw new Error(result.message || result.msg || JSON.stringify(result));
    }
    return result;
  }

  async getWxCode() {
        return await getCode(this.server);
    }

  async login() {
    const code = await this.getWxCode();
    const identify = await this.request({
      method: "POST",
      url: `${API_BASE}/api/user/identify`,
      params: { code },
      withAuth: false,
      withTmpToken: false,
    });
    if (identify.code !== 0 || !identify.data) {
      throw new Error(`identify失败: ${identify.message || JSON.stringify(identify)}`);
    }
    if (Number(identify.data.status) !== 4) {
      throw new Error(`登录状态异常: status=${identify.data.status}`);
    }
    this.tmpToken = identify.data.token || "";
    if (!this.tmpToken) throw new Error("identify未返回tmpToken");

    const auth = await this.request({
      method: "POST",
      url: `${API_BASE}/api/user/authorizeLogin`,
      data: { source: "顾家小程序", contentName: "" },
      withAuth: false,
      withTmpToken: true,
    });
    if (auth.code !== 0 || !auth.data?.token) {
      throw new Error(`authorizeLogin失败: ${auth.message || JSON.stringify(auth)}`);
    }
    this.accessToken = auth.data.token;
    this.memberId = String(auth.data.memberId || "");
    this.tmpToken = "";
  }

  async getUserInfo() {
    const info = await this.request({
      method: "POST",
      url: `${API_BASE}/api/user/info`,
      data: {},
      withAuth: true,
      withTmpToken: false,
    });
    if (!info.data) throw new Error("user/info返回为空");
    this.userInfo = info.data;
    this.applyToken(info.data);
    const name = this.userInfo.nickName || this.userInfo.name || this.memberId || "未知";
    console.log(`账号[${this.index}] 用户: ${name}`);
  }

  async ensureLogin() {
    const cached = this.getCachedToken();
    if (cached) {
      this.applyToken(cached);
      console.log(`账号[${this.index}] 使用缓存token`);
      try {
        await this.getUserInfo();
        return;
      } catch {
        this.clearCachedToken();
        console.log(`账号[${this.index}] 缓存失效，重新登录`);
      }
    }
    await this.login();
    await this.getUserInfo();
    this.saveCachedToken();
    console.log(`账号[${this.index}] 登录成功 memberId=${this.memberId}`);
  }

  async checkCalendar() {
    try {
      const ret = await this.request({
        method: "GET",
        url: `${INTEGRAL_BASE}/user/sign/calendar`,
        params: {},
      });
      console.log(`账号[${this.index}] 日历查询: code=${ret.code}`);
    } catch (e) {
      console.log(`账号[${this.index}] 日历查询失败: ${e.message || e}`);
    }
  }

  async sign() {
    try {
      const ret = await this.request({
        method: "POST",
        url: `${INTEGRAL_BASE}/scenePoint/scene/point`,
        data: {
          scene: "sign",
          brandCode: BRAND_CODE,
        },
      });
      if (ret.code === 0) {
        console.log(`账号[${this.index}] 签到成功`);
        return;
      }
      const msg = ret.message || ret.msg || JSON.stringify(ret);
      if (/已签|重复|already|今日/.test(msg)) {
        console.log(`账号[${this.index}] 今日已签到`);
        return;
      }
      throw new Error(msg);
    } catch (e) {
      const msg = e.message || String(e);
      if (/已签|重复|already|今日/.test(msg)) {
        console.log(`账号[${this.index}] 今日已签到`);
        return;
      }
      throw e;
    }
  }

  async run() {
    try {
      await this.ensureLogin();
      await this.checkCalendar();
      await this.sign();
      this.saveCachedToken();
    } catch (e) {
      const msg = e.message || String(e);
      console.log(`账号[${this.index}] 执行失败: ${msg}`);
      if (/401|token|登录|失效|过期/i.test(msg)) this.clearCachedToken();
    }
  }
}

!(async () => {
  
  for (const openid of SERVERS) {
    await new Task(openid).run();
  }
})()
  .catch((e) => console.log(e.message || e))
