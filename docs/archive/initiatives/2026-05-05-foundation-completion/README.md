# Foundation Completion Initiative

## 状态

Completed；归档于 `docs/archive/initiatives/2026-05-05-foundation-completion/`。

## 目标

在正式产品功能开发前，尽可能补齐 Reo 的基础建设，同时保持 one-slice-at-a-time 纪律。

## 审查结论

10 天 initiative 只有在作为长期路线图时合理。它不能被执行成一个 10 天大实现，也不能把多个基础面一次性塞进同一个 session。每个 session 仍然必须有独立 spec、明确验收门槛、真实验证和收口归档。

更小替代方案是只规划下一个 2 到 3 个 foundation slice，例如 Quality/Test、Electron runtime readiness、Data foundation。当前选择创建 10 天 initiative，是因为它只定义顺序、门槛和停止条件，不授权直接安装依赖或实现功能。

## 读取入口

- `spec.md`：scope、成功标准、非目标、官方资料核对。
- `plan.md`：10 个子任务排序、依赖、每个 slice 的验收门槛。
- `tasks.md`：跨 session 任务状态。
- `review.md`：plan engineering review、失败模式、测试策略、独立挑战。
- `closeout.md`：最终压缩结果、verification matrix、remaining gates。
- `handoff.md`：下一 session handoff。

## 当前边界

- 不做产品功能。
- 不做 agent runtime、voice、DB domain model、auth product flow 或 business screen。
- 不一次性安装已选型依赖。
- 只有当前 slice 证明存在真实用途，才安装或配置对应依赖。
- 当前没有真实 reusable component consumer，因此默认不得初始化 shadcn/ui。
- 不新增 preload、IPC、DB、auth、updater、packaging、logging 或 Sentry，除非当前 slice spec 明确覆盖并同步 `docs/current/*`。

## 完成条件

- 10 个子任务全部完成、取消或明确转出。
- 所有仍然有效的长期结论已压缩回 `docs/current/*` 或 `docs/decisions/*`。
- 所有 session spec 已归档到 `docs/archive/specs/*`。
- `tasks.md` 无未解释的开放项。
- 每个 slice 的验证证据保存在对应 `docs/archive/specs/*/verification.md`。
- Task 10 closeout 必须把仍然有效的验证矩阵压缩到本 initiative，并记录最后一次 `npm run verify:quick`、`npm run build`、docs lifecycle 检查和独立 review 结果。
- initiative 移入 `docs/archive/initiatives/2026-05-05-foundation-completion/`。
