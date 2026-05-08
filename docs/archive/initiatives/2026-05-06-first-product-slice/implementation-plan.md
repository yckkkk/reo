# Reo First Product Slice 实施计划

> **面向 agent worker：** 必须使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 按 task 逐项执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 把当前可运行 foundation 改造成产品级 first product slice：本地 workspace 创建/打开、真实 app shell、Home、Memory detail、录音 drawer、音频保存/播放、transcript/reflections 编辑、文件真源、Electron 安全边界和可验证 QA。

**架构：** Renderer 只通过 `window.reoWorkspace` 窄 preload API 与 main 通信；用户内容真源在 workspace files，`.reo/index.json` 只做可重建投影，SQLite/Drizzle 仍由后续 projection foundation 激活。UI 采用 Reo design system，并且只在存在真实业务 consumer 的同一 slice 中引入 shadcn/Radix/Vaul/ElevenLabs UI source。录音 capture 使用 browser `MediaRecorder`，main process 负责 draft append/finalize filesystem transaction。

**技术栈：** React 19、TypeScript、electron-vite、Tailwind CSS v4、shadcn/ui + Radix primitives、Vaul、ElevenLabs UI source components、lucide-react、React Hook Form + Zod、Zustand + TanStack Query、Vitest、Testing Library、Electron main tests。

---

## 执行边界

- 本计划只允许在 design-hardening gate PASS 且 `$plan-eng-review` PASS 后执行。
- 实现必须在隔离 worktree 中执行；不得在 main checkout 直接实现。
- 每个代码或行为 task 必须真实 TDD：先修改或新增行为测试并运行到 RED，再写最小实现到 GREEN，最后 REFACTOR 后重跑保护测试。
- 纯验证、文档压缩或独立审查 task 不伪造 RED/GREEN/REFACTOR；它们必须记录验证目标、命令、runtime evidence、发现的问题和修复回链。若验证发现行为缺陷并需要改代码，必须回到对应代码 task 或创建修复 task spec 后执行 TDD。
- 每个 task 都必须更新对应 `docs/current/*` 当前真源，并提交独立 commit。
- 每个 task 提交前必须运行本计划的固定门禁；门禁失败不得提交。
- 本文件是 active initiative 的 implementation 阶段执行权威；它不替代每个 implementation task 的独立 task spec。
- 每个 implementation task 必须先创建独立 task spec：`docs/specs/YYYY-MM-DD-HHMM-first-product-slice-task-N-slug/`。
- 每个 task spec 至少包含 `README.md`、`verification.md`、`review.md`；如 task 涉及 UI，也必须包含 task-local reference notes。
- 代码或行为 task 完成时必须在该 task spec 写入 RED/GREEN/REFACTOR、简化审查、runtime/reference evidence 和 docs/current 更新摘要。
- 验证、文档压缩或独立审查 task 完成时必须在该 task spec 写入验证目标、命令输出摘要、runtime/reference evidence、审查结论和发现问题的回链。
- Task commit 创建后运行 `git rev-parse HEAD`，把 commit hash 记录到当前执行日志、最终回复和后续非自引用 rollup evidence；不要为了把自身 hash 写进同一个 commit 而 amend，因为 amend 会改变 hash。
- task 完成并压缩长期结论回 `docs/current/*` 后，按 Reo 文档生命周期把该 task spec 移入 `docs/archive/specs/*`；若 task 未完成，task spec 必须留在 `docs/specs/*`。
- 不写 `docs/superpowers/*`。
- 不编辑 archived implementation plan。
- 不创建 generic runtime、generic service layer 或 generic IPC bridge。
- 不显示未实现的 photo、video、file、film、AI generation、global search、auth user、contact/entity graph 能力。

## 计划转交和 active spec 生命周期

本文件已从 design-hardening spec 转交到 active initiative。Design-hardening、`$writing-plans` 和 `$plan-eng-review` 均已 PASS；进入 Task 1 前只允许完成本 handoff gate 的剩余归档和空 spec 检查：

- 将最终可执行任务清单同步到 `docs/initiatives/2026-05-06-first-product-slice/plan.md` 和 `tasks.md`，使 active initiative 承接后续实现；本文件和 initiative plan 是 implementation 阶段的当前执行权威。
- 更新 design-hardening spec 的 `review.md` 和 `verification.md`，记录 writing-plan review、plan-eng-review、验证命令和 handoff 结论。
- 创建 `docs/archive/specs/` 后归档 `docs/specs/2026-05-06-0912-first-product-slice-product-grade-design-hardening/`。归档后该 design spec 只作为背景证据，不再作为执行权威，也不得继续编辑其中的 implementation plan。
- 确认 `docs/specs/*` 为空后，才允许创建 Task 1 的 implementation task spec。
- Implementation 阶段的当前权威只能是 `docs/current/*`、active initiative、当前唯一 active task spec 和源码事实；不得依赖 archived spec 才能理解下一步。

## 计划已吸收的 Design Follow-ups

- `traceability-matrix.md` 已补 EL-005 和 QA-005。
- Mic permission sequencing 已锁定：renderer 必须 await `workspace:beginMicrophoneIntent` 成功后才允许调用 `navigator.mediaDevices.getUserMedia`。
- `More` 只保留 future wireframe：rename、delete、show in folder、export；当前 build 不渲染可点击菜单。
- Workspace entry 状态机拆分 create/open。
- Title update 规则锁定为 file truth first，DB projection second。
- `RecordingOverlay` 的 mock transcript 是第一条 RED；不得把 mock transcript 当 STT 交付。
- Active initiative 已创建：`docs/initiatives/2026-05-06-first-product-slice/`。

## Source 组件规则

- 已确认 npm registry 版本：`shadcn@4.7.0`、`@elevenlabs/cli@0.5.2`。
- 已确认 runtime dependency 版本：`lucide-react@1.14.0`、`vaul@1.1.2`。
- 只允许使用固定版本命令，例如 `npx shadcn@4.7.0 add input`、`npx @elevenlabs/cli@0.5.2 components add waveform`。
- 只允许安装固定版本依赖，例如 `npm install lucide-react@1.14.0`、`npm install vaul@1.1.2`；不得在 implementation task 中使用 unpinned `npm install <package>`。
- 不运行 `shadcn init`；当前 repo 已有 `components.json`、renderer alias 和基础 source。
- 不执行 ElevenLabs `add all`。
- 新增 source 必须与首个真实业务 consumer、shared invariant、tests 和同 slice commit 同批完成。
- source 生成后必须删除 demo tracks、fetch/network、agent runtime、API key、Next.js-only 假设、未实现能力和装饰性行为。
- 所有 source 必须 retokenize 到 Reo tokens；视觉不服从 Reo design system 时先薄适配或 fork，不直接自研。
- Reo design system 不能覆盖某个必要 UI 状态时，先新增或更新共享 token、primitive variant 或 usage rule，并在同一 task 写入 docs/current/frontend.md；不得在业务组件里直接硬编码一次性视觉规则。
- 新增设计系统规则必须符合行业通用设计系统实践、Practical UI 的 spacing/hierarchy/accessibility 原则、参考图结构和 Reo 当前产品气质。

## Claude 前端委派和简化门禁

- Renderer/UI tasks 可交给 Claude CLI 执行；优先范围是 Task 3、4、5、6、7、8、10、11、12 中只触及 renderer/UI/docs 的子步骤。
- 调用 Claude CLI 时只设置 prompt、model `opus4.7` 和 effort `xhigh`；不要通过 CLI flags 设置 tools、permissions、add-dir 或额外目录访问，所有边界都写进 prompt。
- Claude prompt 必须包含：当前 worktree、目标 task、允许修改的文件范围、必须先 RED 后 GREEN、参考图路径、Reo design rules、source 组件规则、禁止 future capability、固定验证命令和 `/simplify` 简化门禁。
- Claude 返回前必须做自我审查，输出四段：`TDD evidence`、`Design/reference evidence`、`Simplification review`、`Known risks`。
- Claude 的 `Design/reference evidence` 必须说明所有新增视觉规则如何映射到 Reo design system；若需要补充设计系统，必须列出 token/primitive/usage rule 和 docs/current/frontend.md 更新。
- Claude 的 `Simplification review` 必须显式说明已使用 `/simplify`：复用现有 helper/component、删除重复/冗余状态、避免参数膨胀、扁平化嵌套条件、删除无价值注释、避免热路径额外工作、清理 Blob/listener/timer。
- 我方集成时必须再次审查 Claude diff；发现 BLOCKER/MAJOR 或简化问题时先修复再进入 commit，不把 Claude 自审当最终结论。
- Claude 不得提交；commit 只能在本计划固定门禁、我方审查和必要的对抗审查通过后执行。

## 每个 Task 的固定提交前门禁

在每个 implementation task 的 Step 1 前先执行 slice spec gate：

- 创建 `docs/specs/YYYY-MM-DD-HHMM-first-product-slice-task-N-slug/`。
- 写入该 task 的 objective、scope、source docs、RED targets、verification commands、reference assets 和 stop condition。
- 如果当前已有未完成 task spec，先收口、取消或明确 supersede，不得并行推进两个 implementation task spec。

在每个 task 的 GREEN/REFACTOR 后先执行简化门禁：

- `git diff` 查看本 task 实际代码改动。
- 按 `/simplify` 三类检查复用、质量和效率。
- 直接修复重复代码、冗余状态、过深嵌套、不必要 JSX wrapper、无用注释、无界缓存、事件/Blob/timer 清理缺口和热路径额外工作。
- 修复后重跑保护该 task 的 targeted tests。

然后运行：

```bash
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
```

预期：

- `npm run verify:quick`: PASS。
- `git diff --check`: 无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`: 无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`: implementation task 进行中时只输出当前 task spec；task spec 完成并归档后无输出。若输出 design-hardening umbrella spec，必须先完成 plan handoff gate，不得继续实现。
- `git status --short`: 只允许显示当前 task 明确 owns 的文件；发现非当前 task 或用户残留改动时，先停下核对，不得用宽 pathspec 一次性提交。
- Commit 前必须从 `git status --short` 中逐项确认 path ownership，并用显式 pathspec stage 当前 task 文件；不得使用 `git add src test docs package.json package-lock.json` 这类宽 pathspec。
- Commit 必须包含当前 task spec 或其 archived path；下面各 task 的 `git add` 示例省略 timestamped task spec path，但执行时不得省略。Commit 后立即运行 `git rev-parse HEAD` 并在工作日志记录 hash。

## 文件结构目标

### Main / Preload

- Modify `src/main/workspaceContract.ts`：memory、recording nested path、microphone intent DTO/Zod schema。
- Modify `src/main/workspaceChannels.ts`：新增 explicit channels，不添加 generic bridge。
- Modify `src/main/atomicWorkspaceFile.ts`：升级 JSON/markdown atomic write 为 temp file + file fsync + rename + parent directory fsync。
- Create `src/main/memoryFiles.ts`：`memories/<memoryId>/memory.json`、memory detail projection、title update file-first。
- Modify `src/main/recordingDrafts.ts`：draft 从 `.reo/drafts/recordings/<id>/` finalize 到 `memories/<memoryId>/recordings/<id>/`。
- Create `src/main/recordingReads.ts`：从 `recordingDrafts.ts` 拆出 audio/transcript/reflections bounded read/save，使用 `memoryId + recordingId`。
- Modify `src/main/workspaceFiles.ts`：初始化 `.reo/drafts/`，从 `memories/*` rebuild index。
- Modify `src/main/security.ts`：one-shot microphone intent store。
- Modify `src/main/workspaceIpc.ts`：绑定新增 handlers 和 sender validation。
- Modify `src/preload/workspaceBridge.ts`、`src/preload/index.ts`：只暴露 explicit functions。
- Modify `src/renderer/src/types/reoWorkspace.d.ts`：同步 preload 类型。

### Renderer

- Create `src/renderer/src/workspace/WorkspaceEntryPage.tsx`、`OpenWorkspaceAction.tsx`、`FolderPickerField.tsx`、`WorkspaceErrorBanner.tsx`。
- Modify `src/renderer/src/workspace/CreateWorkspaceForm.tsx`：RHF + Zod submit validation、create/open 错误分支。
- Create `src/renderer/src/app-shell/AppShell.tsx`、`AppShell.test.tsx`。
- Modify `src/renderer/src/workspace/WorkspaceHome.tsx`：All memories、本地 search/filter、month sections、recording cards。
- Create `src/renderer/src/workspace/MemoryCard.tsx`、`MemorySection.tsx`、`MemorySearchBar.tsx`。
- Create `src/renderer/src/workspace/MemoryDetailPage.tsx`。
- Replace `src/renderer/src/workspace/RecordingOverlay.tsx` with focused recording components under `src/renderer/src/workspace/recording/`。
- Modify `src/renderer/src/workspace/recordingMachine.ts`：acquiring/permission/finalize/playback/editor states，移除 mock transcript。
- Modify `src/renderer/src/workspace/mediaRecorderAdapter.ts`：显式 microphone intent sequencing，无 raw path。
- Modify `src/renderer/src/workspace/workspaceApi.ts`、`workspaceQueries.ts`：memory detail、local-search derived state、recording nested APIs。
- Modify `src/renderer/src/App.tsx`：route state 扩展为 entry/shell/home/detail/drawer。

## 任务 1： Workspace 文件真源与 durable memory

**Files:**

- Create: `src/main/memoryFiles.ts`
- Modify: `src/main/atomicWorkspaceFile.ts`
- Modify: `src/main/workspaceContract.ts`
- Modify: `src/main/workspaceFiles.ts`
- Modify: `src/main/recordingDrafts.ts`
- Create: `src/main/recordingReads.ts`
- Test: `test/main/memoryFiles.test.ts`
- Test: `test/main/recordingDrafts.test.ts`
- Test: `test/main/workspaceFiles.test.ts`
- Docs: `docs/current/data.md`
- Docs: `docs/current/flow.md`

- [ ] **Step 1: 写 RED 测试，锁定 memory 文件真源**

在 `test/main/memoryFiles.test.ts` 新增：

```ts
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function workspaceRoot(): Promise<string> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-memory-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: '录音',
    description: '',
    createWorkspaceId: () => 'ws_memory',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await initializeRecordingDraftWorkspace({ rootPath });
  return rootPath;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeMemoryJsonForTest(
  rootPath: string,
  memory: {
    readonly memoryId: string;
    readonly title: string;
    readonly sourceKind: 'recording';
    readonly recordingIds: readonly string[];
  }
): Promise<void> {
  const directory = path.join(rootPath, 'memories', memory.memoryId);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'memory.json'),
    `${JSON.stringify(
      {
        ...memory,
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
      },
      null,
      2
    )}\n`
  );
}

async function readWorkspaceIndex(rootPath: string): Promise<unknown> {
  return readJson(path.join(rootPath, '.reo', 'index.json'));
}

test('finalizes a draft into a durable memory directory', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_000001',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.deepEqual(draft, {
    ok: true,
    recordingId: 'rec_20260506_000001',
    nextSequence: 0,
  });

  await appendRecordingAudioChunk({
    rootPath,
    recordingId: 'rec_20260506_000001',
    sequence: 0,
    chunk: new Uint8Array([1, 2, 3]),
  });

  const finalized = await finalizeRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    recordingId: 'rec_20260506_000001',
    createMemoryId: () => 'mem_20260506_000001',
    title: 'My seventh birthday',
    durationMs: 73_000,
    now: () => '2026-05-06T13:09:00.000Z',
  });

  assert.deepEqual(finalized, {
    ok: true,
    recording: {
      memoryId: 'mem_20260506_000001',
      recordingId: 'rec_20260506_000001',
      title: 'My seventh birthday',
      durationMs: 73_000,
      audioByteLength: 3,
    },
  });
  assert.deepEqual(
    await readJson(path.join(rootPath, 'memories', 'mem_20260506_000001', 'memory.json')),
    {
      memoryId: 'mem_20260506_000001',
      title: 'My seventh birthday',
      sourceKind: 'recording',
      createdAt: '2026-05-06T13:09:00.000Z',
      updatedAt: '2026-05-06T13:09:00.000Z',
      recordingIds: ['rec_20260506_000001'],
    }
  );
  const audio = await stat(
    path.join(
      rootPath,
      'memories',
      'mem_20260506_000001',
      'recordings',
      'rec_20260506_000001',
      'audio.webm'
    )
  );
  assert.equal(audio.size, 3);
  assert.deepEqual(
    await readJson(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'recording.json'
      )
    ),
    {
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_20260506_000001',
      recordingId: 'rec_20260506_000001',
      status: 'finalized',
      title: 'My seventh birthday',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 73_000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    }
  );
  assert.equal(
    await readFile(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'transcript.md'
      ),
      'utf8'
    ),
    ''
  );
  assert.equal(
    await readFile(
      path.join(
        rootPath,
        'memories',
        'mem_20260506_000001',
        'recordings',
        'rec_20260506_000001',
        'reflections.md'
      ),
      'utf8'
    ),
    ''
  );
  await assert.rejects(
    stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000001'))
  );
});
```

