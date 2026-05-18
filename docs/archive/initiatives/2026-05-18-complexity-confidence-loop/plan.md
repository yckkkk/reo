# 计划

## 成功标准

本 initiative 的成功标准是把 `$complexity-optimizer` 已发现问题转化为代码、测试、验证和文档上的稳定改进，并用复审循环证明当前快照没有已知未处理复杂度问题。

## 执行顺序

1. 先处理 P1：全局扫描重复、finalized audio 大 Buffer、转写片段合并、Memory Studio 全量渲染。
2. 再处理 P2：finalized audio duplicate scan、SegmentSupplement transcript save 重扫、音频资源缓存、验证门禁重复编译、Vitest 串行瓶颈。
3. 再处理 P3：长转写预览 DOM、visibility refresh、App.test 集成负担、Memory Studio 测量默认、暂停预览 chunk 统计。
4. 最后处理 P4：main test 默认批处理、像素脚本扫描、测试 flush、format check 范围。
5. 每批完成后运行对应 focused tests；全部完成后运行 `npm run verify:quick`。
6. 复杂度扫描统一通过 `npm run complexity:scan` 进入 repo-local wrapper；不直接调用 skill 内部脚本。
7. 验证通过后启动多个 subagent 复审；新增问题重新按优先级插入执行。
8. 最后一轮只处理明确必须修复项，复审无阻断项后进行最终自信审查并收口。

## 设计边界

- 不引入新的 runtime surface、IPC、DB、Zustand store 或持久 schema。
- 不降低 Electron sandbox、preload、IPC、文件真源、duplicate segment id 安全边界。
- 不用兼容层保留旧路径；Reo 未发布，修复应直接表达当前正确模型。
- 低优先级问题也作为需要处理的任务，只有源码事实证明收益不成立或风险大于收益时才记录为无需改动。
- raw scanner 对本地验证脚本、agent-local wrapper 或视觉测量脚本的线性扫描提示，需要先按输入规模、运行频率和 runtime 暴露面分类；bounded tooling 噪音不扩大为产品 runtime 修复。
