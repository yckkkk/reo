# 录音界面三状态重设计

开始时间：2026-05-09 03:25 America/Los_Angeles

## 目标

把 recording overlay 从底部面板收敛为当前工作区内的沉浸式录音层，覆盖录音准备、录音中和暂停态。录音事务继续使用现有 Workspace -> Memory -> Segment 模型：Workspace Stage 录音优先归属当前 Memory，只有没有当前 Memory 时才先创建 Memory；recording finalize 必须显式携带 `memoryId`，录音采集继续使用 `MediaRecorder + getUserMedia` 薄适配。

## 成功标准

- 录音准备态只显示静态点状波形、引导文案和红色圆形开始按钮，不显示计时器、暂停、定位或完成控件。
- 录音中显示动态波形、实时转写区域、`00:04.72` 格式计时器、左侧暂停、弱化定位控件和右侧完成。
- 暂停态显示已录波形、蓝色播放头、cursor time、可定位控件、左侧继续/替换状态和右侧完成。
- 录音层让 AppShell sidebar、panel titlebar 和主内容统一弱化虚化，前景控件保持清晰。
- 波形输入来自当前麦克风流的 Web Audio analyser；静音保持低振幅，不用固定数组伪装为实时声音。
- transcript segment 状态必须包含 `startTimeMs`、`endTimeMs`、`text`、`isFinal`、`recordingSessionId` 和 `revisionId`。
- 替换录音的文本和音频规则必须可测试：cursor 之后的 segment 被删除，revision 递增，旧 revision 异步结果被丢弃；活跃暂停态用 cursor 前的有效 MediaRecorder chunk 前缀重建新 draft，并复用当前已暂停的 MediaRecorder controller 继续采集。
- 拖动或移动 cursor 时，能从时间定位到当前 transcript segment，供 UI 同步滚动。
- 本 slice 不把 Volcengine app id / key 暴露给 renderer；大模型流式 ASR 连接只允许在 main/backend 受控边界内接入。
- 录音完成后不强制弹出描述、转写编辑或反思编辑窗口；后续片段补充内容属于未来 Memory Studio 设计，不作为当前录音完成的阻塞步骤。

## 采用依据

- React 当前文档：事件处理器和异步回调读取的是各自 render 的 state snapshot，因此 recording session、revision 和 stale callback 必须用显式 token/ref 保护。
- Tailwind CSS v4 当前文档：响应式、motion-safe / motion-reduce 和状态 variant 可直接组合；本 slice 使用 token 化 Tailwind utilities，不新增一次性 palette。
- Vaul 当前文档：Drawer 支持 controlled open、`dismissible={false}` 和 `data-vaul-no-drag`，可继续承载忙碌态关闭保护。
- 火山引擎大模型流式语音识别 API：豆包流式语音识别模型 2.0 小时版资源 ID 是 `volc.seedasr.sauc.duration`；WebSocket 请求头包含 `X-Api-App-Key`、`X-Api-Access-Key`、`X-Api-Resource-Id` 和 connect id；音频包建议 100-200ms。
- 本地 `sauc_python` demo：协议使用 gzip JSON full request、gzip audio-only request、sequence/revision-like sequencing、200ms 分片和 `show_utterances` 时间戳。

## 范围

实现：

- 沉浸式 recording layer 与三个 UI 状态。
- MediaRecorder adapter 的可选实时 level 回调。
- 暂停后从中段替换的 active-draft 重建路径：保留 cursor 前 chunk 前缀，截断 waveform/timeline，生成新 `revisionId`，创建新 draft，复用当前已暂停的 MediaRecorder controller 继续采集，并在新 draft 接管后丢弃旧 draft。
- feature-local transcript timeline 纯状态模块和测试。
- feature-local transcript preview：按 segment 时间范围高亮当前片段，并在 cursor 变化时滚动到对应文本。
- main 侧豆包流式语音识别 live session helper：鉴权 header、WebSocket 连接、full request frame、audio-only frame、server response 解析、错误脱敏、失败关闭和 utterance 到 transcript segment 映射。
- MediaRecorder adapter 的可选 ASR PCM 侧通道：从同一麦克风 stream 通过 Web Audio AudioWorklet 输出 16 kHz 16-bit mono little-endian PCM chunks，durable capture 仍由 MediaRecorder 写入 WebM/Opus。
- renderer ASR subscription：录音 overlay 通过 preload 显式 start/send/finish/close channel 把 PCM 发给 main，订阅 safe transcript event，并将 segment 写入 `recordingTimeline`。
- 完成时补转写：renderer 在当前有效录音 session 内缓存 16 kHz PCM；durable finalize 成功后，如果 transcript 为空或当前 revision 已收到 ASR error / finish failure，会用同一 `recordingSessionId` / `revisionId` 发起 `completion-backfill` ASR session，等待最终包后再保存 transcript。
- current frontend/flow/data/product/quality 中与录音 UI、timeline 和 ASR 边界相关的当前事实。
- 右侧 MemoryRail 点击只切换 current-memory context；FAB 录音直接进入当前 Memory；当前实现不提供 Memory detail route、finalized audio read IPC 或强制编辑窗口。

不实现：

- renderer 直接连接火山引擎 WebSocket。
- 在 renderer 保存或使用 Volcengine app id / access key。
- 对已有 `.reo/drafts/segments/<segmentId>/audio.webm` 原地做字节级中段截断或拼接。

