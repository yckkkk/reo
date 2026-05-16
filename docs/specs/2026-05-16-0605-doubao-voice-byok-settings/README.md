# 豆包流式语音识别 BYOK 设置

## 时间

2026-05-16 06:05 America/Los_Angeles

## 目标

让用户在 Reo 内通过本机 Settings 页面自带豆包大模型流式语音识别 X-Api-Key，并把 ASR 协议从旧版双 header 切换到新版单 header；同时引入"启用/停用"全局 toggle，停用时整条转录链路安静关闭，启用时才进入异常处理路径。

## 范围

本次 spec（A）覆盖：

1. AppShell 新增 `mode: 'workspace' | 'settings'` 顶层路由（同 BrowserWindow 切换，不引入第二窗口）
2. Sidebar 左下角齿轮入口，与已有主题切换按钮水平并列
3. Settings shell：左 nav rail（顶部 `← 返回应用` + 一项「语音」）+ 右 content panel
4. 「语音」页面字段：启用 toggle + X-Api-Key 输入 + 验证状态点
5. main process 通过 Electron 官方 `safeStorage` 把 X-Api-Key 加密写入 `userData/voice-transcription-settings.json`
6. 5 个 application-scoped IPC channel + 1 个扩展 channel 暴露不含密文的状态投影
7. 保存时同步发起最小 WebSocket 握手 probe（1s timeout，不发音频），区分 `ok / auth / network` code
8. `src/main/doubaoStreamingAsr.ts` 协议迁移：`{appKey, accessKey}` → `{apiKey}`，header `X-Api-App-Key + X-Api-Access-Key` → `X-Api-Key`
9. `src/main/recordingTranscriptionSessions.ts` credentials shape 调整 + 移除 `process.env['REO_DOUBAO_ASR_APP_ID' | 'REO_DOUBAO_ASR_ACCESS_TOKEN']` 读取
10. 录音 start IPC 增加 `transcriptionMode: 'live' | 'disabled'` 响应字段；toggle disabled 时返回 `{ accepted: true, transcriptionMode: 'disabled' }`，不算错误
11. Navigation gate：录音中阻止进入 settings（root toast 提示）

不在本 spec 范围（见末尾 follow-up）：B 未转录状态可视化、C 自动轮询补转录、D 转录 More 菜单 + 手动重新生成、E `bigmodel_async` vs `bigmodel` endpoint 校正。

## 收口事实

- 豆包 ASR auth 使用单 `X-Api-Key` header；`DOUBAO_STREAMING_ASR_RESOURCE_ID` 为 `volc.seedasr.sauc.duration`，endpoint 为 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async`。
- `REO_DOUBAO_ASR_APP_ID` / `REO_DOUBAO_ASR_ACCESS_TOKEN` 旧变量读取已从 `src/` 删除；录音转写凭证只来自 main-owned voice settings store。
- `workspace:readVoiceTranscriptionSettings` / `setVoiceTranscriptionEnabled` / `saveVoiceTranscriptionApiKey` / `clearVoiceTranscriptionApiKey` / `validateVoiceTranscriptionCredentials` 均为 application-scoped settings IPC，返回不含密钥明文或密文的 snapshot。
- `workspace:openExternalUrl` 只允许 `https://volcengine.com` 及其子域，无 username/password/显式 port。
- Sidebar 设置入口、同窗口 Settings Shell、shadcn/Radix Switch、录音中 settings navigation gate、`['settings', 'voice']` query key 和 voice settings ownership 已写入 `docs/current/*`。
- 保存 key 后输入框清空，只显示已配置末 4 位；眼睛按钮只作用于当前未保存草稿。
- WebSocket probe 会在 open 后发送 Doubao full request frame，并等待服务响应帧；只有明确 401/403 鉴权错误归为 `auth`，其它 service/transport 失败归为 `network`。

## 设计

### 一、功能识别

按用户给定的功能类别清单，本次任务覆盖：页面功能 / 组件功能 / 表单功能 / 后台配置功能 / AI 功能（第三方）/ 异步任务功能 / 权限功能。

### 二、产品功能说明

**解决的问题**：开发者本机以外的真实用户当前无法使用豆包流式语音识别；旧版双 header 在新版控制台上将被淘汰。

**目标用户**：在火山引擎控制台自行管理 X-Api-Key 的 BYOK 用户；本机开发者（替代 `.env.local` 路径）。

**核心场景**：

1. 用户进入设置 → 启用 toggle → 填 X-Api-Key → 保存通过验证 → 下次录音得到 transcript。
2. 用户暂时不想用云端 ASR（隐私 / 离线 / 没开通服务）→ 关闭 toggle → 此后录音照常保存，不发起任何网络调用，不产生错误。
3. 用户 key 失效 → 录音 toast 提示 → 进入设置重新验证 → 看到失败状态 → 更换新 key。

**引导逻辑**：

- 入口位于 Sidebar 左下角，与主题按钮水平并列，是 Reo 唯一的应用级 settings 入口。
- 进入设置后窗口接管：左 nav rail 顶部 `← 返回应用` 是唯一退出入口；下方分类目，本次只有「语音」。
- 「语音」页面顶部 toggle（主操作），中部 X-Api-Key 录入（次要），底部状态点（辅助）。

