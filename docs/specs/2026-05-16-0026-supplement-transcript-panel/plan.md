# 补充录音转录区 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Memory Studio 的 SegmentSupplement audio panel 中，紧接播放行下方只读展示该补充录音自己的 transcript，并与 Segment transcript tab 共用一个 feature-local `SegmentTranscriptView`。

**Architecture:** 后端补一条 transcript 字段进 supplement read response（schema + main read 函数复用现有 segment.md transcript 提取逻辑）。前端新增小型展示组件，Segment 与 Supplement 同时消费，supplement 录音转录保存成功后 invalidate 对应 query。

**Tech Stack:** TypeScript / Zod 4 / Node `--test`（main）/ Vitest + React Testing Library（renderer）/ TanStack Query / React 19 / Tailwind v4 + shadcn token。

---

## 文件结构

| 路径                                                                     | 动作                                                               | 责任                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/workspace-contract/workspace-contract.ts`                           | 修改 line 698-715                                                  | 给 `workspaceReadFinalizedAudioSegmentSupplementResponseSchema.value` 追加 `transcript: { exists, text }`，镜像 segment response 字段。                                                                     |
| `test/main/workspaceContract.test.ts`                                    | 修改 line 1040-1064                                                | 更新已有 `workspaceReadFinalizedAudioSegmentSupplementResponseSchema.parse(...)` 断言，包含 transcript 字段（exists+text）。                                                                                |
| `src/main/recordingDrafts.ts`                                            | 修改 line 1297-1334 / 1336-1423 / 1425-1519                        | 将 `readOptionalFinalizedTranscript` 泛化为 `readOptionalFinalizedTranscriptFile({ markdownFileName, objectType })`；segment 与 supplement read 都通过它；supplement read 在 audio 后追加 transcript 字段。 |
| `test/main/workspaceIpc.test.ts`                                         | 修改 line 1561-1627；新增"supplement returns transcript text" 一例 | 翻转 `'transcript' in result.value === false` 断言；新增 transcript exists 与 empty 两态覆盖。                                                                                                              |
| `src/renderer/src/workspace/SegmentTranscriptView.tsx`                   | 创建                                                               | 4 态只读展示组件，props 化文案，无 scroll surface。                                                                                                                                                         |
| `src/renderer/src/workspace/SegmentTranscriptView.test.tsx`              | 创建                                                               | loading / error / ready+exists / ready+empty 四态文案 + 关键 class 断言。                                                                                                                                   |
| `src/renderer/src/workspace/MemoryStudio.tsx`                            | 修改 line 1856-1883 / line 848-894                                 | Segment transcript tab 与 supplement audio panel 都改用 `SegmentTranscriptView`；supplement panel 在播放行下方插入。                                                                                        |
| `src/renderer/src/App.tsx`                                               | 修改 line 1554-1601                                                | `handleSegmentSupplementFinalized` 末尾追加 exact `segmentSupplementContentQueryKey` invalidate。                                                                                                           |
| `src/renderer/src/App.test.tsx`                                          | 修改 fixture + 新增一例                                            | 给 supplement panel 增加 transcript 4 态渲染断言；新增"supplement 录音保存后 invalidate supplement content cache" 断言。                                                                                    |
| `docs/current/frontend.md`                                               | 修改 line 105                                                      | 改成"supplement audio panel 在播放行下方使用同一 `SegmentTranscriptView` 显示 transcript"。                                                                                                                 |
| `docs/current/data.md`                                                   | 修改 line 92                                                       | 改"不返回 transcript text" 为"返回 transcript text（exists+text），保存成功后 invalidate supplement content Query"。                                                                                        |
| `docs/specs/2026-05-16-0026-supplement-transcript-panel/verification.md` | 修改                                                               | 命令与视觉证据完成后勾选并附 artifacts。                                                                                                                                                                    |

---

## Task 1: 扩展 supplement read response schema

**Files:**

- Modify: `src/workspace-contract/workspace-contract.ts:698-715`
- Modify (test): `test/main/workspaceContract.test.ts:1040-1064`

- [ ] **Step 1: Write the failing contract assertion**

把 `test/main/workspaceContract.test.ts:1040-1064` 这段 `workspaceReadFinalizedAudioSegmentSupplementResponseSchema.parse(...)` 改成包含 transcript 的版本：

```ts
assert.deepEqual(
  workspaceReadFinalizedAudioSegmentSupplementResponseSchema.parse({
    ok: true,
    value: {
      requestId: 'request_sup_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      audio: new Uint8Array([4, 5]),
      audioByteLength: 2,
      transcript: { exists: true, text: '补充录音转写正文' },
    },
  }),
  {
    ok: true,
    value: {
      requestId: 'request_sup_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      audio: new Uint8Array([4, 5]),
      audioByteLength: 2,
      transcript: { exists: true, text: '补充录音转写正文' },
    },
  }
);
```

- [ ] **Step 2: Run main test to verify it fails**

Run: `npm run test:main`
Expected: `workspace read schemas omit workspace handle, root path, and trash path` 一类用例失败（schema 拒绝未知 `transcript` 字段）。

- [ ] **Step 3: Update schema**

修改 `src/workspace-contract/workspace-contract.ts:698-715`：

```ts
export const workspaceReadFinalizedAudioSegmentSupplementResponseSchema = z.discriminatedUnion(
  'ok',
  [
    z.strictObject({
      ok: z.literal(true),
      value: z.strictObject({
        requestId: z.string().min(1),
        workspaceId: z.string().min(1),
        memoryId: memoryIdSchema,
        segmentId: segmentIdSchema,
        supplementId: supplementIdSchema,
        audio: z.instanceof(Uint8Array),
        audioByteLength: z.number().int().nonnegative(),
        transcript: z.strictObject({
          exists: z.boolean(),
          text: z.string(),
        }),
      }),
    }),
    workspaceErrorEnvelopeSchema,
  ]
);
```

- [ ] **Step 4: Run main test to verify it passes**

Run: `npm run test:main`
Expected: 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/workspace-contract/workspace-contract.ts test/main/workspaceContract.test.ts
git commit -m "$(cat <<'EOF'
feat(contract): include transcript in supplement read response
EOF
)"
```

