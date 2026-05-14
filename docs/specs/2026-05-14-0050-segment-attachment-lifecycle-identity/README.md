# 补全 Segment 与 SegmentAttachment 的实体生命周期与身份

时区：2026-05-14 00:50 America/Los_Angeles

## 工作意图

让三类用户内容节点（Memory / Segment / SegmentAttachment）都是一等公民——可建、可改名、可删、可恢复、有可见身份。当前只有 Memory 拥有完整生命周期；Segment 缺删除/恢复，SegmentAttachment 缺重命名/删除/恢复/可见身份。本工作单元串行补全这两类实体的生命周期与身份，不扩展到内容类型或 ASR。

范围明确**不含**：attachment 转写文本展示（留作下一个独立工作单元）、note/photo/video/imported_file 内容类型、跨 Memory 移动。

## 第一性原理检查

### 目标

补全 Segment 和 SegmentAttachment 的实体生命周期与身份，使三类用户内容节点行为一致。

### 实体与现状

- Memory —— 完整：create / rename / delete→trash / restore。
- Segment（audio）—— 有 create（经 recording finalize）/ rename；缺 delete / restore。
- SegmentAttachment（audio）—— 有 create（经 recording finalize）；缺 rename / delete / restore / 可见身份。

### 约束

- 文件即真源：目录存在 = 归属真源，metadata id = 身份，dir basename = 可见名称投影。
- 所有记忆空间写入走 single-writer lock + memory write lock 串行。
- 新 IPC 沿用「每能力一个显式 channel」纪律，不引入通用 bridge。
- 软删除 = 节点目录移入 `.reo/trash/`；恢复 = 移回父节点；不引入新真源类型。
- Renderer 不直接使用 Node/Electron API；preload 只暴露窄 `window.reoWorkspace` 方法。

### 不变量

- 删除/恢复只在已验证 workspace child path 内进行（containment + symlink guard + ancestor-swap 拒绝）。
- 删除/恢复后 `.reo/index.json` 与文件真源一致；move 成功但 index 刷新失败时回滚。
- 软删除可逆：trash 中节点保留完整 payload；父节点缺失时恢复返回 typed error，绝不创建孤儿。
- 删除当前选中节点后 UI 必有确定 fallback selection，不留空指针。
- 独立删除 Segment/SegmentAttachment 不影响兄弟节点；Memory 删除时其内部节点随目录整体移动（已有行为，不变）。
- `segment.json.memoryId` 必须匹配父 Memory metadata；`segmentId` / `attachmentId` 由 metadata 建立身份，目录 basename 只作 title 投影。

### 「不在错误模型上堆积」检查

文件真源模型没有错误：Memory 的 main-side 软删除 / 恢复规则（节点目录进入 `.reo/trash/*`、containment、rollback、index refresh）仍是正确模型，可以推广到 Segment 和 SegmentAttachment。

用户可见撤销模型需要修正：删除确认后的 toast 不是“先提交 main 删除，再通过恢复 IPC 反做一次删除”，而是“renderer 先乐观移除，toast grace period 到期后才提交 main 删除；撤销只取消这次待提交删除并恢复 renderer 投影”。这避免一次无意义的 delete→restore 后端往返，也让 toast 倒计时成为真实销毁前的安全窗口。本工作单元先把 Segment delete UI 改回这个模型，并删除由旧 UI 模型产生的即时删除、即时清理 content cache 和 toast restore IPC 依赖。

### 「简化不删功能」检查

不删任何能力。安全边界（containment / single-writer lock / symlink guard）、数据真源（记忆空间文件）、验证路径（真实 TDD）、用户可见恢复（toast undo）全部保留。Renderer 的恢复不再依赖后端反向恢复请求；main 的 `restoreDeletedSegment` 能力仍保留为文件真源可恢复区能力，但 Segment 删除 toast 的用户可见撤销发生在真实删除提交前。

### 最少规则（奥卡姆）

本设计几乎不新增规则，而是把现有规则推广：

1. 软删除 = 节点目录移入 `.reo/trash/<type>s/` + 刷新 index（推广 Memory 规则）。
2. 恢复 = 按 metadata id 把节点目录移回父节点 + 刷新 index（推广 Memory 规则）。
3. 父节点缺失 → typed error，不创建孤儿（本工作单元新增的唯一边界规则）。
4. 重命名 = 改 dir basename + metadata title mirror（推广 Segment rename 规则）。
5. 可见身份 = dir basename projection（SegmentAttachment 沿用已有规则，零新增）。

## Obsidian 参考门禁

本工作单元执行前必须查 Obsidian 官方文档与产品设计表面。参考只用于校准本地文件产品的成熟交互与文档表达，不改变 Reo 的实体模型、Electron 安全边界或 `.reo` 文件合同。

已采用的 Obsidian 官方参考：

- `https://obsidian.md/help/data-storage`：vault 是本地文件夹，普通文件可被外部编辑器和文件管理器管理，应用负责同步文件变化。
- `https://obsidian.md/help/attachments`：attachments 是 vault 内可被文件系统访问的普通文件。
- `https://obsidian.md/help/Plugins/File%20explorer`：文件和文件夹的 rename/delete 等常见操作由文件树上下文菜单承载。
- `https://obsidian.md/help/settings`：删除策略需要明确用户可恢复性；Obsidian 支持系统 trash、app 内 `.trash` 和永久删除三类策略。

Reo 的采用边界：

- Reo 不做通用文件浏览器；Segment 和 SegmentAttachment 的操作只出现在当前 Memory Studio 的实体表面。
- Reo 采用 app 内恢复区，但恢复区属于 `.reo/trash/*`，不使用系统 trash，也不暴露 raw path。
- Reo 的 delete/restore/rename 仍通过显式 IPC、Zod schema、senderFrame 校验、single-writer lock 和 memory write lock 执行。
- 文档表达学习 Obsidian Help 的当前行为写法：直接写用户可见行为、设置/操作入口和结果，不写历史来源或实现来源叙述。

## 方案决策

采用**方案 A —— 按类型分别建 trash root，精确镜像 Memory**：

- `.reo/trash/segments/<segmentDir>/` 与 `.reo/trash/attachments/<attachmentDir>/`，与现有 `.reo/trash/memories/` 平级。
- 删除即移动目录；恢复时读节点 metadata 的 `memoryId` / `segmentId` 定位父节点移回。
- main flow 精确复用 Memory delete/restore 的 containment 复核、lock usability 重消费、typed error、rollback、index refresh。

否决的方案：

- **方案 B（原地 status flag / 父目录内 `.trashed/`）**：违背「目录存在即归属真源」模型，会让所有 scan/index/detail 投影都加过滤分支，和现有模型对抗。
- **方案 C（统一 trash + 路径 manifest）**：manifest 是会与文件真源 desync 的新真源，正是文件模型要避免的；比 A 更复杂且无收益。

## Slice 审查门禁回答

- **是否需要 DB schema**：否。durable source 仍是记忆空间文件夹文件；`.reo/index.json` 是可重建投影。当前无 DB 引入压力。
- **是否需要 migration**：否，无 DB。
- **durable source**：记忆空间文件夹。新增 `.reo/trash/segments/`、`.reo/trash/attachments/` 是 trash 区文件目录，首次写入时按需创建，不留空占位。
- **数据获取模式**：TanStack Query（已有 Memory detail / Segment content / SegmentAttachment content cache），删除/恢复/重命名是 request/response mutation。
- **Query keys / invalidation / optimistic / rollback**：不新增 Query key。Segment 删除使用 scoped optimistic update：确认后先从 Workspace snapshot cache、Memory detail cache 和 App session projection 移除 Segment，并保留前一份 projection snapshot；toast grace period 到期后才调用 `workspace:deleteSegment`。撤销或 delayed delete 失败都用前一份 projection rollback。Segment content 与该 Segment 下 attachment content cache 只在 delayed delete 成功后移除，撤销时不做无意义 cache 重建。SegmentAttachment 删除同理在 Step 4 实施。重命名用 scoped optimistic update + rollback（镜像 Segment rename），rollback 必须检查当前 title 仍是本次提交值。
- **Form / client / server state owner**：删除/恢复确认 Dialog 的 open state 属于 App component state；重命名 Dialog 提交前 title draft 属于 React Hook Form；Memory detail、Segment projection 和 SegmentAttachment projection 属于 TanStack Query。
- **文件夹结构边界**：记忆空间文件（用户内容真源）、`.reo` metadata、`.reo/trash/*`（可恢复区）、`.reo/index.json`（可重建投影）边界清楚，本工作单元只新增 trash 子目录。

## 串行四步

每步独立可验证；一步收口（`verify:quick` 全绿 + 对应 `docs/current/*` 同批更新 + 运行时视觉/操作证据 + subagent 独立审查通过）后才进入下一步。

每步 subagent 审查必须重点检查：

- 是否先定义目标、实体、约束和不变量，再采用能完整表达当前行为的最少规则。
- 是否在错误模型上堆积逻辑；如发现模型错误，必须先改回正确模型，再删除由旧模型产生的分支、状态和文案。
- 是否做到简化不删功能；必要的产品能力、安全边界、数据真源、验证路径和用户可见恢复必须保留。
- 是否因为叠加新需求出现 patchy 或 spaghetti 结构；必要时允许架构级重构，但重构必须抽出真实共享的不变量、删除重复分支，并且不得引入 generic runtime、command bus 或 speculative abstraction。

### Step 1 — Segment 软删除 + 恢复

