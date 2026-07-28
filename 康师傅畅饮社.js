// === YYB_GO 统一通知注入 begin ===
(function installYybOutputCapture() {
  const stateKey = Symbol.for("yyb.output.capture");
  if (globalThis[stateKey]) return;

  const childProcess = require("child_process");
  const fs = require("fs");
  const util = require("util");
  const state = { exiting: false, flushed: false, logs: [] };
  globalThis[stateKey] = state;

  const originalConsole = {
    error: console.error.bind(console),
    log: console.log.bind(console),
    warn: console.warn.bind(console),
  };

  function capture(prefix, args) {
    try {
      const text = util.format(...args);
      for (const line of text.split(/\r?\n/)) {
        if (line) state.logs.push(`${prefix}${line}`);
      }
    } catch (_) {}
  }

  console.log = (...args) => {
    capture("", args);
    originalConsole.log(...args);
  };
  console.warn = (...args) => {
    capture("[warn] ", args);
    originalConsole.warn(...args);
  };
  console.error = (...args) => {
    capture("[stderr] ", args);
    originalConsole.error(...args);
  };

  function resolveKey() {
    const environmentKey =
      process.env.QYWX_KEY || process.env.QYWX || process.env.WEWORK_KEY;
    if (environmentKey) return environmentKey;

    for (const candidate of ["./sendNotify", "/ql/data/scripts/sendNotify"]) {
      try {
        const path = require.resolve(candidate);
        const source = fs.readFileSync(path, "utf8");
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
        const sendNotify =
          typeof notifyModule === "function"
            ? notifyModule
            : notifyModule && notifyModule.sendNotify;
        if (typeof sendNotify === "function") {
          sendNotify(title, body);
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  function sendWebhook(key, title, body) {
    const payload = JSON.stringify({
      msgtype: "text",
      text: { content: `【${title}】\n${body}` },
    });
    childProcess.spawnSync(
      "curl",
      [
        "--silent",
        "--show-error",
        "--max-time",
        "15",
        "--request",
        "POST",
        "--header",
        "Content-Type: application/json",
        "--data-binary",
        "@-",
        `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`,
      ],
      { input: payload, stdio: ["pipe", "ignore", "ignore"] },
    );
  }

  function flushNotification() {
    if (state.flushed) return;
    state.flushed = true;

    const title = (process.argv[1] || "YYB_GO").split(/[\\/]/).pop();
    const body =
      state.logs.slice(-40).join("\n") || "任务执行完成，无日志输出。";
    if (trySendNotify(title, body)) return;

    const key = resolveKey();
    if (key) sendWebhook(key, title, body);
  }

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

// name: 康师傅畅饮社
// cron: 30 10 * * *

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

const MINI_APP_ID = "wx54f3e6a00f7973a7";
const API_BASE = "https://club.biqr.cn/";
const FORUM_BASE = "https://nclub.gdshcm.com/pro/";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "kangshifu_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf254173b) XWEB/19027";
const defaultUserAgent = USER_AGENT;

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

function shortToken(token = "") {
    const value = String(token);
    return value ? `${value.slice(0, 6)}***${value.slice(-6)}` : "";
}

function maskPhone(phone = "") {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function isSuccess(result) {
    return Number(result?.code) === 0;
}

function isTokenError(message) {
    return /(^|[^0-9])600([^0-9]|$)|4002|token|登录|授权|未登录|无效|过期/i.test(String(message || ""));
}

function formBody(data = {}) {
    return new URLSearchParams(data).toString();
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
        this.member = {};
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached?.token) {
            this.token = cached.token;
            this.member = cached.member || {};
            console.log(`账号[${this.index}] 使用缓存token: ${shortToken(this.token)}`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存token失效，重新登录`);
            }
        }

        if (!this.token) {
            await this.loginByWxCode();
            if (!this.token) return;
        }

        await this.memberInfo();
        await this.signIn();
        await this.memberInfo("签到后");
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
            member: this.member,
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
        this.member = {};
    }

    headers(extra = {}) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "xweb_xhr": "1",
            "Referer": "https://servicewechat.com/wx54f3e6a00f7973a7/816/page-frame.html",
            "Accept-Language": "zh-CN,zh;q=0.9",
            ...extra,
        };
        if (this.token) headers.token = this.token;
        return headers;
    }

    async request(baseURL, apiPath, { method = "GET", data, params, auth = true, form = false } = {}) {
        const options = {
            method,
            url: new URL(apiPath, baseURL).toString(),
            params,
            headers: this.headers(form ? {
                "Content-Type": "application/x-www-form-urlencoded;",
            } : {}),
            timeout: 15000,
            validateStatus: () => true,
        };
        if (!auth) delete options.headers.token;
        if (data !== undefined) options.data = form ? formBody(data) : data;

        const { data: result, status } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!isSuccess(result)) throw new Error(`${result?.code ?? ""} ${result?.msg || result?.error || JSON.stringify(result)}`.trim());
        return result;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getLoginCode();
            const result = await this.request(FORUM_BASE, "whale-member/api/login/login", {
                method: "POST",
                auth: false,
                data: {
                    code,
                    inviterId: "",
                    inviterType: "",
                    inviterMatchUserId: "",
                    spUrl: "",
                },
            });
            const token = result?.data?.token || "";
            if (!token) throw new Error(`登录响应未返回token: ${JSON.stringify(result)}`);
            this.token = token;
            this.member = result?.data?.member || {};
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: ${this.member.nickname || maskPhone(this.member.phone) || this.member.id || ""}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.getMemberInfo();
            return true;
        } catch (e) {
            return false;
        }
    }

    async getMemberInfo() {
        const result = await this.request(FORUM_BASE, "whale-member/api/member/getMemberInfo", {
            params: { token: this.token },
        });
        this.member = result?.data || this.member || {};
        this.saveCachedToken();
        return this.member;
    }

    async memberInfo(prefix = "当前") {
        try {
            const data = await this.getMemberInfo();
            const name = data?.nickname || maskPhone(data?.phone) || data?.id || "";
            const integral = data?.integral ?? data?.point ?? data?.points ?? data?.score ?? "未知";
            console.log(`账号[${this.index}] ${prefix}用户: ${name}，积分: ${integral}`);
        } catch (e) {
            const message = String(e.message || e);
            console.log(`账号[${this.index}] 查询用户失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }

    async getSignStatus() {
        const result = await this.request(API_BASE, "api/signIn/integralSignInList", {
            method: "POST",
            data: { token: this.token },
            form: true,
        });
        return result?.data || {};
    }

    async signIn() {
        try {
            const status = await this.getSignStatus();
            if (status?.signIs) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }

            const result = await this.request(API_BASE, "api/signIn/integralSignIn", {
                method: "POST",
                data: {},
                form: true,
            });
            console.log(`账号[${this.index}] 签到成功: ${result?.msg || "成功"}`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已签到|已签|重复/.test(message)) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }
}

!(async () => {
    for (const user of SERVERS) {
        await new Task(user).run();
    }
})()
    .catch((e) => console.log(e))
    