- [ ] **Step 2: 写 RED 测试，锁定 title update 顺序**

在同文件新增：

```ts
test('updates titles through file truth before rebuilding the index projection', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_1',
    title: 'Original title',
    sourceKind: 'recording',
    recordingIds: ['rec_existing'],
  });

  const updated = await updateMemoryTitleFromFileTruth({
    rootPath,
    memoryId: 'mem_1',
    title: 'Renamed memory',
    now: () => '2026-05-06T13:10:00.000Z',
  });

  assert.equal(updated.ok, true);
  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_1', 'memory.json')), {
    memoryId: 'mem_1',
    title: 'Renamed memory',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    recordingIds: ['rec_existing'],
    updatedAt: '2026-05-06T13:10:00.000Z',
  });
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_1',
        title: 'Renamed memory',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:10:00.000Z',
        recordingCount: 1,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        hasReflections: false,
      },
    ],
  });
});
```

- [ ] **Step 3: 写 RED 测试，finalize 失败保留 draft 且不留下 durable partial**

在同文件新增：

```ts
test('preserves the draft when memory finalize cannot rebuild the index', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_000002',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_20260506_failed',
    recordingId: 'rec_20260506_000002',
    title: 'Will not finalize',
    durationMs: 10_000,
    now: () => '2026-05-06T13:09:00.000Z',
    rebuildIndex: async () => {
      throw new Error('index write failed');
    },
  });

  assert.equal(finalized.ok, false);
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000002'));
  await assert.rejects(stat(path.join(rootPath, 'memories', 'mem_20260506_failed')));
});
```

- [ ] **Step 4: 写 RED 测试，existing memory append rollback 和 symlink guard**

在同文件新增：

```ts
test('rolls back an existing memory append when index rebuild fails', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    recordingIds: ['rec_existing'],
  });
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_000003',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const appended = await appendRecordingToMemory({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_existing',
    recordingId: 'rec_20260506_000003',
    title: 'Existing memory',
    durationMs: 20_000,
    now: () => '2026-05-06T13:11:00.000Z',
    rebuildIndex: async () => {
      throw new Error('index write failed');
    },
  });

  assert.equal(appended.ok, false);
  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_existing', 'memory.json')), {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
    recordingIds: ['rec_existing'],
  });
  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000003'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_existing', 'recordings', 'rec_20260506_000003'))
  );
});

test('rejects symlinked durable memory directories', async () => {
  const rootPath = await workspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-outside-'));
  await mkdir(path.join(rootPath, 'memories'), { recursive: true });
  await symlink(outside, path.join(rootPath, 'memories', 'mem_link'), 'dir');

  const updated = await updateMemoryTitleFromFileTruth({
    rootPath,
    memoryId: 'mem_link',
    title: 'Should not write outside',
    now: () => '2026-05-06T13:12:00.000Z',
  });

  assert.equal(updated.ok, false);
  await assert.rejects(readFile(path.join(outside, 'memory.json'), 'utf8'));
});

test('atomic workspace writes fsync temp files and parent directories before success', async () => {
  const calls: string[] = [];
  await writeWorkspaceFileAtomicForTest({
    filePath: '/workspace/memories/mem_1/memory.json',
    data: '{}\n',
    openFile: async () => ({
      writeFile: async () => calls.push('write-temp'),
      sync: async () => calls.push('fsync-temp'),
      close: async () => calls.push('close-temp'),
    }),
    renameFile: async () => calls.push('rename'),
    openDirectory: async () => ({
      sync: async () => calls.push('fsync-parent'),
      close: async () => calls.push('close-parent'),
    }),
  });

  assert.deepEqual(calls, [
    'write-temp',
    'fsync-temp',
    'close-temp',
    'rename',
    'fsync-parent',
    'close-parent',
  ]);
});

test('recovers an interrupted recording finalization without promoting partial durable files', async () => {
  const rootPath = await workspaceRoot();
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_000004',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  await mkdir(
    path.join(rootPath, 'memories', 'mem_interrupted', 'recordings', 'rec_20260506_000004'),
    { recursive: true }
  );
  await writeFile(
    path.join(
      rootPath,
      'memories',
      'mem_interrupted',
      'recordings',
      'rec_20260506_000004',
      '.reo-finalize-transaction.json'
    ),
    '{"recordingId":"rec_20260506_000004"}'
  );

  await recoverRecordingFinalizeTransactions(rootPath);

  await stat(path.join(rootPath, '.reo', 'drafts', 'recordings', 'rec_20260506_000004'));
  await assert.rejects(
    stat(path.join(rootPath, 'memories', 'mem_interrupted', 'recordings', 'rec_20260506_000004'))
  );
});

test('repairs memory metadata that points at a missing finalized recording during recovery', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    recordingIds: ['rec_missing'],
  });

  await recoverRecordingFinalizeTransactions(rootPath);
  await rebuildMemoryIndex(rootPath);

  assert.deepEqual(await readJson(path.join(rootPath, 'memories', 'mem_existing', 'memory.json')), {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    createdAt: '2026-05-06T13:08:00.000Z',
    updatedAt: '2026-05-06T13:08:00.000Z',
    recordingIds: [],
  });
  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_existing',
        title: 'Existing memory',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        recordingCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        hasReflections: false,
      },
    ],
  });
});

test('rebuilds index only from finalized recording metadata that matches audio bytes and ownership', async () => {
  const rootPath = await workspaceRoot();
  await writeMemoryJsonForTest(rootPath, {
    memoryId: 'mem_existing',
    title: 'Existing memory',
    sourceKind: 'recording',
    recordingIds: ['rec_mismatch'],
  });
  const recordingDirectory = path.join(
    rootPath,
    'memories',
    'mem_existing',
    'recordings',
    'rec_mismatch'
  );
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(recordingDirectory, 'audio.webm'), new Uint8Array([1, 2, 3, 4]));
  await writeFile(
    path.join(recordingDirectory, 'recording.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaceId: 'ws_memory',
      memoryId: 'mem_existing',
      recordingId: 'rec_mismatch',
      status: 'finalized',
      title: 'Mismatch',
      createdAt: '2026-05-06T13:08:00.000Z',
      finalizedAt: '2026-05-06T13:09:00.000Z',
      durationMs: 1000,
      nextSequence: 1,
      audioByteLength: 3,
      transcriptPath: 'transcript.md',
      reflectionsPath: 'reflections.md',
    })
  );

  await rebuildMemoryIndex(rootPath);

  assert.deepEqual(await readWorkspaceIndex(rootPath), {
    schemaVersion: 1,
    memories: [
      {
        memoryId: 'mem_existing',
        title: 'Existing memory',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-06T13:08:00.000Z',
        recordingCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        hasReflections: false,
      },
    ],
  });
});

test('finalize transaction fsyncs staging contents before exposing a durable recording', async () => {
  const rootPath = await workspaceRoot();
  const calls: string[] = [];
  const draft = await createRecordingDraft({
    rootPath,
    workspaceId: 'ws_memory',
    createRecordingId: () => 'rec_20260506_fsync',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  assert.equal(draft.ok, true);

  const finalized = await createMemoryForRecording({
    rootPath,
    workspaceId: 'ws_memory',
    memoryId: 'mem_20260506_fsync',
    recordingId: 'rec_20260506_fsync',
    title: 'Durable fsync order',
    durationMs: 10_000,
    now: () => '2026-05-06T13:09:00.000Z',
    transactionHooks: {
      afterMarkerWrite: () => calls.push('write-marker'),
      afterCopy: () => calls.push('copy-draft'),
      afterStagingTreeFsync: () => calls.push('fsync-staging-tree'),
      beforeExpose: () => calls.push('before-rename'),
      afterParentFsync: () => calls.push('fsync-recordings-parent'),
    },
  });

  assert.equal(finalized.ok, true);
  assert.deepEqual(calls, [
    'write-marker',
    'copy-draft',
    'fsync-staging-tree',
    'before-rename',
    'fsync-recordings-parent',
  ]);
  assert.ok(calls.indexOf('fsync-staging-tree') < calls.indexOf('before-rename'));
  assert.ok(calls.indexOf('before-rename') < calls.indexOf('fsync-recordings-parent'));
});
```

- [ ] **Step 5: 运行 RED**

运行：

```bash
npm run test:main
```

预期： FAIL，原因是 `memoryFiles.ts`、nested finalize 和 title update helper 尚不存在。`npm run test:main` 会运行完整 main test suite；必须在输出中定位新增 failing cases。

- [ ] **Step 6: 写最小实现**

实现 `src/main/memoryFiles.ts`。该文件只处理 durable memory 文件真源和 index projection，不持有 renderer state，也不访问 Electron：