- **数据**：新 trash root `.reo/trash/segments/<segmentDir>/`（segment 目录含嵌套 `attachments/` 整体移动）。`segment.json` 已有 `memoryId` + `segmentId` 供恢复寻址。
- **Main（`src/main/memoryFiles.ts`）**：`deleteSegment` / `restoreDeletedSegment`，精确复用 Memory delete/restore main flow——containment 复核、lock usability 重消费、index entry 刷新、move 失败回滚、`.reo/trash/segments/` 按需创建、symlink/非目录/ancestor-swap → typed error。删除和恢复都修复 `memory.json.segmentIds` mirror。恢复时父 Memory 缺失 → `ERR_SEGMENT_RESTORE_PARENT_MISSING`。
- **IPC（`src/workspace-contract/`）**：新增 `workspace:deleteSegment`、`workspace:restoreDeletedSegment` channel + request/response Zod schema + 错误码 `ERR_SEGMENT_DELETE_FAILED` / `ERR_SEGMENT_RESTORE_FAILED` / `ERR_SEGMENT_RESTORE_PARENT_MISSING`。Delete success response 返回 `{ memory, segmentId, restoreToken }`，restore success response 返回 `{ memory, segment }`；`restoreToken` 使用 `segmentId`。
- **Preload**：加入 `window.reoWorkspace` bridge（type-only contract + channel 常量）。
- **Renderer（`MemoryStudio.tsx` / `LoadedWorkspaceFrame.tsx` / `App.tsx`）**：`MemoryStudio` 的 Segment card More 菜单加 `删除`，只发起 `onDeleteSegment({ memoryId, segment })` intent；`LoadedWorkspaceFrame` 只透传该 intent；`App` 拥有 `SegmentDeleteDialog`、recording interruption guard、optimistic projection、toast undo 和 delayed IPC commit。确认后 Dialog 关闭，App 立即从 Workspace snapshot cache、Memory detail cache 和 App session projection 移除 Segment，selected Segment fallback 到剩余第一条或空态；同时显示 `已删除片段` toast，toast action 为 `恢复`，底部进度条表达 grace period。toast 自动关闭时才调用 `workspace:deleteSegment`；成功后合并 main 返回的 Memory summary，并移除对应 `segment-content` Query 和该 Segment 下所有 `segment-attachment-content` Query prefix。点击 `恢复` 或 delayed delete 失败时，用确认时捕获的 projection snapshot 恢复 Segment，并通过 one-shot Segment focus intent 选中；撤销不调用 `workspace:restoreDeletedSegment`。
- **测试（TDD）**：main 覆盖移动目录 / `segmentIds` mirror 修复 / index 刷新 / 父缺失 typed error / containment / symlink guard / move 成功 index 失败回滚 / lock-lost；renderer 覆盖 Segment card 删除菜单 → Dialog → cache 更新 → fallback selection → toast 恢复。
- **文档**：`data.md`（trash 结构、删除/恢复数据决策和 Query 清理范围）、`flow.md`（删除/恢复 flow + 时序）、`electron.md`（新 channel）、`frontend.md`（Segment More 菜单增加危险操作）、`quality.md`（测试覆盖面）、`product.md`（Segment 删除是 Memory Studio 内危险操作）。

#### Step 1 执行计划

**目标**：让 audio Segment 可以从 Memory Studio 删除到 `.reo/trash/segments/`，并通过同一次 toast action 恢复，且 UI/cache/file truth 保持一致。

**实现边界**：不改 Attachment 行 UI，不展示 attachment transcript，不引入 DB、Zustand、file watcher、通用 IPC、系统 trash 或永久删除。

**Context7 采用依据**：

- Electron：preload 用 `contextBridge` 暴露具体函数，不能把 `ipcRenderer` 或 event object 暴露给 renderer。
- TanStack Query：mutation 成功后用 response 精准 `setQueryData`；删除 Segment 时用 query filter 移除该 Segment 下的 content cache prefix。
- Zod：IPC request/response 使用 `strictObject` 和 discriminated response union，未知字段拒绝进入合同。

**文件责任图**：

- 修改 `src/workspace-contract/workspace-channels.ts`：新增 delete/restore Segment channel 常量并纳入 allowlist。
- 修改 `src/workspace-contract/workspace-contract.ts`：新增 request/response schema、错误码和导出类型。
- 修改 `src/workspace-contract/reo-workspace-bridge.ts`：新增 bridge 方法类型。
- 修改 `src/preload/workspaceBridge.ts`：新增两个窄 bridge 方法。
- 修改 `src/main/memoryFiles.ts`：新增 Segment trash root helper、delete/restore file truth flow、错误映射。
- 修改 `src/main/workspaceIpc.ts`：新增 handler、sender/handle validation 接入和 registration。
- 修改 `src/renderer/src/workspace/workspaceApi.ts`：新增 renderer API wrapper 与 response type。
- 修改 `src/renderer/src/workspace/workspaceErrorMessages.ts`：新增用户可见错误文案。
- 修改 `src/renderer/src/workspace/MemoryStudio.tsx`：Segment More 菜单新增 `删除` intent。
- 修改 `src/renderer/src/workspace/LoadedWorkspaceFrame.tsx`：透传 `onDeleteSegment`。
- 新增 `src/renderer/src/workspace/SegmentDeleteDialog.tsx`：危险确认 Dialog，镜像 Memory delete 的密度与文案结构。
- 修改 `src/renderer/src/App.tsx`：持有 delete target、pending、IPC mutation、Query cache 更新、selection fallback 和 toast restore。
- 修改测试：`test/main/workspaceContract.test.ts`、`test/main/workspaceBridgeSurface.test.ts`、`test/main/memoryFiles.test.ts`、`test/main/workspaceIpc.test.ts`、`src/renderer/src/workspace/workspaceApi.test.ts`、`src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx`、`src/renderer/src/App.test.tsx`。
- 修改 docs/current：`product.md`、`electron.md`、`data.md`、`flow.md`、`frontend.md`、`quality.md`。

**TDD 顺序**：

1. **Contract / preload / API RED**
   - 先在 `workspaceContract.test.ts` 增加 channel/schema/error code 断言。
   - 在 `workspaceBridgeSurface.test.ts` 增加 bridge surface 与 channel 调用断言。
   - 在 `workspaceApi.test.ts` 增加 `deleteSegment` / `restoreDeletedSegment` wrapper 断言。
   - 运行：
     ```bash
     npm run test:main
     npm run test:renderer -- src/renderer/src/workspace/workspaceApi.test.ts
     ```
   - 预期 RED：缺少 channel/schema/bridge/API export 或 method。
   - GREEN：只补 contract、bridge 和 API wrapper，不写 main file truth。

2. **Main file truth RED**
   - 在 `memoryFiles.test.ts` 增加：
     - 删除 externally renamed Segment 后目录进入 `.reo/trash/segments/<segmentDir>/`，active `segments/` 不再可读。
     - 删除同步移除 `memory.json.segmentIds` 中的 segment id，并刷新 index summary 的 `segmentCount`、duration、audio bytes、attachmentCount。
     - 恢复把同一目录移回 parent Memory `segments/`，合回 `segmentIds` mirror，并返回完整 Segment projection。
     - 恢复时父 Memory 缺失返回 `ERR_SEGMENT_RESTORE_PARENT_MISSING`，不创建孤儿。
     - symlink/非目录/unsafe path 返回 `ERR_WORKSPACE_UNSAFE_PATH`。
     - move 已成功但 index 刷新失败时回滚到原位置。
   - 运行：
     ```bash
     npm run test:main
     ```
   - 预期 RED：缺少 `deleteSegmentFromFileTruth` / `restoreDeletedSegmentFromFileTruth` 或行为未满足。
   - GREEN：实现最小 helper 与 file truth flow；复用现有 directory move、containment、write lock 和 index refresh 工具。

3. **IPC RED**
   - 在 `workspaceIpc.test.ts` 增加：
     - `handleDeleteSegmentForTest` 删除后 read Memory detail 不再包含该 Segment，response 不含 root path/file path/handle。
     - `handleRestoreDeletedSegmentForTest` 恢复后返回 parent Memory summary 与 restored Segment projection。
     - 父 Memory 缺失返回 `ERR_SEGMENT_RESTORE_PARENT_MISSING`。
     - untrusted sender/handle mismatch 继续走已有 `withWorkspaceHandleRequest` 错误语义。
   - 运行：
     ```bash
     npm run test:main
     ```
   - 预期 RED：缺少 handler 或 registration。
   - GREEN：接入 `workspaceIpc.ts` handler、registration 和 response parse。

4. **Renderer RED**
   - 在 `LoadedWorkspaceFrame.test.tsx` 增加 Segment More 菜单 `删除` intent 断言，确保 MemoryStudio 不直接调用 IPC。
   - 在 `App.test.tsx` 增加：
   - Segment menu → `删除` → Dialog → confirm 立即关闭 Dialog 并更新 Memory detail cache / Workspace snapshot cache / App session projection；此时不调用 `window.reoWorkspace.deleteSegment`。
   - 乐观删除后选中项 fallback 到剩余第一条 Segment 或空态，toast 显示 `已删除片段`、目标标题、`恢复` action 和进度条 class。
   - 点击 `恢复` 会恢复本地 projection、选中恢复 Segment，并且不调用 `deleteSegment` 或 `restoreDeletedSegment`。
   - toast grace period 到期后才调用 `window.reoWorkspace.deleteSegment`；成功后移除 `segment-content` 和该 Segment 下 `segment-attachment-content` prefix；失败后 rollback 并显示错误 toast。
   - 录音流程打开时删除 Segment 被阻止，不调用 IPC。
   - 运行：
     ```bash
     npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/App.test.tsx
     ```
   - 预期 RED：缺少 delete intent、Dialog、API 方法或 cache 更新。
   - GREEN：新增 `SegmentDeleteDialog`，在 App 层实现 mutation owner 和 Query cache 更新。

5. **Docs 与简化审查**
   - 更新 `product.md`、`electron.md`、`data.md`、`flow.md`、`frontend.md`、`quality.md`，只写当前事实。
   - 简化检查：
     - 不新增通用 trash service、generic command、Zustand store 或 reusable UI primitive。
     - `SegmentDeleteDialog` 只服务当前真实 consumer。
     - Renderer 不 import Node/Electron。
     - Mutation owner 保持 App 层，不把 IPC 写进 MemoryStudio。
     - 如果 Memory / Segment delete-restore 流程开始出现复制粘贴分叉，优先抽出 file-space node move、trash root ensure、rollback 和 index refresh 的真实共享 helper；抽象只表达当前三类节点的共同不变量，不承载未来类型。

