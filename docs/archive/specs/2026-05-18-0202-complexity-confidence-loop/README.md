# 复杂度收敛循环

时间：2026-05-18 02:02 America/Los_Angeles

## Objective

按优先级修复当前 `$complexity-optimizer` 复审发现的全部复杂度、性能和验证效率问题，并通过验证、subagent 复审和最终自信审查闭环。

## 范围

- Main process 文件真源扫描、finalized audio 补转录和 transcript save 热路径。
- Renderer transcript merge、Memory Studio、App visibility refresh、录音暂停预览、renderer test 分层。
- 验证脚本、测量脚本、format check 和 main test 批处理。
- `docs/current/*` 中与当前行为、数据流、流程、前端和质量规则相关的当前事实。

## 非范围

- 新增 DB、auth、packaging、updater、telemetry 或 runtime surface。
- 新增兼容层、generic runtime、Zustand store 或长期未使用抽象。
- 改变用户语义文件合同。

## 成功标准

- P1-P4 已知问题全部完成。
- 行为改动遵守 RED、GREEN、REFACTOR。
- `npm run verify:quick` 通过。
- 修复后使用多个 subagent 再次运行 `$complexity-optimizer`，新增发现进入同一循环。
- 最终自问“我对当前实现是否有事实上的 100% 信心”；若不是，继续修复直到当前证据下没有已知漏洞。

## 文档门禁

- 触碰文件真源、background queue、cache owner、UI state、测试门禁或验证命令时，同批更新对应 current 真源。
- active docs 只写当前事实、规则和计划，不写历史来源解释。

## 当前证据

