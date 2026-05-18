# 豆包语音共享设置与重新生成转录收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for behavior changes. This plan is the engineering handoff for the current Reo spec and must be executed task-by-task with RED -> GREEN -> REFACTOR evidence.

**Goal:** 让豆包流式语音识别模型 2.0 与录音文件极速版识别共享同一个 X-Api-Key 的产品语义、设置页状态、手动重新生成体验和后端结果语义全部一致。

**Architecture:** 继续沿用既有 app-scoped voice settings projection、main-owned `voiceSettingsStore`、manual backfill queue 与现有 workspace IPC。Renderer 只消费 settings snapshot 和 typed workspace responses；main 负责 key 保存、验证、ASR 调用、文件写入、digest guard 和安全日志边界。

**Tech Stack:** Electron + React 19 + TypeScript + TanStack Query + shadcn/ui + Radix AlertDialog + Vitest/node:test + Volcengine Doubao ASR.

---

## 一、产品功能说明

### 功能类型

本功能同时属于后台配置功能、AI 功能、异步任务功能、跨页面流程功能和危险覆盖操作。

### 功能目标

用户只需要在「设置 / 语音」里配置一次 X-Api-Key，即可启用录音时的豆包流式语音识别模型 2.0，以及 finalized audio Segment / SegmentSupplement 的录音文件极速版转录和重新生成转录。用户触发重新生成后不应被弹窗或 pending 阻塞；界面立即回到内容流，显示当前录音正在生成转录，并在后端完成后用新转录覆盖旧正文。

### 用户角色

当前本机 Reo 用户。没有多用户权限模型；所有权限判断来自 Electron 安全边界、当前 workspace handle、single-writer lock、voice settings 是否启用与 key 是否可用。

### 使用入口

- 设置入口：AppShell 左下角设置按钮 ->「语音」。
- Segment 入口：Memory Studio 中 Segment card More 菜单 ->「生成转录」或「重新生成转录」。
- SegmentSupplement 入口：内容 tab More 菜单 ->「生成转录」或「重新生成转录」。

### 前置条件

- 应用处于可信 renderer，所有特权能力经 `window.reoWorkspace` 窄 preload 调用。
- 当前 workspace handle 可用，目标 Segment 或 SegmentSupplement 属于当前 workspace。
- Voice settings 已启用、X-Api-Key 已配置且未处于 auth 失败；network 失败只提示重试，不禁用手动菜单。
- 录音 overlay 未处于打开状态；同 target 没有 manual 或 automatic backfill running。

### 页面状态

#### 1. 设置初始/加载态

- 进入条件：用户进入 settings mode 且 `['settings', 'voice']` 查询未返回。
- 页面表现：右侧内容显示「正在载入语音设置。」。
- 用户能做什么：返回应用。
- 用户不能做什么：编辑 key、保存、清除、验证。
- 系统正在做什么：renderer 读取 main-owned voice settings projection。
- 数据变化：无写入。
- 退出状态：settings snapshot 返回后进入 disabled、missing-key、verified、auth-failed、network-failed 或 stale。
- 异常处理：读取失败走现有 query/error 边界，不展示 key。
- 验收：加载态不泄露 key、不出现可点击保存。

#### 2. 设置禁用态

- 进入条件：`settings.enabled=false`。
- 页面表现：开关关闭；X-Api-Key 输入框禁用；若已配置 key，只显示 last4；页面 copy 明确 key 共用于实时转写和文件转录。
- 用户能做什么：打开开关、清除已保存 key、打开火山引擎控制台。
- 用户不能做什么：在关闭状态下编辑 key。
- 系统正在做什么：不触发 ASR。
- 数据变化：开关变化通过 settings IPC 写入 app-scoped settings。
- 退出状态：开启后进入 missing-key 或已配置状态。
- 异常处理：保存失败显示安全错误，不显示 key。
- 验收：开关 accessible name 不再误导为只启用流式识别。

#### 3. 设置缺 key 态

- 进入条件：`settings.enabled=true` 且 `apiKeyConfigured=false`。
- 页面表现：输入框可编辑；helper 提示启用后需要 X-Api-Key 才能进行语音识别和文件转录；保存按钮在空输入时禁用。
- 用户能做什么：输入 X-Api-Key、显示/隐藏当前草稿、保存并验证、打开控制台。
- 用户不能做什么：在空输入时保存。
- 系统正在做什么：只保留草稿在 input value，不渲染为普通文本。
- 数据变化：保存时 main 加密写入 key，再 probe 验证，返回 settings projection。
- 退出状态：验证成功进入 verified；auth 失败进入 auth-failed；network 失败进入 network-failed。
- 异常处理：`file-written-index-stale` 清空草稿并重新读取 projection。
- 验收：DOM 文本不包含完整 key。

