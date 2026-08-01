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

// name: 美的会员
// cron: 0 40 11 * * *
//
// 微信小程序 - 美的会员动态 code 签到版
// APPID: wx49a622805968d156
//
// 功能：
//   1. 四端口获取微信 code
//   2. getLoginInfo.do 使用 code 换登录信息
//   3. 自动探测 uid/sukey cookie
//   4. 自动探测 ucAccessToken
//   5. 执行 signIn / signIn2
//   6. PushPlus 推送
//   7. 品赞代理 + 失败直连兜底
//
// 环境变量：
//   PLUSPLUS_TOKEN   PushPlus token，可选
//   PROXY_API        品赞代理提取 API，可选
//   PROXY_TYPE       http / socks5，默认 http
//
// 依赖：
//   npm install axios http-proxy-agent https-proxy-agent socks-proxy-agent

const axios = require("axios");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { HttpProxyAgent } = require("http-proxy-agent");

delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;

const APPID = "wx49a622805968d156";

// 从环境变量 VX_GO 读取内网 IP，多个 IP 用换行分隔
const SERVERS = (process.env.VX_GO || "")
    .split(/\r?\n|&/)
    .map(s => s.trim())
    .filter(Boolean);

if (!SERVERS.length) {
    console.log("❌ 未配置环境变量 VX_GO，请设置后重试");
    console.log("格式示例：");
    console.log("  VX_GO=127.0.0.1:8088");
    console.log("  或");
    console.log("  VX_GO=127.0.0.1:8088\\n192.168.31.36:8088\\n192.168.31.88:8088");
    process.exit(1);
}

const PLUSPLUS_TOKEN = process.env.PLUSPLUS_TOKEN || "";
const PROXY_API = process.env.PROXY_API || "";
const PROXY_TYPE = (process.env.PROXY_TYPE || "http").toLowerCase();

const PROXY_RETRY_TIMES = 3;
const PROXY_VALIDATE_URL = "http://httpbin.org/ip";
const PROXY_FETCH_INTERVAL = 3000;
const ENABLE_DIRECT_FALLBACK = true;
const REQUEST_TIMEOUT = 30000;

const LOGIN_APP_ID = "ee07f27990db48109efcccd322d3a873";
const LOGIN_APP_SECRET = "2646746f07bb46199aff49002e6dce81";
const LOGIN_API_KEY = "b6db9d5cf2d449538d3a0dd5d77b2e35";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 " +
    "MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI " +
    "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) " +
    "UnifiedPCWindowsWechat(0xf2541938) XWEB/19823";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nowText() {
    return new Date().toLocaleString("zh-CN");
}

function mask(value) {
    value = String(value || "");
    if (value.length <= 12) return value;
    return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function preview(value, limit = 800) {
    try {
        return JSON.stringify(value).slice(0, limit);
    } catch (e) {
        return String(value).slice(0, limit);
    }
}

function logTitle() {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║ 🔷 美的会员动态 code 签到                   ║");
    console.log(`║ 🕒 ${nowText()}`);
    console.log(`║ 🔢 账号数量: ${SERVERS.length}`);
    console.log("╚══════════════════════════════════════════════╝");
}

function logAccount(index, total, server) {
    console.log("\n┌──────────────────────────────────────────────┐");
    console.log(`│ 🧩 账号 ${index} / ${total}`);
    console.log(`│ 🌍 来源 ${server}`);
    console.log("└──────────────────────────────────────────────┘");
}

function parseProxyResponse(text) {
    if (typeof text !== "string") text = JSON.stringify(text);
    text = text.trim();
    if (!text) return null;

    try {
        const data = JSON.parse(text);
        let proxyObj = null;

        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            proxyObj = data.data[0];
        } else if (data.data && typeof data.data === "object") {
            proxyObj = data.data;
        } else if (data.ip && data.port) {
            proxyObj = data;
        } else if (data.result && data.result.ip && data.result.port) {
            proxyObj = data.result;
        }

        if (proxyObj) {
            return {
                host: proxyObj.ip || proxyObj.host,
                port: proxyObj.port,
                username: proxyObj.user || proxyObj.username || "",
                password: proxyObj.pass || proxyObj.password || "",
            };
        }
    } catch (e) {}

    if (text.includes(":")) {
        const parts = text.split(":");
        if (parts.length >= 2) {
            return {
                host: parts[0],
                port: Number(parts[1]),
                username: parts[2] || "",
                password: parts[3] || "",
            };
        }
    }

    return null;
}