6. **Step 1 收口验证**
   - 重跑保护测试：
     ```bash
     npm run test:main
     npm run test:renderer -- src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts
     ```
   - 跑项目门禁：
     ```bash
     npm run verify:quick
     ```
   - 派 subagent 对 Step 1 diff、测试和 docs/current 更新做独立审查；审查未通过时先修正，不进入 Step 2。
   - 运行 Electron runtime，通过 Computer Use 验证真实桌面交互：
     - 打开含至少两个 Segment 的 Memory。
     - 从 Segment More 菜单删除当前 Segment。
     - 确认 UI fallback 到剩余 Segment 或空态。
     - 点击 toast `恢复`，确认 Segment 回到当前 Memory 并被选中。
     - 验证删除/恢复过程中不暴露本地路径，录音打开时删除动作被阻止。
   - 将 RED/GREEN/REFACTOR 命令输出摘要、`verify:quick` 结果和 Computer Use 操作证据写回本 spec。

#### Step 1 执行证据

**TDD RED**

- Contract / preload / renderer API：
  - `npm run test:main`：TypeScript 编译失败，缺少 `deleteSegment` / `restoreDeletedSegment` bridge 方法、channel 常量、schema 与错误码导出。
  - `npm run test:renderer -- src/renderer/src/workspace/workspaceApi.test.ts`：失败输出包含 `TypeError: deleteSegment is not a function`。
- Main file truth：
  - `npm run test:main`：TypeScript 编译失败，缺少 `deleteSegmentFromFileTruth` / `restoreDeletedSegmentFromFileTruth` 导出。
- IPC：
  - `npm run test:main`：TypeScript 编译失败，缺少 `handleDeleteSegmentForTest` / `handleRestoreDeletedSegmentForTest` 导出；修正测试断言后进入 GREEN。
- Renderer：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "confirms Segment deletion" --testTimeout=20000`：失败输出显示 Segment More 菜单只有 `重命名`，没有 `删除`。

**GREEN / REFACTOR**

- `npm run test:main`：341 个 main 测试通过。
- `npm run test:renderer -- src/renderer/src/App.test.tsx -t "confirms Segment deletion"`：目标 App 行为测试通过。
- `npm run test:renderer -- src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx`：3 个 renderer 测试文件、28 个测试通过。
- `npm run verify:quick` 第一次在 `format:check` 阶段失败，Prettier 指出 `src/main/memoryFiles.ts`、`src/renderer/src/App.tsx`、`src/workspace-contract/workspace-channels.ts`、`test/main/memoryFiles.test.ts` 需要格式化；运行 `npx prettier --write ...` 后重跑。
- `npm run verify:quick` 第二次全绿：typecheck、`test:main`、`test:renderer`、lint、format check 全部通过。
- 写入本执行证据后再次运行 `npm run verify:quick`，结果全绿：`test:main` 341 通过、`test:renderer` 27 个文件 / 258 个测试通过，lint 与 format check 通过。

**Subagent 审查修正**

- Step 1 首轮 subagent 审查结论为 FAIL：
  - BLOCKER：externally renamed symlink / non-directory Segment candidate 会被 `segmentDirectoryInParent` 先过滤掉，随后回落到默认目录并误报 `ERR_RECORDING_NOT_FOUND`，没有按 unsafe file-space node 拒绝。
  - MAJOR：缺少 move 成功但 index refresh 失败 rollback、lock-lost、renamed unsafe candidate、renderer 录音打开时删除入口阻断，以及 Segment delete/restore 用户可见错误文案的保护测试。
- 补充 RED：
  - `npm run test:main` 失败 2 个新增测试：renamed symlink / renamed non-directory delete 期望 `ERR_WORKSPACE_UNSAFE_PATH`，实际 `ERR_RECORDING_NOT_FOUND`。
  - `npm run test:renderer -- src/renderer/src/workspace/workspaceErrorMessages.test.ts` 失败：`ERR_SEGMENT_DELETE_FAILED` 显示为通用 fallback `操作失败，请重试。`，期望 `无法删除片段。`。
  - `npm run test:renderer` 暴露 Node 26 + Vitest/jsdom 下 `window.localStorage` 缺失，所有依赖 localStorage 的 renderer tests 在 setup/beforeEach 失败；按 Context7 Vitest 官方文档先配置 `environmentOptions.jsdom.url`，再在 renderer test setup 中补当前 jsdom 测试存储替身。
- GREEN / REFACTOR：
  - `segmentDirectoryInParent` 不再跳过命名上已经指向目标 Segment 的 unsafe candidate；同 id / `<segmentId>--*` candidate 如果是 symlink 或非目录，直接返回 `ERR_WORKSPACE_UNSAFE_PATH`，不回落默认目录。
  - `workspaceErrorMessages.ts` 增加 `ERR_SEGMENT_DELETE_FAILED`、`ERR_SEGMENT_RESTORE_FAILED`、`ERR_SEGMENT_RESTORE_PARENT_MISSING` 中文文案。
  - `src/renderer/src/test/setup.ts` 增加 localStorage 测试存储，并让 `Storage.prototype` spy 继续覆盖既有 tests。
  - `App.test.tsx` 增加“录音流程打开时 Segment 删除入口不可达且不调用 IPC”覆盖。
- 补充验证：
  - `npm run test:main`：348 个 main 测试通过。
  - `npm run test:renderer -- src/renderer/src/workspace/workspaceErrorMessages.test.ts`：1 个测试通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "does not expose Segment deletion while a recording flow is open"`：目标测试通过。
  - `npm run test:renderer -- src/renderer/src/workspace/recordingRecovery.test.ts -t "does not rewrite transcript sidecar during duration-only recovery updates"`：目标测试通过。
  - `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx -t "does not rewrite the recovery marker for every acknowledged durable chunk"`：目标测试通过。
  - `npm run test:renderer`：28 个文件 / 260 个测试通过。
- 初轮 Step 1 门禁：
  - `npm run verify:quick` 通过：typecheck 通过；`test:main` 348 个测试通过；`test:renderer` 28 个文件 / 260 个测试通过；lint 通过；format check 通过。
  - renderer 测试运行时 Node 26 打印 `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`，当前 jsdom setup 已提供 `window.localStorage` 测试存储，断言和 full gate 均通过。

**Step 1 设计返工证据**

- 用户反馈指出初轮 Step 1 的 toast 模型错误：Segment 删除确认后不应立即提交 `workspace:deleteSegment` 再通过 `workspace:restoreDeletedSegment` 撤销；正确模型是乐观移除、toast 倒计时期间可撤销、倒计时结束才提交真实删除。
- 用户进一步指出撤销 toast 不能另起一套视觉结构；所有 toast 必须在同一个结构上变化，`恢复` action 必须是 icon+文字并有 hover 状态。
- Radix / shadcn / Sonner 官方范式核对：
  - Radix Alert Dialog 用于需要用户明确响应的危险操作；Dialog / AlertDialog 内容应有清楚 title、description 和 action 边界。
  - shadcn AlertDialog 示例使用 header / description / footer / cancel / action 的线性结构；Sonner 官方示例支持 `toast("File deleted.", { action: { label: "Undo", onClick } })`。
  - Sonner 2.0.7 本地类型确认 `ExternalToast` 支持 `duration`、`action`、`closeButton`、`onAutoClose`、`className` 和 `style`；因此 toast duration 可以作为唯一 grace-period clock，不需要额外并行 timer。
- Claude 设计审查采用点：删除确认保持轻量危险确认，不使用重内容卡；toast 收敛为状态、目标标题、恢复 action 和底部 2px progress bar；避免 pause-on-hover、独立 pending store、批量 undo、手写 interval 与共享状态机。
- Gemini 设计审查尝试失败：`gemini -m gemini-3.1-pro -p ...` 返回 `ValidationRequiredError: Verify your account to continue`，本机账号验证阻塞，未产出可采用意见。
- 返工 RED：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "optimistically hides|commits Segment deletion" --testTimeout=20000`：初轮实现立即调用 `deleteSegment`，失败输出显示期望未调用但实际已调用 `{ workspaceHandle, workspaceId, memoryId, segmentId }`；delayed commit 用例因没有 toast `onAutoClose` 提交路径而超时。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "confirms Memory deletion|optimistically hides" --testTimeout=20000`：新增 icon+文字 action 断言后失败，`恢复` action 内没有 `svg[aria-hidden="true"]`。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "commits Segment deletion after the undo toast grace period expires" --testTimeout=20000`：10 秒 grace-period 断言先失败，实际 toast duration 仍是 8000ms。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "confirms Memory deletion|optimistically hides" --testTimeout=20000`：运行时发现 `size-14` 在当前 Tailwind spacing scale 下把 undo icon 放大；测试改为要求 `h-16 w-16` 后失败，实际 class 仍是 `size-14`。
- 返工 GREEN / REFACTOR：
  - `App.confirmDeleteSegment` 改为确认后只做 renderer scoped optimistic projection；toast undo 恢复捕获的 Workspace snapshot / Memory detail / session projection，并通过一次性 Segment focus intent 选中恢复 Segment，不调用 `workspace:restoreDeletedSegment`。
  - `workspace:deleteSegment` 延迟到 Sonner `onAutoClose` 后调用；删除成功后才移除该 Segment 的 `segment-content` Query 和该 Segment 下的 `segment-attachment-content` prefix；删除失败时回滚 projection 并显示 root error toast。
  - `ReoToaster` 保持一套 toast surface 和 action button class；新增 `ReoToastUndoActionLabel`，Memory 和 Segment 的 `恢复` action 都使用同一个 icon+文字 label。action button 保留 hover/focus/active 状态，icon 使用 `h-16 w-16`，避免 Tailwind undefined spacing class 放大。
  - Segment delete toast duration 调整为 10 秒；底部 2px progress bar 使用同一个 `--reo-toast-duration`，没有并行 timer。
  - `SegmentDeleteDialog` 使用 `AlertDialog` 线性结构，删除确认不再内嵌重内容卡。
