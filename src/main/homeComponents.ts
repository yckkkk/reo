import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  readSync,
  renameSync,
  type Dirent,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  ARTIFACT_RUNTIME_ASSETS_DIRECTORY,
  ARTIFACT_RUNTIME_ENTRY_FILE,
  homeComponentRuntimeHost,
} from './artifactUrl.js';
import { MAX_ARTIFACT_ASSET_BYTES, MAX_ARTIFACT_ENTRY_BYTES } from './artifactLimits.js';
import {
  createArtifactRuntimePreviewVersion,
  type ArtifactRuntimePreviewOptionalFileDescriptor,
} from './artifactRuntimePreview.js';
import { writeWorkspaceFileAtomic, writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import {
  assertSameDirectoryIdentitySync,
  readSafeDirectoryIdentitySync,
  type DirectoryIdentity,
} from './directoryIdentity.js';
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
  HOME_COMPONENT_ID_PATTERN,
  HOME_RECENT_EXPRESSIONS_COMPONENT_ID,
  isSafeWorkspaceDirectoryName,
  workspaceHomeComponentShellStateSchema,
  type WorkspaceHomeComponentProjection,
  type WorkspaceHomeComponentShellState,
} from '../workspace-contract/workspace-contract.js';
import { RENDER_SCHEME } from '../workspace-contract/artifact-runtime-url.js';

const HOME_COMPONENTS_DIRECTORY = 'home-components';
const HOME_COMPONENTS_TRASH_DIRECTORY = 'home-components-trash';
const HOME_COMPONENT_MARKDOWN_FILE = 'component.md';
const HOME_COMPONENT_ICON_FILE = 'icon.svg';
const HOME_COMPONENT_MARKDOWN_MAX_BYTES = 262_144;
const HOME_COMPONENTS_CONFIG_FILE = 'home-components.json';
const HOME_COMPONENTS_CONFIG_MAX_BYTES = 1_048_576;
const COPY_BUFFER_BYTES = 1_048_576;

const homeComponentWriteQueues = new Map<string, Promise<void>>();

type HomeComponentRuntimeFault = NonNullable<WorkspaceHomeComponentProjection['runtimeFault']>;

type HomeComponentCandidate =
  | {
      readonly ok: true;
      readonly component: WorkspaceHomeComponentProjection;
      readonly directory: string;
    }
  | {
      readonly ok: false;
    };

function defaultHomeComponentShellState(): WorkspaceHomeComponentShellState {
  return {
    componentTabOrder: [],
    lastActiveComponentId: HOME_RECENT_EXPRESSIONS_COMPONENT_ID,
  };
}

