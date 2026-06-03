import type { VoiceSpeechSynthesisSpeaker } from '../workspace-contract/workspace-contract.js';
import { synthesizeDoubaoTtsSpeech } from './doubaoTtsClient.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export type VoiceSpeechSynthesisProbeCode = 'auth' | 'network' | 'ok';

export type VoiceSpeechSynthesisProbeResult =
  | {
      readonly code: 'ok';
      readonly ok: true;
    }
  | {
      readonly code: 'auth' | 'network';
      readonly message?: string;
      readonly ok: false;
    };

export type RunVoiceSpeechSynthesisProbeInput = {
  readonly apiKey: string;
  readonly speaker: VoiceSpeechSynthesisSpeaker;
  readonly synthesize?: typeof synthesizeDoubaoTtsSpeech;
  readonly timeoutMs?: number;
};

export async function runVoiceSpeechSynthesisProbe({
  apiKey,
  speaker,
  synthesize = synthesizeDoubaoTtsSpeech,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RunVoiceSpeechSynthesisProbeInput): Promise<VoiceSpeechSynthesisProbeResult> {
  const result = await synthesize({
    apiKey,
    speaker,
    text: '测试',
    timeoutMs,
  });
  if (result.ok) {
    return { code: 'ok', ok: true };
  }
  return {
    code: result.errorCode === 'auth' ? 'auth' : 'network',
    ok: false,
  };
}