function buildProxyAgent(proxyInfo) {
    if (!proxyInfo) return null;

    const { host, port, username, password } = proxyInfo;
    let auth = "";

    if (username && password) {
        auth = `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
    }

    try {
        if (PROXY_TYPE === "socks5") {
            const proxyUrl = `socks5://${auth}${host}:${port}`;
            console.log(`🛠️ [代理] 生成 SOCKS5 代理 ${host}:${port}`);
            return {
                httpAgent: new SocksProxyAgent(proxyUrl),
                httpsAgent: new SocksProxyAgent(proxyUrl),
                proxy: false,
            };
        }

        const proxyUrl = `http://${auth}${host}:${port}`;
        console.log(`🛠️ [代理] 生成 HTTP 代理 ${host}:${port}`);
        return {
            httpAgent: new HttpProxyAgent(proxyUrl),
            httpsAgent: new HttpsProxyAgent(proxyUrl),
            proxy: false,
        };
    } catch (e) {
        console.log(`❌ [代理] 生成代理失败: ${e.message}`);
        return null;
    }
}

async function validateProxy(agent) {
    if (!agent) return { ok: false, ip: "" };

    try {
        const res = await axios({
            method: "get",
            url: PROXY_VALIDATE_URL,
            timeout: 15000,
            ...agent,
        });

        if (res.status === 200) {
            const ip = res.data?.origin || "未知";
            console.log(`✅ [代理] 验证通过，出口 IP: ${ip}`);
            return { ok: true, ip };
        }
    } catch (e) {
        console.log(`⚠️ [代理] 验证失败: ${e.message}`);
    }

    return { ok: false, ip: "" };
}

async function getValidProxy(accountName) {
    if (!PROXY_API) {
        console.log(`⚠️ [代理] ${accountName} 未配置 PROXY_API，使用直连`);
        return { agent: null, ip: "" };
    }

    console.log(`🌐 [代理] ${accountName} 正在获取品赞代理...`);

    for (let i = 1; i <= PROXY_RETRY_TIMES; i++) {
        try {
            const res = await axios.get(PROXY_API, {
                timeout: 15000,
                proxy: false,
            });

            const proxyInfo = parseProxyResponse(res.data);

            if (!proxyInfo) {
                console.log(`⚠️ [代理] 第 ${i} 次代理解析失败`);
                continue;
            }

            console.log(`✅ [代理] 提取到 ${proxyInfo.host}:${proxyInfo.port}`);

            const agent = buildProxyAgent(proxyInfo);
            const valid = await validateProxy(agent);

            if (valid.ok) {
                return { agent, ip: valid.ip };
            }
        } catch (e) {
            console.log(`⚠️ [代理] 第 ${i} 次获取代理异常: ${e.message}`);
        }

        if (i < PROXY_RETRY_TIMES) {
            await sleep(2000);
        }
    }

    console.log("⚠️ [代理] 获取失败，使用直连");
    return { agent: null, ip: "" };
}

async function requestWithProxy(config, proxyAgent, server) {
    if (proxyAgent) {
        try {
            return await axios({
                timeout: REQUEST_TIMEOUT,
                ...config,
                ...proxyAgent,
            });
        } catch (e) {
            console.log(`⚠️ [代理] ${server} 代理请求失败: ${e.message}`);

            if (!ENABLE_DIRECT_FALLBACK) {
                throw e;
            }

            console.log("🔁 [兜底] 切换直连重试");
        }
    }

    return await axios({
        timeout: REQUEST_TIMEOUT,
        proxy: false,
        ...config,
    });
}

async function sendPushPlus(title, content) {
    if (!PLUSPLUS_TOKEN) {
        console.log("⚠️ [PushPlus] 未配置 PLUSPLUS_TOKEN，跳过推送");
        return;
    }

    try {
        await axios.post(
            "https://www.pushplus.plus/send",
            {
                token: PLUSPLUS_TOKEN,
                title,
                content,
                template: "txt",
            },
            {
                timeout: 10000,
                proxy: false,
            }
        );

        console.log("✅ [PushPlus] 推送成功");
    } catch (e) {
        console.log(`❌ [PushPlus] 推送失败: ${e.message}`);
    }
}

