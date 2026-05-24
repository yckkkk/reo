# Spec — Note CM6 Click Precision Regression

- 创建时间：2026-05-23 04:02 America/Los_Angeles
- 状态：active
- 范围：Note CM6 read preview 点击进入编辑的位置精度

## Objective

修复 Note CM6 read preview 中鼠标点击无法落到对应 Markdown source line 的回归。用户真实鼠标点击某一可视行时，编辑态必须进入同一 source line，不能跳到上一行、下一行或相邻 block。

## Constraints

- 不改变 `memory.md`、`segment.md`、`supplement.md` 文件真源。
- 不恢复 React line mapping、手写 preview DOM 或第二套 selection/scroll 状态。
- 不用固定 y-offset 或按窗口高度补偿。
- 行为变更走 RED -> GREEN -> REFACTOR。

## Success Criteria

- Focused regression 覆盖连续可视行点击，每个点击都落回同一 source line。
- 完整 Markdown fixture 的运行时点击验证通过。
- `npm run dev` 能启动，用户可用真实鼠标复测。