## 验证

- 先写 renderer 行为测试，RED 后实现。
- 覆盖 ready / recording / paused 三状态可见内容和 negative controls。
- 覆盖 transcript segment truncate、cursor mapping、revision stale drop 和 replacement draft 重建。
- `npm run verify:quick`。
- 运行 Electron dev/preview 做视觉检查，记录不能完成的 OS/mic 权限验证。

## 验证证据

- `npm run verify:quick`：通过。覆盖 typecheck、main tests、renderer tests、lint 和 format check。
- 视觉检查使用 Electron 运行时与 `/Users/yck/Downloads/PM/技术线/reo文件区/reo的wireframe/录音三态/` 下的录音前、录音中、录音暂停效果图和解释图对照。
- 录音准备态截图：`/tmp/reo-visual-check/recording-ready.png`。
- 录音中截图：`/tmp/reo-visual-check/recording-active.png`。
- 录音暂停截图：`/tmp/reo-visual-check/recording-paused.png`。
- 去除转写区域背景填充后的录音中截图：`/tmp/reo-visual-check/recording-active-no-transcript-fill.png`。
- 去除转写区域背景填充后的录音暂停截图：`/tmp/reo-visual-check/recording-paused-no-transcript-fill.png`。

## Wireframe 对比

对比基准：

- `/Users/yck/Downloads/PM/技术线/reo文件区/reo的wireframe/录音三态/录音开始前.png`
- `/Users/yck/Downloads/PM/技术线/reo文件区/reo的wireframe/录音三态/录音前解释.png`
- `/Users/yck/Downloads/PM/技术线/reo文件区/reo的wireframe/录音三态/录音中.png`
- `/Users/yck/Downloads/PM/技术线/reo文件区/reo的wireframe/录音三态/录音中解释.png`
- `/Users/yck/Downloads/PM/技术线/reo文件区/reo的wireframe/录音三态/录音暂停时.png`
- `/Users/yck/Downloads/PM/技术线/reo文件区/reo的wireframe/录音三态/录音暂停时解释.png`

结论：

| 状态   | 已对齐                                                                | 需要继续收敛                                           |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| 录音前 | full-window 弱化背景、静态点状波形、两行引导文案、单一 Ember 圆形入口 | Ember 遵循 Reo design token，色相比效果图更偏橙红      |
| 录音中 | 动态横向波形、转写区、`MM:SS.hh` 时间、左暂停、中定位弱化、右完成     | 未完成 draft 可保存、放弃或恢复到暂停检查态            |
| 暂停   | 已录波形、蓝色播放头、cursor time、可用定位控件、继续/替换、完成      | 文本滚动同步 UI、live segment 输入和中段替换保护已覆盖 |

视觉修正：

- 沉浸式 overlay 的背景弱化使用中性 scrim、blur 和去饱和，sidebar、panel titlebar 和 Workspace Stage 保留效果图要求的结构轮廓，但底部 ExpressionDock 的蓝色入口不会透出成录音控件背后的干扰色块。
- 录音中和暂停态不再把 controls 作为独立 absolute footer；waveform、转写、时间和 actions 属于同一个 recording surface。底部 action 去掉大面积背板、重投影和多层胶囊外壳，只靠位置、状态色、透明度和 hover/focus 反馈区分可用性，避免把拼接参考图误实现为多个嵌套容器。
- 转写预览区不使用背景填充或白色渐隐背板；有内容时只对文本滚动层使用透明 mask，空态 fallback 直接浮在同一录音面上。

## 剩余边界

- 豆包流式语音识别 main 侧 live session 边界、renderer PCM 音频输入侧通道、renderer subscription、完成时最终包等待、初始连接重试、录音中断线重连和完成后补转写已具备；renderer 不持有密钥，真实账号协议验证和 Electron dev runtime 验证已跑通。
- 暂停态已能用 renderer 当前有效 chunk 前缀做 draft playback，并已覆盖 cursor 到 transcript segment 的滚动同步；live ASR segment 通过 `recordingSessionId` / `revisionId` 写入同一 timeline。
- 极短录音、超长录音、长时间静音、替换误操作、录音中 ASR 断线重连和完成后补转写已有保护；应用异常后未完成 draft 可通过恢复对话框保存、放弃或继续检查，继续检查会恢复到可回听的暂停检查态。由于没有原 MediaRecorder controller，恢复检查态不允许跨会话继续或替换。

## 完成度审计

