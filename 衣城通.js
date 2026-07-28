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

// name: 衣城通
// cron: 21 8 * * *

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

const MINI_APP_ID = "wxc4eaf0fd0c97862f";
const PACKAGE_VERSION = "138";
const API_BASE = "https://api.yctjob.com";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "yichengtong_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const TASK_FUNC_TYPE = {
  lookpost: 1,
  sharepost: 2,
  improveresume: 3,
  adddesktop: 4,
  addmymini: 5,
  lookmerchant: 6,
  lookclothing: 7,
  invitecolleagues: 8,
};
const AUTO_TASK_TYPES = new Set([
  TASK_FUNC_TYPE.lookpost,
  TASK_FUNC_TYPE.sharepost,
  TASK_FUNC_TYPE.lookmerchant,
  TASK_FUNC_TYPE.lookclothing,
]);

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

function parseAccount(raw) {
  const text = String(raw || "").trim();
  if (!text) return {};

  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      return {
        openid: data.openid || data.openId || data.account || "",
        token: data.token || data.Authorization || data.authorization || "",
      };
    } catch {}
  }

  for (const sep of ["#", "|"]) {
    if (text.includes(sep)) {
      const [openid, ...rest] = text.split(sep);
      return { openid: openid.trim(), token: rest.join(sep).trim().replace(/^Bearer\s+/i, "") };
    }
  }

  if (text.startsWith("eyJ") || text.length > 80) return { token: text.replace(/^Bearer\s+/i, "") };
  return { openid: text };
}

function ok(res) {
  return Number(res?.code) === 200;
}

function taskSummary(list = []) {
  return list
    .map((item) => `${item.name || item.title || item.id || "任务"} ${item.completeCount ?? 0}/${item.num ?? 1}`)
    .join("；");
}

function taskName(task = {}) {
  return task.name || task.title || `任务${task.id || task.configId || ""}`;
}