function ensureSafeChildDirectorySync(parentDirectory: string, childDirectoryName: string): string {
  const previousCwd = process.cwd();
  const parentIdentity = readSafeDirectoryIdentitySync(
    parentDirectory,
    'Home component parent directory is not safe'
  );
  try {
    process.chdir(parentDirectory);
    assertSameDirectoryIdentitySync(
      parentDirectory,
      parentIdentity,
      'Home component parent changed'
    );
    try {
      mkdirSync(childDirectoryName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
    const entry = lstatSync(childDirectoryName);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error('Home component child directory is not safe');
    }
    assertSameDirectoryIdentitySync(
      parentDirectory,
      parentIdentity,
      'Home component parent changed'
    );
    return path.join(parentDirectory, childDirectoryName);
  } finally {
    process.chdir(previousCwd);
  }
}

async function withHomeComponentWriteLock<T>(
  appDataRootPath: string,
  write: () => Promise<T>
): Promise<T> {
  const key = path.resolve(appDataRootPath);
  const previous = homeComponentWriteQueues.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = previous
    .catch(() => {})
    .then(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
  homeComponentWriteQueues.set(key, current);
  await previous.catch(() => {});
  try {
    return await write();
  } finally {
    release();
    if (homeComponentWriteQueues.get(key) === current) {
      homeComponentWriteQueues.delete(key);
    }
  }
}

function readHomeComponentsDirectory(appDataRootPath: string): {
  readonly directory: string;
  readonly identity: DirectoryIdentity;
} {
  const directory = path.join(appDataRootPath, HOME_COMPONENTS_DIRECTORY);
  return {
    directory,
    identity: readSafeDirectoryIdentitySync(directory, 'Home components directory is not safe'),
  };
}

function fsyncDirectoryPathBestEffort(directory: string, directoryIdentity: DirectoryIdentity) {
  runInWorkspaceDirectorySync({ directory, directoryIdentity, validateDirectoryPath: true }, () =>
    fsyncCurrentWorkspaceDirectoryBestEffort()
  );
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
  throw new Error('Home component target already exists');
}

function moveHomeComponentDirectory({
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
    'Home component source parent directory is not safe'
  );
  const targetParentIdentity = readSafeDirectoryIdentitySync(
    targetParent,
    'Home component target parent directory is not safe'
  );
  assertSameDirectoryIdentitySync(
    sourceDirectory,
    sourceIdentity,
    'Home component directory changed'
  );
  assertDirectoryMissingSync(targetDirectory);
  renameSync(sourceDirectory, targetDirectory);
  assertSameDirectoryIdentitySync(
    targetDirectory,
    sourceIdentity,
    'Home component directory changed'
  );
  fsyncDirectoryPathBestEffort(sourceParent, sourceParentIdentity);
  if (sourceParent !== targetParent) {
    fsyncDirectoryPathBestEffort(targetParent, targetParentIdentity);
  }
}

function homeComponentIdFromDirectoryName(directoryName: string): string | null {
  const candidate = directoryName.split('--')[0] ?? '';
  return HOME_COMPONENT_ID_PATTERN.test(candidate) ? candidate : null;
}

function readTextFileDescriptor(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string,
  maxBytes: number
): { readonly byteLength: number; readonly hash: string; readonly text: string } {
  const fd = openExistingWorkspaceFileInDirectory({
    directory,
    directoryIdentity,
    fileName,
    flags: constants.O_RDONLY | constants.O_NOFOLLOW,
  });
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile() || stats.size > maxBytes) {
      throw new Error('Home component file is not safe');
    }
    const raw = Buffer.allocUnsafe(stats.size);
    let offset = 0;
    while (offset < stats.size) {
      const bytesRead = readSync(fd, raw, offset, stats.size - offset, offset);
      if (bytesRead === 0) {
        throw new Error('Home component file changed during read');
      }
      offset += bytesRead;
    }
    assertSameDirectoryIdentitySync(
      directory,
      directoryIdentity,
      'Home component directory changed'
    );
    return {
      byteLength: stats.size,
      hash: createHash('sha256').update(raw).digest('hex'),
      text: raw.toString('utf8'),
    };
  } finally {
    closeSync(fd);
  }
}

function readFileDescriptor(
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
      throw new Error('Home component file is not safe');
    }
    if (stats.size > maxBytes) {
      throw new Error('Home component file is too large');
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
      if (bytesRead === 0) {
        throw new Error('Home component file changed during read');
      }
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    assertSameDirectoryIdentitySync(
      directory,
      directoryIdentity,
      'Home component directory changed'
    );
    return { byteLength: stats.size, hash: hash.digest('hex') };
  } finally {
    closeSync(fd);
  }
}

function readHomeComponentMarkdownFromDirectory(directory: string): Promise<string> {
  const directoryIdentity = readSafeDirectoryIdentitySync(
    directory,
    'Home component directory is not safe'
  );
  return Promise.resolve(
    readTextFileDescriptor(
      directory,
      directoryIdentity,
      HOME_COMPONENT_MARKDOWN_FILE,
      HOME_COMPONENT_MARKDOWN_MAX_BYTES
    ).text
  );
}

async function readHomeComponentIdFromDirectory(directory: string): Promise<string | null> {
  const markdown = await readHomeComponentMarkdownFromDirectory(directory).catch(() => null);
  if (!markdown) {
    return null;
  }
  const parsed = (() => {
    try {
      return parseWorkspaceMarkdownObject({ objectType: 'home-component', markdown });
    } catch {
      return null;
    }
  })();
  return parsed?.data.id ?? null;
}

function readOptionalFileDescriptor(
  directory: string,
  directoryIdentity: DirectoryIdentity,
  fileName: string,
  maxBytes: number
): ArtifactRuntimePreviewOptionalFileDescriptor {
  try {
    return {
      status: 'file',
      ...readFileDescriptor(directory, directoryIdentity, fileName, maxBytes),
    };
  } catch {
    return { status: 'missing' };
  }
}