| 需求                                                                   | 当前证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 结论                                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 录音前、录音中、暂停三态视觉清晰区分                                   | `RecordingSurface`、`RecordingWaveform`、`RecordingControls` 和三张 Electron 截图                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 已覆盖                                                                             |
| sidebar、顶部、主内容统一虚化弱化                                      | immersive `RecordingSurface` overlay 截图                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 已覆盖                                                                             |
| 录音前只显示静态波形、引导文案、红色圆形按钮                           | `RecordingOverlay.test.tsx` ready negative controls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 已覆盖                                                                             |
| 录音中动态波形、计时、暂停、完成和弱化定位控件                         | `RecordingOverlay.test.tsx` recording state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 已覆盖                                                                             |
| MediaRecorder + getUserMedia 薄适配                                    | `mediaRecorderAdapter.ts` 与相关 main/renderer tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 已覆盖                                                                             |
| finalize 显式归属 `memoryId`                                           | `RecordingOverlay.test.tsx` memory target tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 已覆盖                                                                             |
| 暂停态可拖动波形、前进/后退 15 秒、继续/替换切换                       | `RecordingWaveform.tsx` 和 replacement tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 已覆盖                                                                             |
| 替换时截断 cursor 后文本并丢弃旧 revision 回流                         | `recordingTimeline.test.ts`、`recordingTranscriptionSessions.test.ts`、`RecordingOverlay.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 已覆盖                                                                             |
| 暂停态播放/暂停回听并同步 cursor、波形、时间                           | `RecordingOverlay.test.tsx` paused draft playback cursor sync                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 已覆盖                                                                             |
| 实时转写使用豆包流式语音识别模型 2.0                                   | `doubaoStreamingAsr.test.ts` 覆盖 2.0 resource id、live session、协议 frame、utterance 映射、错误脱敏、unexpected close 和 final package wait；`mediaRecorderAdapter.test.ts` 覆盖 16 kHz PCM chunk 和 stop flush；`recordingTranscriptionSessions.test.ts` 和 `RecordingOverlay.test.tsx` 覆盖 renderer subscription、初始连接重试、录音中断线重连、完成时最终转写等待、空 transcript completion backfill 和 final failure 后的 completion backfill；真实账号协议验证和 Electron dev runtime 验证已产出 transcript                                                                                                                                                                                               | 已覆盖协议、本地事件链路、真实账号链路、初始连接重试、录音中断线重连和完成后补转写 |
| 转写文本随 cursor 同步滚动到对应 segment                               | `RecordingTranscriptPreview.test.tsx`、`RecordingOverlay.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 已覆盖                                                                             |
| 权限、设备、保存、关闭/切换保护、极短、超长、静音、网络/转写异常、恢复 | `RecordingOverlay.test.tsx` 覆盖权限/设备、保存失败、busy close 阻止、极短二次确认、55/60 分钟上限、15 秒静音提示、ASR 不可用后 durable capture 继续、完成时最终转写失败 toast 后继续保存、completion backfill、recovery marker save/clear、recovered paused review save/discard/check、recovered continue/replace 禁止跨会话拼接、active replacement 复用当前 controller、replacement warning 和 draft 创建失败 intent 清理；`recordingTranscriptionSessions.test.ts` 覆盖录音中 ASR 断线后重连并回放 5 秒 PCM buffer；`App.test.tsx` 覆盖录音流程打开时阻止 workspace 切换并保持当前录音层、忙碌录音态阻止 `beforeunload`、重新打开 workspace 后保存/继续检查未完成 draft；全局红色 inline error 搜索无业务残留 | 未完成 draft 保存/放弃/继续检查恢复已覆盖                                          |

已补“暂停态播放/暂停回听并同步 cursor、波形、时间”和“未完成 draft 恢复到暂停检查态”。该 slice 不改变 Workspace / Memory / Segment 模型；新增的 IPC 仅允许读取当前 handle 下的未完成 draft audio，不恢复 finalized audio read 模型，也不接触密钥。

## 录音边界与全局 toast 补充验证

- RED：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx` 首次失败，暴露中段替换缺少第一次提示、replacement draft 失败未清 microphone intent、带音频的极短录音未提示、60 分钟上限未自动暂停。
- GREEN：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx` 通过，46 个测试，覆盖极短录音二次确认、替换误操作提示、replacement intent cleanup、超长自动暂停和持续静音提示。
- 全局红色 inline error audit：`rg -n "WorkspaceErrorBanner|role=\"alert\"|role='alert'|text-(red|rose|destructive)|errors\\.root|setError\\('root'|setError\\(\"root\"" src/renderer/src --glob '*.{ts,tsx}'` 无业务残留；业务动作和跨边界失败使用 root `toast`，表单字段错误保留中性色 `FieldError`。
- 集成保护：`npm run test:renderer -- src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/workspace/MemoryTitleDialog.test.tsx src/renderer/src/workspace/recording/RecordingSurface.test.tsx src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx src/renderer/src/workspace/recording/recordingTimeline.test.ts src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/App.test.tsx` 通过，7 个测试文件、97 个测试。
- Main 保护：`npm run test:main -- doubaoStreamingAsr recordingTranscriptionSessions` 通过，259 个 main tests。
- 真实账号协议验证：使用环境变量注入 App ID / Access Token，通过 `src/main/doubaoStreamingAsr.ts` live session 向 `volc.seedasr.sauc.duration` 发送本机生成的 16 kHz raw PCM，最新验证返回 228280 audio bytes、19 个流式片段、1 个最终片段、0 个错误，最终文本为“今天我想记录一次真实的豆包语音识别验证，我们正在测试录音中的实时转写。”
- Electron runtime 真实转写验证：`npm run dev` 使用同一环境变量注入 credentials，CDP 在 renderer 中临时把 `getUserMedia` 接到本地 WAV 合成的 `MediaStream`，录音界面通过真实 preload/main 豆包链路显示“今天我想记录一次真实的豆包语音识别验证”，没有出现“豆包流式语音识别暂时不可用”；截图位于 `/tmp/reo-visual/reo-doubao-real-asr-ui-1778345005682.png`。
- `npm run verify:quick`：通过。覆盖 typecheck、259 个 main tests、144 个 renderer tests、lint 和 format check。
- `npm run build`：通过。确认 main/preload/renderer production build 可生成。

## 暂停态回听补充验证

