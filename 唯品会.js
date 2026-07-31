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

// name: 唯品会
// cron: 18 8 * * *

const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// ====================== YYB Go 账号（环境变量 YYB_GO = 地址@微信账号标识，多行） ======================
const SERVERS = (process.env.YYB_GO || "")
    .split(/\r?\n|&/)
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

const MINI_APP_ID = "wxe9714e742209d35f";
const PACKAGE_VERSION = "1371";
const API_KEY = "ce29a51aa5c94a318755b2529dcb8e0b";
const HASH = "ptx26";
const ACT_ID = "H3gRnE1Xi18=";
const SIGN_SECRET_ENC = "Ql4mW09F3urBNdzBLfK6UuRTqj22Bta7eEKTO7n5jFf9uU6FZZmcfe/gurOAOB+o";

const CACHE_FILE = path.join(__dirname, "token_caches", "vipshop_token_cache.json");
try { fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); } catch (e) {}
const DEFAULT_MARS_CID = process.env.vipshop_mars_cid || "104104";
const DEFAULT_WAREHOUSE = "VIP_NH";
const DEFAULT_AREA = "104104";

function splitAccounts(value = "") {
  return String(value)
    .split(/\n|&/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    console.log(`缓存写入失败: ${e.message || e}`);
  }
}

function short(value, max = 600) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function mask(value = "") {
  value = String(value || "");
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 3)}***`;
  return `${value.slice(0, 6)}***${value.slice(-6)}`;
}

function sha1(text) {
  return crypto.createHash("sha1").update(String(text)).digest("hex");
}

function md5(text) {
  return crypto.createHash("md5").update(String(text)).digest("hex");
}

function aesDecryptBase64(text) {
  const key = Buffer.from("weixin_smallmina");
  const iv = Buffer.concat([Buffer.from("weixin"), Buffer.alloc(10)]);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  let out = decipher.update(text, "base64", "utf8");
  out += decipher.final("utf8");
  return out;
}

function form(data = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    params.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return params.toString();
}

function parseAccount(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return {};
  if (text.startsWith("{")) {
    const data = JSON.parse(text);
    return {
      openid: data.openid || data.openId || data.rawOpenid || "",
      token: data.token || data.VIP_TANK || data.vipTank || "",
      userId: data.userId || data.uid || "",
      vipOpenid: data.vipOpenid || data.vip_openid || data.encryptedOpenid || "",
      unionid: data.unionid || data.unionId || "",
      marsCid: data.marsCid || data.mars_cid || "",
      remark: data.remark || data.name || "",
    };
  }

  const [openid, token, userId, vipOpenid, remark] = text.split("#").map((item) => item.trim());
  if (!token && /^[A-F0-9]{32,}$/i.test(openid)) return { token: openid };
  return { openid, token, userId, vipOpenid, remark };
}

function isSuccess(data) {
  return Number(data?.code) === 1 || Number(data?.code) === 0;
}

async function request(options) {
  const res = await axios.request({
    timeout: 30000,
    validateStatus: () => true,
    ...options,
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MicroMessenger MiniProgramEnv/Windows",
      Referer: `https://servicewechat.com/${MINI_APP_ID}/${PACKAGE_VERSION}/page-frame.html`,
      ...(options.headers || {}),
    },
  });
  return { status: res.status, data: res.data, headers: res.headers || {} };
}

async function getWxCode(server) {
        return await getCode(server);
    }


class Vipshop {
  constructor(rawAccount, index) {
        this.server = rawAccount;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
    this.index = index;
    this.account = parseAccount(rawAccount);
    this.openid = this.openid || "";
    this.token = this.account.token || "";
    this.userId = this.account.userId || "";
    this.vipOpenid = this.account.vipOpenid || "";
    this.unionid = this.account.unionid || "";
    this.marsCid = this.account.marsCid || DEFAULT_MARS_CID;
    this.cacheKey = this.openid || (this.vipOpenid ? md5(this.vipOpenid).slice(0, 16) : `account_${index}`);
  }

  log(message) {
    console.log(`账号[${this.index}]${this.account.remark ? `[${this.account.remark}]` : ""} ${message}`);
  }