**主操作**：① 切换启用 toggle ② 填 X-Api-Key ③ 点保存。

**辅助操作**：① 清除已配置的 key（destructive，需二次确认）② 返回应用。

**风险保护**：

- X-Api-Key 是付费凭证 → 保存后不在 UI 回显完整内容，只显示"已配置 · 末 4 位 ●●●● XXXX"占位。
- 删除前 AlertDialog 二次确认（复用现有 `WorkspaceDangerConfirmDialog` 结构）。
- 启用 toggle 但 key 空时 UI 显示红色 hint，但**不阻止保存**——尊重用户操作顺序。
- 录音中点齿轮 → root toast"请先完成或关闭录音"，按钮 disabled。

**成功画面**：保存后状态点变绿，文案"已验证 · YYYY-MM-DD HH:mm"，副文案"流式语音识别可用"。

**失败画面**：401/403 红色状态点 + "X-Api-Key 无效或没有权限"；超时黄色状态点 + "无法连接豆包服务"（key 不清空，允许重试）。

**功能边界**：

- 只配置豆包 ASR 一个 provider，不含 LLM / TTS / 其它服务。
- key 不上传任何 Reo 服务；账单走用户自己的火山账户。
- 设置是 application-scoped，所有 workspace 共享同一份；不绑定单个 workspace。

### 三、用户角色 + 入口 + 前置条件

| 项   | 内容                                                          |
| ---- | ------------------------------------------------------------- |
| 角色 | 当前 Reo 本机用户（无登录态，无服务端账号）                   |
| 入口 | Sidebar 左下角齿轮 + 「设置」文字按钮（录音中除外，始终可见） |
| 前置 | 已有 Reo 本地安装；不需要登录；不需要已打开记忆空间           |
| 退出 | 点击 nav rail 顶部 `← 返回应用` 或键盘 Esc                    |

### 四、页面状态机（9 个状态）

#### 1. `disabled-no-key`（初始态）

- 进入条件：首次进入设置 → 语音。
- 页面表现：toggle 灰 OFF；key 输入框 disabled + placeholder「X-Api-Key」；状态点不显示。
- 用户能做：打开 toggle / 返回。
- 用户不能做：填 key（输入框 disabled）/ 点保存。
- 数据变化：无。
- 退出：开 toggle → `enabled-no-key`；返回应用。
- 异常：无网络也能进入（settings 不依赖网络）。
- 验收：首次进入 toggle 默认 OFF，输入框 disabled，按钮 disabled。

#### 2. `enabled-no-key`

- 进入条件：从 `disabled-no-key` 打开 toggle。
- 页面表现：toggle 红 ON；key 输入框可编辑 + placeholder；输入框下方红色 hint「启用后需要 X-Api-Key 才能生成转录」；状态点不显示。
- 用户能做：填 key / 关 toggle / 返回。
- 用户不能做：空 key 时点保存。
- 系统行为：toggle 切换触发 `workspace:setVoiceTranscriptionEnabled`，UI 体感无 loading。
- 退出：填 key → `editing-with-key`；关 toggle → `disabled-no-key`。
- 异常：toggle 切换 IPC 失败时回滚 toggle + root toast。
- 验收：toggle 视觉与 store 一致；hint 文案正确。

#### 3. `editing-with-key`

- 进入条件：在 `enabled-no-key` 或 `verified-active`/`disabled-with-key` 的输入框里输入字符。
- 页面表现：输入框显示已输字符（默认 mask，右侧「显示」icon-button 临时切明文）；保存按钮变可点；红色 hint 消失。
- 用户能做：继续输入 / 切显示 / 取消（清空回原态）/ 保存。
- 退出：点保存 → `validating`；清空 → 回原态。
- 异常：输入超长（>1KB）→ renderer maxLength 截断 + main schema 拒绝。
- 验收：输入实时回显；mask 切换正确。

#### 4. `validating`

- 进入条件：从 `editing-with-key` 点保存。
- 页面表现：保存按钮 spinner + 「验证中...」；输入框 readonly；toggle disabled；「返回应用」disabled。
- 系统行为：main 写 safeStorage（先写后验，避免验证慢导致保存失败感）→ 最小 WS 握手 probe（1s timeout，不发音频）→ 按 probe 结果更新 store。
- 数据变化：safeStorage 中 `apiKeyCiphertext`/`apiKeyLastFour` 写入；`enabled` 维持。
- 退出：probe 成功 → `verified-active`；401/403 → `validation-failed-401`；超时/DNS → `validation-failed-network`；4xx 非 401 → `validation-failed-401`（按鉴权失败处理但 message 带 code）；5xx → `validation-failed-network`。
- 异常：safeStorage 写失败（磁盘满 / 只读）→ 红 toast + 回到 `editing-with-key`；safeStorage 不可用（Linux 无 libsecret）→ fail-fast banner，禁止保存。
- 验收：提交期间表单不可改；重复点保存第二次 disabled。

#### 5. `verified-active`