---

## Task 2: 泛化 finalized transcript reader（refactor，保持 segment 行为）

**Files:**

- Modify: `src/main/recordingDrafts.ts:1297-1334` 及 `:1398-1411`

- [ ] **Step 1: 把 helper 改成接受 markdownFileName / objectType**

把 `readOptionalFinalizedTranscript`（line 1297-1334）替换为：

```ts
async function readOptionalFinalizedTranscriptFile(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  options: {
    readonly markdownFileName: 'segment.md' | 'supplement.md';
    readonly objectType: 'segment' | 'supplement';
  }
): Promise<{ readonly exists: boolean; readonly text: string }> {
  let fd: number;
  try {
    fd = openFileForReadInDirectory(directory, directoryIdentity, options.markdownFileName);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, text: '' };
    }
    throw error;
  }

  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error(`${options.markdownFileName} path is unsafe`);
    }
    if (stat.size > MAX_FINALIZED_TRANSCRIPT_READ_BYTES) {
      throw new Error(`${options.markdownFileName} is too large`);
    }
    const markdown = (await readFileDescriptor(fd, 'utf8')) as string;
    const parsed = parseWorkspaceMarkdownObject({ objectType: options.objectType, markdown });
    const text = extractSegmentTranscript(parsed.content);
    await assertSameDirectory(directory, directoryIdentity);
    return { exists: text.length > 0, text };
  } finally {
    closeSync(fd);
  }
}
```

- [ ] **Step 2: 在 segment read 中改用 helper**

修改 `readFinalizedAudioSegmentContent`（line 1398-1411）的 transcript 行：

```ts
const transcript = await readOptionalFinalizedTranscriptFile(
  target.directory,
  recordingDirectoryIdentity,
  { markdownFileName: 'segment.md', objectType: 'segment' }
);
```

- [ ] **Step 3: 跑 main test 验证 segment 行为不变**

Run: `npm run test:main`
Expected: 全部通过；`readFinalizedAudioSegment returns audio bytes and transcript without exposing file paths` 仍然通过。

