# 产品功能说明

## 功能类别

跨页面的「状态可视化」+「跨页面入口提示」组合：

- 页面功能（Memory Studio 内的 transcript view 行为变化）
- 组件功能（Sidebar 设置按钮的 dot 叠层）
- 异步状态可视化（重试 CTA 是 D 引擎的占位入口，本 spec 内不实际跑引擎）

## 功能目标

让用户在不离开 Memory Studio 的前提下，对一段没有转录的 finalized 录音区分：

1. **系统帮我试过、失败了**：用户能看见原因（粗粒度：上次失败），并能一键重试
2. **用户主动关了 / 没填 key**：UI 上保持安静（不展示原因），由 Sidebar 入口的红点引导去 Settings 处理
3. **用户外部清空了转录**：UI 也保持安静（视为用户意图），不打扰

并通过 Sidebar 设置按钮的红点，把"凭证失效"这个跨 workspace 持续存在的事实在任何工作流里都可见，避免用户在 Memory Studio 看到一堆失败但找不到为什么。

## 用户角色

- 单用户本机使用者；BYOK；Memory Studio 与 Settings 是同一 BrowserWindow 内的两种 app mode

## 使用入口

- **B-1**：在 Memory Studio 的转录 tab（segment 或 supplement）查看一段录音的转录内容时自动可见
- **B-2**：在 Sidebar 左下角看见齿轮"设置"按钮时自动可见（点击红点 = 点击设置按钮，不增加独立交互）

## 前置条件

- B-1：至少有一段 finalized audio segment 或 supplement，且其 `lastAttempt='failed' ∧ transcript.exists=false`
- B-2：voice transcription settings 的 `lastValidationCode='auth'`（保存时 probe 返回 401/403 或 validate 时返回 auth）

## 用户场景

### 场景 1：网络抖动后的失败重试

用户在咖啡店录完一段，AP 不稳定 → live ASR 中途断了 → main registry 重试一次仍失败 → completion backfill 也失败 → finalize 完成，transcript 空 → manifest 写 `'failed'`。

第二天用户回家，打开 Reo，找到那段录音，切到转录 tab，看见：

```
上次生成转录失败
[ 重试 ]
```

点击「重试」按钮即可重新发起转录（D 引擎到位后真正跑；当前 spec 内 callback 可以是 toast「转录引擎尚未上线」）。

### 场景 2：凭证失效

用户的火山 X-Api-Key 被吊销 → 下次录音 live ASR start 失败 → completion backfill 也失败 → manifest 写 `'failed'`。同时，Reo 下一次 settings validate（或下次保存）会返回 `lastValidationCode='auth'`。

用户打开 Reo 后看到：

- Sidebar 设置按钮右上角一个红色小圆点
- Memory Studio 转录 tab 显示「上次生成转录失败 / 重试」按钮

用户点设置 → 进入 Settings → 重新填写 X-Api-Key → 保存（probe 成功）。返回 Memory Studio，按「重试」即可重转。

红点在 `lastValidationCode` 从 `auth` 变为非 `auth` 后立即消失。

### 场景 3：用户关闭 ASR 时录音

用户把语音识别 toggle 关掉了，然后录了一段。finalize 时 manifest 写 `'never'`。

转录 tab 显示「这段录音还没有转录。」（保持现状文案），**不**显示重试按钮，也不在 Sidebar 提示红点（与凭证无关）。

如果用户想给这段补转录，需要打开 toggle 后通过 D 的「生成转录」More 菜单（本 spec 之外）触发。

### 场景 4：用户外部清空转录

用户在 Finder 打开 segment.md，删了整个 `## Transcript` 段。Reo 下次刷新 Workspace snapshot 后 `transcript.exists=false`，但 manifest `lastAttempt` 仍是 `'success'`。

转录 tab 显示「这段录音还没有转录。」，不显示重试按钮。Reo 不擅自把用户的删除当作系统失败回滚转录。

## 信息突出与弱化

### 必须突出

- 「上次生成转录失败」+「重试」按钮：这是 B 的核心可视化
- Sidebar 设置按钮红点：跨 workspace 持续可见的 nudge

### 必须弱化（与现状一致，不破坏）

- 「这段录音还没有转录。」空态：当 `lastAttempt ∈ {'never', 'success'}` 时仍然使用，措辞不变
- 录音中 / 录音前的 RecordingOverlay 文案：完全不动

## 主操作

- 转录 tab 内的「重试」按钮：调用上层注入的 `onRetryTranscription(segmentIdentity)` callback

## 辅助操作

- Sidebar 红点：本身不是按钮，点击的是底层「设置」按钮（已有），动作是切换 `appMode='settings'`

## 数据输入

- Workspace snapshot / Memory detail projection 中每个 finalized segment / supplement 暴露 `lastTranscriptionAttempt`
- Voice settings snapshot 已有 `lastValidationCode`，本 spec 不改 snapshot 字段

## 数据输出

- `.reo/objects/segments/<segmentId>.json` 新增 optional `lastTranscriptionAttempt`
- `.reo/objects/supplements/<supplementId>.json` 新增 optional `lastTranscriptionAttempt`
- 不改其他文件

## 权限规则

- B-1 不增加权限边界（属于已 ready 的 workspace handle 内 read/write）
- B-2 不增加权限边界（settings query 是 application-scoped，已存在）

## 异常规则

- manifest 中字段缺失（旧文件）→ derived 视为 `'never'`，不显示重试按钮
- manifest 中字段值不合法（schema 失败）→ 走现有 typed error envelope（与现行 unsafe manifest 同款），不显示重试
- B-2 的 `voiceSettings` query 仍 loading → 不显示红点（与"未知不展示"原则一致）

## 成功结果

- 上述 4 个场景表现与本文档一致
- `npm run verify:quick` 通过
- 现有 RecordingOverlay / Memory Studio / Settings 测试不退化
- 新增测试覆盖：finalize 三种结果各写入正确字段；旧文件读为 `'never'`；重试 callback 被正确触发；红点跟随 `lastValidationCode`

## 失败结果

- finalize 路径写错字段值 → C 的自动入队边界会污染（必须在 B spec 内端到端测覆盖）
- 旧文件被误判为 `'failed'` → 用户打开旧 workspace 时看到一堆"重试"按钮（必须严格按 `'never'` 处理 absent）

## 验收标准（细化在 verification.md）

- 三个 finalize 路径与 transcript save 在 manifest 上写正确三值
- absent 字段读为 `'never'`
- Memory Studio segment & supplement transcript view 在 `failed ∧ exists=false` 时显示重试 CTA
- 重试 callback 接收正确 identity
- Sidebar 红点随 `voiceSettings.lastValidationCode` 即时同步
- 没有新增 IPC channel / Query key
- 现有 96+ 个 voice / recording / memory studio 测试全绿