#### 4. 设置已验证态

- 进入条件：`enabled=true`、`apiKeyConfigured=true`、`lastValidationCode='ok'` 且 validation 未 stale。
- 页面表现：显示 last4 和「已验证 · yyyy-MM-dd HH:mm」；helper 说明同一密钥同时用于流式语音识别和录音文件转录。
- 用户能做什么：输入新 key 替换、清除 key、打开控制台、返回应用后使用生成/重新生成。
- 用户不能做什么：查看已保存 key 明文。
- 系统正在做什么：voice settings projection 被 App 和 Memory Studio 用作菜单 gate。
- 数据变化：无自动写入。
- 退出状态：清除后进入缺 key 或禁用；替换保存后进入验证中。
- 异常处理：验证 stale 时显示重新验证入口。
- 验收：设置页截图能直接看出 shared-key 语义。

#### 5. 设置 auth/network 失败态

- 进入条件：last validation 返回 auth 或 network。
- 页面表现：auth 使用红色错误文案；network 使用非 auth 提示；保存按钮显示「重试」。
- 用户能做什么：auth 下重试验证或替换 key；network 下可稍后重试。
- 用户不能做什么：auth 失败时从菜单触发手动转录。
- 系统正在做什么：不把 probe 原始错误、key 或 vendor payload 暴露到 renderer。
- 数据变化：重试只更新 validation fields。
- 退出状态：ok、auth、network。
- 异常处理：网络不可用不清除 key。
- 验收：auth 禁用菜单，network 菜单可点击且后端失败由 toast 表达。

#### 6. 重新生成确认态

- 进入条件：目标已有 transcript，用户点击「重新生成转录」。
- 页面表现：AlertDialog 标题「重新生成转录？」、说明覆盖风险、按钮「重新生成」和「取消」。
- 用户能做什么：确认、取消、ESC 或 overlay 关闭。
- 用户不能做什么：绕过确认直接覆盖已有 transcript。
- 系统正在做什么：尚未发起 backfill。
- 数据变化：无写入。
- 退出状态：取消回到内容态；确认立即关闭进入 optimistic running。
- 异常处理：如果切换 target，dialog 关闭。
- 验收：确认点击后 150ms 内 dialog 从 DOM 消失。

#### 7. 乐观运行态

- 进入条件：确认 regenerate 或点击 fill-missing 后 manual request 已发起。
- 页面表现：保留已有 transcript 正文并叠加「正在生成转录。」或「正在生成补充录音转录。」；菜单同 target 禁用。
- 用户能做什么：继续浏览、切换页面、播放音频、查看旧 transcript。
- 用户不能做什么：对同 target 重复提交。
- 系统正在做什么：main queue 调用 Doubao 文件识别、持锁重读 transcript、digest 比对、ownership 复核、覆盖写入 Markdown 并更新 manifest。
- 数据变化：成功后更新 transcript 和 projection；失败保持旧正文。
- 退出状态：成功、失败、TRANSCRIPT_CHANGED、canceled。
- 异常处理：失败用 root toast；外部编辑冲突保留外部内容。
- 验收：前端不等待后端完成才关闭弹窗。

#### 8. 已提交成功态

- 进入条件：main 已完成 transcript 覆盖写和 manifest 更新，并返回带 response 的 success。
- 页面表现：正文变为新转录；running 文案消失；lastTranscriptionAttempt 为 success。
- 用户能做什么：阅读、再次重新生成。
- 用户不能做什么：无。
- 系统正在做什么：同步 workspace snapshot / memory detail / content query。
- 数据变化：Markdown transcript 和 manifest 已提交；queue 不得再把该成功结果改报 canceled。
- 退出状态：新的用户操作。
- 异常处理：如果 index stale 但文件已写入，按现有 file-written-index-stale 语义保留文件真源并刷新。
- 验收：cancel 信号晚于成功提交时 UI 不显示 canceled 失败。

## 二、关键组件与元素