- [ ] **Step 4: Commit**

```bash
git add src/main/recordingDrafts.ts
git commit -m "$(cat <<'EOF'
refactor(main): generalize finalized transcript reader
EOF
)"
```

---

## Task 3: supplement read 返回 transcript

**Files:**

- Modify (test): `test/main/workspaceIpc.test.ts:1561-1627`，新增一例覆盖 transcript exists
- Modify: `src/main/recordingDrafts.ts:1425-1519`

- [ ] **Step 1: 翻转现有断言并新增 transcript 覆盖**

把 `test/main/workspaceIpc.test.ts:1561-1627` 这段测试的标题与断言改为：

```ts
test('readFinalizedAudioSegmentSupplement returns parent-scoped audio bytes and transcript without exposing paths', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-finalized-supplement-audio-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充播放',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    'mem_ipc_audio',
    'segments',
    'seg_ipc_audio',
    'supplements',
    'sup_ipc_followup'
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: supplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    supplementId: 'sup_ipc_followup',
    title: '补充录音',
    content: '补充录音转写正文',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      supplementId: 'sup_ipc_followup',
      requestId: 'request_sup_ipc_followup',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.requestId, 'request_sup_ipc_followup');
    assert.equal(result.value.workspaceId, 'ws_ipc');
    assert.equal(result.value.memoryId, 'mem_ipc_audio');
    assert.equal(result.value.segmentId, 'seg_ipc_audio');
    assert.equal(result.value.supplementId, 'sup_ipc_followup');
    assert.deepEqual(Array.from(result.value.audio), [4, 5]);
    assert.equal(result.value.audioByteLength, 2);
    assert.deepEqual(result.value.transcript, {
      exists: true,
      text: '补充录音转写正文',
    });
    assert.equal('workspaceHandle' in result.value, false);
    assert.equal('rootPath' in result.value, false);
  }
});

test('readFinalizedAudioSegmentSupplement returns empty transcript when supplement body is empty', async () => {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-ipc-finalized-supplement-empty-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'IPC 补充无转写',
    description: '',
    createWorkspaceId: () => 'ws_ipc',
    now: () => '2026-05-06T13:08:00.000Z',
  });
  await writeFinalizedMemoryRecording({
    root: rootPath,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    title: '生日录音',
  });
  const supplementDirectory = path.join(
    rootPath,
    'memories',
    'mem_ipc_audio',
    'segments',
    'seg_ipc_audio',
    'supplements',
    'sup_ipc_followup'
  );
  await mkdir(supplementDirectory, { recursive: true });
  await writeFinalizedSupplementFiles({
    root: rootPath,
    directory: supplementDirectory,
    workspaceId: 'ws_ipc',
    memoryId: 'mem_ipc_audio',
    segmentId: 'seg_ipc_audio',
    supplementId: 'sup_ipc_followup',
    title: '补充录音',
    content: '',
  });
  const handleStore = createRegisteredHandleStore(rootPath);

  const result = await handleReadFinalizedAudioSegmentSupplementForTest({
    event,
    input: {
      workspaceHandle: 'wh_ipc',
      workspaceId: 'ws_ipc',
      memoryId: 'mem_ipc_audio',
      segmentId: 'seg_ipc_audio',
      supplementId: 'sup_ipc_followup',
      requestId: 'request_sup_ipc_empty',
    },
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.transcript, { exists: false, text: '' });
  }
});
```

- [ ] **Step 2: Run main test to verify failure**

Run: `npm run test:main`
Expected: 新两条 fail（`transcript` 字段不存在或为旧值）。

- [ ] **Step 3: 在 supplement read 中追加 transcript**

修改 `readFinalizedAudioSegmentSupplementContent`（src/main/recordingDrafts.ts:1496-1505）的 return 段，把 transcript 读出来：

