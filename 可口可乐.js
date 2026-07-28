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

// name: 可口可乐
// cron: 0 20 9 * * *
const axios = require("axios");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { HttpProxyAgent } = require("http-proxy-agent");

delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;

const APPID = "wxa5811e0426a94686";

// 从环境变量 YYB_GO 读取内网服务，多条换行分隔
let SERVERS = [];
const envYybGo = process.env.YYB_GO || "";
if (envYybGo) {
    SERVERS = envYybGo
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
}
// 校验是否存在有效地址
if (SERVERS.length === 0) {
    console.error("❌ 错误：未读取到环境变量 YYB_GO 或无有效IP端口！");
    console.error("配置示例（变量值多条换行填写）：");
    console.error("127.0.0.1:8088");
    console.error("192.168.31.111:8088");
    process.exit(1);
}
console.log(`✅ 成功读取 ${SERVERS.length} 台内网服务：`);
SERVERS.forEach(item => console.log(` - ${item}`));
console.log("----------------------------------------\n");

const PLUSPLUS_TOKEN = process.env.PLUSPLUS_TOKEN || "";

const PROXY_API = process.env.PROXY_API || "";
const PROXY_TYPE = (process.env.PROXY_TYPE || "http").toLowerCase();
const PROXY_RETRY_TIMES = 3;
const PROXY_VALIDATE_URL = "http://httpbin.org/ip";
const PROXY_FETCH_INTERVAL = 3000;
const ENABLE_DIRECT_FALLBACK = true;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541923) XWEB/19823";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mask(value) {
    value = String(value || "");
    if (value.length <= 12) return value;
    return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function logTitle() {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║ 🥤 可口可乐动态 code 签到                   ║");
    console.log(`║ 🕒 ${new Date().toLocaleString("zh-CN")}                 ║`);
    console.log(`║ 🔢 账号数量: ${SERVERS.length}                              ║`);
    console.log("╚══════════════════════════════════════════════╝\n");
}

function logAccount(index, total, server) {
    console.log("\n┌──────────────────────────────────────────────┐");
    console.log(`│ 🧩 账号 ${index} / ${total}`);
    console.log(`│ 🌍 来源 ${server}`);
    console.log("└──────────────────────────────────────────────┘");
}

function parseProxyResponse(text) {
    if (typeof text !== "string") {
        text = JSON.stringify(text);
    }

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
                password: proxyObj.pass || proxyObj.password || ""
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
                password: parts[3] || ""
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
                httpsAgent: new SocksProxyAgent(proxyUrl)
            };
        }

        const proxyUrl = `http://${auth}${host}:${port}`;
        console.log(`🛠️ [代理] 生成 HTTP 代理 ${host}:${port}`);
        return {
            httpAgent: new HttpProxyAgent(proxyUrl),
            httpsAgent: new HttpsProxyAgent(proxyUrl)
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
            ...agent
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
                proxy: false
            });

            const proxyInfo = parseProxyResponse(res.data);

            if (!proxyInfo) {
                console.log(`⚠️ [代理] 第 ${i} 次解析失败`);
                continue;
            }

            console.log(`✅ [代理] 提取到 ${proxyInfo.host}:${proxyInfo.port}`);

            const agent = buildProxyAgent(proxyInfo);
            const valid = await validateProxy(agent);

            if (valid.ok) {
                return { agent, ip: valid.ip };
            }
        } catch (e) {
            console.log(`⚠️ [代理] 第 ${i} 次获取异常: ${e.message}`);
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
                timeout: 30000,
                ...config,
                ...proxyAgent
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
        timeout: 30000,
        proxy: false,
        ...config
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
                template: "txt"
            },
            {
                timeout: 10000,
                proxy: false
            }
        );

        console.log("✅ [PushPlus] 推送成功");
    } catch (e) {
        console.log(`❌ [PushPlus] 推送失败: ${e.message}`);
    }
}

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


async function getUserToken(code, proxyAgent, server) {
    const config = {
        method: "GET",
        url: `https://member-api.icoke.cn/api/sp-portal/store/icoke/wechat/loginNoCache/${code}`,
        headers: {
            "User-Agent": UA,
            "Accept": "application/json, text/plain, */*",
            "xweb_xhr": "1",
            "Content-Type": "application/json",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Referer": "https://servicewechat.com/wxa5811e0426a94686/496/page-frame.html",
            "Accept-Language": "zh-CN,zh;q=0.9"
        }
    };

    try {
        const { data } = await requestWithProxy(config, proxyAgent, server);

        if (data?.jwtString) {
            console.log(`✅ [登录] token 获取成功: ${mask(data.jwtString)}`);
            return {
                token: data.jwtString,
                raw: data
            };
        }

        console.log(`❌ [登录] token 获取失败: ${data?.message || JSON.stringify(data)}`);
        return {
            token: null,
            raw: data
        };
    } catch (e) {
        console.log(`❌ [登录] token 请求异常: ${e.message}`);
        return {
            token: null,
            raw: null
        };
    }
}

