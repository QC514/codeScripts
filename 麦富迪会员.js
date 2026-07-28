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

// name: 麦富迪会员
// cron: 41 9 * * *

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

const MINI_APP_ID = "wx278a2ed79c5182f8";
const API_BASE = "https://cdp.myfoodiepet.com";
const APP_ID = "6259662812989361028";
const TENANT_ID = "00ae459e842642f78b9ab0d8e7c027b4";
const SIGN_SALT = "XpL9q#dK2zRf$tMn";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "mfd_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

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

function shortValue(value = "") {
    const text = String(value || "");
    return text ? `${text.slice(0, 4)}***${text.slice(-4)}` : "";
}

function md5(text) {
    return crypto.createHash("md5").update(String(text)).digest("hex");
}

function memberSignature(memberId) {
    const timestamp = Date.now();
    return {
        memberId,
        timestamp,
        signature: md5(`${memberId}${timestamp}${SIGN_SALT}`),
    };
}

function isTokenError(error) {
    return /登录|授权|memberId|401|openid|code|token/i.test(String(error && (error.message || error)));
}

class Task {
    constructor(account) {
        this.server = account;
        const _yyb = parseYybGoEntry(this.server);
        this.ref = _yyb.ref;
        this.openid = _yyb.ref;
        this.index = userIdx++;
        this.account = String(account || "").trim();
        this.openId = "";
        this.unionId = "";
        this.memberId = "";
        this.phone = "";
        this.groupId = "";
        this.agentId = "";
        this.memberInfo = {};
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached) {
            this.applyToken(cached);
            console.log(`账号[${this.index}] 使用缓存登录态: memberId=${shortValue(this.memberId)}`);
            if (!(await this.checkLogin())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存登录态失效，重新登录`);
            }
        }

        if (!this.memberId) {
            await this.loginByWxCode();
            if (!this.memberId) return;
        }

        await this.getMemberInfo();
        await this.getContinuousDays();
        await this.signIn();
        await this.getContinuousDays();
    }

    getCachedToken() {
        const cache = readTokenCache();
        const item = cache[this.account];
        if (!item || !item.memberId) return null;
        return item;
    }

    saveCachedToken() {
        if (!this.memberId) return;
        const cache = readTokenCache();
        cache[this.account] = {
            openId: this.openId,
            unionId: this.unionId,
            memberId: this.memberId,
            phone: this.phone,
            groupId: this.groupId,
            agentId: this.agentId,
            updatedAt: new Date().toISOString(),
        };
        writeTokenCache(cache);
    }

    removeCachedToken() {
        const cache = readTokenCache();
        if (cache[this.account]) {
            delete cache[this.account];
            writeTokenCache(cache);
        }
        this.openId = "";
        this.unionId = "";
        this.memberId = "";
        this.phone = "";
        this.groupId = "";
        this.agentId = "";
    }

    applyToken(data = {}) {
        this.openId = data.openId || "";
        this.unionId = data.unionId || "";
        this.memberId = data.memberId || "";
        this.phone = data.phone || "";
        this.groupId = data.groupId || "";
        this.agentId = data.agentId || "";
    }

    getHeaders(extra = {}) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/402/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            appId: APP_ID,
            tenantId: TENANT_ID,
            wxAppid: MINI_APP_ID,
            groupId: this.groupId || "",
            ...extra,
        };
        if (this.memberId) headers.userId = this.memberId;
        return headers;
    }

    async request({ method = "GET", apiPath, params = {}, data = {} }) {
        const upperMethod = method.toUpperCase();
        const options = {
            method: upperMethod,
            url: `${API_BASE}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
            headers: this.getHeaders(),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (upperMethod === "GET") options.params = { ...params, _: Date.now() };
        else {
            options.params = { _: Date.now() };
            options.data = data;
        }

        const { data: result, status } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!result || (String(result.code) !== "0" && Number(result.code) !== 2)) {
            throw new Error(result?.msg || result?.message || JSON.stringify(result));
        }
        return result;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async getIdentityInfo() {
        try {
            const result = await this.request({
                apiPath: `/tnew/myfoodiepet-member/v1/member/identity/info/${MINI_APP_ID}`,
            });
            const data = result.data || {};
            this.groupId = data.groupId || this.groupId;
            this.agentId = data.agentId || this.agentId;
            this.saveCachedToken();
            return data;
        } catch (e) {
            console.log(`账号[${this.index}] 获取身份配置失败: ${e.message || e}`);
            return {};
        }
    }

    async loginByWxCode() {
        try {
            await this.getIdentityInfo();
            const code = await this.getLoginCode();
            const result = await this.request({
                apiPath: "/tnew/myfoodiepet-member/v1/wechat/applet/authorizeV2",
                params: { code },
            });
            const data = result.data || {};
            this.openId = data.openId || "";
            this.unionId = data.unionId || "";
            this.memberId = String(data.memberId || "");
            this.phone = data.phone || "";
            if (!this.memberId) throw new Error(`登录响应未返回 memberId: ${JSON.stringify(result)}`);
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: memberId=${shortValue(this.memberId)} ${maskPhone(this.phone)}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkLogin() {
        try {
            if (!this.groupId) await this.getIdentityInfo();
            await this.queryMemberById();
            return true;
        } catch (e) {
            return false;
        }
    }

    async queryMemberById() {
        const result = await this.request({
            method: "POST",
            apiPath: "/tnew/myfoodiepet-member/v1/member/queryByMemberId",
            data: memberSignature(this.memberId),
        });
        return result.data || {};
    }

    async getMemberInfo() {
        try {
            const data = await this.queryMemberById();
            this.memberInfo = data;
            const name = data.nickName || data.nickname || data.memberName || data.name || "未知";
            const phone = data.phone || data.mobile || this.phone;
            const point = data.availablePoint ?? data.point ?? data.points ?? data.integral ?? "未知";
            console.log(`账号[${this.index}] 会员: ${name} ${maskPhone(phone)} 积分=${point}`);
        } catch (e) {
            console.log(`账号[${this.index}] 查询会员信息失败: ${e.message || e}`);
            if (isTokenError(e)) this.removeCachedToken();
        }
    }

    async getContinuousDays() {
        try {
            const result = await this.request({
                apiPath: `/tnew/myfoodiepet-member/v1/member/continuous-days/${this.memberId}`,
            });
            const data = result.data || {};
            this.signedToday = data.signedToday;
            console.log(`账号[${this.index}] 签到状态: 连续${data.continuousDays ?? 0}天 今日=${data.signedToday ? "已签" : "未签"}`);
            return data;
        } catch (e) {
            console.log(`账号[${this.index}] 查询签到状态失败: ${e.message || e}`);
            return {};
        }
    }

    async signIn() {
        try {
            if (this.signedToday) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
            const result = await this.request({
                method: "POST",
                apiPath: "/tnew/myfoodiepet-member/v1/member/sign",
                data: { memberId: this.memberId },
            });
            console.log(`账号[${this.index}] 签到成功: ${result.msg || result.message || "ok"}`);
        } catch (e) {
            console.log(`账号[${this.index}] 签到失败: ${e.message || e}`);
            if (isTokenError(e)) this.removeCachedToken();
        }
    }
}

!(async () => {
    
    for (const account of SERVERS) {
        await new Task(account).run();
    }
})()
    .catch((e) => console.log(e.message || e))