- `npm run typecheck`：通过。
- `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recording/recordingTimeline.test.ts`：通过，覆盖暂停态回听、转写 timeline 和中段替换。

## 本机 dev 密钥自动加载

- Context7 查询 `electron-vite` 当前文档后确认：electron-vite 的 env prefix 会控制变量进入 main/preload/renderer scope；Reo 的豆包密钥不使用 `VITE` scope prefix，也不通过 renderer env 暴露。
- RED：`npm run test:main -- localEnv` 首次失败，缺少 `scripts/local-env.mjs`。
- GREEN：新增 `scripts/local-env.mjs` 和 `scripts/run-dev.mjs`，`npm run dev` 先加载 git-ignored `.env.local`，已有 shell env 优先，再启动 `electron-vite dev --ignoreConfigWarning`。
- 本机 `.env.local` 只保存 `REO_DOUBAO_ASR_APP_ID` 和 `REO_DOUBAO_ASR_ACCESS_TOKEN`，不进入 git。
- 真实加载验证：不手动传入 env，直接通过 `scripts/local-env.mjs` 读取 `.env.local` 后调用当前 `doubaoStreamingAsr` live session，返回 113270 audio bytes、9 个片段、1 个最终片段、0 个错误，最终文本为“这是一次本地环境变量自动加载验证。”
- 最新真实加载验证：不手动传入 env，直接通过 `scripts/local-env.mjs` 读取 `.env.local` 后调用当前 `doubaoStreamingAsr` live session，发送本机生成的 16 kHz raw PCM，返回 99068 audio bytes、9 个片段、0 个错误。

## 实时转写滚动补充

- Context7 查询 React 官方文档后确认：用 `ref` 访问 DOM node，并在 Effect 中同步滚动属于 React 支持的 DOM escape hatch。
- RED：`npm run test:renderer -- src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx` 首次失败，暴露实时转写没有 scroll container，也不会区分用户滚动锁定和自动跟随。
- GREEN：`RecordingTranscriptPreview` 新增 `autoScrollMode`。录音中使用 `latest`，默认平滑滚到底部；用户手动滚离底部后暂停自动滚动，滚回底部后恢复。暂停态继续使用 `focus`，保持播放头/波形定位时转写滚动到对应 segment。

## 三态布局轨道补充验证

- RED：`npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx --testNamePattern "aligned across recording states"` 首次失败，录音 overlay 没有固定 composer layout slot，准备态、录音态和暂停态仍由状态内部自然流与 `mt-*` 决定位置。
- GREEN：`RecordingOverlay` 使用 4 行固定轨道承载波形、引导/转写、时间和控制区；`RecordingSurface` 将沉浸式 stage 下移并收敛到底部留白；`RecordingTranscriptPreview` 去掉自身 top margin；左侧暂停/继续/替换主操作统一为 108px hit area，避免录音中到暂停态按钮中心漂移。
- 组件保护：`npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx --testNamePattern "aligned across recording states"` 通过。
- 相关回归：`npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recording/RecordingSurface.test.tsx src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx` 通过，3 个测试文件、49 个测试。
- Electron runtime 测量：`REMOTE_DEBUGGING_PORT=9222 npm run dev` 自动加载 `.env.local` 后，通过 CDP 打开当前 Memory 录音流程并测量三态 DOM rect。1200x800 viewport 下，三态共享 `recording-composer-layout` `y=212 h=560`，波形 slot `cy=364`，文案/转写 slot `cy=506`，时间 slot `cy=628`，控制 slot `cy=728`；录音前开始按钮、录音中暂停按钮、暂停态继续按钮的 `cy` 均为 `728`，录音中暂停按钮与暂停态继续按钮宽度均为 `108px`。
- Runtime 截图：`/tmp/reo-recording-layout-check/layout-ready.png`、`/tmp/reo-recording-layout-check/layout-active.png`、`/tmp/reo-recording-layout-check/layout-paused.png`。

## 当前 Memory 录音入口补充验证

- 删除录音完成后的强制描述/转写/反思编辑态；`RecordingOverlay` finalize 后关闭录音层，非空 ASR transcript 通过 `workspace:saveTranscript` 保存，ASR 或 transcript save 失败只使用 root toast，不阻断 durable audio finalize。
- 当前实现不提供 Memory detail route 或 finalized audio read surface；MemoryRail 点击只切换 current-memory context，Workspace Stage 显示当前 Memory title 和片段数摘要。
- FAB 录音直接使用当前 Memory target；只有当前 workspace 没有 Memory 时才先打开 `MemoryCreateDialog`。
- 补充回归：两条 Memory 存在时，点击 MemoryRail 切换到 `Morning note` 后再点 FAB 录音，finalize 必须携带 `mem_morning`，且不得调用 `workspace:createMemory`。
- `npm run test:renderer -- src/renderer/src/workspace/workspaceApi.test.ts src/renderer/src/workspace/workspaceQueries.test.ts src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.test.ts`：通过，7 个测试文件、79 个测试。
- `npm run test:main -- workspaceBridgeSurface workspaceContract recordingDrafts workspaceIpc memoryFiles`：通过，256 个 main tests，覆盖当前 preload/contract/IPC 主进程边界。
- `npm run verify:quick`：通过。覆盖 typecheck、256 个 main tests、141 个 renderer tests、lint 和 format check。
- `npm run build`：通过。确认 main、preload 和 renderer production build 均可生成。

## 录音流程切换保护补充验证