- 进入条件：从 `validating` 验证通过。
- 页面表现：toggle ON；输入框显示「已配置 · 末 4 位 ●●●● XXXX」占位 + 「更换」按钮；状态点绿 + 「已验证 · YYYY-MM-DD HH:mm」。
- 用户能做：关 toggle / 点「更换」清空输入 / 点「清除」/ 重新验证 / 返回。
- 退出：toggle 关 → `disabled-with-key`；「更换」→ `editing-with-key`；「清除」→ 二次确认 → `disabled-no-key`；超过 24h 不验证 → 进入 `disabled-with-key` 后再开 toggle 时转 `enabled-with-stale-key`。
- 验收：状态点 + 文案正确；末 4 位脱敏占位正确。

#### 6. `disabled-with-key`

- 进入条件：从 `verified-active` 关 toggle（key 不删，只关功能）。
- 页面表现：toggle OFF；输入框灰显「已配置 · 末 4 位 ●●●● XXXX」；状态点不显示。
- 用户能做：重新开 toggle / 清除 key / 返回。
- 退出：开 toggle → `verified-active`（如 `lastValidationOk === true` 且距上次验证 ≤ 24h）或 `enabled-with-stale-key`（>24h）；清除 → `disabled-no-key`。
- 验收：toggle 关后 transcription start IPC 不再调用 ASR。

#### 7. `validation-failed-401`

- 进入条件：probe 返回 401/403 或 4xx 非超时。
- 页面表现：toggle ON；保存后的输入框清空，只显示已配置末 4 位；状态点红 + 「X-Api-Key 无效或没有权限，请检查控制台」；保存按钮变「重试」。
- 数据：safeStorage 已写入 + `lastValidationOk=false, lastValidationCode='auth'`。
- 用户能做：改 key 重试 / 关 toggle 保留无效 key / 清除 / 返回。
- 退出：改 key → `editing-with-key`；重试 → `validating`。
- 验收：已保存密钥不回显完整内容；toast 文案正确。

#### 8. `validation-failed-network`

- 进入条件：probe 超时、DNS 失败、5xx。
- 页面表现：toggle ON；状态点黄 + 「无法连接豆包服务，请检查网络后重试」；保存后的输入框清空，只显示已配置末 4 位；保存按钮变「重试」。
- 数据：safeStorage 已写入 + `lastValidationOk=null, lastValidationCode='network'`（unknown，不是 false）。
- 用户能做：重试 / 关 toggle / 改 key / 返回。
- 退出：重试 → `validating`。
- 验收：已保存密钥不回显完整内容；网络恢复后重试可通过。

#### 9. `enabled-with-stale-key`

- 进入条件：toggle 重新打开且距上次验证 > 24h。
- 页面表现：与 `verified-active` 类似，但状态点灰 + 「上次验证 7 天前」+ 「重新验证」按钮。
- 用户能做：重新验证 / 关 toggle / 更换 / 清除 / 返回。
- 退出：重新验证 → `validating`。
- 验收：超 24h 自动进入此状态，不直接显示绿。

### 五、组件与元素拆解

#### 5.1 Sidebar 入口（新增）

- 容器：Sidebar 底部，与主题按钮水平并列；左齿轮 + 「设置」文字，右主题按钮。
- 默认 transparent；hover `bg-accent`；active `bg-secondary`；录音中 disabled + tooltip 「请先关闭录音」。
- 点击：切换 AppShell `mode: 'settings'`。
- 工程注意：不引入 React Router；直接 AppShell state 切换；走 Reo 已有 navigation gate helper。

#### 5.2 Settings shell

- Sidebar（settings mode）：顶部 `← 返回应用` 按钮（ghost，icon+label）；下方 nav rail（本次只有「语音」item，active `bg-secondary`）；底部不渲染主题按钮。
- 主内容标题：「语音」（`text-title leading-title font-medium`）。
- Content panel：`bg-background` + `px-28 py-20`，与 Workspace Stage 一致页面节奏。
- 返回应用：点击 → 切回 `mode: 'workspace'`，恢复进入 settings 前的 stage state（不重置 `selectedSegmentId`、不清 Memory detail cache）。

#### 5.3 「语音」页面元素

- Toggle：新增 `components/ui/switch.tsx`（shadcn Switch source）+ 标签「启用流式语音识别」；ON 红色，OFF 灰色。
- 副文案：极简一行「在录音时使用火山引擎豆包大模型流式语音识别生成转录」。
- Key 输入：`Input` type="password" + label「X-Api-Key」；右侧「显示」icon-button 临时切明文；下方 helper「可在火山引擎控制台 → 大模型流式语音识别 获取」+ 链接（受 host allowlist 限制的 `shell.openExternal`）。
- 红色 hint：toggle ON 且 key 空时出现，「启用后需要 X-Api-Key 才能生成转录」。
- 保存按钮：primary Button；空 key 或与已存值相同时 disabled；验证中显示 spinner + 「验证中...」。
- 状态点 + 文案：圆点 + 时间戳：绿「已验证 · YYYY-MM-DD HH:mm」/ 灰「上次验证 N 天前」/ 红「X-Api-Key 无效...」/ 黄「无法连接...」。
- 更换按钮：ghost；点击清空输入框进入 `editing-with-key`。
- 清除按钮：destructive ghost；点击 → `WorkspaceDangerConfirmDialog`「确认清除 X-Api-Key？此操作会停止流式语音识别。」。

