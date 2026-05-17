# 任务

- [x] E：`bigmodel_async` vs `bigmodel` endpoint 校正 + probe 计费核实（独立技术调研）。归档于 `docs/archive/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/`；当前 endpoint 三元组为 SeedASR 2.0 推荐配置，无需调整。决策记录于 `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md`。
- [ ] B：未转录状态可视化（含 B0 未转录原因语义模型 + 跨页面凭证失效提示）。
- [ ] C：网络或凭证恢复后的自动轮询补转录（含 C0 离线/批处理引擎合同 + 后台任务 lifecycle）。
- [ ] D：转录 More 菜单与手动重新生成转录（复用 C 的引擎与 B 的状态语义）。