- 返工保护测试：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "confirms Memory deletion|optimistically hides|commits Segment deletion" --testTimeout=20000`：3 个目标测试通过。
  - `npm run verify:quick` 通过：typecheck 通过；`test:main` 348 个测试通过；`test:renderer` 28 个文件 / 262 个测试通过；lint 通过；format check 通过。Node 26 仍打印 jsdom localStorage experimental warning，测试存储 setup 生效且 full gate 通过。

**Step 1 返工 Computer Use 桌面验证**

- Runtime：启动 Electron dev runtime 并打开当前 renderer / main / preload；为避免污染用户 registry，先备份 `/Users/yck/Library/Application Support/reo/workspace-registry.json`，再临时注入 fixture 记忆空间。
- Fixture：临时记忆空间 `/var/folders/ql/82hx_cy97xd902x7ryf2dx3m0000gn/T/reo-step1-undo-VAZ6ab/Step1 Undo Workspace`，包含 `Step 1 Undo Runtime Memory`，两个 Segment：`Delete me segment` 与 `Keep me segment`；`Delete me segment` 下有 `att_step1_note--Delete note` attachment。
- 删除前视觉证据：Computer Use 显示 Memory Studio 同屏有 `Delete me segment` 和 `Keep me segment` 两张 Segment card；`Delete me segment` More 菜单显示 `重命名` 与 `删除`。
- Dialog 证据：点击 `删除` 后出现 role 为 AlertDialog 的 `删除片段`，内容为 `删除“ Delete me segment ”？补充录音会随片段一起进入恢复区。`，按钮为 `取消` 和 `删除`，没有本地路径或重内容卡。
- Undo toast 视觉证据：确认删除后 toast 显示 `已删除片段`、目标 `Delete me segment`、带 icon+文字的 `恢复` action、底部进度条；Memory Studio 仍处于 renderer optimistic projection 窗口。
- Undo 行为证据：点击 toast `恢复` 后，Computer Use 显示 `Delete me segment` 回到 Segment 预览流并重新选中；文件真源检查输出 `activeExistsAfterUndo: true`、`trashEntriesAfterUndo: []`、`segmentIdsAfterUndo: ["seg_step1_delete","seg_step1_keep"]`、`indexSegmentCountAfterUndo: 2`、`attachmentStillActiveAfterUndo: true`，确认撤销未触发真实删除。
- Auto-close 行为证据：再次确认删除且不点击恢复，等待 10 秒后 Computer Use 显示 Memory Studio 只剩 `Keep me segment`；文件真源检查输出 `activeExistsAfterAutoClose: false`、`trashEntriesAfterAutoClose: ["seg_step1_delete--Delete me segment"]`、`segmentIdsAfterAutoClose: ["seg_step1_keep"]`、`indexSegmentCountAfterAutoClose: 1`、`trashHasAttachmentAfterAutoClose: true`。
- 清理证据：验证后恢复用户级 registry 备份并 reload Reo，Computer Use 只显示用户原有 `日常生活` 记忆空间；脚本确认 registry 中 `hasStep1UndoSpace: false`。Electron dev runtime 已停止。

**Step 1 二轮 subagent 审查返工**

- Step 1 二轮 subagent 审查结论为 FAIL：
  - BLOCKER：`docs/current/data.md` 仍保留 “Segment delete 成功后合并 / 不做 optimistic update” 的旧模型。
  - MAJOR：renderer undo rollback 写回整份旧 Workspace snapshot / Memory detail，10 秒窗口内可能覆盖后续 Memory rename、recording、refresh 等投影变化。
  - MAJOR：delayed delete 成功后移除 `segment-content` 和 `segment-attachment-content` prefix 的行为缺少 renderer 测试断言。
  - MINOR：toast action 测试只覆盖 hover/icon，缺少 focus-visible；`Segment restore` 文档没有区分 main-side trash restore 能力与 toast undo。
- 补充 RED / coverage：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "restores an optimistically deleted Segment without rolling back a later Memory rename|commits Segment deletion after the undo toast grace period expires|optimistically hides a deleted Segment"`：新增局部 rollback 用例失败，输出显示撤销后找不到 `Renamed birthday 记忆操作`，实际 title 被整份旧 snapshot 回滚成 `My seventh birthday`；同次运行另外 2 个相邻测试通过。
  - 同批补充 delayed commit cache cleanup 断言：测试预置被删 Segment 的 `segment-content` cache 和该 Segment 下 `segment-attachment-content` cache，`onAutoClose` 成功后要求两者都被移除。
  - 同批补充 toast action focus-visible 断言：Memory 和 Segment 的 `恢复` action 都要求统一 action button focus ring。
- GREEN / REFACTOR：
  - `App.confirmDeleteSegment` 的 rollback 改为局部恢复：只把目标 Segment 重新插回当前 Workspace snapshot cache、Memory detail cache 和 session projection，并以当前 Memory summary 为基底，保留删除窗口内发生的 Memory title 或 summary 投影变化；不再写回整份旧 snapshot。
  - Delayed delete 成功路径继续只在 `workspace:deleteSegment` 成功后移除 selected Segment content cache 和该 Segment 下 attachment content cache；撤销不重建 content cache。
  - `docs/current/data.md`、`flow.md`、`frontend.md`、`quality.md` 改为当前事实：toast undo 是 delayed delete 前的 renderer local projection restore，`workspace:restoreDeletedSegment` 是 main-side trash 恢复能力，不是 Segment delete toast 的撤销路径。
- 补充验证：
  - RED 后实现修正并重跑同一 targeted command：1 个测试文件通过，3 个目标测试通过 / 54 skipped。
  - REFACTOR 后再次重跑同一 targeted command：1 个测试文件通过，3 个目标测试通过 / 54 skipped。
  - `npm run typecheck` 通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx`：57 个 App 测试通过。
  - `npm run verify:quick` 首次在 `format:check` 发现 `src/renderer/src/App.tsx` 需要 Prettier；只格式化该文件后重跑。
  - `npm run verify:quick` 最终通过：typecheck 通过；`test:main` 348 个测试通过；`test:renderer` 28 个文件 / 263 个测试通过；lint 通过；format check 通过。Node 26 仍打印 jsdom localStorage experimental warning，当前测试 setup 生效且 full gate 通过。

**Step 1 三轮 subagent 审查返工**

- Step 1 三轮 subagent 审查结论为 FAIL：
  - BLOCKER：Segment optimistic delete 会被 Workspace file-truth refresh 打破；grace period 内 main 尚未真实删除 Segment，refresh 成功返回文件真源后会把目标 Segment 的 summary 投影带回 UI/cache。
  - MAJOR：现有测试没有覆盖 grace period 内 successful `readWorkspaceSnapshot` 返回仍包含目标 Segment 的路径。
- 补充 RED：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "optimistically hides a deleted Segment and restores it from toast undo without IPC"`：新增 deferred refresh 断言后失败；输出显示 pending snapshot 中 `segmentCount: 2`、`durationMs: 190000`、`audioByteLength: 3072`、`hasTranscript: true`，期望仍保持 optimistic projection 的 `segmentCount: 1`、`durationMs: 65000`、`audioByteLength: 1024`、`hasTranscript: false`。
- GREEN / REFACTOR：
  - `App` 增加 feature-local `pendingSegmentDeleteProjectionsRef`，只记录当前 grace period 内的 `workspaceId` / `memoryId` / `segmentId`、被删 Segment、删除前 Memory summary 和 optimistic Memory summary；不引入 generic runtime 或全局 store。
  - `refreshWorkspaceFromFileTruth` 在写入 snapshot cache 和 session 前重放 pending Segment exclusion；存在 pending Segment delete 时暂不 invalidate Memory detail、Segment content 或 SegmentAttachment content cache，避免尚未真实删除的文件真源把目标 Segment 带回 renderer。
  - Undo、delayed delete success 和 delayed delete failure 都清除该 pending projection；真实 content cache 仍只在 delayed `workspace:deleteSegment` 成功后移除。
  - `docs/current/data.md`、`flow.md`、`frontend.md`、`quality.md` 增加 refresh 不变量。
- 补充验证：
  - RED 后实现修正并重跑目标测试：1 个测试文件通过，1 个目标测试通过 / 56 skipped。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "optimistically hides a deleted Segment|restores an optimistically deleted Segment without rolling back a later Memory rename|commits Segment deletion after the undo toast grace period expires|rolls back optimistic Segment deletion when delayed commit fails"`：1 个测试文件通过，4 个目标测试通过 / 53 skipped。
  - `npm run typecheck` 通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx`：57 个 App 测试通过。
  - `npm run verify:quick` 最终通过：typecheck 通过；`test:main` 348 个测试通过；`test:renderer` 28 个文件 / 263 个测试通过；lint 通过；format check 通过。Node 26 仍打印 jsdom localStorage experimental warning，当前测试 setup 生效且 full gate 通过。

**Step 1 交互状态设计返工**

- 用户反馈：
  - toast `恢复` action 默认态不应有边框或填充；hover 态也不能出现描边，需符合柔软扁平的设计系统。
  - DropdownMenu item hover / highlighted 在深色主题下不明显。
  - 删除确认弹层中的 `取消` 与红色 `删除` button hover 都需要可见反馈；红色 button 的 `/90` hover 变化不够明显。
- 官方 / 设计参考：
  - Radix DropdownMenu 使用 item highlighted/focus 状态承载菜单导航反馈；Reo primitive 同时响应 `data-highlighted` 和 focus。
  - shadcn DropdownMenu 与 Sonner action 仍作为结构范式；Reo 只调整 token 和 primitive class，不创建新 toast 结构。
  - Claude 本轮因账号额度返回 `You've hit your limit · resets 4:40am (America/Los_Angeles)`，未产出意见。
  - Gemini `gemini -m gemini-3.1-pro-preview -p ...` 建议：toast action 默认透明无边框；深色 `accent` 不应与 `popover` 同色；destructive hover 用更明确的扁平颜色变化而非原色不变。
