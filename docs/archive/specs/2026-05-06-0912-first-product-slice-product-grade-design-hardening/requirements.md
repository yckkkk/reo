# Requirements

## 交付范围

本 spec 的执行范围是 design-hardening gate 返工。它不实现代码、不安装依赖、不执行 first product slice。实现阶段必须等待本 spec、reconciled implementation plan 和 plan-eng-review 全部通过。

## 产品要求

| ID     | 要求                               | 验收标准                                                                                                                            |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| PR-001 | First product slice 不是玩具 MVP   | 创建工作区、首页、工作区详情、录音、录音后编辑具备完整状态、错误、空态、加载和恢复设计                                              |
| PR-002 | 用户内容真源是本地 workspace files | 数据设计中 DB 只能做 app/index/session/relationship/processing state，不替代 audio/transcript/reflections 文件真源                  |
| PR-003 | 录音是第一条真实产品闭环           | 用户能创建 workspace、录音、暂停、恢复、停止、保存音频、编辑 transcript/reflections、播放、重开恢复                                 |
| PR-004 | 未实现能力不得伪装可用             | photo、video、file、film、AI film、真实 STT、entity extraction 只能出现在 wireframe 或 gated future，不出现在当前可点击产品 surface |
| PR-005 | 所有参考图都必须被设计吸收         | 6 张参考图逐张映射：采用、改造、延后和拒绝原因必须可审查                                                                            |

## 设计要求

| ID     | 要求                           | 验收标准                                                                                                                      |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| UX-001 | 当前设计范围必须 high-fidelity | 创建页、app shell、home、workspace detail、recording drawer、editing/reflections drawer 写出 layout、tokens、组件、状态和文案 |
| UX-002 | 非当前范围必须 wireframe       | Films、photo/video cards、search full result、entity suggestion automation、AI summary 等做 wireframe，不写成当前功能         |
| UX-003 | 服从 Reo 设计系统              | Eggshell、Card White、Obsidian、Chalk、Gravel、Waldenburg/Inter、pill button、lucide icon、hairline elevation                 |
| UX-004 | 录音视觉必须达到参考图层级     | bottom drawer、handle、背景 blur/dim、live waveform、timer、state text、stop/pause/record controls、cancel/close              |
| UX-005 | 组件必须可复用但不泛化         | 只为真实 shared invariant 提取 primitive，不创建 generic UI framework                                                         |
| UX-006 | Practical UI 应用              | 明确使用 interaction cost、cognitive load、clear hierarchy、state indication、button target、form label/validation 原则       |

## 技术栈要求

本项目技术栈锁定为：

- React 19 + TypeScript
- Vite via `electron-vite`
- Tailwind CSS v4
- shadcn/ui + Radix primitives
- Zustand + TanStack Query
- React Hook Form + Zod
- Better Auth Electron 插件
- Drizzle ORM + `better-sqlite3`
- `electron-updater`
- `date-fns`
- Sentry + `electron-log`
- Electron Forge
- Vitest

锁定不等于一次性安装。每个依赖必须由真实 consumer、slice、测试和 docs current 更新触发。

## 开源复用要求

| ID     | 要求                                     | 验收标准                                                                                                           |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| OS-001 | 官方/开源优先                            | 每个复用类别列 candidates、decision、adaptation paths considered、reason、risks、tests、owner                      |
| OS-002 | 自研是最后手段                           | 不得因“不完全适配 Reo”直接拒绝；必须先评估裁剪、retokenize、组合、薄适配或 fork                                    |
| OS-003 | Audio UI 优先 ElevenLabs UI              | 录音波形、voice button、audio player、transcript viewer 优先从 ElevenLabs UI 单组件 source 引入并 retokenize       |
| OS-004 | Drawer 优先 shadcn Drawer/Vaul           | 大型 bottom sheet 先评估 shadcn Drawer/Vaul；Radix Dialog 只能作为语义/fallback，不作为最终交互外观替代            |
| OS-005 | Waveform/playback 同时评估 wavesurfer.js | 长 waveform、scrubber、regions、pre-decoded peaks 或第二个 waveform consumer 出现时优先采用 wavesurfer.js 官方能力 |

## 数据和 DB 要求

| ID     | 要求                  | 验收标准                                                                                                                |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| DA-001 | 写出 conceptual model | Workspace、Memory、Recording、AudioAsset、Transcript、Reflection、EntitySuggestion、ProcessingJob、User/Auth 的关系明确 |
| DA-002 | 写出 DB schema gate   | 即使当前不迁移，也必须定义 Drizzle schema 触发条件、表关系、foreign key、index、delete/update effect                    |
| DA-003 | 明确数据获取模式      | TanStack Query、RHF、Zustand、feature reducer、main filesystem scan 的 owner 清楚                                       |
| DA-004 | 明确文件夹结构        | `.reo` metadata/index、recordings、markdown、audio、future artifacts 的边界清楚                                         |
| DA-005 | 错误处理可行动        | permission、cancel、conflict、locked、unsupported schema、append/finalize/save/playback failure 有用户文案和恢复        |

## Electron 和安全要求

| ID     | 要求                              | 验收标准                                                                                                       |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| EL-001 | Renderer 不直接接触 Node/Electron | 所有特权能力通过窄 preload API 和显式 IPC channel                                                              |
| EL-002 | 不创建 generic bridge             | 不允许 `window.api.invoke`、generic command bus、generic service layer                                         |
| EL-003 | 权限最小化                        | audio media 仅 trusted renderer 可请求；camera/video/geolocation/notifications/navigation/window-open 默认拒绝 |
| EL-004 | 本地文件边界                      | 用户文件只通过 workspace handle、path containment、single-writer lock 和 atomic write 操作                     |
| EL-005 | 诊断不泄露隐私                    | Sentry/electron-log 只在 diagnostics slice 引入，必须定义 redaction 和 retention                               |

## QA/TDD 要求

| ID     | 要求              | 验收标准                                                                                                                            |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| QA-001 | 实现必须真实 TDD  | 每个实现 slice 先 RED，再 GREEN，再 REFACTOR，记录失败输出                                                                          |
| QA-002 | UI reference 验证 | 对 6 张参考图记录结构、状态、视觉和 Reo token 差异                                                                                  |
| QA-003 | Runtime 操作验证  | OS dialog、录音、暂停、恢复、停止、播放、保存失败、重开恢复必须用 Computer Use                                                      |
| QA-004 | 审查门禁          | 有 unresolved BLOCKER/MAJOR 不得进入下一阶段                                                                                        |
| QA-005 | 基础验证          | `npm run verify:quick`、`git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`find docs/specs -mindepth 1 -maxdepth 1 -print` |