#### 5.4 外部链接策略

- 新增 `workspace:openExternalUrl`，main 校验 host ∈ allowlist（只允许 `volcengine.com` 及子域），调用 `shell.openExternal`。`docs/current/electron.md:119` 当前规则「不使用 `shell.openExternal`」必须同批更新。

### 六、工程实现说明

#### 6.1 数据真源 + 存储

文件路径：`app.getPath('userData')/voice-transcription-settings.json`。

JSON shape：

```text
{
  "schemaVersion": 1,
  "enabled": boolean,
  "apiKeyCiphertext": base64(safeStorage.encryptString(apiKey)) | null,
  "apiKeyLastFour": string (apiKey 末 4 字符, 仅用于 UI 脱敏显示) | null,
  "lastValidatedAt": ISO8601 | null,
  "lastValidationOk": boolean | null,
  "lastValidationCode": "ok" | "auth" | "network" | null
}
```

- 文件读写串行化（main process 单写锁，复用同目录其它 main-owned writer 模式）。
- `safeStorage.isEncryptionAvailable()` 在 Linux 无 libsecret 时返回 false → 直接 fail-fast；UI 显示「系统暂不支持安全存储，无法保存 X-Api-Key」；不退化为明文。
- 文件缺失、JSON 损坏、schema 不匹配按 `{ enabled: false, apiKey: null, lastValidation*: null }` 处理；不抛。
- 读取路径不得阻塞 IPC handler；main process 在应用启动时一次性读入内存缓存，后续 `read()` 走缓存，`write()` 先更新缓存再 fsync 文件（同步或异步策略在 plan 阶段确定）。
- 新增模块 `src/main/voiceSettingsStore.ts` 持有该 store 的 read / write / clear / probe trigger / 加解密辅助；所有 IPC handler 与 `recordingTranscriptionSessions` 经它访问 voice settings，避免直接读文件或散落的 safeStorage 调用。

#### 6.2 IPC contract

| Channel                                           | Request                | Response                                                                                               | 说明                                                                   |
| ------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `workspace:readVoiceTranscriptionSettings`        | `{}`                   | `{ enabled, apiKeyConfigured, apiKeyLastFour, lastValidatedAt, lastValidationOk, lastValidationCode }` | 不返回 key 本身；无 workspaceHandle                                    |
| `workspace:setVoiceTranscriptionEnabled`          | `{ enabled: boolean }` | 同上                                                                                                   | 切 toggle                                                              |
| `workspace:saveVoiceTranscriptionApiKey`          | `{ apiKey: string }`   | 同上                                                                                                   | 先写 safeStorage 后 probe，原子返回最新状态                            |
| `workspace:clearVoiceTranscriptionApiKey`         | `{}`                   | 同上                                                                                                   | 清空 key + 重置 validation 字段                                        |
| `workspace:validateVoiceTranscriptionCredentials` | `{}`                   | `{ ok, code: 'ok' \| 'auth' \| 'network', message? }`                                                  | 主动 probe，更新 `lastValidatedAt/lastValidationOk/lastValidationCode` |
| `workspace:openExternalUrl`（扩展）               | `{ url: string }`      | `{ ok: true } \| typed error`                                                                          | main 校验 host allowlist，调 `shell.openExternal`                      |

Sender validation：所有新 channel 校验 trusted main frame + `reo-app://renderer/index.html` + loopback dev origin + channel allowlist；无 workspaceHandle 但仍校验 sender。所有 IPC 输入有 Zod schema 严格校验。

#### 6.3 main process 协议迁移

`src/main/doubaoStreamingAsr.ts`：

```text
// 删除
type DoubaoAsrAuthInput = { accessKey, appKey, connectId };
buildDoubaoAsrAuthHeaders({ accessKey, appKey, connectId })

// 改为
type DoubaoAsrAuthInput = { apiKey, connectId };
function buildDoubaoAsrAuthHeaders({ apiKey, connectId }): Record<string, string> {
  return {
    'X-Api-Key': apiKey,
    'X-Api-Connect-Id': connectId,
    'X-Api-Resource-Id': DOUBAO_STREAMING_ASR_RESOURCE_ID,
  };
}
```

- `DoubaoStreamingAsrSessionInput` 把 `accessKey + appKey` 字段改成 `apiKey`。
- `redactSecrets` 列表从 `[accessKey, appKey]` → `[apiKey]`。
- 所有现有测试 fixture 同步迁移。

`src/main/recordingTranscriptionSessions.ts`：

- `DoubaoCredentials` shape 改成 `{ apiKey }`。
- 删除 `resolveDefaultDoubaoCredentials` 中两个 `process.env` 读取。
- 新 `resolveDefaultDoubaoCredentials`：

```text
function resolveDefaultDoubaoCredentials(): DoubaoCredentials | null {
  const settings = voiceSettingsStore.read();
  if (!settings.enabled) return null;
  if (!settings.apiKeyCiphertext) return null;
  const apiKey = safeStorage.decryptString(Buffer.from(settings.apiKeyCiphertext, 'base64'));
  return { apiKey };
}
```

