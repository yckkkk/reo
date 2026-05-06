# 验证

状态：最终命令已通过；最终只读复审问题已处理。

## 启动检查

| 命令                                                           | 结果         |
| -------------------------------------------------------------- | ------------ |
| `git status --short` before create                             | 通过，无输出 |
| `git rev-parse --short HEAD`                                   | `606af32`    |
| `git branch --show-current`                                    | `main`       |
| `find docs/specs -mindepth 1 -maxdepth 1 -print` before create | 无输出       |

## 必读文件

已按用户指定顺序读取 current 和 initiative 文件。第一次合并输出被截断，之后对被截断的 current 和 initiative 文件执行了拆分读取。

## 研究验证

| 检查                    | 证据                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Context7 Electron       | 查询 `/electron/electron`，覆盖 security、preload、IPC、protocol constraints                                                               |
| Context7 shadcn/ui      | 查询 `/shadcn-ui/ui`，覆盖 source ownership、Vite/Tailwind、Drawer 和 primitive behavior                                                   |
| Context7 TanStack Query | 查询 `/tanstack/query`，覆盖 v5 query keys、mutations 和 invalidation                                                                      |
| ElevenLabs UI           | 打开 docs 和 component pages，覆盖 Audio Player、Live Waveform、Waveform、Speech Input、Transcript Viewer、Voice Button                    |
| Vaul/shadcn Drawer      | 打开 shadcn Drawer docs 和 Vaul GitHub，检查 Vaul repo note                                                                                |
| wavesurfer.js           | 打开 homepage 和 Record plugin API/options                                                                                                 |
| Open-source candidates  | 收集 ElevenLabs UI、wavesurfer.js、react-media-recorder、Vaul、write-file-atomic、proper-lockfile、chokidar、xstate 的 GitHub/npm evidence |
| 参考素材                | 列出本地 images/videos，并在 `/private/tmp/reo-design-hardening-frames/` 创建 contact sheets                                               |

## 本地参考证据

| 命令                                                    | 结果                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `ffprobe` on three reference videos                     | durations 和 stream dimensions 已记录在 `reference-map.md`            |
| `sips -g pixelWidth -g pixelHeight` on local frames     | dimensions 已记录在 `reference-map.md`                                |
| `magick montage ... reference-contact.jpg`              | 创建 `/private/tmp/reo-design-hardening-frames/reference-contact.jpg` |
| `magick montage ... drawer-contact.jpg`                 | 创建 `/private/tmp/reo-design-hardening-frames/drawer-contact.jpg`    |
| `shasum /private/tmp/reo-design-hardening-frames/*.jpg` | representative hashes 已写入 `reference-map.md`                       |

## 最终命令

| 命令                                             | 结果                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `npm run verify:quick`                           | 通过：typecheck、`test:main` 4 tests、lint、format check 全部通过 |
| `git diff --check`                               | 通过，无输出                                                      |
| `diff -u AGENTS.md .claude/CLAUDE.md`            | 通过，无输出                                                      |
| `find docs/specs -mindepth 1 -maxdepth 1 -print` | `docs/specs/2026-05-06-0338-first-product-slice-design-hardening` |

## 格式化修复

第一次 `npm run verify:quick` 在 `format:check` 失败，Prettier 报告 19 个新 spec 文件需要格式化。已运行：

```bash
npx prettier --write docs/specs/2026-05-06-0338-first-product-slice-design-hardening/*.md docs/current/frontend.md docs/current/electron.md docs/current/data.md docs/current/flow.md docs/current/quality.md
```

随后重跑 `npm run verify:quick` 通过。