- RED：`npm run test:renderer -- src/renderer/src/App.test.tsx -t "blocks workspace switching while a recording flow is open"` 首次失败；在录音层打开时，强制触发 sidebar workspace item click 会切换到另一个记忆空间，且没有 root toast。
- GREEN：同一测试通过；App 在录音流程打开时阻止 workspace open/close IPC，保留当前录音 overlay，并使用 root toast 提示先完成或关闭录音。

## 录音返回按钮与退出确认补充验证

- 设计规则：录音三态左上角提供无填充返回 icon；录音准备态没有有效音频，点击后直接退出录音层；录音中和暂停态点击返回必须二次确认，用户可取消、直接退出并放弃当前 draft，或保存录音到当前 Memory。
- RED：`npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx --testNamePattern "returns directly|asks before returning"` 首次失败，录音层没有可访问名为“返回”的按钮。
- GREEN：同一命令通过；准备态返回不会弹确认并调用 `onOpenChange(false)`；录音中返回弹出“保存这段录音吗？”，点击“保存录音”复用 finalize 链路并显式携带 `memoryId`；暂停态返回可取消，点击“直接退出”会停止采集、关闭转写、discard 当前 draft，并关闭录音层。
- 回归：`npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx` 通过，44 个测试；`npm run verify:quick` 通过，263 个 main tests、157 个 renderer tests、lint 和 format check。
- 测试环境修正：全量 renderer 测试暴露 Radix FocusScope 在 jsdom teardown 中用全局 `CustomEvent` 生成非 jsdom Event；`src/renderer/src/test/setup.ts` 将 `globalThis.Event` 和 `globalThis.CustomEvent` 对齐到 `window`，避免异步 focus teardown 产生 false-positive unhandled error。
- Electron runtime：`REMOTE_DEBUGGING_PORT=9222 npm run dev` 自动加载 `.env.local`；通过 CDP 打开当前 Memory 的录音流程，准备态返回按钮实际 rect 为 `40x40`、icon 为 `22x22`，准备态返回后录音 dialog 和确认 dialog 均消失；录音中返回弹出保存/直接退出/取消确认，点击“直接退出”后录音 dialog 与确认 dialog 均消失。
- Runtime 截图：`/tmp/reo-return-runtime/return-ready-clean.png`、`/tmp/reo-return-runtime/return-confirm-fixed.png`。

## 异常恢复补充验证

