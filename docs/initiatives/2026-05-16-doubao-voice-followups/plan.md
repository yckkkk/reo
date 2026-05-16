# 计划

## 下一步入口

下一 session 从 B/C/D/E 中选择一项，按以下顺序执行：

1. brainstorm：重新确认用户目标、当前产品事实、边界和成功标准。
2. spec：创建新的 `docs/specs/YYYY-MM-DD-HHMM-*`，写清产品状态机、IPC/data/UI/flow/quality 边界和验证证据。
3. plan：在实现前完成批判性审查，校准官方文档、当前代码和测试路径。
4. 实现：按新 plan 的任务边界做 TDD、运行对应验证、独立提交。
5. 验证：UI 可见切片完成运行时视觉证据；endpoint 或 API 语义切片完成官方/API 证据、targeted main-process tests 或 probe 证据；所有切片完成 `verify:quick` 和归档。

## 拆分顺序

1. B：先做用户可见的未转录状态表达，避免后续补偿机制没有可解释 UI。
2. C：在 B 有明确状态承载后，再设计自动轮询补转录。
3. D：在状态和补偿边界清楚后，再做手动重新生成入口。
4. E：独立验证 endpoint 语义、计费、延迟和稳定性，不与 UI/补偿改动混合。

## 禁止项

- 不在没有新 spec 的情况下添加 hidden retry、More menu、补转录后台任务或 endpoint fallback。
- 不引入环境变量凭证、双 header 鉴权或平台密钥路径。
- 不把 endpoint 选择写成 runtime 自动切换，除非新 spec 明确证明需要并覆盖安全、计费和恢复边界。
