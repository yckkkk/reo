# 复杂度收敛循环

## Objective

修复当前代码库已发现的复杂度、性能和验证效率问题，并在每轮修复后通过 `$complexity-optimizer` 多 subagent 复审继续发现剩余问题，直到当前证据下没有已知未处理问题。

## 完成条件

- P1-P4 已知问题全部处理，低优先级问题也有明确修复或当前事实下无需改动的证据。
- 每个行为改动都有对应 RED、GREEN、REFACTOR 证据。
- `npm run verify:quick` 在当前快照通过。
- 修复完成后再次使用多个 subagent 运行 `$complexity-optimizer` 复审，并把新增发现纳入同一优先级循环。
- 最终自问“我对当前实现是否有事实上的 100% 信心”；若答案不是肯定，继续记录漏洞、制定修复并重复验证和复审。

## 当前工作单元

- `docs/specs/2026-05-18-0202-complexity-confidence-loop`