- `redactCredentialText(message, credentials)` 脱敏列表只剩 `[credentials.apiKey]`。

start path 行为分支（`recordingTranscriptionSessions.ts:419-426` 改造）：

```text
const settings = voiceSettingsStore.read();
if (!settings.enabled) {
  return accepted(true, { transcriptionMode: 'disabled' });
}
const credentials = resolveDefaultDoubaoCredentials();
if (!credentials) {
  return workspaceError(
    'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE',
    '请到 设置 → 语音 填写 X-Api-Key 后再录音。',
    'none-written',
  );
}
// 继续 startLiveSession 既有路径
```

- live session 一旦 start 完成就用其 settings 快照走完整 session，不响应中途的设置变更（避免录音中变更带来不一致）。
- contract 扩展：`WorkspaceRecordingTranscriptionControlResponse` 中 `value` 字段新增可选 `transcriptionMode: 'live' | 'disabled'`，renderer 据此决定是否渲染 transcript 容器或显示「语音转录已停用」简洁占位。

#### 6.4 main 与 renderer 改动汇总

main 新增：

- `src/main/voiceSettingsStore.ts`：voice settings 真源（文件 + 内存缓存 + 加解密辅助）。
- `src/main/voiceTranscriptionProbe.ts`（建议名称，最终由 plan 决定）：最小 WebSocket 握手 probe 实现。

renderer 新增：

- `src/renderer/src/settings/SettingsShell.tsx`：左 nav rail + 右 content panel。
- `src/renderer/src/settings/VoiceSettingsPanel.tsx`：toggle + key 输入 + 状态点。
- `src/renderer/src/settings/voiceSettingsQueries.ts`：TanStack Query options。
- `src/renderer/src/components/ui/switch.tsx`：shadcn Switch source（受 `frontend.md` shadcn 边界约束，需同批更新文档）。
- `src/renderer/src/workspace/SidebarSettingsTrigger.tsx`：齿轮按钮。

修改：

- `src/renderer/src/App.tsx`：`AppShell` 增加 `mode: 'workspace' | 'settings'` 顶层 state；录音 overlay open 时阻止 `mode` 切换；返回 workspace 时不重置 stage state。
- 现有 sidebar 底部容器：齿轮 + 主题按钮水平并列布局。
- `RecordingOverlay`：从 `useVoiceTranscriptionSettings()` 读 `enabled`；disabled 时不渲染 transcript 容器、不发起 `workspace:startRecordingTranscription` IPC。
- `MemoryStudio` 不受影响（已 finalized 录音不需要 settings 检查）。

TanStack Query keys（写入 `docs/current/data.md`）：

```text
['settings', 'voice']  →  readVoiceTranscriptionSettings response
```

Mutation cache：`setEnabled` / `saveApiKey` / `clear` 成功后用 response snapshot seed `['settings', 'voice']`；`validate` 成功后 invalidate `['settings', 'voice']` 重新读取 validation snapshot。

#### 6.5 录音 navigation gate 扩展

`docs/current/frontend.md:122` 当前规则扩展一项：

> 录音流程打开时，App 会阻止 ...（既有列表）... 和**切换到 settings 模式**，并使用 root toast 提示先完成或关闭录音。

实现：Sidebar 齿轮按钮 disabled + tooltip；键盘 Esc / 其它 navigation 入口同样阻止。

#### 6.6 删除清单

- `src/main/recordingTranscriptionSessions.ts` 中 `process.env['REO_DOUBAO_ASR_APP_ID']` 与 `REO_DOUBAO_ASR_ACCESS_TOKEN` 读取。
- `src/main/doubaoStreamingAsr.ts` 中 `accessKey + appKey` 字段、`X-Api-App-Key + X-Api-Access-Key` header。
- `scripts/run-dev.mjs` 如有相关 env var 处理逻辑，同步删除。
- `docs/current/electron.md:20` 中关于 `REO_DOUBAO_ASR_APP_ID / REO_DOUBAO_ASR_ACCESS_TOKEN` 描述、line 115 中 `X-Api-Connect-Id` 字段描述。
- 用户本机 `.env.local` 中的旧变量保留与否由用户自行决定，代码侧不再读取。

### 七、状态切换规则

