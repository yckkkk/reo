# 执行计划

## 当前真源输入

- 归档实现计划：`docs/archive/specs/2026-05-06-0452-first-product-slice-implementation-plan/plan.md`
- 当前 frontend 真源：`docs/current/frontend.md`
- 当前 Electron/security 真源：`docs/current/electron.md`
- 当前 data/flow 真源：`docs/current/data.md`、`docs/current/flow.md`
- 当前 quality 真源：`docs/current/quality.md`

## 设计决策

- DB schema：本切片不引入 DB、migration 或 table relationship；录音真源仍是 workspace files。
- 数据获取模式：recording lifecycle 不进入 TanStack Query；finalized recording summary 写回 renderer workspace session snapshot。
- cache/query/state ownership：recording machine/overlay state 属于 feature-local reducer；transcript/reflections draft 属于 overlay state；Blob URL 属于 active playback state。
- Electron/preload/IPC：不新增 channel；消费 IMPL-003 已有 explicit methods。Production CSP 增加 `media-src 'self' blob:`。
- Filesystem transaction：main 已有 draft、append、finalize、save 和 chunk read transaction；renderer 必须等待 append ack 后 finalize。
- UI primitives：新增 Dialog 和 Textarea source；Button/Label 继续复用 IMPL-005 primitives。Tooltip 不添加，因为无 icon-only control。
- Open-source reuse：Radix Dialog/shadcn Dialog 负责 overlay semantics；Textarea 使用 shadcn source；MediaRecorder 使用 browser official API 薄 adapter；wavesurfer deferred。
- Error handling：mic failure 回到 idle；append/finalize/save failure 显示 alert，renderer draft 保留；playback read failure 不泄露 path。

## TDD 顺序

1. RED renderer：recording machine lifecycle、pause/resume timer/mock transcript、duplicate stop ignore。
2. RED renderer：RecordingOverlay draft/create/append/finalize 等待 append ack，autosave failure 保留 draft，playback manifest/chunk/Blob revoke，Escape safe close。
3. RED main：CSP 缺少 `media-src 'self' blob:`。
4. GREEN：安装 `@radix-ui/react-dialog`，创建 Dialog/Textarea、machine、adapter、overlay，接入 App/Home。
5. GREEN：更新 security CSP，并补 main tests。
6. REFACTOR：消除重复状态派生，重跑 renderer/main/quick/build。

## 验证命令

- `npm run test:renderer`
- `npm run test:main`
- `npm run verify:quick`
- `npm run build`
- Electron runtime/CDP 或 Computer Use 操作验证
- `git diff --check`
- `diff -u AGENTS.md .claude/CLAUDE.md`
- `find docs/specs -mindepth 1 -maxdepth 1 -print`

## 提交

提交信息：`feat: add recording loop`