```ts
import {
  cp,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { writeWorkspaceFileAtomic, writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import { getWorkspaceIndexPath } from './workspacePaths.js';
import { workspaceError, type WorkspaceErrorEnvelope } from './workspaceContract.js';

const MEMORY_ID_PATTERN = /^mem_[A-Za-z0-9_-]+$/;
const RECORDING_ID_PATTERN = /^rec_[A-Za-z0-9_-]+$/;
const FINALIZE_STAGING_PREFIX = '.reo-finalizing-';
const FINALIZE_TRANSACTION_MARKER = '.reo-finalize-transaction.json';

export type MemoryJson = {
  readonly memoryId: string;
  readonly title: string;
  readonly sourceKind: 'recording';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly recordingIds: readonly string[];
};

export type MemorySummary = {
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly recordingCount: number;
  readonly durationMs: number;
  readonly audioByteLength: number;
  readonly hasTranscript: boolean;
  readonly hasReflections: boolean;
};

export type MemoryRecordingSummary = {
  readonly recordingId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly audioByteLength: number;
};

export type MemoryDetail = MemoryJson & {
  readonly recordings: readonly MemoryRecordingSummary[];
};

export type CreateMemoryForRecordingInput = {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly recordingId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly transactionHooks?: FinalizeTransactionHooks;
};

export type AppendRecordingToMemoryInput = {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly recordingId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly now: () => string;
  readonly rebuildIndex?: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly transactionHooks?: FinalizeTransactionHooks;
};

export type ReadMemoryDetailInput = {
  readonly rootPath: string;
  readonly memoryId: string;
};

export type UpdateMemoryTitleInput = ReadMemoryDetailInput & {
  readonly title: string;
  readonly now: () => string;
};

type MemoryFilesResult<T> = { readonly ok: true; readonly value: T } | WorkspaceErrorEnvelope;

type FinalizeTransactionHooks = {
  readonly afterMarkerWrite?: () => void;
  readonly afterCopy?: () => void;
  readonly afterStagingTreeFsync?: () => void;
  readonly beforeExpose?: () => void;
  readonly afterParentFsync?: () => void;
};

const memoryJsonSchema = z.object({
  memoryId: z.string().regex(MEMORY_ID_PATTERN),
  title: z.string(),
  sourceKind: z.literal('recording'),
  createdAt: z.string(),
  updatedAt: z.string(),
  recordingIds: z.array(z.string().regex(RECORDING_ID_PATTERN)),
});

async function resolveSafeWorkspaceChild(rootPath: string, candidatePath: string): Promise<string> {
  const canonicalRoot = await realpath(rootPath);
  const relative = path.relative(rootPath, candidatePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes workspace');
  }

  let current = canonicalRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error('Workspace path crosses a symlink');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        break;
      }
      throw error;
    }
  }

  const resolved = path.resolve(canonicalRoot, relative);
  const containment = path.relative(canonicalRoot, resolved);
  if (containment.startsWith('..') || path.isAbsolute(containment)) {
    throw new Error('Path escapes workspace');
  }
  return resolved;
}

async function fsyncWorkspaceDirectory(directoryPath: string): Promise<void> {
  const handle = await open(directoryPath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncWorkspaceFile(filePath: string): Promise<void> {
  const handle = await open(filePath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncDirectoryTree(directoryPath: string): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    const metadata = await lstat(entryPath);
    if (metadata.isSymbolicLink()) {
      throw new Error('Workspace transaction path crosses a symlink');
    }
    if (metadata.isDirectory()) {
      await fsyncDirectoryTree(entryPath);
      continue;
    }
    if (metadata.isFile()) {
      await fsyncWorkspaceFile(entryPath);
    }
  }
  await fsyncWorkspaceDirectory(directoryPath);
}

async function memoryDirectory(rootPath: string, memoryId: string): Promise<string> {
  if (!MEMORY_ID_PATTERN.test(memoryId)) {
    throw new Error('Invalid memory id');
  }
  return resolveSafeWorkspaceChild(rootPath, path.join(rootPath, 'memories', memoryId));
}

async function draftRecordingDirectory(rootPath: string, recordingId: string): Promise<string> {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Invalid recording id');
  }
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, '.reo', 'drafts', 'recordings', recordingId)
  );
}

async function memoryRecordingDirectory(
  rootPath: string,
  memoryId: string,
  recordingId: string
): Promise<string> {
  if (!RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Invalid recording id');
  }
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories', memoryId, 'recordings', recordingId)
  );
}

async function readMemoryJson(rootPath: string, memoryId: string): Promise<MemoryJson> {
  const directory = await memoryDirectory(rootPath, memoryId);
  return memoryJsonSchema.parse(
    JSON.parse(await readFile(path.join(directory, 'memory.json'), 'utf8'))
  );
}

async function summarizeMemory(rootPath: string, memory: MemoryJson): Promise<MemorySummary> {
  let recordingCount = 0;
  let durationMs = 0;
  let audioByteLength = 0;
  let hasTranscript = false;
  let hasReflections = false;

  for (const recordingId of memory.recordingIds) {
    try {
      const recordingDirectory = await memoryRecordingDirectory(
        rootPath,
        memory.memoryId,
        recordingId
      );
      const recording = JSON.parse(
        await readFile(path.join(recordingDirectory, 'recording.json'), 'utf8')
      ) as {
        readonly recordingId?: string;
        readonly memoryId?: string;
        readonly status?: string;
        readonly durationMs?: number;
        readonly audioByteLength?: number;
      };
      const audio = await stat(path.join(recordingDirectory, 'audio.webm'));
      if (
        recording.status !== 'finalized' ||
        recording.recordingId !== recordingId ||
        recording.memoryId !== memory.memoryId ||
        recording.audioByteLength !== audio.size
      ) {
        continue;
      }
      recordingCount += 1;
      durationMs += recording.durationMs ?? 0;
      audioByteLength += audio.size;
      hasTranscript =
        hasTranscript ||
        (await readFile(path.join(recordingDirectory, 'transcript.md'), 'utf8')).trim().length > 0;
      hasReflections =
        hasReflections ||
        (await readFile(path.join(recordingDirectory, 'reflections.md'), 'utf8')).trim().length > 0;
    } catch {
      continue;
    }
  }

  return {
    memoryId: memory.memoryId,
    title: memory.title,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    recordingCount,
    durationMs,
    audioByteLength,
    hasTranscript,
    hasReflections,
  };
}

export async function rebuildMemoryIndex(rootPath: string): Promise<MemorySummary[]> {
  let entries;
  try {
    entries = await readdir(
      await resolveSafeWorkspaceChild(rootPath, path.join(rootPath, 'memories')),
      { withFileTypes: true }
    );
  } catch {
    entries = [];
  }

  const memories: MemorySummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      memories.push(await summarizeMemory(rootPath, await readMemoryJson(rootPath, entry.name)));
    } catch {
      continue;
    }
  }

  memories.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  await writeWorkspaceJsonAtomic(getWorkspaceIndexPath(rootPath), {
    schemaVersion: 1,
    memories,
  });
  return memories;
}

async function isValidFinalizedRecordingDirectory(
  recordingDirectory: string,
  memoryId: string,
  recordingId: string
): Promise<boolean> {
  try {
    const recording = JSON.parse(
      await readFile(path.join(recordingDirectory, 'recording.json'), 'utf8')
    ) as {
      readonly memoryId?: string;
      readonly recordingId?: string;
      readonly status?: string;
      readonly audioByteLength?: number;
    };
    const audio = await stat(path.join(recordingDirectory, 'audio.webm'));
    return (
      recording.memoryId === memoryId &&
      recording.recordingId === recordingId &&
      recording.status === 'finalized' &&
      recording.audioByteLength === audio.size
    );
  } catch {
    return false;
  }
}

export async function recoverRecordingFinalizeTransactions(rootPath: string): Promise<void> {
  const memoriesDirectory = await resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories')
  );
  const memoryEntries = await readdir(memoriesDirectory, { withFileTypes: true }).catch(() => []);
  for (const memoryEntry of memoryEntries) {
    if (!memoryEntry.isDirectory()) {
      continue;
    }
    const memoryId = memoryEntry.name;
    const recordingsDirectory = path.join(memoriesDirectory, memoryId, 'recordings');
    const recordingEntries = await readdir(recordingsDirectory, { withFileTypes: true }).catch(
      () => []
    );
    let memory: MemoryJson | null = null;
    try {
      memory = await readMemoryJson(rootPath, memoryId);
    } catch {
      memory = null;
    }

    const validRecordingIds = new Set<string>();

    for (const recordingEntry of recordingEntries) {
      const recordingDirectory = path.join(recordingsDirectory, recordingEntry.name);
      if (!recordingEntry.isDirectory()) {
        continue;
      }
      if (recordingEntry.name.startsWith(FINALIZE_STAGING_PREFIX)) {
        await rm(recordingDirectory, { recursive: true, force: true });
        await fsyncWorkspaceDirectory(recordingsDirectory).catch(() => {});
        continue;
      }
      const markerPath = path.join(recordingDirectory, FINALIZE_TRANSACTION_MARKER);
      try {
        await stat(markerPath);
      } catch {
        continue;
      }
      const validFinalizedRecording = await isValidFinalizedRecordingDirectory(
        recordingDirectory,
        memoryId,
        recordingEntry.name
      );
      if (memory?.recordingIds.includes(recordingEntry.name) && validFinalizedRecording) {
        validRecordingIds.add(recordingEntry.name);
        await unlink(markerPath).catch(() => {});
        await fsyncWorkspaceDirectory(recordingDirectory).catch(() => {});
        continue;
      }
      await rm(recordingDirectory, { recursive: true, force: true });
    }

    if (memory) {
      for (const recordingId of memory.recordingIds) {
        const recordingDirectory = path.join(recordingsDirectory, recordingId);
        if (await isValidFinalizedRecordingDirectory(recordingDirectory, memoryId, recordingId)) {
          validRecordingIds.add(recordingId);
        }
      }
      const repairedRecordingIds = memory.recordingIds.filter((recordingId) =>
        validRecordingIds.has(recordingId)
      );
      if (repairedRecordingIds.length !== memory.recordingIds.length) {
        await writeWorkspaceJsonAtomic(path.join(memoriesDirectory, memoryId, 'memory.json'), {
          ...memory,
          recordingIds: repairedRecordingIds,
        });
      }
    }
  }
}

async function writeFinalizeTransactionMarker({
  targetRecordingDirectory,
  memoryId,
  recordingId,
}: {
  readonly targetRecordingDirectory: string;
  readonly memoryId: string;
  readonly recordingId: string;
}): Promise<void> {
  await writeWorkspaceJsonAtomic(path.join(targetRecordingDirectory, FINALIZE_TRANSACTION_MARKER), {
    schemaVersion: 1,
    memoryId,
    recordingId,
    draftPath: `.reo/drafts/recordings/${recordingId}`,
  });
}

async function copyDirectoryContents(
  sourceDirectory: string,
  targetDirectory: string
): Promise<void> {
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    await cp(path.join(sourceDirectory, entry.name), path.join(targetDirectory, entry.name), {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  }
}

async function copyDraftRecordingIntoMemory({
  rootPath,
  memoryId,
  recordingId,
  hooks,
}: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly recordingId: string;
  readonly hooks?: FinalizeTransactionHooks;
}): Promise<{
  readonly stagingRecordingDirectory: string;
  readonly targetRecordingDirectory: string;
}> {
  const draftDirectory = await draftRecordingDirectory(rootPath, recordingId);
  const targetDirectory = await memoryRecordingDirectory(rootPath, memoryId, recordingId);
  const parentDirectory = path.dirname(targetDirectory);
  const stagingDirectory = path.join(
    parentDirectory,
    `${FINALIZE_STAGING_PREFIX}${recordingId}.${process.pid}.${Date.now()}`
  );
  await mkdir(parentDirectory, { recursive: true });
  await mkdir(stagingDirectory, { recursive: false });
  await writeFinalizeTransactionMarker({
    targetRecordingDirectory: stagingDirectory,
    memoryId,
    recordingId,
  });
  hooks?.afterMarkerWrite?.();
  await fsyncWorkspaceDirectory(stagingDirectory);
  await copyDirectoryContents(draftDirectory, stagingDirectory);
  hooks?.afterCopy?.();
  await fsyncDirectoryTree(stagingDirectory);
  return { stagingRecordingDirectory: stagingDirectory, targetRecordingDirectory: targetDirectory };
}

async function writeFinalizedRecordingFiles({
  targetRecordingDirectory,
  workspaceId,
  memoryId,
  recordingId,
  title,
  durationMs,
  finalizedAt,
}: {
  readonly targetRecordingDirectory: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly recordingId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
}): Promise<number> {
  for (const requiredPath of [
    targetRecordingDirectory,
    path.join(targetRecordingDirectory, 'audio.webm'),
  ]) {
    const entry = await lstat(requiredPath);
    if (entry.isSymbolicLink()) {
      throw new Error('Recording finalize path crosses a symlink');
    }
  }
  const draftMetadata = JSON.parse(
    await readFile(path.join(targetRecordingDirectory, 'recording.json'), 'utf8')
  ) as { readonly createdAt?: string; readonly nextSequence?: number };
  const audio = await stat(path.join(targetRecordingDirectory, 'audio.webm'));
  await writeFinalizeTransactionMarker({ targetRecordingDirectory, memoryId, recordingId });
  await writeWorkspaceJsonAtomic(path.join(targetRecordingDirectory, 'recording.json'), {
    schemaVersion: 1,
    workspaceId,
    memoryId,
    recordingId,
    status: 'finalized',
    title,
    createdAt: draftMetadata.createdAt ?? finalizedAt,
    finalizedAt,
    durationMs,
    nextSequence: draftMetadata.nextSequence ?? 0,
    audioByteLength: audio.size,
    transcriptPath: 'transcript.md',
    reflectionsPath: 'reflections.md',
  });
  await writeWorkspaceFileAtomic(path.join(targetRecordingDirectory, 'transcript.md'), '');
  await writeWorkspaceFileAtomic(path.join(targetRecordingDirectory, 'reflections.md'), '');
  return audio.size;
}

async function finishFinalizeTransaction({
  rootPath,
  stagingRecordingDirectory,
  targetRecordingDirectory,
  memoryId,
  nextMemory,
  previousMemory,
  recordingId,
  workspaceId,
  title,
  durationMs,
  finalizedAt,
  rebuildIndex,
  hooks,
}: {
  readonly rootPath: string;
  readonly stagingRecordingDirectory: string;
  readonly targetRecordingDirectory: string;
  readonly memoryId: string;
  readonly nextMemory: MemoryJson;
  readonly previousMemory: MemoryJson | null;
  readonly recordingId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly durationMs: number;
  readonly finalizedAt: string;
  readonly rebuildIndex: (rootPath: string) => Promise<readonly MemorySummary[]>;
  readonly hooks?: FinalizeTransactionHooks;
}): Promise<MemorySummary> {
  const directory = await memoryDirectory(rootPath, memoryId);
  try {
    await writeFinalizedRecordingFiles({
      targetRecordingDirectory: stagingRecordingDirectory,
      workspaceId,
      memoryId,
      recordingId,
      title,
      durationMs,
      finalizedAt,
    });
    await fsyncDirectoryTree(stagingRecordingDirectory);
    hooks?.afterStagingTreeFsync?.();
    hooks?.beforeExpose?.();
    await rename(stagingRecordingDirectory, targetRecordingDirectory);
    await fsyncWorkspaceDirectory(path.dirname(targetRecordingDirectory));
    hooks?.afterParentFsync?.();
    await writeWorkspaceJsonAtomic(path.join(directory, 'memory.json'), nextMemory);
    await rebuildIndex(rootPath);
    await unlink(path.join(targetRecordingDirectory, FINALIZE_TRANSACTION_MARKER)).catch(() => {});
    await fsyncWorkspaceDirectory(targetRecordingDirectory).catch(() => {});
    await rm(await draftRecordingDirectory(rootPath, recordingId), {
      recursive: true,
      force: true,
    }).catch(() => {});
    return summarizeMemory(rootPath, nextMemory);
  } catch (error) {
    await rm(stagingRecordingDirectory, { recursive: true, force: true }).catch(() => {});
    await rm(targetRecordingDirectory, { recursive: true, force: true }).catch(() => {});
    if (previousMemory) {
      await writeWorkspaceJsonAtomic(path.join(directory, 'memory.json'), previousMemory).catch(
        () => {}
      );
    } else {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  }
}

export async function createMemoryForRecording(
  input: CreateMemoryForRecordingInput
): Promise<MemoryFilesResult<MemorySummary>> {
  const createdAt = input.now();
  const memory: MemoryJson = {
    memoryId: input.memoryId,
    title: input.title,
    sourceKind: 'recording',
    createdAt,
    updatedAt: createdAt,
    recordingIds: [input.recordingId],
  };

  try {
    const { stagingRecordingDirectory, targetRecordingDirectory } =
      await copyDraftRecordingIntoMemory({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        recordingId: input.recordingId,
        hooks: input.transactionHooks,
      });
    const summary = await finishFinalizeTransaction({
      rootPath: input.rootPath,
      stagingRecordingDirectory,
      targetRecordingDirectory,
      memoryId: input.memoryId,
      nextMemory: memory,
      previousMemory: null,
      recordingId: input.recordingId,
      workspaceId: input.workspaceId,
      title: input.title,
      durationMs: input.durationMs,
      finalizedAt: createdAt,
      rebuildIndex: input.rebuildIndex ?? rebuildMemoryIndex,
      hooks: input.transactionHooks,
    });
    return { ok: true, value: summary };
  } catch {
    return workspaceError(
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording could not be finalized',
      'draft-preserved'
    );
  }
}

export async function appendRecordingToMemory(
  input: AppendRecordingToMemoryInput
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    const current = await readMemoryJson(input.rootPath, input.memoryId);
    const updatedAt = input.now();
    const next: MemoryJson = {
      ...current,
      updatedAt,
      recordingIds: [
        ...current.recordingIds.filter((id) => id !== input.recordingId),
        input.recordingId,
      ],
    };
    const { stagingRecordingDirectory, targetRecordingDirectory } =
      await copyDraftRecordingIntoMemory({
        rootPath: input.rootPath,
        memoryId: input.memoryId,
        recordingId: input.recordingId,
        hooks: input.transactionHooks,
      });
    const summary = await finishFinalizeTransaction({
      rootPath: input.rootPath,
      stagingRecordingDirectory,
      targetRecordingDirectory,
      memoryId: input.memoryId,
      nextMemory: next,
      previousMemory: current,
      recordingId: input.recordingId,
      workspaceId: input.workspaceId,
      title: input.title,
      durationMs: input.durationMs,
      finalizedAt: updatedAt,
      rebuildIndex: input.rebuildIndex ?? rebuildMemoryIndex,
      hooks: input.transactionHooks,
    });
    return { ok: true, value: summary };
  } catch {
    return workspaceError(
      'ERR_RECORDING_FINALIZE_FAILED',
      'Recording could not be attached to memory',
      'draft-preserved'
    );
  }
}

export async function readMemoryDetail(
  input: ReadMemoryDetailInput
): Promise<MemoryFilesResult<MemoryDetail>> {
  try {
    const memory = await readMemoryJson(input.rootPath, input.memoryId);
    const recordings = [];
    for (const recordingId of memory.recordingIds) {
      const recordingDirectory = await memoryRecordingDirectory(
        input.rootPath,
        memory.memoryId,
        recordingId
      );
      const recording = JSON.parse(
        await readFile(path.join(recordingDirectory, 'recording.json'), 'utf8')
      );
      const audio = await stat(path.join(recordingDirectory, 'audio.webm'));
      recordings.push({
        recordingId,
        title: recording.title,
        durationMs: recording.durationMs ?? 0,
        audioByteLength: audio.size,
      });
    }
    return { ok: true, value: { ...memory, recordings } };
  } catch {
    return workspaceError('ERR_MEMORY_NOT_FOUND', 'Memory not found', 'none-written');
  }
}

export async function updateMemoryTitleFromFileTruth(
  input: UpdateMemoryTitleInput
): Promise<MemoryFilesResult<MemorySummary>> {
  try {
    const current = await readMemoryJson(input.rootPath, input.memoryId);
    const next = { ...current, title: input.title, updatedAt: input.now() };
    const directory = await memoryDirectory(input.rootPath, input.memoryId);
    await writeWorkspaceJsonAtomic(path.join(directory, 'memory.json'), next);
    await rebuildMemoryIndex(input.rootPath);
    return { ok: true, value: await summarizeMemory(input.rootPath, next) };
  } catch {
    return workspaceError('ERR_MEMORY_NOT_FOUND', 'Memory not found', 'previous-file-preserved');
  }
}
```

同步调整：

- `atomicWorkspaceFile.ts`：把 `writeWorkspaceFileAtomic` 改为 `open(temp, 'wx') -> writeFile -> fileHandle.sync() -> close -> rename -> open(parentDir, 'r') -> dirHandle.sync() -> close`；失败时 best-effort 删除 temp file。测试使用 injectable helper 验证 fsync 顺序。
- `workspaceContract.ts`：新增 `ERR_MEMORY_NOT_FOUND`、`workspaceMemorySummarySchema`、`workspaceMemoryDetailSchema`；`workspaceSnapshotSchema` 从 `recordings` 改为 `memories`；`workspaceMemorySummarySchema` 包含 `memoryId/title/createdAt/updatedAt/recordingCount/durationMs/audioByteLength/hasTranscript/hasReflections`；`workspaceRecordingFinalizeRequestSchema` 增加 optional `memoryId` 和 required `durationMs`，返回值增加 `memoryId/durationMs`。
- `workspaceFiles.ts`：`initializeWorkspaceFiles` 创建 `memories/` 和 `.reo/drafts/recordings/`；open/rebuild 前调用 `recoverRecordingFinalizeTransactions(rootPath)`，只清理由 Reo 创建的 `.reo-finalizing-*` staging directory，或带 `.reo-finalize-transaction.json` marker 且不是有效 finalized recording 的 target directory；不按任意 `.finalizing` 字符串删除用户目录。保留 draft，成功 finalization 只删除 marker；`readOrRebuildIndex` 调用 `rebuildMemoryIndex(rootPath)`，不再从 legacy `recordings/` 读用户内容真源。
- `recordingDrafts.ts`：draft directory 改为 `.reo/drafts/recordings/<recordingId>/`；`finalizeRecordingDraft` 调用 `createMemoryForRecording`，new-memory path 使用 `createMemoryId()`，existing-memory path 调用 `appendRecordingToMemory`。
- `recordingReads.ts`：从 `recordingDrafts.ts` 拆出 audio/transcript/reflections helpers；所有 read/save helper 接收 `memoryId + recordingId`，路径固定为 `memories/<memoryId>/recordings/<recordingId>/`；`workspaceIpc.ts` import 更新到新模块。

- [ ] **Step 6: 运行 GREEN 和固定门禁**

运行：

```bash
npm run test:main
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/data.md` 和 `docs/current/flow.md` 已描述文件真源、title update、append/finalize transaction、index rebuild 和 recovery 顺序。Delete 仍是 future wireframe，不写入 current behavior。

- [ ] **Step 7: Commit**

```bash
git status --short
git add -- src/main/memoryFiles.ts src/main/atomicWorkspaceFile.ts src/main/workspaceContract.ts src/main/workspaceFiles.ts src/main/recordingDrafts.ts src/main/recordingReads.ts test/main/memoryFiles.test.ts test/main/recordingDrafts.test.ts test/main/workspaceFiles.test.ts docs/current/data.md docs/current/flow.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-1-workspace-file-truth
git commit -m "feat: persist recordings under durable memories"
```

## 任务 2： 显式 IPC、preload 和 microphone intent

**Files:**

