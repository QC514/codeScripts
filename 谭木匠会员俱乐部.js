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

// name: 谭木匠会员俱乐部
// cron: 44 9 * * *

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

const MINI_APP_ID = "wxc6f9e3b38b25b840";
const PAGE_VERSION = "44";
const API_BASE = "https://mall-mobile-v6.vecrp.com/mobile";
const SECRET_KEY = "R6WbJ830wNsEdjH9GumwKYiYxHz0K9QD";
const TOKEN_CACHE_FILE = path.join(__dirname, "token_caches", "tmj_token_cache.json");
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

function sha1(text) {
    return crypto.createHash("sha1").update(String(text)).digest("hex");
}

function signPayload(data) {
    const keys = Object.keys(data).sort((a, b) => {
        const left = `${a}${data[a]}`;
        const right = `${b}${data[b]}`;
        if (left > right) return 1;
        if (left < right) return -1;
        return 0;
    });
    return sha1(keys.map((key) => `${key}${data[key]}`).join(""));
}

function todayInfo() {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const pad = (n) => String(n).padStart(2, "0");
    return {
        year: y,
        month: m,
        day,
        today: `${y}-${pad(m)}-${pad(day)}`,
        startDate: `${y}-${m}-01`,
        endDate: `${y}-${m}-${new Date(y, m, 0).getDate()}`,
    };
}

function normalizeDate(value) {
    const text = String(value || "").slice(0, 10);
    const parts = text.split("-");
    if (parts.length !== 3) return text;
    return `${parts[0]}-${String(Number(parts[1])).padStart(2, "0")}-${String(Number(parts[2])).padStart(2, "0")}`;
}

function isTokenError(message) {
    return /token|登录|授权|invalid|expire|过期|401|403/i.test(String(message || ""));
}