| 当前                     | 目标                      | 触发               | 系统行为                                        | 数据                                    | IPC        | 异常                                 |
| ------------------------ | ------------------------- | ------------------ | ----------------------------------------------- | --------------------------------------- | ---------- | ------------------------------------ |
| disabled-no-key          | enabled-no-key            | 点 toggle          | `setVoiceTranscriptionEnabled({enabled:true})`  | `enabled=true`                          | setEnabled | IPC 失败 → toggle 回滚 + root toast  |
| enabled-no-key           | editing-with-key          | 输入字符           | renderer 本地 state                             | -                                       | -          | -                                    |
| editing-with-key         | validating                | 点保存             | `saveVoiceTranscriptionApiKey({apiKey})`        | apiKey 密文写入                         | saveApiKey | IPC 异常 → 红 toast，不进 validating |
| validating               | verified-active           | probe 200          | -                                               | `lastValidationOk=true, code='ok'`      | -          | -                                    |
| validating               | validation-failed-401     | probe 401/403/4xx  | -                                               | `lastValidationOk=false, code='auth'`   | -          | key 不清空                           |
| validating               | validation-failed-network | probe 超时/5xx/DNS | -                                               | `lastValidationOk=null, code='network'` | -          | key 不清空                           |
| verified-active          | disabled-with-key         | 点 toggle          | `setVoiceTranscriptionEnabled({enabled:false})` | `enabled=false`，apiKey 保留            | setEnabled | -                                    |
| disabled-with-key        | verified-active           | 点 toggle          | 同上                                            | `enabled=true`                          | setEnabled | 不重 probe                           |
| disabled-with-key        | enabled-with-stale-key    | 点 toggle 且 >24h  | 同上                                            | `enabled=true`                          | setEnabled | -                                    |
| 任意                     | 二次确认                  | 点清除             | 打开 AlertDialog                                | -                                       | -          | -                                    |
| 二次确认                 | disabled-no-key           | 确认               | `clearVoiceTranscriptionApiKey`                 | apiKey + validation 字段清空            | clear      | -                                    |
| workspace mode           | settings mode             | 点齿轮             | AppShell setState                               | renderer state                          | -          | 录音中拒绝                           |
| settings mode            | workspace mode            | 点返回应用         | AppShell setState                               | 恢复 stage state                        | -          | -                                    |
| 录音中（任意 workspace） | 阻止                      | 点齿轮             | 不切换 + root toast                             | -                                       | -          | -                                    |

### 八、边界情况补齐

| #   | 场景                          | 触发                               | 处理                                                                 | 文案                                         | 验收                 |
| --- | ----------------------------- | ---------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- | -------------------- |
| 1   | safeStorage 不可用            | Linux 无 libsecret                 | save fail-fast                                                       | 「系统暂不支持安全存储，无法保存 X-Api-Key」 | Linux container 测试 |
| 2   | userData 写失败               | 磁盘满 / 只读                      | save 失败回滚，旧值保留                                              | 「无法写入本地配置，请检查磁盘空间」         | mock fs 单元测试     |
| 3   | probe 超时                    | DNS / 防火墙                       | 1s timeout → `network`                                               | 见状态 8                                     | mock socket hang     |
| 4   | probe 5xx                     | 服务端故障                         | 当作 network 处理                                                    | 「豆包服务暂时不可用，请稍后重试」           | mock 503             |
| 5   | probe 4xx 非 401              | 资源 ID 错 / 配额                  | 当作 auth 处理                                                       | 「鉴权失败：{code}」                         | mock 429/400         |
| 6   | 录音中点齿轮                  | overlay open                       | 阻止 + toast                                                         | 「请先完成或关闭录音」                       | E2E                  |
| 7   | 录音中 toggle 切换            | 理论不可能                         | live session 用 start 时快照，不响应中途变更                         | -                                            | 单元测试             |
| 8   | 重复点保存                    | 网络慢用户重点                     | 第二次 disabled                                                      | -                                            | UI 测试              |
| 9   | 启用但 key 空                 | 用户保存空状态                     | 允许；下次录音返回 unavailable + toast 引导                          | 「请到 设置 → 语音 填写 X-Api-Key 后再录音」 | 录音 E2E             |
| 10  | key 含前后空格                | 复制粘贴                           | main `apiKey.trim()` 后存 + probe                                    | -                                            | 单元测试             |
| 11  | key 超长                      | 异常输入                           | renderer maxLength + main schema 限制                                | 输入框截断                                   | schema 测试          |
| 12  | safeStorage 解密失败          | userData 跨用户复制                | `resolveDefaultDoubaoCredentials` 返回 null + 日志 + UI needs-reauth | 「配置已失效，请重新填写」                   | mock 解密失败        |
| 13  | settings IPC sender 不可信    | 恶意 renderer                      | sender validation 拒绝                                               | -                                            | sender test          |
| 14  | 多 Reo 实例同时运行           | 用户开多个                         | safeStorage 写入串行化但无文件锁；接受 last-writer                   | -                                            | 接受 last-writer     |
| 15  | settings 切换时录音在后台收口 | 录音 finalize 后台 transcript save | settings 切换不阻止后台 IPC；新设置只影响下次录音                    | -                                            | E2E                  |
| 16  | 进入 settings 后窗口关闭      | 用户直接关 BrowserWindow           | App 正常 teardown；voice settings 持久                               | -                                            | window close test    |
| 17  | 极速切换 settings↔workspace   | 反复点                             | renderer setState 串行；不发起额外 IPC                               | -                                            | UI 测试              |
| 18  | IME 中文输入法                | macOS 中文                         | composition end 前不算输入完成；空 key 用 trimmed value 判断         | -                                            | 手动测试             |
| 19  | 主题切换中点保存              | theme transition                   | 不影响（独立 reducer）                                               | -                                            | -                    |
| 20  | env var 兼容残留              | grep 检查                          | 删除路径后无消费者                                                   | -                                            | grep src 零结果      |

### 九、验收标准

**功能验收**：