```ts
const transcript = await readOptionalFinalizedTranscriptFile(
  target.directory,
  supplementDirectoryIdentity,
  { markdownFileName: 'supplement.md', objectType: 'supplement' }
);
const stillUsable = checkWorkspaceUsable(assertWorkspaceUsable);
if (stillUsable) {
  return stillUsable;
}
await assertSameDirectory(target.directory, supplementDirectoryIdentity);
return {
  ok: true,
  audio: new Uint8Array(content),
  audioByteLength: target.audioByteLength,
  transcript,
};
```

同步更新 `readFinalizedAudioSegmentSupplementContent` 的返回类型（function signature 中的 union）：

```ts
): Promise<
  | {
      readonly ok: true;
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly transcript: { readonly exists: boolean; readonly text: string };
    }
  | WorkspaceErrorEnvelope
>
```

- [ ] **Step 4: Run main test to verify it passes**

Run: `npm run test:main`
Expected: 全部通过。

- [ ] **Step 5: Commit**

```bash
git add test/main/workspaceIpc.test.ts src/main/recordingDrafts.ts
git commit -m "$(cat <<'EOF'
feat(main): read supplement transcript alongside audio
EOF
)"
```

---

## Task 4: 新建 `SegmentTranscriptView` 组件（TDD）

**Files:**

- Create: `src/renderer/src/workspace/SegmentTranscriptView.test.tsx`
- Create: `src/renderer/src/workspace/SegmentTranscriptView.tsx`

- [ ] **Step 1: 写 failing 测试**

新建 `src/renderer/src/workspace/SegmentTranscriptView.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SegmentTranscriptView } from './SegmentTranscriptView';

const copy = {
  loading: '正在载入。',
  error: '加载失败，请重试。',
  empty: '还没有转录。',
} as const;

describe('SegmentTranscriptView', () => {
  it('shows loading copy when status is loading', () => {
    render(<SegmentTranscriptView status="loading" transcript={null} copy={copy} />);
    expect(screen.getByText('正在载入。')).toBeInTheDocument();
  });

  it('shows error copy when status is error', () => {
    render(<SegmentTranscriptView status="error" transcript={null} copy={copy} />);
    expect(screen.getByText('加载失败，请重试。')).toBeInTheDocument();
  });

  it('shows empty copy when transcript does not exist', () => {
    render(
      <SegmentTranscriptView status="ready" transcript={{ exists: false, text: '' }} copy={copy} />
    );
    expect(screen.getByText('还没有转录。')).toBeInTheDocument();
  });

  it('shows transcript text with selectable styling when transcript exists', () => {
    render(
      <SegmentTranscriptView
        status="ready"
        transcript={{ exists: true, text: '补充录音转写正文' }}
        copy={copy}
      />
    );
    const paragraph = screen.getByText('补充录音转写正文');
    expect(paragraph).toBeInTheDocument();
    expect(paragraph.className).toContain('select-text');
    expect(paragraph.className).toContain('max-w-[820px]');
    expect(paragraph.className).toContain('text-foreground');
  });

  it('treats null transcript in ready state as empty', () => {
    render(<SegmentTranscriptView status="ready" transcript={null} copy={copy} />);
    expect(screen.getByText('还没有转录。')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run renderer test to verify it fails**

Run: `npm run test:renderer -- SegmentTranscriptView`
Expected: 模块不存在的解析错误。

- [ ] **Step 3: Implement component**

新建 `src/renderer/src/workspace/SegmentTranscriptView.tsx`：

```tsx
type TranscriptStatus = 'loading' | 'error' | 'ready';

export type SegmentTranscriptViewCopy = {
  readonly loading: string;
  readonly error: string;
  readonly empty: string;
};

export type SegmentTranscriptViewProps = {
  readonly status: TranscriptStatus;
  readonly transcript: { readonly exists: boolean; readonly text: string } | null;
  readonly copy: SegmentTranscriptViewCopy;
};

const MUTED_PARAGRAPH = 'text-body leading-body text-muted-foreground';
const TRANSCRIPT_PARAGRAPH = 'select-text max-w-[820px] text-body leading-[1.78] text-foreground';

