# 长期任务

`initiatives/` 记录需要跨 session 推进的长期任务。

## 当前状态

当前商业化横切长期轨道：

- `2026-05-14-commercial-infrastructure-foundation`

当前产品或代码开发 active initiative：

- `2026-05-14-segment-attachment-transcript-panel`

## 使用规则

- 只有跨多个 session 的任务才创建 initiative。
- 一个 initiative 必须有明确完成条件。
- 默认最多 1 个产品或代码开发 active initiative；商业化基础设施 initiative 属于横切长期轨道，可以与一个产品或代码开发 active initiative 并行。
- 商业化并行例外不改变 spec 纪律：每个 session 仍然只推进一个可验证工作单元。
- 超过上述边界时先收口、取消或归档。
- 每个 session 仍然只执行一个可验证工作单元。
- 当前工作单元记录在 `docs/specs/*`；没有进行中的工作单元时该目录应为空。
- 创建新 spec 前，必须确认 `docs/specs/*` 为空或只包含当前任务。
- 工作单元收口后，任务证据移入 `docs/archive/specs/*`。
- initiative 完成、取消或失效后，移入 `docs/archive/initiatives/*`。
- 归档子目录在首次写入时创建；不保留空占位目录。
- initiative 不能覆盖 `docs/current/*` 或 `docs/decisions/*`。
- `tasks.md` 只记录跨工作单元里程碑，不复制 spec 执行清单。
- 长期任务的完成条件或范围不再匹配当前任务时，创建新的 initiative。
- 读取归档时先搜索，再只打开相关文件。

## 最小结构

```text
docs/initiatives/YYYY-MM-DD-slug/
  README.md
  plan.md
  tasks.md
```

不要为没有实际推进价值的任务创建 initiative。
