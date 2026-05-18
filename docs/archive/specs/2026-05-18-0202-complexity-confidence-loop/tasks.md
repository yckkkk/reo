# 执行清单

## P1

- [x] Backfill scanner: RED 证明 automatic scan 不重复 read detail；GREEN 单 pass；REFACTOR focused test。
- [x] Backfill audio: RED 证明 remux 不需要读取完整 finalized audio Buffer；GREEN 使用文件描述符输入；REFACTOR focused test。
- [x] Transcript merge: RED 证明批量 incoming 只做一次归并并保持排序/覆盖语义；GREEN 批量 merge；REFACTOR focused test。
- [x] Memory Studio strip: RED 证明大量 Segment 只挂载窗口内交互树；GREEN windowing；REFACTOR renderer focused test。

## P2

- [x] Finalized audio duplicate validation: 每次 public read/backfill source 重新校验 duplicate finalized segment id；focused test。
- [x] SegmentSupplement transcript save: 复用同次 parent projection；GREEN helper；REFACTOR focused test。
- [x] Audio resource cache: Segment 和 SegmentSupplement resource cache 复用 Blob URL/waveform，AudioContext decoder lifecycle 复用；REFACTOR renderer focused test。
- [x] Typecheck/test main: RED 度量脚本命令边界；GREEN quick typecheck 和 main test 参数转发/默认 batch；REFACTOR focused command。
- [x] Vitest split: browser API jsdom 与 component jsdom 拆分；REFACTOR renderer focused command。

## P3

- [x] Transcript preview DOM。
- [x] App visibility refresh。
- [x] App.test 拆分。
- [x] Memory Studio measure 默认采样。
- [x] Paused preview chunk byte cache。

## P4

- [x] Main test 默认 batch。
- [x] Titlebar pixel scan。
- [x] RecordingOverlay test wait helpers。
- [x] Format check active scope。

## 复审新增发现