async function getUserInfo(token, proxyAgent, server) {
    const config = {
        method: "GET",
        url: "https://member-api.icoke.cn/api/icoke-customer/icoke/mini/customer/main/points",
        headers: {
            "accept": "application/json, text/plain, */*",
            "accept-language": "zh-CN,zh;q=0.9",
            "authorization": token,
            "content-type": "application/json",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "xweb_xhr": "1",
            "Referer": "https://servicewechat.com/wxa5811e0426a94686/421/page-frame.html",
            "Referrer-Policy": "unsafe-url"
        }
    };

    try {
        const { data } = await requestWithProxy(config, proxyAgent, server);
        console.log(`💰 [积分] 当前快乐瓶: ${data?.point ?? "-"}`);
        return data;
    } catch (e) {
        console.log(`⚠️ [积分] 查询异常: ${e.message}`);
        return null;
    }
}

async function addSign(token, proxyAgent, server) {
    const config = {
        method: "GET",
        url: "https://member-api.icoke.cn/api/icoke-sign/icoke/mini/sign/main/sign",
        headers: {
            "accept": "application/json, text/plain, */*",
            "accept-language": "zh-CN,zh;q=0.9",
            "authorization": token,
            "content-type": "application/json",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "xweb_xhr": "1",
            "Referer": "https://servicewechat.com/wxa5811e0426a94686/421/page-frame.html",
            "Referrer-Policy": "unsafe-url"
        }
    };

    try {
        const { data } = await requestWithProxy(config, proxyAgent, server);

        if (data?.success === true) {
            const msg = `签到成功，获得 ${data.point ?? "-"} 快乐瓶`;
            console.log(`✅ [签到] ${msg}`);
            return {
                success: true,
                message: msg,
                raw: data
            };
        }

        const msg = data?.message || data?.msg || JSON.stringify(data);
        console.log(`❌ [签到] 签到失败: ${msg}`);

        return {
            success: false,
            message: msg,
            raw: data
        };
    } catch (e) {
        console.log(`❌ [签到] 请求异常: ${e.message}`);
        return {
            success: false,
            message: e.message,
            raw: null
        };
    }
}

async function runAccount(index, total, server) {
    const result = {
        server,
        success: false,
        proxyStatus: "未使用代理",
        proxyIp: "-",
        token: "-",
        beforePoint: "-",
        signMsg: "-",
        afterPoint: "-",
        error: ""
    };

    logAccount(index, total, server);

    const proxy = await getValidProxy(server);
    const proxyAgent = proxy.agent;
    result.proxyStatus = proxyAgent ? "使用专属代理" : "使用直连";
    result.proxyIp = proxy.ip || "-";

    await sleep(PROXY_FETCH_INTERVAL);

    const delay = random(500, 1000);
    console.log(`⏳ [延迟] 启动延迟 ${(delay / 1000).toFixed(1)}s`);
    await sleep(delay);

    const code = await getCode(server);
    if (!code) {
        result.error = "获取 code 失败";
        return result;
    }

    const login = await getUserToken(code, proxyAgent, server);
    if (!login.token) {
        result.error = "获取 token 失败";
        return result;
    }

    result.token = mask(login.token);

    const beforeInfo = await getUserInfo(login.token, proxyAgent, server);
    result.beforePoint = beforeInfo?.point ?? "-";

    await sleep(random(2000, 5000));

    const sign = await addSign(login.token, proxyAgent, server);
    result.signMsg = sign.message;

    await sleep(random(2000, 5000));

    const afterInfo = await getUserInfo(login.token, proxyAgent, server);
    result.afterPoint = afterInfo?.point ?? "-";

    result.success = sign.success || String(sign.message).includes("已") || String(sign.message).includes("重复");

    if (!result.success) {
        result.error = sign.message;
    }

    return result;
}

function buildNotify(results) {
    const successCount = results.filter(item => item.success).length;
    const failCount = results.length - successCount;

    let content = `🥤 可口可乐多账号签到结果

━━━━━━━━━━━━━━━━━━━━
🏁 总结：${successCount} 成功 / ${failCount} 失败
🕒 时间：${new Date().toLocaleString("zh-CN")}
━━━━━━━━━━━━━━━━━━━━
`;

    results.forEach((res, index) => {
        const icon = res.success ? "✅" : "❌";

        content += `
🧩 账号 ${index + 1}
🌍 来源：${res.server}
🌐 代理：${res.proxyStatus}
📡 出口IP：${res.proxyIp}
🔐 Token：${res.token}
💰 签到前快乐瓶：${res.beforePoint}
📝 签到结果：${res.signMsg}
💰 签到后快乐瓶：${res.afterPoint}
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
                token: "-",
                beforePoint: "-",
                signMsg: "-",
                afterPoint: "-",
                error: e.message
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
    console.log("║ 🏁 可口可乐任务执行完成                     ║");
    console.log(`║ ✅ 成功: ${successCount}`);
    console.log(`║ ❌ 失败: ${failCount}`);
    console.log(`║ 🕒 ${new Date().toLocaleString("zh-CN")}`);
    console.log("╚══════════════════════════════════════════════╝");

    await sendPushPlus("🥤 可口可乐多账号签到完成", buildNotify(results));
})().catch(e => {
    console.log(`❌ [全局异常] ${e.message}`);
});
