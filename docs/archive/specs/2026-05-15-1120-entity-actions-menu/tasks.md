# 实体 More 菜单 Shell 动作扩展 — 任务状态

## 目标

把 Memory Space、Memory、Segment、SegmentSupplement 的 More 菜单统一扩展为三组动作：打开语义文件、在访达中显示目录、复制路径、重命名、删除或移除。路径解析和剪贴板写入只发生在 main process；renderer 只调用 typed bridge 方法并展示成功或失败反馈。

## 完成状态

| 阶段            | 状态 | 结果                                                                                                                            |
| --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| 契约基线        | 完成 | 新增 7 个 typed error code、15 个 IPC channel、15 个 request schema、统一 `{ ok: true }` response 和 preload bridge 方法。      |
| Main 路径解析   | 完成 | `EntityPathResolver` 覆盖四类实体，复用 workspace registry 与 `.reo/objects/*` manifest，校验 canonical root containment。      |
| Main Shell 动作 | 完成 | 15 个 handler 覆盖 reveal、open、copy absolute、copy relative；shell 与 clipboard 错误均映射 typed error envelope。             |
| Renderer 菜单   | 完成 | 四个 typed wrapper 复用 `EntityActionMenu`，四类实体保持对应 action identity，菜单包含 icon 与两条可见分割线。                  |
| 六个入口接线    | 完成 | Sidebar Memory Space、Titlebar Memory Space、Titlebar Memory、MemoryRail Memory、Segment card、SegmentSupplement tab 全部接入。 |
| 当前文档        | 完成 | `docs/current/electron.md`、`frontend.md`、`flow.md`、`data.md`、`product.md` 已压缩记录当前事实和边界。                        |
| 验证证据        | 完成 | 命令验证、运行时截图、剪贴板样本、缺失文件 error toast 与 Finder reveal 限制已写入 `verification.md`。                          |

## 行为核对

- [x] 六个 More 菜单入口的条目数与 [README.md](README.md) 中的目标表一致。
- [x] 菜单分组为：打开/访达、复制路径、重命名/删除或移除。
- [x] 每个 menuitem 均带图标，组间有 `DropdownMenuSeparator` 可见分割线。
- [x] Memory Space 不提供复制相对路径，只提供复制绝对路径。
- [x] 复制路径由 main 写入系统剪贴板，renderer 不持有 raw path。
- [x] 打开动作使用系统默认应用打开 `AGENTS.md`、`memory.md`、`segment.md`、`supplement.md`。
- [x] 访达显示动作调用 main 侧 `shell.showItemInFolder`；运行时未取得可信 Finder selection 探针，因此不声明已视觉确认选中目录。
- [x] 缺失实体、缺失语义文件、越界路径、shell/clipboard 失败均走 typed error 与 root error toast。

## 验证

- [x] `npm run typecheck`
- [x] `npm run test:main`
- [x] `npm run test:renderer`
- [x] `npm run lint`
- [x] `npm run format:check`
- [x] `npm run verify:quick`
- [x] `npm run build`
- [x] 运行时视觉证据与机器可读证据见 [verification.md](verification.md) 和 `artifacts/`。

## 收口判断

- 本 spec 的产品、实现、文档和验证目标均已完成。
- 当前没有需要 active initiative 承接的剩余产品或代码范围。
- 仍有效的长期事实已经写入 `docs/current/*`。
- 归档时将整个 spec 移入 `docs/archive/specs/2026-05-15-1120-entity-actions-menu/`，归档后 `docs/specs/` 不保留该任务。