- Modify: `src/main/workspaceChannels.ts`
- Modify: `src/main/workspaceContract.ts`
- Modify: `src/main/workspaceIpc.ts`
- Modify: `src/main/security.ts`
- Modify: `src/preload/workspaceBridge.ts`
- Modify: `src/renderer/src/types/reoWorkspace.d.ts`
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Test: `test/main/securityPolicy.test.ts`
- Test: `test/main/workspaceIpc.test.ts`
- Test: `test/main/workspaceBridgeSurface.test.ts`
- Test: `src/renderer/src/workspace/workspaceApi.test.ts`
- Docs: `docs/current/electron.md`
- Docs: `docs/current/quality.md`

- [ ] **Step 1: 写 RED 测试，拒绝无 intent 的麦克风权限**

在 `test/main/securityPolicy.test.ts` 新增：

```ts
test('denies microphone permission without a one-shot renderer intent', async () => {
  const decision = await decideMediaPermissionRequest({
    permission: 'media',
    senderFrameUrl: 'reo-app://renderer/index.html',
    requested: { audio: true, video: false },
    senderId: 1,
  });

  assert.equal(decision, false);
});
```

- [ ] **Step 2: 写 RED 测试，intent 只能消费一次**

```ts
test('consumes a microphone intent once for the matching sender', async () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 2,
      requested: { audio: true, video: false },
    }),
    false
  );
  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    true
  );
  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    false
  );
});
```

在同文件新增：

```ts
test('expires microphone intent by TTL before browser permission is granted', async () => {
  createMicrophoneIntent({
    senderId: 1,
    workspaceHandle: 'wh_1',
    drawerSessionId: 'drawer_1',
    now: () => 1_000,
  });

  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
      now: () => 16_001,
    }),
    false
  );
});

test('permission check never grants media without the request handler consuming intent', async () => {
  assert.equal(
    decideMediaPermissionCheck({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    false
  );

  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    decideMediaPermissionCheck({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    false
  );
  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    true
  );
  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    false
  );
});

test('rejects a second active microphone intent for the same sender', async () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  const second = createMicrophoneIntent({
    senderId: 1,
    workspaceHandle: 'wh_2',
    drawerSessionId: 'drawer_1',
  });

  assert.equal(second.ok, false);
  assert.equal(second.error.code, 'ERR_MIC_INTENT_ALREADY_ACTIVE');
});

test('clear requires the matching workspace and drawer session owner', async () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  clearMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_2', drawerSessionId: 'drawer_1' });
  clearMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_2' });

  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    true
  );
});

test('clears only the matching microphone intent when recording is cancelled', async () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });
  createMicrophoneIntent({ senderId: 2, workspaceHandle: 'wh_2', drawerSessionId: 'drawer_2' });

  clearMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    false
  );
  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 2,
      requested: { audio: true, video: false },
    }),
    true
  );
});
```

- [ ] **Step 3: 写 RED 测试，valid intent + untrusted origin 仍拒绝**

```ts
test('denies microphone permission for an untrusted origin even with a valid intent', async () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'https://example.test/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    false
  );
  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: false },
    }),
    false
  );
});
```

- [ ] **Step 4: 写 RED 测试，trusted origin + valid intent 仍拒绝 video/camera**

```ts
test('denies video or camera media even for a trusted renderer with a valid microphone intent', async () => {
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_1' });

  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: true, video: true },
    }),
    false
  );
  createMicrophoneIntent({ senderId: 1, workspaceHandle: 'wh_1', drawerSessionId: 'drawer_2' });
  assert.equal(
    await decideMediaPermissionRequest({
      permission: 'media',
      senderFrameUrl: 'reo-app://renderer/index.html',
      senderId: 1,
      requested: { audio: false, video: true },
    }),
    false
  );
});
```

- [ ] **Step 5: 写 RED 测试，preload surface 没有 generic invoke**

在 `test/main/workspaceBridgeSurface.test.ts` 增加期望：

```ts
assert.equal(exposedKeys.includes('beginMicrophoneIntent'), true);
assert.equal(exposedKeys.includes('clearMicrophoneIntent'), true);
assert.equal(exposedKeys.includes('getMemoryDetail'), true);
assert.equal(exposedKeys.includes('invoke'), false);
assert.equal(exposedKeys.includes('send'), false);
```

- [ ] **Step 6: 运行 RED**

运行：

```bash
npm run test:main
npx vitest run src/renderer/src/workspace/workspaceApi.test.ts
```

预期： FAIL，原因是 intent channel、memory detail channel 和 preload methods 尚不存在。

- [ ] **Step 7: 写最小实现**

新增 explicit channels：

```ts
export const workspaceChannels = {
  getMemoryDetail: 'workspace:getMemoryDetail',
  beginMicrophoneIntent: 'workspace:beginMicrophoneIntent',
  clearMicrophoneIntent: 'workspace:clearMicrophoneIntent',
} as const;
```

新增 renderer API：

```ts
export async function beginMicrophoneIntent(input: BeginMicrophoneIntentRequest) {
  return window.reoWorkspace.beginMicrophoneIntent(input);
}
```

`security.ts` 存储 sender-scoped one-shot intent，并在 intent metadata 中保存 workspace handle 和 drawer session id 用于 begin/clear ownership。Electron permission runtime 必须同时实现 `setPermissionCheckHandler` 和 `setPermissionRequestHandler`：permission check handler 对 `media` 永远返回 `false`，不在 check 阶段 grant，也不消费 intent；permission request handler 先消费该 sender 恰好一个 active intent，再判断 audio-only 和 trusted origin，只有全部满足时才 grant。handler 运行时只能依赖 `webContents/sender`、origin 和 media request details；它不能相信 renderer 传入 workspace/drawer 字段，也不能要求 permission request 携带这些字段。intent TTL 固定为 15 秒；同一 sender 已有未过期 intent 时，新的 `beginMicrophoneIntent` 必须返回 `ERR_MIC_INTENT_ALREADY_ACTIVE`。`beginMicrophoneIntent` 创建 intent 后必须返回 `microphoneIntentId/expiresAt`，renderer 未收到成功 response 不得调用 `getUserMedia`。

```ts
const MICROPHONE_INTENT_TTL_MS = 15_000;

type StoredMicrophoneIntent = {
  readonly microphoneIntentId: string;
  readonly senderId: number;
  readonly workspaceHandle: string;
  readonly drawerSessionId: string;
  readonly expiresAt: number;
};

const microphoneIntents = new Map<string, StoredMicrophoneIntent>();

function pruneExpiredMicrophoneIntents(now: number): void {
  for (const [microphoneIntentId, intent] of microphoneIntents) {
    if (intent.expiresAt <= now) {
      microphoneIntents.delete(microphoneIntentId);
    }
  }
}

export function createMicrophoneIntent(input: CreateMicrophoneIntentInput) {
  const now = input.now?.() ?? Date.now();
  pruneExpiredMicrophoneIntents(now);
  const activeForSender = [...microphoneIntents.values()].some(
    (intent) => intent.senderId === input.senderId
  );
  if (activeForSender) {
    return workspaceError(
      'ERR_MIC_INTENT_ALREADY_ACTIVE',
      'Microphone intent already active',
      'none-written'
    );
  }
  const intent = {
    microphoneIntentId: createMicrophoneIntentId(),
    senderId: input.senderId,
    workspaceHandle: input.workspaceHandle,
    drawerSessionId: input.drawerSessionId,
    expiresAt: now + MICROPHONE_INTENT_TTL_MS,
  };
  microphoneIntents.set(intent.microphoneIntentId, intent);
  return intent;
}

export function clearMicrophoneIntent(input: ClearMicrophoneIntentInput): void {
  for (const [microphoneIntentId, intent] of microphoneIntents) {
    if (
      intent.senderId === input.senderId &&
      intent.workspaceHandle === input.workspaceHandle &&
      intent.drawerSessionId === input.drawerSessionId
    ) {
      microphoneIntents.delete(microphoneIntentId);
    }
  }
}

export function consumeMicrophoneIntent(input: ConsumeMicrophoneIntentInput): boolean {
  const now = input.now?.() ?? Date.now();
  pruneExpiredMicrophoneIntents(now);
  const senderIntents = [...microphoneIntents.entries()].filter(
    ([, intent]) => intent.senderId === input.senderId
  );
  if (senderIntents.length !== 1) {
    for (const [microphoneIntentId] of senderIntents) {
      microphoneIntents.delete(microphoneIntentId);
    }
    return false;
  }
  microphoneIntents.delete(senderIntents[0][0]);
  return true;
}

export function decideMediaPermissionCheck(_input: MediaPermissionCheckInput): false {
  return false;
}

export function decideMediaPermissionRequest(input: MediaPermissionRequestInput): boolean {
  if (input.permission !== 'media') {
    return false;
  }
  const consumed = consumeMicrophoneIntent({ senderId: input.senderId, now: input.now });
  return (
    consumed &&
    input.requested.audio === true &&
    input.requested.video === false &&
    isTrustedAppUrl(input.senderFrameUrl)
  );
}
```

`workspaceIpc.ts` 的 `beginMicrophoneIntent` 和 `clearMicrophoneIntent` handlers 必须用 `event.sender.id` 作为 sender identity，不能相信 renderer 传入 senderId。`clearMicrophoneIntent` 必须校验 workspaceHandle 属于该 sender，且 drawerSessionId 与 active intent metadata 匹配；drawer cancel、unmount、workspace switch、intent timeout 和离开 acquiring 状态但未进入 browser permission request decision 时都要调用。permission request handler 成功、拒绝、发现 expired intent 或发现同 sender 多 active intent 后都不能留下可复用 intent。

- [ ] **Step 8: 运行 GREEN 和固定门禁**

运行：

```bash
npm run test:main
npx vitest run src/renderer/src/workspace/workspaceApi.test.ts
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/electron.md` 记录 explicit IPC、sender validation、mic intent 和 permission policy。

- [ ] **Step 9: Commit**

```bash
git status --short
git add -- src/main/workspaceChannels.ts src/main/workspaceContract.ts src/main/workspaceIpc.ts src/main/security.ts src/preload/workspaceBridge.ts src/renderer/src/types/reoWorkspace.d.ts src/renderer/src/workspace/workspaceApi.ts src/renderer/src/workspace/workspaceApi.test.ts test/main/securityPolicy.test.ts test/main/workspaceIpc.test.ts test/main/workspaceBridgeSurface.test.ts docs/current/electron.md docs/current/quality.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-2-ipc-microphone-intent
git commit -m "feat: add memory IPC and microphone permission intent"
```

## 任务 3： Workspace entry create/open flow

**Files:**

- Create: `src/renderer/src/workspace/WorkspaceEntryPage.tsx`
- Create: `src/renderer/src/workspace/OpenWorkspaceAction.tsx`
- Create: `src/renderer/src/workspace/FolderPickerField.tsx`
- Create: `src/renderer/src/workspace/WorkspaceErrorBanner.tsx`
- Create via shadcn source: `src/renderer/src/components/ui/input.tsx`
- Modify: `src/renderer/src/workspace/CreateWorkspaceForm.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/renderer/src/workspace/CreateWorkspaceForm.test.tsx`
- Test: `src/renderer/src/App.test.tsx`
- Docs: `docs/current/frontend.md`

- [ ] **Step 1: 写 RED 测试，验证 submit-time validation**

```tsx
it('validates on submit instead of trapping users in a disabled button', async () => {
  render(<WorkspaceEntryPage />);

  await userEvent.click(screen.getByRole('button', { name: /create workspace/i }));

  expect(await screen.findByText(/workspace title is required/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/workspace title/i)).toHaveFocus();
});
```

- [ ] **Step 2: 写 RED 测试，create/open 错误分支分离**

```tsx
it('keeps create draft values while opening an existing workspace', async () => {
  render(<WorkspaceEntryPage />);

  await userEvent.type(screen.getByLabelText(/workspace title/i), 'Family memories');
  await userEvent.click(screen.getByRole('button', { name: /open workspace/i }));

  expect(screen.getByDisplayValue('Family memories')).toBeInTheDocument();
  expect(screen.queryByText(/workspace already exists/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: 写 RED 测试，workspace entry 不保存 raw path**

```tsx
it('submits the folder selection token instead of a raw filesystem path', async () => {
  vi.mocked(selectWorkspaceFolder).mockResolvedValue(
    ok({ selectionToken: 'folder_token_1', displayPath: 'Memories' })
  );
  render(<WorkspaceEntryPage />);

  await userEvent.type(screen.getByLabelText(/workspace title/i), 'Family memories');
  await userEvent.click(screen.getByRole('button', { name: /choose folder/i }));
  await userEvent.click(screen.getByRole('button', { name: /create workspace/i }));

  expect(createWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({ selectionToken: 'folder_token_1' })
  );
  expect(createWorkspace).not.toHaveBeenCalledWith(
    expect.objectContaining({ displayPath: expect.any(String) })
  );
  expect(createWorkspace).not.toHaveBeenCalledWith(
    expect.objectContaining({ folderPath: expect.any(String) })
  );
});
```

- [ ] **Step 4: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx
```

预期： FAIL，原因是 `WorkspaceEntryPage`、open branch 和 shadcn Input consumer 尚不存在。

- [ ] **Step 5: 引入 source 并绑定真实 consumer**

运行：

```bash
npx shadcn@4.7.0 add input
```

只接受 `input.tsx` 和必要 dependency/package-lock diff；`Input` 必须立刻用于 `CreateWorkspaceForm`、`FolderPickerField` 或 `WorkspaceEntryPage`。

- [ ] **Step 6: 写最小实现**

实现 RHF + Zod：

```ts
const createWorkspaceSchema = z.object({
  title: z.string().trim().min(1, 'Workspace title is required'),
  selectionToken: z.string().trim().min(1, 'Choose a workspace folder'),
  displayPath: z.string().trim().min(1, 'Choose a workspace folder'),
});
```

`FolderPickerField` 只把 main process 返回的 `selectionToken + displayPath` 写入 RHF state；`displayPath` 只能是 renderer 展示字段，必须使用当前 `workspaceContract.ts` 的 basename/display schema，不得包含 `/` 或 `\`。`workspace:initialize` request 只发送 `selectionToken/title/description`，`workspace:open` request 只发送 `selectionToken`；renderer state、React Query key 和 preload request 都不得持久化 raw absolute path 或 displayPath。main process 用 token resolve 当前授权 folder，错误映射保留 create/open 分支差异。

状态拆分：

```ts
type WorkspaceEntryState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'opening' }
  | { status: 'create-error'; error: CreateWorkspaceError }
  | { status: 'open-error'; error: OpenWorkspaceError };
```

create errors：`conflict`、`permission`、`invalid`、`expired`。open errors：`missing`、`locked`、`corrupt`、`unsupported`。

- [ ] **Step 7: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.test.tsx
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/frontend.md` 记录 Workspace entry、RHF/Zod、Input source consumer。

- [ ] **Step 8: Commit**

```bash
git status --short
git add -- package.json package-lock.json src/renderer/src/components/ui/input.tsx src/renderer/src/workspace/WorkspaceEntryPage.tsx src/renderer/src/workspace/OpenWorkspaceAction.tsx src/renderer/src/workspace/FolderPickerField.tsx src/renderer/src/workspace/WorkspaceErrorBanner.tsx src/renderer/src/workspace/CreateWorkspaceForm.tsx src/renderer/src/workspace/CreateWorkspaceForm.test.tsx src/renderer/src/App.tsx src/renderer/src/App.test.tsx docs/current/frontend.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-3-workspace-entry
git commit -m "feat: build product-grade workspace entry flow"
```

## 任务 4： App shell、sidebar 和 lucide icon controls

**Files:**

- Create: `src/renderer/src/app-shell/AppShell.tsx`
- Create: `src/renderer/src/app-shell/AppShell.test.tsx`
- Create via shadcn source: `src/renderer/src/components/ui/tooltip.tsx`
- Create via shadcn source: `src/renderer/src/components/ui/separator.tsx`
- Create via shadcn source: `src/renderer/src/components/ui/scroll-area.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/renderer/src/workspace/ForbiddenCapabilities.test.tsx`
- Docs: `docs/current/frontend.md`

- [ ] **Step 1: 写 RED 测试，分层 sidebar shell 与 future capability 禁止**

