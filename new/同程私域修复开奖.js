/*
------------------------------------------
@Author: sm
@Date: 2026.08.23
@Description: 同程旅行-签到领现金（青龙 / VMPF 适配，变量与取 code 方式同 oppo）
cron: 30 8 * * *
------------------------------------------
配置说明（与 OPPO/oppo 脚本一致）：
1. VMPF 平台（WMPF 微信小程序协议服务平台，覆盖取 code）：
   VMPF_URL                                          必填，VMPF 平台接口地址（不含路径）
   - 示例：http://127.0.0.1:5679
   - 脚本调用 {VMPF_URL}/api/wxapp/JSLogin 获取微信 code
   - 请求格式：POST {VMPF_URL}/api/wxapp/JSLogin
   - 请求体：{"Appid": "wx3827070276e49e30", "Wxid": "<微信 openid>"}
   - 请求头：X-Api-Key: <VMPF_API_KEY>
   - 响应：{"Code":0,"Data":{"code":"0f..."}}

   VMPF_API_KEY                                      必填，VMPF API 密钥（wmpf_xxx）

2. 账号变量：
   qingyun_openid                                    微信 openid 列表
   - 多账号支持使用 & 或换行分隔
   - 示例：openid_a&openid_b

3. code 使用方式：VMPF 取 code 后，交由业务登录接口（getopenid.html）换 idenId/token。
4. token 按 openid 持久化到 tcqdcookie.json。
5. 签到达标后自动执行开奖操作。
------------------------------------------
*/

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const https = require("https");

// ====================== VMPF 平台配置（环境变量 VMPF_URL=接口地址 / VMPF_API_KEY=API密钥） ======================
const VMPF_URL = (process.env.VMPF_URL || "").trim().replace(/\/+$/, "");
const VMPF_API_KEY = (process.env.VMPF_API_KEY || "").trim();
if (!VMPF_URL || !VMPF_API_KEY) {
    console.error("未配置 VMPF 平台环境变量（VMPF_URL / VMPF_API_KEY），请设置后重试");
    process.exit(1);
}

const SERVERS = (process.env.qingyun_openid || "")
    .split(/\r?\n|&/)
    .map(s => s.trim())
    .filter(Boolean);
if (!SERVERS.length) {
    console.error("未配置环境变量 qingyun_openid，请设置后重试（多账号使用 & 或换行分隔）");
    process.exit(1);
}

const tcqd_COOKIE_FILE = path.join(__dirname, "tcqdcookie.json");

// 参考脚本中用于 getopenid.html 的 H5/公众号 AppID，不是签到页小程序 AppID。
const APP = {
    name: "同程旅行-签到领现金",
    appid: "wx3827070276e49e30",
    // 业务请求 UA 中追加的小程序 AppID
    miniProgram: "wx336dcaf6a1ecf632",
};

// 当前活动在 HAR 中出现的真实 H5 页面。
const ACTIVITY_URL = "https://wx.17u.cn/cvgzt/20260819dailyCheckIn/index/?fromShareId=99c4cc5db188d952e708ba3826cac37b5c3ff63ec81d86e24bf97fe6d64e2773b4a72f4f6e775a3f7233f9ea47a164f43a1abe68fb1e92481b932cd8e3e3f52ef733cec7608064dcfd7195843bf18634#";
const httpsAgent = new https.Agent({ keepAlive: true, family: 4 });

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541d3c) XWEB/25556";

const ACT_ID = "c60c3ca52ec79260203998db4578c913";

function log(msg) {
    console.log(msg);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function safeJsonRead(file) {
    try {
        if (!fs.existsSync(file)) return {};
        const text = fs.readFileSync(file, "utf8").trim();
        if (!text) return {};
        const data = JSON.parse(text);
        return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (e) {
        log(`⚠️ 读取 ${path.basename(file)} 失败，将使用空缓存: ${e.message}`);
        return {};
    }
}

function safeJsonWrite(file, data) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, file);
}

function isTokenExpired(entry) {
    if (!entry || !entry.token) return true;

    const expire = Number(entry.expire || 0);
    if (!expire) return false;

    // 同时兼容秒级和毫秒级时间戳。
    const expireMs = expire < 100000000000 ? expire * 1000 : expire;
    return Date.now() >= expireMs;
}

