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

// name: 三得利
// cron: 0 20 8 * * *
const axios = require("axios");
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

// 强制全局禁用系统代理环境变量，避免干扰
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;

// ===================== 配置项 =====================
// PushPlus 通知Token（青龙环境变量）
const PLUSPLUS_TOKEN = process.env.PLUSPLUS_TOKEN || "";

// 从环境变量 YYB_GO 读取内网服务器，支持换行分隔多个IP:端口
let SERVERS = [];
if (process.env.YYB_GO) {
    SERVERS = process.env.YYB_GO
        .split(/\r?\n/) // 兼容Windows换行\r\n、Linux换行\n
        .map(item => item.trim())
        .filter(item => item.length > 0); // 过滤空行、纯空格行
}
// 校验服务器列表，无配置直接终止脚本
if (SERVERS.length === 0) {
    console.error("❌ 未读取到环境变量 YYB_GO，请配置 YYB_GO，多个地址换行填写，格式示例：");
    console.error("192.168.1.21:8088\n192.168.31.111:8088");
    process.exit(1);
}
console.log(`✅ 成功读取 ${SERVERS.length} 台内网服务器：\n${SERVERS.join("\n")}`);

// 品赞代理配置（青龙环境变量）
const PROXY_API = process.env.PROXY_API || ""; // 代理提取API链接
const PROXY_TYPE = process.env.PROXY_TYPE || "http"; // 代理类型: http 或 socks5
const PROXY_RETRY_TIMES = 3; // 单个账号代理获取重试次数
const PROXY_VALIDATE_URL = "http://httpbin.org/ip"; // 代理验证地址
// 核心开关：每个账号独立获取专属代理（true=每个账号一个新IP，false=所有账号共用一个IP）
const ENABLE_PER_ACCOUNT_PROXY = true;
// 账号间代理获取间隔（毫秒，避免频繁调用代理API被限流）
const PROXY_FETCH_INTERVAL = 3000;
// 兜底开关：代理请求失败后，自动切换直连重试
const ENABLE_DIRECT_FALLBACK = true;

// 固定配置
const APPID = "wxb33ed03c6c715482";

// UA池（随机一个）
const USER_AGENT_LIST = [
    "Mozilla/5.0 (Linux; Android 14; 2512BPNDAC Build/UKQ1.230917.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.153 Mobile Safari/537.36 XWEB/1460043 MMWEBSDK/20251006 MiniProgramEnv/android",
    "Mozilla/5.0 (Linux; Android 13; Redmi K60 Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 XWEB/1300003 MMWEBSDK/20250901 MiniProgramEnv/android",
    "Mozilla/5.0 (Linux; Android 12; MI 11 Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.111 Mobile Safari/537.36 XWEB/1250002 MMWEBSDK/20250801 MiniProgramEnv/android",
    "Mozilla/5.0 (Linux; Android 14; Honor Magic6 Build/UP1.240507.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/145.0.7560.128 Mobile Safari/537.36 XWEB/1450004 MMWEBSDK/20251001 MiniProgramEnv/android"
];

// ===================== 工具函数 =====================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getUA() {
    return USER_AGENT_LIST[Math.floor(Math.random() * USER_AGENT_LIST.length)];
}

// ====================== 品赞IP代理系统（每个账号独立获取）======================
// 解析代理API响应（支持品赞等多种格式）
function parseProxyResponse(text) {
    text = text.trim();
    if (!text) return null;

    try {
        const data = JSON.parse(text);
        let proxyObj = null;
        
        // 品赞标准格式
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            proxyObj = data.data[0];
        } 
        // 普通JSON格式
        else if (data.ip && data.port) {
            proxyObj = data;
        }
        // 嵌套格式
        else if (data.result && data.result.ip && data.result.port) {
            proxyObj = data.result;
        }

        if (proxyObj) {
            return {
                host: proxyObj.ip,
                port: proxyObj.port,
                username: proxyObj.user || proxyObj.username || "",
                password: proxyObj.pass || proxyObj.password || ""
            };
        }
    } catch (e) {}

    // 纯文本格式 ip:port 或 ip:port:user:pass
    if (text.includes(":")) {
        const parts = text.split(":");
        if (parts.length >= 2) {
            return {
                host: parts[0],
                port: parseInt(parts[1]),
                username: parts[2] || "",
                password: parts[3] || ""
            };
        }
    }

    return null;
}