function homeComponentIconProjection({
  componentId,
  directory,
}: {
  readonly componentId: string;
  readonly directory: string;
}): WorkspaceHomeComponentProjection['icon'] {
  try {
    const assetsDirectory = path.join(directory, ARTIFACT_RUNTIME_ASSETS_DIRECTORY);
    const assetsIdentity = readSafeDirectoryIdentitySync(
      assetsDirectory,
      'Home component assets directory is not safe'
    );
    const icon = readFileDescriptor(
      assetsDirectory,
      assetsIdentity,
      HOME_COMPONENT_ICON_FILE,
      MAX_ARTIFACT_ASSET_BYTES
    );
    return {
      source: 'custom-mask',
      url: `${RENDER_SCHEME}://${homeComponentRuntimeHost(
        componentId
      )}/${HOME_COMPONENTS_DIRECTORY}/${encodeURIComponent(
        componentId
      )}/${ARTIFACT_RUNTIME_ASSETS_DIRECTORY}/${HOME_COMPONENT_ICON_FILE}?v=${encodeURIComponent(
        icon.hash
      )}`,
      version: icon.hash,
    };
  } catch {
    return { source: 'default' };
  }
}

function runtimeFaultForEntry(error: unknown): HomeComponentRuntimeFault {
  return {
    reason:
      (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing-entry' : 'oversized-entry',
    diagnostic:
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'entry.html is missing'
        : 'entry.html is too large or unsafe',
  };
}

async function readHomeComponentCandidate({
  directory,
}: {
  readonly directory: string;
}): Promise<HomeComponentCandidate | null> {
  const directoryIdentity = readSafeDirectoryIdentitySync(
    directory,
    'Home component directory is not safe'
  );
  const directoryStats = lstatSync(directory);
  if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
    return null;
  }
  const markdown = readTextFileDescriptor(
    directory,
    directoryIdentity,
    HOME_COMPONENT_MARKDOWN_FILE,
    HOME_COMPONENT_MARKDOWN_MAX_BYTES
  );
  let parsed: ReturnType<typeof parseWorkspaceMarkdownObject>;
  try {
    parsed = parseWorkspaceMarkdownObject({
      objectType: 'home-component',
      markdown: markdown.text,
    });
  } catch {
    return { ok: false };
  }
  const componentId = parsed.data.id;
  if (!componentId) {
    return { ok: false };
  }
  const title = parsed.data.title.trim();
  if (!title) {
    return { ok: false };
  }
  const createdAt = directoryStats.birthtime.toISOString();
  const updatedAt = directoryStats.mtime.toISOString();
  const base = {
    componentId,
    type: 'home-component' as const,
    format: 'html' as const,
    mount: 'home' as const,
    title,
    createdAt,
    updatedAt,
  };
  try {
    const entry = readFileDescriptor(
      directory,
      directoryIdentity,
      ARTIFACT_RUNTIME_ENTRY_FILE,
      MAX_ARTIFACT_ENTRY_BYTES
    );
    const previewVersion = await createArtifactRuntimePreviewVersion({
      directory,
      directoryIdentity,
      entry,
      readDirectoryEntries: (assetsDirectory, assetsDirectoryIdentity) =>
        readWorkspaceDirectoryEntriesInDirectory({
          directory: assetsDirectory,
          directoryIdentity: assetsDirectoryIdentity,
        }),
      readDirectoryIdentity: (assetsDirectory) =>
        readSafeDirectoryIdentitySync(
          assetsDirectory,
          'Home component assets directory is not safe'
        ),
      readOptionalFileDescriptor,
      signature: 'reo-render-home-component-preview-v1',
    });
    return {
      ok: true,
      component: {
        ...base,
        icon: homeComponentIconProjection({ componentId, directory }),
        entryByteLength: entry.byteLength,
        entryHash: entry.hash,
        previewVersion,
      },
      directory,
    };
  } catch (error) {
    return {
      ok: true,
      component: {
        ...base,
        icon: { source: 'default' },
        runtimeFault: runtimeFaultForEntry(error),
      },
      directory,
    };
  }
}

function normalizeComponentOrder(
  componentTabOrder: readonly string[] | undefined,
  components: readonly WorkspaceHomeComponentProjection[]
): readonly WorkspaceHomeComponentProjection[] {
  const componentsById = new Map(components.map((component) => [component.componentId, component]));
  const ordered: WorkspaceHomeComponentProjection[] = [];
  const seen = new Set<string>();
  for (const componentId of componentTabOrder ?? []) {
    const component = componentsById.get(componentId);
    if (component && !seen.has(component.componentId)) {
      ordered.push(component);
      seen.add(component.componentId);
    }
  }
  const remaining = components
    .filter((component) => !seen.has(component.componentId))
    .sort(
      (left, right) =>
        left.title.localeCompare(right.title) || left.componentId.localeCompare(right.componentId)
    );
  return [...ordered, ...remaining];
}

