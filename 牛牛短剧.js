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

// name: 牛牛短剧
// cron: 40 9 * * *

const axios = require("axios");
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
        const { data } = await axios.post(url, { openid: ref, appid: MINI_APP_ID, data: {} }, { timeout: 20000, proxy: false, headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
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

const MINI_APP_ID = "wxcb95401f250e9a53";
const API_BASE = "https://api.tianjinzhitongdaohe.com/sqx_fast";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "niuniuduanju_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";
const DAILY_ACTION_COUNT = 2;
const EAT_GOLD_COUNT = 4;
const VIDEO_COUNT_STEPS = [1, 5, 9, 15, 20];
const VIDEO_DURATION_STEPS = [60, 300, 900, 1800, 3600, 7200, 9000];

function readTokenCache() {
    try {
        if (!fs.existsSync(TOKEN_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf8")) || {};
    } catch (e) {
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

function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function maskToken(token = "") {
    if (!token) return "";
    return token.length > 14 ? `${token.slice(0, 8)}***${token.slice(-6)}` : `${token.slice(0, 4)}***`;
}

function randomUserName() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    return `用户${suffix}`;
}

function today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

class Task {
    constructor(openid) {
        this.server = openid;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++;
        this.openid = String(openid || "").trim();
        this.token = "";
        this.user = {};
        this.wxInfo = {};
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached?.token) {
            this.token = cached.token;
            this.user = cached.user || {};
            console.log(`账号[${this.index}] 使用缓存token: ${maskToken(this.token)}`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存token失效，重新code登录`);
            }
        }

        if (!this.token) await this.loginByWxCode();
        if (!this.token) return;

        await this.getPoints("签到前");
        await this.getSignStatus();
        await this.signIn();
        await this.doDailyTasks();
        await this.getPoints("签到后");
    }

    getCachedToken() {
        const cache = readTokenCache();
        return cache[this.openid] || null;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.openid] = {
            token: this.token,
            user: this.user,
            wxInfo: this.wxInfo,
            updatedAt: new Date().toISOString(),
        };
        writeTokenCache(cache);
    }

    removeCachedToken() {
        const cache = readTokenCache();
        if (cache[this.openid]) {
            delete cache[this.openid];
            writeTokenCache(cache);
        }
        this.token = "";
        this.user = {};
    }

    getHeaders(extra = {}) {
        return {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/19/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "content-type": "application/x-www-form-urlencoded",
            ...(this.token ? { token: this.token } : {}),
            ...extra,
        };
    }

    async request({ method = "GET", apiPath, params = {}, data = {}, token = true, json = false }) {
        const options = {
            method,
            url: `${API_BASE}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
            headers: this.getHeaders(json ? { "content-type": "application/json" } : {}),
            timeout: 15000,
            validateStatus: () => true,
        };
        if (!token) delete options.headers.token;
        if (method === "GET") options.params = params;
        else options.data = data;

        const { status, data: result } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${typeof result === "string" ? result.slice(0, 200) : JSON.stringify(result)}`);
        if (!result || result.code !== 0) {
            const err = new Error(result?.msg || result?.message || JSON.stringify(result));
            err.code = result?.code;
            throw err;
        }
        return result;
    }

    async getWxCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getWxCode();
            const wxLogin = await this.request({
                apiPath: "/app/Login/wxLogin",
                params: { code },
                token: false,
            });
            const wxData = wxLogin.data || {};
            const openId = wxData.open_id || wxData.openId || "";
            const unionId = wxData.unionId || wxData.unionid || "";
            if (!openId || !unionId) throw new Error(`wxLogin 未返回openId/unionId: ${JSON.stringify(wxLogin)}`);
            this.wxInfo = wxData;

            const login = await this.request({
                method: "POST",
                apiPath: "/app/Login/insertWxUser",
                token: false,
                json: true,
                data: {
                    openId,
                    unionId,
                    userName: randomUserName(),
                    avatar: "https://nnduanju.oss-cn-beijing.aliyuncs.com/01image/re-512.png",
                    sex: 1,
                    phone: "",
                    inviterCode: "",
                    qdCode: "",
                },
            });
            this.token = login.token || "";
            this.user = login.user || {};
            if (!this.token) throw new Error(`insertWxUser 未返回token: ${JSON.stringify(login)}`);
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: ${this.user.userName || ""} ${maskPhone(this.user.phone)}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            const result = await this.request({ apiPath: "/app/user/selectUserById" });
            this.user = result.data || this.user;
            return true;
        } catch (e) {
            return false;
        }
    }

    async getPoints(label = "积分") {
        const result = await this.request({ apiPath: "/app/integral/selectByUserId" });
        const points = result.data?.integralNum ?? "未知";
        console.log(`账号[${this.index}] ${label}: ${points}`);
        return result.data;
    }

    async getSignStatus() {
        try {
            const result = await this.request({
                apiPath: "/app/integral/selectIntegralDay",
                params: {
                    classify: 1,
                    userId: this.user.userId || "",
                },
            });
            const list = Array.isArray(result.data) ? result.data : [];
            const signedDays = list.filter((item) => item?.num).length;
            console.log(`账号[${this.index}] 本周签到记录: ${signedDays}/${list.length || 7}`);
            return list;
        } catch (e) {
            console.log(`账号[${this.index}] 查询签到记录失败: ${e.message || e}`);
            return [];
        }
    }

    async signIn() {
        try {
            const result = await this.request({
                apiPath: "/app/integral/signIn",
                params: { date: today() },
            });
            console.log(`账号[${this.index}] 签到成功: ${result.msg || "success"}`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已签到|已经签到|重复|今日.*签|不能重复|签到过/.test(message)) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
        }
    }

    async doDailyTasks() {
        await this.completeDramaTasks();
        await this.completeEatGoldTasks();
        await this.completeVideoCoinTasks();
        await this.completeVideoDurationTasks();
        const tasks = [
            { name: "开宝箱", apiPath: "/app/integral/userTimer" },
            { name: "推荐剧观看金币", apiPath: "/app/integral/userDataVideo", params: await this.getUserDataVideoParams() },
            { name: "每日点赞剧集", apiPath: "/app/integral/goodVideo" },
            { name: "收藏新剧", apiPath: "/app/integral/collectVideo" },
            { name: "分享新剧", apiPath: "/app/integral/shareVideo" },
        ];
        for (const task of tasks) {
            await this.claimDailyTask(task);
        }
    }

    async claimDailyTask(task) {
        try {
            const result = await this.request({ apiPath: task.apiPath, params: task.params || {} });
            console.log(`账号[${this.index}] ${task.name}: ${result.msg || "已领取"}${result.data !== undefined ? ` ${result.data}` : ""}`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                console.log(`账号[${this.index}] ${task.name}: 今日已完成`);
                return;
            }
            if (/未完成|请先|任务未达成|次数不足|时间未到|倒计时|稍后|观看/.test(message)) {
                console.log(`账号[${this.index}] ${task.name}: ${message}`);
                return;
            }
            console.log(`账号[${this.index}] ${task.name}失败: ${message}`);
            if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
        }
    }

    async completeEatGoldTasks() {
        try {
            for (let num = 0; num < EAT_GOLD_COUNT; num++) {
                try {
                    const result = await this.request({
                        apiPath: "/app/integral/addEatGold",
                        params: { num },
                    });
                    console.log(`账号[${this.index}] 吃饭看剧补贴[${num + 1}/${EAT_GOLD_COUNT}]: ${result.msg || "success"}`);
                } catch (e) {
                    const message = String(e.message || e);
                    if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                        console.log(`账号[${this.index}] 吃饭看剧补贴[${num + 1}/${EAT_GOLD_COUNT}]: 今日已完成`);
                        continue;
                    }
                    console.log(`账号[${this.index}] 吃饭看剧补贴[${num + 1}/${EAT_GOLD_COUNT}]: ${message}`);
                    if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
                }
            }

            try {
                const result = await this.request({ apiPath: "/app/integral/eatGold" });
                console.log(`账号[${this.index}] 当前餐点补贴: ${result.msg || "success"}`);
            } catch (e) {
                const message = String(e.message || e);
                if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                    console.log(`账号[${this.index}] 当前餐点补贴: 今日已完成`);
                } else {
                    console.log(`账号[${this.index}] 当前餐点补贴: ${message}`);
                }
            }
        } catch (e) {
            console.log(`账号[${this.index}] 吃饭看剧补贴失败: ${e.message || e}`);
        }
    }

    async completeVideoCoinTasks() {
        try {
            let userInfo = await this.getUserInfo();
            let nextStep = Number(userInfo.okLookVideoNum || 0) + 1;
            if (nextStep < 1) nextStep = 1;
            if (nextStep > VIDEO_COUNT_STEPS.length) {
                console.log(`账号[${this.index}] 看视频次数前置: 今日已完成`);
                return;
            }

            for (let step = nextStep; step <= VIDEO_COUNT_STEPS.length; step++) {
                await this.updateUserWatchCount(VIDEO_COUNT_STEPS[step - 1], step);
                try {
                    const result = await this.request({ apiPath: "/app/integral/lookVideoNum" });
                    console.log(`账号[${this.index}] 看视频次数金币[${step}/${VIDEO_COUNT_STEPS.length}]: ${result.msg || "success"}`);
                    userInfo = await this.getUserInfo();
                    if (Number(userInfo.okLookVideoNum || 0) >= VIDEO_COUNT_STEPS.length) break;
                } catch (e) {
                    const message = String(e.message || e);
                    if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                        console.log(`账号[${this.index}] 看视频次数金币: 今日已完成`);
                        break;
                    }
                    console.log(`账号[${this.index}] 看视频次数金币[${step}/${VIDEO_COUNT_STEPS.length}]: ${message}`);
                    if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
                    break;
                }
            }
        } catch (e) {
            console.log(`账号[${this.index}] 看视频次数前置失败: ${e.message || e}`);
        }
    }

    async completeVideoDurationTasks() {
        try {
            let userInfo = await this.getUserInfo();
            let nextStep = Number(userInfo.okLookVideoSec || 0);
            if (nextStep < 1) nextStep = 1;
            if (nextStep > VIDEO_DURATION_STEPS.length) {
                console.log(`账号[${this.index}] 看视频时长前置: 今日已完成`);
                return;
            }

            for (let step = nextStep; step <= VIDEO_DURATION_STEPS.length; step++) {
                await this.updateUserWatchDuration(VIDEO_DURATION_STEPS[step - 1], step);
                try {
                    const result = await this.request({ apiPath: "/app/integral/lookVideoSec" });
                    console.log(`账号[${this.index}] 看视频时长金币[${step}/${VIDEO_DURATION_STEPS.length}]: ${result.msg || "success"}`);
                    userInfo = await this.getUserInfo();
                    if (Number(userInfo.okLookVideoSec || 0) > VIDEO_DURATION_STEPS.length) break;
                } catch (e) {
                    const message = String(e.message || e);
                    if (/已领取|已完成|今日.*完成|重复|不能重复|已经.*领取/.test(message)) {
                        console.log(`账号[${this.index}] 看视频时长金币: 今日已完成`);
                        break;
                    }
                    console.log(`账号[${this.index}] 看视频时长金币[${step}/${VIDEO_DURATION_STEPS.length}]: ${message}`);
                    if (e.code === 401 || /token|登录|验证失败/.test(message)) this.removeCachedToken();
                    break;
                }
            }
        } catch (e) {
            console.log(`账号[${this.index}] 看视频时长前置失败: ${e.message || e}`);
        }
    }

    async updateUserWatchDuration(videoSec, lookVideoSec) {
        const userInfo = await this.getUserInfo();
        await this.request({
            method: "POST",
            apiPath: "/app/user/updateUsers",
            json: true,
            data: {
                userName: userInfo.userName || randomUserName(),
                avatar: userInfo.avatar || "https://nnduanju.oss-cn-beijing.aliyuncs.com/01image/re-512.png",
                phone: userInfo.phone || "",
                videoSec,
                lookVideoSec,
            },
        });
        console.log(`账号[${this.index}] 模拟观看时长: ${Math.floor(videoSec / 60)}分钟`);
    }

    async updateUserWatchCount(lookDayVideoNum, lookVideoNum) {
        const userInfo = await this.getUserInfo();
        await this.request({
            method: "POST",
            apiPath: "/app/user/updateUsers",
            json: true,
            data: {
                userName: userInfo.userName || randomUserName(),
                avatar: userInfo.avatar || "https://nnduanju.oss-cn-beijing.aliyuncs.com/01image/re-512.png",
                phone: userInfo.phone || "",
                lookDayVideoNum,
                lookVideoNum,
            },
        });
        console.log(`账号[${this.index}] 模拟观看视频次数: ${lookDayVideoNum}次`);
    }

    async getUserDataVideoParams() {
        try {
            const courses = await this.getDailyCourses();
            const course = courses[0] || {};
            if (!course.courseId) return {};
            const episode = await this.getCourseEpisode(course.courseId);
            return {
                courseId: course.courseId,
                courseDetailsId: episode?.courseDetailsId || course.courseDetailsId || "",
            };
        } catch (e) {
            return {};
        }
    }

    async completeDramaTasks() {
        try {
            const userInfo = await this.getUserInfo();
            const needGood = Number(userInfo.goodVideo || 0) < DAILY_ACTION_COUNT;
            const needCollect = Number(userInfo.collectVideo || 0) < DAILY_ACTION_COUNT;
            if (!needGood && !needCollect) return;

            const courses = await this.getDailyCourses();
            if (!courses.length) {
                console.log(`账号[${this.index}] 剧集任务前置: 未获取到推荐剧`);
                return;
            }

            let goodDone = 0;
            let collectDone = 0;
            for (const course of courses) {
                if (goodDone >= DAILY_ACTION_COUNT && collectDone >= DAILY_ACTION_COUNT) break;
                const episode = await this.getCourseEpisode(course.courseId);
                const courseDetailsId = episode?.courseDetailsId || course.courseDetailsId || "";
                if (!course.courseId || !courseDetailsId) continue;

                if (needGood && goodDone < DAILY_ACTION_COUNT) {
                    await this.setCourseCollect(course.courseId, courseDetailsId, 2, 0);
                    await this.setCourseCollect(course.courseId, courseDetailsId, 2, 1);
                    goodDone++;
                }

                if (needCollect && collectDone < DAILY_ACTION_COUNT) {
                    await this.setCourseCollect(course.courseId, courseDetailsId, 1, 0);
                    await this.setCourseCollect(course.courseId, courseDetailsId, 1, 1);
                    collectDone++;
                }
            }

            if (goodDone || collectDone) {
                console.log(`账号[${this.index}] 剧集任务前置: 点赞${goodDone}次 收藏${collectDone}次`);
            }
        } catch (e) {
            console.log(`账号[${this.index}] 剧集任务前置失败: ${e.message || e}`);
        }
    }

    async getUserInfo() {
        const result = await this.request({ apiPath: "/app/user/selectUserById" });
        this.user = result.data || this.user;
        return this.user;
    }

    async getDailyCourses() {
        const result = await this.request({ apiPath: "/app/common/type/922" });
        const list = result.data?.courseList;
        return Array.isArray(list) ? list : [];
    }

    async getCourseEpisode(courseId) {
        const result = await this.request({
            apiPath: "/app/course/selectCourseDetailsByCourseId",
            params: {
                id: courseId,
                token: this.token,
            },
        });
        return result.data || {};
    }

    async setCourseCollect(courseId, courseDetailsId, classify, type) {
        await this.request({
            method: "POST",
            apiPath: "/app/courseCollect/insertCourseCollect",
            json: true,
            data: {
                courseId,
                courseDetailsId,
                classify,
                type,
            },
        });
    }
}

!(async () => {
    
    for (const openid of SERVERS) {
        await new Task(openid).run();
    }
})()
    .catch((e) => console.log(e.message || e))
