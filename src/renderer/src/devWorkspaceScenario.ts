import type { ReoWorkspaceBridge } from '../../workspace-contract/reo-workspace-bridge';
import type {
  WorkspaceFinalizedAudioSegmentContent,
  WorkspaceFinalizedAudioSegmentSupplementContent,
  WorkspaceMemoryDetail,
  WorkspaceMemorySpace,
  WorkspaceNoteSegmentContent,
  WorkspaceNoteSegmentSupplementContent,
  WorkspaceSession,
  WorkspaceSnapshot,
} from './workspace/workspaceApi';

export type DevWorkspaceScenarioName = 'memory-studio-rich';

const DEV_SCENARIO_QUERY_PARAM = 'reoScenario';
const DEV_SCENARIO_BRIDGE_MARKER = '__reoDevWorkspaceScenarioBridge';
const MEMORY_STUDIO_RICH_SCENARIO_ID = 'dev-memory-studio-rich';
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
    createDevWorkspaceScenarioBridge(createMemoryStudioRichScenario()),
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
  readonly memorySpace: WorkspaceMemorySpace;
  readonly noteContent: WorkspaceNoteSegmentContent;
  readonly session: WorkspaceSession;
  readonly supplementNoteContent: WorkspaceNoteSegmentSupplementContent;
};

function createMemoryStudioRichScenario(): MemoryStudioRichScenario {
  const audio = createVisibleWaveformWavBytes();
  const audioByteLength = audio.byteLength;
  const audioSegmentContentTabOrder: Array<'segment' | `supplement:${string}`> = [
    'segment',
    'supplement:sup_dev_followup_audio',
    'supplement:sup_dev_followup_note',
  ];
  const memory = {
    memoryId: 'mem_dev_ui_review',
    title: '浏览器调试记忆',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    segmentCount: 3,
    noteSegmentCount: 1,
    audioSegmentCount: 2,
    audioDurationMs: 202_000,
    audioByteLength: audioByteLength * 2,
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
    supplementCount: 0,
    supplements: [],
  };
  const detail: WorkspaceMemoryDetail = {
    ...memory,
    workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
    segments: [audioSegment, noteSegment],
  };
  const snapshot: WorkspaceSnapshot = {
    workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
    title: 'Reo UI 调试空间',
    description: '用于浏览器调试的开发场景',
    memories: [memory],
  };

  return {
    audio,
    audioContent: {
      requestId: '',
      workspaceId: MEMORY_STUDIO_RICH_SCENARIO_ID,
      memoryId: memory.memoryId,
      segmentId: audioSegment.segmentId,
      audio,
      audioByteLength,
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
      audio,
      audioByteLength,
      transcript: {
        exists: true,
        text: AUDIO_SUPPLEMENT_TRANSCRIPT,
        baselineHash: BASELINE_HASH,
        tiptapJson: transcriptTiptapDoc(AUDIO_SUPPLEMENT_TRANSCRIPT),
        baselineTiptapContentHash: BASELINE_TIPTAP_HASH,
      },
    },
    detail,
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
    },
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
    },
  };
}

function createDevWorkspaceScenarioBridge(scenario: MemoryStudioRichScenario): ReoWorkspaceBridge {
  const ok = <TValue>(value: TValue) => Promise.resolve({ ok: true as const, value });
  const unsupported = (message = 'Dev scenario bridge does not implement this action') =>
    Promise.resolve({
      ok: false as const,
      error: { code: 'ERR_WORKSPACE_OPEN_FAILED', message },
    });
  const entityOk = () => ok({});

  return {
    chooseDirectory: () => ok({ status: 'canceled' as const }),
    listMemorySpaces: () => ok({ memorySpaces: [scenario.memorySpace] }),
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
    openMemorySpaceAgentsFile: entityOk,
    openMemoryDocument: entityOk,
    openSegmentDocument: entityOk,
    openSegmentSupplementDocument: entityOk,
    copyMemorySpaceAbsolutePath: entityOk,
    copyMemoryAbsolutePath: entityOk,
    copySegmentAbsolutePath: entityOk,
    copySegmentSupplementAbsolutePath: entityOk,
    copyMemoryRelativePath: entityOk,
    copySegmentRelativePath: entityOk,
    copySegmentSupplementRelativePath: entityOk,
    updateMemorySpaceTitle: () => ok(scenario.session.snapshot),
    closeWorkspace: () => ok({ closed: true }),
    readWorkspaceSnapshot: () => ok(scenario.session.snapshot),
    createMemory: () => unsupported(),
    deleteMemory: () => unsupported(),
    restoreDeletedMemory: () => unsupported(),
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
    createRecordingDraft: () => unsupported(),
    createSegmentSupplementRecordingDraft: () => unsupported(),
    createNoteSegmentDraft: () => unsupported(),
    createSegmentSupplementNoteDraft: () => unsupported(),
    writeNoteSegmentDraftBody: () => unsupported(),
    writeSegmentSupplementNoteDraftBody: () => unsupported(),
    finalizeNoteSegmentDraft: () => unsupported(),
    finalizeSegmentSupplementNoteDraft: () => unsupported(),
    readSegmentContent: (payload: Parameters<ReoWorkspaceBridge['readSegmentContent']>[0]) =>
      ok({ ...scenario.noteContent, requestId: payload.requestId }),
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
    beginMicrophoneIntent: () => ok({ accepted: true }),
    clearMicrophoneIntent: () => ok({ cleared: true }),
    startRecordingTranscription: () =>
      ok({ accepted: true, transcriptionMode: 'disabled' as const }),
    sendRecordingTranscriptionAudio: () => ok({ accepted: true }),
    finishRecordingTranscription: () => ok({ accepted: true }),
    closeRecordingTranscription: () => ok({ accepted: true }),
    readVoiceTranscriptionSettings: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        },
      }),
    setVoiceTranscriptionEnabled: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        },
      }),
    saveVoiceTranscriptionApiKey: () => unsupported(),
    clearVoiceTranscriptionApiKey: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        },
      }),
    validateVoiceTranscriptionCredentials: () =>
      ok({
        settings: {
          enabled: false,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        },
      }),
    openVoiceTranscriptionProviderConsole: entityOk,
    openMarkdownExternalLink: entityOk,
    onRecordingTranscriptionEvent: () => () => {},
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