function readHomeComponentsConfig(appDataRootPath: string): WorkspaceHomeComponentShellState {
  const appRootIdentity = readSafeDirectoryIdentitySync(
    appDataRootPath,
    'Home components app data root is not safe'
  );
  try {
    const text = readTextFileDescriptor(
      appDataRootPath,
      appRootIdentity,
      HOME_COMPONENTS_CONFIG_FILE,
      HOME_COMPONENTS_CONFIG_MAX_BYTES
    ).text;
    const parsed = JSON.parse(text) as unknown;
    const candidate =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? {
            componentTabOrder: (parsed as Record<string, unknown>)['componentTabOrder'],
            lastActiveComponentId: (parsed as Record<string, unknown>)['lastActiveComponentId'],
          }
        : parsed;
    const result = workspaceHomeComponentShellStateSchema.safeParse(candidate);
    return result.success ? result.data : defaultHomeComponentShellState();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultHomeComponentShellState();
    }
    throw error;
  }
}

async function writeHomeComponentsConfig({
  appDataRootPath,
  shellState,
}: {
  readonly appDataRootPath: string;
  readonly shellState: WorkspaceHomeComponentShellState;
}): Promise<void> {
  await writeWorkspaceJsonAtomic(path.join(appDataRootPath, HOME_COMPONENTS_CONFIG_FILE), {
    schemaVersion: 1,
    componentTabOrder: shellState.componentTabOrder,
    lastActiveComponentId: shellState.lastActiveComponentId,
  });
}

export function readHomeComponentShellStateFromFileTruth({
  appDataRootPath,
}: {
  readonly appDataRootPath: string;
}): WorkspaceHomeComponentShellState {
  return readHomeComponentsConfig(appDataRootPath);
}

export async function readHomeComponentsFromFileTruth({
  appDataRootPath,
  componentTabOrder,
}: {
  readonly appDataRootPath: string;
  readonly componentTabOrder?: readonly string[] | undefined;
}): Promise<{
  readonly components: readonly WorkspaceHomeComponentProjection[];
}> {
  let componentsDirectory: string;
  let entries: Dirent[];
  try {
    const directory = readHomeComponentsDirectory(appDataRootPath);
    componentsDirectory = directory.directory;
    entries = readWorkspaceDirectoryEntriesInDirectory({
      directory: directory.directory,
      directoryIdentity: directory.identity,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { components: [] };
    }
    throw error;
  }

  const candidates: WorkspaceHomeComponentProjection[] = [];
  const idPaths = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const directory = path.join(componentsDirectory, entry.name);
    const candidate = await readHomeComponentCandidate({ directory }).catch(() => null);
    if (!candidate?.ok) {
      continue;
    }
    candidates.push(candidate.component);
    const paths = idPaths.get(candidate.component.componentId) ?? [];
    paths.push(path.join(directory, HOME_COMPONENT_MARKDOWN_FILE));
    idPaths.set(candidate.component.componentId, paths);
  }
  const duplicateIds = new Set(
    [...idPaths.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([componentId]) => componentId)
  );
  return {
    components: normalizeComponentOrder(
      componentTabOrder,
      candidates.filter((candidate) => !duplicateIds.has(candidate.componentId))
    ),
  };
}

function normalizeShellState({
  requestedOrder,
  requestedLastActiveComponentId,
  components,
}: {
  readonly requestedOrder: readonly string[];
  readonly requestedLastActiveComponentId: string;
  readonly components: readonly WorkspaceHomeComponentProjection[];
}): WorkspaceHomeComponentShellState {
  const componentIds = new Set(components.map((component) => component.componentId));
  const componentTabOrder = requestedOrder.filter(
    (componentId, index, values) =>
      componentIds.has(componentId) && values.indexOf(componentId) === index
  );
  return {
    componentTabOrder,
    lastActiveComponentId:
      requestedLastActiveComponentId === HOME_RECENT_EXPRESSIONS_COMPONENT_ID ||
      componentIds.has(requestedLastActiveComponentId)
        ? requestedLastActiveComponentId
        : HOME_RECENT_EXPRESSIONS_COMPONENT_ID,
  };
}

