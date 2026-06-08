import type { ReoWorkspaceBridge } from '../../workspace-contract/reo-workspace-bridge';
import type {
  WorkspaceFinalizedAudioSegmentContent,
  WorkspaceFinalizedAudioSegmentSupplementContent,
  WorkspaceMemoryDetail,
  WorkspaceMemorySpace,
  WorkspaceNoteSegmentContent,
  WorkspaceNoteSegmentSupplementContent,
  WorkspaceRecentExpressionItem,
  WorkspaceSession,
  WorkspaceSnapshot,
  WorkspaceSystemDraftProjection,
} from './workspace/workspaceApi';

export type DevWorkspaceScenarioName = 'memory-studio-rich';

const DEV_SCENARIO_QUERY_PARAM = 'reoScenario';
const DEV_SCENARIO_SEGMENT_COUNT_QUERY_PARAM = 'reoSegmentCount';
const DEV_SCENARIO_BRIDGE_MARKER = '__reoDevWorkspaceScenarioBridge';
const MEMORY_STUDIO_RICH_SCENARIO_ID = 'dev-memory-studio-rich';
const MEMORY_STUDIO_RICH_BASE_SEGMENT_COUNT = 2;
const MEMORY_STUDIO_RICH_MAX_SEGMENT_COUNT = 300;
const BASELINE_HASH = 'd'.repeat(64);
const BASELINE_TIPTAP_HASH = 'e'.repeat(64);
const CREATED_AT = '2026-05-24T09:00:00.000Z';
const UPDATED_AT = '2026-05-24T09:18:00.000Z';
const AUDIO_TRANSCRIPT =
  '这是一段用于浏览器调试的真实状态转录。它覆盖长文本、内容 tab、补充内容和 inline editor，让界面审查不再停留在空态。';
const AUDIO_SUPPLEMENT_TRANSCRIPT =
  '补充录音记录了第二轮观察：右侧列表、片段卡片和正文编辑区需要一起出现在调试画面里。';
const NOTE_BODY =
  '## 页面观察\n\n这条笔记用于验证 note segment 的正文状态。浏览器调试场景需要同时覆盖录音、笔记、补充录音和补充笔记。';
const SUPPLEMENT_NOTE_BODY = '补充笔记用于验证内容 tab 切换、长标题截断和正文编辑 surface。';
const MISSING_SPEECH_SYNTHESIS = {
  status: 'missing' as const,
  audioByteLength: null,
  contentHash: null,
  format: null,
  lastSynthesisAttempt: 'never' as const,
  mimeType: null,
  model: null,
  reason: null,
  resourceId: null,
  sampleRate: null,
  speaker: null,
  updatedAt: null,
};

let installedDevWorkspaceScenario: DevWorkspaceScenarioName | null = null;

function transcriptTiptapDoc(text: string) {
  return {
    type: 'doc',
    content:
      text.length > 0
        ? [
            {
              type: 'paragraph',
              content: [{ type: 'text', text }],
            },
          ]
        : [],
  };
}

type DevWorkspaceScenarioBridge = ReoWorkspaceBridge & {
  readonly [DEV_SCENARIO_BRIDGE_MARKER]?: DevWorkspaceScenarioName;
};

export function readDevWorkspaceScenarioName(
  search = typeof window === 'undefined' ? '' : window.location.search
): DevWorkspaceScenarioName | null {
  const scenario = new URLSearchParams(search).get(DEV_SCENARIO_QUERY_PARAM);
  return scenario === 'memory-studio-rich' ? scenario : null;
}

export function readDevWorkspaceScenarioSegmentCount(
  search = typeof window === 'undefined' ? '' : window.location.search
): number {
  const value = new URLSearchParams(search).get(DEV_SCENARIO_SEGMENT_COUNT_QUERY_PARAM);
  if (!value) {
    return MEMORY_STUDIO_RICH_BASE_SEGMENT_COUNT;
  }

  const count = Number(value);
  if (!Number.isInteger(count)) {
    return MEMORY_STUDIO_RICH_BASE_SEGMENT_COUNT;
  }

  return Math.min(
    MEMORY_STUDIO_RICH_MAX_SEGMENT_COUNT,
    Math.max(MEMORY_STUDIO_RICH_BASE_SEGMENT_COUNT, count)
  );
}