- RED：
  - `npm run test:renderer -- src/renderer/src/components/ui/button.test.tsx src/renderer/src/components/ui/dropdown-menu.test.tsx src/renderer/src/components/ui/toaster.test.ts src/renderer/src/App.test.tsx -t "compact square-rounded|destructive action|large icon|compact menu|toast actions quiet|optimistically hides" --testTimeout=20000`：失败点包括 secondary button 仍 `hover:bg-secondary`、destructive button 仍 `hover:bg-destructive/90`、DropdownMenu item 缺少 `data-[highlighted]` 状态、toast hover 仍含 inset `box-shadow`。
  - `npm run test:renderer -- src/renderer/src/components/ui/button.test.tsx src/renderer/src/components/ui/toaster.test.ts src/renderer/src/App.test.tsx -t "destructive action|toast actions quiet|optimistically hides" --testTimeout=20000`：失败点为 toast hover 仍含 `box-shadow`，destructive button 仍 `hover:bg-destructive/90`。
- GREEN / REFACTOR：
  - 深色 `accent` 改为 `color-mix(in oklab, var(--foreground) 10%, var(--popover))`，修复 popover 上菜单、ghost icon、secondary button 的同色 hover 问题。
  - Button primitive：secondary hover 统一使用 `bg-accent text-accent-foreground`；destructive hover 改为 `bg-destructive-hover`，由 theme token 用 `color-mix` 把 destructive 轻微推亮，保持扁平但更可见；primary 继续只用 `/90`，避免色相跳变。
  - DropdownMenu primitive：item 同时使用 Radix `data-[highlighted]` 与 focus 的 `bg-accent text-accent-foreground`。
  - Toast action：默认透明、无边框、无填充；hover/active 只画 `color-mix` 填充，不画 inset border；focus-visible 保留键盘 ring。
- 保护测试：
  - RED 后实现修正并重跑目标测试：`npm run test:renderer -- src/renderer/src/components/ui/button.test.tsx src/renderer/src/components/ui/toaster.test.ts src/renderer/src/App.test.tsx -t "destructive action|toast actions quiet|optimistically hides" --testTimeout=20000`：3 个目标测试通过 / 62 skipped。
  - `npm run verify:quick` 首次发现 `src/renderer/src/components/ui/toaster.test.ts` 直接读取 `node:fs`，违反 renderer tsconfig 类型边界；该 CSS 源约束测试移到 `test/main/rendererToastCss.test.ts`，renderer 继续通过 App/Button/Dropdown 测试覆盖可见行为和 class surface。
  - 设计 token 同步门禁随后发现 `src/renderer/src/theme.css` 的 dark `accent` 与 `docs/current/design-system/*` 不一致；同步更新 `docs/current/design-system/tokens.json`、`theme.css`、`variables.css` 和 `test/main/designSystemTokens.test.ts`，保持运行时 token 与设计系统真源一致。
  - `npm run test:main`：349 个 main/preload/CSS/token 测试通过，其中包含 `toast action hover keeps the soft flat surface without an inset border`。
  - `npm run test:renderer -- src/renderer/src/components/ui/button.test.tsx src/renderer/src/components/ui/dropdown-menu.test.tsx src/renderer/src/App.test.tsx -t "destructive action|compact menu|optimistically hides" --testTimeout=20000`：3 个目标测试通过 / 62 skipped。
  - `npm run test:renderer -- src/renderer/src/components/ui/button.test.tsx src/renderer/src/components/ui/dropdown-menu.test.tsx src/renderer/src/App.test.tsx --testTimeout=20000`：3 个文件 / 66 个测试通过。
  - `npm run verify:quick` 最终通过：typecheck 通过；`test:main` 349 个测试通过；`test:renderer` 28 个文件 / 263 个测试通过；lint 通过；format check 通过。Node 26 仍打印 jsdom localStorage experimental warning，当前测试 setup 生效且 full gate 通过。
- 运行时视觉证据：
  - Computer Use 连接当前 Electron dev runtime（窗口 `Reo`，URL `localhost:5173/`）。
  - 打开 Segment card More 菜单，运行时菜单显示 `重命名` 与 `删除` 两个 item，使用统一 DropdownMenu popover surface；该菜单未触发任何数据写入。
  - 点击菜单 `删除` 只打开 AlertDialog；运行时显示 `删除片段`、描述 `删除“ 测试 ”？补充录音会随片段一起进入恢复区。`、`取消` 与红色 `删除` button。未点击确认删除，随后点击 `取消` 关闭弹层，用户数据未被删除。

**Step 1 统一危险确认 / Toast 生命周期补充返工**

- 用户反馈：
  - Memory delete Dialog 和 Memory delete undo toast 仍是旧结构；Memory / Segment / Memory space remove 的危险确认不应各自重新设计。
  - Undo toast 和普通 toast 应在同一结构上变化，恢复按钮必须是 icon+文字，默认态无边框/填充，hover 只做柔和高光。
- 设计 / 官方参考：
  - Gemini `gemini -m gemini-3.1-pro-preview -p ...` 返回可采用意见：删除确认应使用 AlertDialog 线性结构；undo toast 不使用 `toast.success`；toast action 默认透明无描边；用 `dismissible: false` 防止手动关闭绕过撤销/提交语义。
  - Claude 同轮因为账号额度返回 `You've hit your limit · resets 4:40am (America/Los_Angeles)`，未产出新意见。
- Subagent 扫描发现：
  - `MemoryDeleteDialog` 仍用普通 Dialog + 内嵌 `bg-card` 内容卡；`SegmentDeleteDialog` 已用 AlertDialog 线性结构。
  - Memory delete toast 使用 `toast.success`，导致成功图标和 undo toast chrome 与 Segment 不统一。
  - Segment undo toast 若被手动 dismiss，可能留下“renderer 已隐藏但 main 未删除”的 pending 状态；pending delete 还会压制整个 workspace 的 detail/content invalidate；离开 workspace 后旧 toast 的 `onAutoClose` 可能继续用捕获的旧 handle 发 IPC。
- RED：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "confirms Memory deletion"`：失败，找不到 role `alertdialog` 的 `删除记忆`，当前实际为普通 `dialog`，且仍有旧内容卡。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "removes a persisted workspace from the sidebar"`：失败，`移除记忆空间` 仍是普通 `dialog`。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "commits Segment deletion"`：失败，Segment undo toast 缺少 `dismissible: false`。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "does not commit a pending Segment delete"`：失败，离开 workspace 后旧 toast `onAutoClose` 仍调用 `deleteSegment`。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "keeps external summary changes"`：失败，pending projection 把外部 `hasTranscript: true` 错投成 `false`。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "keeps non-target Memory detail refreshable"`：失败，pending delete 后切回非目标 Memory 没有重新读取 detail，说明 refresh invalidate 被全局压制。
- GREEN / REFACTOR：
  - 新增 workspace-level `WorkspaceDangerConfirmDialog`，Memory delete、Segment delete 和 Memory space remove 都复用同一 AlertDialog 线性结构；确认 action `preventDefault`，由业务成功/失败决定是否关闭，不让 Radix action 自动关闭。
  - 新增 `showReoUndoToast`，Memory delete 和 Segment delete 共用同一 neutral undo toast surface、目标 title、icon+文字恢复 action、底部 progress bar、`closeButton: false` 和 `dismissible: false`；Memory undo 仍调用 `restoreDeletedMemory`，Segment undo 仍只做 renderer local rollback，不引入 generic undo runtime。
  - Segment pending projection 绑定当前 workspace session；toast auto-close / undo 时如果当前 session 已不是原 handle，只清 pending，不调用旧 IPC。
  - Workspace refresh 只保护目标 Memory detail、目标 Segment content 和目标 SegmentAttachment content；非目标 Memory detail/content 继续 invalidate。
  - Pending projection 只在 file-truth summary 仍匹配删除基底时覆盖 `hasTranscript` / `updatedAt` 等派生字段；外部 summary 已变化时保留外部事实。
  - 抽出 `segmentActionTargets.ts`，让 Segment rename/delete target 类型由 workspace action owner 持有，不再从 dialog 文件反向导入。