function extractIdenFromRedirect(loc, setCookies) {
    let idenId = "";
    let token = "";

    if (loc) {
        try {
            const u = new URL(loc, "https://wx.17u.cn");
            // 参考脚本：302 Location 中的 code 即 H5 openid（业务 idenId）。
            idenId = u.searchParams.get("code") || "";
            token = u.searchParams.get("token") || "";
        } catch (_) {}
    }

    const cookies = Array.isArray(setCookies)
        ? setCookies
        : setCookies
            ? [setCookies]
            : [];

    for (const c of cookies) {
        const str = String(c || "");

        if (!idenId) {
            const m =
                str.match(/(?:^|;\s*|,?\s*)(?:WxUser|cookieOpenSource|CooperateWxUser)=[^;]*openid=([^&;]+)/i) ||
                str.match(/openid=([^&;]+)/i);
            if (m) {
                try {
                    idenId = decodeURIComponent(m[1]);
                } catch (_) {
                    idenId = m[1];
                }
            }
        }

        if (!token) {
            const m = str.match(/(?:^|[;&])token=([^&;]+)/i);
            if (m) {
                try {
                    token = decodeURIComponent(m[1]);
                } catch (_) {
                    token = m[1];
                }
            }
        }
    }

    return { idenId, token };
}

async function exchangeCode(code) {
    const url =
        "https://wx.17u.cn/flight/getopenid.html?url=" +
        encodeURIComponent(ACTIVITY_URL) +
        `&code=${encodeURIComponent(code)}&state=123`;

    try {
        const res = await axios({
            method: "GET",
            url,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Linux; Android 16; PJZ110) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.71",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            timeout: 20000,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
            httpsAgent,
        });

        const loc = res.headers.location || res.headers.Location || "";
        const setCookie = res.headers["set-cookie"] || res.headers["Set-Cookie"] || [];

        let body = typeof res.data === "string" ? res.data : "";
        if (!loc && body) {
            const m = body.match(/href=["']([^"']+)["']/i);
            if (m) {
                return extractIdenFromRedirect(m[1], setCookie);
            }
        }

        return extractIdenFromRedirect(loc, setCookie);
    } catch (e) {
        if (e.response) {
            const loc = e.response.headers.location || e.response.headers.Location || "";
            const setCookie =
                e.response.headers["set-cookie"] || e.response.headers["Set-Cookie"] || [];
            let body = typeof e.response.data === "string" ? e.response.data : "";
            if (!loc && body) {
                const m = body.match(/href=["']([^"']+)["']/i);
                if (m) {
                    return extractIdenFromRedirect(m[1], setCookie);
                }
            }
            return extractIdenFromRedirect(loc, setCookie);
        }
        throw e;
    }
}

async function request(options) {
    try {
        const res = await axios.request({
            timeout: 20000,
            validateStatus: () => true,
            ...options,
            headers: {
                "User-Agent": USER_AGENT + " miniProgram/" + APP.miniProgram,
                "Accept": "application/json, text/plain, */*",
                ...(options.headers || {}),
            },
        });

        return {
            status: res.status,
            headers: res.headers || {},
            data: res.data,
        };
    } catch (e) {
        log(`❌ 请求异常: ${e.message}`);
        return { status: 0, headers: {}, data: null, error: e };
    }
}

function parseYybGoEntry(rawValue) {
    const ref = String(rawValue || "").trim();
    if (!ref) return { server: "", ref: "", auth: "" };
    return { server: "", ref, auth: "" };
}

// 与 oppo 相同的取 code 方式：调用 VMPF 平台 /api/wxapp/JSLogin
async function getCode(openid) {
    const { ref } = parseYybGoEntry(openid);
    if (!ref) return null;
    try {
        const { data } = await axios.post(
            VMPF_URL + "/api/wxapp/JSLogin",
            { Appid: APP.appid, Wxid: ref },
            { timeout: 20000, proxy: false, headers: { "X-Api-Key": VMPF_API_KEY } },
        );
        const code = data && data.Code === 0 && data.Data && data.Data.code;
        if (!data || data.Code !== 0 || !code) {
            log("获取code失败: " + JSON.stringify(data));
            return null;
        }
        log("获取code成功");
        return code;
    } catch (e) {
        log("获取code异常: " + e.message);
        return null;
    }
}

async function getWxCode(openid) {
    return await getCode(openid);
}

class tcqdCookieStore {
    constructor(file) {
        this.file = file;
        this.data = safeJsonRead(file);
    }

    get(openid) {
        const entry = this.data[openid];
        return entry && typeof entry === "object" ? entry : null;
    }

    set(openid, nickname, token, expire, extra = {}) {
        this.data[openid] = {
            nickname: nickname || "",
            token,
            expire: expire || 0,
            ...extra,
        };
        safeJsonWrite(this.file, this.data);
    }