- RED：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx -t "persists a recoverable draft marker"` 首次失败，暴露录音 draft 创建后没有写入 renderer recovery marker。
- GREEN：同一命令通过；录音中会按 `workspaceId` 写入 `memoryId`、`segmentId`、title 和 duration，durable finalize 后清除 marker。
- RED：`npm run test:renderer -- src/renderer/src/App.test.tsx -t "offers to save a recoverable unfinished recording"` 首次失败，暴露重新打开 workspace 后不会提示未完成录音恢复。
- GREEN：同一命令通过；App 读取匹配当前 workspace 和 Memory 的 recovery marker 后显示“未完成录音”对话框，点击“保存录音”使用 marker 中的 `memoryId`、`segmentId` 和 duration 调用 `workspace:finalizeRecordingDraft`，成功后合并 Memory summary 并清除 marker。
- RED：`npm run test:renderer -- src/renderer/src/App.test.tsx -t "opens a recoverable unfinished recording in paused review state"` 首次失败，暴露“继续检查”无法进入暂停态并从原 draft 完成保存。
- GREEN：同一命令通过；`RecordingRecoveryDialog` 新增“继续检查”，App 以 marker 的 `memoryId` 打开 recording overlay，`RecordingOverlay` 从 marker 恢复 waveform、transcript、duration、session 和 revision，点击完成使用原 `segmentId`/`memoryId` finalize 并清除 marker。
- RED：补充 `RecordingOverlay.test.tsx` recovered continue/replace 反向用例，首次失败暴露恢复态会尝试把旧 draft WebM 与新的 MediaRecorder session 拼接。
- GREEN：`workspace:readRecordingDraftAudio` 只读取当前 workspace handle 下的未完成 draft audio；renderer 按 marker 中的 audio chunk time/byte map 重建有效 chunk 前缀，用于恢复暂停检查态的回听和保存前检查。恢复态没有原 MediaRecorder controller 时，继续/替换只发 root toast 并保留 marker；活跃录音的中段替换复用当前已暂停的 MediaRecorder controller，创建新 draft、复制 cursor 前 chunk 前缀、切换 revision 并从同一 controller 继续采集。
- `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/workspaceApi.test.ts`：通过，3 个测试文件、75 个测试。
- `npm run test:main -- recordingDrafts workspaceContract workspaceBridgeSurface workspaceIpc`：通过，261 个 main tests，覆盖 unfinished draft audio read file truth、contract、preload bridge 和 IPC allowlist。

## 豆包 ASR 初始连接重试补充验证

- RED：`npm run test:main -- recordingTranscriptionSessions` 首次失败，暴露初始 live session start 临时失败会直接返回转写失败，并把失败消息原文返回给 renderer。
- GREEN：同一命令通过；main registry 对初始 start 连接失败重试一次，失败尝试会 close，不向 renderer 发临时 error event，重试成功后后续 PCM 只进入当前 session，重试耗尽时返回脱敏错误。

## 豆包 ASR 录音中断线重连补充验证

- RED：`npm run test:main -- recordingTranscriptionSessions` 首次失败，暴露录音中 live session 报错后仍只有 1 个 session，不会重连，也会把临时错误直接发给 renderer。
- RED：`npm run test:main -- doubaoStreamingAsr` 首次失败，暴露已 start 的 live socket 非预期 close 不会触发安全错误回调。
- GREEN：`npm run test:main -- doubaoStreamingAsr recordingTranscriptionSessions` 通过，259 个 main tests；已 start 的 live socket 非预期 close 会脱敏报告，registry 在录音中断线后创建新 live session，回放最近 5 秒 16 kHz PCM buffer，重连 segment 的 timestamp 按原录音时间线偏移，重连成功时不向 renderer 发临时 error event。

## 当前补转写快照验证

- `npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx`：通过，38 个 renderer tests。
- `npm run verify:quick`：通过。覆盖 typecheck、259 个 main tests、148 个 renderer tests、lint 和 format check。
- 真实账号协议验证：使用环境变量注入 App ID / Access Token，通过当前 `src/main/doubaoStreamingAsr.ts` live session 向 `volc.seedasr.sauc.duration` 发送 `/tmp/reo-doubao-validation.wav` 的 16 kHz raw PCM；输出为 228278 bytes、19 个流式片段、1 个最终片段、0 个错误，最终文本为“今天我想记录一次真实的豆包语音识别验证，我们正在测试录音中的实时转写。”
- 最新真实账号复验：使用同一 App ID / Access Token 注入环境变量，当前 live session 发送同一 16 kHz raw PCM；输出为 228278 audio bytes、161 个 segments、155 个 final segments、0 个 errors；按时间线去重后的最终 transcript 为“今天。我。想。记录。一次。真实的。豆。包。语音。识别。验证。我们正在测试录音中的实时转写。”

## 原生关闭保护补充验证

- RED：`npm run test:renderer -- src/renderer/src/App.test.tsx -t "blocks native window unload while recording is busy"` 首次失败，录音中触发 `beforeunload` 未被阻止。
- GREEN：同一测试通过；录音准备态不阻止原生关闭，录音中 busy close-blocked state 上报 App 后会阻止 `beforeunload`，避免窗口关闭或 reload 直接丢失当前 draft。

## 豆包 ASR 协议补充验证

- RED：`npm run test:main -- doubaoStreamingAsr` 首次失败，缺少 `src/main/doubaoStreamingAsr.js`。
- RED：补充 server error 后关闭 session、open 前 close 拒绝 start 的测试，首次失败分别暴露 close count 为 0 和 start promise pending。
- GREEN：`npm run test:main -- doubaoStreamingAsr` 通过，包含豆包 ASR header、live session WebSocket 连接注入、full request、audio-only request、final audio frame、response parse、utterance segment mapping、错误脱敏、失败关闭和 open 前 close 处理测试。
- 集成保护：`npm run verify:quick` 通过，覆盖 typecheck、284 个 main tests、148 个 renderer tests、lint 和 format check。
- 构建保护：`npm run build` 通过，确认 main/preload/renderer production build 可生成。

## 完成时最终转写补充验证

- RED：`npm run test:main -- doubaoStreamingAsr recordingTranscriptionSessions` 首次失败，暴露 Doubao live session `finish()` 没有等待服务端 last package，socket 提前关闭不会让 `finish()` reject，registry 会把 finish reject 直接抛出且可能泄露错误原文。
- RED：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx` 首次失败，暴露停止录音不会等待最终转写 promise，最终转写失败也不会走 root toast。
- GREEN：`npm run test:main -- doubaoStreamingAsr recordingTranscriptionSessions` 通过，294 个 main tests；`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx` 通过，48 个 renderer tests。
- 真实 final package 验证：使用环境变量注入 App ID / Access Token，复用编译后的 `doubaoStreamingAsr` live session 发送 `/tmp/reo-doubao-validation.wav`，`finish()` 等到服务端最终包后 resolve，返回 19 个 segment、0 个 error，最终文本为“今天我想记录一次真实的豆包语音识别验证，我们正在测试录音中的实时转写。”

## 完成后补转写补充验证

- RED：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx -t "backfills transcription"` 首次失败，暴露 durable finalize 后没有启动 `completion-backfill` ASR session，`startRecordingTranscription` 只调用 1 次而不是 2 次。
- GREEN：同一命令通过；`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx` 通过，37 个测试，覆盖先 durable finalize、再用缓存 PCM 发起 `recording-1-completion-backfill`、等待最终包后保存 transcript。
- RED：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx -t "backfills transcription when final transcription fails after partial live text"` 首次失败，暴露已有部分实时文本时 final failure 不会触发补转写，仍只启动 1 次 ASR session。
- GREEN：同一命令通过；当前实现会把 ASR error / finish failure 标记为当前 revision 需要补转写，即使已有部分中间文本，也会在 durable finalize 后用同一 `recordingSessionId` / `revisionId` 重发缓存 PCM，最终 segment 会替换重叠的旧中间文本后保存。

## 转写定位补充验证

