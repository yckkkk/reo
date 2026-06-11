import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  readSync,
  renameSync,
} from 'node:fs';
import type { Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { writeWorkspaceFileAtomic, writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import {
  createArtifactRuntimePreviewVersion,
  type ArtifactRuntimePreviewOptionalFileDescriptor,
} from './artifactRuntimePreview.js';
import {
  assertSameDirectoryIdentitySync,
  readSafeDirectoryIdentity,
  readSafeDirectoryIdentitySync,
  type DirectoryIdentity,
} from './directoryIdentity.js';
import { MAX_ARTIFACT_ASSET_BYTES, MAX_ARTIFACT_ENTRY_BYTES } from './artifactLimits.js';
import {
  ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
  ARTIFACT_RUNTIME_ENTRY_FILE,
  workspaceWidgetRuntimeHost,
} from './artifactUrl.js';
import { getWorkspaceMetadataPath } from './workspacePaths.js';
import {
  fsyncCurrentWorkspaceDirectoryBestEffort,
  openExistingWorkspaceFileInDirectory,
  readWorkspaceDirectoryEntriesInDirectory,
  runInWorkspaceDirectorySync,
} from './workspaceDirectoryTransactions.js';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
} from './workspaceMarkdownObjects.js';
import {
  WIDGET_ID_PATTERN,
  isSafeWorkspaceDirectoryName,
  workspaceWidgetTabOrderItemSchema,
  type WorkspaceWidgetProjection,
  type WorkspaceErrorEnvelope,
} from '../workspace-contract/workspace-contract.js';
import { RENDER_SCHEME } from '../workspace-contract/artifact-runtime-url.js';
import type { WorkspaceReviewEntryInput } from './workspaceReviewReport.js';

const WIDGETS_DIRECTORY = 'widgets';
const WIDGET_MARKDOWN_FILE = 'widget.md';
const WIDGET_ICON_FILE = 'icon.svg';
const WIDGET_MARKDOWN_MAX_BYTES = 262_144;
const WORKSPACE_JSON_MAX_BYTES = 1_048_576;
const COPY_BUFFER_BYTES = 1_048_576;
const workspaceWidgetWriteQueues = new Map<string, Promise<void>>();

type AssertWorkspaceUsable = () => { readonly ok: true } | WorkspaceErrorEnvelope;
type WorkspaceWidgetRuntimeFault = NonNullable<WorkspaceWidgetProjection['runtimeFault']>;

type WidgetCandidate =
  | {
      readonly ok: true;
      readonly widget: WorkspaceWidgetProjection;
      readonly directory: string;
    }
  | {
      readonly ok: false;
      readonly reviewEntries: readonly WorkspaceReviewEntryInput[];
    };

function assertWorkspaceUsable(assertUsable: AssertWorkspaceUsable | undefined): void {
  const usable = assertUsable?.();
  if (usable && !usable.ok) {
    throw new Error(usable.error.message);
  }
}

function ensureSafeChildDirectorySync(
  parentDirectory: string,
  childDirectoryName: string,
  assertUsable: AssertWorkspaceUsable | undefined
): string {
  const previousCwd = process.cwd();
  const parentIdentity = readSafeDirectoryIdentitySync(
    parentDirectory,
    'Widget parent directory is not safe'
  );
  try {
    process.chdir(parentDirectory);
    assertSameDirectoryIdentitySync(parentDirectory, parentIdentity, 'Widget parent changed');
    assertWorkspaceUsable(assertUsable);
    try {
      mkdirSync(childDirectoryName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
    const entry = lstatSync(childDirectoryName);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error('Widget child directory is not safe');
    }
    assertSameDirectoryIdentitySync(parentDirectory, parentIdentity, 'Widget parent changed');
    return path.join(parentDirectory, childDirectoryName);
  } finally {
    process.chdir(previousCwd);
  }
}

function assertDirectoryMissingSync(directory: string): void {
  try {
    lstatSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }
  throw new Error('Workspace widget target already exists');
}

async function withWorkspaceWidgetWriteLock<T>(
  rootPath: string,
  write: () => Promise<T>
): Promise<T> {
  const key = path.resolve(rootPath);
  const previous = workspaceWidgetWriteQueues.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = previous
    .catch(() => {})
    .then(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
  workspaceWidgetWriteQueues.set(key, current);
  await previous.catch(() => {});
  try {
    return await write();
  } finally {
    release();
    if (workspaceWidgetWriteQueues.get(key) === current) {
      workspaceWidgetWriteQueues.delete(key);
    }
  }
}

function readWorkspaceWidgetsDirectory(rootPath: string): {
  readonly directory: string;
  readonly identity: DirectoryIdentity;
} {
  const directory = path.join(rootPath, WIDGETS_DIRECTORY);
  return {
    directory,
    identity: readSafeDirectoryIdentitySync(directory, 'Workspace widgets directory is not safe'),
  };
}

function fsyncWorkspaceDirectoryPathBestEffort(
  directory: string,
  directoryIdentity: DirectoryIdentity
) {
  runInWorkspaceDirectorySync({ directory, directoryIdentity, validateDirectoryPath: true }, () =>
    fsyncCurrentWorkspaceDirectoryBestEffort()
  );
}

function moveWorkspaceWidgetDirectory({
  sourceDirectory,
  sourceIdentity,
  targetDirectory,
}: {
  readonly sourceDirectory: string;
  readonly sourceIdentity: DirectoryIdentity;
  readonly targetDirectory: string;
}): void {
  const sourceParent = path.dirname(sourceDirectory);
  const targetParent = path.dirname(targetDirectory);
  const sourceParentIdentity = readSafeDirectoryIdentitySync(
    sourceParent,
    'Widget source parent directory is not safe'
  );
  const targetParentIdentity = readSafeDirectoryIdentitySync(
    targetParent,
    'Widget target parent directory is not safe'
  );
  assertSameDirectoryIdentitySync(sourceDirectory, sourceIdentity, 'Widget directory changed');
  assertDirectoryMissingSync(targetDirectory);
  renameSync(sourceDirectory, targetDirectory);
  assertSameDirectoryIdentitySync(targetDirectory, sourceIdentity, 'Widget directory changed');
  fsyncWorkspaceDirectoryPathBestEffort(sourceParent, sourceParentIdentity);
  if (targetParent !== sourceParent) {
    fsyncWorkspaceDirectoryPathBestEffort(targetParent, targetParentIdentity);
  }
}

function widgetIdFromDirectoryName(directoryName: string): string | null {
  const candidate = directoryName.split('--')[0] ?? '';
  return WIDGET_ID_PATTERN.test(candidate) ? candidate : null;
}

function workspaceRelativePath(rootPath: string, filePath: string): string {
  const relative = path.relative(rootPath, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Widget path escapes workspace');
  }
  return relative.split(path.sep).join('/');
}

function readWorkspaceFileDescriptor(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string,
  maxBytes: number
): { readonly byteLength: number; readonly hash: string } {
  const fd = openExistingWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile()) {
      throw new Error('Workspace widget file is not safe');
    }
    if (stats.size > maxBytes) {
      throw new Error('Workspace widget file is too large');
    }
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(Math.min(COPY_BUFFER_BYTES, Math.max(stats.size, 1)));
    let offset = 0;
    while (offset < stats.size) {
      const bytesRead = readSync(
        fd,
        buffer,
        0,
        Math.min(buffer.byteLength, stats.size - offset),
        offset
      );
      if (bytesRead <= 0) {
        throw new Error('Workspace widget file changed during read');
      }
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    assertSameDirectoryIdentitySync(directory, directoryIdentity, 'Widget directory changed');
    return { byteLength: stats.size, hash: hash.digest('hex') };
  } finally {
    closeSync(fd);
  }
}

function readWorkspaceTextFileDescriptor(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string,
  maxBytes: number
): {
  readonly birthtime: Date;
  readonly byteLength: number;
  readonly hash: string;
  readonly mtime: Date;
  readonly text: string;
} {
  const fd = openExistingWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile()) {
      throw new Error('Workspace widget file is not safe');
    }
    if (stats.size > maxBytes) {
      throw new Error('Workspace widget file is too large');
    }
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(stats.size);
    let offset = 0;
    while (offset < stats.size) {
      const bytesRead = readSync(fd, buffer, offset, stats.size - offset, offset);
      if (bytesRead <= 0) {
        throw new Error('Workspace widget file changed during read');
      }
      offset += bytesRead;
    }
    hash.update(buffer);
    assertSameDirectoryIdentitySync(directory, directoryIdentity, 'Widget directory changed');
    return {
      birthtime: stats.birthtime,
      byteLength: stats.size,
      hash: hash.digest('hex'),
      mtime: stats.mtime,
      text: buffer.toString('utf8'),
    };
  } finally {
    closeSync(fd);
  }
}