    invalidate(openid, nickname) {
        const old = this.get(openid);
        this.data[openid] = {
            nickname: nickname || old?.nickname || "",
            token: "",
            expire: 0,
        };
        safeJsonWrite(this.file, this.data);
    }
}

function isNotLoggedInResponse(res) {
    if (!res) return false;
    if (res.status === 401 || res.status === 403) return true;

    const data = res.data;
    if (!data) return false;

    const code = data.code ?? data.errCode ?? data.errorCode ?? data.RspCode;
    if ([401, 403, 1001, 1002, 1003, 40001, 40003, 40101].includes(Number(code))) return true;

    const msg = String(data.message || data.msg || data.errMsg || data.Message || "").toLowerCase();
    return [
        "未登录",
        "请登录",
        "登录失效",
        "token失效",
        "token expired",
        "unauthorized",
        "not login",
        "not_logged_in",
        "invalid token",
        "token invalid",
    ].some(keyword => msg.includes(keyword.toLowerCase()));
}

class SignInTask {
    constructor(openid, index, cookieStore) {
        this.index = index;
        this.openid = openid;
        this.nickname = openid;
        this.cookieStore = cookieStore;
        this.token = "";
        this.idenId = "";
        this.unionId = "";
    }

    getHeaders() {
        const headers = {
            "Content-Type": "application/json",
            "Origin": "https://wx.17u.cn",
            "Referer": "https://wx.17u.cn/",
            "Accept": "*/*",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh;q=0.9",
        };

        return headers;
    }

    getBaseData() {
        return {
            actId: ACT_ID,
            unionId: this.unionId || "",
            idenId: this.idenId || "",
        };
    }

    async loginByCode(code) {
        log(`\n🔐 使用微信 code 登录业务系统...`);

        const exchanged = await exchangeCode(code);
        const idenId = exchanged.idenId;
        const token = exchanged.token || "";

        if (!idenId || idenId === "0") {
            throw new Error(`业务登录失败：未从 302 Location / Cookie 获取到 idenId`);
        }

        this.idenId = idenId;
        this.token = token;

        // VMPF/纯 openid 账号没有 unionId，不凭空改写业务参数。
        const cached = this.cookieStore.get(this.openid);
        this.unionId = cached?.unionId || "";

        this.cookieStore.set(this.openid, this.nickname, token, 0, {
            idenId,
            unionId: this.unionId,
        });

        log(`   ✅ 登录成功，idenId=${idenId ? idenId.slice(0, 6) + "****" : ""}`);
        log(`   ✅ 登录结果已按 openid 持久化`);
        return true;
    }

    async ensureToken(forceRefresh = false) {
        if (!forceRefresh) {
            const cached = this.cookieStore.get(this.openid);
            if (cached && !isTokenExpired(cached) && cached.idenId) {
                this.token = cached.token || "";
                this.idenId = cached.idenId;
                this.unionId = cached.unionId || "";
                log(`   🔑 使用缓存登录态`);
                return true;
            }
        }

        const code = await getWxCode(this.openid);
        if (!code) {
            throw new Error("获取微信 code 失败");
        }
        log(`   ✅ 获取微信 code 成功`);
        await this.loginByCode(code);
        return true;
    }

    async businessRequest(options) {
        let retried = false;

        while (true) {
            const res = await request({
                ...options,
                headers: {
                    ...(options.headers || {}),
                    ...this.getHeaders(),
                },
            });

            if (!retried && isNotLoggedInResponse(res)) {
                retried = true;
                log(`   ⚠️ token 失效，重新获取微信 code 并登录...`);
                this.cookieStore.invalidate(this.openid, this.nickname);
                await this.ensureToken(true);
                continue;
            }

            return res;
        }
    }

    async getIndexInfo() {
        log("\n📋 获取签到信息...");
        const res = await this.businessRequest({
            method: "POST",
            url: "https://cvg.17usoft.com/activity/signInCash/getIndexInfo",
            headers: this.getHeaders(),
            data: this.getBaseData(),
        });
        if (res.data && res.data.code === 1000 && res.data.data) {
            const info = res.data.data;
            log(`   ✅ 获取签到信息成功`);
            log(`   💰 积分余额: ${info.pointsBalance || 0}`);
            log(`   📊 已签到天数: ${info.signedDays || 0}/${info.requiredSignedDays || 0}`);
            log(`   🎯 签到状态: ${info.actionStatus || '未知'}`);
            log(`   🎁 开奖状态: ${info.actionStatus === 'DRAWED' ? '已开奖' : '未开奖'}`);
            log(`   🕐 开奖时间: ${info.drawOpenTime || '未知'}`);
            if (info.qualified !== undefined) {
                log(`   ✅ 是否达标: ${info.qualified ? '是' : '否'}`);
            }
            if (info.availableMakeupCards !== undefined) {
                log(`   🃏 补签卡: ${info.availableMakeupCards}张`);
            }
            return info;
        } else {
            log(`   ❌ 获取签到信息失败: ${res.data?.message || '未知'}`);
            return null;
        }
    }