- 「语音」设置标题：页面主标题，解决用户定位问题；始终显示；不承载状态。
- Voice settings section：说明同一 X-Api-Key 用于录音实时转写和录音文件转录；默认显示；aria-label 与可见标题一致。
- 启用开关：控制 voice transcription 全局启用，不只控制流式识别；loading/busy 时 disabled。
- X-Api-Key input：只接收未保存草稿；禁用态不可编辑；输入后显示 eye icon；保存后清空。
- 配置 helper：显示 last4 和共享 key 说明；不出现完整 key。
- 验证状态：ok/auth/network/stale 四态；auth 红色，network 非阻断，stale 提供重新验证。
- 保存/重试按钮：空草稿禁用；pending 显示「验证中」。
- 清除 X-Api-Key 按钮与确认弹窗：危险操作，说明清除后实时转写和文件转录都不可用。
- Segment/Supplement More 菜单：根据 transcript exists 显示「生成转录」或「重新生成转录」。
- 重新生成 AlertDialog：唯一覆盖确认入口；确认后立即关闭。
- Transcript running 文案：异步任务进行中反馈；regenerate 时不隐藏旧正文。
- Root toast：承载失败、already running、transcript changed、auth/network 等反馈。

## 三、工程实现说明

### 文件边界

- `src/main/backfillQueue.ts`：修复 cancel 后处理，若 `runTask` 已返回带 response 的结果，queue 必须释放并记忆该真实结果。
- `test/main/backfillQueue.test.ts`：新增 committed success after cancel 行为测试，并保留普通 late success 被 cancel 的旧语义。
- `src/renderer/src/settings/VoiceSettingsPanel.tsx`：更新 shared-key copy、aria-label、helper、required hint、clear dialog description。
- `src/renderer/src/settings/VoiceSettingsPanel.test.tsx`：锁定设置页 shared-key copy 和安全 key 展示。
- `docs/current/frontend.md`：同步设置页和 regenerate optimistic UI 当前事实。
- `docs/current/flow.md`：同步 queue committed response 与共享设置对 backfill gate 的影响。
- `docs/current/quality.md`：同步测试覆盖。

### 数据读写

- 读取：`workspace:readVoiceTranscriptionSettings` 只返回 projection，不返回 key。
- 写入：`workspace:saveVoiceTranscriptionApiKey` 加密保存同一 key，并立即 probe；`workspace:setVoiceTranscriptionEnabled` 只写 enabled；`workspace:clearVoiceTranscriptionApiKey` 清空 key 与 validation fields。
- 同步：settings query 仍使用现有 `['settings', 'voice']`；regenerate 成功仍复用 transcript save response 更新当前 projection。
- 禁止：不新增 key 字段、不新增 provider 字段、不在 manifest 记录 key 或 provider 分支。

### 第三方能力

- 使用火山引擎豆包语音能力：录音中使用流式语音识别模型 2.0；finalized audio 使用录音文件极速版识别。
- 工程边界：第三方 key 只在 main process 解密并进入官方请求 header；renderer 不持有 key、audio bytes 上传路径或 vendor payload。
- 页面消费：只消费 settings validation projection、transcript 文本、typed error。
- 失败降级：auth 要求用户替换/重试 key；network 可重试；ASR 失败不删除旧 transcript。

## 四、状态切换规则

