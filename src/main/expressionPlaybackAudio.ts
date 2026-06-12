import {
  readFinalizedSegmentAudioProjection,
  readFinalizedSegmentProjection,
  readFinalizedSegmentSupplementAudioProjection,
  readFinalizedSegmentSupplementProjection,
} from './memoryFiles.js';
import {
  readFinalizedNoteSegmentSpeechAudio,
  readFinalizedNoteSegmentSupplementSpeechAudio,
} from './noteDrafts.js';
import {
  readFinalizedAudioSegmentAudio,
  readFinalizedAudioSegmentSupplementAudio,
} from './recordingDrafts.js';
import {
  workspaceError,
  type VoiceSpeechSynthesisSpeaker,
  type WorkspaceErrorEnvelope,
  type WorkspaceReadExpressionPlaybackAudioRequest,
} from '../workspace-contract/workspace-contract.js';

type ExpressionPlaybackAudioSuccess = {
  readonly ok: true;
  readonly audio: Uint8Array;
  readonly mimeType: 'audio/webm' | 'audio/mpeg';
};

export type ExpressionPlaybackAudioResult = ExpressionPlaybackAudioSuccess | WorkspaceErrorEnvelope;

type SegmentAudioProjectionReader = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}) => Promise<{
  readonly audioByteLength: number;
  readonly audioHash: string | null;
}>;

type SupplementAudioProjectionReader = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
}) => Promise<{
  readonly audioByteLength: number;
  readonly audioHash: string | null;
}>;

type SegmentProjectionReader = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}) => Promise<{
  readonly type: string;
  readonly speechSynthesis?: {
    readonly status: string;
    readonly audioByteLength: number | null;
    readonly contentHash: string | null;
    readonly speaker: VoiceSpeechSynthesisSpeaker | null;
    readonly updatedAt: string | null;
  };
}>;

type SupplementProjectionReader = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
}) => Promise<{
  readonly type: string;
  readonly speechSynthesis?: {
    readonly status: string;
    readonly audioByteLength: number | null;
    readonly contentHash: string | null;
    readonly speaker: VoiceSpeechSynthesisSpeaker | null;
    readonly updatedAt: string | null;
  };
}>;

type SegmentAudioReader = (input: {
  readonly rootPath: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly expectedAudioByteLength: number;
  readonly expectedAudioHash?: string | null;
}) => Promise<
  | {
      readonly ok: true;
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly audioHash: string;
    }
  | WorkspaceErrorEnvelope
>;

type SupplementAudioReader = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly expectedAudioByteLength: number;
  readonly expectedAudioHash?: string | null;
}) => Promise<
  | {
      readonly ok: true;
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly audioHash: string;
    }
  | WorkspaceErrorEnvelope
>;

type NoteSpeechReader = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly contentHash: string;
  readonly audioByteLength: number;
  readonly speaker: VoiceSpeechSynthesisSpeaker;
  readonly updatedAt: string;
}) => Promise<
  | {
      readonly ok: true;
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly contentHash: string;
      readonly mimeType: 'audio/mpeg';
    }
  | WorkspaceErrorEnvelope
>;

type NoteSupplementSpeechReader = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly contentHash: string;
  readonly audioByteLength: number;
  readonly speaker: VoiceSpeechSynthesisSpeaker;
  readonly updatedAt: string;
}) => Promise<
  | {
      readonly ok: true;
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly contentHash: string;
      readonly mimeType: 'audio/mpeg';
    }
  | WorkspaceErrorEnvelope
>;

export async function resolveExpressionPlaybackAudio({
  readNoteSpeech = readFinalizedNoteSegmentSpeechAudio,
  readNoteSupplementSpeech = readFinalizedNoteSegmentSupplementSpeechAudio,
  readSegmentAudio = readFinalizedAudioSegmentAudio,
  readSegmentAudioProjection = readFinalizedSegmentAudioProjection,
  readSegmentProjection = readFinalizedSegmentProjection,
  readSupplementAudio = readFinalizedAudioSegmentSupplementAudio,
  readSupplementAudioProjection = readFinalizedSegmentSupplementAudioProjection,
  readSupplementProjection = readFinalizedSegmentSupplementProjection,
  request,
  rootPath,
}: {
  readonly readNoteSpeech?: NoteSpeechReader | undefined;
  readonly readNoteSupplementSpeech?: NoteSupplementSpeechReader | undefined;
  readonly readSegmentAudio?: SegmentAudioReader | undefined;
  readonly readSegmentAudioProjection?: SegmentAudioProjectionReader | undefined;
  readonly readSegmentProjection?: SegmentProjectionReader | undefined;
  readonly readSupplementAudio?: SupplementAudioReader | undefined;
  readonly readSupplementAudioProjection?: SupplementAudioProjectionReader | undefined;
  readonly readSupplementProjection?: SupplementProjectionReader | undefined;
  readonly request: WorkspaceReadExpressionPlaybackAudioRequest;
  readonly rootPath: string;
}): Promise<ExpressionPlaybackAudioResult> {
  if (request.kind === 'note-speech') {
    return readExpressionNoteSpeechAudio({
      readNoteSpeech,
      readNoteSupplementSpeech,
      readSegmentProjection,
      readSupplementProjection,
      request,
      rootPath,
    });
  }

  if (request.supplementId) {
    const projection = await readSupplementAudioProjection({
      rootPath,
      workspaceId: request.workspaceId,
      memoryId: request.memoryId,
      segmentId: request.segmentId,
      supplementId: request.supplementId,
    }).catch(() => workspaceError('ERR_RECORDING_NOT_FOUND', 'Expression audio is not available'));
    if ('ok' in projection) {
      return projection;
    }
    const result = await readSupplementAudio({
      rootPath,
      workspaceId: request.workspaceId,
      memoryId: request.memoryId,
      segmentId: request.segmentId,
      supplementId: request.supplementId,
      expectedAudioByteLength: projection.audioByteLength,
      expectedAudioHash: projection.audioHash,
    });
    return result.ok ? { ok: true, audio: result.audio, mimeType: 'audio/webm' } : result;
  }

  const projection = await readSegmentAudioProjection({
    rootPath,
    workspaceId: request.workspaceId,
    memoryId: request.memoryId,
    segmentId: request.segmentId,
  }).catch(() => workspaceError('ERR_RECORDING_NOT_FOUND', 'Expression audio is not available'));
  if ('ok' in projection) {
    return projection;
  }
  const result = await readSegmentAudio({
    rootPath,
    memoryId: request.memoryId,
    segmentId: request.segmentId,
    expectedAudioByteLength: projection.audioByteLength,
    expectedAudioHash: projection.audioHash,
  });
  return result.ok ? { ok: true, audio: result.audio, mimeType: 'audio/webm' } : result;
}

