import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  BackfillAudioUrlConfiguredSettings,
  BackfillAudioUrlSettings,
  BackfillAudioUrlTosSettings,
} from './backfillAudioUrlSettings.js';

type InputContainer = 'webm';
type InputCodec = 'opus';
type OutputContainer = 'ogg';
type OutputCodec = 'opus';

export type BackfillAudioInput = {
  readonly audioByteLength: number;
  readonly audioBytes: Uint8Array;
  readonly audioPath: string;
  readonly codec: InputCodec | string;
  readonly container: InputContainer | string;
  readonly memoryId: string;
  readonly segmentId: string;
};

export type BackfillAudioRemuxerInput = {
  readonly audioByteLength: number;
  readonly audioBytes: Uint8Array;
  readonly audioPath: string;
  readonly codec: InputCodec;
  readonly container: InputContainer;
  readonly signal?: AbortSignal;
};

export type BackfillAudioRemuxerOutput = {
  readonly bytes: Uint8Array;
  readonly codec: OutputCodec | string;
  readonly container: OutputContainer | string;
};

export type BackfillAudioRemuxer = {
  readonly remux: (input: BackfillAudioRemuxerInput) => Promise<BackfillAudioRemuxerOutput>;
};

export type BackfillAudioStagingClient = {
  readonly deleteObject: (input: {
    readonly key: string;
    readonly signal?: AbortSignal;
  }) => Promise<void>;
  readonly getObjectGetUrl: (input: {
    readonly key: string;
    readonly ttlSeconds: number;
  }) => Promise<string>;
  readonly putObject: (input: {
    readonly body: Uint8Array;
    readonly contentType: string;
    readonly key: string;
    readonly signal?: AbortSignal;
  }) => Promise<void>;
};

export type BackfillAudioUrlErrorCode =
  | 'invalid-remux-output'
  | 'missing-remuxer'
  | 'missing-staging-client'
  | 'remux-failed'
  | 'aborted'
  | 'unconfigured'
  | 'unsupported-audio-format'
  | 'upload-failed'
  | 'url-create-failed';

export type BackfillAudioUrlDiagnostics = {
  readonly audioByteLength: number;
  readonly inputCodec: string;
  readonly inputContainer: string;
  readonly stage: 'cleanup' | 'format' | 'get-url' | 'remux' | 'settings' | 'upload';
};

export type BackfillAudioUrlResult =
  | {
      readonly cleanup: () => Promise<void>;
      readonly expiresAt: string;
      readonly ok: true;
      readonly url: string;
    }
  | {
      readonly error: {
        readonly code: BackfillAudioUrlErrorCode;
        readonly diagnostics: BackfillAudioUrlDiagnostics;
        readonly reason?: 'missing-ffmpeg-path' | 'missing-tos-settings';
      };
      readonly ok: false;
    };

export type BackfillAudioUrlSource = {
  readonly createUrl: (
    input: BackfillAudioInput,
    options?: { readonly signal?: AbortSignal }
  ) => Promise<BackfillAudioUrlResult>;
};

export type CreateBackfillAudioUrlSourceInput = {
  readonly now?: () => Date;
  readonly objectKeyId?: () => string;
  readonly remuxer?: BackfillAudioRemuxer;
  readonly settings: BackfillAudioUrlSettings;
  readonly stagingClient?: BackfillAudioStagingClient;
};

const OGG_OPUS_CONTENT_TYPE = 'audio/ogg; codecs=opus';
const TOS_ALGORITHM = 'TOS4-HMAC-SHA256';
const TOS_PAYLOAD_HASH = 'UNSIGNED-PAYLOAD';
const TOS_SERVICE = 'tos';
const TOS_V4_IDENTIFIER = 'request';

