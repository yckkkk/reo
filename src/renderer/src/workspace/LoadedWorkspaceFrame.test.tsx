import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createReoQueryClient } from '../queryClient';
import type {
  SavedNoteSegmentContent,
  SavedNoteSegmentSupplementContent,
} from './finalizedNoteContentSave';
import { LoadedWorkspaceFrame } from './LoadedWorkspaceFrame';
import type {
  SegmentSupplementTranscriptionRetryTarget,
  SegmentTranscriptionRetryTarget,
  TranscriptionBackfillController,
} from './MemoryStudio';
import type { WorkspaceMemoryDetail, WorkspaceSession } from './workspaceApi';
import {
  seedWorkspaceSnapshot,
  segmentContentQueryKey,
  segmentSupplementContentQueryKey,
  workspaceSnapshotQueryKey,
} from './workspaceQueries';

function workspaceSession(snapshot: Partial<WorkspaceSession['snapshot']> = {}): WorkspaceSession {
  return {
    workspaceHandle: 'workspace-handle-secret',
    workspaceId: 'ws_1',
    snapshot: {
      workspaceId: 'ws_1',
      title: 'Daily memory',
      description: 'Private notes',
      memories: [],
      ...snapshot,
    },
  };
}

const BASELINE_TIPTAP_HASH_A = 'd'.repeat(64);
const BASELINE_TIPTAP_HASH_B = 'e'.repeat(64);

const birthdayMemory = {
  memoryId: 'mem_birthday',
  title: 'My seventh birthday',
  createdAt: '2026-05-06T13:08:00.000',
  updatedAt: '2026-05-06T13:10:00.000',
  segmentCount: 2,
  noteSegmentCount: 0,
  audioSegmentCount: 2,
  audioDurationMs: 125_000,
  audioByteLength: 2048,
  hasAudioTranscript: true,
  hasAnyNote: false,
  supplementCount: 0,
};

const birthdayDetail: WorkspaceMemoryDetail = {
  workspaceId: 'ws_1',
  memoryId: 'mem_birthday',
  title: 'My seventh birthday',
  createdAt: '2026-05-06T13:08:00.000',
  updatedAt: '2026-05-06T13:10:00.000',
  segmentCount: 2,
  noteSegmentCount: 0,
  audioSegmentCount: 2,
  audioDurationMs: 125_000,
  audioByteLength: 2048,
  hasAudioTranscript: true,
  hasAnyNote: false,
  supplementCount: 0,
  segments: [
    {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      type: 'audio',
      title: 'Birthday candles',
      createdAt: '2026-05-06T13:08:00.000',
      updatedAt: '2026-05-06T13:10:00.000',
      durationMs: 125_000,
      audioByteLength: 2048,
      lastTranscriptionAttempt: 'never' as const,
      transcript: {
        exists: true,
      },
      supplementCount: 0,
      supplements: [],
    },
  ],
};

type AudioSegment = Extract<WorkspaceMemoryDetail['segments'][number], { type: 'audio' }>;
type AudioSegmentSupplement = Extract<
  WorkspaceMemoryDetail['segments'][number]['supplements'][number],
  { type: 'audio' }
>;
type NoteSegmentSupplement = Extract<
  WorkspaceMemoryDetail['segments'][number]['supplements'][number],
  { type: 'note' }
>;
type NoteSegment = Extract<WorkspaceMemoryDetail['segments'][number], { type: 'note' }>;

const birthdayVoiceSegment = birthdayDetail.segments[0] as AudioSegment | undefined;
if (!birthdayVoiceSegment) {
  throw new Error('birthdayDetail fixture must include a segment');
}

function expectRichEditorContent(editor: HTMLElement, expectedText: string | readonly string[]) {
  const expectedParts = typeof expectedText === 'string' ? [expectedText] : expectedText;
  expect(editor).toHaveAttribute('contenteditable');
  for (const expectedPart of expectedParts) {
    expect(editor).toHaveTextContent(expectedPart);
  }
}

function plainParagraphTiptapDoc(text: string) {
  return {
    type: 'doc',
    content: text
      ? [
          {
            type: 'paragraph',
            attrs: { textAlign: null },
            content: [{ type: 'text', text }],
          },
        ]
      : [],
  };
}

async function replaceRichEditorMarkdown(editor: HTMLElement, markdown: string) {
  const user = userEvent.setup();
  await user.click(editor);
  fireEvent.keyDown(editor, { code: 'KeyA', key: 'a', metaKey: true });
  fireEvent.keyDown(editor, { code: 'KeyA', key: 'a', ctrlKey: true });
  fireEvent.paste(editor, {
    clipboardData: {
      files: [],
      getData: (type: string) => (type === 'text/plain' ? markdown : ''),
      items: [],
      setData: () => undefined,
      types: ['text/plain'],
    },
  });
}

const birthdayDetailWithTwoSegments: WorkspaceMemoryDetail = {
  ...birthdayDetail,
  segmentCount: 2,
  noteSegmentCount: 0,
  audioSegmentCount: 2,
  audioDurationMs: 190_000,
  audioByteLength: 3072,
  segments: [
    birthdayVoiceSegment,
    {
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_song',
      type: 'audio',
      title: 'Birthday song',
      createdAt: '2026-05-06T13:12:00.000',
      updatedAt: '2026-05-06T13:13:05.000',
      durationMs: 65_000,
      audioByteLength: 1024,
      lastTranscriptionAttempt: 'never' as const,
      transcript: {
        exists: false,
      },
      supplementCount: 0,
      supplements: [],
    },
  ],
};

function audioSupplement(overrides: Partial<AudioSegmentSupplement> = {}): AudioSegmentSupplement {
  return {
    workspaceId: 'ws_1',
    memoryId: 'mem_birthday',
    segmentId: 'seg_birthday_voice',
    supplementId: 'sup_birthday_followup',
    type: 'audio',
    title: '补充录音',
    createdAt: '2026-05-06T13:11:00.000',
    updatedAt: '2026-05-06T13:11:05.000',
    durationMs: 5_000,
    audioByteLength: 3,
    lastTranscriptionAttempt: 'never' as const,
    transcript: { exists: false },
    ...overrides,
  };
}

function noteSupplement(overrides: Partial<NoteSegmentSupplement> = {}): NoteSegmentSupplement {
  return {
    workspaceId: 'ws_1',
    memoryId: 'mem_birthday',
    segmentId: 'seg_birthday_voice',
    supplementId: 'sup_birthday_note',
    type: 'note',
    title: '补充笔记',
    createdAt: '2026-05-06T13:16:00.000',
    updatedAt: '2026-05-06T13:16:30.000',
    bodyByteLength: 28,
    ...overrides,
  };
}

function noteSegment(overrides: Partial<NoteSegment> = {}): NoteSegment {
  return {
    workspaceId: 'ws_1',
    memoryId: 'mem_birthday',
    segmentId: 'seg_birthday_note',
    type: 'note',
    title: 'Cake planning note',
    createdAt: '2026-05-06T13:14:00.000',
    updatedAt: '2026-05-06T13:15:00.000',
    bodyByteLength: 32,
    supplementCount: 0,
    supplements: [],
    ...overrides,
  };
}

function createDragDataTransfer() {
  const store = new Map<string, string>();
  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    getData: vi.fn((format: string) => store.get(format) ?? ''),
    setData: vi.fn((format: string, value: string) => {
      store.set(format, value);
    }),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, reject, resolve };
}

function mockContentTabRect(element: HTMLElement) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      bottom: 34,
      height: 34,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

function fireContentTabDragOver(
  element: HTMLElement,
  input: {
    readonly clientX: number;
    readonly dataTransfer: ReturnType<typeof createDragDataTransfer>;
  }
) {
  const event = createEvent.dragOver(element, { dataTransfer: input.dataTransfer });
  Object.defineProperty(event, 'clientX', {
    configurable: true,
    value: input.clientX,
  });
  fireEvent(element, event);
}

async function expectMoreTriggerIsIsolatedAndOpensMenu(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLButtonElement,
  menuName: string
) {
  const pointerDown = createEvent.pointerDown(trigger);
  const pointerDownStop = vi.spyOn(pointerDown, 'stopPropagation');
  fireEvent(trigger, pointerDown);
  expect(pointerDownStop).toHaveBeenCalled();

  const mouseDown = createEvent.mouseDown(trigger);
  const mouseDownStop = vi.spyOn(mouseDown, 'stopPropagation');
  fireEvent(trigger, mouseDown);
  expect(mouseDownStop).toHaveBeenCalled();

  const dragStart = createEvent.dragStart(trigger, { dataTransfer: createDragDataTransfer() });
  const dragStartStop = vi.spyOn(dragStart, 'stopPropagation');
  fireEvent(trigger, dragStart);
  expect(dragStartStop).toHaveBeenCalled();

  const click = createEvent.click(trigger);
  const clickStop = vi.spyOn(click, 'stopPropagation');
  fireEvent(trigger, click);
  expect(clickStop).toHaveBeenCalled();
  expect(await screen.findByRole('menu', { name: menuName })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await waitFor(() => {
    expect(screen.queryByRole('menu', { name: menuName })).not.toBeInTheDocument();
  });
}

function birthdayDetailWithSupplements(
  supplements: readonly WorkspaceMemoryDetail['segments'][number]['supplements'][number][]
): WorkspaceMemoryDetail {
  const firstSegment = birthdayDetail.segments[0];

  if (!firstSegment) {
    throw new Error('birthdayDetail fixture must include a segment');
  }

  return {
    ...birthdayDetail,
    supplementCount: supplements.length,
    segments: [
      {
        ...firstSegment,
        supplementCount: supplements.length,
        supplements: [...supplements],
      },
    ],
  };
}

function setScrollMetrics(
  element: HTMLElement,
  metrics: {
    readonly clientWidth: number;
    readonly scrollLeft: number;
    readonly scrollWidth: number;
  }
) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: metrics.clientWidth },
    scrollLeft: { configurable: true, value: metrics.scrollLeft, writable: true },
    scrollWidth: { configurable: true, value: metrics.scrollWidth },
  });
}

function expectSoftFlatClass(element: Element | null) {
  expect(element).toBeInstanceOf(HTMLElement);
  const className = (element as HTMLElement).getAttribute('class') ?? '';
  expect(className).not.toMatch(/(^|\s)(hover:|active:)?-?translate-/);
  expect(className).not.toMatch(/(^|\s)(hover:|active:)?scale-/);
  expect(className).not.toMatch(/(^|\s)(hover:|active:)?opacity-/);
  expect(className).not.toMatch(/\b(?:bg|border|text)-[^\s/]+\/\d/);
  expect(className).not.toMatch(/card-white|text-card-white|border-card-white/);
  expect(className).not.toMatch(/shadow-none-\d/);
}

const morningMemory = {
  memoryId: 'mem_morning',
  title: 'Morning note',
  createdAt: '2026-04-11T09:00:00.000',
  updatedAt: '2026-04-11T09:02:00.000',
  segmentCount: 1,
  noteSegmentCount: 0,
  audioSegmentCount: 1,
  audioDurationMs: 30_000,
  audioByteLength: 512,
  hasAudioTranscript: false,
  hasAnyNote: false,
  supplementCount: 1,
};

const recitalMemory = {
  memoryId: 'mem_recital',
  title: 'School recital',
  createdAt: '2026-05-01T09:00:00.000',
  updatedAt: '2026-05-01T09:10:00.000',
  segmentCount: 1,
  noteSegmentCount: 0,
  audioSegmentCount: 1,
  audioDurationMs: 60_000,
  audioByteLength: 1024,
  hasAudioTranscript: false,
  hasAnyNote: false,
  supplementCount: 0,
};

function renderLoadedWorkspaceFrame({
  currentMemory = null,
  memoryRailOpen,
  onDeleteMemory = vi.fn(),
  onDeleteSegment = vi.fn(),
  onDeleteSegmentSupplement = vi.fn(),
  onClearSegmentContent = vi.fn(),
  onSegmentTranscriptSaved = vi.fn(),
  onSegmentSupplementTranscriptSaved = vi.fn(),
  onNoteSegmentContentSaved = vi.fn(),
  onNoteSegmentSupplementContentSaved = vi.fn(),
  onRenameMemory = vi.fn(),
  onRenameSegmentContent = vi.fn(),
  onRenameSegment = vi.fn(),
  onRenameSegmentSupplement = vi.fn(),
  onInlineMarkdownDirtyChange = vi.fn(),
  onRetrySegmentTranscription,
  onRetrySupplementTranscription,
  onSelectMemory = vi.fn(),
  onStartNote = vi.fn(),
  onStartSegmentSupplementNote = vi.fn(),
  onStartRecording = vi.fn(),
  onStartSegmentSupplementRecording = vi.fn(),
  openMemoryDocument = vi.fn().mockResolvedValue({ ok: true }),
  openSegmentSupplementDocument = vi.fn().mockResolvedValue({ ok: true }),
  revealMemoryInFinder = vi.fn().mockResolvedValue({ ok: true }),
  revealSegmentSupplementInFinder = vi.fn().mockResolvedValue({ ok: true }),
  copyMemoryRelativePath = vi.fn().mockResolvedValue({ ok: true }),
  copyMemoryAbsolutePath = vi.fn().mockResolvedValue({ ok: true }),
  copySegmentSupplementRelativePath = vi.fn().mockResolvedValue({ ok: true }),
  copySegmentSupplementAbsolutePath = vi.fn().mockResolvedValue({ ok: true }),
  readFinalizedAudioSegmentSupplement = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_RECORDING_NOT_FOUND',
      message: 'Supplement recording not found',
    },
  }),
  readFinalizedAudioSegment = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_RECORDING_NOT_FOUND',
      message: 'Recording not found',
    },
  }),
  readSegmentContent = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
      message: 'Note segment not found',
    },
  }),
  readSegmentSupplementContent = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
      message: 'Note supplement not found',
    },
  }),
  updateSegmentContentTabOrder = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
      message: 'Segment not found',
    },
  }),
  saveTranscript = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
      message: 'Segment not found',
    },
  }),
  saveSegmentSupplementTranscript = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
      message: 'Segment supplement not found',
    },
  }),
  writeSegmentContent = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
      message: 'Segment not found',
    },
  }),
  writeSegmentSupplementContent = vi.fn().mockResolvedValue({
    ok: false,
    error: {
      code: 'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
      message: 'Note supplement not found',
    },
  }),
  session = workspaceSession(),
}: {
  readonly currentMemory?: WorkspaceSession['snapshot']['memories'][number] | null;
  readonly memoryRailOpen?: boolean;
  readonly onDeleteMemory?: (memory: WorkspaceSession['snapshot']['memories'][number]) => void;
  readonly onDeleteSegment?: () => void;
  readonly onDeleteSegmentSupplement?: () => void;
  readonly onClearSegmentContent?: Parameters<
    typeof LoadedWorkspaceFrame
  >[0]['onClearSegmentContent'];
  readonly onSegmentTranscriptSaved?: (saved: {
    readonly expectedSession: WorkspaceSession;
    readonly memory: WorkspaceSession['snapshot']['memories'][number];
    readonly memoryId: string;
    readonly segmentId: string;
  }) => void;
  readonly onSegmentSupplementTranscriptSaved?: Parameters<
    typeof LoadedWorkspaceFrame
  >[0]['onSegmentSupplementTranscriptSaved'];
  readonly onNoteSegmentContentSaved?: (saved: SavedNoteSegmentContent) => void;
  readonly onNoteSegmentSupplementContentSaved?: (saved: SavedNoteSegmentSupplementContent) => void;
  readonly onRenameMemory?: (memory: WorkspaceSession['snapshot']['memories'][number]) => void;
  readonly onRenameSegmentContent?: Parameters<
    typeof LoadedWorkspaceFrame
  >[0]['onRenameSegmentContent'];
  readonly onRenameSegment?: () => void;
  readonly onRenameSegmentSupplement?: () => void;
  readonly onInlineMarkdownDirtyChange?: (dirty: boolean) => void;
  readonly onRetrySegmentTranscription?: (target: SegmentTranscriptionRetryTarget) => void;
  readonly onRetrySupplementTranscription?: (
    target: SegmentSupplementTranscriptionRetryTarget
  ) => void;
  readonly onSelectMemory?: (memoryId: string) => void;
  readonly onStartNote?: () => void;
  readonly onStartSegmentSupplementNote?: (target: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
  }) => void;
  readonly onStartRecording?: () => void;
  readonly onStartSegmentSupplementRecording?: (target: {
    readonly memoryId: string;
    readonly segmentId: string;
    readonly title: string;
  }) => void;
  readonly openMemoryDocument?: ReturnType<typeof vi.fn>;
  readonly openSegmentSupplementDocument?: ReturnType<typeof vi.fn>;
  readonly revealMemoryInFinder?: ReturnType<typeof vi.fn>;
  readonly revealSegmentSupplementInFinder?: ReturnType<typeof vi.fn>;
  readonly copyMemoryRelativePath?: ReturnType<typeof vi.fn>;
  readonly copyMemoryAbsolutePath?: ReturnType<typeof vi.fn>;
  readonly copySegmentSupplementRelativePath?: ReturnType<typeof vi.fn>;
  readonly copySegmentSupplementAbsolutePath?: ReturnType<typeof vi.fn>;
  readonly readFinalizedAudioSegmentSupplement?: ReturnType<typeof vi.fn>;
  readonly readFinalizedAudioSegment?: ReturnType<typeof vi.fn>;
  readonly readSegmentContent?: ReturnType<typeof vi.fn>;
  readonly readSegmentSupplementContent?: ReturnType<typeof vi.fn>;
  readonly updateSegmentContentTabOrder?: ReturnType<typeof vi.fn>;
  readonly saveTranscript?: ReturnType<typeof vi.fn>;
  readonly saveSegmentSupplementTranscript?: ReturnType<typeof vi.fn>;
  readonly writeSegmentContent?: ReturnType<typeof vi.fn>;
  readonly writeSegmentSupplementContent?: ReturnType<typeof vi.fn>;
  readonly session?: WorkspaceSession;
} = {}) {
  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: {
      copyMemoryAbsolutePath,
      copyMemoryRelativePath,
      copySegmentSupplementAbsolutePath,
      copySegmentSupplementRelativePath,
      openMemoryDocument,
      openSegmentSupplementDocument,
      readFinalizedAudioSegmentSupplement,
      readFinalizedAudioSegment,
      readSegmentContent,
      readSegmentSupplementContent,
      saveSegmentSupplementTranscript,
      saveTranscript,
      updateSegmentContentTabOrder,
      writeSegmentContent,
      writeSegmentSupplementContent,
      readMemoryDetail: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'ERR_MEMORY_NOT_FOUND',
          message: 'Memory not found',
        },
      }),
      revealMemoryInFinder,
      revealSegmentSupplementInFinder,
    } as unknown as Window['reoWorkspace'],
  });
  const queryClient = createReoQueryClient();
  seedWorkspaceSnapshot(queryClient, session);
  const frameProps =
    memoryRailOpen === undefined
      ? {}
      : {
          memoryRailOpen,
        };
  const transcriptionBackfill: TranscriptionBackfillController | undefined =
    onRetrySegmentTranscription || onRetrySupplementTranscription
      ? {
          ...(onRetrySegmentTranscription ? { retrySegment: onRetrySegmentTranscription } : {}),
          ...(onRetrySupplementTranscription
            ? { retrySupplement: onRetrySupplementTranscription }
            : {}),
        }
      : undefined;
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <LoadedWorkspaceFrame
        currentMemory={currentMemory}
        workspaceSession={session}
        onDeleteMemory={onDeleteMemory}
        onDeleteSegment={onDeleteSegment}
        onDeleteSegmentSupplement={onDeleteSegmentSupplement}
        onClearSegmentContent={onClearSegmentContent}
        onSegmentTranscriptSaved={onSegmentTranscriptSaved}
        onSegmentSupplementTranscriptSaved={onSegmentSupplementTranscriptSaved}
        onNoteSegmentContentSaved={onNoteSegmentContentSaved}
        onNoteSegmentSupplementContentSaved={onNoteSegmentSupplementContentSaved}
        onRenameMemory={onRenameMemory}
        onRenameSegmentContent={onRenameSegmentContent}
        onRenameSegment={onRenameSegment}
        onRenameSegmentSupplement={onRenameSegmentSupplement}
        onInlineMarkdownDirtyChange={onInlineMarkdownDirtyChange}
        {...(transcriptionBackfill ? { transcriptionBackfill } : {})}
        onSelectMemory={onSelectMemory}
        onStartNote={onStartNote}
        onStartSegmentSupplementNote={onStartSegmentSupplementNote}
        onStartSegmentSupplementRecording={onStartSegmentSupplementRecording}
        onStartRecording={onStartRecording}
        {...frameProps}
      />
    </QueryClientProvider>
  );

  return { queryClient, ...renderResult };
}

