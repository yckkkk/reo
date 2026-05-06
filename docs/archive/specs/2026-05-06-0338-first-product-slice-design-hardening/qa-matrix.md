# QA 矩阵

## 测试层级

| 层级                  | 工具                       | 范围                                                                        |
| --------------------- | -------------------------- | --------------------------------------------------------------------------- |
| Main 纯文件测试       | Node test runner           | path containment、metadata schemas、filesystem transactions、lock semantics |
| Renderer 行为测试     | Vitest + Testing Library   | forms、workspace home、overlay、autosave、accessibility                     |
| IPC/preload 契约测试  | Node/Vitest 视实现而定     | exposed methods、channel mapping、sender validation、DTO parse              |
| Electron runtime 检查 | `npm start` + Computer Use | production URL、CSP、permissions、navigation、mic、playback                 |
| 手动操作验证          | Computer Use               | OS dialog、recording、playback、save failure、viewport/reference            |
| Codex 只读验证        | Codex CLI                  | workspace `AGENTS.md` 和普通文件可读；hash 不变                             |

## TDD 切片

| 切片输入                          | RED                                                                                                                 | GREEN                              | REFACTOR 验证                           | 提交 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------- | ---- |
| IMPL-001 Renderer test foundation | `test:renderer` missing / App missing                                                                               | Vitest config + App extraction     | `npm run verify:quick`                  | 是   |
| IMPL-002 Preload/IPCs/Zod         | sender/permission/bridge tests fail                                                                                 | chooseDirectory channel            | `verify:quick`、build                   | 是   |
| IMPL-003 Workspace files/drafts   | conflict/path/draft tests fail                                                                                      | workspace and draft filesystem     | `verify:quick`、build                   | 是   |
| IMPL-004 Query/form               | query/form tests fail                                                                                               | RHF/Zod + TanStack Query wrapper   | `verify:quick`、viewport evidence       | 是   |
| IMPL-005 Workspace home           | UI/absence tests fail                                                                                               | home UI + shadcn primitives        | `verify:quick`、viewport evidence       | 是   |
| IMPL-006 Recording overlay        | machine/adapter/overlay/CSP tests fail                                                                              | MediaRecorder、overlay、autosave   | `verify:quick`、build、operation checks | 是   |
| IMPL-007 Runtime validation       | 不作为行为实现 TDD slice；如果 runtime/manual checks 暴露缺陷，先写可复现 failing test 或记录可复现操作失败，再修复 | 修复实际缺陷或记录 validation pass | all checks + Codex read-only            | 是   |

IMPL-007 是验收验证 slice，不把“检查通过”伪装成 RED。只有发现缺陷并修改行为时，才进入 RED -> GREEN -> REFACTOR；纯验证只记录操作证据、hash 证据和命令输出。

## 回归矩阵

| 风险                               | 测试                                             |
| ---------------------------------- | ------------------------------------------------ |
| Renderer 直接导入 Node             | ESLint/source test for forbidden imports         |
| Generic IPC bridge                 | preload exposed key snapshot                     |
| Existing `AGENTS.md` 被覆盖        | conflict fixture 检查 file hash unchanged        |
| Path traversal                     | malicious recordingId/rootPath fixtures          |
| Autosave failure 丢失文本          | chmod-induced failure 保持 UI draft 和 disk hash |
| duplicate stop 过早 finalize       | append in-flight race test                       |
| pause 时 transcript 继续推进       | recording machine + fake timers                  |
| Blob URL 泄漏                      | overlay close/switch 时 revoke test              |
| DB 变成内容真源                    | first slice 无 SQLite files/tables               |
| UI 显示未来能力                    | film/photo/video/file absence tests              |
| retokenization 移除 keyboard focus | user-event tab tests                             |

## 必须使用 Computer Use 的操作验证

- 通过 OS dialog 完成 folder choose/cancel/create。
- 麦克风权限和录音。
- finalized audio playback。
- 通过 filesystem permission change 制造 save failure。
- Electron runtime 拒绝非 audio permission。
- overlay 和 workspace home 的 visual/reference checks。
- wide、narrow 和 `900 x 620` viewport checks。

## Codex CLI 只读验证

预期命令形态：

```bash
find "$WORKSPACE_DIR" -type f \
  ! -path "$WORKSPACE_DIR/.reo/workspace.lock*" \
  ! -name "*.tmp" \
  -exec shasum {} + | sort > /tmp/reo-before-codex.sha
codex exec --sandbox read-only --cd "$WORKSPACE_DIR" --skip-git-repo-check --ephemeral "Read AGENTS.md and summarize what this memory workspace contains. Do not modify files."
find "$WORKSPACE_DIR" -type f \
  ! -path "$WORKSPACE_DIR/.reo/workspace.lock*" \
  ! -name "*.tmp" \
  -exec shasum {} + | sort > /tmp/reo-after-codex.sha
diff -u /tmp/reo-before-codex.sha /tmp/reo-after-codex.sha
```

通过标准：

- Codex 能读取 workspace `AGENTS.md`。
- Codex 能识别 `recordings/<id>/audio.webm`、`transcript.md`、`reflections.md`、`recording.json`。
- Reo 处于 quiescent 状态，或已关闭该 workspace。
- hash 范围排除 volatile lock artifact 和 temp files；用户内容与稳定 metadata hash 不变。

## 参考验证

| UI 区域            | 参考                                                               | 证据                                      |
| ------------------ | ------------------------------------------------------------------ | ----------------------------------------- |
| Workspace home     | `ref1-*`、`ref2-*`、`reference-contact.jpg`                        | 在 `reference-map.md` 中记录采用/拒绝结构 |
| Recording overlay  | `Drawer with ElevenLabs audio component.mp4`、`drawer-contact.jpg` | bottom sheet、waveform、transcript stack  |
| Micro-interactions | `2参考micro interactions..mp4`                                     | hover、active、overlay transition notes   |

## 审查退出条件

不得进入 `$writing-plans`，直到：

- `review.md` 说明没有 unresolved BLOCKER/MAJOR。
- 外部 reviewer finding 已修复，或明确降级为 MINOR/deferred 并说明理由。
- `verification.md` 记录当前快照的新鲜命令结果。