async function request(method, urlPath, { token = "", data = null, params = null, custom = {} } = {}) {
  const res = await axios({
    method,
    url: `${API_BASE}${urlPath}`,
    data,
    params,
    timeout: 30000,
    validateStatus: () => true,
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 MicroMessenger MiniProgramEnv/Windows",
      Referer: `https://servicewechat.com/${MINI_APP_ID}/${PACKAGE_VERSION}/page-frame.html`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...custom,
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
    this.token = account.token || process.env.yichengtong_token || "";
    this.wxInfo = {};
    this.userInfo = {};
    this.cacheKey = this.openid || (this.token ? md5(this.token).slice(0, 16) : `account_${this.index}`);
  }

  getCached() {
    return readCache()[this.cacheKey] || {};
  }

  saveCache(extra = {}) {
    const cache = readCache();
    cache[this.cacheKey] = {
      ...(cache[this.cacheKey] || {}),
      ...(this.openid ? { openid: this.openid } : {}),
      ...(this.token ? { token: this.token } : {}),
      ...(this.userInfo?.userId ? { userId: this.userInfo.userId } : {}),
      ...(this.userInfo?.mobile ? { mobile: this.userInfo.mobile } : {}),
      ...extra,
      updatedAt: new Date().toISOString(),
    };
    writeCache(cache);
  }

  removeToken() {
    const cache = readCache();
    if (cache[this.cacheKey]) {
      delete cache[this.cacheKey].token;
      writeCache(cache);
    }
  }

  async getWxCode() {
        return await getCode(this.server);
    }

  async loginByCode() {
    const code = await this.getWxCode();
    const session = await request("post", "/client/web/wechatSession", {
      params: { code },
      data: {},
    });
    if (session.status !== 200 || !ok(session.data)) {
      throw new Error(`wechatSession失败[${session.status}]: ${session.text.slice(0, 500)}`);
    }
    const data = session.data.data || {};
    this.wxInfo = data.wxInfo || {};
    this.userInfo = data.userInfo || {};
    if (this.wxInfo.openid && !this.openid) this.openid = this.wxInfo.openid;
    const token = this.userInfo.token || data.token || "";
    if (!token) return false;
    this.token = token;
    this.saveCache({ loginType: "wechatSession" });
    console.log(`账号[${this.index}] code登录成功: ${mask(this.userInfo.userId || this.token)}`);
    return true;
  }

  async ensureLogin() {
    const cached = this.getCached();
    this.token = this.token || cached.token || "";
    this.userInfo.userId = cached.userId || "";
    if (this.token) return;
    if (!(await this.loginByCode())) {
      console.log(`账号[${this.index}] code登录失败，YYB Go 模式下不支持手机号授权数据兜底登录`);
    }
  }

  async api(method, urlPath, options = {}) {
    let res = await request(method, urlPath, { ...options, token: this.token });
    if (res.status === 401 || Number(res.data?.code) === 401) {
      console.log(`账号[${this.index}] token失效，尝试重新登录`);
      this.removeToken();
      this.token = "";
      await this.ensureLogin();
      res = await request(method, urlPath, { ...options, token: this.token });
    }
    return res;
  }

  async querySignHome() {
    const res = await this.api("get", "/client/user/signHome");
    if (res.status !== 200 || !ok(res.data)) {
      throw new Error(`签到信息查询失败[${res.status}]: ${res.text.slice(0, 800)}`);
    }
    const data = res.data.data || {};
    const amount = data.amount ?? 0;
    const integral = data.integral ?? 0;
    const configs = Array.isArray(data.configs) ? data.configs : [];
    const today = configs.find((item) => Number(item.signStatus) === 0) || configs.find((item) => item.today);
    const signed = configs.some((item) => Number(item.signStatus) === 1 && item.today);
    console.log(`账号[${this.index}] 查询: 积分${integral}，红包${amount}`);
    if (configs.length) {
      const statusText = configs
        .map((item) => `第${item.dayNum ?? item.days ?? "?"}天:${["未签", "已签", "可补签"][Number(item.signStatus)] || item.signStatus}`)
        .join("；");
      console.log(`账号[${this.index}] 签到日历: ${statusText}`);
    }
    return { data, today, signed };
  }

  async sign(signInfo) {
    if (!signInfo?.today?.logId) {
      console.log(`账号[${this.index}] 未找到今日可签到记录，可能已签到或活动未开放`);
      return;
    }
    const res = await this.api("post", "/client/user/sign", {
      data: { logId: signInfo.today.logId },
    });
    if (res.status === 200 && ok(res.data)) {
      console.log(`账号[${this.index}] 签到成功: ${res.data.msg || "成功"}`);
      return;
    }
    const msg = res.data?.msg || res.data?.message || res.text.slice(0, 500);
    if (/已签|重复|already/i.test(msg)) console.log(`账号[${this.index}] 今日已签到: ${msg}`);
    else console.log(`账号[${this.index}] 签到失败[${res.status}]: ${msg}`);
  }

  async queryTaskHome() {
    const res = await this.api("get", "/client/user/taskHome");
    if (res.status !== 200 || !ok(res.data)) {
      console.log(`账号[${this.index}] 任务信息查询失败[${res.status}]: ${res.text.slice(0, 500)}`);
      return null;
    }
    const data = res.data.data || {};
    console.log(`账号[${this.index}] 任务中心: 积分${data.integral ?? 0}，红包${data.amount ?? 0}`);
    const todayTask = Array.isArray(data.todayTask) ? data.todayTask : [];
    const experienceTask = Array.isArray(data.experienceTask) ? data.experienceTask : [];
    if (todayTask.length) console.log(`账号[${this.index}] 每日任务: ${taskSummary(todayTask)}`);
    if (experienceTask.length) console.log(`账号[${this.index}] 体验任务: ${taskSummary(experienceTask)}`);
    return data;
  }

  async submitTask(task) {
    const id = task.id || task.configId;
    if (!id) return false;
    const res = await this.api("post", "/client/user/taskSub", {
      data: { configId: id },
    });
    if (res.status === 200 && ok(res.data)) {
      console.log(`账号[${this.index}] 任务提交成功: ${taskName(task)} ${res.data.msg || ""}`);
      return true;
    }
    const msg = res.data?.msg || res.data?.message || res.text.slice(0, 500);
    console.log(`账号[${this.index}] 任务提交失败: ${taskName(task)}，${msg}`);
    return false;
  }

  async doDailyTasks(taskHome = null) {
    const data = taskHome || (await this.queryTaskHome());
    if (!data) return;
    const todayTask = Array.isArray(data.todayTask) ? data.todayTask : [];
    const runnable = todayTask.filter((task) => {
      const total = Number(task.num || 1);
      const done = Number(task.completeCount || 0);
      return done < total && AUTO_TASK_TYPES.has(Number(task.functionType));
    });
    if (!runnable.length) {
      console.log(`账号[${this.index}] 每日任务: 暂无可自动执行任务`);
      return;
    }

    for (const task of runnable) {
      const total = Number(task.num || 1);
      let done = Number(task.completeCount || 0);
      const waitSeconds = Math.max(0, Number(task.second || 0));
      while (done < total) {
        console.log(`账号[${this.index}] 执行每日任务: ${taskName(task)} ${done + 1}/${total}`);
        if (waitSeconds > 0) await await sleep(waitSeconds * 1000 + 500, waitSeconds * 1000 + 1800);
        const success = await this.submitTask(task);
        if (!success) break;
        done += 1;
        await await sleep(800, 1500);
      }
    }
  }

  async run() {
    await this.ensureLogin();
    const signInfo = await this.querySignHome();
    await this.sign(signInfo);
    await this.querySignHome();
    const taskHome = await this.queryTaskHome();
    await this.doDailyTasks(taskHome);
    await this.queryTaskHome();
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