- [x] P1：finalized Segment audio read 不跨调用跳过 duplicate check。
- [x] P2：queued visibility refresh 使用当前 session snapshot 比较。
- [x] P2：automatic backfill scan 使用 snapshot summary + top-N detail read，不走全 workspace detail 预读。
- [x] P2：manual/automatic target recheck 的 Segment 路径只读取目标 Segment eligibility 投影。
- [x] P2：tooling guard 覆盖 active specs、镜像入口文档、Vitest `.test.ts` 归属和 main test batch env。
- [x] P3：SegmentSupplement finalized projection 复用已定位目录。
- [x] P3：fd remux settle 销毁输入 stream。
- [x] P3：recording timeline 批量 transcript result 单次 merge。
- [x] P3：Memory Studio Segment 切换不关闭 shared waveform decoder。
- [x] P3：initiative tasks 不复制 spec 执行清单。
- [x] P4：transcript preview 预计算 cumulative text，focus window 切换不重复 join 全文。
- [x] P4：Segment strip window 使用 DOM item 宽度和 gap 估算。
- [x] P4：Memory Studio layout measure 退出时总是重置 scroll/resize。
- [x] P4：README、product、quality/current 文档同步当前事实。
- [x] 第二轮 P2：automatic backfill scan 使用 summary + top-N detail read，避免全 workspace detail 预读。
- [x] 第二轮 P2：fd remux 改为显式 fd chunk pump，settle 不关闭外部 fd。
- [x] 第二轮 P3：SegmentSupplement read/backfill 复核 parent Segment duplicate。
- [x] 第二轮 P3：长 transcript cumulative text 按完整 segments 更新。
- [x] 第二轮 P4：recording timeline batch maxEnd 不使用 spread/map 分配。
- [x] 第二轮 P4：空 incoming transcript merge 返回新数组。
- [x] 第二轮 P4：删除 automatic enqueue 重复 current/generation 判断。
- [x] 第三轮 P1：automatic backfill 候选 summary 从文件真源刷新，避免 stale index 永久漏扫。
- [x] 第三轮 P3：fd remux 测试断言 ffmpeg stdin 收到源 fd 字节。
- [x] 第三轮 P3：quick format check 对缺失 active `docs/specs` 路径容错。
- [x] 第三轮 P4：Vitest config 纳入 typecheck/lint 静态门禁。
- [x] 第三轮 P4：main test runner helper 可导入并增加行为测试。
- [x] 第三轮 P4：长 transcript 先计算窗口再拼 hidden text，不生成全量 cumulative prefix。
- [x] 第四轮 P2：projection upsert 替换现有项时按 `updatedAt/createdAt` 重新定位。
- [x] 第四轮 P4：长 transcript hidden-before/after 测试断言完整隐藏范围。
- [x] 第四轮 P4：fd 输入路径 abort 时覆盖 active pump、stdin teardown 和临时目录清理。
- [x] 第五轮 P2：fd abort 立即取消 active pump，不等待 ffmpeg close。
- [x] 第五轮 P3：manual fill-missing 文档改为目标级 eligibility projection。
- [x] 第五轮 P4：automatic scanner limit 统一归一化并覆盖 fractional/NaN。
- [x] 第五轮 P4：单 Memory eligible target 直接加入 bounded selector，不先全量排序。
- [x] 第五轮 P4：projection `createdAt` tie-break 重定位测试。
- [x] 第五轮 P4：长 transcript 不渲染窗口外全文，只保留常量窗口和省略标记。
- [x] 第五轮 P4：renderer 测试配置 Node localStorage backing file，消除 warning 噪音。
- [x] 第六轮 P1：regenerate transcript save 提交顺序改为 transcript、index refresh、manifest success 全部成功后才推进 attempt。
- [x] 第六轮 P1：fd remux pump 使用已验证 byte length 上限，并覆盖 abort race。
- [x] 第六轮 P2：workspace snapshot rebuild 在每个 Memory 迭代检查 lock usability。
- [x] 第六轮 P2：App workspace refresh effect 去除 session object churn 依赖。
- [x] 第六轮 P2：Memory Studio 超大音频不进入 AudioContext waveform decode。
- [x] 第六轮 P2：RecordingOverlay 40ms clock 不驱动整棵 overlay 重渲染。
- [x] 第六轮 P3：Segment/Supplement read path 复用已定位目录。
- [x] 第六轮 P3：backfill selector 支持 peek oldest，scan loop 不重复物化排序数组。
- [x] 第六轮 P3：Segment strip 使用真实窗口 item 和 spacer。
- [x] 第六轮 P3：live waveform sample 使用 mutable bounded buffer 并节流 state publish。
- [x] 第六轮 P3：transcript preview focus index 使用二分查找。
- [x] 第六轮 P4：SegmentSupplement presence 使用 Set membership。
- [x] 第六轮 P4：Memory Studio layout measure 默认采样覆盖首项、尾项、选中项和 viewport 可见项。
- [x] 第六轮 P4：Memory space registry rename scan 规则显式化。
- [x] 第六轮 P4：`verify:quick` 使用 `lint:strict`。
- [x] 第六轮 P4：renderer test runner 只过滤已知 Node localStorage warning，遇到其它 ExperimentalWarning 失败。
- [x] 第七轮 P1：SegmentSupplement finalize marker 保留到 manifest、Memory mirror、index refresh、draft cleanup 和 draft parent fsync 后再清除。
- [x] 第七轮 P2：Memory space registry Finder rename recovery 限制为 200 个安全 sibling directory metadata probe。
- [x] 第七轮 P2：finalized audio waveform decode 延迟到稳定 selection 后启动，切走前不启动旧 resource decode。
- [x] 第七轮 P3：main test runner 支持 `MAIN_TEST_FILES` 文件级过滤。
- [x] 第七轮 P3：Memory Studio layout measure 不为默认样本读取全部 mounted item rect。
- [x] 第七轮 P3：RecordingOverlay PCM tail retention 原地裁剪过期 chunk。
- [x] 第七轮 P3：paused draft playback cache 命中前不物化 chunk BlobPart 数组。
- [x] 第七轮 P4：audio waveform peak extraction 缓存 channel data 并原地归一化。
- [x] 第七轮 P4：BackfillQueue terminal result LRU 使用 insertion-ordered `Set`。
- [x] 第八轮 P2：Memory Studio 同一实体新 audio resource 收敛旧 Blob URL，decode completion 只写当前 resource。
- [x] 第八轮 P3：RecordingOverlay PCM tail retention 使用 head index，避免每个 overflow chunk 搬移数组。
- [x] 第八轮 P3：Memory Studio Segment selection 单 pass 解析 selected segment/index，scroll sync 使用 RAF 合并。
- [x] 第八轮 P3：`MAIN_TEST_FILES` 对未匹配文件失败而不是静默少跑。
- [x] 第八轮 P4：layout sampling 使用 mounted item offset 边界选择可见候选。
- [x] 第八轮 P4：renderer warning runner 抽出行分类并做行为测试。
- [x] 第八轮 P4：waveform decode 始终复制独立 ArrayBuffer，避免 AudioContext detach cache-owned bytes。
- [x] 第八轮 P4：App 传入 Memory Studio 的 transcriptionBackfill prop 用 `useMemo` 收敛。
- [x] 第八轮 main P2：transcript save 在 index 已刷新后 manifest success 失败时，回滚 transcript 并再次刷新所属 Memory index。
- [x] 第八轮 main P3：memory space registry Finder rename recovery 改为 streaming sibling directory scan，并保留 200 个安全 sibling directory 上限。
- [x] 第八轮 main P3：backfill fill-missing audio source read 保持目标读取前复核 duplicate validation，不复用旧窗口结论。
- [x] 第八轮 main P3：automatic backfill 默认 scanner 使用文件真源 snapshot summary 和 bounded candidate detail read，避免全 workspace detail 预读。
- [x] 第九轮 P2：`format:check` 只对 optional active specs 使用 unmatched pattern 容错，必需路径保持严格。
- [x] 第九轮 P3：`scripts/run-main-tests.mjs` 删除重复最终排序，保留递归发现的稳定排序。
- [x] 第九轮 P3：测量脚本 option parser 对缺失值和 flag-as-value 立即失败。
- [x] 第九轮 P3：App 手动转录补全用 ref guard 阻止同 tick 重复 IPC，同时补齐 success handler 依赖避免 stale closure。
- [x] 第九轮 P3：Segment strip scroll hot path 使用缓存 item step，resize/observer 时刷新。
- [x] 第九轮 P3：Segment 和 SegmentSupplement playback waveform decode 按 player 串行，旧 generation 不再启动或落地。
- [x] 第九轮 P4：recording draft rollback test 覆盖 index refresh 后 manifest success 失败的投影收敛。
- [x] 第九轮 P4：memory space registry scan cap test 同时覆盖 cap 内可恢复路径。
- [x] 第十轮 P2：duplicate Segment validation 复用已读 Memory directory，避免每个 Memory 内再次解析 matching Memory。
- [x] 第十轮 P2：automatic backfill 默认先读 index snapshot，候选未达到 cap 时再用文件真源 snapshot 补齐，避免 stale index 漏扫。
- [x] 第十轮 P2：backfill target selector 只有候选集已满后才基于 oldest selected 提前停止，避免 cap>1 时漏掉较旧候选。
- [x] 第十轮 P2：RecordingOverlay live transcript recovery snapshot 节流到 1000ms，并在暂停、停止、finalize、save 和 cleanup 前 flush。
- [x] 第十轮 P3：文件空间节点目录查找改为流式 parent scan，避免先物化整组 entries 再二次分类。
- [x] 第十轮 P3：Memory space registry Finder rename cap 只计入带合法 Reo metadata 的候选目录。
- [x] 第十轮 P3：App manual backfill running guard 绑定 workspace handle，旧 handle in-flight task 不阻塞新 handle 重试。
- [x] 第十轮 P3：RecordingOverlay waveform sample append 单 pass 计算 raw/display average。
- [x] 第十轮 P3：Vitest project membership guard 改为 AST + include pattern membership。
- [x] 第十轮 P4：删除 `duplicateSegmentDirectoryChecked` 和 unused `readWorkspaceMemoryDetailsFromFileTruth`。
- [x] 第十轮 P4：补充 SegmentSupplement stale waveform decode 行为测试。
- [x] 第十轮 P4：Segment strip scroll hot path 增加 source-level guard。
- [x] 第十一轮 P1：RecordingOverlay unmount cleanup 先 flush pending live transcript segments，再 flush recovery snapshot。
- [x] 第十一轮 P2：App workspace refresh 使用 Memory id map 合并当前 session 和 refresh snapshot，避免重复线性查找。
- [x] 第十一轮 P2：automatic backfill below-cap refresh 复用 summary 未变的 Memory detail read。
- [x] 第十一轮 P2：automatic backfill Memory summary 遍历使用 heap 按新近程度弹出候选，不再为 capped scan 复制排序全部 summary。
- [x] 第十一轮 P2：duplicate Segment finalize preflight 复用已知 Memory directory，避免每个 Memory 重新解析目录。
- [x] 第十一轮 P2：manual SegmentSupplement backfill success 增加新 handle race 测试，旧 handle response 不改写重开后的 session。
- [x] 第十一轮 P2：complexity scanner 通过 repo-local wrapper 运行，并排除 `.tmp`、`.agents`、`.claude`、`out` 和归档目录。
- [x] 第十一轮 P2：Vitest component project include 缩到 `src/renderer/src/**/*.test.tsx`。
- [x] 第十一轮 P3：文件空间节点目录 fallback 改为流式两段扫描，不再物化 fallback entries。
- [x] 第十一轮 P3：Content tab dragover 对同一 source/target/placement 做 no-op guard。
- [x] 第十一轮 P3：App pending Segment delete projection 先按当前 session 聚合，再应用到 Memory 投影。
- [x] 第十一轮 P3：initiative tasks 压缩为当前里程碑，不重复维护每轮细项。
- [x] 第十一轮 P4：Segment 和 SegmentSupplement 播放时间 state 发布节流，强制 seek/end 仍立即发布。
- [x] 第十一轮 P4：SegmentSupplement playback failure 显示可恢复状态。
- [x] 第十一轮 P4：Memory Studio active supplement 使用 id map 查找。
- [x] 第十一轮 P4：Memory Studio layout measure 对 mounted Segment item 增加 96 个硬上限。
- [x] 第十一轮 P4：`verify:quick` script guard 改为解析命令步骤，不绑定完整字符串。
- [x] 第十一轮 P4：`scripts/local-env.mjs` 抽出 env entry 合并 helper，避免文件循环内展开 key 合并逻辑。
- [x] 第十二轮 P2：recovered recording save/finalize/transcript path 绑定 workspace handle，旧 handle response 不再改写重开的同 workspace session。
- [x] 第十二轮 P2：package script guard 移除未声明的 `minimatch` 隐式依赖，改用本地 include pattern matcher。
- [x] 第十二轮 P3：`complexity:scan` 缺失 agent-local scanner 时输出可行动错误。
- [x] 第十二轮 P3：automatic backfill Memory summary 遍历改为直接消费已排序 snapshot，不再为 capped scan 预建全量 heap。
- [x] 第十二轮 P4：complexity scanner wrapper 增加 fake scanner 行为测试，覆盖 root、exclude 列表和透传参数。
- [x] 第十二轮 P4：记录剩余 raw scanner leads 为本地脚本和视觉测量脚本的 bounded/agent-local 审查噪音，不进入产品 runtime 修复。
- [x] 第十三轮 P2：recovered transcript save reject 在 stale workspace handle 后不再弹旧 toast。
- [x] 第十三轮 P2：SegmentSupplement final transcript save success 在 stale recording session 后不再触发 finalized callback。
- [x] 第十三轮 P3：recovered recording discard 绑定 workspace handle 和 recovery action id，旧响应不清理新 session 状态或弹旧 toast。
- [x] 第十三轮 P3：automatic backfill 在 snapshot memory summary 顺序漂移时禁用 early break，避免漏掉后置更新候选。
- [x] 第十三轮 P3：Memory space registry Finder rename recovery 增加 total sibling scan cap。
- [x] 第十三轮 P3：initiative tasks 使用最新复审里程碑，不保留旧轮次状态。
- [x] 第十三轮 P4：complexity scanner wrapper 覆盖 scanner 非零退出码透传。
- [x] 第十三轮验证修复：App 完整录音 UI 流测试单跑通过但接近 10s 局部 timeout；将该单测局部预算调整到 15s，避免 full suite 串行负载下误报超时。
- [x] 最终前 P1：automatic backfill 在 index candidate 到达 cap 时仍刷新文件真源，避免 cap 命中导致 file-truth 漏扫。
- [x] 最终前 P1：live transcription event identity 增加顶层 `recordingFlowSessionId`，renderer 对 `segments`、`error`、`closed` 全量匹配 flow/session/revision。
- [x] 最终前 P2：Memory create/rename、Segment rename、Memory delete/restore 使用 workspace handle + workspace id guard，旧 handle 响应不回滚新 session。
- [x] 最终前 P2：Segment/Supplement 文件空间查找对已经有 id parent 的路径禁用无意义 fallback sibling scan。
- [x] 最终前 P3：fill-missing audio source 复用目标 eligibility preflight 的 transcript-missing 结论，读取音频时不重复读取 transcript 文本。
- [x] 最终前 P3：RecordingOverlay live transcript UI 批处理窗口从 16ms 调整为 100ms，降低长录音 transcript array merge/copy 频率。
- [x] 最终前 P3：pending Segment delete 后立即 invalidate 非目标 Memory detail，避免 staleTime Infinity 让非目标详情保持旧缓存。
- [x] 最终前 P4：Memory space registry read schema 拒绝超过 100 个 entry 的 registry，避免读路径接受过量状态。
- [x] 最终前 P4：active spec/initiative 明确复杂度扫描统一通过 `npm run complexity:scan`。