function parseYybGoEntry(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return { server: "", ref: "", auth: "" };

    const parts = value.split(/[@#]/);
    if (parts.length < 2) {
        console.log(`❌ [配置] VX_GO 格式应为 地址#微信账号标识[#auth]，当前值: ${value}`);
        return { server: "", ref: "", auth: "" };
    }

    let server = parts[0].trim();
    const ref = parts[1].trim();
    const auth = (parts[2] || "").trim() || (process.env.auth || process.env.AUTH || "").trim();

    if (server.startsWith("http://")) {
        server = server.slice(7);
    } else if (server.startsWith("https://")) {
        server = server.slice(8);
    }
    server = server.replace(/\/+$/, "");

    if (!server || !ref) {
        console.log(`❌ [配置] VX_GO 缺少地址或微信账号标识，当前值: ${value}`);
        return { server: "", ref: "", auth: "" };
    }

    return { server, ref, auth };
}

async function getCode(server) {
    const { server: parsedServer, ref, auth } = parseYybGoEntry(server);
    if (!parsedServer || !ref) return null;

    const url = `http://${parsedServer}/wx/code`;

    try {
        const { data } = await axios.post(url, {
            openid: ref,
            appid: APPID,
            data: {}
        }, {
            timeout: 20000,
            proxy: false,
            headers: auth ? { Authorization: `Bearer ${auth}` } : {}
        });
        const code = data?.data?.code;
        if (data?.code !== 0 || !code) {
            console.log(`❌ ${parsedServer} 获取code失败: ${JSON.stringify(data)}`);
            return null;
        }
        console.log(`✅ ${parsedServer} 获取code成功`);
        return code;
    } catch (e) {
        console.log(`❌ ${parsedServer} 获取code异常: ${e.message}`);
        return null;
    }
}


function findValueDeep(obj, keys) {
    if (!obj || typeof obj !== "object") return null;

    for (const key of keys) {
        if (obj[key]) return obj[key];
    }

    for (const value of Object.values(obj)) {
        if (value && typeof value === "object") {
            const found = findValueDeep(value, keys);
            if (found) return found;
        }
    }

    return null;
}

function extractCookies(headers) {
    const setCookie = headers?.["set-cookie"];
    if (!setCookie) return "";

    const arr = Array.isArray(setCookie) ? setCookie : [setCookie];

    const parts = [];
    for (const item of arr) {
        const first = String(item).split(";")[0];
        if (/^(uid|sukey)=/i.test(first)) {
            parts.push(first);
        }
    }

    return parts.length ? parts.join(";") + ";" : "";
}

function extractLoginInfo(data, headers) {
    const ucAccessToken = findValueDeep(data, [
        "ucAccessToken",
        "accessToken",
        "token",
        "userToken",
        "access_token",
    ]);

    let uid = findValueDeep(data, ["uid", "userId", "userCode"]);
    let sukey = findValueDeep(data, ["sukey", "suKey"]);

    const cookieFromHeader = extractCookies(headers);
    let cookie = cookieFromHeader;

    if (!cookie && uid && sukey) {
        cookie = `uid=${uid};sukey=${sukey};`;
    }

    return {
        ucAccessToken: ucAccessToken ? String(ucAccessToken) : "",
        cookie,
        uid: uid ? String(uid) : "",
        sukey: sukey ? String(sukey) : "",
    };
}

async function loginByCode(code, proxyAgent, server) {
    const config = {
        method: "POST",
        url: "https://mcsp.midea.com/api/cms_bff/mcsp-uc-mvip-bff/app/login/wx/mini/getLoginInfo.do",
        headers: {
            Host: "mcsp.midea.com",
            appId: LOGIN_APP_ID,
            xweb_xhr: "1",
            appsecret: LOGIN_APP_SECRET,
            "User-Agent": UA,
            "Content-Type": "application/json",
            userKey: "",
            "X-Tingyun": "c=M|cJgYzP0tKW8",
            miniAppVersion: "3.0.269",
            apikey: LOGIN_API_KEY,
            Accept: "*/*",
            Referer: `https://servicewechat.com/${APPID}/554/page-frame.html`,
            "Accept-Language": "zh-CN,zh;q=0.9",
        },
        data: {
            jsCode: code,
            loginMode: 1,
            platformType: "WX_MEIDIDAOJIA_MINI",
            _timeStamp: Date.now(),
        },
    };

    console.log("🔐 [登录] 使用 code 获取登录信息");

    try {
        const res = await requestWithProxy(config, proxyAgent, server);
        const data = res.data;

        console.log(`🔎 [登录] 返回字段: ${Object.keys(data || {}).join(", ")}`);
        console.log(`🔎 [登录] 响应预览: ${preview(data, 600)}`);

        const info = extractLoginInfo(data, res.headers);

        if (info.cookie) {
            console.log(`✅ [登录] cookie 获取成功: ${mask(info.cookie)}`);
        } else {
            console.log("⚠️ [登录] 未识别 uid/sukey cookie");
        }

        if (info.ucAccessToken) {
            console.log(`✅ [登录] ucAccessToken 获取成功: ${mask(info.ucAccessToken)}`);
        } else {
            console.log("⚠️ [登录] 未识别 ucAccessToken");
        }

        return {
            ...info,
            raw: data,
            headers: res.headers,
        };
    } catch (e) {
        console.log(`❌ [登录] 请求异常: ${e.message}`);
        return {
            ucAccessToken: "",
            cookie: "",
            uid: "",
            sukey: "",
            raw: null,
            headers: null,
        };
    }
}

async function getUserInfo(cookie, proxyAgent, server) {
    const config = {
        method: "GET",
        url: "https://mvip.midea.cn/next/mucuserinfo/getmucuserinfo",
        headers: {
            Host: "mvip.midea.cn",
            Connection: "keep-alive",
            charset: "utf-8",
            cookie,
            "User-Agent": UA,
            "Content-Type": "application/json",
            Referer: "https://servicewechat.com/wx03925a39ca94b161/409/page-frame.html",
        },
    };

    try {
        const { data } = await requestWithProxy(config, proxyAgent, server);

        if (data?.errcode === 0) {
            const mobile = data?.data?.userinfo?.Mobile || "-";
            const points = data?.data?.userinfo?.VipGrow ?? "-";
            console.log(`💰 [信息] ${mobile} 当前积分: ${points}`);

            return {
                success: true,
                mobile,
                points,
                raw: data,
            };
        }

        console.log(`⚠️ [信息] 查询失败: ${preview(data)}`);

        return {
            success: false,
            mobile: "-",
            points: "-",
            raw: data,
        };
    } catch (e) {
        console.log(`⚠️ [信息] 请求异常: ${e.message}`);
        return {
            success: false,
            mobile: "-",
            points: "-",
            raw: null,
        };
    }
}

async function signIn(cookie, proxyAgent, server) {
    if (!cookie) {
        return {
            success: false,
            message: "未获取到 uid/sukey cookie，跳过签到1",
        };
    }

    const config = {
        method: "GET",
        url: "https://mvip.midea.cn/my/score/create_daily_score",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            cookie,
            "User-Agent": UA,
            Referer: "https://servicewechat.com/wx03925a39ca94b161/409/page-frame.html",
        },
    };

    try {
        const { data } = await requestWithProxy(config, proxyAgent, server);

        if (data?.errcode === 0) {
            console.log("✅ [签到1] 成功");
            return {
                success: true,
                message: "签到1成功",
                raw: data,
            };
        }

        const msg = data?.errmsg || data?.msg || preview(data);
        console.log(`⚠️ [签到1] 失败: ${msg}`);

        return {
            success: false,
            message: msg,
            raw: data,
        };
    } catch (e) {
        console.log(`⚠️ [签到1] 请求异常: ${e.message}`);
        return {
            success: false,
            message: e.message,
            raw: null,
        };
    }
}

async function signIn2(ucAccessToken, proxyAgent, server) {
    if (!ucAccessToken) {
        return {
            success: false,
            message: "未获取到 ucAccessToken，跳过签到2",
        };
    }

    const config = {
        method: "POST",
        url: "https://mvip.midea.cn/mscp_mscp/api/cms_api/activity-center-im-service/im-svr/im/game/page/sign",
        headers: {
            "User-Agent": UA,
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            ucAccessToken,
            intercept: "1",
            apiKey: "3660663068894a0d9fea574c2673f3c0",
            Origin: "https://mvip.midea.cn",
            "X-Requested-With": "com.tencent.mm",
            Referer: "https://mvip.midea.cn/mscp_weixin/apps/h5-pro-wx-interaction-marketing/",
            "Accept-Language": "zh-CN,zh;q=0.9",
        },
        data: {
            headParams: {
                language: "CN",
                originSystem: "MCSP",
                timeZone: "",
                userCode: "",
                tenantCode: "",
                userKey: "TEST_",
                transactionId: "",
            },
            pagination: null,
            restParams: {
                gameId: 22,
                actvId: "401671388248692763",
                rootCode: "MDHY",
                appCode: "MDHY_XCX",
                imUserId: "",
                uid: "",
                openId: "",
                unionId: "",
            },
        },
    };

    try {
        const { data } = await requestWithProxy(config, proxyAgent, server);

        console.log(`✅ [签到2] 返回: ${preview(data, 800)}`);

        return {
            success: true,
            message: "签到2请求完成",
            raw: data,
        };
    } catch (e) {
        console.log(`⚠️ [签到2] 请求异常: ${e.message}`);
        return {
            success: false,
            message: e.message,
            raw: null,
        };
    }
}

async function runAccount(index, total, server) {
    const result = {
        server,
        success: false,
        proxyStatus: "未使用代理",
        proxyIp: "-",
        cookie: "-",
        ucAccessToken: "-",
        mobile: "-",
        beforePoints: "-",
        afterPoints: "-",
        sign1: "-",
        sign2: "-",
        error: "",
    };

    logAccount(index, total, server);

    const proxy = await getValidProxy(server);
    const proxyAgent = proxy.agent;

    result.proxyStatus = proxyAgent ? "使用专属代理" : "使用直连";
    result.proxyIp = proxy.ip || "-";

    await sleep(PROXY_FETCH_INTERVAL);

    const delay = random(2000, 6000);
    console.log(`⏳ [延迟] 启动延迟 ${(delay / 1000).toFixed(1)}s`);
    await sleep(delay);

    const code = await getCode(server);
    if (!code) {
        result.error = "获取 code 失败";
        return result;
    }

    const login = await loginByCode(code, proxyAgent, server);

    result.cookie = login.cookie ? mask(login.cookie) : "-";
    result.ucAccessToken = login.ucAccessToken ? mask(login.ucAccessToken) : "-";

    if (!login.cookie && !login.ucAccessToken) {
        result.error = "未获取到 cookie 和 ucAccessToken";
        return result;
    }

    let before = {
        success: false,
        mobile: "-",
        points: "-",
    };

    if (login.cookie) {
        before = await getUserInfo(login.cookie, proxyAgent, server);
        result.mobile = before.mobile;
        result.beforePoints = before.points;
    }

    await sleep(random(2000, 5000));

    const s1 = await signIn(login.cookie, proxyAgent, server);
    result.sign1 = s1.message;

    await sleep(random(2000, 5000));

    const s2 = await signIn2(login.ucAccessToken, proxyAgent, server);
    result.sign2 = s2.message;

    await sleep(random(2000, 5000));

    if (login.cookie) {
        const after = await getUserInfo(login.cookie, proxyAgent, server);
        result.afterPoints = after.points;
    }

    result.success = Boolean(s1.success || s2.success);

    if (!result.success) {
        result.error = `${result.sign1}; ${result.sign2}`;
    }

    return result;
}

function buildNotify(results) {
    const successCount = results.filter(item => item.success).length;
    const failCount = results.length - successCount;

    let content = `🔷 美的会员四账号签到结果

━━━━━━━━━━━━━━━━━━━━
🏁 总结：${successCount} 成功 / ${failCount} 失败
🕒 时间：${nowText()}
━━━━━━━━━━━━━━━━━━━━
`;

    results.forEach((res, index) => {
        const icon = res.success ? "✅" : "❌";

        content += `
🧩 账号 ${index + 1}
🌍 来源：${res.server}
🌐 代理：${res.proxyStatus}
📡 出口IP：${res.proxyIp}
📱 手机：${res.mobile}
🍪 Cookie：${res.cookie}
🔐 ucAccessToken：${res.ucAccessToken}
💰 签到前积分：${res.beforePoints}
📝 签到1：${res.sign1}
🎮 签到2：${res.sign2}
💰 签到后积分：${res.afterPoints}
${icon} 结果：${res.success ? "成功" : "失败"}
`;

        if (!res.success) {
            content += `❌ 原因：${res.error}\n`;
        }

        content += "━━━━━━━━━━━━━━━━━━━━\n";
    });

    return content;
}

(async () => {
    logTitle();

    const results = [];

    for (let i = 0; i < SERVERS.length; i++) {
        try {
            const res = await runAccount(i + 1, SERVERS.length, SERVERS[i]);
            results.push(res);
        } catch (e) {
            console.log(`❌ [主程序] ${SERVERS[i]} 执行异常: ${e.message}`);

            results.push({
                server: SERVERS[i],
                success: false,
                proxyStatus: "-",
                proxyIp: "-",
                cookie: "-",
                ucAccessToken: "-",
                mobile: "-",
                beforePoints: "-",
                afterPoints: "-",
                sign1: "-",
                sign2: "-",
                error: e.message,
            });
        }

        if (i < SERVERS.length - 1) {
            console.log("⏳ [间隔] 等待 2s 后处理下一个账号");
            await sleep(2000);
        }
    }

    const successCount = results.filter(item => item.success).length;
    const failCount = results.length - successCount;

    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║ 🏁 美的会员任务执行完成                     ║");
    console.log(`║ ✅ 成功: ${successCount}`);
    console.log(`║ ❌ 失败: ${failCount}`);
    console.log(`║ 🕒 ${nowText()}`);
    console.log("╚══════════════════════════════════════════════╝");

    await sendPushPlus("🔷 美的会员四账号签到完成", buildNotify(results));
})().catch(e => {
    console.log(`❌ [全局异常] ${e.message}`);
});