export function SegmentTranscriptView({ status, transcript, copy }: SegmentTranscriptViewProps) {
  if (status === 'loading') {
    return <p className={MUTED_PARAGRAPH}>{copy.loading}</p>;
  }
  if (status === 'error') {
    return <p className={MUTED_PARAGRAPH}>{copy.error}</p>;
  }
  if (transcript?.exists) {
    return <p className={TRANSCRIPT_PARAGRAPH}>{transcript.text}</p>;
  }
  return <p className={MUTED_PARAGRAPH}>{copy.empty}</p>;
}
```

- [ ] **Step 4: Run renderer test to verify it passes**

Run: `npm run test:renderer -- SegmentTranscriptView`
Expected: 5 个 case 全通过。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/workspace/SegmentTranscriptView.tsx src/renderer/src/workspace/SegmentTranscriptView.test.tsx
git commit -m "$(cat <<'EOF'
feat(renderer): add SegmentTranscriptView shared transcript display
EOF
)"
```

---

## Task 5: 把 Segment transcript tab 切换到共享组件

**Files:**

- Modify: `src/renderer/src/workspace/MemoryStudio.tsx:1856-1883`

- [ ] **Step 1: 替换 inline JSX**

把 `MemoryStudio.tsx:1866-1882` 这段四态 `<p>` 替换为：

```tsx
{resolvedActiveContentTab === 'transcript' ? (
  <section
    key="transcript"
    aria-label="片段转录"
    role="tabpanel"
    id={transcriptContentTab.panelId}
    aria-labelledby={transcriptContentTab.tabId}
    data-slot="memory-studio-transcript-scroll"
    className="reo-content-tab-panel-motion edge-fade-y scrollbar-hover mt-4 min-h-0 flex-1 overflow-y-auto pl-8 pr-8 pb-6"
  >
    <SegmentTranscriptView
      status={
        segmentContentQuery.isLoading
          ? 'loading'
          : segmentContentQuery.isError
            ? 'error'
            : 'ready'
      }
      transcript={segmentContent?.transcript ?? null}
      copy={{
        loading: '正在载入片段内容。',
        error: '片段内容加载失败，请重试。',
        empty: '这段录音还没有转录。',
      }}
    />
  </section>
) : activeSegmentSupplement ? (
```

在 `MemoryStudio.tsx` 顶部 import 区追加：

```ts
import { SegmentTranscriptView } from './SegmentTranscriptView';
```

- [ ] **Step 2: Run renderer tests to verify regression-free**

Run: `npm run test:renderer`
Expected: 全部通过；App.test.tsx 与 RecordingOverlay.test.tsx 现有 segment 转录覆盖不变。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/workspace/MemoryStudio.tsx
git commit -m "$(cat <<'EOF'
refactor(renderer): use SegmentTranscriptView in segment transcript tab
EOF
)"
```

---

## Task 6: supplement panel 接入转录区 + cache invalidate（TDD）

**Files:**

- Modify (test): `src/renderer/src/App.test.tsx`（fixture + 新增两例）
- Modify: `src/renderer/src/workspace/MemoryStudio.tsx`（`SegmentSupplementAudioPlayer`，848-894）
- Modify: `src/renderer/src/App.tsx:1554-1601`

- [ ] **Step 1: 给 supplement panel 写 failing 渲染测试**

在 `src/renderer/src/App.test.tsx` 中，定位描述 SegmentSupplement 行为的 `describe` 块（fixture 在 line 270 开始），新增两个测试。先把 `mockSegmentSupplementWorkspace`（line 311-360）末尾追加一个默认 supplement 读：

```ts
reoWorkspace.readFinalizedAudioSegmentSupplement.mockImplementation(async (payload) => ({
  ok: true,
  value: {
    requestId: payload.requestId,
    workspaceId: 'ws_1',
    memoryId: payload.memoryId,
    segmentId: payload.segmentId,
    supplementId: payload.supplementId,
    audio: new Uint8Array([4, 5]),
    audioByteLength: 2,
    transcript: { exists: true, text: '补充录音转写正文' },
  },
}));
```

然后在同一 describe 内新增两条 it：

```ts
it('renders the supplement transcript text under the player when transcript exists', async () => {
  const user = userEvent.setup();
  const fixture = createSegmentSupplementFixture();
  mockSegmentSupplementWorkspace(fixture);

  render(
    <ReoQueryProvider>
      <App />
    </ReoQueryProvider>
  );

  await createWorkspaceWithSegmentSupplement(user);
  await user.click(screen.getByRole('tab', { name: '补充录音1' }));

  expect(await screen.findByText('补充录音转写正文')).toBeInTheDocument();
});