export function createBackfillAudioUrlSource({
  now = () => new Date(),
  objectKeyId = () => randomUUID(),
  remuxer,
  settings,
  stagingClient,
}: CreateBackfillAudioUrlSourceInput): BackfillAudioUrlSource {
  return {
    createUrl: async (input, options = {}) => {
      const signal = options.signal;
      const diagnostics = diagnosticsFor(input, 'settings');
      if (signal?.aborted) {
        return { error: { code: 'aborted', diagnostics }, ok: false };
      }

      if (!settings.configured) {
        return {
          error: { code: 'unconfigured', diagnostics, reason: settings.reason },
          ok: false,
        };
      }

      if (input.container !== 'webm' || input.codec !== 'opus') {
        return {
          error: { code: 'unsupported-audio-format', diagnostics: diagnosticsFor(input, 'format') },
          ok: false,
        };
      }

      const activeRemuxer = remuxer ?? createConfiguredFfmpegOggOpusRemuxer(settings);
      if (!activeRemuxer) {
        return {
          error: { code: 'missing-remuxer', diagnostics: diagnosticsFor(input, 'remux') },
          ok: false,
        };
      }

      const activeStagingClient =
        stagingClient ?? createVolcengineTosBackfillStagingClient(settings);
      if (!activeStagingClient) {
        return {
          error: { code: 'missing-staging-client', diagnostics: diagnosticsFor(input, 'upload') },
          ok: false,
        };
      }

      let remuxed: BackfillAudioRemuxerOutput;
      try {
        remuxed = await activeRemuxer.remux({
          audioByteLength: input.audioByteLength,
          audioBytes: input.audioBytes,
          audioPath: input.audioPath,
          codec: 'opus',
          container: 'webm',
          ...(signal ? { signal } : {}),
        });
      } catch {
        if (signal?.aborted) {
          return {
            error: { code: 'aborted', diagnostics: diagnosticsFor(input, 'remux') },
            ok: false,
          };
        }
        return {
          error: { code: 'remux-failed', diagnostics: diagnosticsFor(input, 'remux') },
          ok: false,
        };
      }

      if (remuxed.container !== 'ogg' || remuxed.codec !== 'opus') {
        return {
          error: { code: 'invalid-remux-output', diagnostics: diagnosticsFor(input, 'remux') },
          ok: false,
        };
      }

      const key = buildObjectKey({
        keyPrefix: settings.tos.keyPrefix,
        memoryId: input.memoryId,
        segmentId: input.segmentId,
        uploadId: objectKeyId(),
      });

      try {
        await activeStagingClient.putObject({
          body: remuxed.bytes,
          contentType: OGG_OPUS_CONTENT_TYPE,
          key,
          ...(signal ? { signal } : {}),
        });
      } catch {
        await cleanupAfterFailure(activeStagingClient, key);
        if (signal?.aborted) {
          return {
            error: { code: 'aborted', diagnostics: diagnosticsFor(input, 'upload') },
            ok: false,
          };
        }
        return {
          error: { code: 'upload-failed', diagnostics: diagnosticsFor(input, 'upload') },
          ok: false,
        };
      }

      try {
        const url = await activeStagingClient.getObjectGetUrl({
          key,
          ttlSeconds: settings.presignedUrlTtlSeconds,
        });
        return {
          cleanup: createCleanup(activeStagingClient, key),
          expiresAt: new Date(
            now().getTime() + settings.presignedUrlTtlSeconds * 1000
          ).toISOString(),
          ok: true,
          url,
        };
      } catch {
        await cleanupAfterFailure(activeStagingClient, key);
        return {
          error: { code: 'url-create-failed', diagnostics: diagnosticsFor(input, 'get-url') },
          ok: false,
        };
      }
    },
  };
}

export function createConfiguredFfmpegOggOpusRemuxer(
  settings: BackfillAudioUrlConfiguredSettings
): BackfillAudioRemuxer | null {
  if (!settings.ffmpegPath) {
    return null;
  }
  return createFfmpegOggOpusRemuxer({ ffmpegPath: settings.ffmpegPath });
}

export function createFfmpegOggOpusRemuxer({
  ffmpegPath,
  spawnProcess = spawn,
}: {
  readonly ffmpegPath: string;
  readonly spawnProcess?: (
    command: string,
    args: readonly string[]
  ) => ChildProcessWithoutNullStreams;
}): BackfillAudioRemuxer {
  return {
    remux: async (input) => {
      const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'reo-backfill-audio-'));
      const inputPath = path.join(tempDirectory, 'input.webm');
      const outputPath = path.join(tempDirectory, 'output.ogg');

      try {
        if (input.signal?.aborted) {
          throw new Error('ffmpeg remux aborted');
        }
        await writeFile(inputPath, input.audioBytes);
        await runFfmpegRemux({
          ffmpegPath,
          inputPath,
          outputPath,
          ...(input.signal ? { signal: input.signal } : {}),
          spawnProcess,
        });
        return {
          bytes: await readFile(outputPath),
          codec: 'opus',
          container: 'ogg',
        };
      } finally {
        await rm(tempDirectory, { force: true, recursive: true });
      }
    },
  };
}

type TosHttpFetch = (
  url: string,
  init: {
    readonly body?: Uint8Array;
    readonly headers: Record<string, string>;
    readonly method: 'DELETE' | 'PUT';
    readonly signal?: AbortSignal;
  }
) => Promise<{ readonly ok: boolean; readonly status: number }>;

