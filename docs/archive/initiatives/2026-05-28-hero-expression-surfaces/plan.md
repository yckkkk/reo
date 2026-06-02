# Plan — Hero 表达入口建设

每个 Hero 表达入口是一个独立可验证工作单元，按需在 `docs/specs/*` 开 spec 推进；本 plan 只列里程碑顺序与依赖，不复制 spec 执行清单。

## 里程碑

1. **FAB SpeedDial trigger Hero 化** — token 已就位，只改 consumer，风险最低，先做。
2. **MemoryIcon primitive** — 新建并接入 Hero token；前置确认有真实 consumer 页面，否则不预先造（shadcn 边界规则）。
3. **RecordingOverlay 主 CTA + surface aurora** — 依赖录音 overlay 现有行为不回归（live ASR、recovery snapshot、PCM tail、pause/scrub/resume、completion backfill、recovery marker flush）。
4. **Segment 渐变预览卡** — Memory hue tint，依赖 hue 派生策略（hue 在 renderer 派生，不进 metadata / DB）。

## 依赖与约束

- 每个里程碑单独开 spec、单独运行时视觉验证（浅色/深色）。
- 设计强度以 `DESIGN.md`「融洽」判据为准；用户审美偏克制，brand-gradient/specular 的最终强度需运行时核对，必要时下调或退役。
- 启动任一里程碑前，先确认 `docs/specs/*` 已收口为空。
