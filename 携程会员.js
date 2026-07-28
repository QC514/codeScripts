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
    if (text.startsWith("[") || /^[^\w\s]{1,3}\s*\[[^\]]+\]/u.test(text)) return text;
    text = text.replace(/^(?:✅|❌|⚠️?|ℹ️?|🌐|🛠️?|⏳|🔐|🎯|🎰|💰|💸|📊|📡|📝|🔁|🚀)\s*/u, "");
    const lower = text.toLowerCase();
    const tag = logTag(text);
    let icon = "ℹ️";
    if (level === "error" || /(error|exception|traceback)/i.test(lower) || /(失败|错误|异常)/.test(text)) icon = "❌";
    else if (level === "warn" || /(警告|跳过|已签到|已经签到|不可用|未配置)/.test(text)) icon = "⚠️";
    else if (/(等待|延迟)/.test(text)) icon = "⏳";
    else if (/(成功|完成|通过|获得|提取到)/.test(text)) icon = "✅";
    else if (tag === "代理" && text.includes("生成")) icon = "🛠️";
    else if (tag === "代理") icon = "🌐";
    else if (tag === "登录") icon = "🔐";
    return `${icon} [${tag}] ${text}`;
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

// name: 携程会员
// cron: 48 9 * * *

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

const MINI_APP_ID = "wx0e6ed4f51db9d078";
const PACKAGE_VERSION = "1055";
const CLIENT_ID = "09031101311473737701";
const ACCESS_CODE = "XTHYY69RNSKLWEICHATMINI";
const API_BASE = "https://m.ctrip.com";
const PASSPORT_BASE = "https://passport.ctrip.com/gateway/api";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "ctrip_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const TASK_CHANNELS = [
  { label: "做任务赚积分", channelCode: "2H3294O46M" },
  { label: "升级赚积分", channelCode: "5EBG1WS7J1" },
];

global.wx = global.wx || { j() {} };
global.window = global.window || {};
global.navigator = global.navigator || {
  userAgent: "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
  plugins: [],
};
global.document = global.document || { cookie: "" };
global.screen = global.screen || { width: 1920, height: 1080 };

const csign = null;

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

function mask(value = "") {
  value = String(value);
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 3)}***`;
  return `${value.slice(0, 6)}***${value.slice(-6)}`;
}

function parseJsonMaybe(text) {
  if (!text || typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseAccount(raw) {
  const text = String(raw || "").trim();
  if (!text) return {};

  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      return {
        openid: data.openid || data.openId || data.account || "",
        ticket: data.ticket || data.auth || "",
        duid: data.duid || "",
        udl: data.udl || "",
      };
    } catch {}
  }

  for (const sep of ["#", "|"]) {
    if (text.includes(sep)) {
      const [openid, ticket, duid, udl] = text.split(sep).map((v) => v.trim());
      return { openid, ticket, duid, udl };
    }
  }

  if (/^[A-Z0-9]{48,}$/i.test(text) && !/^o[A-Za-z0-9_-]{20,}$/.test(text)) {
    return { ticket: text };
  }
  return { openid: text };
}

function okResponseStatus(data) {
  return data?.ResponseStatus?.Ack === "Success" || data?.responseStatus?.ack === "Success";
}

function okBusiness(data) {
  const code = Number(data?.code);
  return okResponseStatus(data) && (code === 0 || code === 200);
}

function taskId(task = {}) {
  return task.id || task.taskId || task.taskID || task.taskNo || "";
}

function taskTitle(task = {}) {
  return task.taskName || task.title || task.name || task.buttonName || `任务${taskId(task)}`;
}

function pickTasks(data = {}) {
  const keys = ["taskList", "todoTaskList", "finishTaskList", "filteredTaskList"];
  const map = new Map();
  for (const key of keys) {
    const list = Array.isArray(data[key]) ? data[key] : [];
    for (const item of list) {
      const id = taskId(item);
      if (id && !map.has(String(id))) map.set(String(id), item);
    }
  }
  return [...map.values()];
}

async function gateway(pathname, data) {
  const res = await axios.post(`${PASSPORT_BASE}/${pathname}`, JSON.stringify(data), {
    timeout: 30000,
    validateStatus: () => true,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
      Referer: `https://servicewechat.com/${MINI_APP_ID}/${PACKAGE_VERSION}/page-frame.html`,
    },
  });
  if (res.status !== 200 || Number(res.data?.ReturnCode) !== 0) {
    throw new Error(`${pathname}失败: ${JSON.stringify(res.data)}`);
  }
  return parseJsonMaybe(res.data.Result || "{}");
}