export function createVolcengineTosBackfillStagingClient(
  settings: BackfillAudioUrlConfiguredSettings,
  {
    fetch = globalThis.fetch as unknown as TosHttpFetch,
    now = () => new Date(),
  }: {
    readonly fetch?: TosHttpFetch;
    readonly now?: () => Date;
  } = {}
): BackfillAudioStagingClient {
  const tos = settings.tos;

  return {
    deleteObject: async ({ key, signal }) => {
      const request = createSignedTosRequest({
        method: 'DELETE',
        now: now(),
        settings: tos,
        key,
      });
      const response = await fetch(request.url, {
        headers: request.headers,
        method: 'DELETE',
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) {
        throw new Error('TOS deleteObject failed');
      }
    },
    getObjectGetUrl: async ({ key, ttlSeconds }) =>
      createTosPresignedGetUrl({
        expiresSeconds: ttlSeconds,
        key,
        now: now(),
        settings: tos,
      }),
    putObject: async ({ body, contentType, key, signal }) => {
      const request = createSignedTosRequest({
        contentType,
        method: 'PUT',
        now: now(),
        settings: tos,
        key,
      });
      const response = await fetch(request.url, {
        body,
        headers: request.headers,
        method: 'PUT',
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) {
        throw new Error('TOS putObject failed');
      }
    },
  };
}

function buildObjectKey({
  keyPrefix,
  memoryId,
  segmentId,
  uploadId,
}: {
  readonly keyPrefix: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly uploadId: string;
}): string {
  return [
    keyPrefix,
    sanitizeKeyPart(memoryId),
    sanitizeKeyPart(segmentId),
    `${sanitizeKeyPart(uploadId)}.ogg`,
  ]
    .filter(Boolean)
    .join('/');
}

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function createCleanup(client: BackfillAudioStagingClient, key: string): () => Promise<void> {
  let cleanupStarted = false;
  return async () => {
    if (cleanupStarted) {
      return;
    }
    cleanupStarted = true;
    await client.deleteObject({ key });
  };
}

async function cleanupAfterFailure(client: BackfillAudioStagingClient, key: string): Promise<void> {
  try {
    await client.deleteObject({ key });
  } catch {
    return;
  }
}

function diagnosticsFor(
  input: BackfillAudioInput,
  stage: BackfillAudioUrlDiagnostics['stage']
): BackfillAudioUrlDiagnostics {
  return {
    audioByteLength: input.audioByteLength,
    inputCodec: input.codec,
    inputContainer: input.container,
    stage,
  };
}

function createSignedTosRequest({
  contentType,
  key,
  method,
  now,
  settings,
}: {
  readonly contentType?: string;
  readonly key: string;
  readonly method: 'DELETE' | 'PUT';
  readonly now: Date;
  readonly settings: BackfillAudioUrlTosSettings;
}): { readonly headers: Record<string, string>; readonly url: string } {
  const host = tosHost(settings);
  const signingPath = tosObjectPath(key, true);
  const datetime = tosDateTime(now);
  const headers: Record<string, string> = {
    host,
    'x-tos-content-sha256': TOS_PAYLOAD_HASH,
    'x-tos-date': datetime,
  };
  if (contentType) {
    headers['content-type'] = contentType;
  }

  headers['authorization'] = createTosAuthorizationHeader({
    canonicalQuery: '',
    headers,
    method,
    path: signingPath,
    settings,
    datetime,
  });

  return {
    headers,
    url: `${tosOrigin(settings)}${signingPath}`,
  };
}

function createTosPresignedGetUrl({
  expiresSeconds,
  key,
  now,
  settings,
}: {
  readonly expiresSeconds: number;
  readonly key: string;
  readonly now: Date;
  readonly settings: BackfillAudioUrlTosSettings;
}): string {
  const host = tosHost(settings);
  const datetime = tosDateTime(now);
  const signedHeaders = 'host';
  const credential = `${settings.accessKeyId}/${tosCredentialScope(datetime, settings.region)}`;
  const baseQuery: Record<string, string> = {
    'X-Tos-Algorithm': TOS_ALGORITHM,
    'X-Tos-Credential': credential,
    'X-Tos-Date': datetime,
    'X-Tos-Expires': String(expiresSeconds),
    'X-Tos-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = canonicalQueryString(baseQuery);
  const signature = createTosSignature({
    canonicalQuery,
    headers: { host },
    method: 'GET',
    path: tosObjectPath(key, true),
    settings,
    datetime,
  });
  return `${tosOrigin(settings)}${tosObjectPath(key, false)}?${canonicalQuery}&X-Tos-Signature=${signature}`;
}

function createTosAuthorizationHeader({
  canonicalQuery,
  datetime,
  headers,
  method,
  path,
  settings,
}: {
  readonly canonicalQuery: string;
  readonly datetime: string;
  readonly headers: Record<string, string>;
  readonly method: 'DELETE' | 'GET' | 'PUT';
  readonly path: string;
  readonly settings: BackfillAudioUrlTosSettings;
}): string {
  const signedHeaders = signedTosHeaders(headers);
  const signature = createTosSignature({
    canonicalQuery,
    headers,
    method,
    path,
    settings,
    datetime,
  });
  return `${TOS_ALGORITHM} Credential=${settings.accessKeyId}/${tosCredentialScope(
    datetime,
    settings.region
  )}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function createTosSignature({
  canonicalQuery,
  datetime,
  headers,
  method,
  path,
  settings,
}: {
  readonly canonicalQuery: string;
  readonly datetime: string;
  readonly headers: Record<string, string>;
  readonly method: 'DELETE' | 'GET' | 'PUT';
  readonly path: string;
  readonly settings: BackfillAudioUrlTosSettings;
}): string {
  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    `${canonicalTosHeaders(headers)}\n`,
    signedTosHeaders(headers),
    TOS_PAYLOAD_HASH,
  ].join('\n');
  const stringToSign = [
    TOS_ALGORITHM,
    datetime,
    tosCredentialScope(datetime, settings.region),
    sha256Hex(canonicalRequest),
  ].join('\n');
  return hmacHex(tosSigningKey(settings.accessKeySecret, datetime, settings.region), stringToSign);
}

function canonicalTosHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key]) => key.toLowerCase() !== 'authorization')
    .map(([key, value]) => [key.toLowerCase(), value.trim().replace(/\s+/g, ' ')] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('\n');
}

function signedTosHeaders(headers: Record<string, string>): string {
  return Object.keys(headers)
    .map((key) => key.toLowerCase())
    .filter((key) => key !== 'authorization')
    .sort()
    .join(';');
}

function canonicalQueryString(query: Record<string, string>): string {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function tosSigningKey(secret: string, datetime: string, region: string): Buffer {
  const date = datetime.slice(0, 8);
  const kDate = hmacBuffer(secret, date);
  const kRegion = hmacBuffer(kDate, region);
  const kService = hmacBuffer(kRegion, TOS_SERVICE);
  return hmacBuffer(kService, TOS_V4_IDENTIFIER);
}

function hmacBuffer(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: string | Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function tosCredentialScope(datetime: string, region: string): string {
  return `${datetime.slice(0, 8)}/${region}/${TOS_SERVICE}/${TOS_V4_IDENTIFIER}`;
}

function tosDateTime(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '');
}

function tosOrigin(settings: BackfillAudioUrlTosSettings): string {
  return `https://${tosHost(settings)}`;
}

function tosHost(settings: BackfillAudioUrlTosSettings): string {
  return `${settings.bucket}.${normalizeTosEndpoint(settings.endpoint)}`;
}

function normalizeTosEndpoint(endpoint: string): string {
  return endpoint.replace(/^https?:\/\//, '').replace(/\/+$/g, '');
}

function tosObjectPath(key: string, encodeSlash: boolean): string {
  if (encodeSlash) {
    return `/${encodeURIComponent(key)}`;
  }
  return `/${key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function runFfmpegRemux({
  ffmpegPath,
  inputPath,
  outputPath,
  signal,
  spawnProcess,
}: {
  readonly ffmpegPath: string;
  readonly inputPath: string;
  readonly outputPath: string;
  readonly signal?: AbortSignal;
  readonly spawnProcess: (
    command: string,
    args: readonly string[]
  ) => ChildProcessWithoutNullStreams;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('ffmpeg remux aborted'));
      return;
    }
    const child = spawnProcess(ffmpegPath, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-c:a',
      'copy',
      outputPath,
    ]);

    let aborted = false;
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener('abort', abort);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const abort = () => {
      aborted = true;
      child.kill('SIGTERM');
    };
    signal?.addEventListener('abort', abort, { once: true });
    child.once('error', () => {
      settle(new Error(aborted ? 'ffmpeg remux aborted' : 'ffmpeg remux failed'));
    });
    child.once('close', (code) => {
      if (aborted) {
        settle(new Error('ffmpeg remux aborted'));
        return;
      }
      if (code === 0) {
        settle();
        return;
      }
      settle(new Error('ffmpeg remux failed'));
    });
  });
}