it('renders the supplement empty transcript copy when the supplement has no transcript', async () => {
  const user = userEvent.setup();
  const fixture = createSegmentSupplementFixture();
  mockSegmentSupplementWorkspace(fixture);
  reoWorkspace.readFinalizedAudioSegmentSupplement.mockImplementation(async (payload) => ({
    ok: true,
    value: {
      requestId: payload.requestId,
      workspaceId: 'ws_1',
      memoryId: payload.memoryId,
      segmentId: payload.segmentId,
      supplementId: payload.supplementId,
      audio: new Uint8Array([4, 5]),
      audioByteLength: 2,
      transcript: { exists: false, text: '' },
    },
  }));

  render(
    <ReoQueryProvider>
      <App />
    </ReoQueryProvider>
  );

  await createWorkspaceWithSegmentSupplement(user);
  await user.click(screen.getByRole('tab', { name: '补充录音1' }));

  expect(await screen.findByText('这段补充录音还没有转录。')).toBeInTheDocument();
});
```

- [ ] **Step 2: 在 supplement recovery save 用例里追加 invalidate 断言**

定位 `src/renderer/src/App.test.tsx` 里"saves an unfinished SegmentSupplement recovery through supplement IPC"用例（line ~4928 起，到 line ~5125 止）。它已经覆盖了 `finalizeSegmentSupplementRecordingDraft` 成功 → `saveSegmentSupplementTranscript` 成功 → `handleSegmentSupplementFinalized` 调用的完整链路；在这条用例里复用现成 setup，无需另造 finalize 流程。

修改要点：

1. 在 render 之前，准备一份会被 invalidate 探测的 supplement content cache。`render(<App>)` 之后立刻拿到 App 内部的 `queryClient`——参考同文件 line ~1308 已有的 `segmentSupplementContentQueryKey({ ... })` 直接 `queryClient.setQueryData(...)` 写入一份 `transcript: { exists: false, text: '' }` 的缓存。注意 App.test.tsx 已经 import 了 `segmentSupplementContentQueryKey`（line ~98 的模块）；若当前文件还没 import，需要补：

   ```ts
   import { segmentSupplementContentQueryKey } from './workspace/workspaceQueries';
   ```

2. 把该用例的 render 从 `<ReoQueryProvider>` 切换为 `<QueryClientProvider client={queryClient}>` 模式，以便测试持有 queryClient 句柄；这是同文件 line 1345-1351 已建立的惯例。`createReoQueryClient` 与 `QueryClientProvider` 在 App.test.tsx 顶部 line 1 与 line 8 已 import，不需要追加。

   把 render 段：

   ```tsx
   render(
     <ReoQueryProvider>
       <App />
     </ReoQueryProvider>
   );
   ```

   改成：

   ```tsx
   const queryClient = createReoQueryClient();
   const supplementContentKey = segmentSupplementContentQueryKey({
     workspaceId: 'ws_1',
     memoryId: 'mem_existing',
     segmentId: 'seg_parent',
     supplementId: 'sup_recoverable',
   });
   const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

   render(
     <QueryClientProvider client={queryClient}>
       <App />
     </QueryClientProvider>
   );
   ```

3. 在用例尾部已有 `expect(reoWorkspace.saveSegmentSupplementTranscript).toHaveBeenCalledWith({...})` 之后追加：

   ```ts
   await waitFor(() => {
     expect(invalidateSpy).toHaveBeenCalledWith({
       exact: true,
       queryKey: supplementContentKey,
     });
   });
   ```

   spy 断言对实现细节稳健，并精确证明 invalidate 被调用且 key 正确。

- [ ] **Step 3: Run renderer tests to verify they fail**

Run: `npm run test:renderer -- App`
Expected: 三个新 case 失败（panel 内还没有 TranscriptView；cache 没被 invalidate）。

- [ ] **Step 4: 在 supplement panel 内插入 TranscriptView**

修改 `src/renderer/src/workspace/MemoryStudio.tsx:848-894` 的 `SegmentSupplementAudioPlayer` 返回 JSX。新增 import：

```tsx
import { SegmentTranscriptView } from './SegmentTranscriptView';
```

新的返回 JSX：

```tsx
return (
  <article aria-label={supplement.title} className="py-12">
    <MemoryStudioAudioPlaybackRow
      audioAvailable={audioUrl !== null}
      durationMs={supplement.durationMs}
      loading={supplementContentQuery.isLoading}
      onKeyDown={handleKeyDown}
      onPointerCancel={endPointerScrub}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerScrub}
      onTogglePlayback={togglePlayback}
      playButtonLabel={`${playing ? '暂停' : '播放'}补充录音 ${supplement.title}`}
      playbackTimeMs={playbackTimeMs}
      playbackProgress={playbackProgress}
      playing={playing}
      rowSlot="memory-studio-supplement-player"
      waveformData={waveformData}
      waveformLabel="补充录音播放进度"
      waveformSlot="memory-studio-supplement-waveform"
      waveformSource={waveformSource}
    />
    {supplementContentQuery.isError ? (
      <p role="status" className="mt-8 text-ui-xs leading-ui-xs text-muted-foreground">
        补充录音加载失败。
      </p>
    ) : null}
    <div data-slot="memory-studio-supplement-transcript" className="mt-12">
      <SegmentTranscriptView
        status={
          supplementContentQuery.isLoading
            ? 'loading'
            : supplementContentQuery.isError
              ? 'error'
              : 'ready'
        }
        transcript={supplementContent?.transcript ?? null}
        copy={{
          loading: '正在载入补充录音内容。',
          error: '补充录音转录加载失败，请重试。',
          empty: '这段补充录音还没有转录。',
        }}
      />
    </div>
    <audio
      ref={audioRef}
      src={audioUrl ?? undefined}
      onEnded={() => {
        playingRef.current = false;
        setPlaying(false);
        setPlaybackTimeMs(supplement.durationMs);
      }}
      onPause={() => {
        playingRef.current = false;
        setPlaying(false);
      }}
      onTimeUpdate={(event) => {
        setPlaybackTimeMs(
          Math.min(supplement.durationMs, Math.round(event.currentTarget.currentTime * 1000))
        );
      }}
    />
  </article>
);
```

- [ ] **Step 5: 在 `handleSegmentSupplementFinalized` 末尾追加 invalidate**

在 `src/renderer/src/App.tsx:1554-1601`，紧接 `setWorkspaceSession(...)` 之后、函数结束之前追加：

```ts
void queryClient.invalidateQueries({
  exact: true,
  queryKey: segmentSupplementContentQueryKey({
    workspaceId: activeWorkspaceSession.workspaceId,
    memoryId: finalized.memory.memoryId,
    segmentId: finalized.segment.segmentId,
    supplementId: finalized.supplement.supplementId,
  }),
});
```

`segmentSupplementContentQueryKey` 已在 App.tsx:98 import，不需要新增 import。

- [ ] **Step 6: Run renderer tests to verify they pass**

Run: `npm run test:renderer -- App`
Expected: 三个新 case 全部通过；既有 supplement 行为测试不回归。

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/workspace/MemoryStudio.tsx src/renderer/src/App.tsx src/renderer/src/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(renderer): show transcript under supplement audio player and refresh after save
EOF
)"
```

