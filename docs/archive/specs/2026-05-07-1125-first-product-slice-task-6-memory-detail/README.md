# Task 6：Memory detail 高保真页面

创建时间：2026-05-07 11:25 America/Los_Angeles

## 目标

把已保存 memory 从 Home summary 推进到可打开、可读取文件真源 detail 的当前产品页面。页面必须符合 Reo 当前 App shell、主题 token、reference 层级和 first slice 范围：展示 title、date metadata、recording list、record action、Transcript/Reflections/Memory content 当前 section；不渲染 More、Films、photo、video、file、AI 或其他未实现能力为可点击 command。

## 范围

- 新增 `MemoryDetailPage`，通过 `workspaceHandle + workspaceId + memoryId` 读取 `getMemoryDetail`。
- 新增 TanStack Query detail key：`['workspace', 'memory-detail', workspaceId, memoryId]`。
- `workspaceHandle` 只作为 preload request capability，不进入 query key、DOM、URL 或持久化。
- Home memory card 变成可打开当前 memory detail 的 command，但不引入 router dependency。
- App 使用最小 in-memory route：Home ↔ Memory detail；Recording drawer 仍保持当前能力。
- Detail 页面高保真当前范围：
  - 标题、日期、summary metadata。
  - 当前真实录音列表 preview：recording title、duration、audio byte size；首屏最多 24 条，超过时显示有界提示。
  - 当前真实 sections：Voice recordings、Transcript、Reflections、Memory content；Transcript/Reflections 使用文件索引 summary flags 显示 saved/empty 状态，不硬编码为空。
  - 当前可用 action：Back、Record memory。
- More wireframe 边界：
  - `Rename memory`、`Delete memory`、`Show in folder`、`Export memory` 只记录在 spec wireframe，不在 current build 中渲染为 menuitem/button。

## 非范围

- 不实现 rename/delete/show in folder/export。
- 不实现 Films、photo、video、file、AI generation、entity extraction、contact profile 或 global search。
- 不新增 DB、filesystem mutation、IPC channel、preload bridge 或 router dependency。
- 不修改 recording finalize 目标语义；从 detail 启动录音追加到现有 memory 留给后续 recording target task。

## 参考与设计约束

- 参考 `/Users/yck/Downloads/PM/设计参考/记忆录音/workspace页面.png` 和 `ref1-01.jpg`：居中标题/date、action strip、section divider、横向内容分组。
- 参考 `/Users/yck/Downloads/PM/设计参考/记忆录音/ Reflections详细弹层.jpg`：Reflections 是当前 content section 的信息层级；实体 suggestion/contact 是 future wireframe，不渲染。
- 参考 `/Users/yck/Downloads/PM/设计参考/记忆录音/录音详细页-没有录音弹层.png`：Record memory action 与 bottom drawer 后续衔接；本 task 不改 drawer mechanics。
- 参考 Context7 TanStack Query v5：使用 `queryOptions` 复用 query key 和 queryFn；query key 只包含资源身份和序列化参数。
- UI 使用 Reo token、现有 Button/Separator，必要时只组合现有 primitive，不新增一次性组件库或自研复杂控件。

## TDD 验收

- RED：`MemoryDetailPage.test.tsx` 失败，因为页面和 query option 尚不存在。
- RED：More future actions 不得作为 menuitem/button 出现。
- GREEN：Memory detail 从 `window.reoWorkspace.getMemoryDetail` 渲染 title、date、recordings、Transcript/Reflections/Memory content。
- GREEN：Main detail contract 返回有界 recording preview、总 `recordingCount`、`recordingsTruncated`、`hasTranscript` 和 `hasReflections`。
- GREEN：`getMemoryDetail` payload 包含 `workspaceHandle + memoryId`，query key 不包含 `workspaceHandle`。
- GREEN：Home card 可以打开 detail，Back 返回 Home。
- GREEN：未实现能力负向断言继续通过。

## 验证

- `npx vitest run src/renderer/src/workspace/MemoryDetailPage.test.tsx src/renderer/src/workspace/workspaceApi.test.ts`
- `npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx`
- `npm run verify:quick`
- `git diff --check`
- `diff -u AGENTS.md .claude/CLAUDE.md`
- `find docs/specs -mindepth 1 -maxdepth 1 -print`
- 需要 runtime UI 证据时使用 Computer Use 对照 `workspace页面.png` / `ref1-01.jpg`。