```tsx
it('renders a layered workspace sidebar without unimplemented media routes', () => {
  render(
    <AppShell sidebarState="expanded" sidebarWidth={240}>
      <div>Home content</div>
    </AppShell>
  );

  expect(screen.getByRole('navigation', { name: /workspace/i })).toBeInTheDocument();
  expect(screen.getByTestId('app-shell-sidebar')).toHaveStyle({ zIndex: '1' });
  expect(screen.getByTestId('app-shell-panel')).toHaveStyle({ zIndex: '2' });
  expect(screen.getByTestId('app-shell-panel')).toHaveStyle({ inset: '8px' });
  expect(screen.getByTestId('app-shell-panel')).toHaveStyle({ borderRadius: '12px' });
  expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
  expect(screen.queryByText(/films|photos|videos|files/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 写 RED 测试，covered 状态覆盖 sidebar 而不是推挤布局**

```tsx
it('covers the sidebar with a transform-driven floating panel when collapsed', () => {
  render(
    <AppShell sidebarState="covered" sidebarWidth={240}>
      <div>Home content</div>
    </AppShell>
  );

  expect(screen.getByRole('button', { name: /show sidebar/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
  expect(screen.getByTestId('app-shell-panel')).toHaveStyle({
    transform: 'translateX(0px)',
    transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
  });
});
```

- [ ] **Step 3: 写 RED 测试，sidebar resize clamp 到 240-520px**

```tsx
it('clamps direct sidebar resizing between 240 and 520 pixels', async () => {
  const onSidebarWidthChange = vi.fn();
  render(
    <AppShell
      sidebarState="expanded"
      sidebarWidth={240}
      onSidebarWidthChange={onSidebarWidthChange}
    >
      <div>Home content</div>
    </AppShell>
  );

  await dragResizeHandle(screen.getByRole('separator', { name: /resize sidebar/i }), 900);

  expect(onSidebarWidthChange).toHaveBeenLastCalledWith(520);
});
```

- [ ] **Step 4: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx
```

预期： FAIL，原因是 `AppShell`、分层 panel、resize handle 和相关 source consumer 尚不存在。

- [ ] **Step 5: 引入 source 并绑定真实 consumer**

运行：

```bash
npx shadcn@4.7.0 add tooltip separator scroll-area
npm install lucide-react@1.14.0
```

`Tooltip` 只用于 covered reveal/icon controls，`Separator` 用于 sidebar resize handle 或 sidebar/main semantic separation，`ScrollArea` 用于 sidebar/main overflow。`lucide-react` 只用于 icon controls；不使用 emoji。

- [ ] **Step 6: 写最小实现**

实现：

- Sidebar 底层 `z-index: 1`，`height: 100vh`，`width: var(--sidebar-width)`。
- Sidebar width clamp：最小 `240px`，最大 `520px`，首次默认 `240px`。
- 主内容悬浮面板 `z-index: 2`，`position: absolute`，`inset: 8px`，`border-radius: 12px`。
- Expanded 状态：panel `transform: translateX(var(--sidebar-width))`。
- Covered 状态：panel `transform: translateX(0px)`，覆盖 sidebar，而不是把 sidebar 推出视野。
- 展开/折叠 transition：`transform 280ms cubic-bezier(0.16, 1, 0.3, 1)`；reduced motion 下关闭 motion。
- 拖拽 resize 是 direct manipulation，只更新 `--sidebar-width`，不对 width transition。
- macOS window controls 保留在 sidebar 图层左上角之上；不创建 app top bar。
- navigation 只有 Home 和 Record/New memory。
- icon-only button 必须有 `aria-label`。
- responsive layout 不使用 nested cards。

- [ ] **Step 7: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/frontend.md` 记录 layered shell、240-520px resize、8px/12px panel、280ms transform motion、lucide 和新增 shadcn source consumers。

- [ ] **Step 8: Commit**

```bash
git status --short
git add -- package.json package-lock.json src/renderer/src/app-shell/AppShell.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/components/ui/tooltip.tsx src/renderer/src/components/ui/separator.tsx src/renderer/src/components/ui/scroll-area.tsx src/renderer/src/App.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx docs/current/frontend.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-4-app-shell-sidebar
git commit -m "feat: add workspace app shell"
```

## 任务 5： Home local search、month sections 和 memory cards

**Files:**

- Modify: `src/renderer/src/workspace/WorkspaceHome.tsx`
- Create: `src/renderer/src/workspace/MemoryCard.tsx`
- Create: `src/renderer/src/workspace/MemorySection.tsx`
- Create: `src/renderer/src/workspace/MemorySearchBar.tsx`
- Modify: `src/renderer/src/workspace/WorkspaceHome.test.tsx`
- Modify: `src/renderer/src/workspace/workspaceQueries.ts`
- Docs: `docs/current/frontend.md`
- Docs: `docs/current/data.md`

- [ ] **Step 1: 写 RED 测试，Home 显示 All memories 与本地搜索**

```tsx
it('filters the loaded workspace snapshot locally without claiming global search', async () => {
  render(<WorkspaceHome snapshot={snapshotWithTwoMemories} />);

  await userEvent.type(screen.getByRole('searchbox', { name: /search memories/i }), 'birthday');

  expect(screen.getByRole('heading', { name: /all memories/i })).toBeInTheDocument();
  expect(screen.getByText('My seventh birthday')).toBeInTheDocument();
  expect(screen.queryByText('Morning note')).not.toBeInTheDocument();
  expect(screen.queryByText(/global search/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 写 RED 测试，month sections 和 empty/loading/error 状态**

```tsx
it('groups memories by month and keeps empty state scoped to recordings', () => {
  render(<WorkspaceHome snapshot={snapshotWithMayAndAprilMemories} />);

  expect(screen.getByRole('heading', { name: 'May 2026' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'April 2026' })).toBeInTheDocument();
  expect(screen.queryByText(/photos|videos|films/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/workspace/WorkspaceHome.test.tsx
```

预期： FAIL，原因是当前 Home 只有简单 recording list，没有 All memories、本地 search 和 month grouping。

- [ ] **Step 4: 写最小实现**

实现本地 derived state：

```ts
const visibleMemories = useMemo(
  () => filterLoadedMemories(snapshot.memories, searchTerm),
  [snapshot.memories, searchTerm]
);
```

`searchTerm` 是 `WorkspaceHome` component state；不得进入 TanStack Query key。只有出现跨 subtree UI state owner 并同步 `docs/current/data.md` 后，才允许引入 Zustand store。`MemoryCard` 只显示 title、date、recording count、duration summary、open detail action。

- [ ] **Step 5: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/workspace/WorkspaceHome.test.tsx
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/data.md` 记录 Home local search 不拥有 server/global query semantics。

- [ ] **Step 6: Commit**

```bash
git status --short
git add -- src/renderer/src/workspace/WorkspaceHome.tsx src/renderer/src/workspace/WorkspaceHome.test.tsx src/renderer/src/workspace/MemoryCard.tsx src/renderer/src/workspace/MemorySection.tsx src/renderer/src/workspace/MemorySearchBar.tsx src/renderer/src/workspace/workspaceQueries.ts docs/current/frontend.md docs/current/data.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-5-home-memories
git commit -m "feat: build memories home surface"
```

## 任务 6： Memory detail 高保真页面与 future More wireframe 边界

**Files:**

- Create: `src/renderer/src/workspace/MemoryDetailPage.tsx`
- Create: `src/renderer/src/workspace/MemoryDetailPage.test.tsx`
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Modify: `src/renderer/src/workspace/workspaceQueries.ts`
- Modify: `src/renderer/src/App.tsx`
- Docs: `docs/current/frontend.md`
- Docs: `docs/current/data.md`

- [ ] **Step 1: 写 RED 测试，detail 读取 memoryId + recordingId**

```tsx
it('renders memory detail from file-backed memory detail data', async () => {
  render(<MemoryDetailPage workspaceHandle="wh_1" workspaceId="ws_1" memoryId="mem_1" />);

  expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
  expect(screen.getByText(/recordings/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /record memory/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: 写 RED 测试，More 只作为 future wireframe 不可点击**

```tsx
it('does not expose unimplemented More actions as clickable commands', async () => {
  render(<MemoryDetailPage workspaceHandle="wh_1" workspaceId="ws_1" memoryId="mem_1" />);

  expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();
  expect(
    screen.queryByRole('menuitem', { name: /rename|delete|show in folder|export/i })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /delete memory/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/workspace/MemoryDetailPage.test.tsx src/renderer/src/workspace/workspaceApi.test.ts
```

预期： FAIL，原因是 memory detail page/query 和 nested API 尚不存在。

- [ ] **Step 4: 写最小实现**

新增 query：

```ts
export const memoryDetailQueryKey = (input: {
  readonly workspaceId: string;
  readonly memoryId: string;
}) => ['workspace', 'memory-detail', input.workspaceId, input.memoryId] as const;
```

`MemoryDetailPage` 使用 high-fidelity layout：title、date metadata、recording list、record action、transcript/reflections sections。`More` 的 rename/delete/show in folder/export 只保留在 spec wireframe，不在 current build 中暴露 clickable command。

`MemoryDetailPage` props 必须同时携带 `workspaceId` 和 `workspaceHandle`：`workspaceId` 只用于 query key 和 route identity，`workspaceHandle` 只作为 `getMemoryDetail` request capability 传入 preload API，不得进入 query key、文件、URL、DOM attribute 或跨 restart persistence。

- [ ] **Step 5: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/workspace/MemoryDetailPage.test.tsx src/renderer/src/workspace/workspaceApi.test.ts
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/frontend.md` 记录 Memory detail 的当前能力和 future More 边界。

- [ ] **Step 6: Commit**

```bash
git status --short
git add -- src/renderer/src/workspace/MemoryDetailPage.tsx src/renderer/src/workspace/MemoryDetailPage.test.tsx src/renderer/src/workspace/workspaceApi.ts src/renderer/src/workspace/workspaceQueries.ts src/renderer/src/App.tsx docs/current/frontend.md docs/current/data.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-6-memory-detail
git commit -m "feat: add memory detail page"
```

## 任务 7： 先移除 RecordingOverlay mock transcript

**Files:**

- Modify: `src/renderer/src/workspace/RecordingOverlay.test.tsx`
- Modify: `src/renderer/src/workspace/RecordingOverlay.tsx`
- Modify: `src/renderer/src/workspace/recordingMachine.ts`
- Modify: `src/renderer/src/workspace/recordingMachine.test.ts`
- Docs: `docs/current/frontend.md`
- Docs: `docs/current/quality.md`

- [ ] **Step 1: 反转现有测试，形成干净 RED**

把 `RecordingOverlay.test.tsx` 中期待 `Mock transcript 1s/2s` 出现的断言改为负向断言：

```tsx
expect(screen.queryByText(/Mock transcript/i)).not.toBeInTheDocument();
expect(screen.queryByDisplayValue(/Mock transcript/i)).not.toBeInTheDocument();
```

新增保护：

```tsx
it('does not synthesize transcript text while recording locally', async () => {
  render(<RecordingOverlay {...recordingOverlayProps} open />);

  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
  vi.advanceTimersByTime(1000);

  expect(screen.getByText(/Status: recording/)).toBeInTheDocument();
  expect(screen.queryByText(/Mock transcript/i)).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue(/Mock transcript/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx
```

预期： FAIL，原因是 `RecordingOverlay.tsx` 当前仍在 timer 中写入 `Mock transcript ${next}s`。

- [ ] **Step 3: 写最小实现**

删除 transcript timer 和 mock line append。`recordingMachine` 保持真实 lifecycle，不生成 transcript 文本。停止录音后 transcript/reflections fields 初始为空，等待用户编辑或未来 STT foundation 写入。

- [ ] **Step 4: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/frontend.md` 和 `docs/current/quality.md` 明确 current slice 无 STT/mock transcript。

- [ ] **Step 5: Commit**

```bash
git status --short
git add -- src/renderer/src/workspace/RecordingOverlay.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx src/renderer/src/workspace/recordingMachine.ts src/renderer/src/workspace/recordingMachine.test.ts docs/current/frontend.md docs/current/quality.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-7-remove-mock-transcript
git commit -m "fix: remove mock transcript generation"
```

## 任务 8： Recording drawer、ElevenLabs waveform 和 voice control

**Files:**

- Create: `src/renderer/src/workspace/recording/RecordAudioDrawer.tsx`
- Create: `src/renderer/src/workspace/recording/RecordingControls.tsx`
- Create: `src/renderer/src/workspace/recording/RecordingWaveform.tsx`
- Create: `src/renderer/src/workspace/recording/RecordingErrorState.tsx`
- Create via shadcn source: `src/renderer/src/components/ui/drawer.tsx`
- Create via ElevenLabs source: `src/renderer/src/components/ui/waveform.tsx`
- Create via ElevenLabs source: `src/renderer/src/components/ui/voice-button.tsx`
- Modify: `src/renderer/src/workspace/RecordingOverlay.tsx`
- Modify: `src/renderer/src/workspace/recordingMachine.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx`
- Test: `src/renderer/src/workspace/recordingMachine.test.ts`
- Docs: `docs/current/frontend.md`

- [ ] **Step 1: 写 RED 测试，drawer dialog 语义和不可录音关闭保护**

```tsx
it('renders a labelled bottom drawer and prevents accidental close while recording', async () => {
  render(
    <RecordAudioDrawer
      open
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      target={{ kind: 'existing-memory', memoryId: 'mem_1' }}
      onOpenChange={onOpenChange}
    />
  );

  expect(screen.getByRole('dialog', { name: /record memory/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /start recording/i }));
  await userEvent.keyboard('{Escape}');

  expect(onOpenChange).not.toHaveBeenCalledWith(false);
});
```

- [ ] **Step 2: 写 RED 测试，从 Home 录音不要求已有 memoryId 且不提前建 draft**

```tsx
it('starts a new memory recording intent without creating a draft before permission succeeds', async () => {
  const onStartRecording = vi.fn().mockResolvedValue({ ok: true, value: { recordingId: 'rec_1' } });
  render(
    <RecordAudioDrawer
      open
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      target={{ kind: 'new-memory', titleDraft: 'Untitled memory' }}
      onOpenChange={vi.fn()}
      onStartRecording={onStartRecording}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /start recording/i }));

  expect(createRecordingDraft).not.toHaveBeenCalled();
  expect(onStartRecording).toHaveBeenCalledWith(
    expect.objectContaining({
      target: { kind: 'new-memory', titleDraft: 'Untitled memory' },
      workspaceHandle: 'wh_1',
    })
  );
});
```

- [ ] **Step 3: 写 RED 测试，ElevenLabs-derived components 无网络和 agent copy**

```tsx
it('renders waveform and voice control without network or agent runtime copy', async () => {
  render(
    <RecordAudioDrawer
      open
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      target={{ kind: 'existing-memory', memoryId: 'mem_1' }}
      onOpenChange={vi.fn()}
    />
  );

  expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/audio waveform/i)).toBeInTheDocument();
  expect(screen.queryByText(/agent|cloud|api key|model/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 4: 写 RED 测试，failed event 从 idle/finalized 是 no-op**

在 `recordingMachine.test.ts` 新增：

```ts
it('ignores failed events from idle and finalized states', () => {
  const idle: RecordingState = { status: 'idle' };
  assert.deepEqual(
    transitionRecordingState(idle, { type: 'failed', message: 'late failure', canRetry: true }),
    idle
  );

  const finalized: RecordingState = {
    status: 'finalized',
    memoryId: 'mem_1',
    recordingId: 'rec_1',
  };
  assert.deepEqual(
    transitionRecordingState(finalized, {
      type: 'failed',
      message: 'late failure',
      canRetry: true,
    }),
    finalized
  );
});
```

- [ ] **Step 5: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
```

预期： FAIL，原因是 drawer、waveform、voice-button 和 `recording/` components 尚不存在。

- [ ] **Step 6: 引入 source 并绑定真实 consumer**

运行：

```bash
npx shadcn@4.7.0 add drawer
npx @elevenlabs/cli@0.5.2 components add waveform
npx @elevenlabs/cli@0.5.2 components add voice-button
npm install vaul@1.1.2
```

`drawer.tsx` 必须由 `RecordAudioDrawer` 使用。`waveform.tsx` 必须由 `RecordingWaveform` 使用。`voice-button.tsx` 必须由 `RecordingControls` 使用。删去 ElevenLabs demo network、agent runtime、API key 和 decorative copy。

- [ ] **Step 7: 写最小实现**

`recordingMachine.ts` 只保存状态转换，不调用 DOM、MediaRecorder 或 IPC：

```ts
export type RecordingTarget =
  | { readonly kind: 'new-memory'; readonly titleDraft?: string }
  | { readonly kind: 'existing-memory'; readonly memoryId: string };

export type RecordingState =
  | { status: 'idle' }
  | { status: 'acquiring-permission'; drawerSessionId: string; target: RecordingTarget }
  | { status: 'recording'; recordingId: string; target: RecordingTarget }
  | { status: 'paused'; recordingId: string; target: RecordingTarget }
  | { status: 'finalizing'; recordingId: string; target: RecordingTarget }
  | { status: 'finalized'; memoryId: string; recordingId: string }
  | { status: 'failed'; message: string; canRetry: boolean; target: RecordingTarget };

export type RecordingEvent =
  | { type: 'start-requested'; drawerSessionId: string; target: RecordingTarget }
  | { type: 'draft-ready'; recordingId: string }
  | { type: 'pause-requested' }
  | { type: 'resume-requested' }
  | { type: 'stop-requested' }
  | { type: 'finalized'; memoryId: string; recordingId: string }
  | { type: 'failed'; message: string; canRetry: boolean }
  | { type: 'reset' };

export function isRecordingCloseBlocked(state: RecordingState): boolean {
  return (
    state.status === 'acquiring-permission' ||
    state.status === 'recording' ||
    state.status === 'paused' ||
    state.status === 'finalizing'
  );
}

export function transitionRecordingState(
  state: RecordingState,
  event: RecordingEvent
): RecordingState {
  if (event.type === 'reset') {
    return { status: 'idle' };
  }
  if (event.type === 'start-requested' && (state.status === 'idle' || state.status === 'failed')) {
    return {
      status: 'acquiring-permission',
      drawerSessionId: event.drawerSessionId,
      target: event.target,
    };
  }
  if (event.type === 'draft-ready' && state.status === 'acquiring-permission') {
    return { status: 'recording', recordingId: event.recordingId, target: state.target };
  }
  if (event.type === 'pause-requested' && state.status === 'recording') {
    return { status: 'paused', recordingId: state.recordingId, target: state.target };
  }
  if (event.type === 'resume-requested' && state.status === 'paused') {
    return { status: 'recording', recordingId: state.recordingId, target: state.target };
  }
  if (
    event.type === 'stop-requested' &&
    (state.status === 'recording' || state.status === 'paused')
  ) {
    return { status: 'finalizing', recordingId: state.recordingId, target: state.target };
  }
  if (event.type === 'finalized' && state.status === 'finalizing') {
    return { status: 'finalized', memoryId: event.memoryId, recordingId: event.recordingId };
  }
  if (
    event.type === 'failed' &&
    (state.status === 'acquiring-permission' ||
      state.status === 'recording' ||
      state.status === 'paused' ||
      state.status === 'finalizing')
  ) {
    return {
      status: 'failed',
      message: event.message,
      canRetry: event.canRetry,
      target: state.target,
    };
  }
  return state;
}
```

`RecordAudioDrawer.tsx` 是状态编排层。Task 8 只接上 drawer、waveform 和 draft API；Task 9 再接真实 `MediaRecorder` chunk pipeline：

```tsx
export function RecordAudioDrawer({
  open,
  workspaceHandle,
  workspaceId,
  target,
  onOpenChange,
  onStartRecording,
}: RecordAudioDrawerProps) {
  const [state, setState] = useState<RecordingState>({ status: 'idle' });
  const busy = isRecordingCloseBlocked(state);

  function requestOpenChange(nextOpen: boolean) {
    if (!nextOpen && busy) {
      return;
    }
    onOpenChange(nextOpen);
  }

  async function startRecording() {
    const drawerSessionId = crypto.randomUUID();
    setState((current) =>
      transitionRecordingState(current, { type: 'start-requested', drawerSessionId, target })
    );

    const draft = await onStartRecording({
      workspaceHandle,
      workspaceId,
      drawerSessionId,
      target,
    });
    if (!draft.ok) {
      setState((current) =>
        transitionRecordingState(current, {
          type: 'failed',
          message: draft.error.message,
          canRetry: true,
        })
      );
      return;
    }

    setState((current) =>
      transitionRecordingState(current, {
        type: 'draft-ready',
        recordingId: draft.value.recordingId,
      })
    );
  }

  return (
    <Drawer open={open} onOpenChange={requestOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        aria-describedby="record-audio-description"
        className="mx-auto max-h-[calc(100vh-24px)] max-w-[920px] rounded-t-[24px] border-chalk bg-card-white"
      >
        <DrawerHeader>
          <DrawerTitle>Record memory</DrawerTitle>
          <DrawerDescription id="record-audio-description">
            Capture local audio for this workspace.
          </DrawerDescription>
        </DrawerHeader>
        <RecordingWaveform
          active={state.status === 'recording'}
          paused={state.status === 'paused'}
        />
        <RecordingControls state={state} onStart={startRecording} />
        {state.status === 'failed' ? <RecordingErrorState message={state.message} /> : null}
      </DrawerContent>
    </Drawer>
  );
}
```

组件边界：

- `RecordingControls.tsx` 只根据 `RecordingState` 渲染 start/pause/resume/stop/retry，icon-only button 必须有 `aria-label`；可用文字按钮仅用于主动作。
- `RecordingWaveform.tsx` 包装 ElevenLabs `waveform.tsx`，输入只允许 `{ active, paused }`，内部用 Reo tokens retokenize，不保留 demo audio、agent、network 或 API key。
- `RecordingErrorState.tsx` 只展示 recoverable message 和 retry/close action；不可吞掉 main/preload error code。
- `onStartRecording` 是 Task 9 注入的 recording orchestrator；Task 8 不直接创建 draft，不请求 microphone，不触碰 filesystem。
- `target.kind === 'new-memory'` 时，Task 9 的 orchestrator 在 microphone permission 成功后创建 draft 且不传 `memoryId`，后续 finalize 创建 `memoryId` 并返回 durable memory summary；`target.kind === 'existing-memory'` 时，request 携带 existing `memoryId` 并把 recording 放入该 memory。

- [ ] **Step 8: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/recordingMachine.test.ts
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/frontend.md` 记录 Drawer/Vaul、ElevenLabs waveform/voice-button 的实际 consumers。

- [ ] **Step 9: Commit**

```bash
git status --short
git add -- package.json package-lock.json src/renderer/src/components/ui/drawer.tsx src/renderer/src/components/ui/waveform.tsx src/renderer/src/components/ui/voice-button.tsx src/renderer/src/workspace/recording/RecordAudioDrawer.tsx src/renderer/src/workspace/recording/RecordingControls.tsx src/renderer/src/workspace/recording/RecordingWaveform.tsx src/renderer/src/workspace/recording/RecordingErrorState.tsx src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx src/renderer/src/workspace/RecordingOverlay.tsx src/renderer/src/workspace/recordingMachine.ts src/renderer/src/workspace/recordingMachine.test.ts docs/current/frontend.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-8-recording-drawer
git commit -m "feat: build recording drawer controls"
```

## 任务 9： Mic sequencing、MediaRecorder transaction 和 nested finalize

**Files:**

- Modify: `src/renderer/src/workspace/mediaRecorderAdapter.ts`
- Modify: `src/renderer/src/workspace/mediaRecorderAdapter.test.ts`
- Modify: `src/renderer/src/workspace/recording/RecordAudioDrawer.tsx`
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Modify: `src/main/recordingDrafts.ts`
- Modify: `src/main/recordingReads.ts`
- Test: `test/main/recordingDrafts.test.ts`
- Docs: `docs/current/electron.md`
- Docs: `docs/current/flow.md`
- Docs: `docs/current/data.md`

- [ ] **Step 1: 写 RED 测试，renderer 必须 await begin intent 再 getUserMedia**

```ts
it('awaits microphone intent before requesting browser media', async () => {
  const beginMicrophoneIntent = vi
    .fn()
    .mockResolvedValue(ok({ microphoneIntentId: 'mic_intent_1', expiresAt: 16_000 }));
  const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
  const createRecordingDraft = vi
    .fn()
    .mockResolvedValue(ok({ recordingId: 'rec_1', nextSequence: 0 }));

  await startRecordingWithIntent({
    beginMicrophoneIntent,
    createRecordingDraft,
    getUserMedia,
    workspaceHandle: 'wh_1',
    drawerSessionId: 'drawer_1',
    target: { kind: 'new-memory', titleDraft: 'Untitled memory' },
  });

  expect(beginMicrophoneIntent).toHaveBeenCalledBefore(getUserMedia);
  expect(getUserMedia).toHaveBeenCalledBefore(createRecordingDraft);
});
```

- [ ] **Step 2: 写 RED 测试，intent 失败不得调用 getUserMedia**

```ts
it('does not call getUserMedia when the main process denies microphone intent', async () => {
  const beginMicrophoneIntent = vi
    .fn()
    .mockResolvedValue(err({ code: 'permission-denied', message: 'Microphone denied' }));
  const createRecordingDraft = vi.fn();
  const getUserMedia = vi.fn();

  await expect(
    startRecordingWithIntent({
      beginMicrophoneIntent,
      createRecordingDraft,
      getUserMedia,
      workspaceHandle: 'wh_1',
      drawerSessionId: 'drawer_1',
      target: { kind: 'new-memory', titleDraft: 'Untitled memory' },
    })
  ).rejects.toThrow('Microphone denied');
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(createRecordingDraft).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: 写 RED 测试，permission 失败前不得创建 draft**

```tsx
it('does not create a recording draft before microphone permission succeeds', async () => {
  vi.mocked(beginMicrophoneIntent).mockResolvedValue(
    err({ code: 'ERR_MIC_PERMISSION_DENIED', message: 'Microphone denied' })
  );
  vi.mocked(createRecordingDraft).mockResolvedValue(
    ok({ recordingId: 'rec_never', nextSequence: 0 })
  );

  render(
    <RecordAudioDrawer
      open
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      target={{ kind: 'new-memory', titleDraft: 'Untitled memory' }}
      onOpenChange={vi.fn()}
      onStartRecording={startRecordingWithIntent}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /start recording/i }));
  expect(createRecordingDraft).not.toHaveBeenCalled();
  expect(await screen.findByRole('alert')).toHaveTextContent(/microphone denied/i);
});
```

- [ ] **Step 4: 写 RED 测试，permission race 和 drawer 关闭会清理 intent**

```ts
it('clears microphone intent when getUserMedia rejects before a permission decision completes', async () => {
  const beginMicrophoneIntent = vi
    .fn()
    .mockResolvedValue(ok({ microphoneIntentId: 'mic_intent_1', expiresAt: 16_000 }));
  const clearMicrophoneIntent = vi.fn().mockResolvedValue(ok({ cleared: true }));
  const getUserMedia = vi.fn().mockRejectedValue(new Error('Permission dismissed'));
  const createRecordingDraft = vi.fn();

  await expect(
    startRecordingWithIntent({
      beginMicrophoneIntent,
      clearMicrophoneIntent,
      createRecordingDraft,
      getUserMedia,
      workspaceHandle: 'wh_1',
      drawerSessionId: 'drawer_1',
      target: { kind: 'new-memory', titleDraft: 'Untitled memory' },
    })
  ).rejects.toThrow('Permission dismissed');

  expect(clearMicrophoneIntent).toHaveBeenCalledWith({
    workspaceHandle: 'wh_1',
    drawerSessionId: 'drawer_1',
  });
  expect(createRecordingDraft).not.toHaveBeenCalled();
});
```

在 `RecordAudioDrawer.test.tsx` 增加：

```tsx
it('clears a pending microphone intent when the drawer unmounts while acquiring permission', async () => {
  const beginMicrophoneIntent = vi.fn().mockReturnValue(new Promise(() => undefined));
  const clearMicrophoneIntent = vi.fn().mockResolvedValue(ok({ cleared: true }));
  const { unmount } = render(
    <RecordAudioDrawer
      open
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      target={{ kind: 'new-memory', titleDraft: 'Untitled memory' }}
      onOpenChange={vi.fn()}
      onStartRecording={(input) =>
        startRecordingWithIntent({ ...input, beginMicrophoneIntent, clearMicrophoneIntent })
      }
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /start recording/i }));
  unmount();

  expect(clearMicrophoneIntent).toHaveBeenCalledWith({
    workspaceHandle: 'wh_1',
    drawerSessionId: expect.any(String),
  });
});

it('clears a pending microphone intent when the user cancels while acquiring permission', async () => {
  const beginMicrophoneIntent = vi.fn().mockReturnValue(new Promise(() => undefined));
  const clearMicrophoneIntent = vi.fn().mockResolvedValue(ok({ cleared: true }));
  render(
    <RecordAudioDrawer
      open
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      target={{ kind: 'new-memory', titleDraft: 'Untitled memory' }}
      onOpenChange={vi.fn()}
      onStartRecording={(input) =>
        startRecordingWithIntent({ ...input, beginMicrophoneIntent, clearMicrophoneIntent })
      }
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /start recording/i }));
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(clearMicrophoneIntent).toHaveBeenCalledWith({
    workspaceHandle: 'wh_1',
    drawerSessionId: expect.any(String),
  });
});

it('clears a pending microphone intent when the workspace changes while acquiring permission', async () => {
  const beginMicrophoneIntent = vi.fn().mockReturnValue(new Promise(() => undefined));
  const clearMicrophoneIntent = vi.fn().mockResolvedValue(ok({ cleared: true }));
  const props = {
    open: true,
    workspaceId: 'ws_1',
    target: { kind: 'new-memory', titleDraft: 'Untitled memory' } as const,
    onOpenChange: vi.fn(),
    onStartRecording: (input: StartRecordingWithIntentInput) =>
      startRecordingWithIntent({ ...input, beginMicrophoneIntent, clearMicrophoneIntent }),
  };
  const { rerender } = render(<RecordAudioDrawer {...props} workspaceHandle="wh_1" />);

  await userEvent.click(screen.getByRole('button', { name: /start recording/i }));
  rerender(<RecordAudioDrawer {...props} workspaceHandle="wh_2" />);

  expect(clearMicrophoneIntent).toHaveBeenCalledWith({
    workspaceHandle: 'wh_1',
    drawerSessionId: expect.any(String),
  });
});

it('clears a pending microphone intent when acquiring permission times out', async () => {
  vi.useFakeTimers();
  const beginMicrophoneIntent = vi.fn().mockReturnValue(new Promise(() => undefined));
  const clearMicrophoneIntent = vi.fn().mockResolvedValue(ok({ cleared: true }));
  render(
    <RecordAudioDrawer
      open
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      target={{ kind: 'new-memory', titleDraft: 'Untitled memory' }}
      onOpenChange={vi.fn()}
      onStartRecording={(input) =>
        startRecordingWithIntent({ ...input, beginMicrophoneIntent, clearMicrophoneIntent })
      }
    />
  );

  await userEvent.click(screen.getByRole('button', { name: /start recording/i }));
  await vi.advanceTimersByTimeAsync(15_001);

  expect(clearMicrophoneIntent).toHaveBeenCalledWith({
    workspaceHandle: 'wh_1',
    drawerSessionId: expect.any(String),
  });
  vi.useRealTimers();
});
```

- [ ] **Step 5: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/workspace/mediaRecorderAdapter.test.ts src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx
npm run test:main
```

预期： FAIL，原因是 current adapter 没有 begin intent sequencing，main finalize 仍未完全使用 nested `memoryId + recordingId`。

- [ ] **Step 6: 写最小实现**

实现：

```ts
export async function startRecordingWithIntent(
  input: StartRecordingWithIntentInput
): Promise<RecordingController> {
  const intent = await input.beginMicrophoneIntent({
    workspaceHandle: input.workspaceHandle,
    drawerSessionId: input.drawerSessionId,
  });
  if (!intent.ok) throw new Error(intent.error.message);
  let stream: MediaStream;
  try {
    stream = await input.getUserMedia({ audio: true, video: false });
  } catch (error) {
    await input
      .clearMicrophoneIntent({
        workspaceHandle: input.workspaceHandle,
        drawerSessionId: input.drawerSessionId,
      })
      .catch(() => {});
    throw error;
  }
  try {
    const draft = await input.createRecordingDraft({
      workspaceHandle: input.workspaceHandle,
      ...(input.target.kind === 'existing-memory' ? { memoryId: input.target.memoryId } : {}),
    });
    if (!draft.ok) throw new Error(draft.error.message);
    return createMediaRecorderController({
      stream,
      recordingId: draft.value.recordingId,
      nextSequence: draft.value.nextSequence,
      ...input,
    });
  } catch (error) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    throw error;
  }
}
```

`RecordAudioDrawer` 在 `acquiring-permission` 状态发生 unmount、drawer cancel、workspace switch、drawer session replacement 或 timeout 时必须调用 `clearMicrophoneIntent({ workspaceHandle, drawerSessionId })`；进入 `recording` 后 intent 已被 browser permission handler 消费，不再重复 clear。这个清理逻辑必须在 component effect cleanup 和 state-machine event 中可测。

main finalize 必须返回 `memoryId`，并把 recording detail/read/save request schemas 改为 `workspaceHandle + memoryId + recordingId`。如果 renderer component 需要 query/cache identity，还必须同时携带 `workspaceId`，但 `workspaceId` 不替代 preload request capability。

- [ ] **Step 7: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/workspace/mediaRecorderAdapter.test.ts src/renderer/src/workspace/recording/RecordAudioDrawer.test.tsx
npm run test:main
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/electron.md` 和 `docs/current/flow.md` 记录 permission sequencing、append/finalize rollback 和 stale session handling。

- [ ] **Step 8: Commit**

```bash
git status --short
git add -- src/renderer/src/workspace/mediaRecorderAdapter.ts src/renderer/src/workspace/mediaRecorderAdapter.test.ts src/renderer/src/workspace/recording/RecordAudioDrawer.tsx src/renderer/src/workspace/workspaceApi.ts src/main/recordingDrafts.ts src/main/recordingReads.ts test/main/recordingDrafts.test.ts docs/current/electron.md docs/current/flow.md docs/current/data.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-9-mic-recording-transaction
git commit -m "feat: sequence microphone recording transactions"
```

## 任务 10： Playback、Transcript Viewer 和 Reflections editor

**Files:**

- Create: `src/renderer/src/workspace/recording/RecordingPlayback.tsx`
- Create: `src/renderer/src/workspace/recording/TranscriptReflectionsEditor.tsx`
- Create via ElevenLabs source: `src/renderer/src/components/ui/audio-player.tsx`
- Create via ElevenLabs source: `src/renderer/src/components/ui/transcript-viewer.tsx`
- Modify: `src/renderer/src/workspace/recording/RecordAudioDrawer.tsx`
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Modify: `src/main/recordingReads.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/renderer/src/workspace/recording/RecordingPlayback.test.tsx`
- Test: `src/renderer/src/workspace/recording/TranscriptReflectionsEditor.test.tsx`
- Test: `test/main/recordingReads.test.ts`
- Docs: `docs/current/frontend.md`
- Docs: `docs/current/data.md`

- [ ] **Step 1: 写 RED 测试，audio Blob URL 被创建和释放**

```tsx
it('creates and revokes a local audio object URL for playback', async () => {
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recording');
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

  const { unmount } = render(<RecordingPlayback manifest={audioManifest} readChunk={readChunk} />);

  expect(await screen.findByLabelText(/recording playback/i)).toHaveAttribute(
    'src',
    'blob:recording'
  );
  unmount();
  expect(createObjectURL).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:recording');
});
```

- [ ] **Step 2: 写 RED 测试，transcript/reflections 是用户编辑文本而非 STT 承诺**

```tsx
it('saves transcript and reflections as local markdown drafts without STT copy', async () => {
  render(
    <TranscriptReflectionsEditor
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      memoryId="mem_1"
      recordingId="rec_1"
      initialTranscript=""
      initialReflections=""
    />
  );

  await userEvent.type(screen.getByLabelText(/transcript/i), 'What I said');
  await userEvent.type(screen.getByLabelText(/reflections/i), 'What I noticed');
  await userEvent.click(screen.getByRole('button', { name: /save notes/i }));

  expect(saveTranscript).toHaveBeenCalledWith(
    expect.objectContaining({ memoryId: 'mem_1', recordingId: 'rec_1' })
  );
  expect(screen.queryByText(/transcribing|AI|speech-to-text/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: 写 RED 测试，save failure 保留旧文件且 stale response 不覆盖新状态**

在 `test/main/recordingReads.test.ts` 增加：

```ts
test('preserves previous transcript file when markdown save fails', async () => {
  const rootPath = await workspaceRootWithFinalizedMemoryRecording();
  const transcriptPath = path.join(
    rootPath,
    'memories',
    'mem_1',
    'recordings',
    'rec_1',
    'transcript.md'
  );
  await writeFile(transcriptPath, 'previous transcript');

  const saved = await saveRecordingMarkdown({
    rootPath,
    memoryId: 'mem_1',
    recordingId: 'rec_1',
    fileName: 'transcript.md',
    markdown: 'next transcript',
    writeAtomic: async () => {
      throw new Error('disk full');
    },
  });

  assert.equal(saved.ok, false);
  assert.equal(await readFile(transcriptPath, 'utf8'), 'previous transcript');
});

test('rejects symlinked memory recording paths before saving markdown', async () => {
  const rootPath = await workspaceRootWithFinalizedMemoryRecording();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-outside-'));
  await rm(path.join(rootPath, 'memories', 'mem_1'), { recursive: true, force: true });
  await symlink(outside, path.join(rootPath, 'memories', 'mem_1'), 'dir');

  const saved = await saveRecordingMarkdown({
    rootPath,
    memoryId: 'mem_1',
    recordingId: 'rec_1',
    fileName: 'transcript.md',
    markdown: 'should not write',
  });

  assert.equal(saved.ok, false);
  await assert.rejects(
    readFile(path.join(outside, 'recordings', 'rec_1', 'transcript.md'), 'utf8')
  );
});

test('reads recording audio in bounded chunks instead of loading the whole file', async () => {
  const rootPath = await workspaceRootWithFinalizedMemoryRecording({
    audioBytes: new Uint8Array(2_097_155).fill(7),
  });
  const reads: Array<{ readonly offset: number; readonly length: number }> = [];
  const opened = await readRecordingAudioChunk({
    rootPath,
    memoryId: 'mem_1',
    recordingId: 'rec_1',
    offset: 1_048_576,
    length: 1_048_576,
    openFile: async (filePath, flags) => {
      const handle = await open(filePath, flags);
      return {
        read: async (buffer, bufferOffset, length, position) => {
          const result = await handle.read(buffer, bufferOffset, length, position);
          reads.push({ offset: position ?? 0, length });
          return result;
        },
        close: async () => handle.close(),
      };
    },
  });

  assert.equal(opened.ok, true);
  assert.equal(opened.ok ? opened.chunk.byteLength : 0, 1_048_576);
  assert.deepEqual(reads, [{ offset: 1_048_576, length: 1_048_576 }]);
});

test('returns recording audio manifest with byte length, mime type and chunk limit', async () => {
  const rootPath = await workspaceRootWithFinalizedMemoryRecording({
    audioBytes: new Uint8Array([1, 2, 3, 4]),
  });

  const manifest = await readRecordingAudioManifest({
    rootPath,
    memoryId: 'mem_1',
    recordingId: 'rec_1',
  });

  assert.equal(manifest.ok, true);
  assert.deepEqual(manifest.ok ? manifest.manifest : null, {
    memoryId: 'mem_1',
    recordingId: 'rec_1',
    byteLength: 4,
    mimeType: 'audio/webm',
    maxChunkBytes: 1_048_576,
  });
});

test('rejects audio chunk ranges above the 1 MiB main-process limit', async () => {
  const rootPath = await workspaceRootWithFinalizedMemoryRecording();
  const opened = await readRecordingAudioChunk({
    rootPath,
    memoryId: 'mem_1',
    recordingId: 'rec_1',
    offset: 0,
    length: 1_048_577,
    openFile: async () => {
      throw new Error('openFile must not be called for invalid ranges');
    },
  });

  assert.equal(opened.ok, false);
});
```

在 `TranscriptReflectionsEditor.test.tsx` 增加：

```tsx
it('keeps newer editor state when an older save response resolves later', async () => {
  const firstSave = deferred<WorkspaceResponse<{ readonly saved: true }>>();
  const secondSave = deferred<WorkspaceResponse<{ readonly saved: true }>>();
  vi.mocked(saveTranscript)
    .mockReturnValueOnce(firstSave.promise)
    .mockReturnValueOnce(secondSave.promise);
  vi.mocked(saveReflections).mockResolvedValue(ok({ saved: true }));

  render(
    <TranscriptReflectionsEditor
      workspaceHandle="wh_1"
      workspaceId="ws_1"
      memoryId="mem_1"
      recordingId="rec_1"
      initialTranscript=""
      initialReflections=""
    />
  );

  await userEvent.type(screen.getByLabelText(/transcript/i), 'first');
  await userEvent.click(screen.getByRole('button', { name: /save notes/i }));
  await userEvent.clear(screen.getByLabelText(/transcript/i));
  await userEvent.type(screen.getByLabelText(/transcript/i), 'second');
  await userEvent.click(screen.getByRole('button', { name: /save notes/i }));

  secondSave.resolve(ok({ saved: true }));
  firstSave.resolve(err({ code: 'ERR_SAVE_STALE', message: 'stale' }));

  expect(screen.getByLabelText(/transcript/i)).toHaveValue('second');
  expect(screen.queryByRole('alert')).not.toHaveTextContent(/stale/i);
});
```

- [ ] **Step 4: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/workspace/recording/RecordingPlayback.test.tsx src/renderer/src/workspace/recording/TranscriptReflectionsEditor.test.tsx
npm run test:main
```

预期： FAIL，原因是 playback/editor components、ElevenLabs source 和 nested read/save 尚不存在。

- [ ] **Step 5: 引入 source 并绑定真实 consumer**

运行：

```bash
npx @elevenlabs/cli@0.5.2 components add audio-player
npx @elevenlabs/cli@0.5.2 components add transcript-viewer
```

`audio-player.tsx` 必须由 `RecordingPlayback` 使用。`transcript-viewer.tsx` 必须由 `TranscriptReflectionsEditor` 或 read-only transcript pane 使用。删去 ElevenLabs demo network、agent runtime、voice model、generated transcript copy。

- [ ] **Step 6: 写最小实现**

`RecordingPlayback.tsx` 只消费 main 返回的 manifest/chunks，永不暴露 raw filesystem path；Blob URL 生命周期必须绑定组件生命周期：

```tsx
export function RecordingPlayback({
  manifest,
  readChunk,
}: {
  readonly manifest: {
    readonly byteLength: number;
    readonly mimeType: 'audio/webm';
    readonly maxChunkBytes: number;
  };
  readonly readChunk: (input: {
    readonly offset: number;
    readonly length: number;
  }) => Promise<Uint8Array>;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    async function loadAudio() {
      try {
        const chunks: BlobPart[] = [];
        for (let offset = 0; offset < manifest.byteLength; ) {
          const length = Math.min(manifest.maxChunkBytes, manifest.byteLength - offset);
          const chunk = await readChunk({ offset, length });
          const copy = new Uint8Array(chunk.byteLength);
          copy.set(chunk);
          chunks.push(copy.buffer as ArrayBuffer);
          offset += length;
        }
        if (disposed) {
          return;
        }
        objectUrl = URL.createObjectURL(new Blob(chunks, { type: manifest.mimeType }));
        setSrc(objectUrl);
      } catch (loadError) {
        if (!disposed) {
          setError(
            loadError instanceof Error ? loadError.message : 'Recording audio could not be loaded'
          );
        }
      }
    }

    void loadAudio();

    return () => {
      disposed = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [manifest.byteLength, manifest.maxChunkBytes, manifest.mimeType, readChunk]);

  if (error) {
    return <p role="alert">{error}</p>;
  }
  return src ? <AudioPlayer aria-label="Recording playback" src={src} /> : <p>Loading audio</p>;
}
```

`TranscriptReflectionsEditor.tsx` 使用现有 `Textarea` 和 ElevenLabs-derived `TranscriptViewer` 的 local/read-only primitives；文案必须是用户可编辑 notes，不写 STT/AI/transcribing 承诺：

```tsx
export function TranscriptReflectionsEditor({
  workspaceHandle,
  memoryId,
  recordingId,
  initialTranscript,
  initialReflections,
}: TranscriptReflectionsEditorProps) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [reflections, setReflections] = useState(initialReflections);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [lastSaved, setLastSaved] = useState({
    transcript: initialTranscript,
    reflections: initialReflections,
  });
  const saveVersionRef = useRef(0);
  const dirty = transcript !== lastSaved.transcript || reflections !== lastSaved.reflections;

  async function saveNotes() {
    const saveVersion = saveVersionRef.current + 1;
    saveVersionRef.current = saveVersion;
    const nextTranscript = transcript;
    const nextReflections = reflections;
    setStatus('saving');
    try {
      const [transcriptResult, reflectionsResult] = await Promise.all([
        saveTranscript({
          workspaceHandle,
          memoryId,
          recordingId,
          markdown: nextTranscript,
        }),
        saveReflections({
          workspaceHandle,
          memoryId,
          recordingId,
          markdown: nextReflections,
        }),
      ]);

      if (saveVersion !== saveVersionRef.current) {
        return;
      }
      if (transcriptResult.ok && reflectionsResult.ok) {
        setLastSaved({ transcript: nextTranscript, reflections: nextReflections });
        setStatus('saved');
      } else {
        setStatus('failed');
      }
    } catch {
      if (saveVersion === saveVersionRef.current) {
        setStatus('failed');
      }
    }
  }

  return (
    <section aria-label="Recording notes" className="grid gap-16">
      <TranscriptViewer value={transcript} aria-label="Transcript preview" />
      <Label htmlFor="recording-transcript">Transcript notes</Label>
      <Textarea
        id="recording-transcript"
        value={transcript}
        onChange={(event) => {
          setTranscript(event.target.value);
          setStatus('idle');
        }}
      />
      <Label htmlFor="recording-reflections">Reflections</Label>
      <Textarea
        id="recording-reflections"
        value={reflections}
        onChange={(event) => {
          setReflections(event.target.value);
          setStatus('idle');
        }}
      />
      <Button type="button" disabled={!dirty || status === 'saving'} onClick={saveNotes}>
        Save notes
      </Button>
      {status === 'failed' ? <p role="alert">Notes could not be saved.</p> : null}
    </section>
  );
}
```

`recordingReads.ts` nested file helpers 必须做 id validation、filename allowlist 和 workspace containment：

```ts
import { lstat, open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const MEMORY_ID_PATTERN = /^mem_[A-Za-z0-9_-]+$/;
const RECORDING_ID_PATTERN = /^rec_[A-Za-z0-9_-]+$/;
const MARKDOWN_FILE_NAMES = new Set(['transcript.md', 'reflections.md']);

async function resolveSafeWorkspaceChild(rootPath: string, candidatePath: string): Promise<string> {
  const canonicalRoot = await realpath(rootPath);
  const relative = path.relative(rootPath, candidatePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes workspace');
  }

  let current = canonicalRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error('Workspace path crosses a symlink');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        break;
      }
      throw error;
    }
  }

  const resolved = path.resolve(canonicalRoot, relative);
  const containment = path.relative(canonicalRoot, resolved);
  if (containment.startsWith('..') || path.isAbsolute(containment)) {
    throw new Error('Path escapes workspace');
  }
  return resolved;
}

async function resolveNestedRecordingDirectory(
  rootPath: string,
  memoryId: string,
  recordingId: string
) {
  if (!MEMORY_ID_PATTERN.test(memoryId) || !RECORDING_ID_PATTERN.test(recordingId)) {
    throw new Error('Invalid memory or recording id');
  }
  return resolveSafeWorkspaceChild(
    rootPath,
    path.join(rootPath, 'memories', memoryId, 'recordings', recordingId)
  );
}

function resolveMarkdownPath(directory: string, fileName: string) {
  if (!MARKDOWN_FILE_NAMES.has(fileName)) {
    throw new Error('Invalid recording markdown file');
  }
  return path.join(directory, fileName);
}

export async function readRecordingAudioManifest({
  rootPath,
  memoryId,
  recordingId,
}: ReadRecordingInput) {
  const directory = await resolveNestedRecordingDirectory(rootPath, memoryId, recordingId);
  const audio = await stat(path.join(directory, 'audio.webm'));
  return {
    ok: true,
    manifest: {
      memoryId,
      recordingId,
      byteLength: audio.size,
      mimeType: 'audio/webm',
      maxChunkBytes: 1_048_576,
    },
  };
}

export async function readRecordingAudioChunk({
  rootPath,
  memoryId,
  recordingId,
  offset,
  length,
  openFile = open,
}: ReadRecordingAudioChunkInput) {
  try {
    if (offset < 0 || length < 1 || length > 1_048_576) {
      throw new Error('Invalid audio chunk range');
    }
    const directory = await resolveNestedRecordingDirectory(rootPath, memoryId, recordingId);
    const handle = await openFile(path.join(directory, 'audio.webm'), 'r');
    try {
      const buffer = new Uint8Array(length);
      const result = await handle.read(buffer, 0, length, offset);
      return { ok: true, chunk: buffer.slice(0, result.bytesRead) };
    } finally {
      await handle.close();
    }
  } catch {
    return workspaceError(
      'ERR_RECORDING_AUDIO_READ_FAILED',
      'Recording audio could not be read',
      'none-written'
    );
  }
}

export async function saveRecordingMarkdown({
  rootPath,
  memoryId,
  recordingId,
  fileName,
  markdown,
  writeAtomic = writeWorkspaceFileAtomic,
}: SaveMarkdownInput) {
  try {
    const directory = await resolveNestedRecordingDirectory(rootPath, memoryId, recordingId);
    await writeAtomic(resolveMarkdownPath(directory, fileName), markdown);
    return { ok: true };
  } catch {
    return workspaceError(
      'ERR_RECORDING_MARKDOWN_SAVE_FAILED',
      'Recording notes could not be saved',
      'previous-file-preserved'
    );
  }
}
```

`workspaceContract.ts` 同步新增 `ERR_RECORDING_MARKDOWN_SAVE_FAILED` 和 `ERR_RECORDING_AUDIO_READ_FAILED`；`readRecordingAudioChunk` schema 必须限制 `offset >= 0`、`1 <= length <= 1_048_576`，main process 只能用 file handle `read` 做 bounded I/O，禁止用 `readFile(audio.webm)`。`workspaceApi.ts` 和 preload types 同步把 `memoryId` 加入 `getMemoryDetail`、`readRecordingAudioManifest`、`readRecordingAudioChunk`、`saveTranscript`、`saveReflections` payload。

- [ ] **Step 7: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/workspace/recording/RecordingPlayback.test.tsx src/renderer/src/workspace/recording/TranscriptReflectionsEditor.test.tsx
npm run test:main
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/frontend.md` 记录 Audio Player/Transcript Viewer consumers，`docs/current/data.md` 记录 transcript/reflections file truth。

- [ ] **Step 8: Commit**

```bash
git status --short
git add -- package.json package-lock.json src/main/recordingReads.ts src/renderer/src/components/ui/audio-player.tsx src/renderer/src/components/ui/transcript-viewer.tsx src/renderer/src/workspace/recording/RecordingPlayback.tsx src/renderer/src/workspace/recording/RecordingPlayback.test.tsx src/renderer/src/workspace/recording/TranscriptReflectionsEditor.tsx src/renderer/src/workspace/recording/TranscriptReflectionsEditor.test.tsx src/renderer/src/workspace/recording/RecordAudioDrawer.tsx src/renderer/src/workspace/workspaceApi.ts test/main/recordingReads.test.ts docs/current/frontend.md docs/current/data.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-10-playback-notes
git commit -m "feat: add local playback and recording notes"
```

## 任务 11： App integration、routing 和 forbidden capability audit

**Files:**

- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/App.test.tsx`
- Modify: `src/renderer/src/workspace/ForbiddenCapabilities.test.tsx`
- Modify: `src/renderer/src/workspace/workspaceQueries.ts`
- Modify: `src/renderer/src/workspace/workspaceApi.ts`
- Docs: `docs/current/frontend.md`
- Docs: `docs/current/flow.md`

- [ ] **Step 1: 写 RED 测试，entry -> home -> detail -> drawer flow**

```tsx
it('navigates from workspace entry to home, memory detail and recording drawer', async () => {
  render(<App />);

  await createOrOpenWorkspaceInTest();
  expect(await screen.findByRole('heading', { name: /all memories/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('link', { name: /my seventh birthday/i }));
  expect(await screen.findByRole('heading', { name: 'My seventh birthday' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /record memory/i }));
  expect(screen.getByRole('dialog', { name: /record memory/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: 写 RED 测试，Home/New memory 能创建第一条 memory**

```tsx
it('opens the recording drawer from Home to create the first memory', async () => {
  render(<App />);

  await createOrOpenWorkspaceInTest({ snapshot: emptyWorkspaceSnapshot });
  await userEvent.click(screen.getByRole('button', { name: /record memory/i }));

  expect(screen.getByRole('dialog', { name: /record memory/i })).toBeInTheDocument();
  expect(screen.getByTestId('recording-target')).toHaveTextContent(/new memory/i);
});
```

- [ ] **Step 3: 写 RED 测试，禁止未实现能力**

```tsx
it('does not render photo video file film AI auth or global search capabilities', async () => {
  render(<App />);

  expect(
    screen.queryByText(/photo|video|film|file upload|AI generation|sign in|global search/i)
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 4: 运行 RED**

运行：

```bash
npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx
```

预期： FAIL，原因是 App routing 仍未连接完整 first slice，或 future capability audit 发现泄漏。

- [ ] **Step 5: 写最小实现**

`App` route state：

```ts
type AppRoute =
  | { name: 'workspace-entry' }
  | { name: 'home'; workspaceHandle: string; workspaceId: string }
  | { name: 'memory-detail'; workspaceHandle: string; workspaceId: string; memoryId: string }
  | {
      name: 'recording-drawer';
      workspaceHandle: string;
      workspaceId: string;
      target: RecordingTarget;
      returnTo: AppRoute;
    };
```

只使用 in-memory route state；不添加 router dependency。`workspaceId` 是 route/query identity，`workspaceHandle` 只用于 preload request capability。Home 的 `Record memory` 使用 `{ kind: 'new-memory' }` target；Memory detail 的 `Record memory` 使用 `{ kind: 'existing-memory', memoryId }` target。所有 future wireframe 只保留在 spec 文档，不在 runtime 中提供可点击假能力。

- [ ] **Step 6: 运行 GREEN 和固定门禁**

运行：

```bash
npx vitest run src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；`docs/current/flow.md` 记录 App route flow、drawer return flow 和 stale async guard。

- [ ] **Step 7: Commit**

```bash
git status --short
git add -- src/renderer/src/App.tsx src/renderer/src/App.test.tsx src/renderer/src/workspace/ForbiddenCapabilities.test.tsx src/renderer/src/workspace/workspaceApi.ts src/renderer/src/workspace/workspaceQueries.ts docs/current/frontend.md docs/current/flow.md docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-11-app-integration
git commit -m "feat: connect first slice app flow"
```

## 任务 12： Reference QA、accessibility 和 runtime evidence

本 task 是验证 slice，不伪造 RED/GREEN/REFACTOR。若 runtime/reference/accessibility 验证发现行为缺陷，先记录可复现失败，再回到对应 implementation task 或创建修复 task spec 走 TDD；本 task 只在缺陷修复后继续验证。

**Files:**

- Create/Modify: current task spec `docs/specs/YYYY-MM-DD-HHMM-first-product-slice-task-12-reference-qa/verification.md`
- Create/Modify: current task spec `docs/specs/YYYY-MM-DD-HHMM-first-product-slice-task-12-reference-qa/review.md`
- Modify: `docs/current/frontend.md`
- Modify: `docs/current/quality.md`

- [ ] **Step 1: 准备 reference evidence 清单**

必须逐一对照这些主图：

- `/Users/yck/Downloads/PM/设计参考/记忆录音/ Reflections详细弹层.jpg`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/录音详细页-录音中弹层.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/录音详细页-没有录音弹层.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/home页面-sidebar rail态.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/home页面-sidebar展开态.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/workspace页面.png`

必须逐一抽样/记录这些辅助帧组：

- `/private/tmp/reo-reference-frames/ref1-02.jpg`
- `/private/tmp/reo-reference-frames/ref1-03.jpg`
- `/private/tmp/reo-reference-frames/ref1-04.jpg`
- `/private/tmp/reo-reference-frames/ref1-05.jpg`
- `/private/tmp/reo-reference-frames/ref1-06.jpg`
- `/private/tmp/reo-reference-frames/ref1-07.jpg`
- `/private/tmp/reo-reference-frames/ref1-08.jpg`
- `/private/tmp/reo-reference-frames/ref1-09.jpg`
- `/private/tmp/reo-reference-frames/ref1-10.jpg`
- `/private/tmp/reo-reference-frames/ref1-11.jpg`
- `/private/tmp/reo-reference-frames/ref1-12.jpg`
- `/private/tmp/reo-reference-frames/ref1-13.jpg`
- `/private/tmp/reo-reference-frames/ref1-contact.jpg`
- `/private/tmp/reo-reference-frames/ref2-01.jpg`
- `/private/tmp/reo-reference-frames/ref2-02.jpg`
- `/private/tmp/reo-reference-frames/ref2-03.jpg`
- `/private/tmp/reo-reference-frames/ref2-04.jpg`
- `/private/tmp/reo-reference-frames/ref2-05.jpg`
- `/private/tmp/reo-reference-frames/ref2-06.jpg`
- `/private/tmp/reo-reference-frames/ref2-07.jpg`
- `/private/tmp/reo-reference-frames/ref2-08.jpg`
- `/private/tmp/reo-reference-frames/ref2-09.jpg`
- `/private/tmp/reo-reference-frames/ref2-10.jpg`
- `/private/tmp/reo-reference-frames/ref2-11.jpg`
- `/private/tmp/reo-reference-frames/ref2-12.jpg`
- `/private/tmp/reo-reference-frames/ref2-13.jpg`
- `/private/tmp/reo-reference-frames/ref2-14.jpg`
- `/private/tmp/reo-reference-frames/ref2-15.jpg`
- `/private/tmp/reo-reference-frames/ref2-16.jpg`
- `/private/tmp/reo-reference-frames/ref2-17.jpg`
- `/private/tmp/reo-reference-frames/ref2-18.jpg`
- `/private/tmp/reo-reference-frames/ref2-19.jpg`
- `/private/tmp/reo-reference-frames/ref2-20.jpg`
- `/private/tmp/reo-reference-frames/ref2-21.jpg`
- `/private/tmp/reo-reference-frames/ref2-22.jpg`
- `/private/tmp/reo-reference-frames/ref2-23.jpg`
- `/private/tmp/reo-reference-frames/ref2-24.jpg`
- `/private/tmp/reo-reference-frames/ref2-25.jpg`
- `/private/tmp/reo-reference-frames/ref2-26.jpg`
- `/private/tmp/reo-reference-frames/ref2-27.jpg`
- `/private/tmp/reo-reference-frames/ref2-contact.jpg`

- [ ] **Step 2: 使用 `$computer-use` 做真实 runtime 操作验证**

验证路径：

- 创建 workspace。
- 打开 workspace。
- Home covered/expanded 切换和 240-520px sidebar resize。
- Home 本地搜索。
- 打开 memory detail。
- 打开 recording drawer。
- 录音开始/暂停/继续/停止。
- 保存 transcript/reflections。
- 播放录音。
- 退出并重新打开 workspace，确认文件真源恢复。

记录 evidence 到当前 Task 12 spec 的 `verification.md`：时间、命令、结果、截图或描述、失败修复记录。

- [ ] **Step 3: 做 Codex CLI read-only workspace 文件验证**

在 runtime app 关闭、workspace 无 active lock 的状态下，用只读方式验证磁盘文件能被 Codex CLI 读取：

- 记录 workspace root。
- 运行 `find "$WORKSPACE_ROOT" -maxdepth 5 -type f -print`，必须看到 workspace `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`memories/<memoryId>/memory.json`、`memories/<memoryId>/recordings/<recordingId>/recording.json`、`transcript.md`、`reflections.md` 和 `audio.webm`。
- 运行只读 hash 命令，例如 `shasum -a 256 "$WORKSPACE_ROOT/AGENTS.md" "$WORKSPACE_ROOT/memories/<memoryId>/memory.json"`，重复两次结果必须一致。
- 用 Codex CLI read-only prompt 验证能读取 workspace `AGENTS.md` 和普通用户文件，且不写入文件；记录 prompt、退出码和摘要。
- `.reo/workspace.lock*`、transaction temp、`.reo-finalizing-*` 和 OS metadata 不纳入 hash 稳定性断言。

如果 read-only 验证失败，必须回到对应 filesystem/security task 做 TDD 修复，不能把失败写成 QA pass。

- [ ] **Step 4: 使用 production preview 验证 Electron baseline**

运行：

```bash
npm run build
npm start
```

使用 `$computer-use` 连接 production preview app，并在当前 Task 12 spec 的 `verification.md` 记录：

- production URL / loaded origin。
- CSP header 或等效 policy evidence，包含 `media-src 'self' blob:` 且无 wildcard media source。
- 新窗口拒绝。
- 外部导航拒绝。
- 无 intent 时 permission 默认拒绝。
- `workspace:beginMicrophoneIntent` 成功后 audio-only permission 可进入 browser permission flow；video 仍拒绝。

- [ ] **Step 5: 做 accessibility matrix runtime check**

至少覆盖：

- keyboard tab order。
- drawer focus trap。
- Escape/backdrop 关闭规则。
- recording in progress close guard。
- form error focus。
- reduced motion。
- icon-only controls accessible name。
- 无 emoji。

- [ ] **Step 6: 运行固定门禁**

运行：

```bash
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；当前 Task 12 spec 的 `verification.md` 写入 runtime/reference/accessibility evidence，`review.md` 记录 QA 结论、缺陷回链和是否存在 unresolved BLOCKER/MAJOR。不得编辑或提交已归档的 design-hardening spec。

- [ ] **Step 7: Commit**

```bash
git status --short
git add -- docs/archive/specs/YYYY-MM-DD-HHMM-first-product-slice-task-12-reference-qa docs/current/frontend.md docs/current/quality.md
git commit -m "test: record first slice runtime QA evidence"
```

## 任务 13： 文档压缩、独立审查和最终提交

**Files:**

- Modify: `docs/current/foundation.md`
- Modify: `docs/current/architecture.md`
- Modify: `docs/current/electron.md`
- Modify: `docs/current/data.md`
- Modify: `docs/current/flow.md`
- Modify: `docs/current/frontend.md`
- Modify: `docs/current/quality.md`
- Modify: `docs/initiatives/2026-05-06-first-product-slice/README.md`
- Modify: `docs/initiatives/2026-05-06-first-product-slice/plan.md`
- Move: `docs/initiatives/2026-05-06-first-product-slice/` -> `docs/archive/initiatives/2026-05-06-first-product-slice/`

- [ ] **Step 1: 压缩长期结论回 current docs**

把已经实现并验证的长期事实压缩回 `docs/current/*`；spec 只保留 evidence、review、verification 和执行记录。不要把历史来源、旧方案或 provenance 写进 current docs。

- [ ] **Step 2: 更新 active initiative**

如果 first slice 已完全交付，`docs/initiatives/2026-05-06-first-product-slice/tasks.md` 标记完成，并说明剩余后续能力属于新的 future foundation。若仍有未完成实现，不得归档 initiative 或当前 task spec。

- [ ] **Step 3: 请求独立对抗审查**

至少执行：

- subagent review：重点找 BLOCKER/MAJOR。
- Codex CLI review：重点找 BLOCKER/MAJOR。
- Claude CLI review：只设置 prompt、model `opus4.7`、effort `xhigh`；其他约束只写在 prompt 中。

有 unresolved BLOCKER/MAJOR 时不得进入最终 commit。

- [ ] **Step 4: 归档已完成 initiative**

只有在 first slice 已完全实现、QA、review、verification 且无 unresolved BLOCKER/MAJOR 时执行：

```bash
mkdir -p docs/archive/initiatives
mv docs/initiatives/2026-05-06-first-product-slice docs/archive/initiatives/
```

Design-hardening umbrella spec 必须已在 plan handoff gate 归档；Task 13 不得编辑 archived implementation plan。若仍有未完成 implementation task 或 active task spec，不得归档 initiative。

- [ ] **Step 5: 运行最终验证**

运行：

```bash
npm run verify:quick
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
find docs/specs -mindepth 1 -maxdepth 1 -print
```

预期： 全部 PASS；所有已完成 task spec 已位于 `docs/archive/specs/*`；`find docs/specs -mindepth 1 -maxdepth 1 -print` 无输出，除非有明确未完成的后续 active spec。

- [ ] **Step 6: 最终 commit**

```bash
git status --short
# 逐项核对 git status --short 后，只 stage 当前 Task 13 owns 的显式路径。
# 示例：
git add -- docs/current/foundation.md docs/current/architecture.md docs/current/electron.md docs/current/data.md docs/current/flow.md docs/current/frontend.md docs/current/quality.md docs/archive/initiatives/2026-05-06-first-product-slice
git commit -m "feat: deliver first product slice"
git rev-parse HEAD
```

预期： 输出最终 commit hash。最终回复必须先给审查结论和阻断点、spec 路径、设计摘要、review 结果、验证结果、commit hash。

## 计划审查状态

- Design-hardening review：PASS，无 unresolved BLOCKER/MAJOR。
- Writing-plans review：PASS，无 unresolved BLOCKER/MAJOR。
- Plan-eng-review：PASS，无 unresolved BLOCKER/MAJOR。
- Executing-plans：未开始；plan handoff gate 完成、design-hardening spec 归档且 `docs/specs/*` 为空后才允许进入 Task 1。
