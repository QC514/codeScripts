# VMPF 脚本改造文档

> **独立标准**：把旧平台脚本（8000 / VX_GO / YYB_GO：先拉账号列表、再另接口取 code）改成 VMPF 平台。
> 本文档自带全部代码模板，**无需参考任何其它脚本**。以后发「脚本 + 本文档」即可直接改。

---

## 1. 改动范围

只改 3 处，其余一律不动：

| # | 位置 | 旧写法 | 新写法 |
|---|---|---|---|
| 1 | 平台变量 | `WX8000_BASE_URL = "http://127.0.0.1:8000"` 等 | `VMPF_URL` / `VMPF_API_KEY`（环境变量，缺失即报错退出） |
| 2 | 账号来源 | `/accounts` 等接口拉账号 | 环境变量 `qingyun_openid`（openid 列表，`&` 或换行分隔） |
| 3 | 取 code | `/wxapp/getCode` 等（`{app_id,ref}` → `data.result.code`） | `POST {VMPF_URL}/api/wxapp/JSLogin`，体 `{Appid, Wxid}`，头 `X-Api-Key`，`Code===0` 时取 `Data.code` |

**不动**：业务接口/参数、code→业务登录流程、token 缓存（仍按 openid 作 key）、签到/任务/开奖逻辑、业务 headers/UA。

注意：旧平台给的 `nickname`/`unionId` 改后没有来源 → 日志直接用 openid，`unionId` 留空即可。

---

## 2. 取 code 标准代码（核心，照抄）

### JS

```js
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

// APP.appid 填原脚本用过的 AppID
async function getCode(openid) {
    try {
        const { data } = await axios.post(
            VMPF_URL + "/api/wxapp/JSLogin",
            { Appid: APP.appid, Wxid: openid },
            { timeout: 20000, proxy: false, headers: { "X-Api-Key": VMPF_API_KEY } },
        );
        const code = data && data.Code === 0 && data.Data && data.Data.code;
        if (!code) {
            console.log("获取code失败: " + JSON.stringify(data));
            return null;
        }
        return code;
    } catch (e) {
        console.log("获取code异常: " + e.message);
        return null;
    }
}
async function getWxCode(openid) { return await getCode(openid); }
```

业务代码里唯一要替换的调用：

```js
// 原：const code = await oldClient.getCode(openid);  （旧取码调用一律删掉）
const code = await getWxCode(openid);
if (!code) throw new Error("获取微信 code 失败");
// ↓ 原有业务登录流程（换 token、存缓存等）不动
```

### Python

```python
VMPF_URL = os.environ.get("VMPF_URL", "").rstrip("/")
VMPF_API_KEY = os.environ.get("VMPF_API_KEY", "")
# 多账号：& 或换行分隔
ACCOUNTS = [x.strip() for x in os.environ.get("qingyun_openid", "").replace("&", "\n").split("\n") if x.strip()]
if not VMPF_URL or not VMPF_API_KEY or not ACCOUNTS:
    raise SystemExit("未配置 VMPF_URL / VMPF_API_KEY / qingyun_openid")

# APPID 填原脚本用过的 AppID
def get_code(wxid):
    req = urllib.request.Request(
        VMPF_URL + "/api/wxapp/JSLogin",
        data=json.dumps({"Appid": APPID, "Wxid": wxid}).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Api-Key": VMPF_API_KEY},
        method="POST",
    )
    try:
        j = json.loads(urllib.request.urlopen(req, timeout=30).read().decode("utf-8"))
    except Exception as e:
        raise RuntimeError(f"VMPF JSLogin 请求失败: {e}")
    if j.get("Code", -1) != 0:
        raise RuntimeError(f"VMPF JSLogin 失败: {json.dumps(j, ensure_ascii=False)[:200]}")
    code = (j.get("Data") or {}).get("code")
    if not code:
        raise RuntimeError("VMPF JSLogin 未返回 code")
    return code
```

业务代码里唯一要替换的调用：

```python
code = get_code(openid)   # 原取码调用删掉
# ↓ 原有业务登录流程（换 token、存缓存等）不动
```

（需要 `import os / json / urllib.request`；若原脚本用自带的 `_http` 助手，也可以沿用其函数签名。）

---

## 3. 改完后的文件结构（自上而下）

1. 头注释：VMPF 配置说明 + `cron`
2. 依赖 `require` / `import`
3. 第 2 节的环境变量读取 + 缺失退出
4. 第 2 节的 `getCode`/`getWxCode`（JS）或 `get_code`（Python）
5. 原有工具/缓存函数（log、wait、json 读写等，保留）
6. 原业务逻辑：只把「取 code」调用换成 `getWxCode(openid)` / `get_code(openid)`
7. 主流程遍历账号（openid 即账号标识）：

```js
for (let i = 0; i < SERVERS.length; i++) {
    await runAccount(SERVERS[i], i + 1);
    if (i < SERVERS.length - 1) await wait(10000); // 账号间隔
}
```

---

## 4. 提交前检查清单

- [ ] 无残留旧平台内容：`8000` / `WX8000` / `getAccounts` / `/accounts` / `wxapp/getCode` / `VX_GO` / `YYB_GO`
- [ ] `VMPF_URL` / `VMPF_API_KEY` / `qingyun_openid` 均为环境变量，缺失即退出
- [ ] JSLogin：体 `{Appid, Wxid}`、头 `X-Api-Key`、判定 `Code === 0` 取 `Data.code`
- [ ] 取 code 失败/异常有日志且不空跑（返回 null 或抛错）
- [ ] 业务接口、参数、缓存、登录换算流程未被动过
- [ ] JS 过 `node --check`；Python 过 `python -m py_compile`