  baseData() {
    return {
      app_name: "shop_weixin_mina",
      client: "wechat_mini_program",
      source_app: "shop_weixin_mina",
      api_key: API_KEY,
      app_version: "4.0",
      client_type: "wap",
      format: "json",
      mobile_platform: "2",
      ver: "2.0",
      standby_id: "native",
      union_mark: "",
      sd_tuijian: "",
      mobile_channel: "nature",
      mars_cid: this.marsCid,
      warehouse: DEFAULT_WAREHOUSE,
      fdc_area_id: DEFAULT_AREA,
      province_id: DEFAULT_AREA,
      wap_consumer: "A1",
      t: Math.floor(Date.now() / 1000),
      net: "WIFI",
      width: 375,
      height: 667,
      phone_model: "Windows",
      phone_brand: "",
      sys_version: "Windows 10",
      is_default_area: "1",
      app_theme_mode: "0",
      app_theme_action: "0",
      req_scene: 0,
    };
  }

  cookie() {
    const items = [
      `mars_cid=${this.marsCid}`,
      this.userId ? `userId=${this.userId}` : "",
      `warehouse=${DEFAULT_WAREHOUSE}`,
      this.token ? `VIP_TANK=${this.token}` : "",
      "wap_consumer=A1",
    ].filter(Boolean);
    return items.join(";");
  }

  paramHash(data = {}, method = "POST") {
    const sorted = Object.keys(data)
      .sort()
      .reduce((obj, key) => {
        obj[key] = data[key];
        return obj;
      }, {});
    const text = Object.keys(sorted)
      .filter((key) => key !== "api_key")
      .map((key) => {
        let value = sorted[key];
        if (typeof value === "object" && String(method).toLowerCase() === "post") value = JSON.stringify(value);
        return `${key}=${value}`;
      })
      .join("&");
    return sha1(text);
  }

  signHeader(url, data = {}, method = "POST") {
    const pathOnly = url.replace(/^http(s)?:\/\/.*?\//, "/");
    const secret = aesDecryptBase64(SIGN_SECRET_ENC);
    const apiSign = sha1(`${pathOnly}${this.paramHash(data, method)}${this.token}${this.marsCid}${secret}`);
    return `OAuth api_sign=${apiSign}`;
  }

  signedHeaders(url, data) {
    const cookie = this.cookie();
    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
      "X-Traceid": `${cookie};__need_sign=1`,
      Authorization: this.signHeader(url, data, "POST"),
    };
  }

  getCached() {
    return readCache()[this.cacheKey] || {};
  }

  saveCache(extra = {}) {
    const cache = readCache();
    cache[this.cacheKey] = {
      ...(cache[this.cacheKey] || {}),
      ...(this.openid ? { openid: this.openid } : {}),
      ...(this.vipOpenid ? { vipOpenid: this.vipOpenid } : {}),
      ...(this.unionid ? { unionid: this.unionid } : {}),
      ...(this.token ? { token: this.token } : {}),
      ...(this.userId ? { userId: this.userId } : {}),
      marsCid: this.marsCid,
      ...extra,
      updatedAt: new Date().toISOString(),
    };
    writeCache(cache);
  }

  removeLoginCache() {
    const cache = readCache();
    if (cache[this.cacheKey]) {
      delete cache[this.cacheKey].token;
      delete cache[this.cacheKey].userId;
      writeCache(cache);
    }
  }

  loadCache() {
    const cached = this.getCached();
    this.token = this.token || cached.token || "";
    this.userId = this.userId || cached.userId || "";
    this.vipOpenid = this.vipOpenid || cached.vipOpenid || "";
    this.unionid = this.unionid || cached.unionid || "";
    this.marsCid = this.account.marsCid || cached.marsCid || this.marsCid;
  }

  async getVipWechatInfo(code) {
    const data = { ...this.baseData(), code, iv: "", encryptedData: "", hash: HASH };
    const { status, data: res } = await request({
      method: "POST",
      url: `https://weixin-api.vip.com/v4/LiteApp/getUserInfo?api_key=${API_KEY}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: this.cookie() },
      data: form(data),
    });
    if (status !== 200 || Number(res?.code) !== 0 || !res?.data?.openid) {
      throw new Error(`获取唯品会openid失败 HTTP ${status}: ${short(res)}`);
    }
    this.vipOpenid = res.data.openid;
    this.unionid = res.data.unionid || this.unionid;
    this.log(`唯品会openid获取成功: ${mask(this.vipOpenid)}`);
  }

  async autoLogin(code) {
    const data = {
      ...this.baseData(),
      hash: HASH,
      code,
      event: 2,
      deviceId: this.marsCid,
      context: JSON.stringify({ iv: "", encryptedData: "" }),
      source_app_type: "shop_weixin_mina",
      login_type: "WEIXIN_SMALL_APP",
      third_type: "WEIXIN",
    };
    const { status, data: res } = await request({
      method: "POST",
      url: `https://mapi.vip.com/vips-mobile/rest/auth/third_party/trylogin/v1?api_key=${API_KEY}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: this.cookie() },
      data: form(data),
    });
    if (status !== 200 || Number(res?.code) !== 1 || !res?.data?.tokenId) {
      throw new Error(`自动登录失败 HTTP ${status}: ${short(res)}`);
    }
    this.token = res.data.tokenId;
    this.userId = String(res.data.userId || "");
    this.log(`登录成功 userId=${this.userId || "-"} VIP_TANK=${mask(this.token)}`);
  }