- 保护测试：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "confirms Memory deletion"`：通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "removes a persisted workspace from the sidebar"`：通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "commits Segment deletion"`：通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "does not commit a pending Segment delete"`：通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "keeps external summary changes"`：通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "keeps non-target Memory detail refreshable"`：通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx`：60 个 App 测试通过。
- 文档同步：
  - `docs/current/data.md`：写入 pending projection 只保护目标 query、非目标 query 继续 invalidate、外部 summary 变化保留。
  - `docs/current/flow.md` / `frontend.md`：写入统一危险确认、undo toast 不可手动 dismiss、离开 workspace 后不使用旧 handle 提交 pending delete。
  - `docs/current/quality.md`：写入新增 renderer 行为覆盖门槛。
  - `docs/current/design-system/DESIGN.md`：写入 AlertDialog 线性危险确认、undo action 扁平 hover、`destructive-hover` 是 destructive action 状态 token。
- 上一轮 subagent 审查：
  - 结论：PASS；BLOCKER 无，MAJOR 无。
  - Minor 文档问题已修正：`docs/current/frontend.md` 的临时浮层列表补入 `AlertDialog`，与同文件 primitive 规则和 `docs/current/design-system/DESIGN.md` 保持一致。
  - 审查确认 Memory delete、Segment delete、Memory space remove 只共享危险确认 surface，不合并各自生命周期；Segment delayed delete / pending projection 仍由 workspace owner 持有，Electron IPC 仍为显式 channel + preload 窄方法。
- 上一轮 Computer Use 运行时视觉证据：
  - Electron runtime `localhost:5173/` 内打开 Segment More 菜单，菜单显示 `重命名` / `删除`，DropdownMenu 使用统一 popover surface。
  - 点击 Segment `删除` 只打开 `删除片段` AlertDialog：线性 title / description / footer，按钮为 `取消` 和红色 `删除`；点击 `取消` 关闭，未执行删除。
  - 打开右侧 MemoryRail 的 Memory More 菜单，菜单显示 `重命名记忆` / `删除记忆`；点击 `删除记忆` 打开同结构 `删除记忆` AlertDialog，文案说明片段和补充录音进入恢复区；点击 `取消` 关闭，未执行删除。
  - 打开 sidebar memory space More 菜单，菜单显示 `重命名记忆空间` / `移除记忆空间`；点击 `移除记忆空间` 打开同结构 `移除记忆空间` AlertDialog，文案说明本地文件夹不会被删除；点击 `取消` 关闭，未执行移除。
- 上一轮门禁：
  - `npm run verify:quick`：全绿；typecheck 通过，`test:main` 349 通过，`test:renderer` 28 个文件 / 266 个测试通过，lint 通过，format check 通过。

**Step 1 subagent `$review` / `$ycksimplify` 返工**

- Subagent 审查结论为 FAIL：
  - BLOCKER：main `deleteSegmentFromFileTruth` 在 Segment 已移入 trash 后遇到 delayed lock lost 会返回 lock lost，但错误信封没有表达文件已写出；renderer 把所有 delayed failure 都局部回滚，会把磁盘已进入恢复区的 Segment 假恢复到 UI。
  - MAJOR：多个 pending Segment delete 并存时，任一 delayed success 直接合并 main 返回的父 Memory summary，会把其他仍 pending 的 Segment 从 summary/session 中复活。
  - MAJOR：delayed IPC response 只按 `workspaceId` 写 cache/session；关闭并重新打开同一 `workspaceId` 后，旧 handle 的 in-flight response 和旧 Memory detail cache 可能污染新 session。
  - MAJOR：`App.confirmDeleteSegment` 已承担 pending projection、summary 推导、toast、rollback、cache cleanup 和 IPC response 处理，继续叠分支会变 patchy；需要把 projection 规则抽成 feature-local 纯模块。
- RED：
  - `npm run test:main -- test/main/memoryFiles.test.ts`：新增 `delete Segment reports stale file truth when the workspace lock is lost after moving files` 失败；输出显示 `actual: undefined`，期望 `dataRetention: "file-written-index-stale"`。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "keeps other pending Segment deletes projected|keeps Segment deletion projected when delayed commit reports stale file truth"`：2 个目标测试失败。多 pending 用例中 delayed first success 后实际 `segmentCount: 2` / `durationMs: 5000` / `audioByteLength: 500`，期望仍投影为 `segmentCount: 1` / `durationMs: 3000` / `audioByteLength: 300`；`file-written-index-stale` 用例中被删 Segment 又回到 UI，期望继续隐藏。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "ignores an in-flight delayed Segment delete response"`：新增 reopen 同一 `workspaceId` 回归测试先失败，重新打开后找不到 `Birthday candles reopen`，暴露不含 handle 的 Memory detail cache 被旧 session 复用。
- GREEN / REFACTOR：
  - `segmentDeleteError` / `segmentRestoreError` 在 `WorkspaceHandleLost` 上保留当前 transaction 的 `dataRetention`，使 move 后 lock lost 明确返回 `file-written-index-stale`。
  - Segment pending projection key 增加 `workspaceHandle`；toast auto-close / undo 和 delayed response 返回后都重新校验原 session handle，旧 handle 不再提交 IPC 或改写新 session。
  - Delayed delete success 清除本次 pending 后，对 main 返回的父 Memory summary 重放仍 pending 的 Segment delete projections；一个成功 response 不再复活其他待删 Segment。
  - `file-written-index-stale` delayed failure 只清 content cache、保留删除投影并显示错误 toast，不做本地假恢复；`previous-file-preserved` failure 继续走局部恢复。
  - 因 Query key 不包含 `workspaceHandle`，App 在 ready 新 workspace session 前和 close 当前 session 成功后清理同 `workspaceId` 的 Memory detail、Segment content 与 SegmentAttachment content caches；snapshot 仍由 ready snapshot seed。
  - 抽出 `src/renderer/src/workspace/segmentDeleteProjection.ts`，集中 Segment delete pending key、summary removal/restore、pending projection replay、session ownership 与 query-key match 规则；`App` 保留 UI/IPC orchestration，不继续把 projection 规则内嵌在大组件。
- 保护测试：
  - RED 后实现修正并重跑 `npm run test:renderer -- src/renderer/src/App.test.tsx -t "keeps other pending Segment deletes projected|keeps Segment deletion projected when delayed commit reports stale file truth|ignores an in-flight delayed Segment delete response"`：1 个文件通过，3 个目标测试通过 / 60 skipped。
  - `npm run test:main -- test/main/memoryFiles.test.ts`：350 个 main/preload/CSS/token 测试通过。
- 文档同步：
  - `docs/current/data.md`：写入 handle-scoped content cache 清理、多 pending projection replay、`file-written-index-stale` 不做本地恢复。
  - `docs/current/flow.md` / `frontend.md`：写入旧 handle in-flight response 不改写新 session、session 边界清理 query cache、多个 pending delete 不互相复活。
  - `docs/current/electron.md`：写入 `workspace:deleteSegment` move 后 lock lost 必须携带 `dataRetention: "file-written-index-stale"`。
  - `docs/current/quality.md`：写入 renderer/main protection coverage。

**Step 1 subagent `$review` / `$ycksimplify` 二次返工**

- Subagent 复审结论为 FAIL：
  - MAJOR：`segmentDeleteProjection.ts` 用 `segmentCount <= optimisticMemory.segmentCount` 这类 aggregate summary 关系跳过 replay，等于把 summary count 当作 Segment identity。多个 pending delete 乱序提交时会把仍 pending 的 Segment 复活。
  - MINOR：`App.tsx` 仍有重复的 handle-scoped query predicate。
  - MINOR：projection 规则只有 App integration tests，缺少纯规则单元测试，容易继续在大组件里堆分支。
- RED：
  - `npm run test:renderer -- src/renderer/src/workspace/segmentDeleteProjection.test.ts`：新增纯规则测试失败 2 个。`replays a remaining pending delete over a later delayed commit response` 实际返回 `audioByteLength: 400`、`durationMs: 4000`、`segmentCount: 2`，期望 `300 / 3000 / 1`；`replays multiple pending deletes without using aggregate count as identity` 实际返回 `500 / 5000 / 2`，期望 `300 / 3000 / 1`。
  - `App.test.tsx` 的多 pending 用例扩展为第二个 delayed response 先返回，暴露旧实现只保护 first-success 顺序。
- GREEN / REFACTOR：
  - 移除 `memorySummaryWithPendingSegmentDelete` 的 aggregate count early return；pending replay 始终以 `workspaceHandle`、`workspaceId`、`memoryId`、`segmentId` 作为身份，只用 pending Segment 的 additive delta 调整 summary。
  - 新增 `src/renderer/src/workspace/segmentDeleteProjection.test.ts`，纯测试覆盖 delayed commit 乱序、多个 pending delete 和外部 summary 变化。
  - `workspaceQueries.ts` 新增 `workspaceHandleScopedContentQueryBelongsToWorkspace`，`App.tsx` 复用该 helper，删除本地重复 query predicate。
  - `App.test.tsx` 的多 pending delete 用例覆盖第二个 delete 先 auto-close 成功，要求第一个 pending 仍被投影。
- 保护测试：
  - `npm run test:renderer -- src/renderer/src/workspace/segmentDeleteProjection.test.ts src/renderer/src/workspace/workspaceQueries.test.ts`：2 个文件 / 8 个测试通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "keeps other pending Segment deletes projected|keeps Segment deletion projected when delayed commit reports stale file truth|ignores an in-flight delayed Segment delete response"`：1 个文件通过，3 个目标测试通过 / 60 skipped。
- 文档同步：
  - `docs/current/data.md`：写入 Workspace snapshot summary 不含 Segment ids，pending 身份不能由 `segmentCount` 等 aggregate equality 推断。
  - `docs/current/flow.md` / `frontend.md`：写入 pending replay 使用 Segment identity + additive delta，不用 summary count 判断实体是否已删除。
  - `docs/current/quality.md`：写入 Segment delete projection 纯规则测试门槛。

**Step 1 置信度审查返工**

- 新一轮对抗审查结论为 FAIL：
  - MAJOR：Segment delete toast lifecycle 需要 phase guard；重复 `onAutoClose` 不能重复提交，commit 已开始后点击 `恢复` 不能把已经进入提交阶段的删除回滚成可见。
  - MAJOR：Workspace refresh 在 pending delete 存在时不能只对 summary aggregate 扣减；如果文件真源 refresh 已经不包含该 Segment，会出现 double subtract。带 pending 的 refresh 必须读取 identity-bearing Memory detail。
  - MAJOR：refresh 读取 detail 后不能在 session 失效前先写 Query cache；同一 `workspaceId` 重新打开后，旧 session 的 pending refresh detail 不得覆盖新 session cache。
  - MAJOR：main 在 delete/restore Segment 时，验证 file truth 后到最终 rename 前如果源目录被安全目录替换，不能移动替换目录。
  - MINOR：destructive Segment source read 遇到 unsafe `segment.json` leaf 时不能降级为 not-found。
- RED：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "commits Segment deletion after the undo toast grace period expires|does not undo a Segment delete after the grace period has started committing|keeps other pending Segment deletes projected|does not double subtract" --testTimeout=20000`：新增 phase / double-subtract 断言后失败。重复 `onAutoClose` 使 `deleteSegment` 调用 2 次；commit 已开始后点击 `恢复` 会把 Segment 重新显示；file-truth 已排除 pending Segment 的 refresh 会把 summary 重复扣减。
  - `npm run test:main -- test/main/memoryFiles.test.ts`：新增测试先因缺少 `setBeforeFileSpaceNodeMoveForTest` 编译失败，确认需要可控 race hook；实现 hook 后 `delete Segment reports unsafe finalized metadata leaf instead of treating it as missing` 失败，实际 `ERR_RECORDING_NOT_FOUND`，期望 `ERR_WORKSPACE_UNSAFE_PATH`。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "does not let a stale pending refresh detail overwrite a reopened workspace session" --testTimeout=20000`：新增 stale refresh detail 用例失败，cache 中实际只剩 `Old remaining from stale refresh`，期望保留 reopened session 的 `Fresh remaining after reopen`。