| 当前状态     | 目标状态      | 触发条件               | 用户动作                            | 系统行为                              | 界面变化                     | 数据变化                   | 接口调用                         | 权限判断                                  | 异常处理                         | 回滚规则                    | 验收标准                   |
| ------------ | ------------- | ---------------------- | ----------------------------------- | ------------------------------------- | ---------------------------- | -------------------------- | -------------------------------- | ----------------------------------------- | -------------------------------- | --------------------------- | -------------------------- |
| 设置加载     | 设置已加载    | query 成功             | 进入设置                            | 读取 settings projection              | 表单出现                     | 无                         | read settings                    | sender 校验                               | query 失败显示错误               | 无                          | 不泄露 key                 |
| 禁用         | 缺 key/已配置 | 开关开启               | 点击 switch                         | 写 enabled                            | switch pending/disabled      | enabled=true               | setEnabled                       | trusted sender                            | 写失败 toast                     | 保持旧 projection           | 开关语义为全局语音识别     |
| 缺 key       | 验证中        | 输入非空后保存         | 点击保存                            | 加密写 key 并 probe                   | input/button disabled        | key 写入 main store        | saveApiKey                       | main-only safeStorage                     | 写失败保留草稿；stale 清草稿重读 | 未成功 projection 不覆盖 UI | 完整 key 不出现在文本      |
| 验证中       | 已验证        | probe ok               | 无                                  | 更新 validation                       | 显示已验证时间和 last4       | lastValidationCode=ok      | save/validate                    | main-only key                             | 无                               | 无                          | last4 正确                 |
| 验证中       | auth 失败     | probe auth             | 无                                  | 更新 validation                       | 红色错误 + 重试              | lastValidationCode=auth    | save/validate                    | main-only key                             | 菜单禁用                         | 旧 key 不显示明文           | auth gate 生效             |
| 验证中       | network 失败  | probe network          | 无                                  | 更新 validation                       | network 提示 + 重试          | lastValidationCode=network | save/validate                    | main-only key                             | 菜单仍可点击                     | 不清 key                    | network 不等于 auth        |
| 已配置       | 清除确认      | 点击清除               | 点击按钮                            | 打开 danger dialog                    | dialog 出现                  | 无                         | 无                               | 无                                        | cancel 关闭                      | 无                          | 文案说明两类转录都不可用   |
| 清除确认     | 缺 key/禁用   | 确认清除成功           | 点击清除                            | main 清 key                           | dialog 关闭                  | key 与 validation 清空     | clearApiKey                      | trusted sender                            | 失败保留旧 projection            | 不部分清除 UI               | last4 消失                 |
| 内容可操作   | 重新生成确认  | transcript.exists=true | 点击菜单                            | 打开 dialog                           | 覆盖确认出现                 | 无                         | 无                               | voice settings + recording + running gate | gate 失败 tooltip/toast          | 无                          | 菜单 label 正确            |
| 重新生成确认 | 乐观运行      | 确认                   | 点击重新生成                        | 立即关闭 dialog，发起 manual backfill | running 文案出现，旧正文保留 | running set 添加 target    | requestBackfill(mode=regenerate) | workspace handle + target ownership       | already running toast            | 移除 running set            | 150ms 内 dialog 消失       |
| 乐观运行     | 成功          | ASR + 写入成功         | 无                                  | 持锁 digest guard 后覆盖写            | 新正文出现                   | transcript + manifest 更新 | Doubao file ASR + save           | assertWorkspaceUsable                     | index stale 刷新                 | 文件真源优先                | 成功不能被晚到 cancel 改报 |
| 乐观运行     | 冲突失败      | save 前 digest 不匹配  | 外部编辑                            | 返回 transcript changed               | toast 提示保留当前内容       | 不覆盖 transcript/manifest | save helper                      | ownership 复核                            | typed error                      | 保留外部编辑                | 外部文本保留               |
| 乐观运行     | canceled      | cancel 早于 commit     | workspace switch/app quit/lock lost | abort runTask                         | running 清除                 | 不写 transcript/manifest   | queue cancel                     | signal + lock                             | 返回 canceled                    | 无写入                      | cancel before commit 不写  |
| 已提交成功   | 已提交成功    | cancel 晚于 commit     | workspace switch/app quit           | queue 释放 committed response         | UI 保持成功                  | 已写结果保留               | queue release                    | response present                          | 不改报 canceled                  | 不回滚已提交文件            | 后续 await 返回 ok         |

## 五、边界情况