  async ensureLogin() {
    this.loadCache();
    if (this.token && this.userId && this.vipOpenid) {
      this.log(`使用缓存登录态 userId=${this.userId} VIP_TANK=${mask(this.token)}`);
      return;
    }
    const code = await getWxCode(this.server);
    if (!this.vipOpenid) await this.getVipWechatInfo(code);
    if (!this.token || !this.userId) await this.autoLogin(code);
    this.saveCache();
  }

  async signInfo() {
    const url = "https://act-ug.vip.com/checkInAward/withSign/info";
    const data = { ...this.baseData(), openid: this.vipOpenid, actId: ACT_ID, biz_code: "old" };
    const { status, data: res } = await request({
      method: "POST",
      url: `${url}?api_key=${API_KEY}`,
      headers: this.signedHeaders(url, data),
      data: form(data),
    });
    if (status !== 200 || Number(res?.code) !== 1) {
      if (Number(res?.code) === 10013 || Number(res?.code) === -2) this.removeLoginCache();
      throw new Error(`签到查询失败 HTTP ${status}: ${short(res)}`);
    }
    const info = res.data || {};
    const today = (info.checkInList || []).find((item) => Number(item.isCheckInDay) === 1) || {};
    this.log(
      `签到信息: 今日${Number(today.isCheckIn) === 1 ? "已签" : "未签"}，累计${info.numTotal ?? "-"}天，连续${
        info.nonStopNum ?? "-"
      }天，已得唯品币${info.awardVipcoinTotal ?? "-"}，下次奖励${info.nextTimeAwardAmount ?? "-"}`
    );
    return info;
  }

  async sign() {
    const before = await this.signInfo();
    const today = (before.checkInList || []).find((item) => Number(item.isCheckInDay) === 1) || {};
    if (Number(today.isCheckIn) === 1) {
      this.log("签到结果: 今日已签到");
      return before;
    }

    const url = "https://act-ug.vip.com/checkInAward/withSign/checkin";
    const data = { ...this.baseData(), openid: this.vipOpenid, actId: ACT_ID, biz_code: "old" };
    const { status, data: res } = await request({
      method: "POST",
      url: `${url}?api_key=${API_KEY}`,
      headers: this.signedHeaders(url, data),
      data: form(data),
    });
    if (status !== 200 || Number(res?.code) !== 1) {
      const message = String(res?.msg || "");
      if (/已签|重复|already/i.test(message)) {
        this.log("签到结果: 今日已签到");
        return this.signInfo();
      }
      throw new Error(`签到失败 HTTP ${status}: ${short(res)}`);
    }
    const result = res.data || {};
    this.log(
      `签到结果: 成功，获得${result.awardAmount ?? result.awardValDesc ?? "-"}，累计${result.numTotal ?? "-"}天，连续${
        result.nonStopNum ?? "-"
      }天`
    );
    return this.signInfo();
  }

  async run() {
    try {
      this.log(`开始执行 ${mask(this.openid || this.vipOpenid || this.token)}`);
      await this.ensureLogin();
      await this.sign();
      this.saveCache();
    } catch (e) {
      this.log(`执行失败: ${e.message || e}`);
    }
  }
}

async function main() {
  
  const accounts = SERVERS && SERVERS.length ? SERVERS : splitAccounts(process.env["YYB_GO"]);
  if (!accounts.length) {
    console.log(`未找到变量 ${"YYB_GO"}`);
    return;
  }
  for (let i = 0; i < accounts.length; i++) {
    await new Vipshop(accounts[i], i + 1).run();
    if (i < accounts.length - 1) await await sleep(1500, 3000);
  }
}

main()
  .catch((e) => console.log(`脚本异常: ${e.message || e}`))
