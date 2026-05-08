# 审查记录

## 文档系统

- `docs/current/*` 仍是当前真源；`docs/archive/specs/*` 只保留已收口证据。
- 默认阅读链已对齐 `docs/README.md`：先读项目入口，再读 `docs/current/foundation.md` 和 `docs/current/architecture.md`，按改动范围进入对应 current 文档。
- 产品语言统一为“记忆空间”。“项目”只允许出现在项目仓库、技术引用、负向产品气质或外部资料名称中，不作为 Reo 产品实体。

## 前后端契约

- IPC 通道当前由 `src/main/workspaceChannels.ts` 声明，preload surface 由 `src/preload/workspaceBridge.ts` 暴露，main handler 由 `src/main/workspaceIpc.ts` 注册。
- 请求/响应 runtime contract 当前由 `src/main/workspaceContract.ts` 的 Zod schema 拥有；renderer 全局类型当前在 `src/renderer/src/types/reoWorkspace.d.ts` 手写声明。
- 当前没有 `shared-types.ts`。如果引入它，必须替换手写 renderer 声明，不能额外增加第二套类型真源。
- 当前没有 `error-codes.md`。错误码当前真源是 `workspaceErrorCodeSchema`，用户可见文案映射在 `src/renderer/src/workspace/workspaceErrorMessages.ts`。
- 当前没有账号鉴权；授权边界是 Electron trusted sender 校验、main frame 校验、trusted URL、session identity、selection token、opaque `workspaceHandle` 和 handle sender ownership。
- 状态同步当前由 TanStack Query 管理 main-backed list/snapshot/detail cache；active handle、录音流程、drawer 状态、Blob URL 和表单 draft 不进入 Query。
- 当前记忆空间 registry 契约使用 `workspace:listMemorySpaces`、`workspace:openMemorySpace`、`workspace:removeMemorySpace` 和 `memorySpaces` response key；不再用 Project/projects 表示该实体。

## 数据模型

- 当前没有 DB schema、auth tables、Drizzle migration 或 table relationship。
- 用户内容真源是记忆空间文件夹；`.reo/index.json` 是可重建投影；main-owned registry 只是已导入记忆空间列表，不是内容真源。
- `Memory` 与 finalized `Recording` 的关系由文件结构表达：`memories/<memoryId>/memory.json` 和 `memories/<memoryId>/recordings/<recordingId>/recording.json`。
- 当前数据获取模式是：main/preload IPC request、renderer `workspaceApi.ts` 薄 wrapper、`workspaceQueries.ts` Query cache、feature-local component state。
- 用户删除记忆空间文件夹后，registry entry 继续显示；点击时返回 `ERR_WORKSPACE_ROOT_MISSING`，用户通过“移除记忆空间”从 Reo 列表移除，本地文件夹不被删除。

## 组件与错误处理

- Reusable UI primitives 当前集中在 `src/renderer/src/components/ui/*`；业务组件没有新增重复 primitive。
- App shell、创建表单、移除确认、资料库空页、记忆主页、记忆详情和录音 overlay 都使用现有 Button/Input/Textarea/Dialog/Drawer/Field/Menu/Toaster 等 primitives。
- 非阻断反馈统一走 root `ReoToaster` 和 `toast` export；没有发现 `alert()`、`confirm()` 或 feature-local toast host。
- 阻断错误使用 `WorkspaceErrorBanner` 或字段错误；移除失败只使用 toast，不在确认弹层内重复渲染旧提示。

## 文件结构

- 当前文件结构仍按 Electron process boundary、renderer feature boundary、UI primitive boundary 和 docs truth boundary 分层。
- 未新增 generic `services/`、`shared/`、`core/` 桶。
- `workspaceMemorySpaceRegistry` 是当前 registry 实现；只保存 main-owned root path 和可展示 metadata，不是内容真源。