- GREEN / REFACTOR：
  - Segment delete toast lifecycle 改为 `pending → committing|undone → settled` 单向 phase；重复 auto-close 直接忽略，commit 开始后 undo 不再执行 rollback。
  - `setWorkspaceSession` 同步更新 `workspaceSessionRef` 和 session revision，session 边界立即清 pending projection；不再等 React effect 才更新 ref。
  - Workspace refresh 对带 pending 的 Memory 读取 `readMemoryDetail`，用 detail `segments[]` 识别目标 Segment 是否仍存在，再派生 summary；detail cache update 先收集，只有 request id 和 session revision 仍匹配当前 session 后才写入。
  - `moveFileSpaceNodeDirectory` 支持 `expectedSourceIdentity`，Segment delete/restore 把 destructive source file truth 读到的 directory identity 传入最终 rename；验证后源目录被替换时返回 unsafe typed error 并保留文件。
  - destructive `readValidFinalizedSegmentFileTruthFromDirectory` 增加 strict unsafe path 模式；`ELOOP`、`ENOTDIR` 和 `path changed` 纳入 unsafe path 判定，避免 unsafe metadata leaf 被吞成 not-found。
- 保护测试：
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "commits Segment deletion after the undo toast grace period expires|does not undo a Segment delete after the grace period has started committing|keeps other pending Segment deletes projected|does not double subtract|does not let a stale pending refresh detail overwrite" --testTimeout=20000`：1 个文件通过，5 个目标测试通过 / 61 skipped。
  - `npm run test:main -- test/main/memoryFiles.test.ts`：353 个 main/preload/CSS/token 测试通过。
  - `npm run verify:quick` 首次在 full renderer suite 暴露 2 个 `hasTranscript` 边界失败：普通 pending refresh 的 fixture 与期望不一致；外部 summary 已变化时实现用可能 stale 的 detail 覆盖了非 additive `hasTranscript`。修正后新增 `memorySummaryPreservingExternalNonAdditiveChanges`，并把普通 fixture 的剩余 Segment transcript presence 与期望对齐。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "optimistically hides a deleted Segment and restores it from toast undo without IPC|keeps external summary changes while projecting a pending Segment delete|does not double subtract|does not let a stale pending refresh detail overwrite" --testTimeout=20000`：1 个文件通过，4 个目标测试通过 / 62 skipped。
  - `npm run verify:quick` 初次通过：typecheck 通过；`test:main` 353 个测试通过；`test:renderer` 29 个文件 / 276 个测试通过；lint 通过；format check 通过。Node 26 仍打印 jsdom localStorage experimental warning。
- 追加 subagent 复审发现 2 个阻断点：
  - BLOCKER：delete/restore 的正向 move 已使用 `expectedSourceIdentity`，但 index-failure rollback move 未沿用已验证 Segment directory identity；rollback race 中可能搬动替换目录，并错误报告 `previous-file-preserved`。
  - BLOCKER：一次 full `npm run verify:quick` 在 `App.test.tsx` 的 `renames a Segment card optimistically without waiting for file persistence` 上触发默认 5 秒 timeout；目标测试单跑通过，问题是 full renderer gate 下的长交互测试稳定性。
  - MAJOR：delete/restore 成功路径先扫描 Segment ids 修 `memory.json.segmentIds` mirror，再 `refreshMemoryIndexEntry` 重扫 Segment/attachments 生成 summary/index entry，delayed commit 的文件读放大。
  - MAJOR：restore parent Memory 先 `exists()` 再 `assertSafeExistingDirectory()`，形成不必要的 TOCTOU 预检。
  - 最终 `$ycksimplify` 复审追加 MAJOR：restore 成功路径仍在恢复前通过 `readValidFinalizedSegmentFileTruth` 扫描 active Segment candidates；原单次 scan 测试只统计后置 file-truth list，漏掉该扫描。
- 追加 RED：
  - `npm run test:main -- test/main/memoryFiles.test.ts`：新增 `delete Segment does not move a replacement trash directory during rollback` 和 `restore Segment does not move a replacement active directory during rollback` 后失败，实际 `dataRetention: "previous-file-preserved"`，期望 `file-written-index-stale`。
  - 本地继续审查发现 rollback 在 index refresh 普通失败后没有重新消费 workspace usability；新增 `delete Segment does not rollback after index failure if the workspace lock is lost` 和 `restore Segment does not rollback after index failure if the workspace lock is lost` 后，同一命令失败，实际 `dataRetention: "previous-file-preserved"`，期望 `file-written-index-stale`。
  - 新增 `delete Segment refreshes segmentIds mirror and index from one file-truth scan` / `restore Segment refreshes segmentIds mirror and index from one file-truth scan` 时，先因缺少 `setBeforeSegmentFileTruthListForTest` 编译失败；补测试钩子后旧实现会计数 2 次 Segment file-truth list，期望 1 次。
  - 补充 `setBeforeSegmentDirectoryCandidateScanForTest` 后，`restore Segment refreshes segmentIds mirror and index from one file-truth scan` 失败，实际恢复前 active candidate scan 计数为 1，期望 0。
  - 删除恢复前 active lookup 后，新增 `restore Segment rolls back when the active tree already has a renamed duplicate id` 首次失败，实际 `dataRetention: "file-written-index-stale"`，说明 duplicate active 场景触发错误后 rollback 又按 Segment id 扫描 active candidates，无法精确找到本次刚移动的目录。
- 追加 GREEN / REFACTOR：
  - `deleteSegmentFromFileTruth` / `restoreDeletedSegmentFromFileTruth` 在 destructive source read 后保存 `movedSegmentDirectoryIdentity`，正向 move 和 rollback move 复用同一个 expected source identity；rollback 发现 source 已替换时失败并返回 `file-written-index-stale`，不移动 replacement active/trash directory。
  - delete/restore rollback 在解析 parents、move、metadata mirror write 和 index rebuild 时继续消费 `assertWorkspaceUsable`；lock 已失效时不继续搬文件，保留已写出的 active/trash 文件真源。
  - 新增 `refreshMemoryIndexEntryFromKnownFileTruths`，成功 move 后用同一次 active Segment file-truth scan 同时更新 `memory.json.segmentIds` mirror、父 Memory summary 和 `.reo/index.json` entry；restore 的 restored Segment projection 也复用该 file-truth 集合。
  - restore 删除恢复前 active candidate lookup；同 id active duplicate 由 move 后唯一 active file-truth scan 检出，并通过本次已移动的 leaf name + directory identity 精确回滚回 trash。delete/restore rollback 均不再按 Segment id 重新扫描 active/trash candidates。
  - 删除 restore parent 的 `exists()` 预检，直接用 `assertSafeExistingDirectory` 的 `ENOENT` 映射 `ERR_SEGMENT_RESTORE_PARENT_MISSING`。
  - 给该 App 长交互集成测试显式 `10_000` timeout；不改变产品逻辑，只让 full renderer gate 在负载下仍表达同一行为规格。
