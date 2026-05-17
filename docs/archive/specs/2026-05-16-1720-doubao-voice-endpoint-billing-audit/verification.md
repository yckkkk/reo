# Verification

## 工作产出

- [x] `README.md` 记录时间、工作单元、范围、locked decisions、stop conditions
- [x] `goal.md` 记录调研产出口径与信息源优先级
- [x] `plan.md` 记录调研方法、决策分支 A/B/C/D、验证标准
- [x] `findings.md` 汇总 5 个调研项的证据、结论与已知证据缺口
- [x] `decision.md` 选定分支 A（不改代码）并写明 follow-up
- [x] `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md` 固化当前 endpoint 三元组、calibrate 依据与"为什么 SeedASR 2.0 而非 BigASR 1.0"
- [x] `docs/initiatives/2026-05-16-doubao-voice-followups/plan.md` 在 C 节追加 C0 引擎选型、并发上限、凭证一致性的调研输入指针
- [x] `docs/initiatives/2026-05-16-doubao-voice-followups/tasks.md` 将 E 标记为已完成并链到归档路径与 ADR

## 验证命令

`npm run verify:quick` 结果：

- Vitest：40 test files / 386 tests passed
- ESLint：通过
- Prettier：All matched files use Prettier code style
- 运行时长：约 228 秒

无任何代码改动；本次 spec 只生成文档（spec 目录 + decisions + initiative 更新）。

## 决策分支

落到 [分支 A：当前 endpoint 三元组合法且 probe 不调整](./decision.md)，不进入分支 B/C/D 的实施或停下请示路径。

## 不在范围

- 没有触发任何付费的真实音频转录调用
- 没有 dev server 或 packaged app runtime evidence（本次为纯文档调研 spec，无 UI 或运行时改动）
- 没有截图（无 UI 改动）

## 归档准备

本 spec 满足 CLAUDE.md 归档条件：

- spec objective 已完成（调研结论 + ADR + initiative follow-up 入库）
- 长期事实已压缩入 `docs/decisions/0004-doubao-voice-asr-endpoint-baseline.md`
- 跨 session 剩余工作（B/C/D）由现有 active initiative 承接

归档动作：`mv docs/specs/2026-05-16-1720-doubao-voice-endpoint-billing-audit/ docs/archive/specs/`。
