import { createHash } from 'node:crypto';
import path from 'node:path';
import type { JSONContent } from '@tiptap/core';
import { z } from 'zod';
import {
  TIPTAP_JSON_CONTENT_SIDECAR_MAX_BYTES,
  workspaceContentHashSchema,
  workspaceTiptapJsonContentSchema,
} from '../workspace-contract/workspace-contract.js';
import { writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import {
  assertTiptapMarkdownSerializable,
  parseTiptapMarkdown,
  serializeTiptapMarkdown,
  UnsupportedTiptapMarkdownContentError,
} from './tiptapMarkdownCodec.js';
import { readBoundedJsonNoFollow } from './workspaceJsonFile.js';

export const TIPTAP_CONTENT_SIDECAR_FILE = 'content.tiptap.json';
export const TIPTAP_CONTENT_PROFILE_NAME = 'reo-tiptap-markdown';
export const TIPTAP_CONTENT_PROFILE_VERSION = 1;

const tiptapContentSidecarFileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  objectType: z.literal('tiptap-content'),
  source: z.strictObject({
    format: z.literal('markdown'),
    hash: workspaceContentHashSchema,
  }),
  profile: z.strictObject({
    name: z.literal(TIPTAP_CONTENT_PROFILE_NAME),
    version: z.literal(TIPTAP_CONTENT_PROFILE_VERSION),
  }),
  contentHash: workspaceContentHashSchema,
  content: workspaceTiptapJsonContentSchema,
});

export type TiptapContentSidecarFile = z.infer<typeof tiptapContentSidecarFileSchema>;
export type TiptapContentSidecar = TiptapContentSidecarFile & {
  readonly currentContentHash: string;
};

export type TiptapContentSidecarReconcileResult =
  | {
      readonly ok: true;
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash: string;
      readonly bodyMarkdown: string;
      readonly bodyMarkdownChanged: boolean;
      readonly tiptapJson: JSONContent;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'content-conflict'
        | 'invalid-sidecar'
        | 'markdown-write-required'
        | 'unsupported-tiptap-content';
    };

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashTiptapSourceMarkdown(markdown: string): string {
  return hashString(markdown);
}

function hashComparableTiptapMarkdown(markdown: string): string {
  return hashString(markdown.trimEnd());
}

function serializedMarkdownMatchesSourceHash(markdown: string, sourceHash: string): boolean {
  const normalized = markdown.trimEnd();
  const variants = new Set([markdown, normalized, `${normalized}\n`]);
  return [...variants].some((variant) => hashTiptapSourceMarkdown(variant) === sourceHash);
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item));
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const canonical: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      canonical[key] = canonicalizeJson(record[key]);
    }
    return canonical;
  }
  return value;
}

export function hashTiptapJsonContent(content: JSONContent): string {
  return hashString(JSON.stringify(canonicalizeJson(content)));
}

export function tiptapContentSidecarPath(objectDirectory: string): string {
  return path.join(objectDirectory, TIPTAP_CONTENT_SIDECAR_FILE);
}

function createSidecarFile({
  bodyMarkdown,
  content,
}: {
  readonly bodyMarkdown: string;
  readonly content: JSONContent;
}): TiptapContentSidecarFile {
  return {
    schemaVersion: 1,
    objectType: 'tiptap-content',
    source: {
      format: 'markdown',
      hash: hashTiptapSourceMarkdown(bodyMarkdown),
    },
    profile: {
      name: TIPTAP_CONTENT_PROFILE_NAME,
      version: TIPTAP_CONTENT_PROFILE_VERSION,
    },
    contentHash: hashTiptapJsonContent(content),
    content,
  };
}

async function writeSidecarFile(
  objectDirectory: string,
  sidecar: TiptapContentSidecarFile,
  assertUsable?: () => void
): Promise<void> {
  await writeWorkspaceJsonAtomic(tiptapContentSidecarPath(objectDirectory), sidecar, assertUsable);
}

function withContentHash(
  sidecar: TiptapContentSidecarFile,
  currentContentHash = hashTiptapJsonContent(sidecar.content)
): TiptapContentSidecar {
  return {
    ...sidecar,
    currentContentHash,
  };
}

function missingSidecarError(): NodeJS.ErrnoException {
  return Object.assign(new Error('Tiptap content sidecar is missing'), { code: 'ENOENT' });
}

export async function readTiptapContentSidecar(
  objectDirectory: string
): Promise<TiptapContentSidecar> {
  const result = await readBoundedJsonNoFollow({
    filePath: tiptapContentSidecarPath(objectDirectory),
    maxBytes: TIPTAP_JSON_CONTENT_SIDECAR_MAX_BYTES,
    schema: tiptapContentSidecarFileSchema,
  });
  if (result.status === 'missing') {
    throw missingSidecarError();
  }
  if (result.status !== 'ok') {
    throw result.status === 'read-error'
      ? result.error
      : new Error('Tiptap content sidecar is invalid');
  }
  return withContentHash(result.value);
}

