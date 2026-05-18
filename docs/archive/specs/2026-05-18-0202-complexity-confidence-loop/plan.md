# 计划

## Phase 1

处理 P1 热路径，优先选择局部可证明的行为单元：

- transcript segment 批量归并。
- finalized audio 补转录流式临时文件路径。
- automatic backfill 单次文件真源扫描。
- Memory Studio Segment strip windowing。

## Phase 2

处理 P2 缓存和验证效率：

- duplicate segment id 扫描缓存或索引。
- SegmentSupplement transcript save 复用同次 projection。
- selected audio resource LRU。
- main TypeScript 编译复用。
- renderer-node / renderer-jsdom 进一步拆分。

## Phase 3

处理 P3/P4 剩余任务：

- 长 transcript preview、visibility refresh、App.test 拆分。
- measurement script 默认采样。
- pause preview byte length cache。
- main test batch、titlebar pixel scan、flush helper、format check active scope。

## Phase 4

收口：

- focused tests。
- `npm run verify:quick`。
- 多 subagent `$complexity-optimizer` 复审。
- 新发现循环修复。
- 最终自信审查。

## 最后一轮收口规则

- 复杂度扫描入口统一使用 `npm run complexity:scan`，由 repo wrapper 固定 root、exclude 和错误提示。
- 最后一轮 subagent 复审只处理明确影响 runtime、验证可靠性或当前文档真源的必须修复项。
- raw scanner 对 bounded local tooling 的线性扫描提示按运行频率和输入上限分类，不扩大为产品 runtime 改动。