| 场景                 | 触发条件                            | 处理规则                                        | 界面反馈                    | 建议提示文案                                                 | 数据保护规则             | 验收标准                |
| -------------------- | ----------------------------------- | ----------------------------------------------- | --------------------------- | ------------------------------------------------------------ | ------------------------ | ----------------------- |
| 未启用语音识别       | enabled=false                       | 禁用手动菜单和输入保存                          | tooltip/settings hint       | 先在设置里启用并填写 X-Api-Key                               | 不触发 ASR               | 无 IPC backfill         |
| 未配置 key           | apiKeyConfigured=false              | 禁用菜单，设置页要求 key                        | helper/error                | 启用后需要 X-Api-Key 才能进行语音识别和文件转录              | 不泄露草稿               | 保存前 DOM 不含 key     |
| auth 失败            | lastValidationCode=auth             | 禁用菜单并显示红点                              | 红色状态                    | X-Api-Key 验证失败，请确认密钥后重试。                       | 保留 last4，不显示 key   | menu disabled           |
| network 失败         | lastValidationCode=network          | 菜单可点，失败由任务表达                        | network 状态                | 暂时无法连接豆包服务，请稍后重试。                           | 不清 key                 | menu clickable          |
| 重复提交             | 同 target running                   | 队列 dedup                                      | toast                       | 这段录音正在生成转录。                                       | 不新增任务               | 只一个任务              |
| 录音 overlay 打开    | recording active                    | 禁用设置入口动作和菜单                          | toast/tooltip               | 请先完成或关闭录音。                                         | 不混入 draft             | 无 backfill             |
| 外部编辑冲突         | regenerate 期间 transcript 变更     | digest mismatch 返回 typed error                | toast                       | 转录已在生成期间发生变化，已保留当前内容。请确认后重新生成。 | 不覆盖外部文本           | 文件保留外部编辑        |
| cancel 早于 commit   | app quit/workspace switch/lock lost | abort 检查返回 canceled                         | running 消失或 session 关闭 | 无需额外提示                                                 | 不写 transcript/manifest | 文件未变                |
| cancel 晚于 commit   | 已写入后 signal aborted             | queue 保留 response                             | 成功投影                    | 无                                                           | 不把真实成功改报失败     | await 返回 ok           |
| key 保存 index stale | key 已写但 projection 写失败        | 清草稿并重新读取                                | 安全错误 + last4            | 语音设置无法写入本地配置。                                   | 不重发明文 key           | draft 清空              |
| 第三方不可用         | ASR timeout/rate/network            | typed error + toast                             | root toast                  | 暂时无法生成转录，请稍后重试。                               | 保留旧 transcript        | manifest 不误记 success |
| 小屏幕               | settings/content 宽度受限           | 现有 responsive shell 承载                      | 文本换行                    | 无                                                           | 不影响数据               | 无重叠                  |
| 辅助功能             | keyboard/screen reader              | switch/dialog/menu 有 accessible name           | 可聚焦                      | 与可见文案一致                                               | 无                       | role/name 可查询        |
| 敏感日志             | runtime logging                     | allowlist 禁止 key/audio/path/digest/transcript | 无                          | 无                                                           | 只允许 mode              | grep 不命中真实 key     |

## 六、验收标准

- 设置页真实保存用户提供 key 后显示 last4 与 verified 状态，且文案明确同一 key 用于流式语音识别和录音文件转录/重新生成。
- 点击 Segment 和 SegmentSupplement「重新生成」后 AlertDialog 立即关闭；旧 transcript 继续可见；running 文案出现；后端成功后覆盖为新 transcript。
- `BackfillQueue` 保留带 response 的 committed success，即使 cancel 信号在 runTask resolve 前后到达也不把已提交文件真源改报 canceled；普通 late success 仍可按旧语义 canceled。
- 自动 scanner 仍固定 `fill-missing`；manual regenerate 不进入 automatic path。
- 不新增安全 surface，不暴露 key、raw path、audio bytes、base64、ffmpeg path、digest 或 transcript 到日志/renderer 非必要文本。
- Targeted tests、`npm run verify:quick`、`npm run format:check`、`git diff --check`、真实 Electron E2E 和敏感信息扫描全部通过。

## 七、最终目标总结

本次任务最终要交付的是一个完整一致的豆包语音转录体验：用户只在「设置 / 语音」配置一次 X-Api-Key，这枚 key 同时服务录音时的豆包流式语音识别模型 2.0 和 finalized audio 的录音文件极速版生成/重新生成转录；设置页必须用清楚文案表达共享 key、last4、验证、重试、清除和失败状态，且永远不显示完整 key。用户在 Segment 或 SegmentSupplement 上点击「重新生成转录」时必须先看到覆盖确认，确认后弹窗立即关闭，前端保留旧正文并显示乐观 running，后端在现有 manual backfill 队列中继续完成 ASR、digest guard、workspace ownership 复核、覆盖写 Markdown 和更新 manifest；外部编辑冲突、auth/network、重复提交、录音 overlay、workspace switch、app quit 和 lock lost 都必须有明确 typed 处理，早于提交的取消不能写文件，晚于提交的取消不能把已成功写入改报失败。实现不得新增 IPC channel、Query key、Zustand store、manifest 字段或 main-to-renderer event channel，不得放松 Electron 安全基线，不得泄露 X-Api-Key、raw path、audio bytes、base64、ffmpeg path、digest 或 transcript 到不该出现的位置；最终验收以自动化测试、真实 Electron E2E、文档 current 真源同步、敏感信息扫描和 100% confidence loop 全部通过为准。