export function readAutoOpenDevWorkspaceScenarioName(): DevWorkspaceScenarioName | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const scenarioName = readDevWorkspaceScenarioName();
  if (!scenarioName) {
    return null;
  }

  if (import.meta.env.MODE === 'test') {
    return scenarioName;
  }

  return installedDevWorkspaceScenario === scenarioName ||
    devWorkspaceScenarioBridgeMatches(scenarioName)
    ? scenarioName
    : null;
}

export function devWorkspaceScenarioMemorySpaceId(scenarioName: DevWorkspaceScenarioName): string {
  return scenarioName === 'memory-studio-rich' ? MEMORY_STUDIO_RICH_SCENARIO_ID : scenarioName;
}

export function installDevWorkspaceScenarioBridge(): DevWorkspaceScenarioName | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null;
  }

  const scenarioName = readDevWorkspaceScenarioName();
  if (!scenarioName) {
    return null;
  }

  if ('reoWorkspace' in window && window.reoWorkspace) {
    if (devWorkspaceScenarioBridgeMatches(scenarioName)) {
      installedDevWorkspaceScenario = scenarioName;
      return scenarioName;
    }

    return null;
  }

  const bridge = markDevWorkspaceScenarioBridge(
    createDevWorkspaceScenarioBridge(
      createMemoryStudioRichScenario(readDevWorkspaceScenarioSegmentCount())
    ),
    scenarioName
  );
  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge,
  });
  installedDevWorkspaceScenario = scenarioName;
  return scenarioName;
}

function devWorkspaceScenarioBridgeMatches(scenarioName: DevWorkspaceScenarioName): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    ((window as Partial<Window>).reoWorkspace as DevWorkspaceScenarioBridge | undefined)?.[
      DEV_SCENARIO_BRIDGE_MARKER
    ] === scenarioName
  );
}

function markDevWorkspaceScenarioBridge(
  bridge: ReoWorkspaceBridge,
  scenarioName: DevWorkspaceScenarioName
): DevWorkspaceScenarioBridge {
  Object.defineProperty(bridge, DEV_SCENARIO_BRIDGE_MARKER, {
    value: scenarioName,
  });
  return bridge as DevWorkspaceScenarioBridge;
}

type MemoryStudioRichScenario = {
  readonly audio: Uint8Array;
  readonly audioContent: WorkspaceFinalizedAudioSegmentContent;
  readonly audioSupplementContent: WorkspaceFinalizedAudioSegmentSupplementContent;
  readonly detail: WorkspaceMemoryDetail;
  readonly draft: WorkspaceSystemDraftProjection;
  readonly memorySpace: WorkspaceMemorySpace;
  readonly noteContent: WorkspaceNoteSegmentContent;
  readonly recentExpressions: readonly WorkspaceRecentExpressionItem[];
  readonly session: WorkspaceSession;
  readonly supplementNoteContent: WorkspaceNoteSegmentSupplementContent;
};