describe('LoadedWorkspaceFrame', () => {
  it('renders the loaded workspace frame as a workspace stage with one real expression entry', async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();

    renderLoadedWorkspaceFrame({ onStartRecording });

    expect(screen.queryByRole('region', { name: '记忆空间栏' })).not.toBeInTheDocument();
    expect(screen.queryByText('Daily memory')).not.toBeInTheDocument();
    const stage = screen.getByRole('region', { name: '记忆空间舞台' });
    expect(within(stage).getByRole('heading', { name: '今天想记录些什么？' })).toBeInTheDocument();
    expect(within(stage).getByRole('heading', { name: '今天想记录些什么？' })).toHaveClass(
      'font-memory-serif'
    );
    expect(stage.querySelector('svg')).not.toBeInTheDocument();
    expect(within(stage).queryByText('片段时间线')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '全部记忆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: '搜索记忆' })).not.toBeInTheDocument();
    expect(screen.queryByText('workspace-handle-secret')).not.toBeInTheDocument();

    const dock = screen.getByRole('region', { name: '表达入口' });
    expect(dock).toHaveClass('pointer-events-none');
    expect(dock.closest('[data-slot="workspace-expression-fab-layer"]')).toHaveClass(
      'bottom-32',
      'right-24',
      'sm:right-40'
    );
    expect(dock.closest('[data-slot="workspace-expression-fab-track"]')).toHaveClass('w-full');
    const workspaceFrame = document.querySelector('[data-slot="workspace-frame"]');
    expect(workspaceFrame).toHaveClass('h-full', 'min-h-0', 'overflow-hidden');
    expect(workspaceFrame).not.toHaveClass('min-h-full');
    expect(workspaceFrame).toHaveStyle({
      '--workspace-memory-rail-width': '240px',
    });
    const dialTrigger = within(dock).getByRole('button', { name: '打开表达入口' });
    expect(dialTrigger).toHaveClass(
      '!bg-brand-ember',
      '!rounded-full',
      '!size-[var(--reo-speed-dial-diameter)]'
    );
    expect(within(dock).queryByRole('menuitem', { name: '录音' })).not.toBeInTheDocument();
    expect(dock.querySelector('[role="menu"]')).toHaveAttribute('aria-hidden', 'true');
    expect(within(dock).queryByRole('menuitem', { name: '上传图片' })).not.toBeInTheDocument();

    await user.click(dialTrigger);
    const recordingAction = within(dock).getByRole('menuitem', { name: '录音' });
    expect(recordingAction).toHaveClass(
      '!rounded-full',
      'size-[var(--reo-speed-dial-action-size)]'
    );
    expect(recordingAction).not.toHaveClass('rounded-md', 'rounded-lg');
    expect(within(dock).getByRole('menu', { name: '表达方式' })).toBeInTheDocument();
    expect(within(dock).queryByText('笔记')).not.toBeInTheDocument();
    expect(within(dock).queryByText('拍照')).not.toBeInTheDocument();
    expect(within(dock).queryByText('视频')).not.toBeInTheDocument();
    expect(within(dock).queryByText('上传')).not.toBeInTheDocument();
    expect(
      dock.querySelectorAll('[data-slot="floating-action-button-speed-dial-action-unavailable"]')
    ).toHaveLength(4);
    expect(within(dock).getByRole('menuitem', { name: '笔记暂不可用' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(within(dock).getByRole('menuitem', { name: '拍照暂不可用' })).toHaveClass(
      'cursor-default',
      'focus-visible:ring-2',
      'p-disabled'
    );
    expect(within(dock).queryByRole('menuitem', { name: '上传图片' })).not.toBeInTheDocument();

    await user.click(recordingAction);
    expect(onStartRecording).toHaveBeenCalledOnce();
  });

  it('keeps the red expression FAB mounted in Memory Studio without moving it into content controls', async () => {
    const user = userEvent.setup();
    const onStartNote = vi.fn();
    const onStartRecording = vi.fn();
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      onStartNote,
      onStartRecording,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });
    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday',
      detail: birthdayDetail,
    });

    const dock = screen.getByRole('region', { name: '表达入口' });
    const dialTrigger = within(dock).getByRole('button', { name: '打开表达入口' });
    expect(dialTrigger).toHaveClass('!bg-brand-ember');
    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const stripActions = strip.querySelector('[data-slot="memory-studio-segment-strip-actions"]');
    expect(stripActions).not.toBeInTheDocument();
    expect(within(strip).queryByRole('button', { name: '打开表达入口' })).not.toBeInTheDocument();
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const contentTabActions = content.querySelector(
      '[data-slot="memory-studio-content-tab-actions"]'
    );
    expect(contentTabActions).toBeInstanceOf(HTMLElement);
    expect(
      within(contentTabActions as HTMLElement).queryByRole('button', { name: '打开表达入口' })
    ).not.toBeInTheDocument();

    await user.click(dialTrigger);
    await user.click(within(dock).getByRole('menuitem', { name: '笔记' }));
    expect(onStartNote).toHaveBeenCalledOnce();
    expect(onStartRecording).not.toHaveBeenCalled();
  });

  it('renders right-side Memory containers without turning the stage into an segment timeline', () => {
    renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session: workspaceSession({
        memories: [morningMemory, recitalMemory, birthdayMemory],
      }),
    });

    const rail = screen.getByRole('navigation', { name: '记忆列表' });
    const railShell = rail.closest('[data-slot="workspace-memory-rail-shell"]');
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    const stageContent = document.querySelector('[data-slot="workspace-stage-content"]');
    const frameBody = document.querySelector('[data-slot="workspace-frame-body"]');
    expect(railShell).toHaveAttribute('aria-hidden', 'false');
    expect(frameBody).toHaveClass('grid-cols-[minmax(0,1fr)_var(--workspace-memory-rail-width)]');
    expect(railShell).toHaveClass('relative', 'col-start-2', 'row-start-1', 'w-full');
    expect(frameBody).toHaveClass(
      'transition-[grid-template-columns]',
      'duration-200',
      'ease-out',
      'motion-reduce:transition-none'
    );
    expect(stageShell).toHaveClass('min-h-0', 'overflow-hidden');
    expect(stageShell).not.toHaveClass('min-h-[640px]');
    expect(railShell).toHaveClass('translate-x-0', 'opacity-100');
    expect(stageShell).toHaveClass('px-24', 'sm:px-40');
    expect(stageContent).toHaveClass('w-full');
    expect(stageContent).not.toHaveClass('max-w-[var(--workspace-stage-max-width)]', 'pb-32');
    expect(rail).toHaveAttribute('id', 'workspace-memory-rail');
    expect(railShell).toHaveClass('border-l', 'border-secondary');
    expect(railShell).not.toHaveClass('border-border', 'shadow-float');
    expect(rail).toHaveClass('h-full', 'w-full', 'bg-background', 'px-8', 'py-20');
    expect(rail).not.toHaveClass('px-16');
    expect(rail).not.toHaveClass('bg-card', 'bg-background/70');
    expect(rail).not.toHaveClass('xl:border-l');
    expect(within(rail).queryByRole('heading', { name: '当前记忆' })).not.toBeInTheDocument();
    expect(within(rail).queryByText('3 条记忆')).not.toBeInTheDocument();
    expect(
      within(rail)
        .getAllByRole('button', { name: /选择记忆/ })
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['选择记忆 Morning note', '选择记忆 School recital', '选择记忆 My seventh birthday']);
    const birthdayMemoryButton = within(rail).getByRole('button', {
      name: '选择记忆 My seventh birthday',
    });
    const recitalMemoryButton = within(rail).getByRole('button', {
      name: '选择记忆 School recital',
    });
    const birthdayMemoryCard = birthdayMemoryButton.closest('[data-slot="memory-rail-card"]');
    const recitalMemoryCard = recitalMemoryButton.closest('[data-slot="memory-rail-card"]');

    expect(birthdayMemoryButton).toHaveClass('min-h-[68px]', 'px-12', 'py-12');
    expect(birthdayMemoryButton).toHaveAttribute('aria-current', 'page');
    expect(birthdayMemoryCard).toHaveClass('rounded-xl', 'bg-secondary');
    expect(recitalMemoryCard).toHaveClass('rounded-xl', 'bg-card', 'hover:bg-secondary');
    expect(birthdayMemoryCard).not.toHaveClass(
      'border',
      'border-primary',
      'border-border',
      'shadow-float',
      'bg-card',
      'hover:bg-secondary'
    );
    expect(within(rail).getByText('05/06 13:10 · 2 个片段')).toBeInTheDocument();
    expect(within(rail).getByText('05/01 09:10 · 1 个片段')).toBeInTheDocument();
    expect(within(rail).getByText('04/11 09:02 · 1 个片段')).toBeInTheDocument();
    expect(within(rail).queryByText(/更新/)).not.toBeInTheDocument();
    expect(within(rail).queryByText('转写')).not.toBeInTheDocument();
    expect(within(rail).queryByText('反思')).not.toBeInTheDocument();
    expect(within(rail).queryByText('时长')).not.toBeInTheDocument();
    expect(screen.queryByText('片段时间线')).not.toBeInTheDocument();
    const frame = document.querySelector('[data-slot="workspace-frame"]');
    expect(frame).toHaveClass('bg-background');
    expect(frame).not.toHaveClass('bg-card', 'shadow-float');
  });

  it('selects an existing Memory through the right rail without requiring a detail route', async () => {
    const user = userEvent.setup();
    const onSelectMemory = vi.fn();

    renderLoadedWorkspaceFrame({
      onSelectMemory,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });

    await user.click(screen.getByRole('button', { name: '选择记忆 My seventh birthday' }));

    expect(onSelectMemory).toHaveBeenCalledWith('mem_birthday');
  });

  it('renders the selected Memory as an empty Memory Studio context', async () => {
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });
    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_empty',
      detail: {
        ...birthdayDetail,
        segmentCount: 0,
        noteSegmentCount: 0,
        audioSegmentCount: 0,
        audioDurationMs: 0,
        audioByteLength: 0,
        hasAudioTranscript: false,
        segments: [],
      },
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    expect(within(studio).queryByRole('heading', { name: 'My seventh birthday' })).toBeNull();
    expect(within(studio).queryByText('0 个片段 · 00:00')).toBeNull();
    expect(within(studio).getByText('这条记忆还没有片段')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择记忆 My seventh birthday' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('renders Memory Studio from the current Memory detail projection', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday',
      detail: birthdayDetail,
    });

    expect(await screen.findByRole('region', { name: 'Memory Studio' })).toBeInTheDocument();
    const studio = screen.getByRole('region', { name: 'Memory Studio' });
    expect(within(studio).queryByRole('heading', { name: 'My seventh birthday' })).toBeNull();
    expect(within(studio).queryByText('2 个片段 · 02:05')).toBeNull();
    const content = within(studio).getByRole('region', { name: '片段内容' });
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday candles' })
    ).toBeInTheDocument();
    expect(within(content).queryByText('audio · 02:05 · 已有转录')).toBeNull();
    expect(screen.queryByText('workspace-handle-secret')).not.toBeInTheDocument();
  });

  it('uses Segment contentTitle for the primary content tab label and keeps default fallback out of the model', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });
    const detailWithContentTitle: WorkspaceMemoryDetail = {
      ...birthdayDetail,
      segments: [
        {
          ...birthdayVoiceSegment,
          contentTitle: '访谈转录',
        },
      ],
    };

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_content_title',
      detail: detailWithContentTitle,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    expect(within(content).getByRole('tab', { name: '访谈转录' })).toBeInTheDocument();
    expect(within(content).queryByRole('tab', { name: '转录' })).not.toBeInTheDocument();
  });

  it('renders finalized Note segments as markdown content in Memory Studio', async () => {
    const readSegmentContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        type: 'note',
        title: 'Cake planning note',
        bodyMarkdown: '## Cake plan\n\n- Buy candles\n- Call aunt Mei',
        bodyByteLength: 44,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const note = noteSegment();
    const detailWithNote: WorkspaceMemoryDetail = {
      ...birthdayDetail,
      segmentCount: 1,
      noteSegmentCount: 1,
      audioSegmentCount: 0,
      audioDurationMs: 0,
      audioByteLength: 0,
      hasAudioTranscript: false,
      hasAnyNote: true,
      segments: [note],
    };
    const session = workspaceSession({
      memories: [
        {
          ...birthdayMemory,
          segmentCount: 1,
          noteSegmentCount: 1,
          audioSegmentCount: 0,
          hasAudioTranscript: false,
          hasAnyNote: true,
        },
      ],
    });
    const onNoteSegmentContentSaved = vi.fn();
    const pendingSave = createDeferred<void>();
    const writeSegmentContent = vi.fn(async (request) => {
      await pendingSave.promise;
      return {
        ok: true,
        value: {
          requestId: request.requestId ?? 'write_segment_note',
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          type: 'note',
          title: 'Cake planning note',
          bodyMarkdown: request.bodyMarkdown,
          bodyByteLength: 12,
          baselineContentHash: 'b'.repeat(64),
          baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
        },
      } as const;
    });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      onNoteSegmentContentSaved,
      readSegmentContent,
      session,
      writeSegmentContent,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_note_segment',
      detail: detailWithNote,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const content = within(studio).getByRole('region', { name: '片段内容' });

    expect(
      await within(strip).findByRole('button', { name: '选择片段 Cake planning note' })
    ).toHaveAttribute('aria-current', 'true');
    expect(within(strip).getByText('32 字节')).toBeInTheDocument();
    expect(within(strip).queryByText('32B')).not.toBeInTheDocument();
    const inlineBodyEditor = await within(content).findByLabelText('笔记正文');
    expectRichEditorContent(inlineBodyEditor, ['Cake plan', 'Buy candles', 'Call aunt Mei']);
    expect(inlineBodyEditor).not.toHaveTextContent('## Cake plan');
    expect(inlineBodyEditor).not.toHaveTextContent('- Buy candles');
    expect(inlineBodyEditor).not.toHaveFocus();
    expect(within(content).queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(within(content).getByRole('button', { name: '引用' })).toBeInTheDocument();
    expect(within(content).getByRole('button', { name: '标题' })).toBeInTheDocument();
    expect(within(content).getByRole('button', { name: '列表' })).toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '分割线' })).not.toBeInTheDocument();
    expect(
      within(content).queryByRole('button', { name: '笔记 Cake planning note 暂不支持播放' })
    ).not.toBeInTheDocument();
    expect(content.querySelector('[data-slot="memory-studio-player"]')).not.toBeInTheDocument();
    const notePlayerPlaceholder = content.querySelector(
      '[data-slot="memory-studio-player-placeholder"]'
    );
    const tabRailRow = content.querySelector('[data-slot="memory-studio-content-tab-rail-row"]');
    expect(notePlayerPlaceholder).toBeInstanceOf(HTMLElement);
    expect(notePlayerPlaceholder).toHaveAttribute('aria-hidden', 'true');
    expect(notePlayerPlaceholder).toHaveClass('h-[42px]');
    expect(notePlayerPlaceholder?.nextElementSibling).toBe(tabRailRow);

    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });
    const bodyTab = within(tabs).getByRole('tab', { name: '正文' });
    const bodyTabItem = bodyTab.closest('[data-slot="memory-studio-primary-tab-item"]');
    const bodyMore = bodyTabItem?.querySelector(
      '[data-slot="memory-studio-primary-tab-more-anchor"]'
    );
    expect(bodyTabItem).toBeInstanceOf(HTMLElement);
    expect(bodyMore).toBeInstanceOf(HTMLButtonElement);
    expect(bodyMore).toHaveAttribute('aria-hidden', 'true');
    expect(bodyMore).toHaveAttribute('tabindex', '-1');
    expect(bodyMore).toHaveClass('pointer-events-none');
    expect(bodyMore).toHaveClass('max-w-0');
    expect(bodyMore).toHaveClass('opacity-0');
    expect(bodyMore).toHaveClass('group-hover/supplement-tab:pointer-events-auto');
    expect(bodyMore).toHaveClass('group-hover/supplement-tab:ml-[6px]');
    expect(bodyMore).toHaveClass('group-hover/supplement-tab:max-w-20');
    expect(bodyMore).toHaveClass('group-hover/supplement-tab:opacity-100');
    expect(bodyMore).toHaveClass('group-hover/supplement-tab:scale-100');
    expect(bodyMore).toHaveClass('data-[state=open]:pointer-events-auto');
    expect(bodyMore).toHaveClass('data-[state=open]:ml-[6px]');
    expect(bodyMore).toHaveClass('data-[state=open]:max-w-20');
    expect(bodyMore).toHaveClass('data-[state=open]:opacity-100');
    expect(bodyMore).toHaveClass('data-[state=open]:scale-100');
    await userEvent.hover(bodyTabItem as HTMLElement);
    expect(bodyMore).not.toHaveAttribute('aria-hidden');
    expect(bodyMore).not.toHaveClass('pointer-events-auto');
    expect(bodyMore).not.toHaveClass('max-w-20');
    expect(bodyMore).not.toHaveClass('opacity-100');
    await userEvent.click(bodyMore as HTMLButtonElement);
    const bodyMenu = await screen.findByRole('menu', { name: '正文 更多操作' });
    expect(
      within(bodyMenu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([
      '用默认应用打开',
      '在访达中显示',
      '复制相对路径',
      '复制绝对路径',
      '重命名',
      '清空正文',
    ]);
    expect(within(bodyMenu).queryByRole('menuitem', { name: '编辑正文' })).not.toBeInTheDocument();
    expect(within(bodyMenu).queryByRole('menuitem', { name: '生成转录' })).not.toBeInTheDocument();
    expect(
      within(bodyMenu).queryByRole('menuitem', { name: '重新生成转录' })
    ).not.toBeInTheDocument();
    expect(within(bodyMenu).queryByRole('menuitem', { name: '删除' })).not.toBeInTheDocument();
    expect(bodyTab).toHaveAttribute('aria-selected', 'true');

    const bodyPanel = within(content).getByRole('tabpanel', { name: '正文' });
    expect(bodyPanel).toHaveAttribute('data-slot', 'memory-studio-inline-markdown-editor');
    expect(bodyPanel).toHaveClass('mt-12');
    expect(bodyPanel).toHaveClass('flex-1');
    expect(bodyPanel).toHaveClass('min-h-0');
    expect(bodyPanel).not.toHaveClass('max-w-[880px]');
    expect(bodyPanel).not.toHaveClass('mt-14');
    expect(bodyPanel).not.toHaveClass('h-[470px]');
    expect(bodyTab).toHaveAttribute('aria-controls', bodyPanel.id);
    expect(bodyPanel).toHaveAttribute('aria-labelledby', bodyTab.id);
    expect(within(bodyPanel).queryByRole('heading', { name: 'Cake planning note' })).toBeNull();
    expect(
      within(bodyPanel).queryByRole('button', { name: '编辑笔记 Cake planning note' })
    ).toBeNull();
    const editorSurface = within(bodyPanel).getByTestId('memory-studio-inline-note-editor');
    expect(editorSurface).toHaveClass('h-full', 'w-full');
    expect(editorSurface).toHaveClass('grid-rows-[44px_minmax(0,1fr)]');
    expect(editorSurface).toHaveClass('rounded-md', 'border', 'border-secondary');
    expect(editorSurface).toHaveClass('transition-[border-color]');
    expect(editorSurface).not.toHaveClass('transition-colors');
    expect(editorSurface).not.toHaveClass('border-ring');
    const editorToolbar = editorSurface.querySelector(
      '[data-slot="lightweight-markdown-editor-toolbar"]'
    );
    expect(editorToolbar).toBeInstanceOf(HTMLElement);
    expect(editorToolbar).toHaveClass('flex', 'h-[44px]', 'min-h-[44px]', 'min-w-0');
    expect(editorToolbar).not.toHaveClass('grid-cols-[minmax(0,1fr)_auto]');
    const editorToolbarControls = within(editorToolbar as HTMLElement).getByRole('toolbar', {
      name: '文本编辑工具栏',
    });
    expect(editorToolbarControls).toHaveClass('tiptap-toolbar');
    expect(editorToolbarControls).toHaveAttribute('data-variant', 'fixed');
    expect(
      within(editorToolbarControls)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent)
    ).toEqual([
      '撤销',
      '重做',
      '标题',
      '列表',
      '引用',
      '代码块',
      '粗体',
      '斜体',
      '删除线',
      '行内代码',
      '下划线',
      '高亮',
      '链接',
      '上标',
      '下标',
      '左对齐',
      '居中对齐',
      '右对齐',
      '两端对齐',
      '添加图片',
    ]);
    expect(
      editorSurface.querySelector('[data-slot="lightweight-markdown-editor-actions"]')
    ).not.toBeInTheDocument();
    const editorBody = editorSurface.querySelector(
      '[data-slot="lightweight-markdown-editor-body"]'
    );
    expect(editorBody).toBeInstanceOf(HTMLElement);
    expect(editorBody).toHaveClass('flex', 'min-h-0', 'flex-col', 'bg-background');
    const editorScrollport = editorSurface.querySelector(
      '.reo-lightweight-markdown-editor-scrollport'
    );
    expect(editorScrollport).toBeInstanceOf(HTMLElement);
    expect(editorScrollport).toHaveClass('relative', 'min-h-0', 'flex-1', 'overflow-y-auto');
    const editorContent = editorSurface.querySelector('.reo-lightweight-markdown-editor-content');
    expect(editorContent).toBeInstanceOf(HTMLElement);
    expect(inlineBodyEditor).toHaveClass('reo-lightweight-markdown-editor', 'simple-editor');
    expect(inlineBodyEditor).not.toHaveClass('bg-input', 'transition-colors');
    await userEvent.click(inlineBodyEditor);
    expect(inlineBodyEditor).toHaveFocus();
    expect(editorSurface).toHaveClass('border-ring');
    expect(editorSurface).not.toHaveClass('border-secondary');
    const formatToolbarButton = within(editorToolbar as HTMLElement).getByRole('button', {
      name: '粗体',
    });
    formatToolbarButton.focus();
    fireEvent.blur(inlineBodyEditor, { relatedTarget: formatToolbarButton });
    expect(formatToolbarButton).toHaveFocus();
    await waitFor(() => expect(editorSurface).toHaveClass('border-secondary'));
    expect(editorSurface).not.toHaveClass('border-ring');
    await userEvent.click(inlineBodyEditor);
    expect(editorSurface).toHaveClass('border-ring');
    expect(within(content).queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    await replaceRichEditorMarkdown(inlineBodyEditor, 'Updated body');
    expect(editorSurface).toHaveClass('border-ring');
    expect(editorSurface).not.toHaveClass('border-secondary');
    expect(
      editorSurface.querySelector('[data-slot="lightweight-markdown-editor-actions"]')
    ).toBeInTheDocument();
    const cancelButton = within(content).getByRole('button', { name: '取消' });
    const saveButton = within(content).getByRole('button', { name: '保存' });
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveClass(
      '!transition-none',
      'hover:!bg-secondary',
      'active:!bg-secondary'
    );
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toHaveClass(
      '!transition-none',
      'hover:!bg-foreground',
      'active:!bg-foreground'
    );
    await userEvent.click(within(content).getByRole('button', { name: '取消' }));
    expectRichEditorContent(inlineBodyEditor, ['Cake plan', 'Buy candles', 'Call aunt Mei']);
    expect(editorSurface).toHaveClass('border-secondary');
    expect(editorSurface).not.toHaveClass('border-ring');
    expect(within(content).queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    await replaceRichEditorMarkdown(inlineBodyEditor, 'Updated body');
    await userEvent.click(inlineBodyEditor);
    expect(editorSurface).toHaveClass('border-ring');
    await userEvent.click(within(content).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(writeSegmentContent).toHaveBeenCalledTimes(1));
    expect(within(content).queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(editorSurface).toHaveClass('border-secondary');
    expect(editorSurface).not.toHaveClass('border-ring');
    pendingSave.resolve();
    await waitFor(() =>
      expect(writeSegmentContent).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_note',
        bodyMarkdown: 'Updated body',
        bodyTiptapJson: expect.objectContaining({ type: 'doc' }),
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      })
    );
    expect(onNoteSegmentContentSaved).toHaveBeenCalledWith({
      expectedSession: session,
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_note',
      title: 'Cake planning note',
      bodyMarkdown: 'Updated body',
      bodyTiptapJson: expect.objectContaining({ type: 'doc' }),
      baselineContentHash: 'b'.repeat(64),
      baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
      bodyByteLength: 12,
    });
    await waitFor(() => expect(editorSurface).not.toHaveClass('border-ring'));
    expect(editorSurface).toHaveClass('border-secondary');
    expect(inlineBodyEditor).not.toHaveFocus();
    expect(within(content).queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '保存' })).not.toBeInTheDocument();

    expect(tabRailRow).toBeInstanceOf(HTMLElement);
    expect(tabRailRow).toHaveClass('justify-start');
    expect(tabRailRow).not.toHaveClass('justify-between');
    const contentTabActions = content.querySelector(
      '[data-slot="memory-studio-content-tab-actions"]'
    );
    expect(contentTabActions).toBeInstanceOf(HTMLElement);
    expect(tabs.nextElementSibling).toBe(contentTabActions);
    expect(
      within(contentTabActions as HTMLElement).queryByRole('button', {
        name: '编辑笔记 Cake planning note',
      })
    ).toBeNull();
    const railAddButton = within(contentTabActions as HTMLElement).getByRole('button', {
      name: '添加片段补充内容',
    });
    expect(railAddButton).toHaveTextContent('补充');
    expect(railAddButton).toHaveClass('gap-[6px]', 'px-[10px]');
    expect(railAddButton).not.toHaveClass('gap-6', 'px-10');
    expect(railAddButton.parentElement).toBe(contentTabActions);
  });

  it('routes dirty expanded Note return through continue and discard decisions', async () => {
    const user = userEvent.setup();
    const session = workspaceSession({
      memories: [{ ...birthdayMemory, segmentCount: 1, noteSegmentCount: 1, hasAnyNote: true }],
    });
    const note = noteSegment();
    const readSegmentContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        type: 'note',
        title: 'Cake planning note',
        bodyMarkdown: '## Cake plan',
        bodyByteLength: 11,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readSegmentContent,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_expanded_dirty_return_discard',
      detail: {
        ...birthdayDetail,
        ...session.snapshot.memories[0],
        segments: [note],
      },
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await user.click(await within(content).findByRole('button', { name: '展开编辑器' }));
    const expandedDialog = await screen.findByRole('dialog', { name: '正文' });
    const expandedEditor = within(expandedDialog).getByLabelText('笔记正文');
    await replaceRichEditorMarkdown(expandedEditor, 'Expanded dirty body');

    await user.click(within(expandedDialog).getByRole('button', { name: '返回' }));
    const returnConfirm = await screen.findByRole('alertdialog', { name: '保存未完成的修改？' });
    await user.click(within(returnConfirm).getByRole('button', { name: '继续编辑' }));

    expect(screen.getByRole('dialog', { name: '正文' })).toBeInTheDocument();
    expectRichEditorContent(screen.getByLabelText('笔记正文'), 'Expanded dirty body');

    await user.click(
      within(screen.getByRole('dialog', { name: '正文' })).getByRole('button', {
        name: '返回',
      })
    );
    await user.click(
      within(await screen.findByRole('alertdialog', { name: '保存未完成的修改？' })).getByRole(
        'button',
        { name: '放弃修改' }
      )
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '正文' })).toHaveAttribute('data-state', 'closed');
    });
    expectRichEditorContent(await within(content).findByLabelText('笔记正文'), 'Cake plan');
  });

  it('only collapses dirty expanded Note return after the existing save path succeeds', async () => {
    const user = userEvent.setup();
    const session = workspaceSession({
      memories: [{ ...birthdayMemory, segmentCount: 1, noteSegmentCount: 1, hasAnyNote: true }],
    });
    const note = noteSegment();
    const readSegmentContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        type: 'note',
        title: 'Cake planning note',
        bodyMarkdown: '## Cake plan',
        bodyByteLength: 11,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const writeSegmentContent = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: 'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
          message: 'Segment not found',
        },
      })
      .mockImplementation(async (request) => ({
        ok: true,
        value: {
          requestId: request.requestId ?? 'write_segment_note',
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          type: 'note',
          title: 'Cake planning note',
          bodyMarkdown: request.bodyMarkdown,
          bodyByteLength: 19,
          baselineContentHash: 'b'.repeat(64),
          baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
        },
      }));
    const onNoteSegmentContentSaved = vi.fn();
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      onNoteSegmentContentSaved,
      readSegmentContent,
      session,
      writeSegmentContent,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_expanded_dirty_return_save',
      detail: {
        ...birthdayDetail,
        ...session.snapshot.memories[0],
        segments: [note],
      },
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await user.click(await within(content).findByRole('button', { name: '展开编辑器' }));
    const expandedEditor = within(
      await screen.findByRole('dialog', { name: '正文' })
    ).getByLabelText('笔记正文');
    await replaceRichEditorMarkdown(expandedEditor, 'Expanded saved body');

    await user.click(
      within(screen.getByRole('dialog', { name: '正文' })).getByRole('button', {
        name: '返回',
      })
    );
    await user.click(
      within(await screen.findByRole('alertdialog', { name: '保存未完成的修改？' })).getByRole(
        'button',
        { name: '保存并返回' }
      )
    );

    await waitFor(() => expect(writeSegmentContent).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog', { name: '正文' })).toBeInTheDocument();
    expect(await screen.findByText('找不到这个片段。')).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('dialog', { name: '正文' })).getByRole('button', {
        name: '返回',
      })
    );
    await user.click(
      within(await screen.findByRole('alertdialog', { name: '保存未完成的修改？' })).getByRole(
        'button',
        { name: '保存并返回' }
      )
    );

    await waitFor(() => expect(writeSegmentContent).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '正文' })).toHaveAttribute('data-state', 'closed');
    });
    expect(onNoteSegmentContentSaved).toHaveBeenCalledWith({
      expectedSession: session,
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_note',
      title: 'Cake planning note',
      bodyMarkdown: 'Expanded saved body',
      bodyTiptapJson: expect.objectContaining({ type: 'doc' }),
      baselineContentHash: 'b'.repeat(64),
      baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
      bodyByteLength: 19,
    });
  });

  it('keeps a dirty inline Note edit mounted when another segment is selected', async () => {
    const session = workspaceSession({
      memories: [
        {
          ...birthdayMemory,
          segmentCount: 2,
          noteSegmentCount: 1,
          audioSegmentCount: 1,
          hasAnyNote: true,
        },
      ],
    });
    const note = noteSegment();
    const readSegmentContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        type: 'note',
        title: 'Cake planning note',
        bodyMarkdown: '## Cake plan\n\n- Buy candles',
        bodyByteLength: 28,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readSegmentContent,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_dirty_inline_note_guard',
      detail: {
        ...birthdayDetail,
        ...session.snapshot.memories[0],
        segments: [note, birthdayVoiceSegment],
      },
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const noteButton = await within(strip).findByRole('button', {
      name: '选择片段 Cake planning note',
    });
    const voiceButton = within(strip).getByRole('button', { name: '选择片段 Birthday candles' });

    expect(noteButton).toHaveAttribute('aria-current', 'true');
    const inlineBodyEditor = await within(content).findByLabelText('笔记正文');
    await replaceRichEditorMarkdown(inlineBodyEditor, 'Unsaved body');

    await userEvent.click(voiceButton);

    expect(noteButton).toHaveAttribute('aria-current', 'true');
    expect(voiceButton).not.toHaveAttribute('aria-current', 'true');
    expectRichEditorContent(await within(content).findByLabelText('笔记正文'), 'Unsaved body');
  });

  it('keeps a dirty inline Note edit mounted when new supplements appear', async () => {
    const user = userEvent.setup();
    const onStartSegmentSupplementNote = vi.fn();
    const session = workspaceSession({
      memories: [
        {
          ...birthdayMemory,
          segmentCount: 1,
          noteSegmentCount: 1,
          hasAnyNote: true,
        },
      ],
    });
    const note = noteSegment();
    const readSegmentContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        type: 'note',
        title: 'Cake planning note',
        bodyMarkdown: '## Cake plan',
        bodyByteLength: 11,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      onStartSegmentSupplementNote,
      readSegmentContent,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_dirty_inline_note_create_guard',
      detail: {
        ...birthdayDetail,
        ...session.snapshot.memories[0],
        segments: [note],
      },
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const inlineBodyEditor = await within(content).findByLabelText('笔记正文');
    await replaceRichEditorMarkdown(inlineBodyEditor, 'Unsaved body');

    await user.click(within(content).getByRole('button', { name: '添加片段补充内容' }));
    await user.click(
      within(await screen.findByRole('menu', { name: '片段补充内容' })).getByRole('menuitem', {
        name: '笔记补充',
      })
    );

    expect(onStartSegmentSupplementNote).not.toHaveBeenCalled();

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_dirty_inline_note_added_supplement',
      detail: {
        ...birthdayDetail,
        ...session.snapshot.memories[0],
        supplementCount: 1,
        segments: [
          {
            ...note,
            supplementCount: 1,
            supplements: [
              noteSupplement({
                segmentId: note.segmentId,
                supplementId: 'sup_note_followup',
              }),
            ],
          },
        ],
      },
    });

    const transcriptTab = within(content).getByRole('tab', { name: '正文' });
    expect(transcriptTab).toHaveAttribute('aria-selected', 'true');
    expectRichEditorContent(await within(content).findByLabelText('笔记正文'), 'Unsaved body');
  });

  it('ignores an old-handle inline Note save result without closing the current editor', async () => {
    const session = workspaceSession({
      memories: [{ ...birthdayMemory, segmentCount: 1, noteSegmentCount: 1, hasAnyNote: true }],
    });
    const reopenedSession = { ...session, workspaceHandle: 'workspace-handle-reopened' };
    const onNoteSegmentContentSaved = vi.fn();
    let resolveWrite!: (value: {
      readonly ok: true;
      readonly value: {
        readonly bodyByteLength: number;
        readonly saved: true;
        readonly baselineContentHash: string;
        readonly baselineTiptapContentHash: string;
      };
    }) => void;
    const writeSegmentContent = vi.fn(
      () =>
        new Promise<{
          readonly ok: true;
          readonly value: {
            readonly bodyByteLength: number;
            readonly saved: true;
            readonly baselineContentHash: string;
            readonly baselineTiptapContentHash: string;
          };
        }>((resolve) => {
          resolveWrite = resolve;
        })
    );
    const readSegmentContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        type: 'note',
        title: 'Cake planning note',
        bodyMarkdown: '## Cake plan',
        bodyByteLength: 11,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const { queryClient, rerender } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      onNoteSegmentContentSaved,
      readSegmentContent,
      session,
      writeSegmentContent,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_old_handle_inline_save',
      detail: {
        ...birthdayDetail,
        ...session.snapshot.memories[0],
        segments: [noteSegment()],
      },
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const inlineBodyEditor = await within(content).findByLabelText('笔记正文');
    await replaceRichEditorMarkdown(inlineBodyEditor, 'Unsaved body');
    await userEvent.click(within(content).getByRole('button', { name: '保存' }));
    expect(inlineBodyEditor).toHaveAttribute('contenteditable', 'false');

    rerender(
      <QueryClientProvider client={queryClient}>
        <LoadedWorkspaceFrame
          currentMemory={reopenedSession.snapshot.memories[0] ?? null}
          onClearSegmentContent={vi.fn()}
          onDeleteMemory={vi.fn()}
          onDeleteSegment={vi.fn()}
          onDeleteSegmentSupplement={vi.fn()}
          onSegmentTranscriptSaved={vi.fn()}
          onSegmentSupplementTranscriptSaved={vi.fn()}
          onNoteSegmentContentSaved={onNoteSegmentContentSaved}
          onNoteSegmentSupplementContentSaved={vi.fn()}
          onRenameMemory={vi.fn()}
          onRenameSegment={vi.fn()}
          onRenameSegmentContent={vi.fn()}
          onRenameSegmentSupplement={vi.fn()}
          onSelectMemory={vi.fn()}
          onStartRecording={vi.fn()}
          onStartSegmentSupplementNote={vi.fn()}
          onStartSegmentSupplementRecording={vi.fn()}
          workspaceSession={reopenedSession}
        />
      </QueryClientProvider>
    );

    resolveWrite({
      ok: true,
      value: {
        bodyByteLength: 12,
        saved: true,
        baselineContentHash: 'b'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
      },
    });

    await waitFor(() => expect(inlineBodyEditor).toHaveAttribute('contenteditable', 'true'));
    expectRichEditorContent(inlineBodyEditor, 'Unsaved body');
    expect(onNoteSegmentContentSaved).not.toHaveBeenCalled();
  });

  it('keeps Memory Studio as a first-viewport studio surface instead of a centered card list', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_visual_surface',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    const stageContent = document.querySelector('[data-slot="workspace-stage-content"]');
    const studioLayout = studio;
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const segmentItems = studio.querySelectorAll('[data-slot="memory-studio-segment-item"]');
    const segmentCards = studio.querySelectorAll('[data-slot="memory-studio-segment-card"]');
    const stripScroll = studio.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
    const contentPanel = studio.querySelector('[data-slot="memory-studio-content-panel"]');
    const player = studio.querySelector('[data-slot="memory-studio-player"]');
    const tabRailRow = studio.querySelector('[data-slot="memory-studio-content-tab-rail-row"]');
    const transcriptScroll = studio.querySelector('[data-slot="memory-studio-transcript-scroll"]');

    expect(stageShell).toHaveClass('pt-0', 'pb-16');
    expect(stageShell).not.toHaveClass('pt-8', 'py-16', 'py-24', 'sm:py-32');
    expect(stageContent).toHaveClass('w-full', 'items-stretch', 'justify-center');
    expect(stageContent).not.toHaveClass('mx-auto', 'max-w-[var(--workspace-stage-max-width)]');
    expect(studio).toHaveClass('overflow-hidden');
    expect(studioLayout).toHaveClass('w-full');
    expect(studioLayout).not.toHaveClass('max-w-[1120px]');
    expect(segmentItems).toHaveLength(2);
    expect(segmentCards).toHaveLength(2);
    expect(segmentItems[0]).toHaveClass(
      'flex-[0_0_var(--memory-studio-segment-card-size)]',
      'snap-start',
      'flex-col',
      'min-w-[var(--memory-studio-segment-card-min-size)]',
      '[content-visibility:auto]',
      '[contain-intrinsic-size:184px_184px]'
    );
    expect(segmentCards[0]).toHaveClass(
      'aspect-square',
      'rounded-xl',
      'bg-secondary',
      'p-12',
      'min-h-[var(--memory-studio-segment-card-min-size)]',
      'min-w-[var(--memory-studio-segment-card-min-size)]'
    );
    expect(segmentCards[1]).toHaveClass('bg-card');
    expect(segmentCards[0]).not.toHaveClass(
      'border',
      'border-2',
      'border-primary',
      'border-border',
      'shadow-float',
      'shadow-none',
      ''
    );
    expect(within(segmentCards[0] as HTMLElement).queryByText('已有转录')).toBeNull();
    expect(within(segmentCards[1] as HTMLElement).queryByText('本地音频')).toBeNull();
    expect(strip).toHaveAttribute(
      'style',
      expect.stringContaining('--memory-studio-segment-card-min-size: 136px')
    );
    expect(strip).toHaveAttribute(
      'style',
      expect.stringContaining(
        '--memory-studio-segment-card-size: clamp(var(--memory-studio-segment-card-min-size), 18vw, 148px)'
      )
    );
    expect(stripScroll).not.toHaveClass('px-44');
    expect(stripScroll).toHaveClass('edge-fade-x');
    expect(stripScroll).toHaveClass('pt-8', 'pb-0');
    expect(stripScroll).not.toHaveClass('py-8');
    expect(contentPanel).toHaveClass('flex-1', 'min-h-0');
    expect(contentPanel).not.toHaveClass('-mt-8', '-mt-4', 'mt-4', 'mt-12', 'mt-16', 'pt-12');
    expect(player).toBeInstanceOf(HTMLElement);
    expect(tabRailRow).toHaveClass('mt-12');
    expect(tabRailRow).not.toHaveClass('mt-32');
    expect(contentPanel).not.toHaveClass('rounded-2xl', 'border', 'bg-card');
    expect(transcriptScroll).toHaveClass(
      'reo-content-tab-panel-motion',
      'edge-fade-y',
      'min-h-0',
      'overflow-y-auto',
      'scrollbar-hover'
    );
  });

  it('keeps large Segment strips from mounting every card interaction tree at once', async () => {
    const largeDetail: WorkspaceMemoryDetail = {
      ...birthdayDetail,
      segmentCount: 40,
      segments: Array.from({ length: 40 }, (_, index) => ({
        ...birthdayVoiceSegment,
        segmentId: `seg_large_${index}`,
        title: `Long recording ${index + 1}`,
        createdAt: `2026-05-06T13:${String(index).padStart(2, '0')}:00.000`,
        updatedAt: `2026-05-06T13:${String(index).padStart(2, '0')}:30.000`,
      })),
    };
    const session = workspaceSession({
      memories: [{ ...birthdayMemory, segmentCount: largeDetail.segmentCount }],
    });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_large_segment_strip',
      detail: largeDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    expect(
      studio.querySelectorAll('[data-slot="memory-studio-segment-item"]').length
    ).toBeLessThanOrEqual(16);
    expect(
      studio.querySelectorAll('[data-slot="memory-studio-segment-strip-spacer"]')
    ).toHaveLength(1);
    expect(studio.querySelectorAll('[data-slot="memory-studio-segment-card"]').length).toBeLessThan(
      40
    );
    expect(
      studio.querySelectorAll('[data-slot="memory-studio-segment-card"]').length
    ).toBeGreaterThan(0);
  });

  it('keeps timeline marker and time inside the same horizontal Segment item', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_segment_item_timeline',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const activeButton = within(strip).getByRole('button', { name: '选择片段 Birthday candles' });
    const inactiveButton = within(strip).getByRole('button', { name: '选择片段 Birthday song' });
    const activeItem = activeButton.closest('[data-slot="memory-studio-segment-item"]');
    const inactiveItem = inactiveButton.closest('[data-slot="memory-studio-segment-item"]');
    if (!(activeItem instanceof HTMLElement) || !(inactiveItem instanceof HTMLElement)) {
      throw new Error('Segment item wrapper missing');
    }

    expect(activeItem).toHaveAttribute('data-slot', 'memory-studio-segment-item');
    expect(activeItem).toHaveClass(
      'flex-[0_0_var(--memory-studio-segment-card-size)]',
      'snap-start',
      'flex-col'
    );
    expect(activeItem.querySelector('[data-slot="memory-studio-segment-card"]')).toBeTruthy();
    expect(
      activeItem.querySelector('[data-slot="memory-studio-segment-timeline-anchor"]')
    ).toHaveClass('before:top-[3px]');
    expect(
      activeItem.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).toHaveClass('block', 'size-[7px]', 'min-h-[7px]', 'min-w-[7px]', 'rounded-full');
    expect(
      activeItem.querySelector('[data-slot="memory-studio-segment-timeline-time"]')
    ).toHaveClass('mt-12', 'block', 'text-muted-foreground');
    expect(
      activeItem.querySelector('[data-slot="memory-studio-segment-timeline-time"]')
    ).toHaveTextContent('13:08');
    expect(
      inactiveItem.querySelector('[data-slot="memory-studio-segment-timeline-time"]')
    ).toHaveTextContent('13:12');
    expect(within(studio).queryByRole('navigation', { name: 'Memory 片段时间轴' })).toBeNull();
  });

  it('renders Segment recording cards with balanced Soft Flat waveform and mono duration', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_segment_card_visual_detail',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const activeCard = within(studio).getByRole('button', { name: '选择片段 Birthday candles' });
    const inactiveCard = within(studio).getByRole('button', { name: '选择片段 Birthday song' });

    expect(within(activeCard).queryByText('SEG 01')).toBeNull();
    expect(within(activeCard).queryByText('已有转录')).toBeNull();
    expect(within(inactiveCard).queryByText('本地音频')).toBeNull();
    expect(within(activeCard).getByText('Birthday candles')).toHaveClass(
      'text-body',
      'font-bold',
      'leading-body',
      'max-w-[88px]',
      'whitespace-normal'
    );
    expect(
      activeCard.querySelector('[data-slot="memory-studio-segment-card-duration"]')
    ).toHaveClass('shrink-0', 'font-mono', 'text-ui-sm', 'font-bold', 'tracking-wide');
    expect(
      activeCard.querySelector('[data-slot="memory-studio-segment-card-waveform"]')
    ).toHaveClass('w-[52px]');

    const activeWaveform = activeCard.querySelector(
      '[data-slot="memory-studio-segment-card-waveform"]'
    );
    const inactiveWaveform = inactiveCard.querySelector(
      '[data-slot="memory-studio-segment-card-waveform"]'
    );

    expect(activeWaveform).toHaveAttribute('data-waveform-mode', 'bars');
    expect(activeWaveform).toHaveAttribute('data-waveform-bar-width', '4');
    expect(activeWaveform).toHaveAttribute('data-waveform-bar-radius', '4');
    expect(activeWaveform).toHaveAttribute('data-waveform-tone', 'neutral');
    expect(activeWaveform?.querySelector('span')).toBeNull();
    expect(inactiveWaveform).toHaveAttribute('data-waveform-tone', 'muted');
    expect(inactiveWaveform?.querySelector('span')).toBeNull();
  });

  it('does not repeat selected Segment summary above the player', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_no_repeated_segment_summary',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });

    expect(within(content).queryByRole('heading', { name: 'Birthday candles' })).toBeNull();
    expect(within(content).queryByText('audio · 02:05 · 已有转录')).toBeNull();
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday candles' })
    ).toBeInTheDocument();
  });

  it('uses the Soft Flat contract for visible Memory Studio surfaces', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_soft_flat',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const softFlatElements = [
      studio,
      ...Array.from(studio.querySelectorAll('[data-slot="memory-studio-segment-card"]')),
      studio.querySelector('[data-slot="memory-studio-content-panel"]'),
      studio.querySelector('[data-slot="memory-studio-player"]'),
      studio.querySelector('[data-slot="memory-studio-playback-waveform"]'),
      studio.querySelector('[data-slot="memory-studio-transcript-scroll"]'),
      within(studio).getByRole('button', { name: '播放片段 Birthday candles' }),
      within(studio).getByRole('button', { name: '添加片段补充内容' }),
    ];

    for (const element of softFlatElements) {
      expectSoftFlatClass(element);
    }
  });

  it('keeps Memory Studio playback controls inside narrow surfaces without wrapping time', async () => {
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_narrow_playback',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const player = studio.querySelector('[data-slot="memory-studio-player"]');
    const time = studio.querySelector('[data-slot="memory-studio-audio-player-time"]');

    expect(player).toHaveClass(
      'w-full',
      'min-w-0',
      'grid-cols-[40px_minmax(64px,1fr)_max-content]',
      'gap-12'
    );
    expect(time).toHaveClass('whitespace-nowrap');
  });

  it('syncs the Segment strip, timeline, and content selection inside the current Memory', async () => {
    const user = userEvent.setup();
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_segments',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const birthdayItem = within(strip).getByRole('button', { name: '选择片段 Birthday candles' });
    const birthdaySongItem = within(strip).getByRole('button', { name: '选择片段 Birthday song' });

    expect(birthdayItem).toHaveAttribute('aria-current', 'true');
    expect(
      birthdayItem.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).toHaveClass('bg-primary');
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday candles' })
    ).toBeInTheDocument();

    await user.click(birthdaySongItem);

    expect(within(strip).getByRole('button', { name: '选择片段 Birthday song' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(
      within(strip).getByRole('button', { name: '选择片段 Birthday candles' })
    ).not.toHaveAttribute('aria-current');
    expect(
      birthdaySongItem.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).toHaveClass('bg-primary');
    expect(
      birthdayItem.querySelector('[data-slot="memory-studio-segment-timeline-dot"]')
    ).not.toHaveClass('bg-primary');
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday song' })
    ).toBeInTheDocument();
    expect(within(content).queryByText('audio · 01:05 · 暂无转录')).toBeNull();
  });

  it('shows CarouselArrowButton only for reachable Segment strip overflow edges', async () => {
    const user = userEvent.setup();
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_carousel',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const stripScroll = strip.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');

    expect(stripScroll).toBeInstanceOf(HTMLElement);
    expect(
      within(strip).queryByRole('button', { name: '向左浏览片段卡片' })
    ).not.toBeInTheDocument();
    expect(
      within(strip).queryByRole('button', { name: '向右浏览片段卡片' })
    ).not.toBeInTheDocument();

    setScrollMetrics(stripScroll as HTMLElement, {
      clientWidth: 240,
      scrollLeft: 20,
      scrollWidth: 640,
    });
    fireEvent.scroll(stripScroll as HTMLElement);

    const rightButton = await within(strip).findByRole('button', { name: '向右浏览片段卡片' });
    expect(rightButton).toHaveClass('rounded-full', 'border', 'border-secondary', 'bg-background');
    expect(rightButton).not.toHaveClass(
      'rounded-md',
      'bg-card',
      'border-border',
      'ring-4',
      'ring-background',
      'shadow-float'
    );
    expect(
      within(strip).queryByRole('button', { name: '向左浏览片段卡片' })
    ).not.toBeInTheDocument();

    const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      const left = typeof options === 'number' ? options : Number(options?.left ?? 0);
      setScrollMetrics(stripScroll as HTMLElement, {
        clientWidth: 240,
        scrollLeft: left,
        scrollWidth: 640,
      });
      fireEvent.scroll(stripScroll as HTMLElement);
    });
    (stripScroll as HTMLElement).scrollTo = scrollTo as HTMLElement['scrollTo'];

    await user.click(rightButton);

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'instant', left: 212 });
    expect(
      within(strip).getByRole('button', { name: '选择片段 Birthday candles' })
    ).toHaveAttribute('aria-current', 'true');

    setScrollMetrics(stripScroll as HTMLElement, {
      clientWidth: 240,
      scrollLeft: 400,
      scrollWidth: 640,
    });
    fireEvent.scroll(stripScroll as HTMLElement);

    await waitFor(() => {
      expect(
        within(strip).queryByRole('button', { name: '向右浏览片段卡片' })
      ).not.toBeInTheDocument();
    });
    const leftButton = within(strip).getByRole('button', { name: '向左浏览片段卡片' });
    expect(leftButton).toBeInTheDocument();
    expect(leftButton).toHaveClass('rounded-full', 'border', 'border-secondary', 'bg-background');
    expect(leftButton).not.toHaveClass(
      'rounded-md',
      'bg-card',
      'border-border',
      'ring-4',
      'ring-background',
      'shadow-float'
    );
  });

  it('uses instant Segment strip scrolling', async () => {
    const user = userEvent.setup();
    const matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_reduced_motion',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const stripScroll = strip.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
    expect(stripScroll).toBeInstanceOf(HTMLElement);
    setScrollMetrics(stripScroll as HTMLElement, {
      clientWidth: 240,
      scrollLeft: 20,
      scrollWidth: 640,
    });
    fireEvent.scroll(stripScroll as HTMLElement);
    const scrollTo = vi.fn();
    (stripScroll as HTMLElement).scrollTo = scrollTo as HTMLElement['scrollTo'];

    await user.click(await within(strip).findByRole('button', { name: '向右浏览片段卡片' }));

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'instant', left: 212 });
  });

  it('plays finalized audio and shows transcript content for the selected Segment', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:finalized-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const readFinalizedAudioSegment = vi.fn(
      async (request: {
        readonly memoryId: string;
        readonly requestId: string;
        readonly segmentId: string;
        readonly workspaceId: string;
      }) => ({
        ok: true,
        value: {
          requestId: request.requestId,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          audio: new Uint8Array([1, 2, 3]),
          audioByteLength: 3,
          transcript: {
            exists: true,
            text: 'Grandma lit the candles and everyone started singing.',
          },
        },
      })
    );
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_playback',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });

    expect(
      await within(content).findByText('Grandma lit the candles and everyone started singing.')
    ).toBeInTheDocument();
    expect(within(content).getByRole('slider', { name: '片段播放进度' })).toBeInTheDocument();
    expect(within(content).getByText('00:00 / 02:05')).toBeInTheDocument();
    expect(readFinalizedAudioSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
      })
    );

    await user.click(within(content).getByRole('button', { name: '播放片段 Birthday candles' }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(play).toHaveBeenCalledOnce();
    expect(
      within(content).getByRole('button', { name: '暂停片段 Birthday candles' })
    ).toBeInTheDocument();
  });

  it('keeps failed segment transcripts editable in the always-visible editor', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retryable-segment-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const onRetrySegmentTranscription = vi.fn();
    const readFinalizedAudioSegment = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: {
          exists: false,
          text: '',
          baselineHash: '0'.repeat(64),
        },
      },
    }));
    const [retryableSegment, neverSegment] =
      birthdayDetailWithTwoSegments.segments as readonly AudioSegment[];
    if (!retryableSegment || !neverSegment) {
      throw new Error('birthdayDetailWithTwoSegments fixture must include two segments');
    }
    const retryableDetail: WorkspaceMemoryDetail = {
      ...birthdayDetailWithTwoSegments,
      segments: [
        {
          ...retryableSegment,
          lastTranscriptionAttempt: 'failed',
          transcript: { exists: false },
        },
        neverSegment,
      ],
    };
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      onRetrySegmentTranscription,
      readFinalizedAudioSegment,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_transcript_retry',
      detail: retryableDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const failedTranscriptEditor = await within(content).findByLabelText('转录正文');
    expectRichEditorContent(failedTranscriptEditor, '');
    expect(within(content).queryByText('上次生成转录失败。')).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '重试' })).not.toBeInTheDocument();

    await user.click(within(studio).getByRole('button', { name: '选择片段 Birthday song' }));

    expect(await within(content).findByLabelText('转录正文')).toBeInTheDocument();
    expect(within(content).queryByText('这段录音还没有转录。')).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
    expect(onRetrySegmentTranscription).not.toHaveBeenCalled();
  });

  it('announces playback slider value text and supports keyboard seek', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:keyboard-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const readFinalizedAudioSegment = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: {
          exists: true,
          text: 'Keyboard access should move the playback cursor.',
        },
      },
    }));
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_slider_a11y',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const slider = await within(studio).findByRole('slider', { name: '片段播放进度' });
    expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
    expect(slider).toHaveAttribute('aria-valuetext', '00:00 / 02:05');
    await waitFor(() => {
      expect(slider).toHaveAttribute('tabindex', '0');
    });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(slider).toHaveAttribute('aria-valuenow', '5000');
      expect(slider).toHaveAttribute('aria-valuetext', '00:05 / 02:05');
    });
  });

  it('supports continuous waveform scrubbing across the full playback hit area', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pointer-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const readFinalizedAudioSegment = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: {
          exists: true,
          text: 'Pointer scrubbing should update continuously.',
        },
      },
    }));
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_pointer_scrub',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const slider = await within(studio).findByRole('slider', { name: '片段播放进度' });
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      bottom: 42,
      height: 42,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    });

    await waitFor(() => {
      expect(slider).toHaveAttribute('tabindex', '0');
    });
    fireEvent.pointerDown(slider, { buttons: 1, clientX: 50, pointerId: 1 });
    fireEvent.pointerMove(slider, { buttons: 1, clientX: 150, pointerId: 1 });

    await waitFor(() => {
      expect(slider).toHaveAttribute('aria-valuenow', '93750');
      expect(slider).toHaveAttribute('aria-valuetext', '01:33 / 02:05');
      expect(slider).toHaveAttribute('data-waveform-progress', '0.75');
    });
  });

  it('ignores playback waveform pointer movement until a scrub starts on the waveform', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pointer-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const readFinalizedAudioSegment = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: {
          exists: true,
          text: 'Pointer movement without a waveform scrub should not seek.',
        },
      },
    }));
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_pointer_move_without_scrub',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const slider = await within(studio).findByRole('slider', { name: '片段播放进度' });
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      bottom: 42,
      height: 42,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    });

    await waitFor(() => {
      expect(slider).toHaveAttribute('tabindex', '0');
    });
    fireEvent.pointerMove(slider, { buttons: 1, clientX: 150, pointerId: 1 });

    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(slider).toHaveAttribute('aria-valuetext', '00:00 / 02:05');
    expect(slider).toHaveAttribute('data-waveform-progress', '0');
  });

  it('builds the playback waveform from decoded finalized audio bytes instead of static data', async () => {
    const audioSamples = Float32Array.from([0, 0.2, -0.6, 0.1, 0.9, -0.4, 0.05, -0.8]);
    const decodeAudioData = vi.fn(async (_audioData: ArrayBuffer) => ({
      length: audioSamples.length,
      numberOfChannels: 1,
      getChannelData: () => audioSamples,
    }));
    const close = vi.fn(async () => undefined);
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return { close, decodeAudioData };
    });
    vi.stubGlobal('AudioContext', AudioContextMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decoded-finalized-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient, unmount } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment: vi.fn(async (request) => ({
        ok: true,
        value: {
          requestId: request.requestId,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          audio: new Uint8Array([8, 7, 6, 5]),
          audioByteLength: 4,
          transcript: {
            exists: true,
            text: 'A decoded waveform belongs to the actual finalized audio bytes.',
          },
        },
      })),
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_real_waveform',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const waveform = await within(studio).findByRole('slider', { name: '片段播放进度' });

    await waitFor(() => {
      expect(waveform).toHaveAttribute('data-waveform-source', 'decoded-audio');
    });
    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(decodeAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(close).not.toHaveBeenCalled();
    unmount();
    expect(close).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('serializes playback waveform decodes and ignores stale segment audio results', async () => {
    const releaseFirstDecodeRef: {
      current:
        | ((value: {
            readonly length: number;
            readonly numberOfChannels: number;
            readonly getChannelData: () => Float32Array;
          }) => void)
        | null;
    } = { current: null };
    const firstSamples = Float32Array.from([0.1, 0.2, 0.3, 0.4]);
    const secondSamples = Float32Array.from([0.8, 0.6, 0.4, 0.2]);
    const decodeAudioData = vi.fn((_audioData: ArrayBuffer) => {
      if (releaseFirstDecodeRef.current === null) {
        return new Promise<{
          readonly length: number;
          readonly numberOfChannels: number;
          readonly getChannelData: () => Float32Array;
        }>((resolve) => {
          releaseFirstDecodeRef.current = resolve;
        });
      }

      return Promise.resolve({
        length: secondSamples.length,
        numberOfChannels: 1,
        getChannelData: () => secondSamples,
      });
    });
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return { close: vi.fn(async () => undefined), decodeAudioData };
    });
    vi.stubGlobal('AudioContext', AudioContextMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:serialized-finalized-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment: vi.fn(() => new Promise(() => {})),
      session,
    });
    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_serialized_decode',
      detail: birthdayDetail,
    });
    const contentQueryKey = segmentContentQueryKey({
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
    });
    queryClient.setQueryData(contentQueryKey, {
      requestId: 'request_segment_first_decode',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      transcript: { exists: true, text: 'First finalized audio.', baselineHash: 'a'.repeat(64) },
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const waveform = await within(studio).findByRole('slider', { name: '片段播放进度' });

    await waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledTimes(1);
    });
    queryClient.setQueryData(contentQueryKey, {
      requestId: 'request_segment_second_decode',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      audio: new Uint8Array([4, 5, 6]),
      audioByteLength: 3,
      transcript: { exists: true, text: 'Second finalized audio.', baselineHash: 'a'.repeat(64) },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(decodeAudioData).toHaveBeenCalledTimes(1);

    const resolveFirstDecode = releaseFirstDecodeRef.current;
    if (!resolveFirstDecode) {
      throw new Error('Expected first waveform decode to be pending.');
    }
    resolveFirstDecode({
      length: firstSamples.length,
      numberOfChannels: 1,
      getChannelData: () => firstSamples,
    });

    await waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledTimes(2);
      expect(waveform).toHaveAttribute('data-waveform-source', 'decoded-audio');
    });
    expect(decodeAudioData.mock.calls[1]?.[0]).toBeInstanceOf(ArrayBuffer);

    vi.unstubAllGlobals();
  });

  it('serializes supplement waveform decodes and ignores stale supplement audio results', async () => {
    const releaseFirstDecodeRef: {
      current:
        | ((value: {
            readonly length: number;
            readonly numberOfChannels: number;
            readonly getChannelData: () => Float32Array;
          }) => void)
        | null;
    } = { current: null };
    const firstSamples = Float32Array.from([0.1, 0.2, 0.3, 0.4]);
    const secondSamples = Float32Array.from([0.9, 0.7, 0.5, 0.3]);
    const decodeAudioData = vi.fn((_audioData: ArrayBuffer) => {
      if (releaseFirstDecodeRef.current === null) {
        return new Promise<{
          readonly length: number;
          readonly numberOfChannels: number;
          readonly getChannelData: () => Float32Array;
        }>((resolve) => {
          releaseFirstDecodeRef.current = resolve;
        });
      }

      return Promise.resolve({
        length: secondSamples.length,
        numberOfChannels: 1,
        getChannelData: () => secondSamples,
      });
    });
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return { close: vi.fn(async () => undefined), decodeAudioData };
    });
    vi.stubGlobal('AudioContext', AudioContextMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:serialized-supplement-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([audioSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readFinalizedAudioSegmentSupplement: vi.fn(() => new Promise(() => {})),
      session,
    });
    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_serialized_supplement_decode',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await userEvent.click(within(content).getByRole('tab', { name: '补充录音' }));
    const supplementContentQueryKey = segmentSupplementContentQueryKey({
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      supplementId: 'sup_birthday_followup',
    });
    queryClient.setQueryData(supplementContentQueryKey, {
      requestId: 'request_supplement_first_decode',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      supplementId: 'sup_birthday_followup',
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      transcript: { exists: false, text: '', baselineHash: '0'.repeat(64) },
    });
    const waveform = await within(content).findByRole('slider', { name: '补充录音播放进度' });

    await waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledTimes(1);
    });
    queryClient.setQueryData(supplementContentQueryKey, {
      requestId: 'request_supplement_second_decode',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      supplementId: 'sup_birthday_followup',
      audio: new Uint8Array([4, 5, 6]),
      audioByteLength: 3,
      transcript: { exists: false, text: '', baselineHash: '0'.repeat(64) },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(decodeAudioData).toHaveBeenCalledTimes(1);

    const resolveFirstDecode = releaseFirstDecodeRef.current;
    if (!resolveFirstDecode) {
      throw new Error('Expected first supplement waveform decode to be pending.');
    }
    resolveFirstDecode({
      length: firstSamples.length,
      numberOfChannels: 1,
      getChannelData: () => firstSamples,
    });

    await waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledTimes(2);
      expect(waveform).toHaveAttribute('data-waveform-source', 'decoded-audio');
    });
    expect(decodeAudioData.mock.calls[1]?.[0]).toBeInstanceOf(ArrayBuffer);

    vi.unstubAllGlobals();
  });

  it('does not decode oversized finalized audio for playback waveform peaks', async () => {
    const decodeAudioData = vi.fn(async () => ({
      length: 1,
      numberOfChannels: 1,
      getChannelData: () => Float32Array.from([1]),
    }));
    const AudioContextMock = vi.fn(function MockAudioContext() {
      return { close: vi.fn(async () => undefined), decodeAudioData };
    });
    vi.stubGlobal('AudioContext', AudioContextMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:large-finalized-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      readFinalizedAudioSegment: vi.fn(async (request) => ({
        ok: true,
        value: {
          requestId: request.requestId,
          workspaceId: request.workspaceId,
          memoryId: request.memoryId,
          segmentId: request.segmentId,
          audio: new Uint8Array([8, 7, 6, 5]),
          audioByteLength: 21 * 1024 * 1024,
          transcript: {
            exists: true,
            text: 'A large finalized audio file should remain playable without waveform decode.',
          },
        },
      })),
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_large_waveform',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const waveform = await within(studio).findByRole('slider', { name: '片段播放进度' });

    await waitFor(() => {
      expect(waveform).toHaveAttribute('data-waveform-source', 'unavailable');
    });
    expect(AudioContextMock).not.toHaveBeenCalled();
    expect(decodeAudioData).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('scopes the transcript tab and SegmentSupplement menu to the selected Segment', async () => {
    const user = userEvent.setup();
    const onStartSegmentSupplementRecording = vi.fn();
    const onStartSegmentSupplementNote = vi.fn();
    const session = workspaceSession({ memories: [birthdayMemory] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: birthdayMemory,
      onStartSegmentSupplementNote,
      onStartSegmentSupplementRecording,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_tabs',
      detail: birthdayDetailWithTwoSegments,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });

    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });
    expect(within(tabs).getByRole('tab', { name: '转录' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(within(tabs).queryByRole('tab', { name: '笔记' })).toBeNull();
    expect(within(tabs).queryByRole('tab', { name: '视频' })).toBeNull();
    expect(within(tabs).queryByRole('tab', { name: '图片' })).toBeNull();

    await user.click(within(content).getByRole('button', { name: '添加片段补充内容' }));

    const menu = await screen.findByRole('menu', { name: '片段补充内容' });
    const recordingSupplementAction = within(menu).getByRole('menuitem', { name: '录音补充' });
    expect(recordingSupplementAction).not.toHaveAttribute('data-disabled');
    const noteSupplementAction = within(menu).getByRole('menuitem', { name: '笔记补充' });
    expect(noteSupplementAction).not.toHaveAttribute('data-disabled');
    await user.click(noteSupplementAction);

    expect(onStartSegmentSupplementNote).toHaveBeenCalledWith({
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      title: '补充笔记1',
    });

    await user.click(within(content).getByRole('button', { name: '添加片段补充内容' }));
    const reopenedMenu = await screen.findByRole('menu', { name: '片段补充内容' });
    await user.click(within(reopenedMenu).getByRole('menuitem', { name: '录音补充' }));

    expect(onStartSegmentSupplementRecording).toHaveBeenCalledWith({
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      title: '补充录音1',
    });

    await user.click(within(studio).getByRole('button', { name: '选择片段 Birthday song' }));

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: '片段补充内容' })).not.toBeInTheDocument();
    });
    expect(
      within(content).getByRole('button', { name: '播放片段 Birthday song' })
    ).toBeInTheDocument();
    expect(within(tabs).getAllByRole('tab')).toHaveLength(1);
  });

  it('shows finalized recording supplements as content rail tabs with visible supplement identity', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:supplement-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const readFinalizedAudioSegmentSupplement = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        audio: new Uint8Array([7, 8, 9]),
        audioByteLength: 3,
      },
    }));
    const readFinalizedAudioSegment = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: {
          exists: true,
          text: 'Birthday transcript',
          baselineHash: 'b'.repeat(64),
          tiptapJson: plainParagraphTiptapDoc('Birthday transcript'),
          baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
        },
      },
    }));
    const onClearSegmentContent = vi.fn();
    const savedTranscriptMemory = { ...birthdayMemory, hasAudioTranscript: true };
    const onSegmentTranscriptSaved = vi.fn();
    const saveTranscript = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          memory: savedTranscriptMemory,
          saved: true,
          baselineTranscriptHash: 'c'.repeat(64),
          baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          memory: savedTranscriptMemory,
          saved: true,
          baselineTranscriptHash: 'd'.repeat(64),
          baselineTiptapContentHash: 'f'.repeat(64),
        },
      });
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([audioSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      onClearSegmentContent,
      onSegmentTranscriptSaved,
      readFinalizedAudioSegment,
      readFinalizedAudioSegmentSupplement,
      saveTranscript,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_tab',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const primaryPlayback = content.querySelector('[data-slot="memory-studio-player"]');
    const tabRailRow = content.querySelector('[data-slot="memory-studio-content-tab-rail-row"]');
    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });
    const transcriptTab = within(tabs).getByRole('tab', { name: '转录' });
    const transcriptTabItem = transcriptTab.closest('[data-slot="memory-studio-primary-tab-item"]');
    const transcriptMore = transcriptTabItem?.querySelector(
      '[data-slot="memory-studio-primary-tab-more-anchor"]'
    );

    expect(tabRailRow).toBeInstanceOf(HTMLElement);
    expect(tabRailRow).toContainElement(tabs);
    const inlineTranscriptEditor = await within(content).findByLabelText('转录正文');
    const transcriptSurfacePanel = within(content).getByRole('tabpanel', { name: '转录' });
    expect(transcriptSurfacePanel).toHaveAttribute(
      'data-slot',
      'memory-studio-inline-markdown-editor'
    );
    expect(transcriptSurfacePanel).toHaveClass('mt-12');
    expect(transcriptSurfacePanel).toHaveClass('flex-1', 'min-h-0');
    expect(transcriptSurfacePanel).not.toHaveClass('max-w-[880px]');
    expect(transcriptSurfacePanel).not.toHaveClass('mt-14');
    expect(transcriptSurfacePanel).not.toHaveClass('h-[470px]');
    const contentTabActions = content.querySelector(
      '[data-slot="memory-studio-content-tab-actions"]'
    );
    expect(contentTabActions).toBeInstanceOf(HTMLElement);
    expect(
      within(contentTabActions as HTMLElement).queryByRole('button', {
        name: '编辑转录',
      })
    ).toBeNull();
    const railAddButton = within(contentTabActions as HTMLElement).getByRole('button', {
      name: '添加片段补充内容',
    });
    expect(railAddButton.parentElement).toBe(contentTabActions);
    expect(railAddButton).toHaveTextContent('补充');
    expect(railAddButton).toHaveClass('gap-[6px]', 'px-[10px]');
    expectRichEditorContent(inlineTranscriptEditor, 'Birthday transcript');
    expect(within(content).queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    await replaceRichEditorMarkdown(inlineTranscriptEditor, 'Updated transcript');
    expect(within(content).getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(within(content).getByRole('button', { name: '保存' })).toBeInTheDocument();
    await user.click(within(content).getByRole('button', { name: '保存' }));
    await waitFor(() =>
      expect(saveTranscript).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-secret',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        markdown: 'Updated transcript',
        baselineTranscriptHash: 'b'.repeat(64),
        tiptapJson: plainParagraphTiptapDoc('Updated transcript'),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      })
    );
    expect(onSegmentTranscriptSaved).toHaveBeenCalledWith({
      expectedSession: session,
      memory: savedTranscriptMemory,
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      baselineTranscriptHash: 'c'.repeat(64),
      baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
    });
    await replaceRichEditorMarkdown(inlineTranscriptEditor, 'Second transcript');
    await user.click(within(content).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(saveTranscript).toHaveBeenCalledTimes(2));
    expect(saveTranscript).toHaveBeenNthCalledWith(2, {
      workspaceHandle: 'workspace-handle-secret',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      markdown: 'Second transcript',
      baselineTranscriptHash: 'c'.repeat(64),
      tiptapJson: plainParagraphTiptapDoc('Second transcript'),
      baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
    });
    expect(primaryPlayback).toHaveAttribute('data-component', 'memory-studio-audio-player');
    expect(transcriptTab).toHaveAttribute('aria-selected', 'true');
    expect(transcriptTabItem).toBeInstanceOf(HTMLElement);
    expect(transcriptMore).toBeInstanceOf(HTMLButtonElement);
    expect(transcriptMore).toHaveAttribute('aria-hidden', 'true');
    expect(transcriptMore).toHaveClass('pointer-events-none');
    expect(transcriptMore).toHaveClass('max-w-0');
    expect(transcriptMore).toHaveClass('opacity-0');
    expect(transcriptMore).toHaveClass('group-hover/supplement-tab:pointer-events-auto');
    expect(transcriptMore).toHaveClass('group-hover/supplement-tab:ml-[6px]');
    expect(transcriptMore).toHaveClass('group-hover/supplement-tab:max-w-20');
    expect(transcriptMore).toHaveClass('group-hover/supplement-tab:opacity-100');
    expect(transcriptMore).toHaveClass('group-hover/supplement-tab:scale-100');
    expect(transcriptMore).toHaveClass('data-[state=open]:pointer-events-auto');
    expect(transcriptMore).toHaveClass('data-[state=open]:ml-[6px]');
    expect(transcriptMore).toHaveClass('data-[state=open]:max-w-20');
    expect(transcriptMore).toHaveClass('data-[state=open]:opacity-100');
    expect(transcriptMore).toHaveClass('data-[state=open]:scale-100');
    await user.hover(transcriptTabItem as HTMLElement);
    expect(transcriptMore).not.toHaveAttribute('aria-hidden');
    expect(transcriptMore).not.toHaveClass('pointer-events-auto');
    expect(transcriptMore).not.toHaveClass('max-w-20');
    await expectMoreTriggerIsIsolatedAndOpensMenu(
      user,
      transcriptMore as HTMLButtonElement,
      '转录 更多操作'
    );
    await user.click(transcriptMore as HTMLButtonElement);
    const transcriptMenu = await screen.findByRole('menu', { name: '转录 更多操作' });
    expect(
      within(transcriptMenu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([
      '用默认应用打开',
      '在访达中显示',
      '复制相对路径',
      '复制绝对路径',
      '重命名',
      '清空转录',
    ]);
    expect(
      within(transcriptMenu).queryByRole('menuitem', { name: '编辑转录' })
    ).not.toBeInTheDocument();
    expect(
      within(transcriptMenu).queryByRole('menuitem', { name: '生成转录' })
    ).not.toBeInTheDocument();
    expect(
      within(transcriptMenu).queryByRole('menuitem', { name: '重新生成转录' })
    ).not.toBeInTheDocument();
    expect(
      within(transcriptMenu).queryByRole('menuitem', { name: '删除' })
    ).not.toBeInTheDocument();
    await user.click(within(transcriptMenu).getByRole('menuitem', { name: '清空转录' }));
    expect(onClearSegmentContent).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId: 'mem_birthday',
        contentKind: 'transcript',
        currentTitle: '转录',
        baselineTranscriptHash: 'b'.repeat(64),
      })
    );
    const tabDragDataTransfer = createDragDataTransfer();
    fireEvent.dragStart(transcriptMore as HTMLButtonElement, { dataTransfer: tabDragDataTransfer });
    expect(tabDragDataTransfer.setData).not.toHaveBeenCalled();
    const transcriptPanel = within(content).getByRole('tabpanel', { name: '转录' });
    expect(transcriptTab).toHaveAttribute('aria-controls', transcriptPanel.id);
    const supplementItem = within(tabs).getByRole('tab', {
      name: '补充录音',
    });
    expect(supplementItem).toBeVisible();
    await userEvent.click(supplementItem);
    expect(supplementItem).toHaveAttribute('aria-selected', 'true');
    expect(supplementItem).toHaveAttribute('data-supplement-type', 'audio');
    const supplementTabItem = supplementItem.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    );
    expect(supplementTabItem).toBeInstanceOf(HTMLElement);
    expect(supplementItem.parentElement).toBe(supplementTabItem);
    const moreAnchor = (supplementTabItem as HTMLElement).querySelector(
      '[data-slot="memory-studio-supplement-more-anchor"]'
    );
    expect(moreAnchor).toBeInstanceOf(HTMLButtonElement);
    const moreButton = moreAnchor as HTMLButtonElement;
    expect(moreButton).toHaveAttribute('data-slot', 'memory-studio-supplement-more-anchor');
    expect(moreButton.parentElement).toBe(supplementTabItem);
    expect(moreButton).not.toBeDisabled();
    expect(moreButton).not.toHaveAttribute('aria-hidden');
    expect(moreButton).not.toHaveAttribute('aria-disabled');
    expect(moreButton).not.toHaveAttribute('data-more-state');
    expect(moreButton).toHaveClass('duration-[400ms]');
    expect(moreButton).toHaveClass('ease-[cubic-bezier(0.2,0.9,0.1,1)]');
    await expectMoreTriggerIsIsolatedAndOpensMenu(user, moreButton, '补充录音 更多操作');
    expect(
      supplementItem.querySelector('[data-slot="memory-studio-supplement-reorder-anchor"]')
    ).toBeInstanceOf(HTMLElement);
    expect(content.querySelector('[data-slot="memory-studio-player"]')).toHaveAttribute(
      'data-component',
      'memory-studio-audio-player'
    );
    expect(within(content).queryByText('13:11')).not.toBeInTheDocument();
    expect(within(content).queryByText('这段录音还没有转录。')).not.toBeInTheDocument();
    expect(
      within(content).getByRole('button', { name: '播放补充录音 补充录音' })
    ).toBeInTheDocument();
    const supplementPanel = within(content).getByRole('tabpanel', { name: '补充录音' });
    expect(supplementPanel).toHaveAttribute('data-slot', 'memory-studio-supplement-panel');
    expect(supplementItem).toHaveAttribute('aria-controls', supplementPanel.id);
    expect(supplementPanel).toHaveAttribute('aria-labelledby', supplementItem.id);
    expect(supplementPanel).toHaveClass('reo-content-tab-panel-motion');
    const supplementPlayback = content.querySelector(
      '[data-slot="memory-studio-supplement-player"]'
    );
    expect(supplementPlayback).toHaveAttribute('data-component', 'memory-studio-audio-player');
    expect(within(content).getByRole('slider', { name: '补充录音播放进度' })).toHaveAttribute(
      'aria-valuetext',
      '00:00 / 00:05'
    );
    expect(within(content).getByText('00:00 / 00:05')).toBeInTheDocument();
    expect(readFinalizedAudioSegmentSupplement).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        supplementId: 'sup_birthday_followup',
      })
    );

    play.mockClear();
    await userEvent.click(within(content).getByRole('button', { name: '播放补充录音 补充录音' }));

    expect(play).toHaveBeenCalledOnce();
    expect(
      within(content).getByRole('button', { name: '暂停补充录音 补充录音' })
    ).toBeInTheDocument();
  });

  it('edits active audio supplement transcript below its playback row through the always-visible editor', async () => {
    const savedSupplementTranscriptValue = {
      memory: { ...birthdayMemory, supplementCount: 1, hasAudioTranscript: true },
      segment: {
        ...birthdayVoiceSegment,
        supplementCount: 1,
        supplements: [
          {
            ...audioSupplement(),
            transcript: { exists: true },
          },
        ],
      },
      supplement: {
        ...audioSupplement(),
        transcript: { exists: true },
      },
      saved: true,
    };
    const saveSegmentSupplementTranscript = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...savedSupplementTranscriptValue,
          baselineTranscriptHash: 'd'.repeat(64),
          baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...savedSupplementTranscriptValue,
          baselineTranscriptHash: 'e'.repeat(64),
          baselineTiptapContentHash: 'f'.repeat(64),
        },
      });
    const readFinalizedAudioSegmentSupplement = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        audio: new Uint8Array([7, 8, 9]),
        audioByteLength: 3,
        transcript: {
          exists: true,
          text: '这是一个补充的录音。',
          baselineHash: 'c'.repeat(64),
          tiptapJson: plainParagraphTiptapDoc('这是一个补充的录音。'),
          baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
        },
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([
      audioSupplement({ transcript: { exists: true } }),
    ]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readFinalizedAudioSegmentSupplement,
      saveSegmentSupplementTranscript,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_audio_supplement_inline_transcript',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const supplementItem = await within(content).findByRole('tab', { name: '补充录音' });
    await userEvent.click(supplementItem);

    expect(
      within(content).getByRole('button', { name: '播放补充录音 补充录音' })
    ).toBeInTheDocument();
    const transcriptEditor = await within(content).findByLabelText('补充录音转录正文');
    const supplementPanel = within(content).getByRole('tabpanel', { name: '补充录音' });
    expect(supplementPanel).toHaveAttribute('data-slot', 'memory-studio-supplement-panel');
    expectRichEditorContent(transcriptEditor, '这是一个补充的录音。');
    expect(
      transcriptEditor.closest('[data-slot="memory-studio-inline-markdown-editor"]')
    ).toHaveClass('mt-12', 'flex-1', 'min-h-0');
    expect(
      transcriptEditor.closest('[data-slot="memory-studio-inline-markdown-editor"]')
    ).not.toHaveClass('max-w-[880px]');
    expect(content.querySelector('[data-slot="memory-studio-supplement-transcript"]')).toBeNull();

    await replaceRichEditorMarkdown(transcriptEditor, '更新后的补充录音转录');
    await userEvent.click(within(content).getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(saveSegmentSupplementTranscript).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        supplementId: 'sup_birthday_followup',
        markdown: '更新后的补充录音转录',
        baselineTranscriptHash: 'c'.repeat(64),
        tiptapJson: plainParagraphTiptapDoc('更新后的补充录音转录'),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      })
    );
    await replaceRichEditorMarkdown(transcriptEditor, '再次更新补充录音转录');
    await userEvent.click(within(content).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(saveSegmentSupplementTranscript).toHaveBeenCalledTimes(2));
    expect(saveSegmentSupplementTranscript).toHaveBeenNthCalledWith(2, {
      workspaceHandle: 'workspace-handle-secret',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      supplementId: 'sup_birthday_followup',
      markdown: '再次更新补充录音转录',
      baselineTranscriptHash: 'd'.repeat(64),
      tiptapJson: plainParagraphTiptapDoc('再次更新补充录音转录'),
      baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
    });
  });

  it('shows finalized note supplements as content rail tabs without audio playback controls', async () => {
    const readSegmentSupplementContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        type: 'note',
        title: '补充笔记',
        bodyMarkdown: '## Follow-up\n\n- Capture the cake idea',
        bodyByteLength: 36,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([noteSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readSegmentSupplementContent,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_note_supplement_tab',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });
    const supplementItem = await within(tabs).findByRole('tab', { name: '补充笔记' });

    expect(supplementItem).toHaveAttribute('data-supplement-type', 'note');
    await userEvent.click(supplementItem);

    const supplementPanel = await within(content).findByRole('tabpanel', { name: '补充笔记' });
    expect(supplementPanel).toHaveAttribute('data-slot', 'memory-studio-inline-markdown-editor');
    expect(supplementItem).toHaveAttribute('aria-controls', supplementPanel.id);
    expect(supplementPanel).toHaveAttribute('aria-labelledby', supplementItem.id);
    expectRichEditorContent(await within(supplementPanel).findByLabelText('补充笔记正文'), [
      'Follow-up',
      'Capture the cake idea',
    ]);
    expect(
      within(supplementPanel).queryByRole('button', { name: '编辑补充笔记 补充笔记' })
    ).toBeNull();
    expect(within(content).queryByRole('button', { name: /播放补充录音/ })).toBeNull();
    expect(readSegmentSupplementContent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        supplementId: 'sup_birthday_note',
      })
    );
  });

  it('edits active note supplement content through the always-visible Memory Studio editor', async () => {
    const onNoteSegmentSupplementContentSaved = vi.fn();
    const writeSegmentSupplementContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId ?? 'write_segment_supplement_note',
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        type: 'note',
        title: '补充笔记',
        bodyMarkdown: request.bodyMarkdown,
        bodyByteLength: 21,
        baselineContentHash: 'b'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
      },
    }));
    const readSegmentSupplementContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        type: 'note',
        title: '补充笔记',
        bodyMarkdown: '## Follow-up\n\n- Capture the cake idea',
        bodyByteLength: 36,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([noteSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      onNoteSegmentSupplementContentSaved,
      readSegmentSupplementContent,
      session,
      writeSegmentSupplementContent,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_note_supplement_tab_edit_action',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });
    const supplementItem = await within(tabs).findByRole('tab', { name: '补充笔记' });
    await userEvent.click(supplementItem);

    const supplementPanel = await within(content).findByRole('tabpanel', { name: '补充笔记' });
    const inlineSupplementEditor = await within(content).findByLabelText('补充笔记正文');
    expectRichEditorContent(inlineSupplementEditor, ['Follow-up', 'Capture the cake idea']);
    expect(inlineSupplementEditor).not.toHaveFocus();
    expect(supplementPanel).toHaveAttribute('data-slot', 'memory-studio-inline-markdown-editor');
    expect(supplementPanel).toHaveClass('mt-12', 'flex-1', 'min-h-0');
    expect(supplementPanel).not.toHaveClass('max-w-[880px]');
    expect(supplementPanel).not.toHaveClass('mt-14');
    expect(supplementPanel).not.toHaveClass('h-[470px]');
    expect(
      within(supplementPanel).queryByRole('button', { name: '编辑补充笔记 补充笔记' })
    ).toBeNull();
    expect(within(content).queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    await replaceRichEditorMarkdown(inlineSupplementEditor, 'Updated supplement');
    expect(within(content).getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(within(content).getByRole('button', { name: '保存' })).toBeInTheDocument();
    await userEvent.click(within(content).getByRole('button', { name: '保存' }));
    await waitFor(() =>
      expect(writeSegmentSupplementContent).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        supplementId: 'sup_birthday_note',
        bodyMarkdown: 'Updated supplement',
        bodyTiptapJson: expect.objectContaining({ type: 'doc' }),
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      })
    );
    expect(onNoteSegmentSupplementContentSaved).toHaveBeenCalledWith({
      expectedSession: session,
      memoryId: 'mem_birthday',
      segmentId: 'seg_birthday_voice',
      supplementId: 'sup_birthday_note',
      title: '补充笔记',
      bodyMarkdown: 'Updated supplement',
      bodyTiptapJson: expect.objectContaining({ type: 'doc' }),
      baselineContentHash: 'b'.repeat(64),
      baselineTiptapContentHash: BASELINE_TIPTAP_HASH_B,
      bodyByteLength: 21,
    });

    const contentTabRailRow = content.querySelector(
      '[data-slot="memory-studio-content-tab-rail-row"]'
    );
    expect(contentTabRailRow).toBeInstanceOf(HTMLElement);
    const contentTabActions = content.querySelector(
      '[data-slot="memory-studio-content-tab-actions"]'
    );
    expect(contentTabActions).toBeInstanceOf(HTMLElement);
    expect(
      within(contentTabActions as HTMLElement).queryByRole('button', {
        name: '编辑补充笔记 补充笔记',
      })
    ).toBeNull();
    const railAddButton = within(contentTabActions as HTMLElement).getByRole('button', {
      name: '添加片段补充内容',
    });
    expect(railAddButton.parentElement).toBe(contentTabActions);
    expect(railAddButton).toHaveTextContent('补充');
  });

  it('uses the always-visible editor for an empty note supplement', async () => {
    const readSegmentSupplementContent = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        type: 'note',
        title: '补充笔记',
        bodyMarkdown: '',
        bodyByteLength: 0,
        baselineContentHash: 'a'.repeat(64),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH_A,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([noteSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readSegmentSupplementContent,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_empty_note_supplement',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await userEvent.click(within(content).getByRole('tab', { name: '补充笔记' }));

    const supplementPanel = await within(content).findByRole('tabpanel', { name: '补充笔记' });
    expect(supplementPanel).toHaveAttribute('data-slot', 'memory-studio-inline-markdown-editor');
    const emptySupplementEditor = await within(content).findByLabelText('补充笔记正文');
    expectRichEditorContent(emptySupplementEditor, '');
    expect(within(supplementPanel).getByText('写下补充笔记...')).toBeInTheDocument();
    expect(within(supplementPanel).queryByText('这条补充笔记还没有正文。')).toBeNull();
    expect(within(supplementPanel).queryByRole('button', { name: '写补充笔记' })).toBeNull();
    expect(within(supplementPanel).queryByText('这条笔记还没有正文。')).toBeNull();
  });

  it('shows a retryable status when supplement playback fails', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:supplement-audio-failure');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'));
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const readFinalizedAudioSegmentSupplement = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        audio: new Uint8Array([7, 8, 9]),
        audioByteLength: 3,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([audioSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readFinalizedAudioSegmentSupplement,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_playback_failure',
      detail: detailWithSupplement,
    });

    const content = await screen.findByRole('region', { name: '片段内容' });
    await userEvent.click(within(content).getByRole('tab', { name: '补充录音' }));
    await userEvent.click(within(content).getByRole('button', { name: '播放补充录音 补充录音' }));

    expect(await within(content).findByText('补充录音无法播放，请稍后重试。')).toBeInTheDocument();
    expect(
      within(content).getByRole('button', { name: '播放补充录音 补充录音' })
    ).toBeInTheDocument();
  });

  it('keeps failed supplement transcripts editable below the supplement playback row', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retryable-supplement-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const onRetrySupplementTranscription = vi.fn();
    const failedSupplement = audioSupplement({ lastTranscriptionAttempt: 'failed' });
    const detailWithFailedSupplement = birthdayDetailWithSupplements([failedSupplement]);
    const readFinalizedAudioSegmentSupplement = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        transcript: {
          exists: false,
          text: '',
          baselineHash: '0'.repeat(64),
        },
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      onRetrySupplementTranscription,
      readFinalizedAudioSegmentSupplement,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_retry',
      detail: detailWithFailedSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await user.click(within(content).getByRole('tab', { name: '补充录音' }));

    expectRichEditorContent(await within(content).findByLabelText('补充录音转录正文'), '');
    expect(within(content).queryByText('上次生成补充录音转录失败。')).not.toBeInTheDocument();
    expect(within(content).queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
    expect(onRetrySupplementTranscription).not.toHaveBeenCalled();
  });

  it('switches between multiple SegmentSupplement panels without using created time labels', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(() => `blob:supplement-audio-${createObjectURL.mock.calls.length}`);
    createObjectURL.mockClear();
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const readFinalizedAudioSegmentSupplement = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        audio: new Uint8Array([7, 8, 9]),
        audioByteLength: 3,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 2 }] });
    const detailWithSupplements = birthdayDetailWithSupplements([
      audioSupplement(),
      audioSupplement({
        supplementId: 'sup_birthday_context',
        title: '现场补充',
        createdAt: '2026-05-06T13:12:00.000',
        updatedAt: '2026-05-06T13:12:05.000',
        durationMs: 7_000,
        audioByteLength: 5,
      }),
    ]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readFinalizedAudioSegmentSupplement,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_two_supplements',
      detail: detailWithSupplements,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const firstSupplementItem = within(content).getByRole('tab', { name: '补充录音' });
    const secondSupplementItem = within(content).getByRole('tab', { name: '现场补充' });

    await userEvent.click(firstSupplementItem);
    expect(firstSupplementItem).toHaveAttribute('aria-selected', 'true');
    expect(secondSupplementItem).toHaveAttribute('aria-selected', 'false');
    expect(within(content).queryByText('13:12')).not.toBeInTheDocument();

    firstSupplementItem.focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(secondSupplementItem).toHaveAttribute('aria-selected', 'true');
    });
    expect(secondSupplementItem).toHaveFocus();

    const secondSupplementMore = (
      secondSupplementItem.closest('[data-slot="memory-studio-supplement-tab-item"]') as HTMLElement
    ).querySelector('[data-slot="memory-studio-supplement-more-anchor"]');
    expect(secondSupplementMore).toBeInstanceOf(HTMLButtonElement);
    const secondSupplementMoreButton = secondSupplementMore as HTMLButtonElement;
    const firstSupplementTabItem = firstSupplementItem.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    );
    const secondSupplementTabItem = secondSupplementItem.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    );
    expect(firstSupplementTabItem).toHaveAttribute('data-supplement-id', 'sup_birthday_followup');
    expect(firstSupplementTabItem).toHaveAttribute('data-supplement-index', '0');
    expect(secondSupplementTabItem).toHaveAttribute('data-supplement-id', 'sup_birthday_context');
    expect(secondSupplementTabItem).toHaveAttribute('data-supplement-index', '1');
    expect(secondSupplementMoreButton).not.toBeDisabled();
    expect(firstSupplementItem).toHaveAttribute('aria-selected', 'false');
    expect(secondSupplementItem).toHaveAttribute('aria-selected', 'true');
    expect(
      within(content).getByRole('button', { name: '播放补充录音 现场补充' })
    ).toBeInTheDocument();
    expect(readFinalizedAudioSegmentSupplement).toHaveBeenCalledWith(
      expect.objectContaining({
        supplementId: 'sup_birthday_context',
      })
    );

    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    await userEvent.click(within(content).getByRole('button', { name: '播放补充录音 现场补充' }));
    const pauseCallCountBeforeTabSwitch = pause.mock.calls.length;
    await userEvent.click(firstSupplementItem);

    expect(pause.mock.calls.length).toBeGreaterThan(pauseCallCountBeforeTabSwitch);
    expect(within(content).queryByRole('button', { name: '暂停补充录音 现场补充' })).toBeNull();

    await userEvent.click(firstSupplementItem);

    expect(firstSupplementItem).toHaveAttribute('aria-selected', 'true');
    expect(readFinalizedAudioSegmentSupplement).toHaveBeenCalledWith(
      expect.objectContaining({
        supplementId: 'sup_birthday_followup',
      })
    );
    expect(readFinalizedAudioSegmentSupplement.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(createObjectURL.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('reorders transcript and SegmentSupplement tabs with drag and drop', async () => {
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 2 }] });
    const detailWithSupplements = birthdayDetailWithSupplements([
      audioSupplement(),
      audioSupplement({
        supplementId: 'sup_birthday_context',
        title: '现场补充',
        createdAt: '2026-05-06T13:12:00.000',
        updatedAt: '2026-05-06T13:12:05.000',
        durationMs: 7_000,
        audioByteLength: 5,
      }),
    ]);
    const updateSegmentContentTabOrder = vi.fn(
      async (payload: Parameters<Window['reoWorkspace']['updateSegmentContentTabOrder']>[0]) => ({
        ok: true as const,
        value: {
          memory: { ...birthdayMemory, supplementCount: 2 },
          segment: {
            ...detailWithSupplements.segments[0],
            contentTabOrder: payload.contentTabOrder,
          },
        },
      })
    );
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      session,
      updateSegmentContentTabOrder,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_dnd_tabs',
      detail: detailWithSupplements,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });
    const tabNames = () =>
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent);

    expect(tabNames()).toEqual(['转录', '补充录音', '现场补充']);

    const transcriptTab = within(tabs).getByRole('tab', { name: '转录' });
    const firstSupplementTab = within(tabs).getByRole('tab', { name: '补充录音' });
    const secondSupplementTab = within(tabs).getByRole('tab', { name: '现场补充' });
    const transcriptTabItem = transcriptTab.closest(
      '[data-slot="memory-studio-primary-tab-item"]'
    ) as HTMLElement;
    const firstSupplementTabItem = firstSupplementTab.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    ) as HTMLElement;
    const secondSupplementTabItem = secondSupplementTab.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    ) as HTMLElement;
    const firstSupplementMore = firstSupplementTabItem.querySelector(
      '[data-slot="memory-studio-supplement-more-anchor"]'
    ) as HTMLButtonElement;
    const secondSupplementMore = secondSupplementTabItem.querySelector(
      '[data-slot="memory-studio-supplement-more-anchor"]'
    ) as HTMLButtonElement;
    mockContentTabRect(transcriptTabItem);
    const dataTransfer = createDragDataTransfer();

    fireEvent.pointerEnter(secondSupplementTabItem);
    expect(secondSupplementMore).not.toHaveAttribute('aria-hidden');
    fireEvent.dragStart(secondSupplementTabItem, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-reo-content-tab',
      JSON.stringify({
        segmentId: 'seg_birthday_voice',
        value: 'supplement:sup_birthday_context',
      })
    );
    fireEvent.pointerEnter(firstSupplementTabItem);
    fireEvent.dragEnter(firstSupplementTabItem, { dataTransfer });
    expect(secondSupplementMore).not.toHaveAttribute('aria-hidden');
    expect(secondSupplementMore).toHaveClass('max-w-20');
    expect(secondSupplementMore).toHaveClass('opacity-100');
    expect(firstSupplementMore).toHaveAttribute('aria-hidden', 'true');
    expect(firstSupplementMore).toHaveAttribute('tabindex', '-1');
    expect(firstSupplementMore).toHaveClass('max-w-0');
    expect(firstSupplementMore).toHaveClass('opacity-0');
    expect(firstSupplementMore).not.toHaveClass('group-hover/supplement-tab:max-w-20');
    expect(firstSupplementMore).not.toHaveClass('group-hover/supplement-tab:opacity-100');
    expect(tabNames()).toEqual(['转录', '补充录音', '现场补充']);

    fireEvent.dragEnter(transcriptTabItem, { dataTransfer });
    expect(tabNames()).toEqual(['转录', '补充录音', '现场补充']);

    fireContentTabDragOver(transcriptTabItem, { clientX: -10, dataTransfer });
    fireEvent.drop(transcriptTabItem, { dataTransfer });

    await waitFor(() => expect(tabNames()).toEqual(['现场补充', '转录', '补充录音']));

    const transcriptTabItemAfterStableMove = within(tabs)
      .getByRole('tab', { name: '转录' })
      .closest('[data-slot="memory-studio-primary-tab-item"]') as HTMLElement;
    mockContentTabRect(transcriptTabItemAfterStableMove);
    fireEvent.dragEnter(transcriptTabItemAfterStableMove, { dataTransfer });
    fireContentTabDragOver(transcriptTabItemAfterStableMove, { clientX: -10, dataTransfer });

    fireContentTabDragOver(transcriptTabItemAfterStableMove, { clientX: 90, dataTransfer });
    await waitFor(() => expect(tabNames()).toEqual(['转录', '现场补充', '补充录音']));

    fireContentTabDragOver(transcriptTabItemAfterStableMove, { clientX: -10, dataTransfer });
    fireEvent.dragEnd(secondSupplementTabItem, { dataTransfer });
    expect(secondSupplementMore).toHaveAttribute('aria-hidden', 'true');
    expect(secondSupplementMore).toHaveAttribute('tabindex', '-1');

    await waitFor(() => expect(updateSegmentContentTabOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(tabNames()).toEqual(['现场补充', '转录', '补充录音']));

    const transcriptTabItemAfterFirstMove = within(tabs)
      .getByRole('tab', { name: '转录' })
      .closest('[data-slot="memory-studio-primary-tab-item"]') as HTMLElement;
    const firstSupplementTabItemAfterFirstMove = within(tabs)
      .getByRole('tab', { name: '现场补充' })
      .closest('[data-slot="memory-studio-supplement-tab-item"]') as HTMLElement;
    mockContentTabRect(firstSupplementTabItemAfterFirstMove);
    const secondMoveDataTransfer = createDragDataTransfer();
    fireEvent.dragStart(transcriptTabItemAfterFirstMove, { dataTransfer: secondMoveDataTransfer });
    fireEvent.dragEnter(firstSupplementTabItemAfterFirstMove, {
      dataTransfer: secondMoveDataTransfer,
    });
    fireContentTabDragOver(firstSupplementTabItemAfterFirstMove, {
      clientX: -10,
      dataTransfer: secondMoveDataTransfer,
    });
    fireEvent.drop(firstSupplementTabItemAfterFirstMove, { dataTransfer: secondMoveDataTransfer });
    fireEvent.dragEnd(transcriptTabItemAfterFirstMove, { dataTransfer: secondMoveDataTransfer });

    await waitFor(() => expect(updateSegmentContentTabOrder).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(tabNames()).toEqual(['转录', '现场补充', '补充录音']));

    await userEvent.click(within(tabs).getByRole('tab', { name: '现场补充' }));
    expect(within(tabs).getByRole('tab', { name: '现场补充' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      within(content).getByRole('button', { name: '播放补充录音 现场补充' })
    ).toBeInTheDocument();
  });

  it('renders persisted content tab order from the Memory detail projection', async () => {
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 2 }] });
    const detailWithSupplements = birthdayDetailWithSupplements([
      audioSupplement(),
      audioSupplement({
        supplementId: 'sup_birthday_context',
        title: '现场补充',
        createdAt: '2026-05-06T13:12:00.000',
        updatedAt: '2026-05-06T13:12:05.000',
        durationMs: 7_000,
        audioByteLength: 5,
      }),
    ]);
    const orderedDetail = {
      ...detailWithSupplements,
      segments: [
        {
          ...detailWithSupplements.segments[0],
          contentTabOrder: [
            'supplement:sup_birthday_context',
            'segment',
            'supplement:sup_birthday_followup',
          ],
        },
      ],
    } as unknown as WorkspaceMemoryDetail;
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_persisted_order',
      detail: orderedDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });

    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
    ).toEqual(['现场补充', '转录', '补充录音']);
  });

  it('commits content tab drag order to the workspace after drag end', async () => {
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 2 }] });
    const detailWithSupplements = birthdayDetailWithSupplements([
      audioSupplement(),
      audioSupplement({
        supplementId: 'sup_birthday_context',
        title: '现场补充',
        createdAt: '2026-05-06T13:12:00.000',
        updatedAt: '2026-05-06T13:12:05.000',
        durationMs: 7_000,
        audioByteLength: 5,
      }),
    ]);
    const persistedSegment = {
      ...detailWithSupplements.segments[0],
      contentTabOrder: [
        'supplement:sup_birthday_context',
        'segment',
        'supplement:sup_birthday_followup',
      ],
    };
    const updateSegmentContentTabOrder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        memory: { ...birthdayMemory, supplementCount: 2 },
        segment: persistedSegment,
      },
    });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      session,
      updateSegmentContentTabOrder,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_commit_order',
      detail: detailWithSupplements,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const tabs = within(content).getByRole('tablist', { name: '片段内容类型' });
    const transcriptTab = within(tabs).getByRole('tab', { name: '转录' });
    const secondSupplementTab = within(tabs).getByRole('tab', { name: '现场补充' });
    const transcriptTabItem = transcriptTab.closest(
      '[data-slot="memory-studio-primary-tab-item"]'
    ) as HTMLElement;
    const secondSupplementTabItem = secondSupplementTab.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    ) as HTMLElement;
    mockContentTabRect(transcriptTabItem);
    const dataTransfer = createDragDataTransfer();

    fireEvent.dragStart(secondSupplementTabItem, { dataTransfer });
    fireContentTabDragOver(transcriptTabItem, { clientX: -10, dataTransfer });
    fireEvent.drop(transcriptTabItem, { dataTransfer });
    fireEvent.dragEnd(secondSupplementTabItem, { dataTransfer });

    await waitFor(() => {
      expect(updateSegmentContentTabOrder).toHaveBeenCalledWith({
        workspaceHandle: 'workspace-handle-secret',
        workspaceId: 'ws_1',
        memoryId: 'mem_birthday',
        segmentId: 'seg_birthday_voice',
        contentTabOrder: [
          'supplement:sup_birthday_context',
          'segment',
          'supplement:sup_birthday_followup',
        ],
      });
    });
  });

  it('keeps the SegmentSupplement More affordance expanded while its menu is open', async () => {
    const user = userEvent.setup();
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([audioSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_hover',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const supplementTab = within(content).getByRole('tab', { name: '补充录音' });
    const supplementTabItem = supplementTab.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    ) as HTMLElement;
    const moreAnchor = supplementTabItem.querySelector(
      '[data-slot="memory-studio-supplement-more-anchor"]'
    );
    expect(moreAnchor).toBeInstanceOf(HTMLButtonElement);
    const moreButton = moreAnchor as HTMLButtonElement;

    expect(supplementTabItem).toHaveClass('group/supplement-tab');
    expect(supplementTabItem).not.toHaveAttribute('data-actions-visible');
    expect(moreButton).toHaveAttribute('aria-hidden', 'true');
    expect(moreButton).toHaveAttribute('tabindex', '-1');
    expect(moreButton).toHaveClass('pointer-events-none');
    expect(moreButton).toHaveClass('max-w-0');
    expect(moreButton).toHaveClass('opacity-0');
    expect(supplementTabItem).toHaveClass('duration-[400ms]');
    expect(supplementTabItem).toHaveClass('ease-[cubic-bezier(0.2,0.9,0.1,1)]');
    expect(moreButton).toHaveClass('duration-[400ms]');
    expect(moreButton).toHaveClass('ease-[cubic-bezier(0.2,0.9,0.1,1)]');
    expect(moreButton).toHaveClass('group-hover/supplement-tab:pointer-events-auto');
    expect(moreButton).toHaveClass('group-hover/supplement-tab:ml-[6px]');
    expect(moreButton).toHaveClass('group-hover/supplement-tab:max-w-20');
    expect(moreButton).toHaveClass('group-hover/supplement-tab:opacity-100');
    expect(moreButton).toHaveClass('group-hover/supplement-tab:scale-100');
    expect(moreButton).not.toHaveClass('group-focus-within/supplement-tab:max-w-20');
    expect(moreButton).toHaveClass('focus-visible:pointer-events-auto');
    expect(moreButton).toHaveClass('focus-visible:ml-[6px]');
    expect(moreButton).toHaveClass('focus-visible:max-w-20');
    expect(moreButton).toHaveClass('focus-visible:opacity-100');
    expect(moreButton).toHaveClass('focus-visible:scale-100');
    expect(moreButton).toHaveClass('data-[state=open]:pointer-events-auto');
    expect(moreButton).toHaveClass('data-[state=open]:ml-[6px]');
    expect(moreButton).toHaveClass('data-[state=open]:max-w-20');
    expect(moreButton).toHaveClass('data-[state=open]:opacity-100');
    expect(moreButton).toHaveClass('data-[state=open]:scale-100');

    await user.click(supplementTab);
    expect(supplementTab).toHaveAttribute('aria-selected', 'true');
    await user.hover(within(content).getByRole('tab', { name: '转录' }));
    expect(moreButton).toHaveAttribute('aria-hidden', 'true');
    expect(moreButton).toHaveAttribute('tabindex', '-1');
    expect(moreButton).toHaveClass('pointer-events-none');
    expect(moreButton).toHaveClass('max-w-0');
    expect(moreButton).toHaveClass('opacity-0');

    moreButton.focus();
    expect(moreButton).toHaveFocus();
    expect(moreButton).toHaveClass('focus-visible:max-w-20');

    supplementTab.focus();

    await user.hover(supplementTabItem);
    expect(moreButton).not.toHaveAttribute('aria-hidden');
    expect(moreButton).not.toHaveAttribute('tabindex', '-1');
    expect(moreButton).not.toHaveClass('pointer-events-auto');
    expect(moreButton).not.toHaveClass('ml-[6px]');
    expect(moreButton).not.toHaveClass('max-w-20');
    expect(moreButton).not.toHaveClass('opacity-100');

    moreButton.focus();
    expect(moreButton).toHaveFocus();

    await user.unhover(supplementTabItem);
    expect(moreButton).toHaveAttribute('aria-hidden', 'true');
    expect(moreButton).toHaveAttribute('tabindex', '-1');
    expect(moreButton).toHaveClass('pointer-events-none');
    expect(moreButton).toHaveClass('max-w-0');
    expect(moreButton).toHaveClass('opacity-0');
    expect(supplementTab).toHaveFocus();

    await user.hover(supplementTabItem);
    expect(moreButton).not.toHaveAttribute('aria-hidden');

    await user.click(moreButton);
    expect(screen.getByRole('menu', { name: '补充录音 更多操作' })).toBeInTheDocument();

    await user.unhover(supplementTabItem);
    expect(supplementTab).toHaveAttribute('aria-selected', 'true');
    expect(moreButton).toHaveAttribute('data-state', 'open');
    expect(moreButton).not.toHaveAttribute('aria-hidden');
    expect(moreButton).toHaveAttribute('tabindex', '0');
    expect(moreButton).toHaveClass('data-[state=open]:pointer-events-auto');
    expect(moreButton).toHaveClass('data-[state=open]:ml-[6px]');
    expect(moreButton).toHaveClass('data-[state=open]:max-w-20');
    expect(moreButton).toHaveClass('data-[state=open]:opacity-100');
    expect(moreButton).toHaveClass('data-[state=open]:scale-100');

    await user.keyboard('{Escape}');
    expect(supplementTab).toHaveFocus();
    expect(moreButton).toHaveAttribute('aria-hidden', 'true');
    expect(moreButton).toHaveAttribute('tabindex', '-1');
    expect(moreButton).toHaveClass('max-w-0');
    expect(moreButton).toHaveClass('opacity-0');
  });

  it('closes the SegmentSupplement More menu when the selected Segment changes', async () => {
    const user = userEvent.setup();
    const firstSupplement = audioSupplement({ title: '现场补充' });
    const baseSegments = birthdayDetailWithTwoSegments.segments as readonly AudioSegment[];
    const firstSegment = baseSegments[0];
    const secondSegment = baseSegments[1];
    if (!firstSegment || !secondSegment) {
      throw new Error('two segment fixture must include two segments');
    }
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 2 }] });
    const detailWithSegmentSupplements: WorkspaceMemoryDetail = {
      ...birthdayDetailWithTwoSegments,
      supplementCount: 2,
      segments: [
        {
          ...firstSegment,
          supplementCount: 1,
          supplements: [firstSupplement],
        },
        {
          ...secondSegment,
          supplementCount: 1,
          supplements: [
            audioSupplement({
              supplementId: 'sup_birthday_song_followup',
              segmentId: 'seg_birthday_song',
              title: '歌曲补充',
            }),
          ],
        },
      ],
    };
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_menu_lifecycle',
      detail: detailWithSegmentSupplements,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    const strip = within(studio).getByRole('region', { name: '片段预览流' });
    const supplementTab = within(content).getByRole('tab', { name: '现场补充' });
    const supplementTabItem = supplementTab.closest(
      '[data-slot="memory-studio-supplement-tab-item"]'
    );
    expect(supplementTabItem).toBeInstanceOf(HTMLElement);

    await user.hover(supplementTabItem as HTMLElement);
    await user.click(within(content).getByRole('button', { name: '现场补充 更多操作' }));
    expect(screen.getByRole('menu', { name: '现场补充 更多操作' })).toBeInTheDocument();

    await user.click(within(strip).getByRole('button', { name: '选择片段 Birthday song' }));
    await waitFor(() => {
      expect(within(content).getByRole('tab', { name: '歌曲补充' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });
    expect(screen.queryByRole('menu', { name: '现场补充 更多操作' })).not.toBeInTheDocument();

    await user.click(within(strip).getByRole('button', { name: '选择片段 Birthday candles' }));
    await waitFor(() => {
      expect(within(content).getByRole('tab', { name: '现场补充' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('menu', { name: '现场补充 更多操作' })).not.toBeInTheDocument();
  });

  it('opens the SegmentSupplement sibling More menu and emits a rename intent', async () => {
    const user = userEvent.setup();
    const onRenameSegmentSupplement = vi.fn();
    const onRetrySupplementTranscription = vi.fn();
    const openSegmentSupplementDocument = vi.fn().mockResolvedValue({ ok: true });
    const revealSegmentSupplementInFinder = vi.fn().mockResolvedValue({ ok: true });
    const copySegmentSupplementRelativePath = vi.fn().mockResolvedValue({ ok: true });
    const copySegmentSupplementAbsolutePath = vi.fn().mockResolvedValue({ ok: true });
    const supplement = audioSupplement({ title: '现场补充' });
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([supplement]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      copySegmentSupplementAbsolutePath,
      copySegmentSupplementRelativePath,
      onRenameSegmentSupplement,
      onRetrySupplementTranscription,
      openSegmentSupplementDocument,
      revealSegmentSupplementInFinder,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_rename',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await user.click(within(content).getByRole('tab', { name: '现场补充' }));
    const tab = within(content).getByRole('tab', { name: '现场补充' });
    const tabItem = tab.closest('[data-slot="memory-studio-supplement-tab-item"]');
    expect(tabItem).toBeInstanceOf(HTMLElement);
    await user.hover(tabItem as HTMLElement);
    const more = within(content).getByRole('button', { name: '现场补充 更多操作' });
    expect(more.parentElement).toBe(tabItem);

    await user.click(more);
    let menu = await screen.findByRole('menu', { name: '现场补充 更多操作' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([
      '用默认应用打开',
      '在访达中显示',
      '复制相对路径',
      '复制绝对路径',
      '生成转录',
      '重命名',
      '删除',
    ]);
    const segment = detailWithSupplement.segments[0];
    if (!segment) {
      throw new Error('birthday detail fixture must include a segment');
    }
    const actionPayload = {
      workspaceHandle: 'workspace-handle-secret',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
      segmentId: segment.segmentId,
      supplementId: supplement.supplementId,
    };

    await user.click(within(menu).getByRole('menuitem', { name: '用默认应用打开' }));
    expect(openSegmentSupplementDocument).toHaveBeenCalledWith(actionPayload);

    await user.click(more);
    menu = await screen.findByRole('menu', { name: '现场补充 更多操作' });
    await user.click(within(menu).getByRole('menuitem', { name: '在访达中显示' }));
    expect(revealSegmentSupplementInFinder).toHaveBeenCalledWith(actionPayload);

    await user.click(more);
    menu = await screen.findByRole('menu', { name: '现场补充 更多操作' });
    await user.click(within(menu).getByRole('menuitem', { name: '复制相对路径' }));
    expect(copySegmentSupplementRelativePath).toHaveBeenCalledWith(actionPayload);

    await user.click(more);
    menu = await screen.findByRole('menu', { name: '现场补充 更多操作' });
    await user.click(within(menu).getByRole('menuitem', { name: '复制绝对路径' }));
    expect(copySegmentSupplementAbsolutePath).toHaveBeenCalledWith(actionPayload);

    await user.click(more);
    menu = await screen.findByRole('menu', { name: '现场补充 更多操作' });
    await user.click(within(menu).getByRole('menuitem', { name: '重命名' }));

    expect(onRenameSegmentSupplement).toHaveBeenCalledWith({
      memoryId: 'mem_birthday',
      segment,
      supplement,
    });
  });

  it('opens the SegmentSupplement sibling More menu and emits a delete intent', async () => {
    const user = userEvent.setup();
    const onDeleteSegmentSupplement = vi.fn();
    const supplement = audioSupplement({ title: '现场补充' });
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([supplement]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      onDeleteSegmentSupplement,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_delete',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await user.click(within(content).getByRole('tab', { name: '现场补充' }));
    const tab = within(content).getByRole('tab', { name: '现场补充' });
    const tabItem = tab.closest('[data-slot="memory-studio-supplement-tab-item"]');
    expect(tabItem).toBeInstanceOf(HTMLElement);
    await user.hover(tabItem as HTMLElement);

    await user.click(within(content).getByRole('button', { name: '现场补充 更多操作' }));
    expect(screen.getByRole('menu', { name: '现场补充 更多操作' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '删除' }));

    expect(onDeleteSegmentSupplement).toHaveBeenCalledWith({
      memoryId: 'mem_birthday',
      segment: detailWithSupplement.segments[0],
      supplement,
    });
  });

  it('falls back to the transcript panel when the selected SegmentSupplement disappears', async () => {
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([audioSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_before_remove',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await userEvent.click(within(content).getByRole('tab', { name: '补充录音' }));
    expect(within(content).getByRole('tab', { name: '补充录音' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    act(() => {
      queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
        requestId: 'request_mem_birthday_supplement_after_remove',
        detail: birthdayDetail,
      });
    });

    await waitFor(() => {
      expect(within(content).getByRole('tab', { name: '转录' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
    expect(within(content).queryByRole('tab', { name: '补充录音' })).toBeNull();
    expect(within(content).getByRole('tabpanel', { name: '转录' })).toBeInTheDocument();
  });

  it('releases cached SegmentSupplement audio resources when an supplement disappears', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:removed-supplement');
    createObjectURL.mockClear();
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    revokeObjectURL.mockClear();
    const readFinalizedAudioSegmentSupplement = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        audio: new Uint8Array([7, 8, 9]),
        audioByteLength: 3,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([audioSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readFinalizedAudioSegmentSupplement,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_before_prune',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await userEvent.click(within(content).getByRole('tab', { name: '补充录音' }));
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledOnce();
    });

    act(() => {
      queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
        requestId: 'request_mem_birthday_supplement_after_prune',
        detail: birthdayDetail,
      });
    });

    await waitFor(() => {
      expect(within(content).getByRole('tab', { name: '转录' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:removed-supplement');
  });

  it('ignores supplement waveform pointer movement until a scrub starts on the waveform', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:supplement-audio');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const readFinalizedAudioSegmentSupplement = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        audio: new Uint8Array([7, 8, 9]),
        audioByteLength: 3,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([audioSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readFinalizedAudioSegmentSupplement,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_move_without_scrub',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await userEvent.click(within(content).getByRole('tab', { name: '补充录音' }));
    const slider = await within(content).findByRole('slider', { name: '补充录音播放进度' });
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      bottom: 42,
      height: 42,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    });

    fireEvent.pointerMove(slider, { buttons: 1, clientX: 150, pointerId: 1 });

    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(slider).toHaveAttribute('aria-valuetext', '00:00 / 00:05');
    expect(slider).toHaveAttribute('data-waveform-progress', '0');
  });

  it('keeps SegmentSupplement playback position when only its title changes', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:supplement-audio');
    createObjectURL.mockClear();
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const readFinalizedAudioSegmentSupplement = vi.fn(async (request) => ({
      ok: true,
      value: {
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        memoryId: request.memoryId,
        segmentId: request.segmentId,
        supplementId: request.supplementId,
        audio: new Uint8Array([7, 8, 9]),
        audioByteLength: 3,
      },
    }));
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const detailWithSupplement = birthdayDetailWithSupplements([audioSupplement()]);
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      readFinalizedAudioSegmentSupplement,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_supplement_title_before',
      detail: detailWithSupplement,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    await userEvent.click(within(content).getByRole('tab', { name: '补充录音' }));
    const slider = await within(content).findByRole('slider', { name: '补充录音播放进度' });
    await waitFor(() => {
      expect(slider).toHaveAttribute('tabindex', '0');
    });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(slider).toHaveAttribute('aria-valuetext', '00:05 / 00:05');
    });

    act(() => {
      queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
        requestId: 'request_mem_birthday_supplement_title_after',
        detail: birthdayDetailWithSupplements([audioSupplement({ title: '现场补充' })]),
      });
    });

    await waitFor(() => {
      expect(within(content).getByRole('tab', { name: '现场补充' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
    expect(within(content).getByRole('slider', { name: '补充录音播放进度' })).toHaveAttribute(
      'aria-valuetext',
      '00:05 / 00:05'
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('moves newly created SegmentSupplement recordings into the content tab rail when they first appear', async () => {
    const session = workspaceSession({ memories: [{ ...birthdayMemory, supplementCount: 1 }] });
    const { queryClient } = renderLoadedWorkspaceFrame({
      currentMemory: session.snapshot.memories[0] ?? null,
      session,
    });

    queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
      requestId: 'request_mem_birthday_before_supplement',
      detail: birthdayDetail,
    });

    const studio = await screen.findByRole('region', { name: 'Memory Studio' });
    const content = within(studio).getByRole('region', { name: '片段内容' });
    expect(within(content).getByRole('tab', { name: '转录' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(within(content).queryByRole('tab', { name: '补充录音' })).toBeNull();

    act(() => {
      queryClient.setQueryData(['workspace', 'memory-detail', 'ws_1', 'mem_birthday'], {
        requestId: 'request_mem_birthday_after_supplement',
        detail: birthdayDetailWithSupplements([
          audioSupplement({
            supplementId: 'sup_new_followup',
            createdAt: '2026-05-06T13:12:00.000',
            updatedAt: '2026-05-06T13:12:04.000',
            durationMs: 4_000,
            audioByteLength: 4,
          }),
        ]),
      });
    });

    await waitFor(() => {
      expect(within(content).getByRole('tab', { name: '补充录音' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
    expect(within(content).getByRole('tabpanel', { name: '补充录音' })).toBeInTheDocument();
    expect(within(content).queryByText('这段录音还没有转录。')).not.toBeInTheDocument();
    expect(await within(content).findByRole('status')).toHaveTextContent('补充录音加载失败。');
  });

  it('opens the Memory rename action from a compact card menu', async () => {
    const user = userEvent.setup();
    const copyMemoryAbsolutePath = vi.fn().mockResolvedValue({ ok: true });
    const copyMemoryRelativePath = vi.fn().mockResolvedValue({ ok: true });
    const onDeleteMemory = vi.fn();
    const onRenameMemory = vi.fn();
    const openMemoryDocument = vi.fn().mockResolvedValue({ ok: true });
    const revealMemoryInFinder = vi.fn().mockResolvedValue({ ok: true });

    renderLoadedWorkspaceFrame({
      copyMemoryAbsolutePath,
      copyMemoryRelativePath,
      onDeleteMemory,
      onRenameMemory,
      openMemoryDocument,
      revealMemoryInFinder,
      session: workspaceSession({ memories: [birthdayMemory] }),
    });

    const moreTrigger = screen.getByRole('button', { name: 'My seventh birthday 更多操作' });
    expect(moreTrigger).toHaveClass(
      'absolute',
      'right-8',
      'top-8',
      'size-24',
      'text-muted-foreground',
      'hover:bg-accent',
      'data-[state=open]:bg-accent',
      'data-[state=open]:text-accent-foreground'
    );
    expect(moreTrigger.querySelector('svg')).toHaveClass('size-[14px]');

    await user.click(moreTrigger);
    const menu = screen.getByRole('menu', { name: 'My seventh birthday 更多操作' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['用默认应用打开', '在访达中显示', '复制相对路径', '复制绝对路径', '重命名', '删除']);
    expect(within(menu).queryByText('重命名记忆')).not.toBeInTheDocument();
    expect(within(menu).queryByText('删除记忆')).not.toBeInTheDocument();

    const memoryActionPayload = {
      workspaceHandle: 'workspace-handle-secret',
      workspaceId: 'ws_1',
      memoryId: 'mem_birthday',
    };

    await user.click(within(menu).getByRole('menuitem', { name: '用默认应用打开' }));
    await waitFor(() => expect(openMemoryDocument).toHaveBeenCalledWith(memoryActionPayload));

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '在访达中显示' }));
    await waitFor(() => expect(revealMemoryInFinder).toHaveBeenCalledWith(memoryActionPayload));

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '复制相对路径' }));
    await waitFor(() => expect(copyMemoryRelativePath).toHaveBeenCalledWith(memoryActionPayload));

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '复制绝对路径' }));
    await waitFor(() => expect(copyMemoryAbsolutePath).toHaveBeenCalledWith(memoryActionPayload));

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '重命名' }));

    expect(onRenameMemory).toHaveBeenCalledWith(birthdayMemory);

    await user.click(screen.getByRole('button', { name: 'My seventh birthday 更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: '删除' }));

    expect(onDeleteMemory).toHaveBeenCalledWith(birthdayMemory);
  });

  it('can hide the right-side Memory rail without turning the workspace stage into a timeline', () => {
    renderLoadedWorkspaceFrame({
      memoryRailOpen: false,
      session: workspaceSession({
        memories: [birthdayMemory],
      }),
    });

    expect(screen.queryByRole('navigation', { name: '记忆列表' })).not.toBeInTheDocument();
    const railShell = document.querySelector('[data-slot="workspace-memory-rail-shell"]');
    const stageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    const frameBody = document.querySelector('[data-slot="workspace-frame-body"]');
    expect(railShell).toHaveAttribute('aria-hidden', 'true');
    expect(railShell).toHaveAttribute('inert');
    expect(frameBody).toHaveClass('grid-cols-[minmax(0,1fr)_0px]');
    expect(frameBody).toHaveClass(
      'transition-[grid-template-columns]',
      'duration-200',
      'ease-out',
      'motion-reduce:transition-none'
    );
    expect(railShell).toHaveClass('relative', 'col-start-2', 'row-start-1', 'w-full');
    expect(railShell).toHaveClass('opacity-0', 'pointer-events-none');
    expect(railShell).not.toHaveClass('translate-x-full');
    expect(stageShell).toHaveClass('px-24', 'sm:px-40');
    expect(document.querySelector('[data-slot="workspace-expression-fab-layer"]')).toHaveClass(
      'right-24',
      'sm:right-40'
    );
    expect(document.querySelector('[data-slot="workspace-expression-fab-track"]')).toHaveClass(
      'w-full'
    );
    expect(screen.getByRole('region', { name: '记忆空间舞台' })).toBeInTheDocument();
    expect(screen.queryByText('片段时间线')).not.toBeInTheDocument();
  });

  it('renders the Memory rail from the TanStack Query snapshot cache', async () => {
    const session = workspaceSession({
      memories: [morningMemory],
    });
    const { queryClient } = renderLoadedWorkspaceFrame({ session });

    queryClient.setQueryData(workspaceSnapshotQueryKey(session), {
      ...session.snapshot,
      memories: [birthdayMemory],
    });

    expect(
      await screen.findByRole('button', { name: '选择记忆 My seventh birthday' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '选择记忆 Morning note' })).not.toBeInTheDocument();
  });
});
