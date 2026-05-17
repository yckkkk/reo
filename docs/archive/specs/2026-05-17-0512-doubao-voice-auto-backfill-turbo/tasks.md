# 任务

## T0

- [x] 回退错误的标准版/TOS staging 实现提交。
- [x] 子代理 A 核对官方文档、本地 demo、endpoint/header/body/error/format/limits。
- [x] 子代理 B 核对 Reo finalized audio、settings、IPC/preload/renderer 集成点。
- [x] 归档旧 active spec，创建 Turbo audio.data 新 active spec。
- [x] 更新 ADR 0005 与 initiative。
- [x] Turbo smoke harness RED/GREEN。
- [x] T0 review + ycksimplify。
- [x] T0 checkpoint recorded in this spec。

## T1

- [x] RED：Turbo client tests。
- [x] GREEN：Turbo client。
- [x] RED：audio data source/remux tests。
- [x] GREEN：audio data source。
- [x] RED：queue/scanner/runtime/trigger tests。
- [x] GREEN：queue/scanner/runtime/trigger。
- [x] REFACTOR 后重跑 T1 targeted tests。
- [x] T1 review + ycksimplify。
- [x] T1 checkpoint recorded in this spec。

## T2

- [x] RED：contract/preload/workspaceApi IPC tests。
- [x] GREEN：IPC/preload/wrapper。
- [x] RED：SegmentTranscriptView/MemoryStudio/App renderer tests。
- [x] GREEN：manual retry running UI。
- [x] REFACTOR 后重跑 T2 targeted tests。
- [x] T2 review + ycksimplify。
- [x] T2 checkpoint recorded in this spec。

## T3

- [x] RED：recording pause、cancelAll、breaker、diagnostics integration tests。
- [x] GREEN：lifecycle wiring。
- [x] 真实 API key Turbo smoke。
- [x] `npm run dev` Electron E2E/QA。
- [x] T3 review + ycksimplify。
- [x] T3 checkpoint recorded in this spec。

## T4

- [x] current docs 同步。
- [x] spec/initiative/ADR 收口。
- [x] 归档当前 spec。
- [x] final review + ycksimplify。
- [x] `npm run format:check`
- [x] targeted tests
- [x] `npm run verify:quick`
- [x] `git diff --check`
- [x] final commit 准备完成；提交 SHA 由最终回复记录。

## Review / ycksimplify 处理结果

- Review：修复 manual eligibility、voice settings gate、workspace switch drain、workspace close 只取消被关闭 ready handle 对应的 backfill、stale automatic scan、saveTranscript precise error、cancel-before-save、automatic response 泄漏、Turbo `45000010` auth 映射、无效 close 预先改变 backfill 状态等问题。
- ycksimplify 代码复用：统一 Turbo 100MB 上限来源，删除 audio source 未使用 bytes，复用现有 transcript save 与 diagnostics allowlist，复用 renderer 已导出的 backfill target types，并将 `scan-failed` 收敛为共享诊断常量。
- ycksimplify 质量：收敛 lock-lost 取消语义，避免自动任务可见 UI 状态，保持 preload 显式方法和 contract 测试，删除 queue response side-channel，删除 queue source-normalization helper，收敛 renderer 手动补转录 props/callback，ADR 只保留长期当前决策。
- ycksimplify 效率：避免 scan/enqueue stale work，scan 使用 summary guard 与 bounded cap，并按 memory summary recency 在已满足 cap 后停止读取不可能入选的 detail，failed-empty gate 在读取大音频前执行，ffmpeg abort 有 close fallback，ffmpeg 临时目录按任务清理，并在转换输出读取前执行 100MB 上限检查。
