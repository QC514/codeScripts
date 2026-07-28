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
    if (normalized.includes("PushPlus")) emitFooter();
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

// name: 热带时光
// cron: 53 9 * * *

const axios = require("axios");
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
        const { data } = await axios.post(url, { ref, app_id: 'wx0a73bcd6f11e05e3' }, { timeout: 20000, proxy: false });
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

const CK_NAME = "ytb2_all";
const API_BASE = "https://ytb2.zs-shiruan.cn/api";
const LOGIN_BASE = "https://ytb2.zs-shiruan.cn/api-v2";
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

const APPS = [
    {
        ck: "rdsgyjd",
        name: "热带时光家庭娱乐中心阳江店",
        appid: "wx0a73bcd6f11e05e3",
        storeId: "2014496",
        signActId: "13417",
    },
].map((app) => ({
    apiBase: process.env[`${app.ck}_api_base`] || API_BASE,
    loginBase: process.env[`${app.ck}_login_base`] || LOGIN_BASE,
    ...app,
    appid: process.env[`${app.ck}_appid`] || app.appid,
    storeId: process.env[`${app.ck}_store_id`] || app.storeId,
    signActId: process.env[`${app.ck}_sign_act_id`] || app.signActId,
}));

function splitAccounts(value = "") {
    return String(value)
        .split(/\n|&/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function unique(items = []) {
    return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function parseUnifiedEnv() {
    const raw = process.env[CK_NAME] || "";
    const result = { global: [], byKey: {} };
    for (const item of splitAccounts(raw)) {
        const idx = item.indexOf("=");
        if (idx === -1) {
            result.global.push(item);
            continue;
        }
        const key = item.slice(0, idx).trim().toLowerCase();
        const value = item.slice(idx + 1).trim();
        if (!key || !value) continue;
        result.byKey[key] = result.byKey[key] || [];
        result.byKey[key].push(value);
    }
    result.global = unique(result.global);
    return result;
}

const unifiedEnv = parseUnifiedEnv();

function getAccounts(app) {
    const keys = [app.ck, app.appid, app.name].map((item) => item.toLowerCase());
    const accounts = [];
    accounts.push(...SERVERS);
    if (unifiedEnv.global.length) accounts.push(...unifiedEnv.global);
    for (const key of keys) accounts.push(...(unifiedEnv.byKey[key] || []));
    accounts.push(...splitAccounts(process.env[app.ck] || ""));
    return unique(accounts);
}

function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function assetValue(memberInfo = {}, keys = [], names = []) {
    const assets = Array.isArray(memberInfo.assets) ? memberInfo.assets : [];
    for (const item of assets) {
        if (keys.includes(item.key) || names.includes(item.name)) return item.num ?? 0;
    }
    return 0;
}

function findSignActId(source) {
    let found = "";
    const walk = (value) => {
        if (found || value === null || value === undefined) return;
        if (typeof value === "string") {
            const match = value.match(/sign-in\/sign-in\?[^"']*actid=(\d+)/i);
            if (match) found = match[1];
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) walk(item);
            return;
        }
        if (typeof value === "object") {
            for (const item of Object.values(value)) walk(item);
        }
    };
    walk(source);
    return found;
}

class Task {
    constructor(app, account, index) {
        this.server = account;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.app = app;
        this.account = account;
        this.index = index;
        this.shiruanKey = "";
        this.mobile = "";
        this.templateUrl = "";
        this.signActId = app.signActId || "";
        this.summary = {
            appName: app.name,
            member: "未查询",
            assets: "未查询",
            sign: "未执行",
        };

    }

    log(message) {
        console.log(`[${this.app.name}][账号${this.index}] ${message}`);
    }

    headers(extra = {}) {
        return {
            "content-type": "application/json",
            "User-Agent": USER_AGENT,
            ...extra,
        };
    }

    authHeaders(extra = {}) {
        return this.headers({
            shiruanKey: this.shiruanKey,
            miniAppid: this.app.appid,
            ...extra,
        });
    }

    async getWxCode() {
        return await getCode(this.server);
    }

    async login() {
        const code = await this.getWxCode();
        if (!code) throw new Error("获取code失败");
        const { data } = await axios.post(
            `${this.app.loginBase}/mini/preLogin-new`,
            {
                app_id: this.app.appid,
                store_id: this.app.storeId || "",
                code,
            },
            {
                headers: this.headers(),
                timeout: 30000,
            }
        );
        if (data?.code !== 200) throw new Error(`登录失败: ${data?.msg || JSON.stringify(data)}`);
        this.shiruanKey = data.data?.shiruan_key || "";
        this.openid = data.data?.openid || "";
        this.mobile = data.data?.mobile || "";
        this.templateUrl = data.data?.templateUrl || "";
        this.log(`登录成功: ${maskPhone(this.mobile)} openId=${this.openid}`);
    }

    async detectSignActId() {
        if (this.signActId) return this.signActId;
        if (!this.templateUrl) return "";
        try {
            const { data } = await axios.get(this.templateUrl, {
                headers: this.headers(),
                timeout: 30000,
            });
            this.signActId = findSignActId(data);
            if (this.signActId) this.log(`识别签到活动ID: ${this.signActId}`);
        } catch (e) {
            this.log(`读取模板失败: ${e.message || e}`);
        }
        return this.signActId;
    }

    async queryAssets() {
        const { data } = await axios.post(
            `${this.app.apiBase}/mini/user-asset`,
            {},
            {
                headers: this.authHeaders(),
                timeout: 30000,
            }
        );
        if (data?.code !== 200) throw new Error(`查询失败: ${data?.msg || JSON.stringify(data)}`);
        const info = data.data?.member_info || {};
        const phone = info.leag_tel || data.data?.mobile || this.mobile;
        const card = info.card_no || info.leag_no || "未知会员";
        const coin = assetValue(info, ["coin_bal"], ["代币"]);
        const point = assetValue(info, ["score"], ["积分", "娃娃积分"]);
        const ticket = assetValue(info, ["tick_bal", "new_ticket"], ["奖票", "特殊奖票"]);
        const gateTicket = assetValue(info, ["ticket_amount"], ["门票"]);
        this.summary.member = `${card} ${maskPhone(phone)}`;
        this.summary.assets = `代币=${coin} 积分=${point} 彩票=${ticket} 门票=${gateTicket}`;
        this.log(`会员: ${this.summary.member} ${this.summary.assets}`);
    }

    async sign() {
        const actId = await this.detectSignActId();
        if (!actId) {
            this.summary.sign = "未找到签到活动ID";
            this.log(this.summary.sign);
            return;
        }
        try {
            const info = await axios.get(`${this.app.apiBase}/marketing/sign-info?marketing_activity_id=${actId}`, {
                headers: this.authHeaders(),
                timeout: 30000,
            });
            if (info.data?.code === 200) {
                const d = info.data.data || {};
                const activityName = d.activity?.name || actId;
                this.log(`签到活动: ${activityName} 已签=${d.is_sign_today || 0} 累计=${d.sign_day || 0}天`);
                if (Number(d.is_sign_today) === 1) {
                    this.summary.sign = `今日已签到 累计=${d.sign_day || 0}天`;
                    return;
                }
            } else {
                this.log(`签到状态查询: ${info.data?.msg || JSON.stringify(info.data)}`);
            }

            const { data } = await axios.get(`${this.app.apiBase}/marketing/new-sign?marketing_activity_id=${actId}`, {
                headers: this.authHeaders(),
                timeout: 30000,
            });
            const gifts = Array.isArray(data?.data?.gifts)
                ? data.data.gifts.map((item) => `${item.num ?? item.gift_num ?? ""}${item.asset_name || item.name || ""}`.trim()).filter(Boolean)
                : [];
            this.summary.sign = `${data?.msg || "签到返回"}${gifts.length ? `: ${gifts.join("、")}` : ""}`;
            this.log(this.summary.sign);
        } catch (e) {
            this.summary.sign = `签到失败: ${e.message || e}`;
            this.log(this.summary.sign);
        }
    }

    async run() {
        try {
            await this.login();
            await this.queryAssets();
            await this.sign();
            await this.queryAssets();
        } catch (e) {
            this.summary.sign = `执行失败: ${e.message || e}`;
            this.log(this.summary.sign);
        }
        return this.summary;
    }
}

!(async () => {
    const plan = APPS.map((app) => ({ app, accounts: getAccounts(app) })).filter((item) => item.accounts.length);
    const totalAccounts = plan.reduce((sum, item) => sum + item.accounts.length, 0);
    console.log(`共找到${plan.length}个小程序，${totalAccounts}个执行账号`);
    if (!plan.length) {
        console.log(`未配置 YYB_GO 或 ${CK_NAME} 变量`);
        return;
    }

    const summaries = [];
    for (const { app, accounts } of plan) {
        console.log(`\n========== ${app.name} (${app.ck}) ==========`);
        let index = 1;
        for (const account of accounts) {
            summaries.push(await new Task(app, account, index++).run());
        }
    }

    console.log("\n========== 执行汇总 ==========");
    for (const item of summaries) {
        console.log(`${item.appName}: ${item.member} ${item.assets} 签到=${item.sign}`);
    }
})()
    .catch((e) => console.log(e.message || e))
