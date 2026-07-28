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

// name: 国乐酱酒
// cron: 0 40 9 * * *
const axios = require("axios");

// ===================== 配置项 =====================
// PushPlus 通知Token（在青龙面板环境变量中设置 PLUSPLUS_TOKEN）
const PLUSPLUS_TOKEN = process.env.PLUSPLUS_TOKEN || "";

// 从环境变量 YYB_GO 读取内网服务器，多条换行分隔
let SERVERS = [];
const envYybGo = process.env.YYB_GO || "";
if (envYybGo) {
    SERVERS = envYybGo
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
}
// 校验是否存在有效服务地址
if (SERVERS.length === 0) {
    console.error("❌ 错误：未读取到环境变量 YYB_GO 或无有效IP端口！");
    console.error("配置示例（变量值多条换行填写）：");
    console.error("192.168.1.21:8088");
    console.error("192.168.31.111:8088");
    process.exit(1);
}
console.log(`✅ 成功读取 ${SERVERS.length} 台内网服务器：`);
SERVERS.forEach(item => console.log(` - ${item}`));
console.log("----------------------------------------\n");

// 固定配置
const APP_ID = "wxeff120e4d11594c0";
const BASE = "https://member.guoyuejiu.com";
const defaultUserAgent = "Mozilla/5.0 (Linux; Android 15; 22061218C Build/AQ3A.250226.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36 XWEB/1460075 MMWEBSDK/20260202 MMWEBID/6435 MicroMessenger/8.0.71.3080(0x18004739) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android";

// ===================== 工具 =====================
const sleep = ms => new Promise(r => setTimeout(r, ms));
function jitter(base) {
  return base + Math.random() * base;
}

// PushPlus通知函数
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

// ===================== 获取微信 Code =====================
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
            app_id: APP_ID
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


// ===================== Code 登录 =====================
async function codeLogin(server) {
  let code = await getCode(server);
  if (!code) return null;

  try {
    let payload = {
      "avatarUrl": "https://thirdwx.qlogo.cn/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg/132",
      "city": "",
      "country": "",
      "gender": 0,
      "nickName": "微信用户",
      "province": "",
      "code": code,
      "source": 2
    };

    let { data } = await axios.post(`${BASE}/api/user/wxLogin`, payload, {
      headers: {
        "User-Agent": defaultUserAgent,
        "Content-Type": "application/json"
      },
      timeout: 10000
    });

    if (data.code === 0) {
      console.log(`✅ [${server}] 登录成功`);
      return data.data.authorization;
    }
  } catch (e) {
    console.log(`❌ [${server}] 登录失败：`, e.message);
  }
  return null;
}

// ===================== 签到 =====================
async function sign(server, token) {
  let signResult = { success: false, msg: "", spanSumDays: 0 };
  try {
    let { data } = await axios.get(`${BASE}/api/sign/daily/sign`, {
      headers: {
        "Authorization": "Mer" + token,
        "User-Agent": defaultUserAgent,
        "Referer": "https://servicewechat.com/wxeff120e4d11594c0/87/page-frame.html"
      }
    });
    if (data.code === 0) {
      signResult.success = true;
      signResult.msg = "签到成功";
      signResult.spanSumDays = data.data.spanSumDays;
      console.log(`📊 [${server}] 签到成功 | 连续 ${data.data.spanSumDays} 天`);
    } else {
      signResult.msg = data.message;
      console.log(`❌ [${server}] 签到失败：${data.message}`);
    }
  } catch (e) {
    signResult.msg = "签到异常：" + e.message;
    console.log(`❌ [${server}] 签到异常：`, e.message);
  }
  return signResult;
}

// ===================== 查询积分 =====================
async function getPoints(server, token) {
  let pointResult = { success: false, score: 0, msg: "" };
  try {
    let { data } = await axios.get(`${BASE}/api/user/info`, {
      headers: {
        "Authorization": "Mer" + token,
        "User-Agent": defaultUserAgent
      }
    });
    if (data.code === 0) {
      pointResult.success = true;
      pointResult.score = data.data.score;
      console.log(`💰 [${server}] 总积分：${data.data.score}`);
    }
  } catch (e) {
    pointResult.msg = "查询积分异常：" + e.message;
    console.log(`❌ [${server}] 查询积分异常：`, e.message);
  }
  return pointResult;
}

// 单个服务器执行逻辑
async function runServer(server) {
  let result = {
    server: server,
    loginSuccess: false,
    signResult: {},
    pointResult: {}
  };

  console.log(`\n===== 国乐酱酒 - ${server} 账号 =====`);
  await sleep(jitter(1500));
  
  // 登录
  let token = await codeLogin(server);
  if (!token) {
    result.loginSuccess = false;
    console.log(`===== ${server} 登录失败，跳过后续操作 =====`);
    return result;
  }
  result.loginSuccess = true;

  // 签到 + 查询积分
  result.signResult = await sign(server, token);
  result.pointResult = await getPoints(server, token);
  await sleep(jitter(1000));

  return result;
}

// ===================== 主程序 =====================
(async () => {
  console.log("===== 国乐酱酒多账号任务启动 =====");
  const results = [];

  // 顺序执行所有服务器
  for (const server of SERVERS) {
    const res = await runServer(server);
    results.push(res);
    // 账号间间隔2秒
    await sleep(2000);
  }

  // 汇总结果并推送通知
  let notifyContent = "### 国乐酱酒多账号任务执行结果\n";
  results.forEach(res => {
    notifyContent += `\n#### ${res.server}
- 登录状态：${res.loginSuccess ? "成功" : "失败"}
`;
    if (res.loginSuccess) {
      notifyContent += `- 签到状态：${res.signResult.success ? "成功" : "失败"}
- 签到信息：${res.signResult.msg}
- 连续签到天数：${res.signResult.spanSumDays}
- 总积分：${res.pointResult.success ? res.pointResult.score : "查询失败"}
`;
    }
  });

  await sendPlusPlusNotification("国乐酱酒多账号任务完成", notifyContent);
  console.log("\n===== 所有账号执行完成 =====");
})();
