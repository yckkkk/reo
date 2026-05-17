export type BackfillAudioUrlTosSettings = {
  readonly accessKeyId: string;
  readonly accessKeySecret: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly keyPrefix: string;
  readonly region: string;
};

export type BackfillAudioUrlConfiguredSettings = {
  readonly configured: true;
  readonly ffmpegPath?: string;
  readonly presignedUrlTtlSeconds: number;
  readonly tos: BackfillAudioUrlTosSettings;
};

export type BackfillAudioUrlUnconfiguredSettings = {
  readonly configured: false;
  readonly reason: 'missing-ffmpeg-path' | 'missing-tos-settings';
};

export type BackfillAudioUrlSettings =
  | BackfillAudioUrlConfiguredSettings
  | BackfillAudioUrlUnconfiguredSettings;

type BackfillAudioUrlEnv = Record<string, string | undefined>;

const DEFAULT_KEY_PREFIX = 'reo/backfill-audio';
const DEFAULT_PRESIGNED_URL_TTL_SECONDS = 60;
const MAX_PRESIGNED_URL_TTL_SECONDS = 900;
const MIN_PRESIGNED_URL_TTL_SECONDS = 1;

export function resolveBackfillAudioUrlSettings(
  env: BackfillAudioUrlEnv = process.env
): BackfillAudioUrlSettings {
  const accessKeyId = normalizedEnvValue(env['REO_BACKFILL_TOS_ACCESS_KEY_ID']);
  const accessKeySecret = normalizedEnvValue(env['REO_BACKFILL_TOS_ACCESS_KEY_SECRET']);
  const bucket = normalizedEnvValue(env['REO_BACKFILL_TOS_BUCKET']);
  const endpoint = normalizedEnvValue(env['REO_BACKFILL_TOS_ENDPOINT']);
  const region = normalizedEnvValue(env['REO_BACKFILL_TOS_REGION']);

  if (!accessKeyId || !accessKeySecret || !bucket || !endpoint || !region) {
    return { configured: false, reason: 'missing-tos-settings' };
  }

  const keyPrefix = trimSlashes(
    normalizedEnvValue(env['REO_BACKFILL_TOS_KEY_PREFIX']) ?? DEFAULT_KEY_PREFIX
  );
  const ffmpegPath = normalizedEnvValue(env['REO_BACKFILL_FFMPEG_PATH']);
  if (!ffmpegPath) {
    return { configured: false, reason: 'missing-ffmpeg-path' };
  }
  const ttl = parsePresignedUrlTtl(env['REO_BACKFILL_TOS_GET_URL_TTL_SECONDS']);

  return {
    configured: true,
    ffmpegPath,
    presignedUrlTtlSeconds: ttl,
    tos: {
      accessKeyId,
      accessKeySecret,
      bucket,
      endpoint,
      keyPrefix,
      region,
    },
  };
}

function normalizedEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parsePresignedUrlTtl(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PRESIGNED_URL_TTL_SECONDS;
  }
  return Math.min(MAX_PRESIGNED_URL_TTL_SECONDS, Math.max(MIN_PRESIGNED_URL_TTL_SECONDS, parsed));
}

function trimSlashes(value: string): string {
  const trimmed = value.replace(/^\/+|\/+$/g, '');
  return trimmed || DEFAULT_KEY_PREFIX;
}
