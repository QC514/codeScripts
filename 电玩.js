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
    for (const name of displayNames.values()) {
      const prefix = `[${name}]`;
      if (text.startsWith(prefix)) {
        text = `${name} ${text.slice(prefix.length).trim()}`.trim();
        break;
      }
    }
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

// name: 电玩
// cron: 51 9 * * *

const axios = require("axios");
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
async function getCode(server, appid) {
    const { server: parsedServer, ref } = parseYybGoEntry(server);
    if (!parsedServer || !ref) return null;
    const url = "http://" + parsedServer + "/wxapp/getCode";
    try {
        const { data } = await axios.post(url, { ref, app_id: appid || 'wxf133aa0a4f191ffc' }, { timeout: 20000, proxy: false });
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

const CK_NAME = "ykb_all";
const API_BASE = "https://pw.gzych.vip";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "ykb_all_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

const APPS = [
    { ck: "ayldf", name: "爱游乐东方", appid: "wxf133aa0a4f191ffc", templateVersion: "game_2.32.0" },
    { ck: "ayljz", name: "爱游乐胶州", appid: "wx52005ba8c71a756a", templateVersion: "game_2.32.0" },
    { ck: "aylpld", name: "爱游乐蓬莱店", appid: "wxb4afba83d5ceadae", templateVersion: "game_2.31.0" },
    { ck: "bbwjtqzylzx", name: "宝贝王家庭亲子娱乐中心", appid: "wx61935615c3edb2d0", templateVersion: "game_2.24.3" },
    { ck: "bbwcqncly", name: "宝贝王重庆南川乐园", appid: "wx8fef16e51ca130db", templateVersion: "game_2.15.1" },
    { ck: "bbwhhxp", name: "宝贝王怀化溆浦店", appid: "wxbb9a887cca8663c2", templateVersion: "game_2.30.4" },
    { ck: "cwkjjtyl", name: "超玩空间家庭娱乐", appid: "wx1c59744a3a6ffef8", templateVersion: "game_2.30.4" },
    { ck: "dewbl", name: "第e玩+宝龙店", appid: "wx88fd603ba1ae66a2", templateVersion: "game_2.33.7" },
    { ck: "dlbfhx", name: "大连缤纷幻想", appid: "wx78b4c1140cefdcb0", templateVersion: "game_2.30.1" },
    { ck: "ddmxly", name: "迪迪冒险乐园", appid: "wxcd4a69c8c70a5419", templateVersion: "game_2.15.1" },
    { ck: "ddmxlyjzd", name: "迪迪冒险乐园玖洲道店", appid: "wx70dceb5a4f6daa56", templateVersion: "game_2.15.1" },
    { ck: "dqjtyl", name: "豆趣家庭娱乐中心", appid: "wxc9a77835500632bc", templateVersion: "game_2.23.3" },
    { ck: "fcgxmcws", name: "防城港星梦潮玩社", appid: "wx6683f77a42e1595e", templateVersion: "game_2.30.4" },
    { ck: "fckwjnhdmly", name: "丰城市酷玩嘉年华动漫乐园", appid: "wxb8739c52e9702339", templateVersion: "game_2.20.6" },
    { ck: "fmwg", name: "飞马王国", appid: "wx9703d60d09a566e7", templateVersion: "game_2.15.1" },
    { ck: "fxjnh", name: "纷享X嘉年华", appid: "wxcdbcf18be89c4d47", templateVersion: "game_2.15.1" },
    { ck: "hblytx", name: "湖北乐游天下", appid: "wxf65bcc2eb8c4eeff", templateVersion: "game_2.16.1" },
    { ck: "hlsglc", name: "欢乐拾光乐昌店", appid: "wx5f972a9b4cd13634", templateVersion: "game_2.24.6" },
    { ck: "jddzdtw", name: "机动地带电玩城", appid: "wx0e5c8715d36d15e6", templateVersion: "game_2.30.4" },
    { ck: "jqdw", name: "鲸奇电玩中心", appid: "wxa6dc5cc49b137460", templateVersion: "game_2.30.1" },
    { ck: "jsdwj", name: "九顺大玩家", appid: "wxf99906d27f33fc1d", templateVersion: "game_2.30.2" },
    { ck: "kwkjshhqg", name: "酷玩空间上海环球港店", appid: "wxb08bbd1dd73a27ab", templateVersion: "game_2.32.0" },
    { ck: "kwkjshsjh", name: "酷玩空间上海世纪汇店", appid: "wxd1ca01877cfd33eb", templateVersion: "game_2.33.3" },
    { ck: "kwxqjbel", name: "酷玩猩球金宝二楼店", appid: "wx405ee9e38f6a2038", templateVersion: "game_2.30.2" },
    { ck: "kwxqjbsl", name: "酷玩猩球金宝三楼店", appid: "wxf79a0dc11791d955", templateVersion: "game_2.30.4" },
    { ck: "lmrjxdqxg", name: "蓝梦日记炫动柒栖谷店", appid: "wxa23df268c16943d7", templateVersion: "game_2.33.5" },
    { ck: "lqclnd", name: "乐其城柳南店", appid: "wx25a19136c041f337", templateVersion: "game_2.33.7" },
    { ck: "lqcwgcd", name: "乐其潮玩广场店", appid: "wx1f4ee737668cf5a1", templateVersion: "game_2.33.7" },
    { ck: "lqcwyl", name: "乐其潮玩玉林店", appid: "wxf0e4c545914bd807", templateVersion: "game_2.33.7" },
    { ck: "lzsczqcjl", name: "柳州市城中区超级乐", appid: "wxd4521567cc4b39c0", templateVersion: "game_2.33.7" },
    { ck: "mhdcwdw", name: "梦幻岛潮玩电玩", appid: "wx226c9fbd60679a74", templateVersion: "game_2.15.1" },
    { ck: "mhelhyzhd", name: "萌孩儿乐园海洋振华店", appid: "wx420705aa0369e3f9", templateVersion: "game_2.28.0" },
    { ck: "mqyyc", name: "米其游艺城", appid: "wx0ce00dae4a87ad54", templateVersion: "game_2.30.1" },
    { ck: "mcyxcw", name: "麻涌嬉游潮玩家庭娱乐中心", appid: "wx4d303dc69f029e4e", templateVersion: "game_2.30.2" },
    { ck: "mydyl", name: "梦游岛娱乐", appid: "wxb7ad7be346c73a5e", templateVersion: "game_2.30.4" },
    { ck: "phtkzcwy", name: "平湖天空之城吾悦", appid: "wx387274288d2dcbc2", templateVersion: "game_2.15.1" },
    { ck: "ppxjtczly", name: "派派星家庭成长乐园", appid: "wxce55874aeb73adc2", templateVersion: "game_2.30.4" },
    { ck: "qqyydmly", name: "奇奇游艺动漫乐园", appid: "wx17446921ce05b350", templateVersion: "game_2.24.5" },
    { ck: "qqyyly", name: "奇奇游艺乐园", appid: "wx1cb50cac06c8f487", templateVersion: "game_2.30.1" },
    { ck: "rdsgdlhq", name: "热带时光大沥黄岐店", appid: "wxb1993ab85850dc69", templateVersion: "game_2.30.4" },
    { ck: "rdsghp", name: "热带时光黄埔店", appid: "wxa5ad3ec98ea33db0", templateVersion: "game_2.30.1" },
    { ck: "rdsgsz", name: "热带时光家庭娱乐中心深圳店", appid: "wxc6b29b0eaf5331b8", templateVersion: "game_2.27.0" },
    { ck: "sgcwly", name: "拾光潮玩乐园", appid: "wxbffd1cdbe3f11d33", templateVersion: "game_2.23.3" },
    { ck: "sgsscw", name: "拾光松鼠潮玩店", appid: "wx2823161452551c9e", templateVersion: "game_2.29.3" },
    { ck: "tdxly", name: "泰迪熊乐园", appid: "wx5cfc933a4a2a93f4", templateVersion: "game_2.30.2" },
    { ck: "topwjycccpark", name: "TOP玩家 银川cc park店", appid: "wxc86c913d8d9a4ab4", templateVersion: "game_2.15.1" },
    { ck: "wjfb", name: "玩家风暴", appid: "wx27625bb2d9a8384e", templateVersion: "game_2.15.1" },
    { ck: "xjddw", name: "X机地电玩", appid: "wx1652d4e11cc0a1c2", templateVersion: "game_2.23.3" },
    { ck: "xcdwhtgcd", name: "猩潮电玩恒天广场店", appid: "wx2ad6d80d65b237af", templateVersion: "game_2.19.3" },
    { ck: "xnhhwdbbw", name: "西宁海湖万达宝贝王", appid: "wx7a3335dc207999f3", templateVersion: "game_2.27.0" },
    { ck: "xqlddylc", name: "享区乐到底游乐场", appid: "wx070d007b211099d9", templateVersion: "game_2.24.5" },
    { ck: "ybxwcw", name: "月伴星玩潮玩店", appid: "wxb5e0812b9a0ccc8c", templateVersion: "game_2.30.4" },
    { ck: "ykb", name: "太空橙电玩城", appid: "wxcd8a2d92245ee75b", templateVersion: "game_2.30.4" },
    { ck: "ylsyzqqjwlc", name: "玉林市玉州区奇迹未来城潮漫电玩", appid: "wx4e02b4d9520d6df1", templateVersion: "game_2.28.0" },
    { ck: "ylycmdwd", name: "壹零壹潮漫电玩店", appid: "wx49deb1f94bab5091", templateVersion: "game_2.30.4" },
    { ck: "yyhwqldcw", name: "酉阳红卫桥乐动潮玩", appid: "wx263d7c4bbca7feca", templateVersion: "game_2.30.2" },
    { ck: "zbbbwl", name: "重百宝贝王乐园", appid: "wx9dc5d73cb2d62bdc", templateVersion: "game_2.30.4" },
    { ck: "zjmxwt", name: "终极梦想沃特", appid: "wx733a59c79a4bb702", templateVersion: "game_2.31.0" },
].map((app) => ({
    apiBase: process.env[`${app.ck}_api_base`] || API_BASE,
    wechatVersion: process.env[`${app.ck}_wechat_version`] || "3.9.12",
    mobilePlatform: process.env[`${app.ck}_mobile_platform`] || "windows",
    ...app,
    appid: process.env[`${app.ck}_appid`] || app.appid,
    templateVersion: process.env[`${app.ck}_template_version`] || app.templateVersion,
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

function shortToken(token = "") {
    const value = String(token).replace(/^Token\s+/i, "");
    return value ? `${value.slice(0, 4)}***${value.slice(-4)}` : "";
}

function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function monthRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    return {
        BeginDate: firstDay - 15 * 24 * 60 * 60 * 1000,
        EndDate: nextMonth - 1000 + 15 * 24 * 60 * 60 * 1000,
    };
}

function normalizeStatus(status = "") {
    const map = {
        Completed: "Complete",
        Failed: "Fail",
        Going: "Going",
        Complete: "Complete",
        Fail: "Fail",
    };
    return map[status] || status;
}

function rewardText(rewards = []) {
    if (!Array.isArray(rewards) || rewards.length === 0) return "";
    return rewards
        .map((item) => {
            const num = item.Num ?? item.Amount ?? "";
            const name = item.RewardName || item.Name || item.RewardAlias || item.RewardType || "";
            return `${num}${name}`.trim();
        })
        .filter(Boolean)
        .join("、");
}

function firstValue(source = {}, keys = []) {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return 0;
}

function isAuthError(e) {
    return /token|登录|授权|非法请求|1500000004/i.test(String(e?.message || e || ""));
}

class Task {
    constructor(app, account, index) {
        this.server = account;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.app = app;
        this.index = index;
        this.account = String(account || "").trim();
        this.token = "";
        this.openId = "";
        this.mallCode = "";
        this.h5Prefix = "";
        this.customerName = "";
        this.summary = {
            appName: app.name,
            account: this.account,
            member: "未查询",
            assets: "未查询",
            sign: "未执行",
        };

    }

    prefix() {
        return `[${this.app.name}][账号${this.index}]`;
    }

    log(message) {
        console.log(`${this.prefix()} ${message}`);
    }

    cacheKey() {
        return `${this.app.appid}:${this.account}`;
    }

    getCachedToken() {
        const cache = readTokenCache();
        return cache[this.cacheKey()] || null;
    }

    saveCachedToken() {
        if (!this.token) return;
        const cache = readTokenCache();
        cache[this.cacheKey()] = {
            token: this.token,
            openId: this.openId,
            mallCode: this.mallCode,
            h5Prefix: this.h5Prefix,
            customerName: this.customerName,
            appid: this.app.appid,
            appName: this.app.name,
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

    applyToken(data = {}) {
        this.token = data.token || data.Token || "";
        this.openId = data.openId || data.OpenId || "";
        this.mallCode = data.mallCode || data.MallCode || "";
        this.h5Prefix = data.h5Prefix || data.RoterPrefix || "";
        this.customerName = data.customerName || data.CustomerName || "";
    }

    headers(extra = {}) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${this.app.appid}/1/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "content-type": "application/json",
            ...extra,
        };
        if (this.token) headers.Authorization = this.token;
        return headers;
    }

    async request({ method = "GET", apiPath, params = {}, data = {}, skipToken = false }) {
        const options = {
            method,
            url: `${this.app.apiBase}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
            headers: this.headers(),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (skipToken) delete options.headers.Authorization;
        if (method === "GET") options.params = params;
        else options.data = data;

        const { data: result, status } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);

        const responseStatus = result && result.ResponseStatus;
        if (responseStatus) {
            const code = Number(responseStatus.ErrorCode);
            if (code !== 0) {
                const err = new Error(`${responseStatus.Message || JSON.stringify(result)}(${responseStatus.ErrorCode})`);
                err.raw = result;
                throw err;
            }
            return result.Data;
        }

        if (typeof result?.code !== "undefined" && Number(result.code) !== 0 && Number(result.code) !== 200) {
            throw new Error(result.msg || result.message || JSON.stringify(result));
        }
        return result?.Data ?? result?.data ?? result;
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached) {
            this.applyToken(cached);
            this.log(`使用缓存token ${shortToken(this.token)}`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                this.log("缓存token失效，重新登录");
            }
        }

        if (!this.token) await this.login();
        if (!this.token) {
            if (this.summary.sign === "未执行") this.summary.sign = "登录失败";
            return this.summary;
        }

        await this.getMemberInfo();
        const done = await this.tryMemberCheckIn();
        if (!done) await this.tryTaskSign();
        return this.summary;
    }

    async checkToken() {
        try {
            await this.request({ apiPath: "/ykb_huiyuan/api/v1/MemberMine/Info" });
            return true;
        } catch {
            return false;
        }
    }

    async getLoginCode() {
        return await getCode(this.server, this.app.appid);
    }

    async login() {
        const loginApis = [
            "/ykb_huiyuan/api/v3/MembeGameLogin/appletLogin",
            "/ykbmini/api/v1/HomeAny/appletLogin",
        ];

        for (const apiPath of loginApis) {
            try {
                const code = await this.getLoginCode();
                if (!code) {
                    this.summary.sign = "获取code失败（未绑定此小程序）";
                    return;
                }
                const data = await this.request({
                    method: "POST",
                    apiPath,
                    skipToken: true,
                    data: {
                        Code: code,
                        AppId: this.app.appid,
                        WechatVersion: this.app.wechatVersion,
                        MobilePlatform: this.app.mobilePlatform,
                        MallCode: this.mallCode || "",
                        TemplateVersion: this.app.templateVersion,
                        extra: { q: "" },
                    },
                });
                this.applyToken(data);
                if (!this.token) throw new Error(`登录响应无Token: ${JSON.stringify(data)}`);
                this.saveCachedToken();
                this.log(`登录成功(${apiPath}): ${this.customerName || ""} openId=${this.openId || ""}`);
                return;
            } catch (e) {
                this.log(`登录接口 ${apiPath} 失败: ${e.message || e}`);
            }
        }
    }

    async getMemberInfo() {
        try {
            const data = await this.request({ apiPath: "/ykb_huiyuan/api/v1/MemberMine/Info" });
            const name = data?.Name || data?.NickName || this.customerName || "未知";
            const phone = data?.Phone ? ` ${maskPhone(data.Phone)}` : "";
            const assets = await this.getAssets(data);
            this.summary.member = `${name}${phone}`;
            this.summary.assets = `代币=${assets.coin} 金币=${assets.goldCoin} 积分=${assets.integral} 彩票=${assets.ticket} 优惠券=${assets.coupon}`;
            this.log(`会员: ${this.summary.member} ${this.summary.assets}`);
        } catch (e) {
            this.summary.member = `查询失败: ${e.message || e}`;
            this.log(`查询会员信息失败: ${e.message || e}`);
            if (isAuthError(e)) this.removeCachedToken();
        }
    }

    async getAssets(memberInfo = {}) {
        const assets = {
            coin: firstValue(memberInfo, ["MyScrip", "Coin", "CoinAmount", "Scrip", "Balance"]),
            goldCoin: firstValue(memberInfo, ["GoldCoin", "GoldCoinAmount"]),
            integral: firstValue(memberInfo, ["ARTotalIntegral", "Integral", "Exchange", "Points"]),
            ticket: firstValue(memberInfo, ["Ticket", "TicketPackage", "TicketCount", "Lottery"]),
            coupon: firstValue(memberInfo, ["Coupon", "CouponCount"]),
        };

        try {
            const data = await this.request({ apiPath: "/ykb_huiyuan/api/v1/Member/GetMemberStoredValue" });
            const list = [
                ...(Array.isArray(data) ? data : []),
                ...(Array.isArray(data?.List) ? data.List : []),
                ...(Array.isArray(data?.Data) ? data.Data : []),
                ...(Array.isArray(data?.LeaguerValues) ? data.LeaguerValues : []),
                ...(Array.isArray(data?.Data?.LeaguerValues) ? data.Data.LeaguerValues : []),
                ...(Array.isArray(data?.StoredValueList) ? data.StoredValueList : []),
            ];
            const source = Array.isArray(data) ? {} : data || {};
            assets.coin = firstValue(source, ["BalanceNum", "MyScrip", "Coin", "CoinAmount", "Scrip", "Balance", "StoredCoin", "GameCoin"]);
            assets.goldCoin = firstValue(source, ["GoldCoin", "GoldCoinAmount"]);
            assets.integral = firstValue(source, ["ARTotalIntegral", "Integral", "Exchange", "Points", "Point"]);
            assets.ticket = firstValue(source, ["Ticket", "TicketPackage", "TicketCount", "Lottery", "LotteryTicket"]);
            assets.coupon = firstValue(source, ["Coupon", "CouponCount"]);
            for (const item of list) {
                const type = String(item.Equity || item.Type || item.StoredValueType || item.StoreCategory || item.Category || item.Name || item.Title || item.Key || "");
                const amount = firstValue(item, ["BalanceNum", "Balance", "AllAmount", "Amount", "Num", "Count", "Value", "Total", "Available", "StoredValue"]);
                if (/GoldCoin|金币/i.test(type)) assets.goldCoin = amount;
                else if (/Ticket|TicketPackage|彩票|票/i.test(type)) assets.ticket = amount;
                else if (/Coupon|优惠券|券/i.test(type)) assets.coupon = amount;
                else if (/Integral|Point|积分|Exchange/i.test(type)) assets.integral = amount;
                else if (/Coin|代币|MyScrip|币/i.test(type)) assets.coin = amount;
            }
        } catch (e) {
            this.log(`查询储值资产失败: ${e.message || e}`);
        }

        return assets;
    }

    async tryMemberCheckIn() {
        try {
            const detail = await this.request({
                apiPath: "/ykb_huiyuan/api/v1/MemberCheckIn/GetDetail",
                params: monthRange(),
            });
            const dailyReward = Array.isArray(detail?.RewardRules)
                ? detail.RewardRules.find((item) => item.CycleType === "Daily")
                : null;
            const dailyText = dailyReward ? `${dailyReward.Amount}${dailyReward.RewardAlias || ""}` : "未知";
            this.log(`会员签到状态: 已连续${detail?.Days ?? 0}天 今日奖励=${dailyText}`);

            if (detail?.IsCheckIn) {
                this.summary.sign = "今日已签到";
                this.log("今日已签到");
                return true;
            }

            const result = await this.request({
                apiPath: "/ykb_huiyuan/api/v1/MemberCheckIn/Submit",
            });
            const after = await this.request({
                apiPath: "/ykb_huiyuan/api/v1/MemberCheckIn/GetDetail",
                params: monthRange(),
            });
            this.summary.sign = `签到成功 signed=${!!after?.IsCheckIn}`;
            this.log(`签到成功${result?.Message ? `: ${result.Message}` : ""} signed=${!!after?.IsCheckIn}`);
            return true;
        } catch (e) {
            this.summary.sign = `会员签到失败: ${e.message || e}`;
            this.log(`会员签到接口不可用，改用任务签到: ${e.message || e}`);
            if (isAuthError(e)) this.removeCachedToken();
            return false;
        }
    }

    async getTaskList(taskType = "AllTask") {
        const data = await this.request({
            apiPath: "/hdb/api/v1/ClientTask/GetTaskListFromYDG",
            params: { TaskType: taskType },
        });
        return data?.List || data?.Data?.List || data?.list || [];
    }

    isSignTask(task = {}) {
        return /签到|每日|天天|登录|打卡|check.?in|sign/i.test(
            [task.TaskName, task.Name, task.Remark, task.Title, task.TaskType, task.TypeName].filter(Boolean).join(" ")
        );
    }

    async getTaskDetail(task) {
        if (task.UserTaskID) {
            return this.request({
                apiPath: "/hdb/api/v1/ClientTask/GetUserTaskDetail",
                params: { UserTaskID: task.UserTaskID },
            });
        }
        return this.request({
            apiPath: "/hdb/api/v1/ClientTask/GetTaskDetail",
            params: { TaskID: task.TaskID },
        });
    }

    async receiveTask(taskDetail, sourceTask) {
        const userTaskId = taskDetail?.UserTaskId || taskDetail?.UserTaskID || sourceTask?.UserTaskID || "";
        if (!userTaskId) throw new Error("缺少 UserTaskId");
        const data = await this.request({
            method: "POST",
            apiPath: "/hdb/api/v1/ClientTask/ReceiveTaskRewards",
            data: { UserTaskId: userTaskId },
        });
        const text = rewardText(data?.Rewards || data?.RewardList || []);
        this.summary.sign = `任务奖励已领取${text ? `: ${text}` : ""}`;
        this.log(`领取任务奖励成功${text ? `: ${text}` : ""}`);
    }

    async handleTask(task) {
        const name = task.TaskName || task.Name || task.TaskID || "未知任务";
        let detail = await this.getTaskDetail(task);
        detail.Status = normalizeStatus(detail.Status);
        this.log(`任务「${name}」状态=${detail.Status || "未知"}`);

        if (detail.Status === "Complete") {
            if (detail.RewardReceiveStatus === "UnReceive") await this.receiveTask(detail, task);
            else this.summary.sign = `任务已完成: ${name}`;
            return;
        }

        if (!task.TaskID) return;
        const challenge = await this.request({
            method: "POST",
            apiPath: "/hdb/api/v1/ClientTask/ReceiveTask",
            data: { ID: task.TaskID },
        });
        const userTaskId = challenge?.UserTaskId || challenge?.UserTaskID;
        if (userTaskId) {
            detail = await this.getTaskDetail({ UserTaskID: userTaskId });
            detail.Status = normalizeStatus(detail.Status);
            if (detail.Status === "Complete" && detail.RewardReceiveStatus === "UnReceive") {
                await this.receiveTask(detail, { ...task, UserTaskID: userTaskId });
            } else {
                this.summary.sign = `任务状态=${detail.Status || "未知"}`;
            }
        }
    }

    async tryTaskSign() {
        try {
            const tasks = await this.getTaskList();
            const signTasks = tasks.filter((task) => this.isSignTask(task));
            if (!signTasks.length) {
                this.summary.sign = "未找到签到/每日任务";
                this.log("未找到签到/每日任务");
                return;
            }
            for (const task of signTasks) await this.handleTask(task);
        } catch (e) {
            this.summary.sign = `任务签到失败: ${e.message || e}`;
            this.log(`任务签到失败: ${e.message || e}`);
        }
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