## 证据

- [x] 行为修复记录 focused 命令和结果；本轮复审新增项记录 focused pass 证据。
- [x] `npm run verify:quick`。
- [x] 多 subagent 复审。
- [x] `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts,test/main/memoryFiles.test.ts,test/main/recordingDrafts.test.ts,test/main/workspaceMemorySpaceRegistry.test.ts npm run test:main -- --test-name-pattern="scanWorkspaceBackfillTargets|file-space|renamed|duplicate|backfill|memory space registry"`。
- [x] `MAIN_TEST_FILES=test/main/backfillRuntime.test.ts,test/main/recordingDrafts.test.ts npm run test:main -- --test-name-pattern="fill-missing|backfill source|finalized audio backfill source|regenerates an existing segment transcript"`。
- [x] `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx --testNamePattern "live transcript|transcription event|recovery marker|flushes pending" --reporter=verbose`。
- [x] `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/App.test.tsx --testNamePattern "in-flight Memory rename|in-flight Segment rename|SegmentSupplement rename failure|pending Segment delete|delayed Segment delete response" --reporter=verbose`。
- [x] `npx tsc -b`。
- [x] `npm run lint:strict`。
- [x] `npm run format:check`。
- [x] `npm run test:renderer -- --project renderer-jsdom-components src/renderer/src/workspace/RecordingOverlay.test.tsx --testNamePattern "stale SegmentSupplement transcript|live transcription batches|flushes pending live transcript|backfills transcription|streams PCM" --reporter=verbose`。
- [x] `npm run verify:quick`：通过；包含 typecheck quick、main 742 tests、renderer 445 tests、lint strict 和 format check。
- [x] 最终三路 subagent `$complexity-optimizer` 复审：main/file-truth 与 renderer 无 P0/P1 must-fix；tooling/docs 仅发现 initiative checklist 状态漂移，已修复。
- [x] `npm run complexity:scan`：通过；raw leads 仍集中在 bounded local tooling、视觉测量脚本和已审查 runtime 线索，未形成新增 must-fix。
- [x] 最终自信审查。