async function h5Api(pathname, data, account) {
  const cookies = [];
  if (account.ticket) cookies.push(`cticket=${account.ticket}`);
  if (account.duid) cookies.push(`DUID=${encodeURIComponent(account.duid)}`);
  if (account.udl) cookies.push(`_udl=${account.udl}`);
  cookies.push(`GUID=${CLIENT_ID}`);
  const res = await axios.post(`${API_BASE}${pathname}`, JSON.stringify(data || {}), {
    timeout: 30000,
    validateStatus: () => true,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF",
      Referer: "https://m.ctrip.com/",
      Cookie: `${cookies.join("; ")};`,
    },
  });
  return {
    status: res.status,
    data: res.data,
    text: typeof res.data === "string" ? res.data : JSON.stringify(res.data),
  };
}

class Task {
  constructor(raw) {
        this.server = raw;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
    this.index = userIdx++;
    const account = parseAccount(raw);
    this.openid = account.openid || "";
    this.ticket = account.ticket || "";
    this.duid = account.duid || "";
    this.udl = account.udl || "";
    this.uid = "";
    this.cacheKey = this.openid || (this.ticket ? md5(this.ticket).slice(0, 16) : `account_${this.index}`);
  }

  getCached() {
    return readCache()[this.cacheKey] || {};
  }

  saveCache(extra = {}) {
    const cache = readCache();
    cache[this.cacheKey] = {
      ...(cache[this.cacheKey] || {}),
      ...(this.openid ? { openid: this.openid } : {}),
      ...(this.ticket ? { ticket: this.ticket } : {}),
      ...(this.duid ? { duid: this.duid } : {}),
      ...(this.udl ? { udl: this.udl } : {}),
      ...(this.uid ? { uid: this.uid } : {}),
      ...extra,
      updatedAt: new Date().toISOString(),
    };
    writeCache(cache);
  }

  removeTicket() {
    const cache = readCache();
    if (cache[this.cacheKey]) {
      delete cache[this.cacheKey].ticket;
      writeCache(cache);
    }
  }

  async getOperateData() {
    const code = await getCode(this.server);
    return { code, encryptedData: "", iv: "" };
  }

  async login() {
    const op = await this.getOperateData();
    const wxLogin = await gateway("soa2/14553/wechatLogin.json", {
      AccountHead: {},
      Data: {
        authCode: op.code,
        thirdConfigCode: ACCESS_CODE,
        Context: {},
      },
    });
    if (!wxLogin?.wechatCode || wxLogin?.resultStatus?.returnCode !== 0) {
      throw new Error(`wechatLogin未返回wechatCode: ${JSON.stringify(wxLogin)}`);
    }

    const auth = await gateway("soa2/14553/authenticate.json", {
      AccountHead: {},
      Data: {
        authCode: wxLogin.wechatCode,
        thirdType: "wechat_app",
        thirdConfigCode: ACCESS_CODE,
        context: {
          encryptedData: op.encryptedData,
          iv: op.iv,
          uuid: "",
        },
      },
    });
    if (!auth?.token || auth?.resultStatus?.returnCode !== 0) {
      throw new Error(`authenticate未返回第三方token: ${JSON.stringify(auth)}`);
    }

    const login = await gateway("soa2/12559/thirdPartyLogin.json", {
      AccountHead: {},
      Data: {
        accountHead: {
          locale: "zh_CN",
          platform: "MINIAPP",
        },
        token: auth.token,
        extendedProperties: {
          clientID: CLIENT_ID,
          page_id: "",
          Url: "",
          thirdConfigCode: ACCESS_CODE,
          deviceName: "Windows PC",
          OsType: "windows",
        },
      },
    });
    if (!login?.ticket || login?.resultStatus?.returnCode !== 0) {
      throw new Error(`thirdPartyLogin未返回ticket: ${JSON.stringify(login)}`);
    }

    this.ticket = login.ticket;
    this.duid = login.duid || login.extendedProperties?.duid || "";
    this.udl = login.udl || "";
    this.uid = login.uid || "";
    this.saveCache({ isNewUser: login.extendedProperties?.isNewUser || "" });
    console.log(`账号[${this.index}] 登录成功: ${mask(this.uid || this.ticket)}`);
  }