function createMemoryStudioRichScenario(segmentCount: number): MemoryStudioRichScenario {
  const audio = createVisibleWaveformWavBytes();
  const audioByteLength = audio.byteLength;
  const audioSegmentContentTabOrder: Array<'segment' | `supplement:${string}`> = [
    'segment',
    'supplement:sup_dev_followup_audio',
    'supplement:sup_dev_followup_note',
  ];
  const safeSegmentCount = Math.min(
    MEMORY_STUDIO_RICH_MAX_SEGMENT_COUNT,
    Math.max(MEMORY_STUDIO_RICH_BASE_SEGMENT_COUNT, segmentCount)
  );
  const memory = {
    memoryId: 'mem_dev_ui_review',
    title: '浏览器调试记忆',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    segmentCount: safeSegmentCount,
    noteSegmentCount: safeSegmentCount - 1,
    artifactSegmentCount: 0,
    audioSegmentCount: 1,
    audioDurationMs: 82_000,
    audioByteLength,
    hasAudioTranscript: true,
    hasAnyNote: true,
    supplementCount: 2,
  };
  const audioSegment = {
    workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
    memoryId: memory.memoryId,
    segmentId: 'seg_dev_interview',
    type: 'audio' as const,
    title: '访谈录音',
    contentTitle: '现场转录',
    createdAt: '2026-05-24T09:04:00.000Z',
    updatedAt: UPDATED_AT,
    durationMs: 82_000,
    audioByteLength,
    lastTranscriptionAttempt: 'success' as const,
    transcript: { exists: true },
    supplementCount: 2,
    supplements: [
      {
        workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
        memoryId: memory.memoryId,
        segmentId: 'seg_dev_interview',
        supplementId: 'sup_dev_followup_audio',
        type: 'audio' as const,
        title: '第二轮追问录音',
        createdAt: '2026-05-24T09:12:00.000Z',
        updatedAt: '2026-05-24T09:13:00.000Z',
        durationMs: 38_000,
        audioByteLength,
        lastTranscriptionAttempt: 'success' as const,
        transcript: { exists: true },
      },
      {
        workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
        memoryId: memory.memoryId,
        segmentId: 'seg_dev_interview',
        supplementId: 'sup_dev_followup_note',
        type: 'note' as const,
        title: '补充笔记：界面审查重点',
        createdAt: '2026-05-24T09:14:00.000Z',
        updatedAt: '2026-05-24T09:15:00.000Z',
        bodyByteLength: byteLength(SUPPLEMENT_NOTE_BODY),
      },
    ],
    contentTabOrder: audioSegmentContentTabOrder,
  };
  const noteSegment = {
    workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
    memoryId: memory.memoryId,
    segmentId: 'seg_dev_note',
    type: 'note' as const,
    title: '视觉审查笔记',
    contentTitle: '正文',
    createdAt: '2026-05-24T09:16:00.000Z',
    updatedAt: '2026-05-24T09:17:00.000Z',
    bodyByteLength: byteLength(NOTE_BODY),
    speechSynthesis: MISSING_SPEECH_SYNTHESIS,
    supplementCount: 0,
    supplements: [],
  };
  const generatedNoteSegments = Array.from(
    { length: safeSegmentCount - MEMORY_STUDIO_RICH_BASE_SEGMENT_COUNT },
    (_, index) => createGeneratedNoteSegment(index + MEMORY_STUDIO_RICH_BASE_SEGMENT_COUNT, memory)
  );
  const detail: WorkspaceMemoryDetail = {
    ...memory,
    workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
    segments: [audioSegment, noteSegment, ...generatedNoteSegments],
  };
  const workspaceWidget = {
    workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
    widgetId: 'wdg_dev_overview',
    type: 'widget' as const,
    format: 'html' as const,
    mount: 'workspace-rail' as const,
    title: 'Workspace 总览',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    icon: { source: 'default' as const },
    runtimeFault: {
      reason: 'missing-entry' as const,
      diagnostic: 'Dev scenario 使用故障态 Widget 验证右侧 rail 挂载和操作面。',
    },
  };
  const snapshot: WorkspaceSnapshot = {
    workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
    title: 'Reo UI 调试空间',
    description: '用于浏览器调试的开发场景',
    memories: [memory],
    widgets: [workspaceWidget],
  };
  const recentExpressions: readonly WorkspaceRecentExpressionItem[] = [
    {
      id: `${MEMORY_STUDIO_RICH_SCENARIO_ID}:${memory.memoryId}:${noteSegment.segmentId}`,
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      workspaceTitle: snapshot.title,
      memoryId: memory.memoryId,
      memoryTitle: memory.title,
      segmentId: noteSegment.segmentId,
      objectType: 'segment',
      contentKind: 'note',
      title: noteSegment.contentTitle,
      preview: '页面观察这条笔记用于验证 note segment',
      cover: { source: 'default' },
      createdAt: noteSegment.createdAt,
      updatedAt: noteSegment.updatedAt,
    },
    {
      id: `${MEMORY_STUDIO_RICH_SCENARIO_ID}:${memory.memoryId}:${audioSegment.segmentId}:sup_dev_followup_note`,
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      workspaceTitle: snapshot.title,
      memoryId: memory.memoryId,
      memoryTitle: memory.title,
      segmentId: audioSegment.segmentId,
      supplementId: 'sup_dev_followup_note',
      objectType: 'supplement',
      contentKind: 'note',
      title: '补充笔记：界面审查重点',
      preview: '补充笔记用于验证内容 tab 切换',
      cover: { source: 'default' },
      createdAt: '2026-05-24T09:14:00.000Z',
      updatedAt: '2026-05-24T09:15:00.000Z',
    },
    {
      id: `${MEMORY_STUDIO_RICH_SCENARIO_ID}:${memory.memoryId}:${audioSegment.segmentId}:sup_dev_followup_audio`,
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      workspaceTitle: snapshot.title,
      memoryId: memory.memoryId,
      memoryTitle: memory.title,
      segmentId: audioSegment.segmentId,
      supplementId: 'sup_dev_followup_audio',
      objectType: 'supplement',
      contentKind: 'audio',
      title: '第二轮追问录音',
      preview: '补充录音记录了第二轮观察',
      cover: { source: 'default' },
      createdAt: '2026-05-24T09:12:00.000Z',
      updatedAt: '2026-05-24T09:13:00.000Z',
    },
    {
      id: `${MEMORY_STUDIO_RICH_SCENARIO_ID}:${memory.memoryId}:${audioSegment.segmentId}`,
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      workspaceTitle: snapshot.title,
      memoryId: memory.memoryId,
      memoryTitle: memory.title,
      segmentId: audioSegment.segmentId,
      objectType: 'segment',
      contentKind: 'audio',
      title: audioSegment.contentTitle,
      preview: '这是一段用于浏览器调试的真实状态转录',
      cover: { source: 'default' },
      createdAt: audioSegment.createdAt,
      updatedAt: audioSegment.updatedAt,
    },
  ];

  return {
    audio,
    audioContent: {
      requestId: '',
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      memoryId: memory.memoryId,
      segmentId: audioSegment.segmentId,
      audioByteLength,
      audioHash: BASELINE_HASH,
      transcript: {
        exists: true,
        text: AUDIO_TRANSCRIPT,
        baselineHash: BASELINE_HASH,
        tiptapJson: transcriptTiptapDoc(AUDIO_TRANSCRIPT),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH,
      },
    },
    audioSupplementContent: {
      requestId: '',
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      memoryId: memory.memoryId,
      segmentId: audioSegment.segmentId,
      supplementId: 'sup_dev_followup_audio',
      audioByteLength,
      audioHash: BASELINE_HASH,
      transcript: {
        exists: true,
        text: AUDIO_SUPPLEMENT_TRANSCRIPT,
        baselineHash: BASELINE_HASH,
        tiptapJson: transcriptTiptapDoc(AUDIO_SUPPLEMENT_TRANSCRIPT),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH,
      },
    },
    detail,
    draft: {
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      title: '草稿',
      systemRole: 'draft-space',
      defaultMemoryId: memory.memoryId,
      capabilities: {
        canCreateMemory: true,
        canRemove: false,
        canRename: false,
      },
    },
    memorySpace: {
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      title: snapshot.title,
      description: snapshot.description,
      addedAt: CREATED_AT,
      lastOpenedAt: UPDATED_AT,
    },
    noteContent: {
      requestId: '',
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      memoryId: memory.memoryId,
      segmentId: noteSegment.segmentId,
      type: 'note',
      title: noteSegment.contentTitle,
      bodyMarkdown: NOTE_BODY,
      bodyTiptapJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      bodyByteLength: byteLength(NOTE_BODY),
      baselineContentHash: BASELINE_HASH,
      baselineTiptapContentHash: BASELINE_TIPTAP_HASH,
      speechSynthesis: MISSING_SPEECH_SYNTHESIS,
    },
    recentExpressions,
    session: {
      workspaceHandle: 'dev-scenario-workspace-handle',
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      snapshot,
    },
    supplementNoteContent: {
      requestId: '',
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      memoryId: memory.memoryId,
      segmentId: audioSegment.segmentId,
      supplementId: 'sup_dev_followup_note',
      type: 'note',
      title: '补充笔记：界面审查重点',
      bodyMarkdown: SUPPLEMENT_NOTE_BODY,
      bodyTiptapJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      bodyByteLength: byteLength(SUPPLEMENT_NOTE_BODY),
      baselineContentHash: BASELINE_HASH,
      baselineTiptapContentHash: BASELINE_TIPTAP_HASH,
      speechSynthesis: MISSING_SPEECH_SYNTHESIS,
    },
  };
}

