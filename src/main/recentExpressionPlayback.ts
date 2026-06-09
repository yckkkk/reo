import type { NoteSpeechSynthesisManifest } from './noteSpeechSynthesisManifest.js';
import {
  noteContentHash,
  readNoteSpeechSynthesisProjectionFromManifest,
} from './noteSpeechSynthesisProjection.js';
import type { WorkspacePlaybackSource } from '../workspace-contract/workspace-contract.js';

type SpeechProjection = {
  readonly status: 'missing' | 'ready' | 'stale' | 'failed' | 'unsupported';
};

type ReadSpeechProjectionInput = Parameters<
  typeof readNoteSpeechSynthesisProjectionFromManifest
>[0];

export type ReadRecentExpressionSpeechProjection = (
  input: ReadSpeechProjectionInput
) => Promise<SpeechProjection>;

export type RecentExpressionSegmentPlaybackMetadata =
  | {
      readonly kind: 'audio';
      readonly durationMs: number;
    }
  | {
      readonly kind: 'note';
      readonly markdownContent: string;
      readonly speechSynthesis?: NoteSpeechSynthesisManifest | undefined;
    }
  | {
      readonly kind: 'artifact';
    };

export type RecentExpressionSupplementPlaybackProjection =
  | {
      readonly type: 'audio';
      readonly durationMs: number;
    }
  | {
      readonly type: 'note' | 'artifact';
    };

export async function recentExpressionSegmentPlayback({
  metadata,
  objectDirectory,
  readSpeechProjection = readNoteSpeechSynthesisProjectionFromManifest,
}: {
  readonly metadata: RecentExpressionSegmentPlaybackMetadata;
  readonly objectDirectory: string;
  readonly readSpeechProjection?: ReadRecentExpressionSpeechProjection | undefined;
}): Promise<WorkspacePlaybackSource | undefined> {
  if (metadata.kind === 'audio') {
    return { kind: 'audio', durationMs: metadata.durationMs };
  }

  if (metadata.kind === 'artifact') {
    return undefined;
  }

  const speech = await readSpeechProjection({
    currentContentHash: noteContentHash(metadata.markdownContent),
    manifest: metadata,
    objectDirectory,
  });
  return speech.status === 'ready' ? { kind: 'note-speech' } : undefined;
}

export function recentExpressionSupplementPlayback(
  supplement: RecentExpressionSupplementPlaybackProjection
): WorkspacePlaybackSource | undefined {
  if (supplement.type !== 'audio') {
    return undefined;
  }
  return { kind: 'audio', durationMs: supplement.durationMs };
}