export async function updateHomeComponentTabOrderFromFileTruth({
  appDataRootPath,
  componentTabOrder,
  lastActiveComponentId,
}: {
  readonly appDataRootPath: string;
  readonly componentTabOrder: readonly string[];
  readonly lastActiveComponentId: string;
}): Promise<{
  readonly components: readonly WorkspaceHomeComponentProjection[];
  readonly shellState: WorkspaceHomeComponentShellState;
}> {
  return withHomeComponentWriteLock(appDataRootPath, async () => {
    const current = await readHomeComponentsFromFileTruth({ appDataRootPath });
    const shellState = normalizeShellState({
      requestedOrder: componentTabOrder,
      requestedLastActiveComponentId: lastActiveComponentId,
      components: current.components,
    });
    await writeHomeComponentsConfig({ appDataRootPath, shellState });
    return {
      components: normalizeComponentOrder(shellState.componentTabOrder, current.components),
      shellState,
    };
  });
}

export async function resolveHomeComponentDirectoryFromFileTruth({
  appDataRootPath,
  componentId,
}: {
  readonly appDataRootPath: string;
  readonly componentId: string;
}): Promise<string> {
  const directory = readHomeComponentsDirectory(appDataRootPath);
  const entries = readWorkspaceDirectoryEntriesInDirectory({
    directory: directory.directory,
    directoryIdentity: directory.identity,
  });

  const prefixedMatches = entries.filter(
    (entry) => entry.isDirectory() && homeComponentIdFromDirectoryName(entry.name) === componentId
  );
  if (prefixedMatches.length > 0) {
    const matches: string[] = [];
    for (const entry of prefixedMatches) {
      const componentDirectory = path.join(directory.directory, entry.name);
      const parsedComponentId = await readHomeComponentIdFromDirectory(componentDirectory);
      if (parsedComponentId === componentId) {
        matches.push(componentDirectory);
      }
    }
    if (matches.length > 1) {
      throw new Error('Home component id is duplicated');
    }
    if (matches.length === 1) {
      return matches[0] as string;
    }
  }

  const matches: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const componentDirectory = path.join(directory.directory, entry.name);
    const parsedComponentId = await readHomeComponentIdFromDirectory(componentDirectory);
    if (parsedComponentId === componentId) {
      matches.push(componentDirectory);
    }
  }
  if (matches.length > 1) {
    throw new Error('Home component id is duplicated');
  }
  if (matches.length === 1) {
    return matches[0] as string;
  }
  throw new Error('Home component not found');
}

export async function updateHomeComponentTitleFromFileTruth({
  appDataRootPath,
  componentId,
  title,
}: {
  readonly appDataRootPath: string;
  readonly componentId: string;
  readonly title: string;
}): Promise<{
  readonly component: WorkspaceHomeComponentProjection;
  readonly components: readonly WorkspaceHomeComponentProjection[];
}> {
  return withHomeComponentWriteLock(appDataRootPath, async () => {
    const directory = await resolveHomeComponentDirectoryFromFileTruth({
      appDataRootPath,
      componentId,
    });
    const markdownPath = path.join(directory, HOME_COMPONENT_MARKDOWN_FILE);
    const markdown = await readHomeComponentMarkdownFromDirectory(directory);
    const parsed = parseWorkspaceMarkdownObject({ objectType: 'home-component', markdown });
    const rendered = renderWorkspaceMarkdownObject({
      objectType: 'home-component',
      data: { ...parsed.data, title },
      content: parsed.content,
    });
    await writeWorkspaceFileAtomic(markdownPath, rendered);
    const shellState = readHomeComponentsConfig(appDataRootPath);
    const result = await readHomeComponentsFromFileTruth({
      appDataRootPath,
      componentTabOrder: shellState.componentTabOrder,
    });
    const component = result.components.find((candidate) => candidate.componentId === componentId);
    if (!component) {
      throw new Error('Home component not found');
    }
    return { component, components: result.components };
  });
}

function ensureHomeComponentTrashDirectory(appDataRootPath: string): string {
  return ensureSafeChildDirectorySync(appDataRootPath, HOME_COMPONENTS_TRASH_DIRECTORY);
}