export async function readWorkspaceWidgetMarkdownFromDirectory(directory: string): Promise<string> {
  const directoryIdentity = await readSafeDirectoryIdentity(directory);
  return readWorkspaceTextFileDescriptor(
    directory,
    directoryIdentity,
    WIDGET_MARKDOWN_FILE,
    WIDGET_MARKDOWN_MAX_BYTES
  ).text;
}

function readOptionalWorkspaceFileDescriptor(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string,
  maxBytes: number
): ArtifactRuntimePreviewOptionalFileDescriptor {
  try {
    return {
      status: 'file',
      ...readWorkspaceFileDescriptor(directory, directoryIdentity, fileName, maxBytes),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'missing' };
    }
    return { status: 'missing' };
  }
}

function widgetFaultProjection({
  directory,
  reason,
  rootPath,
}: {
  readonly directory: string;
  readonly reason: 'missing-entry' | 'oversized-entry';
  readonly rootPath: string;
}): WorkspaceWidgetRuntimeFault {
  const relativeDirectory = workspaceRelativePath(rootPath, directory);
  const entryPath = `${relativeDirectory}/${ARTIFACT_RUNTIME_ENTRY_FILE}`;
  return {
    reason,
    diagnostic:
      reason === 'oversized-entry'
        ? `Workspace widget entry.html is too large at ${entryPath}.`
        : `Workspace widget is missing entry.html at ${entryPath}.`,
  };
}

