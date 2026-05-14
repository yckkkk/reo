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

当前模型**没有错误**，只是不完整。Memory 的 delete/restore 已是经过验证的正确模型（软删除 + `.reo/trash/memories/` + toast restore + containment + rollback）。本工作单元是把这套正确规则**推广**到 Segment 和 SegmentAttachment，不需要修模型、不需要删旧分支或旧文案。

### 「简化不删功能」检查

不删任何能力。安全边界（containment / single-writer lock / symlink guard）、数据真源（记忆空间文件）、验证路径（真实 TDD）、用户可见恢复（toast restore）全部保留，并用与 Memory 一致的更少、更清楚的结构表达。

### 最少规则（奥卡姆）

本设计几乎不新增规则，而是把现有规则推广：

1. 软删除 = 节点目录移入 `.reo/trash/<type>s/` + 刷新 index（推广 Memory 规则）。
2. 恢复 = 按 metadata id 把节点目录移回父节点 + 刷新 index（推广 Memory 规则）。
3. 父节点缺失 → typed error，不创建孤儿（本工作单元新增的唯一边界规则）。
4. 重命名 = 改 dir basename + metadata title mirror（推广 Segment rename 规则）。
5. 可见身份 = dir basename projection（SegmentAttachment 沿用已有规则，零新增）。

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
- **Query keys / invalidation / optimistic / rollback**：不新增 Query key。删除/恢复用 request/response（非 optimistic），成功 response 是唯一 UI 更新来源，删除时移除被删节点的 content Query cache；重命名用 scoped optimistic update + rollback（镜像 Segment rename），rollback 必须检查当前 title 仍是本次提交值。
- **Form / client / server state owner**：删除/恢复确认 Dialog 的 open state 属于 component state；重命名 Dialog 提交前 title draft 属于 React Hook Form；节点列表与 detail 投影属于 TanStack Query。
- **文件夹结构边界**：记忆空间文件（用户内容真源）、`.reo` metadata、`.reo/trash/*`（可恢复区）、`.reo/index.json`（可重建投影）边界清楚，本工作单元只新增 trash 子目录。

## 串行四步

每步独立可验证；一步收口（`verify:quick` 全绿 + 对应 `docs/current/*` 同批更新 + 运行时视觉/操作证据）后才进入下一步。

### Step 1 — Segment 软删除 + 恢复

- **数据**：新 trash root `.reo/trash/segments/<segmentDir>/`（segment 目录含嵌套 `attachments/` 整体移动）。`segment.json` 已有 `memoryId` + `segmentId` 供恢复寻址。
- **Main（`src/main/memoryFiles.ts`）**：`deleteSegment` / `restoreDeletedSegment`，精确复用 Memory delete/restore main flow——containment 复核、lock usability 重消费、index entry 刷新、move 失败回滚、`.reo/trash/segments/` 按需创建、symlink/非目录/ancestor-swap → typed error。删除后修复 `memory.json.segmentIds` mirror。恢复时父 Memory 缺失 → `ERR_SEGMENT_RESTORE_PARENT_MISSING`。
- **IPC（`src/workspace-contract/`）**：新增 `workspace:deleteSegment`、`workspace:restoreDeletedSegment` channel + request/response Zod schema + 错误码 `ERR_SEGMENT_DELETE_FAILED` / `ERR_SEGMENT_RESTORE_FAILED` / `ERR_SEGMENT_RESTORE_PARENT_MISSING`。
- **Preload**：加入 `window.reoWorkspace` bridge（type-only contract + channel 常量）。
- **Renderer（`MemoryStudio.tsx`）**：Segment card More 菜单加 `删除` → `SegmentDeleteDialog`（镜像 `MemoryDeleteDialog`）。确认后 `workspace:deleteSegment` → 成功后更新 Memory detail cache（移除 segment）、更新 snapshot summary、移除 `['workspace','segment-content',...]` cache、fallback selection（删的是选中项则选剩余第一条或空态）、toast 带 `恢复` action 携带 restoreToken。restore 经 toast → `workspace:restoreDeletedSegment` → 合并回 detail cache 并选中。
- **测试（TDD）**：main 覆盖移动目录 / `segmentIds` mirror 修复 / index 刷新 / 父缺失 typed error / containment / symlink guard / move 成功 index 失败回滚 / lock-lost；renderer 覆盖 Segment card 删除菜单 → Dialog → cache 更新 → fallback selection → toast 恢复。
- **文档**：`data.md`（trash 结构、删除/恢复数据决策）、`flow.md`（删除/恢复 flow + 时序）、`electron.md`（新 channel）、`quality.md`（测试覆盖面）、`product.md`（Segment 删除是 Memory Studio 内危险操作）。

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

- [ ] Step 1 — Segment 软删除 + 恢复（main + IPC + preload + renderer + 测试 + 文档 + `verify:quick` + 操作验证）
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
