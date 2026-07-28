# YYB_GO

YYB Go 适配版。

## 环境变量

| 变量名 | 格式 | 示例 |
|--------|------|------|
| `YYB_GO` | `地址@openid`，一行一个 | `172.17.0.4:8000@XXXXXXXXXX` |

## 青龙订阅

```
ql repo https://github.com/XYtaixu/YYB_GO.git "" "" "" ""
```

## 注意事项

- 不要带 `http://` 前缀
- 不要用容器名（如 `yyb-go`），用 IP
- 脚本不会同时执行，青龙定时任务需手动错开 cron