  async ensureLogin() {
    const cached = this.getCached();
    this.ticket = this.ticket || cached.ticket || "";
    this.duid = this.duid || cached.duid || "";
    this.udl = this.udl || cached.udl || "";
    this.uid = this.uid || cached.uid || "";
    if (this.ticket) return;
    await this.login();
  }

  headers(raw) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "*/*",
      "x-ctx-locale": "zh-CN",
      "x-ctx-group": "ctrip",
      "x-ctx-region": "CN",
      "x-ctx-currency": "CNY",
      "x-wx-include-credentials": "env",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF",
      Referer: `https://servicewechat.com/${MINI_APP_ID}/${PACKAGE_VERSION}/page-frame.html`,
    };
    if (this.openid) headers["x-wx-openid"] = this.openid;
    if (this.duid) headers.duid = this.duid;
    if (this.udl) headers.udl = this.udl;
    const cookies = [];
    if (this.duid) cookies.push(`DUID=${encodeURIComponent(this.duid)}`);
    if (this.udl) cookies.push(`_udl=${this.udl}`);
    cookies.push(`GUID=${CLIENT_ID}`);
    headers.Cookie = `${cookies.join("; ")};`;
    if (csign?.cSign) headers["n-payload-source"] = csign.cSign(md5(raw));
    return headers;
  }

  dataHead(extra = {}) {
    return {
      cid: CLIENT_ID,
      ctok: "",
      cver: "1.2.170",
      lang: "01",
      sid: "",
      syscode: "30",
      auth: this.ticket || "",
      sauth: "",
      ...extra,
      extension: [
        { name: "appId", value: MINI_APP_ID },
        { name: "scene", value: "1001" },
      ],
    };
  }

  async ctripRequest(pathname, data = {}, { addHead = true } = {}) {
    const body = { ...(data || {}) };
    if (addHead) body.head = this.dataHead(body.head || {});
    const raw = JSON.stringify(body);
    const res = await axios.post(`${API_BASE}${pathname}?_fxpcqlniredt=${CLIENT_ID}`, raw, {
      timeout: 30000,
      validateStatus: () => true,
      headers: this.headers(raw),
    });
    return {
      status: res.status,
      data: res.data,
      text: typeof res.data === "string" ? res.data : JSON.stringify(res.data),
    };
  }

  async querySignStatus() {
    const res = await this.ctripRequest("/restapi/soa2/13012/getSignTodayInfoProxy", {});
    if (res.status === 401 && res.data?.code === "11001") {
      console.log(`账号[${this.index}] 签到状态接口被携程运行态校验拦截: ${res.data.message}`);
      return null;
    }
    if (res.status !== 200) {
      console.log(`账号[${this.index}] 签到状态查询异常[${res.status}]: ${res.text.slice(0, 300)}`);
      return null;
    }
    if (!okResponseStatus(res.data)) {
      console.log(`账号[${this.index}] 签到状态查询失败: ${res.text.slice(0, 500)}`);
      return null;
    }
    const info = parseJsonMaybe(res.data.responseJson || "{}");
    const signed = !!(info && info.message === "成功" && info.sign === false);
    console.log(`账号[${this.index}] 今日签到状态: ${signed ? "已签到" : "未签到/未知"}`);
    return { signed, raw: info };
  }

  async trySignEndpoint(pathname) {
    const payloads = [
      {},
      { activityId: "wechat_signin_activity" },
      { source: "wxapp", activityId: "wechat_signin_activity" },
    ];
    for (const payload of payloads) {
      const res = await this.ctripRequest(pathname, payload);
      const body = res.text.slice(0, 600);
      if (res.status === 200 && (okResponseStatus(res.data) || /成功|已签到|sign/i.test(body))) {
        console.log(`账号[${this.index}] 签到接口 ${pathname} 返回: ${body}`);
        return true;
      }
      if (res.status !== 404 && res.status !== 403) {
        console.log(`账号[${this.index}] 候选接口 ${pathname} [${res.status}]: ${body}`);
      }
    }
    return false;
  }

  async sign() {
    await this.querySignStatus();
    const res = await h5Api("/restapi/soa2/22769/signToday", { openId: this.openid || "" }, this);
    if (res.status !== 200) {
      console.log(`账号[${this.index}] 签到请求异常[${res.status}]: ${res.text.slice(0, 500)}`);
      return;
    }
    if (okResponseStatus(res.data)) {
      const message = res.data.message || "";
      const points = Number(res.data.baseIntegratedPoint || 0) + Number(res.data.extraIntegratedPoint || 0);
      if (Number(res.data.code) === 0 || /成功/.test(message)) {
        console.log(`账号[${this.index}] 签到成功: ${message || "成功"}${points ? `，积分+${points}` : ""}`);
      } else if (/已签到|无法补签/.test(message) || Number(res.data.code) === 400001) {
        console.log(`账号[${this.index}] 今日已签到: ${message}`);
      } else {
        console.log(`账号[${this.index}] 签到返回: ${res.text.slice(0, 800)}`);
      }
      return;
    }
    console.log(`账号[${this.index}] 签到失败: ${res.text.slice(0, 800)}`);
  }

  async h5Model(code, name, data = {}) {
    return h5Api(`/restapi/soa2/${code}/${name}`, data, this);
  }

  async taskModel(name, data = {}) {
    const res = await this.h5Model("22598", name, data);
    if (res.status !== 200) {
      console.log(`账号[${this.index}] 任务接口 ${name} 异常[${res.status}]: ${res.text.slice(0, 500)}`);
      return null;
    }
    if (!okBusiness(res.data)) {
      console.log(`账号[${this.index}] 任务接口 ${name} 返回: ${res.text.slice(0, 800)}`);
      return res.data;
    }
    return res.data;
  }

  async queryTaskList(channelCode, label) {
    const data = await this.taskModel("userTaskList", { channelCode });
    if (!data) return [];
    const tasks = pickTasks(data);
    console.log(
      `账号[${this.index}] ${label}: ${data.projectName || channelCode}，待做${(data.todoTaskList || []).length}，已完成${(data.finishTaskList || []).length}，过滤${(data.filteredTaskList || []).length}`
    );
    if (!tasks.length) console.log(`账号[${this.index}] ${label}: 暂无可处理任务`);
    return tasks;
  }

  async receiveTaskAward(channelCode, task, receivedTaskId) {
    const id = taskId(task);
    if (!id || !receivedTaskId) return;
    const data = await this.taskModel("receiveTaskAward", {
      channelCode,
      taskId: id,
      receiveTaskId: receivedTaskId,
    });
    if (okBusiness(data)) {
      console.log(`账号[${this.index}] 领取任务发奖成功: ${taskTitle(task)} ${data.message || ""}`);
    }
  }

  async doTask(channelCode, task, label) {
    const id = taskId(task);
    if (!id) return;
    const status = Number(task.status ?? task.taskStatus ?? 0);
    const title = taskTitle(task);
    const base = { channelCode, taskId: id, status, done: 0 };
    console.log(`账号[${this.index}] ${label} 执行任务: ${title}，status=${status}`);
    const receive = await this.taskModel("todoTask", base);
    const receivedTaskId = receive?.infoMap?.receivedTaskId || receive?.receivedTaskId || "";
    if (okBusiness(receive)) {
      console.log(`账号[${this.index}] ${label} 任务上报成功: ${title} ${receive.message || ""}`);
      await this.receiveTaskAward(channelCode, task, receivedTaskId);
    }

    await await sleep(1000, 1800);
    const done = await this.taskModel("todoTask", { ...base, status: 0, done: 1 });
    if (okBusiness(done)) {
      console.log(`账号[${this.index}] ${label} 浏览完成上报成功: ${title} ${done.message || ""}`);
    }
  }

  async awardTask(channelCode, task, label) {
    const id = taskId(task);
    if (!id) return;
    const data = await this.taskModel("awardTask", { channelCode, taskId: id });
    if (okBusiness(data)) {
      const award = data.awardName || data.rewardName || data.message || "成功";
      console.log(`账号[${this.index}] ${label} 领奖成功: ${taskTitle(task)}，${award}`);
    } else if (data) {
      console.log(`账号[${this.index}] ${label} 领奖返回: ${taskTitle(task)}，${JSON.stringify(data).slice(0, 500)}`);
    }
  }

  async runTaskChannel({ channelCode, label }) {
    let tasks = await this.queryTaskList(channelCode, label);
    for (const task of tasks) {
      const status = Number(task.status ?? task.taskStatus ?? 0);
      if (status === 0 || status === 1) {
        await this.doTask(channelCode, task, label);
        await await sleep(800, 1500);
      }
    }

    tasks = await this.queryTaskList(channelCode, `${label}复查`);
    for (const task of tasks) {
      const status = Number(task.status ?? task.taskStatus ?? 0);
      if (status === 2) {
        await this.awardTask(channelCode, task, label);
        await await sleep(800, 1500);
      } else if (status === 3) {
        console.log(`账号[${this.index}] ${label} 已完成: ${taskTitle(task)}`);
      }
    }
  }

  async queryPointInfo() {
    const point = await this.h5Model("22769", "getSignInUserBasicInfo", {});
    if (point.status === 200 && okBusiness(point.data)) {
      console.log(`账号[${this.index}] 当前会员积分: ${point.data.integratedPoint ?? "未知"}`);
    } else {
      console.log(`账号[${this.index}] 会员积分查询失败: ${point.text.slice(0, 500)}`);
    }

    const yoyo = await this.h5Model("22769", "travelGameUserAccountInfo", {});
    if (yoyo.status === 200 && okBusiness(yoyo.data)) {
      const info = yoyo.data.travelGameUserInfoDto || {};
      const travel = yoyo.data.travelGameUserTravelDto || {};
      const levelText = info.levelName || (info.level ? `LV${info.level}` : "");
      console.log(
        `账号[${this.index}] YOYO信息: ${levelText}，${info.titleName || ""}，还差${info.needFishCount ?? "未知"}条小鱼升级，旅行状态${travel.travelStatus ?? yoyo.data.travelStatus ?? "未知"}`
      );
    } else {
      console.log(`账号[${this.index}] YOYO信息查询失败: ${yoyo.text.slice(0, 500)}`);
    }
  }

  async tryUpgradeAwards() {
    const awards = [
      { name: "travelGameFirstTimeFishAward", label: "首次小鱼升级奖励" },
      { name: "travelGameDailyFishAward", label: "每日小鱼升级奖励" },
      { name: "travelGameTravelAward", label: "云旅行升级奖励" },
    ];
    for (const item of awards) {
      const data = await this.h5Model("22769", item.name, { platform: "H5" });
      if (data.status !== 200) {
        console.log(`账号[${this.index}] ${item.label} 请求异常[${data.status}]: ${data.text.slice(0, 300)}`);
        continue;
      }
      if (okBusiness(data.data)) {
        const exp = data.data.expChangeResultDto || {};
        const point = exp.levelUpIntegralNumber || data.data.travelIntegralNumber || 0;
        console.log(
          `账号[${this.index}] ${item.label} 领取成功: ${data.data.message || "成功"}${point ? `，积分+${point}` : ""}${exp.levelUp ? "，已升级" : ""}`
        );
      } else if (Number(data.data?.code) === 500027) {
        console.log(`账号[${this.index}] ${item.label}: 需要滑块验证，跳过`);
      } else if (/已领取|已经领取|不能领取|暂无|失败|错误/.test(data.data?.message || "")) {
        console.log(`账号[${this.index}] ${item.label}: ${data.data.message}`);
      } else {
        console.log(`账号[${this.index}] ${item.label} 返回: ${data.text.slice(0, 600)}`);
      }
      await await sleep(800, 1500);
    }
  }

  async run() {
    await this.ensureLogin();
    await this.queryPointInfo();
    await this.sign();
    for (const channel of TASK_CHANNELS) {
      await this.runTaskChannel(channel);
    }
    await this.tryUpgradeAwards();
    await this.queryPointInfo();
    this.saveCache();
  }
}

!(async () => {
  
  for (const account of SERVERS) {
    try {
      await new Task(account).run();
    } catch (e) {
      console.log(`账号执行异常: ${e.message || e}`);
    }
    await await sleep(800, 1500);
  }
})()
  .catch((e) => console.log(e.message || e))
