# IMPL-003：Workspace 文件系统、handle、lock 和 recording draft

创建时间：2026-05-06 06:08 America/Los_Angeles

## 目标

让 main process 拥有 workspace 初始化、打开、锁、handle、recording draft 写入和 audio chunk 读取能力。

## 范围

- 通过 selection token 初始化或打开 workspace。
- workspace 文件真源在用户选择的文件夹中，不进入 DB。
- 初始化只创建 `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json` 和 `recordings/`。
- `.reo/workspace.lock` 是 volatile lock artifact。
- Renderer 只持有 opaque `workspaceHandle`、`workspaceId`、snapshot 和 typed error。
- Recording draft 支持 create、append、finalize、discard、detail、audio manifest、audio chunk、transcript/reflections save。

不创建 photo、video、file、film 能力，不引入 DB，不引入 TanStack Query。

## 当前状态

通过，已归档。