async function readExpressionNoteSpeechAudio({
  readNoteSpeech,
  readNoteSupplementSpeech,
  readSegmentProjection,
  readSupplementProjection,
  request,
  rootPath,
}: {
  readonly readNoteSpeech: NoteSpeechReader;
  readonly readNoteSupplementSpeech: NoteSupplementSpeechReader;
  readonly readSegmentProjection: SegmentProjectionReader;
  readonly readSupplementProjection: SupplementProjectionReader;
  readonly request: WorkspaceReadExpressionPlaybackAudioRequest;
  readonly rootPath: string;
}): Promise<ExpressionPlaybackAudioResult> {
  if (request.supplementId) {
    return readExpressionNoteSupplementSpeechAudio({
      readNoteSupplementSpeech,
      readSupplementProjection,
      request: { ...request, supplementId: request.supplementId },
      rootPath,
    });
  }

  const projection = await readSegmentProjection({
    rootPath,
    workspaceId: request.workspaceId,
    memoryId: request.memoryId,
    segmentId: request.segmentId,
  }).catch(() =>
    workspaceError(
      'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE',
      'Expression note speech audio is not available'
    )
  );
  if ('ok' in projection) {
    return projection;
  }
  const speech = projection.speechSynthesis;
  if (
    projection.type !== 'note' ||
    !speech ||
    speech.status !== 'ready' ||
    speech.audioByteLength === null ||
    speech.contentHash === null ||
    speech.speaker === null ||
    speech.updatedAt === null
  ) {
    return workspaceError(
      'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE',
      'Expression note speech audio is not available'
    );
  }

  const result = await readNoteSpeech({
    rootPath,
    workspaceId: request.workspaceId,
    memoryId: request.memoryId,
    segmentId: request.segmentId,
    contentHash: speech.contentHash,
    audioByteLength: speech.audioByteLength,
    speaker: speech.speaker,
    updatedAt: speech.updatedAt,
  });
  return result.ok ? { ok: true, audio: result.audio, mimeType: result.mimeType } : result;
}

async function readExpressionNoteSupplementSpeechAudio({
  readNoteSupplementSpeech,
  readSupplementProjection,
  request,
  rootPath,
}: {
  readonly readNoteSupplementSpeech: NoteSupplementSpeechReader;
  readonly readSupplementProjection: SupplementProjectionReader;
  readonly request: WorkspaceReadExpressionPlaybackAudioRequest & { readonly supplementId: string };
  readonly rootPath: string;
}): Promise<ExpressionPlaybackAudioResult> {
  const projection = await readSupplementProjection({
    rootPath,
    workspaceId: request.workspaceId,
    memoryId: request.memoryId,
    segmentId: request.segmentId,
    supplementId: request.supplementId,
  }).catch(() =>
    workspaceError(
      'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE',
      'Expression note speech audio is not available'
    )
  );
  if ('ok' in projection) {
    return projection;
  }
  const speech = projection.speechSynthesis;
  if (
    projection.type !== 'note' ||
    !speech ||
    speech.status !== 'ready' ||
    speech.audioByteLength === null ||
    speech.contentHash === null ||
    speech.speaker === null ||
    speech.updatedAt === null
  ) {
    return workspaceError(
      'ERR_SPEECH_SYNTHESIS_TARGET_NOT_ELIGIBLE',
      'Expression note speech audio is not available'
    );
  }

  const result = await readNoteSupplementSpeech({
    rootPath,
    workspaceId: request.workspaceId,
    memoryId: request.memoryId,
    segmentId: request.segmentId,
    supplementId: request.supplementId,
    contentHash: speech.contentHash,
    audioByteLength: speech.audioByteLength,
    speaker: speech.speaker,
    updatedAt: speech.updatedAt,
  });
  return result.ok ? { ok: true, audio: result.audio, mimeType: result.mimeType } : result;
}
