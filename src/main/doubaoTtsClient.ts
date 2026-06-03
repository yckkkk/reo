import { randomUUID } from 'node:crypto';
import {
  VOICE_SPEECH_SYNTHESIS_MODEL,
  VOICE_SPEECH_SYNTHESIS_RESOURCE_ID,
  VOICE_SPEECH_SYNTHESIS_SAMPLE_RATE,
  type VoiceSpeechSynthesisSpeaker,
} from '../workspace-contract/workspace-contract.js';

export const DOUBAO_TTS_UNIDIRECTIONAL_ENDPOINT =
  'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

const DEFAULT_TIMEOUT_MS = 30_000;

export type DoubaoTtsErrorCode =
  | 'abort'
  | 'auth'
  | 'empty-audio'
  | 'malformed'
  | 'network'
  | 'rate-limit'
  | 'server'
  | 'timeout';

export type DoubaoTtsSynthesisResult =
  | {
      readonly audio: Uint8Array;
      readonly audioByteLength: number;
      readonly ok: true;
      readonly requestId: string;
    }
  | {
      readonly errorCode: DoubaoTtsErrorCode;
      readonly ok: false;
      readonly requestId: string;
    };

export type DoubaoTtsFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type SynthesizeDoubaoTtsSpeechInput = {
  readonly apiKey: string;
  readonly fetch?: DoubaoTtsFetch;
  readonly requestId?: string;
  readonly signal?: AbortSignal;
  readonly speaker: VoiceSpeechSynthesisSpeaker;
  readonly text: string;
  readonly timeoutMs?: number;
};

type SettledResponse =
  | { readonly kind: 'abort' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'response'; readonly response: Response };

function buildRequestInit({
  apiKey,
  requestId,
  signal,
  speaker,
  text,
}: {
  readonly apiKey: string;
  readonly requestId: string;
  readonly signal: AbortSignal;
  readonly speaker: VoiceSpeechSynthesisSpeaker;
  readonly text: string;
}): RequestInit {
  return {
    body: JSON.stringify({
      namespace: 'BidirectionalTTS',
      req_params: {
        audio_params: {
          format: 'mp3',
          sample_rate: VOICE_SPEECH_SYNTHESIS_SAMPLE_RATE,
        },
        model: VOICE_SPEECH_SYNTHESIS_MODEL,
        speaker,
        text,
      },
      user: { uid: 'reo' },
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-Request-Id': requestId,
      'X-Api-Resource-Id': VOICE_SPEECH_SYNTHESIS_RESOURCE_ID,
    },
    method: 'POST',
    redirect: 'error',
    signal,
  };
}

function httpStatusToErrorCode(status: number): DoubaoTtsErrorCode | null {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate-limit';
  if (status >= 500) return 'server';
  if (status >= 400) return 'malformed';
  return null;
}

function settleWithTimeout({
  controller,
  fetchPromise,
  signal,
  timeoutMs,
}: {
  readonly controller: AbortController;
  readonly fetchPromise: Promise<Response>;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
}): Promise<SettledResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const safeTimeoutMs = Math.max(1, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abort);
    };
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      controller.abort();
      resolve({ kind: 'timeout' });
    }, safeTimeoutMs);
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      controller.abort();
      resolve({ kind: 'abort' });
    };
    signal?.addEventListener('abort', abort, { once: true });
    fetchPromise
      .then((response) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ kind: 'response', response });
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
  });
}

