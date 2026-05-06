# IMPL-002：Preload、显式 IPC 和 Zod 边界

创建时间：2026-05-06 05:43 America/Los_Angeles

## 目标

建立第一产品切片的最小 renderer 特权能力边界：

- `window.reoWorkspace.chooseDirectory()` 是本切片唯一暴露给 renderer 的 workspace 方法。
- Renderer 只能拿到 `selectionToken` 和 `displayPath`，不能拿到裸 `rootPath`。
- Main process 保存真实路径，并用单次消费、短 TTL、sender 绑定的 token 承接后续 workspace 初始化或打开。
- IPC channel 显式列出，使用 Zod 校验 DTO 和错误信封。
- Preload 不暴露 `ipcRenderer`、generic `invoke`、generic `send` 或未实现占位能力。
- Trusted sender 校验覆盖 main frame、trusted origin、session、channel allowlist。
- Renderer source 禁止直接 import Node/Electron API。

## 范围

本切片只实现目录选择边界和相关安全策略，不初始化 workspace、不写文件、不创建 DB、不引入 TanStack Query、不显示 photo/video/file/film 能力。

## 当前状态

通过，已归档。