    async getTaskInfo() {
        log("\n📋 获取任务信息...");
        const res = await this.businessRequest({
            method: "POST",
            url: "https://cvg.17usoft.com/activity/signInCash/getTaskInfo",
            headers: this.getHeaders(),
            data: this.getBaseData(),
        });
        if (res.data && res.data.code === 1000 && res.data.data) {
            return res.data.data;
        } else {
            log(`   ❌ 获取任务信息失败: ${res.data?.message || '未知'}`);
            return null;
        }
    }

    async doSignIn() {
        log("\n📝 开始签到...");
        const res = await this.businessRequest({
            method: "POST",
            url: "https://cvg.17usoft.com/activity/signInCash/signIn",
            headers: this.getHeaders(),
            data: this.getBaseData(),
        });
        if (res.data && res.data.code === 1000) {
            const data = res.data.data || {};
            log(`   ✅ 签到成功！+${data.rewardPoints || 0}分`);
            log(`   💰 积分余额: ${data.pointsBalance || 0}`);
            return true;
        } else {
            log(`   ❌ 签到失败: ${res.data?.message || '未知'}`);
            return false;
        }
    }

    async doDraw() {
        log("\n🎰 开始执行开奖...");
        const res = await this.businessRequest({
            method: "POST",
            url: "https://cvg.17usoft.com/activity/signInCash/draw",
            headers: this.getHeaders(),
            data: this.getBaseData(),
        });
        if (res.data && res.data.code === 1000) {
            const data = res.data.data || {};
            log(`   ✅ 开奖成功！`);
            log(`   🎁 奖励: ${data.prizeName || '未知'} ${data.amount ? `+${data.amount}元` : ''}`);
            if (data.lotteryRecordId) {
                log(`   📝 记录ID: ${data.lotteryRecordId}`);
            }
            return true;
        } else {
            log(`   ❌ 开奖失败: ${res.data?.message || '未知'}`);
            return false;
        }
    }

    async completeTask(taskType) {
        const requestData = {
            ...this.getBaseData(),
            taskType: taskType,
        };
        const res = await this.businessRequest({
            method: "POST",
            url: "https://cvg.17usoft.com/activity/signInCash/completeTask",
            headers: this.getHeaders(),
            data: requestData,
        });
        if (res.data && res.data.code === 1000) {
            const taskRecordId = typeof res.data.data === 'string'
                ? res.data.data
                : (res.data.data?.taskRecordId || res.data.data?.recordId || "");
            if (taskRecordId) {
                return taskRecordId;
            }
        }
        return null;
    }

    async claimTaskReward(taskRecordId) {
        const requestData = {
            ...this.getBaseData(),
            taskRecordId: taskRecordId,
        };
        log(`   🎁 领取奖励 taskRecordId=${taskRecordId}...`);
        const res = await this.businessRequest({
            method: "POST",
            url: "https://cvg.17usoft.com/activity/signInCash/claimTaskReward",
            headers: this.getHeaders(),
            data: requestData,
        });
        if (res.data && res.data.code === 1000) {
            const data = res.data.data || {};
            log(`   ✅ 领取成功！+${data.rewardPoints || 0}分`);
            log(`   💰 积分余额: ${data.pointsBalance || 0}`);
            return true;
        } else {
            log(`   ⚠️ 领取结果: ${res.data?.message || '领取失败'}`);
            return false;
        }
    }

    // 上报
    async checkInReport() {
        log("\n📤 执行上报事件...");
        const requestData = {
            ...this.getBaseData(),
            shareId: "99c4cc5db188d952e708ba3826cac37b5c3ff63ec81d86e24bf97fe6d64e2773f62635fd593ce3c2577d6bd001f10403da69f502106a89dcfd57ff30f9b6898830082b7c3c8e0943065d93eedd03b63e",
        };

        const res = await this.businessRequest({
            method: "POST",
            url: "https://cvg.17usoft.com/activity/signInCash/help",
            headers: this.getHeaders(),
            data: requestData,
        });

        if (res.data && res.data.code === 1000) {
            log(`   ✅ 上报！`);
            return true;
        } else {
            log(`   ✅ 上报`);
            return false;
        }
    }