async function readResponseText(response: Response): Promise<string> {
  if (!response.body) {
    return await response.text();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

function splitJsonObjects(rawText: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let escaped = false;
  let inString = false;
  for (let index = 0; index < rawText.length; index += 1) {
    const char = rawText[index];
    if (start < 0) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        objects.push(rawText.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

function normalizeResponseText(rawText: string): string {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== '[DONE]')
    .map((line) => (line.startsWith('data:') ? line.slice('data:'.length).trim() : line))
    .join('\n');
}

function collectAudioBase64FromRecord(value: unknown): readonly string[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const output: string[] = [];
  const record = value as Record<string, unknown>;
  if (typeof record['code'] === 'number' && record['code'] !== 0 && record['code'] !== 20000000) {
    return null;
  }
  for (const key of ['audio', 'audio_data']) {
    const child = record[key];
    if (typeof child === 'string' && child.length > 0) {
      output.push(child);
    }
  }

  for (const key of ['data', 'result', 'payload', 'response']) {
    const child = record[key];
    if (child === undefined || child === null) {
      continue;
    }
    if (typeof child === 'string') {
      if (child.length > 0) {
        output.push(child);
      }
      continue;
    }
    if (typeof child !== 'object' || Array.isArray(child)) {
      return null;
    }
    for (const nestedKey of ['audio', 'audio_data']) {
      const audio = (child as Record<string, unknown>)[nestedKey];
      if (typeof audio === 'string' && audio.length > 0) {
        output.push(audio);
      }
    }
  }

  return output;
}

function normalizeBase64(input: string): string | null {
  const normalized = input.replace(/\s+/g, '');
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function decodeAudioChunks(chunks: readonly string[]): Uint8Array | null {
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const normalized = normalizeBase64(chunk);
    if (!normalized) {
      return null;
    }
    const buffer = Buffer.from(normalized, 'base64');
    if (buffer.length === 0 || buffer.toString('base64') !== normalized) {
      return null;
    }
    buffers.push(buffer);
  }
  return new Uint8Array(Buffer.concat(buffers));
}

function looksLikeMp3(audio: Uint8Array): boolean {
  if (audio.length < 3) {
    return false;
  }
  if (audio[0] === 0x49 && audio[1] === 0x44 && audio[2] === 0x33) {
    return true;
  }
  return audio[0] === 0xff && ((audio[1] ?? 0) & 0xe0) === 0xe0;
}

export async function synthesizeDoubaoTtsSpeech({
  apiKey,
  fetch = globalThis.fetch,
  requestId = randomUUID(),
  signal,
  speaker,
  text,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: SynthesizeDoubaoTtsSpeechInput): Promise<DoubaoTtsSynthesisResult> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const settled = await settleWithTimeout({
      controller,
      fetchPromise: fetch(
        DOUBAO_TTS_UNIDIRECTIONAL_ENDPOINT,
        buildRequestInit({ apiKey, requestId, signal: controller.signal, speaker, text })
      ),
      ...(signal ? { signal } : {}),
      timeoutMs,
    });
    if (settled.kind === 'abort') return { errorCode: 'abort', ok: false, requestId };
    if (settled.kind === 'timeout') return { errorCode: 'timeout', ok: false, requestId };

    const httpErrorCode = httpStatusToErrorCode(settled.response.status);
    if (httpErrorCode) return { errorCode: httpErrorCode, ok: false, requestId };

    const rawText = normalizeResponseText(await readResponseText(settled.response));
    const audioChunks: string[] = [];
    for (const jsonText of splitJsonObjects(rawText)) {
      try {
        const chunks = collectAudioBase64FromRecord(JSON.parse(jsonText));
        if (chunks === null) {
          return { errorCode: 'malformed', ok: false, requestId };
        }
        audioChunks.push(...chunks);
      } catch {
        return { errorCode: 'malformed', ok: false, requestId };
      }
    }
    if (audioChunks.length === 0) {
      return { errorCode: 'empty-audio', ok: false, requestId };
    }
    const audio = decodeAudioChunks(audioChunks);
    if (!audio || !looksLikeMp3(audio)) {
      return { errorCode: 'malformed', ok: false, requestId };
    }
    return { audio, audioByteLength: audio.byteLength, ok: true, requestId };
  } catch {
    return { errorCode: 'network', ok: false, requestId };
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
