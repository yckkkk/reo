# 执行计划

## RED

- 写 workspace contract 测试：新增 channel allowlist、initialize/open/close、recording draft/read/save DTO、错误信封和数据保留语义。
- 写 chooseDirectory/displayPath 回归测试：renderer 不拿裸 `rootPath`，`displayPath` 不等于真实绝对路径。
- 写 token 测试：selection token 单次消费、过期、错误 sender 不泄露 path；错误 sender 不烧掉 token。
- 写 path 测试：canonical realpath、拒绝 symlink workspace root、path traversal、slash、malicious recordingId、Reo-managed parent symlink。
- 写 workspace file 测试：existing `AGENTS.md` conflict 不写任何文件并保持 hash；init 只创建 first-slice 文件；corrupt index 可重建；corrupt metadata 阻断写入。
- 写 lock 测试：duplicate open 返回 locked；release 幂等；lock lost 使 handle invalid；stale lock 可恢复。
- 写 handle 测试：opaque handle 绑定 sender、workspaceId、lock owner；跨窗口、close 后、lock lost 后、schema mismatch 后失败且不泄露 path。
- 写 draft 测试：create/append/finalize/discard、1 MiB chunk 上限、每 recording 1 个 append in-flight、sequence mismatch、finalize 等 append idle。
- 写 read 测试：manifest 先于 chunk read；offset/length/1 MiB 上限；禁止 full-file IPC；missing audio 和 malicious metadata path typed error。
- 写 preload surface 与 renderer wrapper 测试，确保新增方法和 handler 对齐，且不暴露 generic `invoke/send`。
- RED 输出必须来自 `npm run test:main` 和 `npm run test:renderer`。

## GREEN

- 安装 `proper-lockfile`。
- 实现 main process 文件模块：path、lock、atomic write、workspace files、handle store、recording drafts。
- 扩展 workspace contract、IPC handler、preload bridge、renderer global type 和 renderer wrapper。
- 只实现本切片方法，不暴露 generic IPC 或未来能力。

## REFACTOR

- 收紧类型和错误码，减少重复 helper。
- 更新 current docs。
- 归档 spec，active `docs/specs` 为空后提交。