function createGeneratedNoteSegment(index: number, memory: { readonly memoryId: string }) {
  const minute = String(index % 60).padStart(2, '0');
  const title = `压力测试笔记 ${index}`;

  return {
    workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
    memoryId: memory.memoryId,
    segmentId: `seg_dev_note_${index}`,
    type: 'note' as const,
    title,
    contentTitle: '正文',
    createdAt: `2026-05-24T10:${minute}:00.000Z`,
    updatedAt: `2026-05-24T10:${minute}:30.000Z`,
    bodyByteLength: byteLength(`${NOTE_BODY}\n\n${title}`),
    speechSynthesis: MISSING_SPEECH_SYNTHESIS,
    supplementCount: 0,
    supplements: [],
  } satisfies WorkspaceMemoryDetail['segments'][number];
}

function createDevWorkspaceScenarioBridge(scenario: MemoryStudioRichScenario): ReoWorkspaceBridge {
  const ok = <TValue>(value: TValue) => Promise.resolve({ ok: true as const, value });
  const unsupported = (message = 'Dev scenario bridge does not implement this action') =>
    Promise.resolve({
      ok: false as const,
      error: { code: 'ERR_WORKSPACE_OPEN_FAILED', message },
    });
  const entityOk = () => ok({});
  const widgets = () => scenario.session.snapshot.widgets ?? [];
  const firstWidget = () => widgets()[0];

  return {
    chooseDirectory: () => ok({ status: 'canceled' as const }),
    listMemorySpaces: () => ok({ memorySpaces: [scenario.memorySpace] }),
    readSystemDraftWorkspace: () => ok({ draft: scenario.draft }),
    openSystemDraftWorkspace: () =>
      ok({
        ...scenario.session,
        defaultMemoryId: scenario.draft.defaultMemoryId,
        draft: scenario.draft,
      }),
    readRecentExpressions: (payload: Parameters<ReoWorkspaceBridge['readRecentExpressions']>[0]) =>
      ok({
        items: scenario.recentExpressions.slice(
          0,
          payload.limit ?? scenario.recentExpressions.length
        ),
        skipped: [],
      }),
    initializeWorkspace: () => ok(scenario.session),
    openWorkspace: () => ok(scenario.session),
    openMemorySpace: (payload: Parameters<ReoWorkspaceBridge['openMemorySpace']>[0]) =>
      payload.workspaceId === MEMORY_STUDIO_RICH_SCENARIO_ID
        ? ok(scenario.session)
        : unsupported('Unknown dev scenario workspace'),
    removeMemorySpace: () => ok({ removed: true }),
    revealMemorySpaceInFinder: entityOk,
    revealMemoryInFinder: entityOk,
    revealSegmentInFinder: entityOk,
    revealSegmentSupplementInFinder: entityOk,
    revealWidgetInFinder: entityOk,
    openMemorySpaceAgentsFile: entityOk,
    openMemoryDocument: entityOk,
    openSegmentDocument: entityOk,
    openSegmentSupplementDocument: entityOk,
    openWidgetDocument: entityOk,
    copyMemorySpaceAbsolutePath: entityOk,
    copyMemoryAbsolutePath: entityOk,
    copySegmentAbsolutePath: entityOk,
    copySegmentSupplementAbsolutePath: entityOk,
    copyWidgetAbsolutePath: entityOk,
    copyMemoryRelativePath: entityOk,
    copySegmentRelativePath: entityOk,
    copySegmentSupplementRelativePath: entityOk,
    copyWidgetRelativePath: entityOk,
    copyArtifactAgentPrompt: entityOk,
    copyWidgetAgentPrompt: entityOk,
    copyNeedsReviewAgentPrompt: entityOk,
    readArtifactRuntimeState: (
      payload: Parameters<ReoWorkspaceBridge['readArtifactRuntimeState']>[0]
    ) =>
      ok({
        requestId: payload.requestId,
        source: 'missing' as const,
        state: { schemaVersion: 1, stores: {} },
        version: BASELINE_HASH,
      }),
    writeArtifactRuntimeState: (
      payload: Parameters<ReoWorkspaceBridge['writeArtifactRuntimeState']>[0]
    ) =>
      ok({
        status: 'saved' as const,
        requestId: payload.requestId,
        state: payload.state,
        version: BASELINE_HASH,
      }),
    updateMemorySpaceTitle: () => ok(scenario.session.snapshot),
    closeWorkspace: () => ok({ closed: true }),
    readWorkspaceSnapshot: () => ok(scenario.session.snapshot),
    createMemory: () => unsupported(),
    deleteMemory: () => unsupported(),
    restoreDeletedMemory: () => unsupported(),
    deleteWidget: () => unsupported(),
    restoreDeletedWidget: () => unsupported(),
    resetMemoryCover: () => unsupported(),
    restoreMemoryCover: () => unsupported(),
    switchMemoryDefaultCover: () => unsupported(),
    resetSegmentCover: () => unsupported(),
    restoreSegmentCover: () => unsupported(),
    switchSegmentDefaultCover: () => unsupported(),
    deleteSegment: () => unsupported(),
    restoreDeletedSegment: () => unsupported(),
    deleteSegmentSupplement: () => unsupported(),
    restoreDeletedSegmentSupplement: () => unsupported(),
    readMemoryDetail: (payload: Parameters<ReoWorkspaceBridge['readMemoryDetail']>[0]) =>
      ok({ requestId: payload.requestId, detail: scenario.detail }),
    readFinalizedAudioSegment: (
      payload: Parameters<ReoWorkspaceBridge['readFinalizedAudioSegment']>[0]
    ) => ok({ ...scenario.audioContent, requestId: payload.requestId }),
    readFinalizedAudioSegmentSupplement: (
      payload: Parameters<ReoWorkspaceBridge['readFinalizedAudioSegmentSupplement']>[0]
    ) => ok({ ...scenario.audioSupplementContent, requestId: payload.requestId }),
    readFinalizedAudioSegmentAudio: (
      payload: Parameters<ReoWorkspaceBridge['readFinalizedAudioSegmentAudio']>[0]
    ) =>
      ok({
        requestId: payload.requestId,
        workspaceId: payload.workspaceId,
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        audio: scenario.audio,
        audioByteLength: payload.audioByteLength,
        audioHash: BASELINE_HASH,
      }),
    readFinalizedAudioSegmentSupplementAudio: (
      payload: Parameters<ReoWorkspaceBridge['readFinalizedAudioSegmentSupplementAudio']>[0]
    ) =>
      ok({
        requestId: payload.requestId,
        workspaceId: payload.workspaceId,
        memoryId: payload.memoryId,
        segmentId: payload.segmentId,
        supplementId: payload.supplementId,
        audio: scenario.audio,
        audioByteLength: payload.audioByteLength,
        audioHash: BASELINE_HASH,
      }),
    createRecordingDraft: () => unsupported(),
    createSegmentSupplementRecordingDraft: () => unsupported(),
    createNoteSegmentDraft: () => unsupported(),
    createSegmentSupplementNoteDraft: () => unsupported(),
    writeNoteSegmentDraftBody: () => unsupported(),
    writeSegmentSupplementNoteDraftBody: () => unsupported(),
    finalizeNoteSegmentDraft: () => unsupported(),
    finalizeSegmentSupplementNoteDraft: () => unsupported(),
    readSegmentContent: (payload: Parameters<ReoWorkspaceBridge['readSegmentContent']>[0]) => {
      const segment = scenario.detail.segments.find(
        (candidate) => candidate.type === 'note' && candidate.segmentId === payload.segmentId
      );
      const bodyMarkdown =
        segment && segment.segmentId !== scenario.noteContent.segmentId
          ? `${NOTE_BODY}\n\n${segment.title}`
          : scenario.noteContent.bodyMarkdown;

      return ok({
        ...scenario.noteContent,
        requestId: payload.requestId,
        segmentId: payload.segmentId,
        title: segment?.contentTitle ?? scenario.noteContent.title,
        bodyMarkdown,
        bodyByteLength: byteLength(bodyMarkdown),
      });
    },
    readSegmentSupplementContent: (
      payload: Parameters<ReoWorkspaceBridge['readSegmentSupplementContent']>[0]
    ) => ok({ ...scenario.supplementNoteContent, requestId: payload.requestId }),
    writeSegmentContent: (payload: Parameters<ReoWorkspaceBridge['writeSegmentContent']>[0]) =>
      ok({
        baselineContentHash: BASELINE_HASH,
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH,
        bodyByteLength: byteLength(payload.bodyMarkdown),
        saved: true as const,
      }),
    writeSegmentSupplementContent: (
      payload: Parameters<ReoWorkspaceBridge['writeSegmentSupplementContent']>[0]
    ) =>
      ok({
        baselineContentHash: BASELINE_HASH,
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH,
        bodyByteLength: byteLength(payload.bodyMarkdown),
        saved: true as const,
      }),
    saveSegmentAttachment: () => unsupported(),
    listSegmentAttachments: () => ok({ attachments: [] }),
    saveSegmentSupplementAttachment: () => unsupported(),
    listSegmentSupplementAttachments: () => ok({ attachments: [] }),
    readRecordingDraftAudio: () => unsupported(),
    appendRecordingAudioChunk: () => ok({ nextSequence: 1 }),
    appendSegmentSupplementRecordingAudioChunk: () => ok({ nextSequence: 1 }),
    cloneRecordingDraftPrefix: () => ok({ cloned: true }),
    finalizeRecordingDraft: () => unsupported(),
    finalizeSegmentSupplementRecordingDraft: () => unsupported(),
    discardRecordingDraft: () => ok({ discarded: true }),
    discardSegmentSupplementRecordingDraft: () => ok({ discarded: true }),
    updateMemoryTitle: () => ok(scenario.detail),
    updateSegmentTitle: () => ok({ memory: scenario.detail, segment: scenario.detail.segments[0] }),
    updateSegmentContentTitle: () =>
      ok({ memory: scenario.detail, segment: scenario.detail.segments[0] }),
    updateSegmentSupplementTitle: () =>
      ok({ memory: scenario.detail, segment: scenario.detail.segments[0] }),
    updateSegmentContentTabOrder: () =>
      ok({ memory: scenario.detail, segment: scenario.detail.segments[0] }),
    updateWidgetTitle: () => ok({ widget: firstWidget(), widgets: widgets() }),
    updateWidgetTabOrder: () => ok({ widgets: widgets() }),
    saveTranscript: () =>
      ok({
        baselineTranscriptHash: BASELINE_HASH,
        memory: scenario.detail,
        saved: true as const,
      }),
    saveSegmentSupplementTranscript: () =>
      ok({
        baselineTranscriptHash: BASELINE_HASH,
        memory: scenario.detail,
        segment: scenario.detail.segments[0],
        supplement: scenario.detail.segments[0]?.supplements[0],
        saved: true as const,
      }),
    requestSegmentTranscriptionBackfill: () =>
      ok({ memory: scenario.detail, segment: scenario.detail.segments[0] }),
    requestSegmentSupplementTranscriptionBackfill: () =>
      ok({
        memory: scenario.detail,
        segment: scenario.detail.segments[0],
        supplement: scenario.detail.segments[0]?.supplements[0],
      }),
    requestSegmentSpeechSynthesis: () =>
      ok({
        speechSynthesis: {
          status: 'missing' as const,
          audioByteLength: null,
          contentHash: null,
          format: null,
          lastSynthesisAttempt: 'never' as const,
          mimeType: null,
          model: null,
          reason: null,
          resourceId: null,
          sampleRate: null,
          speaker: null,
          updatedAt: null,
        },
      }),
    requestSegmentSupplementSpeechSynthesis: () =>
      ok({
        speechSynthesis: {
          status: 'missing' as const,
          audioByteLength: null,
          contentHash: null,
          format: null,
          lastSynthesisAttempt: 'never' as const,
          mimeType: null,
          model: null,
          reason: null,
          resourceId: null,
          sampleRate: null,
          speaker: null,
          updatedAt: null,
        },
      }),
    beginMicrophoneIntent: () => ok({ accepted: true }),
    clearMicrophoneIntent: () => ok({ cleared: true }),
    startRecordingTranscription: () =>
      ok({ accepted: true, transcriptionMode: 'disabled' as const }),
    sendRecordingTranscriptionAudio: () => ok({ accepted: true }),
    finishRecordingTranscription: () => ok({ accepted: true }),
    closeRecordingTranscription: () => ok({ accepted: true }),
    readAppPermissionStatus: () =>
      ok({
        permissions: {
          microphone: { status: 'granted' as const },
          camera: { status: 'not-determined' as const },
          accessibility: { status: 'not-determined' as const },
        },
      }),
    requestAppPermission: (payload: Parameters<ReoWorkspaceBridge['requestAppPermission']>[0]) =>
      ok({
        permission: payload.permission,
        restartRequired: false,
        status: 'granted' as const,
      }),
    readVoiceTranscriptionSettings: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts',
          lastTranscriptionValidatedAt: null,
          lastTranscriptionValidationOk: null,
          lastTranscriptionValidationCode: null,
          lastSpeechSynthesisValidatedAt: null,
          lastSpeechSynthesisValidationOk: null,
          lastSpeechSynthesisValidationCode: null,
        },
      }),
    setVoiceTranscriptionEnabled: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts',
          lastTranscriptionValidatedAt: null,
          lastTranscriptionValidationOk: null,
          lastTranscriptionValidationCode: null,
          lastSpeechSynthesisValidatedAt: null,
          lastSpeechSynthesisValidationOk: null,
          lastSpeechSynthesisValidationCode: null,
        },
      }),
    setVoiceSpeechSynthesisSpeaker: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts',
          lastTranscriptionValidatedAt: null,
          lastTranscriptionValidationOk: null,
          lastTranscriptionValidationCode: null,
          lastSpeechSynthesisValidatedAt: null,
          lastSpeechSynthesisValidationOk: null,
          lastSpeechSynthesisValidationCode: null,
        },
      }),
    saveVoiceTranscriptionApiKey: () => unsupported(),
    clearVoiceTranscriptionApiKey: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts',
          lastTranscriptionValidatedAt: null,
          lastTranscriptionValidationOk: null,
          lastTranscriptionValidationCode: null,
          lastSpeechSynthesisValidatedAt: null,
          lastSpeechSynthesisValidationOk: null,
          lastSpeechSynthesisValidationCode: null,
        },
      }),
    validateVoiceTranscriptionCredentials: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts',
          lastTranscriptionValidatedAt: null,
          lastTranscriptionValidationOk: null,
          lastTranscriptionValidationCode: null,
          lastSpeechSynthesisValidatedAt: null,
          lastSpeechSynthesisValidationOk: null,
          lastSpeechSynthesisValidationCode: null,
        },
      }),
    openVoiceTranscriptionProviderConsole: entityOk,
    openMarkdownExternalLink: entityOk,
    onRecordingTranscriptionEvent: () => () => {},
    onFileTruthChanged: () => () => {},
  } as unknown as ReoWorkspaceBridge;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function createVisibleWaveformWavBytes() {
  const sampleRate = 8000;
  const seconds = 1;
  const sampleCount = sampleRate * seconds;
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const timeSeconds = sampleIndex / sampleRate;
    const envelope = 0.28 + 0.68 * ((Math.sin(Math.PI * 2 * 3 * timeSeconds) + 1) / 2);
    const sample = Math.round(Math.sin(Math.PI * 2 * 220 * timeSeconds) * envelope * 28_000);
    view.setInt16(44 + sampleIndex * 2, sample, true);
  }

  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