// 生成代理Agent（支持HTTP/SOCKS5）
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
            console.log(`🔧 生成SOCKS5代理：socks5://${auth}${host}:${port}`);
            return {
                httpAgent: new SocksProxyAgent(proxyUrl),
                httpsAgent: new SocksProxyAgent(proxyUrl)
            };
        } else {
            // HTTP/HTTPS代理
            const httpProxyUrl = `http://${auth}${host}:${port}`;
            const httpsProxyUrl = `http://${auth}${host}:${port}`;
            console.log(`🔧 生成HTTP代理：${httpProxyUrl}`);
            return {
                httpAgent: new HttpProxyAgent(httpProxyUrl),
                httpsAgent: new HttpsProxyAgent(httpsProxyUrl)
            };
        }
    } catch (e) {
        console.log(`❌ 生成代理Agent失败：${e.message}`);
        return null;
    }
}

// 验证代理是否可用
async function validateProxy(agent) {
    if (!agent) return false;
    try {
        const axiosConfig = {
            method: "get",
            url: PROXY_VALIDATE_URL,
            timeout: 15000,
            ...agent,
            maxRedirects: 5
        };
        const response = await axios(axiosConfig);
        const isSuccess = response.status === 200;
        if (isSuccess) {
            console.log(`✅ 代理验证通过，出口IP：${response.data?.origin || "未知"}`);
        }
        return isSuccess;
    } catch (e) {
        console.log(`⚠️ 代理验证失败，原因：${e.message}`);
        return false;
    }
}