function getRows(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.rows)) return result.rows;
    if (Array.isArray(result?.records)) return result.records;
    if (Array.isArray(result?.list)) return result.list;
    return [];
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
        this.shopId = "";
        this.shopName = "";
        this.integralAccount = "";
        this.signActivityId = "";
        this.signTitle = "";
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

        await this.ensureIntegralAccount();
        await this.findSignActivity();
        await this.loadSignInfo();
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
            shopId: this.shopId,
            shopName: this.shopName,
            integralAccount: this.integralAccount,
            signActivityId: this.signActivityId,
            signTitle: this.signTitle,
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
        this.shopId = "";
        this.shopName = "";
        this.integralAccount = "";
        this.signActivityId = "";
    }

    applyToken(data = {}) {
        this.token = data.token || data.mobileToken || "";
        this.shopId = data.shopId || "";
        this.shopName = data.shopName || "";
        this.integralAccount = data.integralAccount || "";
        this.signActivityId = data.signActivityId || "";
        this.signTitle = data.signTitle || "";
    }

    getHeaders(sign, ts) {
        return {
            "User-Agent": USER_AGENT,
            "Referer": `https://servicewechat.com/${MINI_APP_ID}/${PAGE_VERSION}/page-frame.html`,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=UTF-8",
            "appid": MINI_APP_ID,
            "token": this.token,
            "ts": ts,
            "startTime": ts,
            "sign": sign,
            "X-TracedId": crypto.randomUUID(),
        };
    }

    async request(apiPath, data = {}, method = "GET") {
        const payload = data || {};
        const ts = Date.now();
        const signData = method === "POST"
            ? { body: JSON.stringify(payload), secretKey: SECRET_KEY, ts }
            : { ...payload, secretKey: SECRET_KEY, ts };
        const options = {
            method,
            url: `${API_BASE}${apiPath}`,
            headers: this.getHeaders(signPayload(signData), ts),
            timeout: 20000,
            validateStatus: () => true,
        };
        if (method === "GET") options.params = payload;
        else options.data = payload;

        const { status, data: result } = await axios.request(options);
        if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(result)}`);
        if (!result || result.success !== true) {
            const err = new Error(result?.msg || result?.message || JSON.stringify(result));
            err.code = result?.code;
            throw err;
        }
        return result.result;
    }

    async getLoginCode() {
        return await getCode(this.server);
    }

    async loginByWxCode() {
        try {
            const code = await this.getLoginCode();
            const data = await this.request("/wxAppLogin", {
                code,
                appid: MINI_APP_ID,
                shopId: null,
                envVersion: "",
                isEnterpriseWx: false,
                scene: "",
                referrerInfo: "",
            }, "POST");
            this.applyToken({
                token: data?.mobileToken,
                shopId: data?.shopId,
                shopName: data?.shopName,
            });
            this.saveCachedToken();
            console.log(`账号[${this.index}] 登录成功: ${this.shopName || this.shopId || "未知门店"}`);
        } catch (e) {
            console.log(`账号[${this.index}] 登录失败: ${e.message || e}`);
        }
    }

    async checkToken() {
        try {
            await this.ensureIntegralAccount(true);
            return true;
        } catch (e) {
            return false;
        }
    }

    async ensureIntegralAccount(silent = false) {
        const data = await this.request("/activity/common/queryIntegralSystemList", {
            shopId: this.shopId,
            earnSpendType: 1,
        });
        const first = Array.isArray(data) ? data[0] : null;
        this.integralAccount = first?.integralAccount || this.integralAccount;
        if (!silent) {
            console.log(`账号[${this.index}] 积分体系: ${first?.systemName || "未知"} ${first?.integralAlias || ""}`);
        }
        this.saveCachedToken();
    }

    async findSignActivity() {
        if (!this.integralAccount) await this.ensureIntegralAccount(true);
        const data = await this.request("/activity/common/queryActivityList", {
            earnSpendType: 1,
            shopId: this.shopId,
            pageNo: 1,
            pageSize: 10,
            integralAccount: this.integralAccount,
            activityType: 3,
        }, "POST");
        const activity = getRows(data).find((item) => String(item.activityType) === "3" && item.canJoin !== false);
        if (!activity?.activityId) throw new Error("未找到可参与的签到活动");
        this.signActivityId = activity.activityId;
        this.signTitle = activity.title || "每日签到";
        console.log(`账号[${this.index}] 签到活动: ${this.signTitle}`);
        this.saveCachedToken();
    }

    async loadSignInfo() {
        if (!this.signActivityId) await this.findSignActivity();
        const data = await this.request("/activity/sign/loadActivityInfo", {
            activityId: this.signActivityId,
            source: 1,
            shopId: this.shopId,
        });
        this.signTitle = data?.title || this.signTitle;
        const integral = data?.integral ?? data?.awardDescMobileList?.[0]?.awardDescList?.[0]?.integrationNum ?? "未知";
        console.log(`账号[${this.index}] 签到状态: ${data?.canJoin === false ? "不可参与" : "可参与"} 奖励${integral}积分`);
        this.saveCachedToken();
    }

    async queryMonthSign() {
        const date = todayInfo();
        return await this.request("/activity/sign/querySignInfoList", {
            activityId: this.signActivityId,
            startDate: date.startDate,
            endDate: date.endDate,
        }, "POST");
    }

    async doSign() {
        try {
            const date = todayInfo();
            const monthInfo = await this.queryMonthSign();
            const signedList = Array.isArray(monthInfo?.signDateList) ? monthInfo.signDateList : [];
            if (signedList.some((item) => normalizeDate(item) === date.today)) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }

            const data = await this.request("/activity/sign/sign", {
                activityId: this.signActivityId,
                shopId: this.shopId,
                signDate: date.today,
            }, "POST");
            const integral = data?.integral ?? data?.memberDayIntegral ?? "未知";
            console.log(`账号[${this.index}] 签到成功: +${integral}积分`);
        } catch (e) {
            const message = String(e.message || e);
            if (/已签|重复|already/i.test(message)) {
                console.log(`账号[${this.index}] 今日已签到`);
                return;
            }
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