---

## Task 7: 同步 current 文档

**Files:**

- Modify: `docs/current/frontend.md:105`
- Modify: `docs/current/data.md:92`

- [ ] **Step 1: 改 `frontend.md:105`**

把当前句子末尾的"不展示 transcript"段去掉，把整段改为：

```
- Audio SegmentSupplement tab panel 通过 SegmentSupplement audio content Query 读取本地音频 bytes 和已保存 transcript，使用与主播放区一致的 play/pause、真实 waveform slider、点击 seek、scrub-session 拖拽 seek 和等宽时间 UI；播放行下方使用与 Segment transcript tab 同一份 `SegmentTranscriptView` 显示 supplement 自己的 transcript，loading/error/empty/exists 文案按 supplement 语境（`正在载入补充录音内容。`、`补充录音转录加载失败，请重试。`、`这段补充录音还没有转录。`）。
```

- [ ] **Step 2: 改 `data.md:92`**

把句子里"response 返回同 requestId、identity、audio bytes 和 audioByteLength，不返回 transcript text、handle、root path、file path 或 selection token" 改为：

```
response 返回同 requestId、identity、audio bytes、audioByteLength 和 transcript（exists+text），不返回 handle、root path、file path 或 selection token；transcript save 成功后对应 supplement content Query 会被 invalidate，对齐第 107 行 segment 行为。
```

