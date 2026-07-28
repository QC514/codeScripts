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

// name: CASETiFY
// cron: 52 9 * * *

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

const MINI_APP_ID = "wxd0c71d6bf928a416";
const PAGE_VERSION = "160";
const API_BASE = "https://mini-app-api.casetify.cn/api/v4";
const WECHAT_ID = 260;
const POINT_MALL_TYPE = 13;
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "casetify_token_cache.json");
try { fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true }); } catch (e) {}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/3.9.12 MiniProgramEnv/Windows WindowsWechat/WMPF";

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

function normalizeDate(value) {
    const parts = String(value || "").split("-");
    if (parts.length !== 3) return String(value || "");
    return `${parts[0]}-${String(Number(parts[1])).padStart(2, "0")}-${String(Number(parts[2])).padStart(2, "0")}`;
}

function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isTokenError(message) {
    return /token|登录|授权|invalid|expire|过期|401|403/i.test(String(message || ""));
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
        this.memberId = "";
        this.customerNo = "";
        this.phone = "";
        this.levels = "";
        this.campaignId = "";
    }

    async run() {
        const cached = this.getCachedToken();
        if (cached) {
            this.applyToken(cached);
            console.log(`账号[${this.index}] 使用缓存token`);
            if (!(await this.checkToken())) {
                this.removeCachedToken();
                console.log(`账号[${this.index}] 缓存token失效，重新登录`);
            }
        }

        if (!this.token) {
            await this.loginByWxCode();
            if (!this.token) return;
        }

        await this.getCampaignId();
        await this.doSign();
        this.saveCachedToken();
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
            memberId: this.memberId,
            customerNo: this.customerNo,
            phone: this.phone,
            levels: this.levels,
            campaignId: this.campaignId,
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
        this.memberId = "";
        this.customerNo = "";
        this.campaignId = "";
    }

    applyToken(data = {}) {
        this.token = data.token || "";
        this.memberId = data.memberId || data.id || "";
        this.customerNo = data.customerNo || "";
        this.phone = data.phone || "";
        this.levels = data.levels || "";
        this.campaignId = data.campaignId || "";
    }

    getHeaders(auth = false) {
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
        };
        if (!auth) headers.token = this.token || "";
        return headers;
    }

    async request(method, apiPath, data = {}, options = {}) {
        const requestOptions = {
            method,
            url: `${API_BASE}/${apiPath}`,
            headers: this.getHeaders(options.auth),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (method === "GET") requestOptions.params = data;
        else requestOptions.data = data;

        const { status, data: result } = await axios.request(requestOptions);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!options.allowAnyCode && result?.resultCode !== "1") {
            const err = new Error(result?.msg || JSON.stringify(result));
            err.resultCode = result?.resultCode;
            throw err;
        }
        return result;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getLoginCode();
            const result = await this.request("GET", `estore/member/onLogin/${code}/${WECHAT_ID}`, {}, { auth: true });
            const user = result.data || {};
            this.applyToken({
                token: user.token,
                memberId: user.id,
                customerNo: user.customerNo,
                phone: user.phone,
                levels: user.levels,
            });
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: ${this.levels || "会员"} ${this.customerNo || this.memberId || ""}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.getCampaignId(true);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getCampaignId(silent = false) {
        if (this.campaignId) return this.campaignId;
        const result = await this.request("GET", "estore-campaign/campaign/info/get", {
            campaignType: POINT_MALL_TYPE,
        });
        const campaignId = result.data?.detail?.campaignId || result.data?.campaignId || "";
        if (!campaignId) throw new Error("未找到积分商城活动");
        this.campaignId = campaignId;
        this.saveCachedToken();
        if (!silent) console.log(`账号[${this.index}] 积分商城活动: ${campaignId}`);
        return campaignId;
    }

    async getSignInfo() {
        if (!this.campaignId) await this.getCampaignId(true);
        const result = await this.request("GET", "estore-campaign/campaign/pointsMall/assignment/sign", {
            campaignId: this.campaignId,
        });
        return result.data || {};
    }

    async doSign() {
        try {
            const before = await this.getSignInfo();
            const signDays = Array.isArray(before.signDays) ? before.signDays : [];
            const todayStatus = signDays.find((item) => normalizeDate(item.signDay) === today());
            const dailyTask = Array.isArray(before.assignDetail)
                ? before.assignDetail.find((item) => item.assignmentName && item.assignmentName.includes("单日"))
                : null;
            if (todayStatus?.signStatus === 1 || dailyTask?.completeStatus === 1) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }

            const sign = await this.request("POST", "estore-campaign/member/sign/do", {}, { allowAnyCode: true });
            if (sign.resultCode !== "1") {
                const message = sign.msg || JSON.stringify(sign);
                if (/已签|重复/.test(message)) {
                    console.log(`账号[${this.index}] 今日已签到`);
                    return;
                }
                throw new Error(message);
            }

            const after = await this.getSignInfo();
            const task = Array.isArray(after.assignDetail)
                ? after.assignDetail.find((item) => item.assignmentName && item.assignmentName.includes("单日"))
                : null;
            console.log(`账号[${this.index}] 签到成功: +${task?.awardPrice || "未知"}积分`);
        } catch (e) {
            const message = e.message || e;
            console.log(`账号[${this.index}] 签到失败: ${message}`);
            if (isTokenError(message)) this.removeCachedToken();
        }
    }
}

!(async () => {
    
    for (const openid of SERVERS) {
        await new Task(openid).run();
    }
})()
    .catch((e) => console.log(e.message || e))
