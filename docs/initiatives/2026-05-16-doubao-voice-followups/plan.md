# 计划

## 下一步入口

下一 session 从 B/C/D/E 中选择一项，按以下顺序执行：

1. brainstorm：重新确认用户目标、当前产品事实、边界和成功标准。
2. spec：创建新的 `docs/specs/YYYY-MM-DD-HHMM-*`，写清产品状态机、IPC/data/UI/flow/quality 边界和验证证据。
3. plan：在实现前完成批判性审查，校准官方文档、当前代码和测试路径。
4. 实现：按新 plan 的任务边界做 TDD、运行对应验证、独立提交。
5. 验证：UI 可见切片完成运行时视觉证据；endpoint 或 API 语义切片完成官方/API 证据、targeted main-process tests 或 probe 证据；所有切片完成 `verify:quick` 和归档。

## 拆分顺序

1. E：独立技术调研，核实 `bigmodel_async` vs `bigmodel` 的官方语义、计费窗口、并发限速和 probe 是否计费；输出"是否需要调整 endpoint / resource id / model_name"决策。先做的理由：C 的后台引擎选型严重依赖 E 的结论，E 在后会导致 C 反复返工。
2. B：未转录状态可视化。spec 头部先做 B0 决策——未转录原因的语义模型（disabled / credentials-missing / live-failed-needs-backfill / user-cleared / never-attempted）写在 `segment.md` frontmatter、`.reo/objects/*` manifest 还是 index 投影；UI 层同批覆盖 Memory Studio、RecordingOverlay 和 Sidebar 设置入口三处可视化，包含凭证失效的跨页面提示。
3. C：自动补转录。spec 头部先做 C0 决策——基于 E 的结论选定引擎合同（复用 streaming 还是 offline batch），定义后台任务 lifecycle 与 workspace handle 的归属、并发上限、退出/lock-lost 中止语义。E 的调研已留下以下 C0 输入：
   - 推荐引擎：离线极速版 `POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`，resource id `volc.bigasr.auc_turbo`；单次请求同步返回完整转录，支持 base64 编码音频字节直接上传（无需公网 URL），与 Reo 本地文件真源契合。
   - C0 必须直接验证：(a) 是否存在 SeedASR 2.0 对应的离线极速版（与实时一致代）；(b) 单次请求的音频时长上限；超出上限需切换到异步 `auc/bigmodel/submit` + `auc/bigmodel/query`；(c) 现有 X-Api-Key 是否同时授权该 AUC endpoint，或需 voice settings 增加字段。
   - 后台并发上限初始 1（串行 FIFO 处理未转录集合），不依赖并发包月；后续若需要更高吞吐，由 C 实现读取火山 QPS 查询接口 `open.volcengineapi.com` 调整。
   - 详见 `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md` 与 `docs/archive/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/`。
4. D：转录 More 菜单与手动重新生成。复用 C 的引擎与 B 的状态语义，处理手动覆盖 vs 自动只补缺的策略边界。

## 禁止项

- 不在没有新 spec 的情况下添加 hidden retry、More menu、补转录后台任务或 endpoint fallback。
- 不引入环境变量凭证、双 header 鉴权或平台密钥路径。
- 不把 endpoint 选择写成 runtime 自动切换，除非新 spec 明确证明需要并覆盖安全、计费和恢复边界。
- 不跳过 E 直接进入 C；C 的引擎选型必须以 E 的官方文档结论为前提。
- 不把 B 缩减成只改文案；未转录原因语义模型必须在 B 的 spec 内显式落地，否则 C/D 无可参照真源。