1. 首次安装后 sidebar 左下角可见齿轮 + 「设置」。
2. 录音中齿轮 disabled，点击出现 toast。
3. 进入 settings 后 sidebar 顶部 `← 返回应用` 可见，下方「语音」item active。
4. 默认 toggle OFF；输入框 disabled。
5. 开 toggle 后输入框可编辑；红色 hint 出现。
6. 输入正确 key → 保存 → 状态点 1s 内变绿。
7. 输入错误 key → 状态点变红 + 401 文案。
8. 拔网线 → 输入正确 key → 状态点变黄 + 网络文案。
9. 验证成功后再次进 settings → 输入框显示「已配置 · 末 4 位」占位。
10. 关 toggle → key 保留；下次录音不触发 ASR 也不报错。
11. 清除 → 二次确认 → 回到首次态。
12. 启用且配置后录音 → live transcript 出现。
13. 启用但 key 失效后录音 → toast「X-Api-Key 无效或没有权限...」。
14. 禁用后录音 → 无 ASR 调用、无错误、录音正常保存。

**工程验收**：

1. `npm run verify:quick` 全绿。
2. `grep -rn 'REO_DOUBAO_ASR_APP_ID\|REO_DOUBAO_ASR_ACCESS_TOKEN' src/` 无结果。
3. `grep -rn 'X-Api-App-Key\|X-Api-Access-Key' src/` 无结果。
4. 新 IPC channel 全部有 Zod schema + sender validation + 单元测试。
5. safeStorage 不可用场景有单元测试。
6. main voice settings store 单元测试覆盖：read / write / clear / serialize / parse error / 解密失败。
7. `doubaoStreamingAsr.test.ts` 改用 `apiKey` fixture，全部通过。
8. `recordingTranscriptionSessions.test.ts` 覆盖 disabled / unavailable / available 三种 start 行为。
9. renderer `SettingsShell` + `VoiceSettingsPanel` 组件测试覆盖 9 个状态。
10. 录音中切 settings 被阻止的 E2E。

### 十、文档同步

- `docs/current/electron.md:20`：把「豆包 App ID / Access Token 使用未带 VITE scope prefix 的 `REO_DOUBAO_ASR_APP_ID` 和 `REO_DOUBAO_ASR_ACCESS_TOKEN`」整段删除，改为「豆包流式语音识别凭证使用 Electron safeStorage 加密存放在 `userData/voice-transcription-settings.json`，由 main process 持有；renderer/preload 只通过 application-scoped settings IPC 获得不含密文的状态投影」。
- `docs/current/electron.md:115`：把 header `X-Api-Connect-Id`、X-Api-App-Key/X-Api-Access-Key 描述改为单 `X-Api-Key + X-Api-Resource-Id + X-Api-Connect-Id`。
- `docs/current/electron.md:119`：把「当前不使用 `shell.openExternal`」改为「当前只在 settings 链接动作中使用 `shell.openExternal`，并由 main 校验 host allowlist」。
- `docs/current/electron.md` 当前 IPC channel 列表追加 6 个新 channel + 1 个扩展 channel 描述。
- `docs/current/frontend.md:14`：sidebar 底部按钮描述追加齿轮 + 「设置」入口。
- `docs/current/frontend.md:16`：shadcn/ui source 范围追加 `components/ui/switch.tsx`。
- `docs/current/frontend.md:122`：录音 navigation gate 列表追加「切换到 settings 模式」一项。
- `docs/current/frontend.md`：新增「Settings Shell」一节，描述 `mode: 'workspace' | 'settings'` 切换、左 nav rail、内容 panel 几何与 navigation gate。
- `docs/current/data.md`：新增 voice transcription settings 实体描述（main-owned safeStorage + userData JSON），追加 `['settings', 'voice']` query key，描述 mutation seed / invalidate 规则。
- `docs/current/data.md`：把 `REO_DOUBAO_ASR_APP_ID/ACCESS_TOKEN` 相关描述（如有）删除。
- `docs/current/quality.md`：如有「`.env.local` 加载豆包密钥」相关描述则同步删除。

### 十一、验证

- `npm run verify:quick`（CLAUDE.md 硬约束）。
- Dev server 手动覆盖 9 个状态的全部转换：disabled-no-key / enabled-no-key / editing-with-key / validating / verified-active / disabled-with-key / validation-failed-401 / validation-failed-network / enabled-with-stale-key。
- 主线三场景：① 启用 + 正确 key + 录音 → transcript 出现；② 启用 + 错 key + 录音 → toast 提示；③ 禁用 + 录音 → 无 ASR 调用、无错误。
- 截图与命令输出存入 `verification.md` 与 `artifacts/`，按 `docs/current/quality.md` 要求记录。

### 十二、最终目标总结（可直接放在工程任务顶部）