- 追加保护测试：
  - `npm run test:main -- test/main/memoryFiles.test.ts`：360 个 main/preload/CSS/token 测试通过。
  - `npm run test:renderer -- src/renderer/src/App.test.tsx -t "renames a Segment card optimistically without waiting for file persistence"`：1 个文件通过，1 个目标测试通过 / 65 skipped。
  - `npm run verify:quick` 重跑时 typecheck、`test:main` 360 个测试、`test:renderer` 29 个文件 / 276 个测试和 lint 均通过；最后 format check 暴露 clean tracked 文件 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/reuse-evaluation.md` 需要 Prettier 表格格式化。该文件只做机械格式化后重跑完整门禁。
  - `npm run verify:quick` 最终通过：typecheck 通过；`test:main` 360 个测试通过；`test:renderer` 29 个文件 / 276 个测试通过；lint 通过；format check 通过。Node 26 仍打印 jsdom localStorage experimental warning。
- 文档同步：
  - `docs/current/data.md`：写入 pending refresh 使用 identity-bearing Memory detail、session revision 后写 cache、Segment delete/restore 正向与 rollback move 使用 expected source identity、rollback 使用本次已移动 leaf name、成功路径单次 file-truth scan、restore 不做恢复前 active candidate scan、restore parent 无 exists 预检。
  - `docs/current/flow.md`：写入 toast phase guard、refresh cache 写入 session gate、destructive source strict unsafe path、正向与 rollback source identity move guard、rollback 不按 id 重扫 candidates、单次 file-truth scan 和 restore parent 直接安全读取。
  - `docs/current/electron.md`：写入 `workspace:deleteSegment` / `workspace:restoreDeletedSegment` 的正向与 rollback expected source identity、lock usability、rollback leaf name 和单次 file-truth scan 约束。
  - `docs/current/frontend.md`：写入 toast lifecycle phase、pending refresh detail 投影和 session-gated cache 写入。
  - `docs/current/quality.md`：写入新增 renderer/main protection coverage。

**中断修复：记忆空间重命名同步真实文件夹**

- 用户在 Step 1 提交后指出当前实现缺陷：重命名记忆空间只改 UI / metadata，Finder 中真实文件夹名没有同步修改。该问题属于文件真源模型错误，先于 Step 2 修复。
- 根因审查：
  - 旧模型把 `.reo/workspace.json.title` 当作记忆空间 title 真源，只在 Finder 改名后的 open flow 中把 root basename 写回 metadata；这与创建时 title 创建同名 child folder、空文件夹 open 用 basename 作为 title、Memory/Segment 目录 basename 作为可见名称真源的规则不一致。
  - `workspace:updateMemorySpaceTitle` 旧实现只调用 `updateWorkspaceTitleFromFileTruth` 写 `.reo/workspace.json` 并更新 registry projection，没有移动 root folder。
  - active handle 和 lock 都保存旧 canonical root；如果只移动目录而不迁移 handle/lock，后续 snapshot read 和 close 会失效。
- RED：
  - `npm run test:main` 新增 `updateMemorySpaceTitle updates workspace file truth and registry projection` 后失败：旧 root folder 未消失，真实 folder basename 没有改成提交 title。
  - 同批新增 active handle 用例失败：重命名后 root folder 未移动；后续同 handle snapshot read / close 仍缺保护。
  - 新增同名 sibling conflict 用例失败：旧实现返回成功，没有保护目标 folder 已存在。
  - 新增 contract 用例失败：`workspace:updateMemorySpaceTitle` 仍接受 `/`、`\`、NUL、`.`、`..` 等不安全 folder title。
  - 子代理 `$review` / `$ycksimplify` 后补 RED：direct `workspace:open` 选择 Finder 已改名 root 时仍显示旧 metadata title；root rename 先写 metadata 再移动 folder，metadata mirror 写入阶段失败时会声明 `none-written`，无法表达 root folder 已经移动的提交点。
  - 复审后补 RED：registered `workspace:openMemorySpace` 在 stored root 仍存在但 registry / metadata title 陈旧时仍显示旧 title；root move 后 finalization 失败会误报旧文件保留；目标 sibling folder 在最终 preflight 后出现时可能被裸 rename 覆盖；active `workspace:readWorkspaceSnapshot` 会把 stale `.reo/workspace.json.title` 回灌 UI；registered open 的 title mirror repair 晚于 recovery/index 写入；macOS 默认大小写不敏感文件系统上 case-only root rename 会误报失败。
- GREEN / REFACTOR：
  - `workspaceUpdateMemorySpaceTitleRequestSchema` 的 title 改为 safe folder title，与 memory space initialize 的 folder-name 约束一致。
  - 新增 `renameWorkspaceRootFromFileTruth`：在 single-writer lock 下把 root folder rename 到同父目录的目标 title，以 root move 作为提交点；随后迁移 lock/handle canonical root 并写 `.reo/workspace.json.title` mirror。目标 sibling 已存在返回 `ERR_WORKSPACE_ALREADY_EXISTS`，不改 root、metadata 或 registry。
  - `WorkspaceLock` 支持同一 directory identity 下的 canonical root relocation；`WorkspaceHandleStore` 增加 `relocateHandleRoot`，active rename 后同一个 opaque handle 继续可用于 snapshot read 和 close。
  - inactive rename 的临时 lock 也在 root move 后 relocation，确保 finally release 释放的是新 root 下同一个 lock directory；root move 后 metadata mirror 失败返回 `file-written-index-stale`，不再误报旧文件保留。
  - direct `workspace:open` existing folder 时把 selected root basename 作为 expected title，在 lock 内确认 workspaceId 后修复 `.reo/workspace.json.title` mirror 和 registry projection。
  - inactive registry projection 在 root move 成功后写入失败时返回 `ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED` + `file-written-index-stale`，不再让 renderer 误回滚已提交的文件真源改名。
  - renderer 对 memory space rename 的 `file-written-index-stale` 错误保持 optimistic title，只显示 root toast；普通失败仍回滚。
  - registry projection 写入使用新 canonical root；active path 仍保持 registry best-effort，不因 projection failure 阻断已成功的文件真源 rename。
  - registered open 和 direct open 都以 canonical root basename 作为 expected title；`.reo/index.json` 不承载 memory space title，只保留 `memories[]` summary 投影。
  - root move final step 使用 no-overwrite platform move，并用 directory identity 判定 move 成功、目标冲突或异常；root move 后立即迁移 handle/lock canonical root，finalization 或 mirror 写入失败均返回 `file-written-index-stale`。
  - open path 在 single-writer lock 内、任何 recovery/index 写入前只修 `.reo/workspace.json.title` mirror，不再复用会读取/rebuild `.reo/index.json` 的旧 title update helper。
  - active snapshot refresh 在 rebuild read model 或写 `.reo/index.json` 前按 root basename 修复 title mirror，response title 不再来自 stale metadata。
  - case-only rename 在大小写不敏感文件系统上以目标 path 解析到原 root identity 且 platform move 成功作为成功，避免误报 `previous-file-preserved`。
  - 删除 metadata-only `updateWorkspaceTitleFromFileTruth` 旧 helper；memory space title 更新只剩 root rename 和 root-basename mirror repair 两条语义。
  - root rename 在 root move 与 metadata mirror 提交前不读取或重建 `.reo/index.json`；同名目标冲突等 pre-move 失败不得改变 index projection。
  - 删除 `openWorkspaceRoot` 的无实际 false 语义控制参数；existing-root open 统一在 lock 后、open/recovery/index 前执行 root-basename title mirror repair。
- 保护测试：
  - RED：`npm run test:main` 新增 `workspace root rename conflict does not rebuild the memory index` 时失败，失败输出显示 corrupt `.reo/index.json` 被改写成空 `memories[]`。
  - GREEN：`npm run test:main`：373 个 main/preload/CSS/token 测试通过。
  - `npm run test:renderer`：29 个文件、277 个 renderer 测试通过。
  - `npm run typecheck`、`npm run lint`、touched-file `npx prettier --check ...`、`git diff --check HEAD` 均通过。
  - 最新 subagent 复核：`$review` PASS；`$ycksimplify` 仅提出低优先级控制参数和 fsync helper 重复，控制参数已删除；最终复核 PASS。
  - `npm run verify:quick` 已运行：typecheck、main、renderer、lint 阶段通过；最后 `format:check` 因 4 个无关且当前 clean 的 initiative 文档未按 Prettier 格式失败（`career-roadmap.md`、`interview-readiness.md`、`product-thesis.md`、`role-evolution.md`）。本修复未修改或格式化这些文件。
- 文档同步：
  - `docs/current/architecture.md`：写入 memory space root basename 是 title 文件真源，metadata 是 mirror，registry 是 projection。
  - `docs/current/data.md`：写入 rename 同步 root folder、metadata mirror、registry projection、active handle/lock relocation 和 conflict 保留边界。
  - `docs/current/flow.md`：写入 active / inactive rename 时序和 lock relocation。
  - `docs/current/electron.md`：写入 IPC payload 的 safe title、真实 root folder rename 和 response 不暴露 path。
  - `docs/current/frontend.md`：写入 renderer 只提交 trimmed title，安全校验和 root move 由 main 执行，并记录 `file-written-index-stale` 不回滚 title。
  - `docs/current/quality.md`：写入新增 main test coverage。

### Step 2 — SegmentAttachment 可见标题 + 时间展示

- **范围**：纯 Renderer（`MemoryStudio.tsx`）。`SegmentAttachmentAudioPlayer` 当前 `title` 只作 `aria-label`，从不可见渲染。加可见 header——title + 创建时间，镜像 Segment card 的 title + `createdTimeLabel` pattern；用现有语义 token，无描边，按设计系统表达内容单元。建立 attachment row 结构，为 Step 3/4 的 More 菜单提供落点。
- **数据**：attachment projection 已有 `title` / `createdAt` / `durationMs`，无 IPC/data 改动。
- **测试**：renderer 覆盖 attachment row 渲染可见 title + time；多个 attachment 视觉可区分。
- **文档**：`frontend.md`（attachment row 形态）、`product.md`（补充 tab 展示）。

### Step 3 — SegmentAttachment 重命名

- **Main**：`updateSegmentAttachmentTitle`，镜像 `updateSegmentTitle`——按文件空间节点真源定位 attachment 目录，改 basename 为 `<attachmentId>--<title>`，写 `attachment.json` title mirror，刷新 index entry；title rename 不改 `updatedAt`。
- **IPC**：新增 `workspace:updateSegmentAttachmentTitle` channel + schema + 复用错误信封。
- **Preload + Renderer**：attachment row（Step 2 已建结构）加 More 菜单（DropdownMenu）→ `重命名` → 复用 `MemoryTitleDialog` 表单组件 → optimistic update + rollback（镜像 Segment rename：立即关 Dialog、更新 detail cache attachment 投影；保存失败且当前 title 仍是本次提交值才回滚）。
- **测试**：main 覆盖 basename / `attachment.json` mirror / index 刷新；renderer 覆盖 attachment More 菜单 → rename Dialog → optimistic update + rollback。
- **文档**：`data.md` / `flow.md` / `electron.md` / `frontend.md` / `quality.md` / `product.md`。

### Step 4 — SegmentAttachment 软删除 + 恢复

- **数据**：新 trash root `.reo/trash/attachments/<attachmentDir>/`。`attachment.json` 有 `memoryId` + `segmentId` 供恢复寻址。
- **Main**：`deleteSegmentAttachment` / `restoreDeletedSegmentAttachment`，镜像 Step 1。恢复需父 Segment（及父 Memory）存在，否则 `ERR_ATTACHMENT_RESTORE_PARENT_MISSING`。刷新父 Memory index entry 的 `attachmentCount`。
- **IPC**：新增 `workspace:deleteSegmentAttachment`、`workspace:restoreDeletedSegmentAttachment` channel + schema + 错误码。
- **Renderer**：attachment More 菜单加 `删除` → `SegmentAttachmentDeleteDialog` → 成功后更新 detail cache 的 parent segment `attachments[]` 投影、fallback（补充 tab 空了则回 转录 tab）、toast 带 `恢复` action。
- **测试 + 文档**：镜像 Step 1。

## 执行清单

- [x] Step 1 — Segment 软删除 + 恢复（main + IPC + preload + renderer + 测试 + 文档 + `verify:quick` + 操作验证）
- [ ] Step 2 — SegmentAttachment 可见标题 + 时间展示（renderer + 测试 + 文档 + `verify:quick` + 视觉验证）
- [ ] Step 3 — SegmentAttachment 重命名（main + IPC + preload + renderer + 测试 + 文档 + `verify:quick` + 操作验证）
- [ ] Step 4 — SegmentAttachment 软删除 + 恢复（main + IPC + preload + renderer + 测试 + 文档 + `verify:quick` + 操作验证）
- [ ] 收口：长期事实压缩回 `docs/current/*`，spec 移入 `docs/archive/specs/`

## 验证标准

- 每步行为改动走真实 TDD：RED 真实运行并得到具体失败输出 → GREEN 最小实现 → REFACTOR 后重跑保护测试。
- 每步收口前 `npm run verify:quick` 全绿。
- 删除 / 恢复 / 重命名涉及真实桌面操作，需 Computer Use 操作验证；attachment 展示涉及设计变更，需运行时视觉证据。
- 没有在当前快照运行过的检查不得宣称通过。

## TDD 说明

四步均为行为改动，全部执行真实 TDD。纯文档更新部分按项目规则豁免 TDD，但在对应 step 收口说明中写明。
