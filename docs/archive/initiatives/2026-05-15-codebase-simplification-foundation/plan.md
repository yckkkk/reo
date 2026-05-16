# 代码库简化基础计划

## 架构原则

- Helper 只承载已存在的不变量：workspace containment、directory identity、no-follow leaf、sync critical section、best-effort directory fsync 和 rollback/cleanup。
- 每个迁移切片都必须保留现有行为测试；新增测试只证明 helper 提供的边界，而不绑定内部实现细节。
- Renderer action 抽取只统一只读 shell action binding；重命名、删除、恢复、pending projection、Dialog target 和 Query cache owner 仍留在当前 owner component。

## 轨道 A：文件事务 helper

1. 创建 `src/main/workspaceDirectoryTransactions.ts`，先承载最小公共能力：
   - unsupported directory fsync 判断和 current directory fsync。
   - validated current-directory critical section。
   - open existing/no-replace file in known directory。
   - remove file and read directory entries in known directory。
2. 用 focused tests 覆盖 helper 的 identity swap、symlink/non-directory rejection、best-effort fsync error 和 no-replace open 行为。
3. 第一批迁移 `atomicWorkspaceFile.ts` 与 `recordingDrafts.ts` 中相同形态的 open/remove/read helpers。
4. 第二批迁移 `memoryFiles.ts` 中 copy、cleanup、empty directory remove 和 safe known-directory file helpers；不在同一切片迁移 directory rename transaction。
5. 第三批迁移 `workspaceFiles.ts` 与 `workspaceLock.ts` 的 fsync/current-directory helper；lock owner 写入的 stale/identity 行为必须保留原测试。
6. 只有前三批稳定后，才评估 `renameWorkspaceDirectoryWithinParent`、`renameWorkspaceDirectoryAcrossParents` 和 workspace root rename 是否能共享更小 primitive；不能为了统一而降低 target preflight、rollback 或 platform-specific no-replace semantics。

## 轨道 B：实体 action wrapper

1. 在 `workspaceApi.ts` 补齐实体 shell action API wrappers，让 renderer 其它文件不直接调用 `window.reoWorkspace`。
2. 创建 feature-local action binding helper，例如 `entityActionBindings.ts`，按 entity kind 返回 `EntityActionMenu` 需要的 open/reveal/copy handlers。
3. 迁移 `MemorySpaceActionsMenu.tsx`、`MemoryActionsMenu.tsx`、`SegmentActionsMenu.tsx` 和 `SegmentSupplementActionsMenu.tsx`，保留每个 wrapper 的 label、controlled open、trigger、delete/remove/rename callback 和 focus behavior。
4. 保留现有 menu tests，并新增一个 binding-level 测试覆盖每类 entity 的 handler 映射和 copy success/error toast 仍由 `EntityActionMenu` 统一处理。
5. 更新 `docs/current/frontend.md` 中“实体 More 菜单”的当前事实，只描述新的 action binding owner，不写迁移来源。

## 切片顺序

1. Spec 1：文件事务 helper 最小骨架 + `atomicWorkspaceFile.ts` / `recordingDrafts.ts` 迁移。
2. Spec 2：`memoryFiles.ts` safe open/read/remove/cleanup helper 迁移。
3. Spec 3：`workspaceFiles.ts` / `workspaceLock.ts` fsync 和 known-directory helper 迁移。
4. Spec 4：实体 action binding + wrapper 迁移。
5. Spec 5：审查剩余重复，决定是否迁移 directory rename transaction；如果收益不足，明确保留当前局部实现。

## 每个 spec 的收口要求

- RED：先写能暴露目标重复风险或边界遗漏的测试，并运行到失败。
- GREEN：只实现当前切片需要的最小 helper 或 wrapper。
- REFACTOR：迁移当前切片消费者，删除同形重复，不扩大到下个切片。
- 文档：只有项目级模式已改变时更新对应 `docs/current/*`。
- 验证：至少运行目标测试、`npm run typecheck`，收口前运行 `npm run verify:quick`。