- `npm run test:main -- --test-name-pattern="transcript merge"`：通过。
- `npm run test:main -- --test-name-pattern="backfill audio data source"`：通过。
- `npm run test:main -- --test-name-pattern="file descriptors to the remux"`：通过。
- `npm run test:main -- --test-name-pattern="scanWorkspaceBackfillTargets|backfill scanner"`：通过。
- `npx vitest run src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "large Segment strips"`：通过。
- `npm run test:main -- --test-name-pattern="duplicate segment validation"`：通过。
- `npm run test:main -- --test-name-pattern="segment supplement transcript save|saveSegmentSupplementTranscript|transcript save marks"`：通过。
- `npx vitest run src/renderer/src/workspace/audioWaveform.test.ts src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "AudioContext|audio resource|large Segment strips"`：通过。
- `npm run test:main -- --test-name-pattern="verify:quick uses the quick typecheck|quick format check|main test runner uses"`：先 RED 后通过。
- `npx vitest run --project renderer-jsdom-browser src/renderer/src/workspace/audioWaveform.test.ts src/renderer/src/workspace/workspaceApi.test.ts`：通过。
- `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "does not double subtract|does not let a stale pending refresh detail|keeps non-target Memory detail refreshable"`：通过。
- `npm run test:main -- --test-name-pattern="memory studio layout measurement|titlebar measurement|main test runner|quick format|verify:quick uses|vitest separates"`：通过。
- `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx -t "paused draft playback|invalidates a stale paused playback URL|updates the paused cursor"`：通过。
- `npm run verify:quick`：通过；包含 typecheck、main 704 tests、renderer 424 tests、lint、format check。
- 多 subagent `$complexity-optimizer` 复审：main、renderer、tooling、docs 四路完成；新增 P1-P4 已进入本 spec 执行清单。
- `npm run test:main -- --test-name-pattern="duplicate segment validation|quick format check|main test runner uses|vitest separates|scanWorkspaceBackfillTargets applies|scanWorkspaceBackfillTargets skips"`：通过。
- `npx vitest run --project renderer-node src/renderer/src/workspace/recording/recordingTimeline.test.ts`：通过。
- `npx vitest run --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "coalesces overlapping external file refreshes"`：通过。
- `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "builds the playback waveform|releases cached SegmentSupplement audio resources"`：通过。
- `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx`：通过。
- `npm run typecheck:quick`：通过。
- `npm run test:main -- --test-name-pattern="backfill audio data source aborts conversion|file descriptors to the remux|backfill audio data source resolves abort"`：通过。
- `npm run verify:quick`：通过；包含 typecheck、main 704 tests、renderer 425 tests、lint、format check。
- 第二轮 subagent `$complexity-optimizer` 复审：tooling/docs 无新增；main 和 renderer 新增 P2-P4 已进入本 spec 执行清单。
- `npm run test:main -- --test-name-pattern="workspace index snapshot|finalized supplement audio reads reject|backfill audio data source remuxes from an existing file descriptor|backfill audio data source aborts conversion|transcript merge returns a fresh"`：通过。
- `npx vitest run --project renderer-node src/renderer/src/workspace/recording/recordingTimeline.test.ts`：通过。
- `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx -t "refreshes combined hidden transcript text|windows long transcript"`：通过。
- `npm run typecheck:quick`：通过。
- `npm run verify:quick`：通过；包含 typecheck、main 707 tests、renderer 426 tests、lint、format check。
- 第三轮 subagent `$complexity-optimizer` 复审：main、renderer、tooling/docs 三路完成；新增 P1-P4 已进入本 spec 执行清单。
- `npm run test:main -- --test-name-pattern="quick format check|main test runner"`：先 RED 后通过。
- `npm run test:main -- --test-name-pattern="scanWorkspaceBackfillTargets refreshes file truth|backfill audio data source remuxes from an existing file descriptor"`：通过。
- `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx -t "windows long transcript|refreshes combined hidden"`：通过。
- `npm run typecheck:quick`：通过。
- `npm run lint -- --no-warn-ignored`：通过。
- `npm run format:check`：通过。
- `npm run verify:quick`：通过；包含 typecheck、main 710 tests、renderer 426 tests、lint、format check。
- 第四轮 subagent `$complexity-optimizer` 复审：tooling/docs 无新增；main 和 renderer 新增 P2/P4 已进入本 spec 执行清单。
- `npx vitest run --project renderer-node src/renderer/src/appProjection.test.ts -t "moves an existing memory down"`：先 RED 后通过。
- `npx vitest run --project renderer-node src/renderer/src/appProjection.test.ts`：通过。
- `npx vitest run --project renderer-jsdom-components src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx -t "windows long transcript|refreshes combined hidden"`：通过。
- `npm run test:main -- --test-name-pattern="backfill audio data source aborts an active fd pump|backfill audio data source remuxes from an existing file descriptor"`：通过。
- `npm run verify:quick`：通过；包含 typecheck、main 711 tests、renderer 428 tests、lint、format check。
- 第五轮 subagent `$complexity-optimizer` 复审：main、renderer、tooling/docs 新增 low/P2-P4 已进入本 spec 执行清单。
- `npm run test:main -- --test-name-pattern="backfill audio data source aborts an active fd pump|backfill audio data source remuxes from an existing file descriptor|scanWorkspaceBackfillTargets normalizes|scanWorkspaceBackfillTargets applies|backfill scanner normalizes|backfill scanner can add"`：通过。
- `npm run test:renderer -- --project renderer-node src/renderer/src/appProjection.test.ts`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/recording/RecordingTranscriptPreview.test.tsx -t "windows long transcript|off-window"`：通过，且不再输出 Node localStorage warning。
- `npm run test:main -- --test-name-pattern="verify:quick uses the quick typecheck"`：通过。
- `npm run typecheck:quick && npm run lint -- --no-warn-ignored && npm run format:check`：通过。
- `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/recordingRecovery.test.ts -t "does not rewrite transcript sidecar"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx -t "does not rewrite the recovery marker"`：通过。
- `npm run verify:quick`：通过；包含 typecheck、main 715 tests、renderer 429 tests、lint、format check，且无 Node localStorage warning。
- 第六轮 subagent `$complexity-optimizer` 复审：main、renderer、tooling/docs 三路完成；新增 P1-P4 已进入本 spec 执行清单。
- `npm run test:main -- --test-name-pattern="backfill audio data source|regenerate transcript save does not mark success|regenerate segment rollback|regenerate supplement rollback|transcript save marks"`：通过。
- `npx tsc -p tsconfig.main.test.json --noEmit`：通过。
- `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/audioWaveform.test.ts`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx -t "renders the active recording state|pauses and resumes the timer|automatically pauses"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "optimistically hides|keeps external summary|keeps non-target|double subtract|stale pending refresh"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "large Segment strips|oversized finalized audio"`：通过。
- `npm run test:main -- --test-name-pattern="workspace memory space registry|verify:quick uses|memory studio layout measurement|renderer test runner|backfill audio data source resolves abort"`：通过。
- `npm run lint:strict`：通过。
- 第七轮 subagent `$complexity-optimizer` 复审：main、renderer、tooling/docs 三路完成；新增 P1-P4 已进入本 spec 执行清单。
- `npm run verify:quick`：失败于 quick format check，唯一格式项为既有 tracked 文档 `docs/initiatives/2026-05-14-commercial-infrastructure-foundation/competitive-analysis.md`。
- `npm run test:main -- --test-name-pattern="supplement finalize|recovery clears finalized supplement markers"`：先 RED 后通过。
- `MAIN_TEST_FILES=test/main/packageScripts.test.ts,test/main/workspaceMemorySpaceRegistry.test.ts,test/main/backfillQueue.test.ts,test/main/memoryFiles.test.ts npm run test:main -- --test-name-pattern="main test runner|memory studio layout measurement|workspace memory space registry|backfill queue|supplement finalize|recovery clears finalized supplement markers"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/audioWaveform.test.ts`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "builds the playback waveform|does not decode oversized finalized audio"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx -t "paused state|renders the active recording state|automatically pauses"`：通过。
- `npx tsc -b`：通过。
- `npm run lint:strict`：通过。
- `npm run format:check`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx --reporter verbose`：通过，91 tests；用于确认默认 reporter 长时间无输出不是挂起。
- `npm run verify:quick`：通过；包含 typecheck、main 727 tests、renderer 433 tests、lint、format check。
- `npm run verify:quick`：通过；包含 typecheck、main 722 tests、renderer 432 tests、lint、format check。
- `npm run verify:quick`：通过；包含 typecheck、main 721 tests、renderer 431 tests、lint、format check。
- 第八轮 subagent `$complexity-optimizer` 复审：renderer、tooling/docs 和 main/file-truth 已返回；新增发现已进入同一 spec 执行清单并完成当前修复。
- `MAIN_TEST_FILES=test/main/packageScripts.test.ts npm run test:main -- --test-name-pattern="main test runner|renderer test runner|memory studio layout measurement"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/audioWaveform.test.ts`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "builds the playback waveform|does not decode oversized finalized audio|releases cached SegmentSupplement audio resources"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx -t "paused state|renders the active recording state|automatically pauses"`：通过。
- `npx tsc -b`：通过。
- `npm run lint:strict`：通过。
- `npm run format:check`：通过。
- `MAIN_TEST_FILES=test/main/recordingDrafts.test.ts,test/main/workspaceMemorySpaceRegistry.test.ts,test/main/backfillRuntime.test.ts npm run test:main -- --test-name-pattern="fill-missing rollback|workspace memory space registry|duplicate validation|revalidates automatic targets"`：通过。
- `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts,test/main/recordingDrafts.test.ts,test/main/workspaceMemorySpaceRegistry.test.ts npm run test:main -- --test-name-pattern="backfill runtime|transcript save|regenerate transcript|fill-missing rollback|workspace memory space registry"`：通过。
- `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts npm run test:main -- --test-name-pattern="scanWorkspaceBackfillTargets|automatic workspace|backfill runtime scans"`：通过。
- `npx tsc -b`：通过。
- `npm run verify:quick`：通过；包含 typecheck、main 724 tests、renderer 432 tests、lint、format check。
- 第九轮 subagent `$complexity-optimizer` 复审：main/file-truth、renderer、tooling/docs 三路完成；新增 P2-P4 已进入本 spec 执行清单并完成当前修复。
- `MAIN_TEST_FILES=test/main/packageScripts.test.ts,test/main/backfillRuntime.test.ts,test/main/recordingDrafts.test.ts,test/main/workspaceMemorySpaceRegistry.test.ts npm run test:main -- --test-name-pattern="quick format|main test runner|measurement scripts|vitest assigns|scanWorkspaceBackfillTargets|automatic workspace|backfill runtime still reads|fill-missing rollback|workspace memory space registry"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-browser src/renderer/src/workspace/audioWaveform.test.ts`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "requests segment transcription backfill"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "builds the playback waveform|serializes playback waveform decodes|does not decode oversized finalized audio|releases cached SegmentSupplement audio resources"`：通过。
- `npx tsc -b`：通过。
- `npm run lint:strict`：通过。
- `npm run format:check`：通过。
- 第十轮 subagent `$complexity-optimizer` 复审：main/file-truth、renderer、tooling/docs 三路完成；新增 P2-P4 已进入本 spec 执行清单并完成当前修复。
- `npx tsc -b`：通过。
- `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts,test/main/recordingDrafts.test.ts,test/main/workspaceMemorySpaceRegistry.test.ts,test/main/packageScripts.test.ts npm run test:main -- --test-name-pattern="scanWorkspaceBackfillTargets|backfill runtime still reads|duplicate segment validation scans|workspace memory space registry|vitest assigns|vitest separates|quick format|main test runner|measurement scripts|memory studio Segment strip"`：先暴露 selector cap 停止条件缺陷，修复后通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx -t "throttles full transcript recovery|renders the active recording state|paused state"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "serializes playback waveform decodes|serializes supplement waveform decodes|does not decode oversized finalized audio|releases cached SegmentSupplement"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "ignores an in-flight segment transcription backfill response"`：通过。
- `rg -n "duplicateSegmentDirectoryChecked|readWorkspaceMemoryDetailsFromFileTruth" src test`：无匹配。
- `npm run test:renderer -- --project renderer-node`：通过，7 files，27 tests。
- `npm run test:renderer -- --project renderer-jsdom-browser`：通过，6 files，39 tests。
- `npm run test:renderer -- --project renderer-jsdom-components --reporter verbose`：通过，29 files，369 tests。
- `npm run verify:quick`：通过；包含 typecheck、main 731 tests、renderer 435 tests、lint、format check。
- 第十一轮 subagent `$complexity-optimizer` 复审：main/file-truth、renderer、tooling/docs 三路完成；新增 P1-P4 已进入本 spec 执行清单并完成当前修复。
- `npm run complexity:scan -- --max-findings 20`：通过；wrapper 不再扫描 `.tmp`、`.agents`、`.claude`、`out` 和归档目录；当前 raw leads 集中在本地脚本和视觉测量脚本。
- `npx tsc -b`：通过。
- `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts,test/main/localEnv.test.ts npm run test:main -- --test-name-pattern="scanWorkspaceBackfillTargets|local env"`：通过。
- `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts,test/main/recordingDrafts.test.ts,test/main/packageScripts.test.ts,test/main/localEnv.test.ts npm run test:main -- --test-name-pattern="scanWorkspaceBackfillTargets|duplicate preflight|duplicate segment validation scans|complexity scanner|verify:quick|vitest assigns|vitest separates|memory studio layout measurement|local env"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx -t "flushes pending live transcript|throttles full transcript recovery"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/LoadedWorkspaceFrame.test.tsx -t "supplement playback fails|shows finalized recording supplements|serializes supplement waveform|supports continuous waveform|announces playback"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "ignores an in-flight supplement|ignores an in-flight segment|keeps external summary|keeps non-target|delayed Segment delete"`：通过。
- `npm run verify:quick`：通过；包含 typecheck、main 734 tests、renderer 438 tests、lint、format check。
- 第十二轮 subagent `$complexity-optimizer` 复审：tooling/docs 和 renderer 返回 FAIL，main 返回 PASS 但有 P3/P4；新增项已进入本 spec 执行清单并完成当前修复。
- `npx tsc -b`：通过。
- `MAIN_TEST_FILES=test/main/packageScripts.test.ts,test/main/backfillRuntime.test.ts npm run test:main -- --test-name-pattern="complexity scanner|vitest assigns|scanWorkspaceBackfillTargets"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "recovered recording finalize response|offers to save a recoverable unfinished recording|recovered SegmentSupplement"`：通过。
- `npm run complexity:scan -- --max-findings 10`：通过；raw leads 仍集中在 agent-local scripts 和视觉测量脚本，未命中 `out`、`.tmp`、`.agents`、`.claude` 或归档目录。
- `npm run verify:quick`：通过；包含 typecheck、main 736 tests、renderer 439 tests、lint、format check。
- 第十三轮 subagent `$complexity-optimizer` 复审：tooling/docs 和 main 返回 PASS 但有 P3/P4；renderer 返回 FAIL；新增项已进入本 spec 执行清单并完成当前修复。
- `npx tsc -b`：通过。
- `MAIN_TEST_FILES=test/main/packageScripts.test.ts,test/main/backfillRuntime.test.ts,test/main/workspaceMemorySpaceRegistry.test.ts npm run test:main -- --test-name-pattern="complexity scanner|scanWorkspaceBackfillTargets|workspace memory space registry Finder rename"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "stale recovered transcript save failures|stale recovered recording discard responses|recovered recording finalize response|recoverable unfinished recording"`：通过。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx -t "stale SegmentSupplement transcript save"`：通过。
- `npm run verify:quick`：失败；唯一失败为 `App.test.tsx` 的 `projects a finalized FAB recording into the active Memory detail and focuses the new Segment` 在 full suite 中超过局部 10s timeout。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "projects a finalized FAB recording into the active Memory detail and focuses the new Segment"`：通过；单测耗时约 7.7s，确认行为成立且 timeout 预算过紧。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx -t "projects a finalized FAB recording into the active Memory detail and focuses the new Segment"`：timeout 调整后通过。
- `npm run verify:quick`：通过；包含 typecheck quick、main 739 tests、renderer 442 tests、lint strict 和 format check。
- `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx --testNamePattern "stale SegmentSupplement transcript|live transcription batches|flushes pending live transcript|backfills transcription|streams PCM" --reporter=verbose`：通过，9 tests。
- `npm run verify:quick`：通过；包含 typecheck quick、main 742 tests、renderer 445 tests、lint strict 和 format check。
- 最终三路 subagent `$complexity-optimizer` 复审：main/file-truth 与 renderer 无 P0/P1 must-fix；tooling/docs 仅发现 initiative checklist 状态漂移，已修复。
- `npm run complexity:scan`：通过；raw leads 仍集中在 bounded local tooling、视觉测量脚本和已审查 runtime 线索，未形成新增 must-fix。
- 最终自信审查：当前证据下没有已知未处理漏洞。
