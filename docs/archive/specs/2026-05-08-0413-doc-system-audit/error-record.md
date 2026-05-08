# 错误记录

## 已确认问题

1. `docs/decisions/0002-electron-build-and-security-baseline.md` 仍写着当前不创建 preload bridge 或 IPC API，和当前 `window.reoWorkspace`、workspace IPC surface 冲突。
2. `docs/decisions/0003-local-memory-workspace.md` 仍使用早期 `recordings/<recording-id>/...` 路径，和当前 `memories/<memoryId>/recordings/<recordingId>/...` 文件真源冲突。
3. `docs/current/frontend.md` 和 `docs/current/flow.md` 仍用“旧添加工作区选择弹层”描述当前 UI，违反 current docs 不写旧来源的规则。
4. `docs/current/roadmap.md` 使用 `AI placeholder`，和当前“不展示未实现能力、不保留 placeholder section”的表达冲突。
5. 根 `README.md` 的已安装/已建立能力列表落后于 `package.json` 与 `docs/current/frontend.md`。
6. `docs/.DS_Store` 存在于文档目录中；它不是文档系统内容，也不应保留。

## 非问题

- `docs/archive/*` 中存在已收口计划、任务、review 和 verification 记录；它们不在默认阅读链中，作为归档证据保留。
- `docs/archive/initiatives/2026-05-06-first-product-slice/implementation-plan.md` 含 unchecked checklist 和 active initiative 语境；该文件位于归档证据层，当前入口和 active 索引不指向它，不按 current truth 修改。
- `docs/specs/` 目录为空时是允许状态；它表示没有进行中的 task spec。
- `docs/initiatives/README.md` 记录当前 active initiative 为无，符合当前状态。

## 处理结果

1. `0002` 已改为当前 narrow preload + explicit workspace IPC 决策。
2. `0003` 已改为当前 memory/recording/draft 文件路径和 workspace 创建/打开规则。
3. `frontend.md` 与 `flow.md` 已删除历史式 UI 描述，只保留当前 create/open-local flow。
4. `roadmap.md` 已把 `AI placeholder` 改为未来 AI 结构位，并明确不得展示伪聊天、假输出或未实现能力。
5. 根 `README.md` 已同步当前依赖和已建立能力。
6. `docs/.DS_Store` 已移除。