// 获取有效代理（每个账号独立调用）
async function getValidProxy(accountName) {
    if (!PROXY_API) {
        console.log(`ℹ️ [${accountName}] 未配置代理API，使用直连`);
        return null;
    }

    console.log(`🔌 [${accountName}] 正在从品赞API获取专属代理 (${PROXY_TYPE})...`);
    
    for (let i = 0; i < PROXY_RETRY_TIMES; i++) {
        try {
            // 获取代理API用直连，避免循环依赖
            const response = await axios.get(PROXY_API, { 
                timeout: 15000,
                proxy: false
            });
            const proxyInfo = parseProxyResponse(response.data);
            
            if (!proxyInfo) {
                console.log(`⚠️ [${accountName}] 第${i+1}次获取代理失败：响应格式无法解析`);
                continue;
            }

            console.log(`✅ [${accountName}] 提取到专属代理：${proxyInfo.host}:${proxyInfo.port}`);
            
            // 生成代理Agent并验证
            const agent = buildProxyAgent(proxyInfo);
            const isValid = await validateProxy(agent);
            if (isValid) {
                return agent;
            } else {
                console.log(`⚠️ [${accountName}] 第${i+1}次获取的代理不可用，正在重试...`);
            }
        } catch (e) {
            console.log(`⚠️ [${accountName}] 第${i+1}次获取代理异常：${e.message}`);
        }
        
        if (i < PROXY_RETRY_TIMES - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log(`❌ [${accountName}] 连续多次获取代理失败，使用直连`);
    return null;
}

// 为业务请求添加代理配置
function addProxyToAxiosConfig(axiosConfig, proxyAgent) {
    if (!proxyAgent) return axiosConfig;
    return {
        ...axiosConfig,
        ...proxyAgent,
        timeout: axiosConfig.timeout || 20000
    };
}

// ===================== PushPlus通知函数 =====================
async function sendPlusPlusNotification(title, content) {
    if (!PLUSPLUS_TOKEN) return;
    try {
        await axios.post("https://www.pushplus.plus/send", {
            token: PLUSPLUS_TOKEN,
            title: title,
            content: content,
            template: "txt"
        }, { timeout: 5000 });
        console.log("✅ 通知推送成功");
    } catch (e) {
        console.log("❌ 通知推送失败：", e.message);
    }
}

// ===================== 业务逻辑函数 =====================
// 获取code 【强制直连，不走代理】
function parseYybGoEntry(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return { server: "", ref: "" };

    const atIndex = value.indexOf("@");
    if (atIndex === -1) {
        console.log(`❌ [配置] YYB_GO 格式应为 地址@微信账号标识，当前值: ${value}`);
        return { server: "", ref: "" };
    }

    let server = value.slice(0, atIndex).trim();
    const ref = value.slice(atIndex + 1).trim();

    if (server.startsWith("http://")) {
        server = server.slice(7);
    } else if (server.startsWith("https://")) {
        server = server.slice(8);
    }
    server = server.replace(/\/+$/, "");

    if (!server || !ref) {
        console.log(`❌ [配置] YYB_GO 缺少地址或微信账号标识，当前值: ${value}`);
        return { server: "", ref: "" };
    }

    return { server, ref };
}

async function getCode(server) {
    const { server: parsedServer, ref } = parseYybGoEntry(server);
    if (!parsedServer || !ref) return null;

    const url = `http://${parsedServer}/wxapp/getCode`;

    try {
        const { data } = await axios.post(url, {
            ref,
            app_id: APPID
        }, {
            timeout: 20000,
            proxy: false
        });
        const code = data?.data?.result?.code;
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


// 登录 【走代理+直连兜底】
async function wxLogin(jsCode, UA, proxyAgent, server) {
    const baseConfig = {
        method: 'post',
        url: 'https://xiaodian.miyatech.com/api/user/login/wx-jc',
        headers: {
            'content-type': 'application/json;charset=UTF-8',
            'HH-FROM': '20230130307725',
            'HH-APP': APPID,
            'HH-VERSION': '0.6.1',
            'X-VERSION': '2.3.5',
            'HH-CI': 'saas-wechat-app',
            'appPublishType': '1',
            'componentSend': '1',
            'User-Agent': UA,
            'Referer': `https://servicewechat.com/${APPID}/72/page-frame.html`
        },
        data: {
            jsCode: jsCode,
            clientId: "saas-wechat-app",
            myUnionId: "",
            appPublishType: 1
        },
        timeout: 20000
    };

    try {
        let response = null;
        // 优先代理
        if (proxyAgent) {
            console.log(`🌐 [${server}] 正在使用专属代理发起登录请求...`);
            try {
                response = await axios(addProxyToAxiosConfig(baseConfig, proxyAgent));
            } catch (e) {
                console.log(`⚠️ [${server}] 代理登录失败，切换直连重试...`);
                response = await axios({ ...baseConfig, proxy: false });
            }
        } else {
            response = await axios({ ...baseConfig, proxy: false });
        }

        return response.data;
    } catch (e) {
        console.log(`❌ [${server}] 登录异常: ${e.message}`);
        return null;
    }
}

// 通用请求 【走代理+直连兜底】
async function commonPost(url, body, token, UA, proxyAgent, server) {
    const baseConfig = {
        method: 'post',
        url: `https://xiaodian.miyatech.com/api${url}`,
        headers: {
            'content-type': 'application/json;charset=UTF-8',
            'HH-FROM': '20230130307725',
            'HH-APP': APPID,
            'HH-VERSION': '0.6.1',
            'X-VERSION': '2.3.5',
            'HH-CI': 'saas-wechat-app',
            'appPublishType': '1',
            'componentSend': '1',
            'User-Agent': UA,
            'Referer': `https://servicewechat.com/${APPID}/72/page-frame.html`,
            'Authorization': `Bearer ${token}`
        },
        data: body,
        timeout: 20000
    };

    try {
        let response = null;
        // 优先代理
        if (proxyAgent) {
            try {
                response = await axios(addProxyToAxiosConfig(baseConfig, proxyAgent));
            } catch (e) {
                console.log(`⚠️ [${server}] 代理请求失败，切换直连重试...`);
                response = await axios({ ...baseConfig, proxy: false });
            }
        } else {
            response = await axios({ ...baseConfig, proxy: false });
        }

        return response.data;
    } catch (e) {
        console.log(`❌ [${server}] 请求异常: ${e.message}`);
        return null;
    }
}

// 单个账号执行逻辑
async function runAccount(server, globalProxyAgent) {
    let result = {
        server: server,
        success: false,
        signMsg: "",
        collectMsg: "",
        score: 0,
        error: "",
        proxyStatus: "未使用代理"
    };

    console.log(`\n===== 三得利 - ${server} 账号 =====`);
    const UA = getUA();

    // 核心逻辑：每个账号独立获取专属代理
    let proxyAgent = globalProxyAgent;
    if (ENABLE_PER_ACCOUNT_PROXY) {
        proxyAgent = await getValidProxy(server);
        result.proxyStatus = proxyAgent ? "使用专属代理" : "使用直连";
        // 代理获取后加间隔，避免频繁请求
        await sleep(PROXY_FETCH_INTERVAL);
    }

    try {
        // 启动延迟（防风控）
        let startDelay = random(2000, 6000);
        console.log(`⏳ [${server}] 启动延迟 ${startDelay / 1000}s`);
        await sleep(startDelay);

        // 1️⃣ 获取code
        let code = await getCode(server);
        if (!code) {
            result.error = "获取code失败";
            console.log(`❌ [${server}] 获取code失败`);
            return result;
        }

        // 2️⃣ 登录获取token
        let login = await wxLogin(code, UA, proxyAgent, server);
        if (!login || login.code != 200) {
            result.error = login?.msg || "登录失败";
            console.log(`❌ [${server}] 登录失败：${login?.msg || "未知错误"}`);
            return result;
        }

        let token = login.data.tokenInfo.access_token;
        console.log(`✅ [${server}] 登录成功`);
        await sleep(random(3000, 8000));

        // 3️⃣ 签到
        let sign = await commonPost('/coupon/auth/signIn', {"miniappId":159}, token, UA, proxyAgent, server);
        if (sign?.code == 200) {
            result.signMsg = `签到成功：${sign.data.integralToastText}`;
            console.log(`✅ [${server}] 签到成功：${sign.data.integralToastText}`);
        } else {
            result.signMsg = `签到失败：${sign?.msg || "未知错误"}`;
            console.log(`❌ [${server}] 签到失败：${sign?.msg || "未知错误"}`);
        }
        await sleep(random(2000, 5000));

        // 4️⃣ 收藏
        let save = await commonPost('/user/auth/user/collect/record/save', {"sceneValue":"1104"}, token, UA, proxyAgent, server);
        if (save?.code == 200) {
            result.collectMsg = `收藏成功：${save.data.integralToastText}`;
            console.log(`✅ [${server}] 收藏成功：${save.data.integralToastText}`);
        } else {
            result.collectMsg = `收藏失败：${save?.msg || "未知错误"}`;
            console.log(`❌ [${server}] 收藏失败：${save?.msg || "未知错误"}`);
        }
        await sleep(random(2000, 5000));

        // 5️⃣ 查询积分
        let info = await commonPost('/user/member/info', {}, token, UA, proxyAgent, server);
        result.score = info?.data?.currentScore || 0;
        console.log(`🎯 [${server}] 当前积分：${result.score}`);

        result.success = true;
        console.log(`✅ [${server}] 账号执行完成`);

    } catch (e) {
        result.error = e.message;
        console.log(`❌ [${server}] 执行异常：`, e.message);
    }

    return result;
}

// ===================== 主程序 =====================
(async () => {
    console.log('===== 三得利动态code签到（环境变量YYB_GO读取内网+双端口+每个账号独立代理版）=====\n');

    // 兼容旧逻辑：如果关闭了单账号代理，就全局获取一个共用代理
    let globalProxyAgent = null;
    if (!ENABLE_PER_ACCOUNT_PROXY) {
        globalProxyAgent = await getValidProxy("全局共用");
    }

    const results = [];
    // 顺序执行所有服务器
    for (const server of SERVERS) {
        const res = await runAccount(server, globalProxyAgent);
        results.push(res);
        // 账号间间隔2秒
        await sleep(2000);
    }

    // 汇总结果并推送通知
    let notifyContent = "### 三得利多账号任务执行结果\n";
    results.forEach(res => {
        notifyContent += `\n#### ${res.server}
- 代理状态：${res.proxyStatus}
- 执行状态：${res.success ? "成功" : "失败"}
`;
        if (res.success) {
            notifyContent += `- 签到结果：${res.signMsg}
- 收藏结果：${res.collectMsg}
- 当前积分：${res.score}分
`;
        } else {
            notifyContent += `- 失败原因：${res.error}
`;
        }
    });

    await sendPlusPlusNotification("三得利多账号任务完成", notifyContent);
    console.log('\n===== 所有账号执行完成 =====');
})();