function widgetIconProjection({
  widgetId,
  directory,
  directoryIdentity,
  workspaceId,
}: {
  readonly widgetId: string;
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly workspaceId: string;
}): WorkspaceWidgetProjection['icon'] {
  const assetsDirectory = path.join(directory, ARTIFACT_RUNTIME_ASSETS_DIRECTORY);
  try {
    const assetsIdentity = readSafeDirectoryIdentitySync(assetsDirectory);
    const icon = readWorkspaceFileDescriptor(
      assetsDirectory,
      assetsIdentity,
      WIDGET_ICON_FILE,
      MAX_ARTIFACT_ASSET_BYTES
    );
    assertSameDirectoryIdentitySync(directory, directoryIdentity, 'Widget directory changed');
    return {
      source: 'custom-mask',
      url: `${RENDER_SCHEME}://${workspaceWidgetRuntimeHost(
        workspaceId,
        widgetId
      )}/workspaces/${encodeURIComponent(workspaceId)}/widgets/${encodeURIComponent(
        widgetId
      )}/${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/${WIDGET_ICON_FILE}?v=${encodeURIComponent(
        icon.hash
      )}`,
      version: icon.hash,
    };
  } catch {
    return { source: 'default' };
  }
}

async function readWidgetCandidate({
  directory,
  directoryName,
  rootPath,
  workspaceId,
}: {
  readonly directory: string;
  readonly directoryName: string;
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<WidgetCandidate | null> {
  const documentPath = path.join(directory, WIDGET_MARKDOWN_FILE);
  let directoryIdentity: DirectoryIdentity;
  let markdownFile: ReturnType<typeof readWorkspaceTextFileDescriptor>;
  try {
    directoryIdentity = await readSafeDirectoryIdentity(directory);
    markdownFile = readWorkspaceTextFileDescriptor(
      directory,
      directoryIdentity,
      WIDGET_MARKDOWN_FILE,
      WIDGET_MARKDOWN_MAX_BYTES
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    return {
      ok: false,
      reviewEntries: [
        {
          category: 'widget',
          objectType: 'widget',
          kind: 'widget',
          paths: [documentPath],
          reason: 'invalid-widget',
        },
      ],
    };
  }

  let parsed: ReturnType<typeof parseWorkspaceMarkdownObject>;
  try {
    parsed = parseWorkspaceMarkdownObject({ objectType: 'widget', markdown: markdownFile.text });
  } catch {
    return {
      ok: false,
      reviewEntries: [
        {
          category: 'widget',
          objectType: 'widget',
          kind: 'widget',
          paths: [documentPath],
          reason: 'invalid-widget',
        },
      ],
    };
  }

  const widgetId = parsed.data.id ?? widgetIdFromDirectoryName(directoryName);
  if (!widgetId || !WIDGET_ID_PATTERN.test(widgetId)) {
    return {
      ok: false,
      reviewEntries: [
        {
          category: 'widget',
          objectType: 'widget',
          kind: 'widget',
          paths: [documentPath],
          reason: 'invalid-widget',
        },
      ],
    };
  }

  const base = {
    workspaceId,
    widgetId,
    type: 'widget' as const,
    format: 'html' as const,
    mount: 'workspace-rail' as const,
    title: parsed.data.title,
    createdAt: markdownFile.birthtime.toISOString(),
    updatedAt: markdownFile.mtime.toISOString(),
  };

  try {
    const entry = readWorkspaceFileDescriptor(
      directory,
      directoryIdentity,
      ARTIFACT_RUNTIME_ENTRY_FILE,
      MAX_ARTIFACT_ENTRY_BYTES
    );
    const previewVersion = await createArtifactRuntimePreviewVersion({
      directory,
      directoryIdentity,
      entry,
      readDirectoryIdentity: readSafeDirectoryIdentity,
      readOptionalFileDescriptor: readOptionalWorkspaceFileDescriptor,
      signature: 'reo-render-widget-preview-v1',
    });
    const widget: WorkspaceWidgetProjection = {
      ...base,
      icon: widgetIconProjection({
        widgetId,
        directory,
        directoryIdentity,
        workspaceId,
      }),
      entryByteLength: entry.byteLength,
      entryHash: entry.hash,
      previewVersion,
    };
    return { ok: true, widget, directory };
  } catch (error) {
    const reason =
      (error as Error).message === 'Workspace widget file is too large'
        ? 'oversized-entry'
        : 'missing-entry';
    return {
      ok: true,
      widget: {
        ...base,
        icon: { source: 'default' },
        runtimeFault: widgetFaultProjection({ directory, reason, rootPath }),
      },
      directory,
    };
  }
}

function normalizeWidgetOrder(
  order: readonly string[] | undefined,
  widgets: readonly WorkspaceWidgetProjection[]
): WorkspaceWidgetProjection[] {
  const byId = new Map(widgets.map((widget) => [widget.widgetId, widget]));
  const normalized: WorkspaceWidgetProjection[] = [];
  const normalizedIds = new Set<string>();
  for (const widgetId of order ?? []) {
    const widget = byId.get(widgetId);
    if (widget && !normalizedIds.has(widgetId)) {
      normalized.push(widget);
      normalizedIds.add(widgetId);
    }
  }
  const remaining = widgets
    .filter((widget) => !normalizedIds.has(widget.widgetId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return [...normalized, ...remaining];
}

export async function readWorkspaceWidgetsFromFileTruth({
  widgetTabOrder,
  rootPath,
  workspaceId,
}: {
  readonly widgetTabOrder?: readonly string[] | undefined;
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<{
  readonly widgets: readonly WorkspaceWidgetProjection[];
  readonly reviewEntries: readonly WorkspaceReviewEntryInput[];
}> {
  let widgetsDirectory: string;
  let entries: Dirent[];
  try {
    const directory = readWorkspaceWidgetsDirectory(rootPath);
    widgetsDirectory = directory.directory;
    entries = readWorkspaceDirectoryEntriesInDirectory({
      directory: directory.directory,
      directoryIdentity: directory.identity,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { widgets: [], reviewEntries: [] };
    }
    throw error;
  }

  const candidates: WorkspaceWidgetProjection[] = [];
  const reviewEntries: WorkspaceReviewEntryInput[] = [];
  const idPaths = new Map<string, string[]>();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const directory = path.join(widgetsDirectory, entry.name);
    const candidate = await readWidgetCandidate({
      directory,
      directoryName: entry.name,
      rootPath,
      workspaceId,
    }).catch(() => null);
    if (!candidate) {
      continue;
    }
    if (!candidate.ok) {
      reviewEntries.push(...candidate.reviewEntries);
      continue;
    }
    candidates.push(candidate.widget);
    const paths = idPaths.get(candidate.widget.widgetId) ?? [];
    paths.push(path.join(directory, WIDGET_MARKDOWN_FILE));
    idPaths.set(candidate.widget.widgetId, paths);
  }

  const duplicateIds = new Set<string>();
  for (const [widgetId, paths] of idPaths) {
    if (paths.length > 1) {
      duplicateIds.add(widgetId);
      reviewEntries.push({
        category: 'widget',
        objectType: 'widget',
        kind: 'widget',
        paths,
        reason: 'duplicate-id',
      });
    }
  }

  return {
    widgets: normalizeWidgetOrder(
      widgetTabOrder,
      candidates.filter((candidate) => !duplicateIds.has(candidate.widgetId))
    ),
    reviewEntries,
  };
}

async function readWorkspaceMetadata(rootPath: string): Promise<Record<string, unknown>> {
  const metadataPath = getWorkspaceMetadataPath(rootPath);
  const directory = path.dirname(metadataPath);
  const directoryIdentity = readSafeDirectoryIdentitySync(
    directory,
    'Workspace metadata directory is not safe'
  );
  let text: string;
  try {
    text = readWorkspaceTextFileDescriptor(
      directory,
      directoryIdentity,
      path.basename(metadataPath),
      WORKSPACE_JSON_MAX_BYTES
    ).text;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
      throw new Error('Workspace metadata is not safe', { cause: error });
    }
    throw error;
  }
  const parsed = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Workspace metadata is invalid');
  }
  return parsed as Record<string, unknown>;
}

export function workspaceWidgetOrderFromMetadata(
  metadata: Record<string, unknown>
): readonly string[] | undefined {
  const value = metadata['widgetTabOrder'];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const parsed = workspaceWidgetTabOrderItemSchema.array().safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

async function writeWorkspaceWidgetOrder({
  assertUsable,
  widgetTabOrder,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceUsable | undefined;
  readonly widgetTabOrder: readonly string[];
  readonly rootPath: string;
}): Promise<void> {
  assertWorkspaceUsable(assertUsable);
  const metadata = await readWorkspaceMetadata(rootPath);
  assertWorkspaceUsable(assertUsable);
  await writeWorkspaceJsonAtomic(
    getWorkspaceMetadataPath(rootPath),
    {
      ...metadata,
      widgetTabOrder,
    },
    () => assertWorkspaceUsable(assertUsable)
  );
}

export async function updateWorkspaceWidgetTabOrderFromFileTruth({
  assertWorkspaceUsable: assertUsable,
  widgetTabOrder,
  rootPath,
  workspaceId,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly widgetTabOrder: readonly string[];
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<{ readonly widgets: readonly WorkspaceWidgetProjection[] }> {
  return withWorkspaceWidgetWriteLock(rootPath, async () => {
    const metadata = await readWorkspaceMetadata(rootPath);
    const current = await readWorkspaceWidgetsFromFileTruth({
      widgetTabOrder: workspaceWidgetOrderFromMetadata(metadata),
      rootPath,
      workspaceId,
    });
    const normalizedWidgets = normalizeWidgetOrder(widgetTabOrder, current.widgets);
    const normalized = normalizedWidgets.map((widget) => widget.widgetId);
    await writeWorkspaceWidgetOrder({ assertUsable, widgetTabOrder: normalized, rootPath });
    return { widgets: normalizedWidgets };
  });
}

export async function resolveWorkspaceWidgetDirectoryFromFileTruth({
  widgetId,
  rootPath,
}: {
  readonly widgetId: string;
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<string> {
  const directory = readWorkspaceWidgetsDirectory(rootPath);
  const widgetsDirectory = directory.directory;
  const entries = readWorkspaceDirectoryEntriesInDirectory({
    directory: directory.directory,
    directoryIdentity: directory.identity,
  });
  const matches: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const directory = path.join(widgetsDirectory, entry.name);
    const markdown = await readWorkspaceWidgetMarkdownFromDirectory(directory).catch(() => null);
    if (!markdown) {
      continue;
    }
    const parsed = (() => {
      try {
        return parseWorkspaceMarkdownObject({ objectType: 'widget', markdown });
      } catch {
        return null;
      }
    })();
    const parsedWidgetId = parsed?.data.id ?? widgetIdFromDirectoryName(entry.name);
    if (parsedWidgetId === widgetId) {
      matches.push(directory);
    }
  }
  if (matches.length > 1) {
    throw new Error('Workspace widget id is duplicated');
  }
  if (matches.length === 1) {
    return matches[0] as string;
  }
  throw new Error('Workspace widget not found');
}

export async function updateWorkspaceWidgetTitleFromFileTruth({
  assertWorkspaceUsable: assertUsable,
  widgetId,
  rootPath,
  title,
  workspaceId,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly widgetId: string;
  readonly rootPath: string;
  readonly title: string;
  readonly workspaceId: string;
}): Promise<{
  readonly widget: WorkspaceWidgetProjection;
  readonly widgets: readonly WorkspaceWidgetProjection[];
}> {
  return withWorkspaceWidgetWriteLock(rootPath, async () => {
    const directory = await resolveWorkspaceWidgetDirectoryFromFileTruth({
      widgetId,
      rootPath,
      workspaceId,
    });
    const markdownPath = path.join(directory, WIDGET_MARKDOWN_FILE);
    const markdown = await readWorkspaceWidgetMarkdownFromDirectory(directory);
    const parsed = parseWorkspaceMarkdownObject({ objectType: 'widget', markdown });
    const rendered = renderWorkspaceMarkdownObject({
      objectType: 'widget',
      data: { ...parsed.data, title },
      content: parsed.content,
    });
    assertWorkspaceUsable(assertUsable);
    await writeWorkspaceFileAtomic(markdownPath, rendered, () =>
      assertWorkspaceUsable(assertUsable)
    );
    const metadata = await readWorkspaceMetadata(rootPath);
    const result = await readWorkspaceWidgetsFromFileTruth({
      widgetTabOrder: workspaceWidgetOrderFromMetadata(metadata),
      rootPath,
      workspaceId,
    });
    const widget = result.widgets.find((candidate) => candidate.widgetId === widgetId);
    if (!widget) {
      throw new Error('Workspace widget not found');
    }
    return { widget, widgets: result.widgets };
  });
}

function ensureWidgetTrashDirectory(
  rootPath: string,
  assertUsable: AssertWorkspaceUsable | undefined
): string {
  const reoDirectory = ensureSafeChildDirectorySync(rootPath, '.reo', assertUsable);
  const trashRoot = ensureSafeChildDirectorySync(reoDirectory, 'trash', assertUsable);
  return ensureSafeChildDirectorySync(trashRoot, WIDGETS_DIRECTORY, assertUsable);
}

function restoredWidgetDirectoryName(widgetId: string, title: string): string {
  const trimmedTitle = title.trim();
  const titlePart =
    trimmedTitle.length > 0 && isSafeWorkspaceDirectoryName(trimmedTitle) ? trimmedTitle : '';
  return titlePart ? `${widgetId}--${titlePart}` : widgetId;
}

export async function deleteWorkspaceWidgetFromFileTruth({
  assertWorkspaceUsable: assertUsable,
  widgetId,
  rootPath,
  workspaceId,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly widgetId: string;
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<{
  readonly widgets: readonly WorkspaceWidgetProjection[];
  readonly restoreToken: string;
}> {
  return withWorkspaceWidgetWriteLock(rootPath, async () => {
    const sourceDirectory = await resolveWorkspaceWidgetDirectoryFromFileTruth({
      widgetId,
      rootPath,
      workspaceId,
    });
    const trashDirectory = ensureWidgetTrashDirectory(rootPath, assertUsable);
    const targetDirectory = path.join(trashDirectory, widgetId);
    const sourceIdentity = readSafeDirectoryIdentitySync(
      sourceDirectory,
      'Widget directory is not safe'
    );
    let movedToTrash = false;
    try {
      assertWorkspaceUsable(assertUsable);
      moveWorkspaceWidgetDirectory({
        sourceDirectory,
        sourceIdentity,
        targetDirectory,
      });
      movedToTrash = true;
      const metadata = await readWorkspaceMetadata(rootPath);
      const result = await readWorkspaceWidgetsFromFileTruth({
        widgetTabOrder: workspaceWidgetOrderFromMetadata(metadata),
        rootPath,
        workspaceId,
      });
      const nextOrder = result.widgets.map((widget) => widget.widgetId);
      await writeWorkspaceWidgetOrder({ assertUsable, widgetTabOrder: nextOrder, rootPath });
      movedToTrash = false;
      return { widgets: result.widgets, restoreToken: widgetId };
    } catch (error) {
      if (movedToTrash) {
        try {
          moveWorkspaceWidgetDirectory({
            sourceDirectory: targetDirectory,
            sourceIdentity,
            targetDirectory: sourceDirectory,
          });
        } catch {
          // Preserve the original mutation failure for the IPC caller.
        }
      }
      throw error;
    }
  });
}

export async function restoreDeletedWorkspaceWidgetFromFileTruth({
  assertWorkspaceUsable: assertUsable,
  restoreToken,
  rootPath,
  workspaceId,
}: {
  readonly assertWorkspaceUsable?: AssertWorkspaceUsable;
  readonly restoreToken: string;
  readonly rootPath: string;
  readonly workspaceId: string;
}): Promise<{
  readonly widget: WorkspaceWidgetProjection;
  readonly widgets: readonly WorkspaceWidgetProjection[];
}> {
  return withWorkspaceWidgetWriteLock(rootPath, async () => {
    const trashDirectory = path.join(rootPath, '.reo', 'trash', WIDGETS_DIRECTORY);
    const sourceDirectory = path.join(trashDirectory, restoreToken);
    const markdown = await readWorkspaceWidgetMarkdownFromDirectory(sourceDirectory);
    const parsed = parseWorkspaceMarkdownObject({ objectType: 'widget', markdown });
    const widgetsDirectory = ensureSafeChildDirectorySync(
      rootPath,
      WIDGETS_DIRECTORY,
      assertUsable
    );
    const targetDirectory = path.join(
      widgetsDirectory,
      restoredWidgetDirectoryName(restoreToken, parsed.data.title)
    );
    const sourceIdentity = readSafeDirectoryIdentitySync(
      sourceDirectory,
      'Widget trash directory is not safe'
    );
    let movedToActive = false;
    try {
      assertWorkspaceUsable(assertUsable);
      moveWorkspaceWidgetDirectory({
        sourceDirectory,
        sourceIdentity,
        targetDirectory,
      });
      movedToActive = true;
      const metadata = await readWorkspaceMetadata(rootPath);
      const result = await readWorkspaceWidgetsFromFileTruth({
        widgetTabOrder: workspaceWidgetOrderFromMetadata(metadata),
        rootPath,
        workspaceId,
      });
      const widget = result.widgets.find((candidate) => candidate.widgetId === restoreToken);
      if (!widget) {
        throw new Error('Workspace widget not found');
      }
      await writeWorkspaceWidgetOrder({
        assertUsable,
        widgetTabOrder: result.widgets.map((candidate) => candidate.widgetId),
        rootPath,
      });
      movedToActive = false;
      return { widget, widgets: result.widgets };
    } catch (error) {
      if (movedToActive) {
        try {
          moveWorkspaceWidgetDirectory({
            sourceDirectory: targetDirectory,
            sourceIdentity,
            targetDirectory: sourceDirectory,
          });
        } catch {
          // Preserve the original mutation failure for the IPC caller.
        }
      }
      throw error;
    }
  });
}

export function widgetDocumentPath(directory: string): string {
  return path.join(directory, WIDGET_MARKDOWN_FILE);
}