    async doTasks() {
        log("\n📝 执行任务...");
        const taskData = await this.getTaskInfo();
        if (!taskData) {
            log("   ❌ 无任务数据");
            return;
        }

        const taskList = taskData.taskList || [];
        const pendingRewards = taskData.pendingRewardList || [];

        log(`   共${taskList.length}个任务`);
        log(`   待领取奖励: ${pendingRewards.length}个`);

        for (const task of taskList) {
            const statusText = task.completed ? '✅已完成' : task.couldComplete ? '▶️可完成' : '⬜未完成';
            log(`   [${task.title}] ${statusText} (${task.progress}/${task.targetCount}) +${task.rewardPoints}分`);
        }

        if (pendingRewards.length > 0) {
            log(`\n   🎁 开始领取待领取奖励...`);
            for (const reward of pendingRewards) {
                const taskRecordId = reward.taskRecordId;
                if (taskRecordId) {
                    await this.claimTaskReward(taskRecordId);
                    await wait(2000);
                }
            }
        }

        for (const task of taskList) {
            if (task.completed || !task.couldComplete) continue;

            if (task.completionMode === "BROWSE") {
                log(`\n   📝 处理浏览任务: ${task.title}`);
                const taskRecordId = await this.completeTask(task.type);
                if (taskRecordId) {
                    await wait(2000);
                    await this.claimTaskReward(taskRecordId);
                }
                await wait(3000);
            }

            if (task.completionMode === "SIGN" && task.progress >= task.targetCount) {
                log(`\n   🎁 签到任务达标: ${task.title}`);
                const taskRecordId = await this.completeTask(task.type);
                if (taskRecordId) {
                    await wait(2000);
                    await this.claimTaskReward(taskRecordId);
                }
                await wait(2000);
            }
        }
    }

    async run() {
        try {
            // 按要求：先尝试 openid 对应缓存登录态；没有/失效时才走 VMPF 取 code -> 业务登录。
            await this.ensureToken(false);

            const indexInfo = await this.getIndexInfo();

            // 1. 签到
            if (indexInfo && indexInfo.actionStatus === 'SIGN') {
                await this.doSignIn();
            } else if (indexInfo) {
                log(`\n⏸️ 今日已签到，跳过签到`);
            }

            await wait(2000);

            // 2. 执行任务
            await this.doTasks();

            await wait(2000);

            // 3. 检查是否需要开奖
            const currentInfo = await this.getIndexInfo();
            if (currentInfo && currentInfo.qualified) {
                if (currentInfo.actionStatus !== 'DRAWED') {
                    log(`\n🎯 签到已达标(${currentInfo.signedDays}/${currentInfo.requiredSignedDays})，准备开奖...`);
                    await this.doDraw();
                } else {
                    log(`\n✅ 已开奖，无需重复操作`);
                }
            } else if (currentInfo) {
                log(`\n⏸️ 签到未达标(${currentInfo.signedDays}/${currentInfo.requiredSignedDays})，无法开奖`);
            }

            await wait(2000);

            // 4. 上报
            await this.checkInReport();

            await wait(2000);

            // 5. 获取最终信息
            const finalInfo = await this.getIndexInfo();
            if (finalInfo) {
                log(`\n💰 最终积分: ${finalInfo.pointsBalance || 0}`);
                log(`📊 签到天数: ${finalInfo.signedDays || 0}/${finalInfo.requiredSignedDays || 0}`);
                log(`🎰 开奖状态: ${finalInfo.actionStatus === 'DRAWED' ? '已开奖' : '未开奖'}`);
            }
        } catch (e) {
            log(`\n❌ 执行异常: ${e.message || e}`);
        }
    }
}

async function runAccount(openid, index, cookieStore) {
    log(`\n${"=".repeat(60)}`);
    log(`账号[${index}] ${openid}`);
    log(`openid: ${openid}`);
    log("=".repeat(60));
    const runner = new SignInTask(openid, index, cookieStore);
    await runner.run();
}

(async () => {
    const cookieStore = new tcqdCookieStore(tcqd_COOKIE_FILE);

    log(`共找到${SERVERS.length}个账号，开始执行签到\n`);

    for (let i = 0; i < SERVERS.length; i++) {
        await runAccount(SERVERS[i], i + 1, cookieStore);
        if (i < SERVERS.length - 1) {
            log(`\n⏳ 等待10秒后处理下一个账号...`);
            await wait(10000);
        }
    }
})();