export async function writeTiptapContentSidecar({
  assertUsable,
  bodyMarkdown,
  objectDirectory,
  tiptapJson,
}: {
  readonly assertUsable?: (() => void) | undefined;
  readonly bodyMarkdown: string;
  readonly objectDirectory: string;
  readonly tiptapJson: JSONContent;
}): Promise<TiptapContentSidecar> {
  assertTiptapJsonMatchesMarkdown({ bodyMarkdown, tiptapJson });
  const sidecar = createSidecarFile({ bodyMarkdown, content: tiptapJson });
  await writeSidecarFile(objectDirectory, sidecar, assertUsable);
  return withContentHash(sidecar, sidecar.contentHash);
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function okResult({
  baselineContentHash,
  baselineTiptapContentHash,
  bodyMarkdownChanged = false,
  bodyMarkdown,
  tiptapJson,
}: {
  readonly baselineContentHash?: string | undefined;
  readonly baselineTiptapContentHash?: string | undefined;
  readonly bodyMarkdownChanged?: boolean | undefined;
  readonly bodyMarkdown: string;
  readonly tiptapJson: JSONContent;
}): Extract<TiptapContentSidecarReconcileResult, { readonly ok: true }> {
  return {
    ok: true,
    baselineContentHash: baselineContentHash ?? hashTiptapSourceMarkdown(bodyMarkdown),
    baselineTiptapContentHash: baselineTiptapContentHash ?? hashTiptapJsonContent(tiptapJson),
    bodyMarkdownChanged,
    bodyMarkdown,
    tiptapJson,
  };
}

export function assertTiptapJsonMatchesMarkdown({
  bodyMarkdown,
  tiptapJson,
}: {
  readonly bodyMarkdown: string;
  readonly tiptapJson: JSONContent;
}): string {
  assertTiptapMarkdownSerializable(tiptapJson);
  const tiptapMarkdown = serializeTiptapMarkdown(tiptapJson);
  if (hashComparableTiptapMarkdown(tiptapMarkdown) !== hashComparableTiptapMarkdown(bodyMarkdown)) {
    throw new Error('Tiptap JSON does not match Markdown body');
  }
  return tiptapMarkdown;
}

export async function reconcileTiptapContentSidecar({
  assertUsable,
  bodyMarkdown,
  createIfMissing = true,
  objectDirectory,
  writeBodyMarkdown,
}: {
  readonly bodyMarkdown: string;
  readonly objectDirectory: string;
  readonly assertUsable?: (() => void) | undefined;
  readonly createIfMissing?: boolean | undefined;
  readonly writeBodyMarkdown?: (nextBodyMarkdown: string) => Promise<string | void> | string | void;
}): Promise<TiptapContentSidecarReconcileResult> {
  const currentMarkdownHash = hashTiptapSourceMarkdown(bodyMarkdown);
  let sidecar: TiptapContentSidecar;
  try {
    sidecar = await readTiptapContentSidecar(objectDirectory);
  } catch (error) {
    if (!isMissingFile(error)) {
      return { ok: false, reason: 'invalid-sidecar' };
    }
    const tiptapJson = parseTiptapMarkdown(bodyMarkdown);
    if (createIfMissing) {
      await writeSidecarFile(
        objectDirectory,
        createSidecarFile({ bodyMarkdown, content: tiptapJson }),
        assertUsable
      );
    }
    return okResult({ bodyMarkdown, tiptapJson });
  }

  let sidecarMarkdown: string;
  try {
    sidecarMarkdown = serializeTiptapMarkdown(sidecar.content);
  } catch (error) {
    if (error instanceof UnsupportedTiptapMarkdownContentError) {
      return { ok: false, reason: 'unsupported-tiptap-content' };
    }
    return { ok: false, reason: 'invalid-sidecar' };
  }

  const markdownChanged = currentMarkdownHash !== sidecar.source.hash;
  const sidecarChanged =
    sidecar.currentContentHash !== sidecar.contentHash ||
    !serializedMarkdownMatchesSourceHash(sidecarMarkdown, sidecar.source.hash);
  const sidecarMatchesMarkdown =
    hashComparableTiptapMarkdown(sidecarMarkdown) === hashComparableTiptapMarkdown(bodyMarkdown);

  if (sidecarMatchesMarkdown) {
    if (markdownChanged || sidecarChanged || sidecar.source.hash !== currentMarkdownHash) {
      await writeSidecarFile(
        objectDirectory,
        createSidecarFile({ bodyMarkdown, content: sidecar.content }),
        assertUsable
      );
    }
    return okResult({
      baselineContentHash: currentMarkdownHash,
      baselineTiptapContentHash: sidecar.currentContentHash,
      bodyMarkdown,
      tiptapJson: sidecar.content,
    });
  }

  if (!markdownChanged) {
    if (!writeBodyMarkdown) {
      return { ok: false, reason: 'markdown-write-required' };
    }
    const writtenBodyMarkdown = (await writeBodyMarkdown(sidecarMarkdown)) ?? sidecarMarkdown;
    await writeSidecarFile(
      objectDirectory,
      createSidecarFile({ bodyMarkdown: writtenBodyMarkdown, content: sidecar.content }),
      assertUsable
    );
    return okResult({
      baselineContentHash: hashTiptapSourceMarkdown(writtenBodyMarkdown),
      baselineTiptapContentHash: sidecar.currentContentHash,
      bodyMarkdown: writtenBodyMarkdown,
      bodyMarkdownChanged: true,
      tiptapJson: sidecar.content,
    });
  }

  if (markdownChanged && sidecarChanged) {
    return { ok: false, reason: 'content-conflict' };
  }

  const tiptapJson = parseTiptapMarkdown(bodyMarkdown);
  await writeSidecarFile(
    objectDirectory,
    createSidecarFile({ bodyMarkdown, content: tiptapJson }),
    assertUsable
  );
  return okResult({ bodyMarkdown, tiptapJson });
}