- RED：`npm run test:renderer -- src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx` 首次失败，缺少 `RecordingTranscriptPreview`。
- GREEN：`npm run test:renderer -- src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx` 通过，覆盖 active segment 高亮、cursor 改变后的 `scrollIntoView` 和无 segment fallback。
- 集成保护：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx src/renderer/src/workspace/recording/recordingTimeline.test.ts` 通过，3 个测试文件、44 个测试。

## PCM 侧通道补充验证

- RED：`npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` 首次失败，AudioWorklet module 未加载且 stop 未 flush partial PCM。
- GREEN：`npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` 通过，覆盖 48 kHz 输入重采样到 16 kHz little-endian PCM、按 chunk duration 输出、stop flush partial PCM、track cleanup 和 recorder failure。
- 视觉补充：Electron dev runtime 通过 CDP 注入 fake `MediaRecorder/getUserMedia` 避免真实麦克风权限，截图位于 `/tmp/reo-visual-check/recording-ready.png`、`/tmp/reo-visual-check/recording-active.png` 和 `/tmp/reo-visual-check/recording-paused.png`；对照 wireframe 三态后，底部控制区已从拼接容器收敛为同一 recording surface 上的轻量 actions。
- 视觉修正补充：用户指出转写区域仍有背景填充后，去掉 `RecordingTranscriptPreview` 的 eggshell 渐隐背板，保留透明 mask；复查截图位于 `/tmp/reo-visual-check/recording-active-no-transcript-fill.png` 和 `/tmp/reo-visual-check/recording-paused-no-transcript-fill.png`。

## Subagent 复审修复

- `review` 发现 live finalize 在 transcript save 失败前没有把 `finalizedAudio` 写入 recovery marker；已修复为 durable audio finalize 成功后立即写入 marker，再进入 transcript save。若 transcript save 失败，恢复对话框后续只补 transcript，不重复 finalize。
- `review` 发现 draft audio read 和 append 存在读取上限竞态；已修复为同一 draft 的 read、append、finalize 互斥，并在 read 完成后复核 metadata byte length 与读取上限。
- `ycksimplify` 发现 pause 后 analyser/PCM 仍可能继续工作；已修复为 pause 停止 level pump、暂停 PCM AudioContext/AudioWorklet 输入并关闭 track，resume 再恢复。
- `ycksimplify` 发现 live ASR PCM send 是 fire-and-forget；已修复为按 recording session / flow / revision 绑定的 1 MiB 有界串行队列，overflow 或 send failure 关闭 live ASR 并走 completion backfill，不阻断 durable capture。
- `ycksimplify` 发现 append ack 热路径每次写 recovery localStorage；已改为首个 chunk、节流 chunk map、pause/stop 和 finalize/transcript-save 分界写 marker，恢复继续检查时从 draft metadata 读取真实 `nextSequence`。
- `ycksimplify` 发现 transcript segment merge 和 draft segment path resolver 重复；已提取 `src/workspace-contract/transcript-segments.ts` 和 `resolveWorkspaceDraftSegmentDirectory`。
- 最终复审发现 finalize 没有拦截 active draft audio read；已修复为 read、append、finalize 三者互斥，并补充 main 测试。
- 最终复审发现 live PCM send `accepted:false` 会被当成成功；已修复为关闭 live ASR、标记 completion backfill，并补充已有部分实时转写时仍触发 backfill 的 renderer 测试。
- 最终复审发现 completion backfill 成功但 transcript save 失败时，补转写文本只在内存中；已修复为 backfill 后、save transcript 前显式写入 recovery marker，并补充 save failure 后 marker 仍包含 backfilled transcript 的测试。
- 最终复审发现 recovery marker 超预算会静默丢 transcript，且缺 chunk map 时会用 64MiB 兜底读取 draft；已修复为 transcript markdown sidecar、safe audio byte length、无 chunk map 时禁止恢复预览读取并只允许保存/放弃。
- ycksimplify 复审发现 `cloneRecordingDraftPrefix` 只在复制前复核一次 lock；已修复为 retained audio copy 的每个 read/write chunk、target fsync 和 metadata 写入前都重新消费 workspace lock usability，lock lost 时回滚 target audio 为空并保留 source draft。
- review 复审发现 ASR start 失败会在已有部分 transcript 时直接保存不完整文本；已修复为 start 未 accepted 或 start failure 都标记当前 revision 需要 completion backfill，完成后用缓存 PCM 重新取得最终 transcript。
- ycksimplify 复审发现 replacement 和 ASR replay 在 cursor 落入 PCM chunk 内时会发送 cursor 前音频；已修复 renderer replacement flush 和 main reconnect replay 的首个重叠 PCM chunk 裁剪。
- review 复审发现 cursor 为 0 的替换如果只保留旧 WebM 后段会生成缺少初始化 header 的音频；已修复为起点替换创建新的 recording session、revision、draft 和 MediaRecorder controller，不调用 `cloneRecordingDraftPrefix`。
- Electron MediaRecorder 解码验证：保留旧 session 初始 WebM chunk 前缀后从同一 controller resume，组合 Blob 可被 AudioContext decode，`combinedDuration=1.38`、`fullDuration=2.1`；不保留初始前缀、只拼接 resume 后段时 decode 失败，错误为 `Unable to decode audio data`。当前实现据此只允许 cursor 大于 0 的完整前缀替换，cursor 为 0 时重新开始 capture。
- 针对性验证：`npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.main.json --noEmit` 通过。
- 针对性验证：`npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/mediaRecorderAdapter.test.ts src/renderer/src/workspace/recordingRecovery.test.ts src/renderer/src/App.test.tsx` 通过，4 个测试文件、105 个测试。
- 针对性验证：`npm run test:main -- recordingDrafts workspaceIpc` 通过，279 个 main tests，覆盖 retained audio copy 过程中 workspace lock lost 后 target audio rollback。
- 完整验证：`npm run verify:quick` 通过，覆盖 typecheck、279 个 main tests、184 个 renderer tests、lint 和 format check。
- 真实豆包账号链路复验：不手动传入 credentials，通过 `.env.local` 自动加载 `REO_DOUBAO_ASR_APP_ID` 和 `REO_DOUBAO_ASR_ACCESS_TOKEN`，向 `volc.seedasr.sauc.duration` 发送本机生成的 16 kHz raw PCM；返回 172652 audio bytes、52 个流式片段、43 个 final 片段、0 个错误。
- 最新针对性验证：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx` 通过，65 个 renderer tests，覆盖 ASR start failure backfill、replacement PCM chunk trim 和 cursor 为 0 时 fresh capture restart。
- 最新针对性验证：`npm run test:main -- recordingTranscriptionSessions` 通过，280 个 main tests，覆盖 reconnect replay 起点落入 PCM chunk 内时裁剪重放音频。
- 最新完整验证：`npm run verify:quick` 通过，覆盖 typecheck、280 个 main tests、186 个 renderer tests、lint 和 format check。
- 最新真实豆包账号链路复验：不手动传入 credentials，通过 `.env.local` 自动加载 `REO_DOUBAO_ASR_APP_ID` 和 `REO_DOUBAO_ASR_ACCESS_TOKEN`，向 `volc.seedasr.sauc.duration` 发送本机生成的 16 kHz raw PCM；返回 172652 audio bytes、64 个流式片段、56 个 final 片段、0 个错误。
- review 复审发现恢复检查态如果 marker 只保留 transcript sidecar markdown、没有 transcript segments，完成保存会丢转写；已修复为恢复时把 sidecar markdown 写入 transcript draft，并补充“继续检查/完成保存”回归。
- review 复审发现 replacement 实际起点会对齐到 MediaRecorder chunk 边界但 UI 仍显示原 cursor；已修复为点击替换前先把可见播放头对齐到实际 durable chunk 边界，避免按钮语义误导。
- ycksimplify 复审发现 `MediaRecorder.stop()` 同步抛错会跳过 PCM 和麦克风 track cleanup；已修复为 stop 抛错仍执行 `flushPcmWorklet`、level pump、PCM pump 和 track cleanup，并补充 adapter 回归。
- 最新针对性验证：`npm run test:renderer -- src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/mediaRecorderAdapter.test.ts` 通过，2 个测试文件、77 个 renderer tests。
- 最新完整验证：`npm run verify:quick` 通过，覆盖 typecheck、280 个 main tests、189 个 renderer tests、lint 和 format check。
- 最新真实豆包账号链路复验：不手动传入 credentials，通过 `.env.local` 自动加载 `REO_DOUBAO_ASR_APP_ID` 和 `REO_DOUBAO_ASR_ACCESS_TOKEN`，向 `volc.seedasr.sauc.duration` 发送本机生成的 16 kHz raw PCM；返回 172652 audio bytes、64 个流式片段、56 个 final 片段、0 个错误。
- 最终 ycksimplify 复审发现 PCM flush 失败仍可能阻断后续资源清理；已修复为 flush 超时或 `postMessage` 抛错都会恢复 worklet handler，`stop()` 会记录 flush cleanup error 但继续关闭 level pump、PCM pump 和麦克风 track。RED：`npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts -t "PCM flush fails"` 首次失败，`audioContext.close` 调用 0 次；GREEN：同一 adapter 测试文件通过，11 个 tests。
- 最终完整验证：`npm run verify:quick` 通过，覆盖 typecheck、280 个 main tests、190 个 renderer tests、lint 和 format check。
- 最终真实豆包账号链路复验：不手动传入 credentials，通过 `.env.local` 自动加载 `REO_DOUBAO_ASR_APP_ID` 和 `REO_DOUBAO_ASR_ACCESS_TOKEN`，向 `volc.seedasr.sauc.duration` 发送本机生成的 16 kHz raw PCM；返回 172652 audio bytes、64 个流式片段、56 个 final 片段、0 个错误。
- 最终 review 复审发现 PCM flush cleanup error 不应让 durable audio `stop()` reject；已修复为 cleanup 失败只做资源容错，不阻断 MediaRecorder stop 成功结果。最终 ycksimplify 复审发现 level/PCM node disconnect 抛错仍可能阻断 context close 和 track stop；已修复为每个 disconnect、close、track stop 独立容错并总是 null 引用。验证：`npm run test:renderer -- src/renderer/src/workspace/mediaRecorderAdapter.test.ts` 通过，12 个 tests。
- 最终完整验证复跑：`npm run verify:quick` 通过，覆盖 typecheck、280 个 main tests、191 个 renderer tests、lint 和 format check。
- 最终真实豆包账号链路复跑：不手动传入 credentials，通过 `.env.local` 自动加载 `REO_DOUBAO_ASR_APP_ID` 和 `REO_DOUBAO_ASR_ACCESS_TOKEN`，向 `volc.seedasr.sauc.duration` 发送本机生成的 16 kHz raw PCM；返回 172652 audio bytes、64 个流式片段、56 个 final 片段、0 个错误。
- 最终 subagent 复审：`review` 返回 `No P0/P1/P2 findings.`；`ycksimplify` 返回 `No material ycksimplify findings.`
