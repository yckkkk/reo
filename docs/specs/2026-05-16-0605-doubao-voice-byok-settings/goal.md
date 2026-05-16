# Goal

本次任务的最终交付是：让 Reo 用户可以通过 Sidebar 左下角齿轮 + 「设置」按钮进入同窗口的 Settings 路由，在「语音」类目下用一个独立 toggle 启用/停用流式语音识别，并在启用时录入并验证自己的火山引擎豆包大模型流式语音识别 X-Api-Key（新版控制台单 header 鉴权）。

## Locked Decisions

1. BYOK：用户自带 X-Api-Key，Reo 不持有平台密钥。
2. 本次范围仅 spec A；B/C/D/E 严禁本次扩展。
3. X-Api-Key 使用 Electron safeStorage 加密写入 userData JSON。
4. 入口与形态使用同一个 BrowserWindow 内的 appMode 路由切换，不引入第二窗口。
5. 保存时同步执行最小 WebSocket 握手 probe，1s timeout，不发音频。
6. 代码侧完全删除 `REO_DOUBAO_ASR_APP_ID` / `REO_DOUBAO_ASR_ACCESS_TOKEN` 和旧双 header fallback。
7. Toggle 默认 OFF，并与 key 配置状态独立。

## Stop Conditions

1. 实际实现与 locked decisions 任一项冲突，且无法在当前 spec 内局部修正。
2. 出现破坏性 git 操作请求：force push、push 到非本地 main、清除 working tree、rebase published commits、删除 `.git` 子树。
3. 任一 task 的 verify 命令连续 3 次失败且根因不明。
4. 安全敏感决策需要偏离基线：暴露密钥到 IPC payload / 日志 / 内容文件、关闭 sandbox / contextIsolation / nodeIntegration、降级 safeStorage 到明文。
5. 需要安装计划外依赖；`@radix-ui/react-switch` 是计划内，其它依赖必须停下请示。
6. 用户本地 `.env.local` 含未识别字段且需要主动删除。
7. 发现 spec / plan 有 fundamental flaw，需要 redesign 而不是局部修订。

## Follow-Up Reserve

这些事项只保留为后续任务指针，本次禁止扩展：

- B：未转录状态可视化。
- C：网络/凭证恢复后自动轮询补转录。
- D：转录 More 菜单 + 手动重新生成转录。
- E：`bigmodel_async` vs `bigmodel` endpoint 校正。
