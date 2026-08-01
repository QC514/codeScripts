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
        if (auth) curlArgs.push("--header", `Authorization: ${auth}`);
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

// name: 米萌生活
// cron: 42 8 * * *

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
    const url = "http://" + parsedServer + "/wxapp/getCode";
    try {
        const { data } = await axios.post(url, { ref, app_id: 'wx9939a74ee8a8522a' }, { timeout: 20000, proxy: false, headers: auth ? { Authorization: auth } : {} });
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

const APP = { name: "米萌生活", appid: "wx9939a74ee8a8522a" };
const GQL_URL = "https://shd.luxingiot.com/graphql";

const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "mimengshenghuo_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

function splitAccounts(value = "") {
    return String(value)
        .split(/\n|&/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function short(value, max = 260) {
    if (value === undefined || value === null) return "";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

function maskToken(token = "") {
    const value = String(token || "");
    return value.length > 16 ? `${value.slice(0, 8)}***${value.slice(-6)}` : `${value.slice(0, 4)}***`;
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

async function request(options) {
    const res = await axios.request({
        timeout: 20000,
        validateStatus: () => true,
        ...options,
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json, text/plain, */*",
            ...(options.headers || {}),
        },
    });
    return { status: res.status, headers: res.headers || {}, data: res.data };
}

async function getWxCode(server) {
        return await getCode(server);
    }


function operationName(query) {
    const match = /(query|mutation)\s*?([\w\d\-_]+)?\s*?(\(.*?\))?\s*?\{/.exec(query);
    return match && match[2] ? match[2] : "";
}

class Mimeng {
    constructor(openid, index) {
        this.server = openid;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.openid = openid;
        this.index = index;
        this.token = "";
        this.viewer = {};
        this.socialApp = {};
        this.checkIn = null;
        this.videoTask = null;
    }

    cacheKey() {
        return this.openid;
    }

    getCachedToken() {
        const cache = readTokenCache();
        return cache[this.cacheKey()]?.token || "";
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.cacheKey()] = {
            token: this.token,
            uid: this.viewer.uid || "",
            points: this.viewer.wallet?.points ?? "",
            updatedAt: new Date().toISOString(),
        };
        writeTokenCache(cache);
    }

    removeCachedToken() {
        const cache = readTokenCache();
        delete cache[this.cacheKey()];
        writeTokenCache(cache);
        this.token = "";
    }

    async gql(query, variables = {}, token = this.token, allowFail = false) {
        const body = { query, variables };
        const opName = operationName(query);
        if (opName) body.operationName = opName;

        const headers = {
            "content-type": "application/json",
            "x-provider-id": APP.appid,
            Referer: `https://servicewechat.com/${APP.appid}/21/page-frame.html`,
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await request({
            method: "POST",
            url: GQL_URL,
            headers,
            data: body,
        });

        const errors = res.data?.errors || [];
        if ((res.status !== 200 || errors.length) && !allowFail) {
            throw new Error(`GraphQL失败 HTTP ${res.status}: ${short(res.data)}`);
        }
        return res.data;
    }

    async login() {
        const cached = this.getCachedToken();
        if (cached) {
            this.token = cached;
            console.log(`账号[${this.index}] 使用缓存token: ${maskToken(this.token)}`);
            const ok = await this.checkToken();
            if (ok) return;
            console.log(`账号[${this.index}] 缓存token失效，重新登录`);
            this.removeCachedToken();
        }

        const code = await getWxCode(this.server);
        const res = await this.gql(
            `mutation codeLogin($client_id: String! $code: String!) {
                login(client_id: $client_id, code: $code)
            }`,
            { client_id: APP.appid, code },
            "",
            true
        );
        const token = res?.data?.login || "";
        if (!token) throw new Error(`登录未返回token: ${short(res)}`);
        this.token = token;
        console.log(`账号[${this.index}] 登录成功: ${maskToken(this.token)}`);
    }

    async checkToken() {
        const res = await this.gql(
            `query ViewerBalance {
                viewer {
                    uid
                    wallet {
                        points
                    }
                }
            }`,
            {},
            this.token,
            true
        );
        return Boolean(res?.data?.viewer?.uid);
    }

    async queryHome() {
        const res = await this.gql(
            `query home($client_id: String!) {
                viewer {
                    uid
                    wallet {
                        points
                    }
                    todoActivityRecords {
                        id
                        progress
                        rewarded_at
                        completed_at
                        completed_at_today
                        completed_at_yesterday
                        activity {
                            auto_reward
                            button_action
                            full_rules {
                                reward_desc
                                reward_mode
                                reward_type
                                rule_desc
                            }
                            type
                            name
                            need_times
                            id
                            icon
                            description
                            cycle_quota
                            button_name
                            url
                        }
                    }
                }
                socialApp(client_id: $client_id) {
                    name
                    config
                }
            }`,
            { client_id: APP.appid }
        );

        this.viewer = res.data.viewer || {};
        this.socialApp = res.data.socialApp || {};
        const records = this.viewer.todoActivityRecords || [];
        this.checkIn = records.find((item) => item.activity?.name === "每日签到") || null;
        this.videoTask =
            records.find((item) => /视频/.test(item.activity?.name || "") || item.activity?.button_action === "seeVideo") || null;

        console.log(`查询：uid=${this.viewer.uid || "未知"} 米豆=${this.viewer.wallet?.points ?? "未知"} 小程序=${this.socialApp.name || APP.name}`);
        if (this.checkIn) {
            console.log(
                `签到任务：id=${this.checkIn.activity.id} 今日${this.checkIn.completed_at_today ? "已完成" : "未完成"} progress=${this.checkIn.progress}/${this.checkIn.activity.cycle_quota}`
            );
        } else {
            console.log("签到任务：未找到");
        }
        if (this.videoTask) {
            console.log(
                `视频任务：id=${this.videoTask.activity.id} 今日${this.videoTask.completed_at_today ? "已完成" : "未完成"} progress=${this.videoTask.progress}/${this.videoTask.activity.cycle_quota}`
            );
        } else {
            console.log("视频任务：未找到");
        }
    }

    async pointsRecords() {
        const res = await this.gql(
            `query records {
                viewer {
                    pointsRecords(page: 1) {
                        data {
                            amount
                            balance
                            action
                            created_at
                            in_out
                            reward_type
                        }
                    }
                }
            }`,
            {},
            this.token,
            true
        );
        const records = res?.data?.viewer?.pointsRecords?.data || [];
        if (records.length) {
            const text = records
                .slice(0, 5)
                .map((item) => `${item.created_at} ${item.action} ${item.amount} 余额=${item.balance}`)
                .join(" | ");
            console.log(`米豆明细：${text}`);
        }
    }

    async activityPush(activityId, label) {
        const res = await this.gql(
            `mutation activity($activity_id: Int!) {
                activityPush(id: $activity_id) {
                    code
                    message
                    reward_log {
                        action
                        reward_type
                        amount
                        balance
                    }
                }
            }`,
            { activity_id: Number(activityId) },
            this.token,
            true
        );
        const result = res?.data?.activityPush;
        if (!result) return `${label}失败: ${short(res)}`;
        if (Number(result.code) === 0) {
            const log = result.reward_log || {};
            return `${label}成功：${log.action || label} +${log.amount ?? 0}米豆，余额=${log.balance ?? "未知"}`;
        }
        return `${label}失败：${result.message || short(result)}`;
    }

    async doSign() {
        if (!this.checkIn) return "未找到签到任务";
        if (this.checkIn.completed_at_today) return "今日已签到";
        return this.activityPush(this.checkIn.activity.id, "签到");
    }

    async doVideo() {
        if (!this.videoTask) return ["未找到视频任务"];
        const total = Number(this.videoTask.activity?.cycle_quota || 0);
        const progress = Number(this.videoTask.progress || 0);
        const remaining = Math.max(0, total - progress);
        if (!remaining) return ["视频任务今日已完成"];

        const limit = Number(process.env.mimeng_video_times || remaining);
        const times = Math.max(0, Math.min(remaining, Number.isFinite(limit) ? limit : remaining));
        const results = [];
        for (let i = 0; i < times; i++) {
            results.push(await this.activityPush(this.videoTask.activity.id, `视频任务[${i + 1}/${times}]`));
            await await sleep(1200);
        }
        return results;
    }

    async run() {
        await this.login();
        await this.queryHome();
        console.log(`签到：${await this.doSign()}`);
        const videos = await this.doVideo();
        for (const result of videos) console.log(`观看视频：${result}`);
        await this.queryHome();
        await this.pointsRecords();
        this.saveCachedToken();
    }
}

async function runAccount(openid, index) {
    console.log(`\n========== ${APP.name} 账号[${index}] ${openid} ==========`);
    const runner = new Mimeng(openid, index);
    try {
        await runner.run();
    } catch (e) {
        console.log(`账号[${index}] 执行失败：${e.message || e}`);
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
        await runAccount(accounts[i], i + 1);
        await await sleep(800);
    }
    
})().catch(async (e) => {
    console.log(`脚本异常：${e.stack || e.message || e}`);
    
});