function restoredHomeComponentDirectoryName(componentId: string, title: string): string {
  const trimmedTitle = title.trim();
  const titlePart =
    trimmedTitle.length > 0 && isSafeWorkspaceDirectoryName(trimmedTitle) ? trimmedTitle : '';
  return titlePart ? `${componentId}--${titlePart}` : componentId;
}

export async function deleteHomeComponentFromFileTruth({
  appDataRootPath,
  componentId,
}: {
  readonly appDataRootPath: string;
  readonly componentId: string;
}): Promise<{
  readonly components: readonly WorkspaceHomeComponentProjection[];
  readonly restoreToken: string;
}> {
  return withHomeComponentWriteLock(appDataRootPath, async () => {
    const sourceDirectory = await resolveHomeComponentDirectoryFromFileTruth({
      appDataRootPath,
      componentId,
    });
    const sourceIdentity = readSafeDirectoryIdentitySync(
      sourceDirectory,
      'Home component directory is not safe'
    );
    const trashDirectory = ensureHomeComponentTrashDirectory(appDataRootPath);
    const targetDirectory = path.join(trashDirectory, componentId);
    let movedToTrash = false;
    try {
      moveHomeComponentDirectory({ sourceDirectory, sourceIdentity, targetDirectory });
      movedToTrash = true;
      const shellState = readHomeComponentsConfig(appDataRootPath);
      const result = await readHomeComponentsFromFileTruth({
        appDataRootPath,
        componentTabOrder: shellState.componentTabOrder.filter(
          (candidate) => candidate !== componentId
        ),
      });
      const nextShellState = normalizeShellState({
        requestedOrder: result.components.map((component) => component.componentId),
        requestedLastActiveComponentId:
          shellState.lastActiveComponentId === componentId
            ? HOME_RECENT_EXPRESSIONS_COMPONENT_ID
            : shellState.lastActiveComponentId,
        components: result.components,
      });
      await writeHomeComponentsConfig({ appDataRootPath, shellState: nextShellState });
      movedToTrash = false;
      return { components: result.components, restoreToken: componentId };
    } catch (error) {
      if (movedToTrash) {
        try {
          moveHomeComponentDirectory({
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

export async function restoreDeletedHomeComponentFromFileTruth({
  appDataRootPath,
  restoreToken,
}: {
  readonly appDataRootPath: string;
  readonly restoreToken: string;
}): Promise<{
  readonly component: WorkspaceHomeComponentProjection;
  readonly components: readonly WorkspaceHomeComponentProjection[];
}> {
  return withHomeComponentWriteLock(appDataRootPath, async () => {
    const trashDirectory = ensureHomeComponentTrashDirectory(appDataRootPath);
    const sourceDirectory = path.join(trashDirectory, restoreToken);
    const sourceIdentity = readSafeDirectoryIdentitySync(
      sourceDirectory,
      'Home component trash directory is not safe'
    );
    const markdown = await readHomeComponentMarkdownFromDirectory(sourceDirectory);
    const parsed = parseWorkspaceMarkdownObject({ objectType: 'home-component', markdown });
    if (parsed.data.id !== restoreToken) {
      throw new Error('Home component restore token does not match metadata');
    }
    const title = parsed.data.title;
    const targetRoot = ensureSafeChildDirectorySync(appDataRootPath, HOME_COMPONENTS_DIRECTORY);
    const targetDirectory = path.join(
      targetRoot,
      restoredHomeComponentDirectoryName(restoreToken, title)
    );
    let movedToActive = false;
    try {
      moveHomeComponentDirectory({ sourceDirectory, sourceIdentity, targetDirectory });
      movedToActive = true;
      const shellState = readHomeComponentsConfig(appDataRootPath);
      const requestedOrder = [...shellState.componentTabOrder, restoreToken];
      const result = await readHomeComponentsFromFileTruth({
        appDataRootPath,
        componentTabOrder: requestedOrder,
      });
      const component = result.components.find(
        (candidate) => candidate.componentId === restoreToken
      );
      if (!component) {
        throw new Error('Home component not found');
      }
      await writeHomeComponentsConfig({
        appDataRootPath,
        shellState: normalizeShellState({
          requestedOrder: result.components.map((candidate) => candidate.componentId),
          requestedLastActiveComponentId: restoreToken,
          components: result.components,
        }),
      });
      movedToActive = false;
      return { component, components: result.components };
    } catch (error) {
      if (movedToActive) {
        try {
          moveHomeComponentDirectory({
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