本次任务的最终交付是：让 Reo 用户可以通过 Sidebar 左下角齿轮 + 「设置」按钮进入同窗口的 Settings 路由，在「语音」类目下用一个独立 toggle 启用/停用流式语音识别，并在启用时录入并验证自己的火山引擎豆包大模型流式语音识别 X-Api-Key（新版控制台单 header 鉴权）。X-Api-Key 必须通过 Electron 官方 safeStorage（OS Keychain / DPAPI / libsecret）加密后写入 userData 下的专用 JSON，永远不进 renderer / IPC payload / 日志 / 错误信封 / 内容文件；renderer 只能通过 5 个新增的 application-scoped IPC channel 读到不含密文的状态投影（enabled / apiKeyConfigured / apiKeyLastFour / lastValidatedAt / lastValidationOk / lastValidationCode），TanStack Query key 为 `['settings','voice']`，`setEnabled` / `saveApiKey` / `clear` 成功后用 response snapshot seed 该 key，`validate` 成功后 invalidate 该 key。保存时 main process 先写 safeStorage 后立即跑一次最小 WebSocket probe（1 秒 timeout、不发音频、发送 full request 后等待服务响应），区分 ok / auth / network 三种 code 写回 store 并通过同一 response 原子返回。设置是 application-scoped，不绑定单个 workspace；录音中 sidebar 齿轮 disabled 并通过 root toast 阻止进入 settings；非录音时进入 settings 保留 workspace handle / session / lock，「返回应用」后 stage 状态完全恢复。底层 ASR 协议必须从旧版 X-Api-App-Key + X-Api-Access-Key 双 header 完全切换到新版 X-Api-Key 单 header，连同 `doubaoStreamingAsr.ts` 的 `DoubaoAsrAuthInput / DoubaoStreamingAsrSessionInput / redactSecrets` 和 `recordingTranscriptionSessions.ts` 的 `DoubaoCredentials / resolveDefaultDoubaoCredentials / redactCredentialText` 全部改造；`.env.local` 中 `REO_DOUBAO_ASR_APP_ID / REO_DOUBAO_ASR_ACCESS_TOKEN` 在代码侧的所有读取路径必须删除，按 CLAUDE.md 未发布不保留兼容性垫片硬约束不留 fallback。录音 start IPC 在 toggle disabled 时返回 `{ accepted: true, transcriptionMode: 'disabled' }`（不算错误，整条 transcript 链路安静关闭），在 toggle enabled 但 key 缺失时返回 `ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE` 引导用户去设置，在 toggle enabled 且 key 存在时进入现有 live session 路径（保留 5 秒 PCM buffer 自动重连）；live session 一旦 start 完成就用其 settings 快照走完整 session，不响应中途的设置变更。`docs/current/electron.md` 关于豆包 App ID / Access Token 段落与 IPC channel 列表、`docs/current/frontend.md` 关于 sidebar 入口、shadcn/ui source 范围、录音 navigation gate 与 Settings Shell、`docs/current/data.md` 关于 query keys 与 settings ownership 的段落必须同批更新。本次 spec 末尾完整列出 B（未转录状态可视化）、C（网络/凭证恢复后的自动轮询补转录）、D（转录 More 菜单 + 手动重新生成）、E（`bigmodel_async` vs `bigmodel` endpoint 校正）四项 follow-up，并明确写「A 收口后必须为每一项独立走完整 brainstorm → spec → plan → 实现 → 验证流程，禁止合并」。验收口径是 `npm run verify:quick` 全绿，加 grep 验证 `REO_DOUBAO_ASR_APP_ID / REO_DOUBAO_ASR_ACCESS_TOKEN / X-Api-App-Key / X-Api-Access-Key` 在 src 下零结果，加 Dev 内手动覆盖 9 个状态的全部转换以及三种主线录音行为，验证证据按 `docs/current/quality.md` 要求写入 `verification.md` 与 `artifacts/`。

## 范围外（follow-up）

A 收口后必须为下列每一项独立走完整 brainstorm → spec → plan → 实现 → 验证流程，**禁止合并**：

| ID  | 名称                                  | 一句话目标                                                                                                                                    | 依赖                                                                                                       |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| B   | 未转录状态可视化                      | finalized audio segment / supplement 在 Memory Studio 标记「待转录」+ 录音 overlay 在 toggle disabled 时显示「语音转录已停用」占位            | 依赖 A 提供的 `transcriptionMode` 字段与 `transcript.exists` 派生字段                                      |
| C   | 网络 / 凭证恢复后自动轮询补转录       | 应用启动 / 网络恢复 / 凭证保存成功后，扫描未转录 finalized audio，逐个走异步转录                                                              | 依赖 A 的 voice settings store，B 的「待转录」集合，以及一条新的离线转录引擎（endpoint 需在 C/E 独立核对） |
| D   | 转录 tab More 菜单 + 手动重新生成转录 | 在 Segment / Supplement 的 transcript surface 加入 More 下拉，提供「重新生成转录」动作；同一引擎服务 C 的自动路径                             | 依赖 C 的离线转录引擎                                                                                      |
| E   | Endpoint 校正                         | 独立核对 `bigmodel_async` 与 `bigmodel` 在当前火山引擎控制台和计费资源下的实际语义、成本与稳定性；如有必要再调整流式实时或离线批处理 endpoint | 独立技术调研，可与 C 合并启动                                                                              |

每一项必须在 `docs/specs/` 当前空闲、本次 A 已归档之后才能开新 spec，遵守 CLAUDE.md 「同一时间只推进一个可验证基础工作单元」约束。