- [ ] **Step 3: Run verify:quick 防 format 漂移**

Run: `npm run format:check`
Expected: 通过。如果失败，运行 `npx prettier --write docs/current/frontend.md docs/current/data.md` 后再验。

- [ ] **Step 4: Commit**

```bash
git add docs/current/frontend.md docs/current/data.md
git commit -m "$(cat <<'EOF'
docs(current): record supplement transcript panel in frontend and data
EOF
)"
```

---

## Task 8: 全量验证 + 视觉证据

**Files:**

- Modify: `docs/specs/2026-05-16-0026-supplement-transcript-panel/verification.md`
- Create (optional): `docs/specs/2026-05-16-0026-supplement-transcript-panel/artifacts/*.png`

- [ ] **Step 1: Run full verify**

Run: `npm run verify:quick`
Expected: typecheck + main tests + renderer tests + lint + format 全通过。

- [ ] **Step 2: Dev server 内手动验证 4 态**

启动 dev server：

```bash
npm run dev
```

在已有 e2e fixture 或手动新建 supplement 上验证：

- empty：新建空 supplement，看到 `这段补充录音还没有转录。`。
- exists：录一段并完成保存，看到 transcript 文本，`select-text` 与 `max-w-[820px]` 视觉成立。
- 长 transcript：滚动是 supplement panel section 的 `overflow-y-auto`，article 内无独立滚动条。
- loading：清 cache 重进 supplement tab，瞬态 loading 文案出现。
- error：在 devtools 中模拟 `reoWorkspace.readFinalizedAudioSegmentSupplement` 抛错，audio 行下方 `补充录音加载失败。` 与 transcript 区 `补充录音转录加载失败，请重试。` 同时可见。

逐项截图保存到 `docs/specs/2026-05-16-0026-supplement-transcript-panel/artifacts/`。

- [ ] **Step 3: 把命令输出与截图勾入 verification.md**

把 verification.md 全部 checkbox 勾选，每条配截图文件名或命令输出摘要。

- [ ] **Step 4: Commit**

```bash
git add docs/specs/2026-05-16-0026-supplement-transcript-panel/verification.md docs/specs/2026-05-16-0026-supplement-transcript-panel/artifacts/
git commit -m "$(cat <<'EOF'
docs(spec): record supplement transcript panel verification evidence
EOF
)"
```

---

## Self-Review 清单（执行前再核一遍）

- [ ] Task 1 替换 schema 后 IPC handler 不需要单独改 schema（IPC 在 main 内复用同一 schema）。
- [ ] Task 2 refactor 保持 segment transcript 既有行为；任何额外测试就地复用现有 `readFinalizedAudioSegment` 覆盖。
- [ ] Task 3 invert 后旧测试名称含"without transcript text"已不属当前事实，标题随之更新为"and transcript"。
- [ ] Task 6 invalidate 测试如果当前 App.test.tsx 已有"supplement 录音完成 + transcript save success"覆盖，把 invalidate 断言并入那条用例并复用 setup，避免重复造 finalize 流程。
- [ ] Task 7 修改文档前后 `verify:quick` 内 `format:check` 必须通过。
- [ ] 不引入转录编辑、不引入新的 IPC、不改 supplement 删除/恢复/重命名/录音生命周期；这些都在 spec 范围外，遇到诱惑立即停。
