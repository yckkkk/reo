# 豆包语音后续能力长期任务

## 状态

- 状态：active
- 类型：产品或代码开发 active initiative
- 当前阶段：B 已归档并通过 `npm run dev` 真机 E2E gate；C 已按 Turbo `audio.data` 路径完成并进入归档收口；下一步是 C→D readiness gate

## 目标

该 initiative 只承接豆包语音后续能力 B/C/D/E，确保每一项都通过独立 brainstorm → spec → plan → 实现 → 验证流程推进。

## 范围

| ID  | 名称                                         |
| --- | -------------------------------------------- |
| B   | 未转录状态可视化                             |
| C   | 网络或凭证恢复后的自动轮询补转录             |
| D   | 转录 More 菜单与手动重新生成转录             |
| E   | `bigmodel_async` vs `bigmodel` endpoint 校正 |

## 约束

- 每一项都必须独立创建新的 `docs/specs/YYYY-MM-DD-HHMM-*` 工作单元。
- 每一项都必须重新读取与本次改动范围相关的 `docs/current/*` 当前真源，并创建自己的 active spec 与 plan。
- 不合并 B/C/D/E；同一 session 只推进一个可验证工作单元。
- 不重新讨论已锁定决策：BYOK、safeStorage、同窗口 Settings、保存时 probe、不使用环境变量凭证或双 header 鉴权、toggle 默认 OFF、start 快照贯穿整段 live session。
- current 文档同步按实际触碰 surface 执行：IPC、安全和宿主边界更新 `electron.md`；query、cache 和 settings ownership 更新 `data.md`；UI state 和组件模式更新 `frontend.md`；lifecycle、retry、补偿和 background jobs 更新 `flow.md`；测试、错误、日志和验证规则更新 `quality.md`。
- C 不能按旧标准版 `audio.url` brief 实施；当前 C 结论以 `docs/archive/specs/2026-05-17-0512-doubao-voice-auto-backfill-turbo/` 与 ADR 0005 为准。

## 完成条件

- B/C/D/E 均完成、取消或转入更准确的 initiative。
- 已完成项的稳定结论压缩回 `docs/current/*` 或 `docs/decisions/*`。
- 对应 specs 已归档到 `docs/archive/specs/*`。
