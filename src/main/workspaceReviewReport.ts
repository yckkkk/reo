import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { writeWorkspaceFileAtomic, writeWorkspaceJsonAtomic } from './atomicWorkspaceFile.js';
import { readSafeDirectoryIdentitySync, type DirectoryIdentity } from './directoryIdentity.js';
import {
  fsyncCurrentWorkspaceDirectoryBestEffort,
  openExistingWorkspaceFileInDirectory,
  runInWorkspaceDirectorySync,
} from './workspaceDirectoryTransactions.js';
import type { WorkspaceReviewSummary } from '../workspace-contract/workspace-contract.js';

export type WorkspaceReviewEntryCategory =
  | 'markdown-segment'
  | 'markdown-supplement'
  | 'tiptap-sidecar';

export type WorkspaceReviewEntryReason =
  | 'ambiguous-candidate'
  | 'content-conflict'
  | 'duplicate-id'
  | 'invalid-sidecar'
  | 'markdown-write-required'
  | 'unsupported-tiptap-content';

export type WorkspaceReviewEntryInput = {
  readonly category: WorkspaceReviewEntryCategory;
  readonly reason: WorkspaceReviewEntryReason;
  readonly objectType?: 'segment' | 'supplement';
  readonly kind?: 'audio' | 'note';
  readonly paths: readonly string[];
};

export type WorkspaceReviewEntry = WorkspaceReviewEntryInput & {
  readonly paths: readonly string[];
};

export type WorkspaceReviewReport = {
  readonly schemaVersion: 1;
  readonly updatedAt: string;
  readonly summary: WorkspaceReviewSummary;
  readonly entries: readonly WorkspaceReviewEntry[];
};

type AssertWorkspaceFileUsable = () => void;

const REVIEW_DIRECTORY = '.reo/review';
const REVIEW_JSON_FILE = 'needs-review.json';
const REVIEW_MARKDOWN_FILE = 'needs-review.md';

function workspaceRelativePath(rootPath: string, filePath: string): string {
  const root = path.resolve(rootPath);
  const resolved = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(root, filePath);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Review path escapes workspace');
  }
  return relative.split(path.sep).join('/');
}

function normalizeEntry(rootPath: string, entry: WorkspaceReviewEntryInput): WorkspaceReviewEntry {
  const paths = [
    ...new Set(entry.paths.map((filePath) => workspaceRelativePath(rootPath, filePath))),
  ].filter(Boolean);
  if (paths.length === 0) {
    throw new Error('Review entry must include at least one path');
  }
  return {
    category: entry.category,
    reason: entry.reason,
    ...(entry.objectType ? { objectType: entry.objectType } : {}),
    ...(entry.kind ? { kind: entry.kind } : {}),
    paths,
  };
}

function entryKey(entry: WorkspaceReviewEntry): string {
  return [
    entry.category,
    entry.reason,
    entry.objectType ?? '',
    entry.kind ?? '',
    entry.paths.join('\u0000'),
  ].join('\u0001');
}

function normalizeEntries(
  rootPath: string,
  entries: readonly WorkspaceReviewEntryInput[]
): WorkspaceReviewEntry[] {
  const byKey = new Map<string, WorkspaceReviewEntry>();
  for (const entry of entries) {
    const normalized = normalizeEntry(rootPath, entry);
    byKey.set(entryKey(normalized), normalized);
  }
  return [...byKey.values()].sort((left, right) => entryKey(left).localeCompare(entryKey(right)));
}

function summarizeEntries(entries: readonly WorkspaceReviewEntry[]): WorkspaceReviewSummary {
  return {
    needsReviewCount: entries.length,
    markdownCandidateCount: entries.filter(
      (entry) => entry.category === 'markdown-segment' || entry.category === 'markdown-supplement'
    ).length,
    tiptapSidecarCount: entries.filter((entry) => entry.category === 'tiptap-sidecar').length,
  };
}

function renderPathForMarkdown(filePath: string): string {
  return JSON.stringify(filePath).replaceAll('`', '\\u0060');
}

function renderReviewMarkdown(report: WorkspaceReviewReport): string {
  const lines = [
    '# Reo needs review',
    '',
    `Unresolved items: ${report.summary.needsReviewCount}`,
    '',
  ];
  for (const entry of report.entries) {
    const detail = [entry.category, entry.reason, entry.objectType, entry.kind]
      .filter(Boolean)
      .join(' / ');
    lines.push(`- ${detail}`);
    for (const filePath of entry.paths) {
      lines.push(`  - path: ${renderPathForMarkdown(filePath)}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function readExistingReviewText({
  directory,
  directoryIdentity,
  fileName,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly fileName: string;
}): string | null {
  let fd: number | null = null;
  try {
    fd = openExistingWorkspaceFileInDirectory({
      directory,
      directoryIdentity,
      fileName,
      flags: constants.O_RDONLY,
    });
    return readFileSync(fd, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }
}

function existingReportMatches({
  directory,
  directoryIdentity,
  markdown,
  report,
}: {
  readonly directory: string;
  readonly directoryIdentity: DirectoryIdentity;
  readonly markdown: string;
  readonly report: WorkspaceReviewReport;
}): boolean {
  const jsonText = readExistingReviewText({
    directory,
    directoryIdentity,
    fileName: REVIEW_JSON_FILE,
  });
  const markdownText = readExistingReviewText({
    directory,
    directoryIdentity,
    fileName: REVIEW_MARKDOWN_FILE,
  });
  if (!jsonText || markdownText !== markdown) {
    return false;
  }
  try {
    const current = JSON.parse(jsonText) as Partial<WorkspaceReviewReport>;
    return (
      current.schemaVersion === report.schemaVersion &&
      JSON.stringify(current.summary) === JSON.stringify(report.summary) &&
      JSON.stringify(current.entries) === JSON.stringify(report.entries)
    );
  } catch {
    return false;
  }
}

function ensureReviewDirectory(rootPath: string, assertUsable?: AssertWorkspaceFileUsable): string {
  const reoDirectory = path.join(rootPath, '.reo');
  const reoIdentity = readSafeDirectoryIdentitySync(reoDirectory);
  runInWorkspaceDirectorySync({ directory: reoDirectory, directoryIdentity: reoIdentity }, () => {
    let directoryCreated = false;
    try {
      assertUsable?.();
      try {
        mkdirSync('review');
        directoryCreated = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }
        assertSafeReviewDirectoryEntry('review');
      }
      fsyncCurrentWorkspaceDirectoryBestEffort();
      directoryCreated = false;
    } catch (error) {
      if (directoryCreated) {
        rmSync('review', { force: true, recursive: true });
      }
      throw error;
    }
  });
  return path.join(reoDirectory, 'review');
}

function existingSafeReviewDirectory(rootPath: string): {
  readonly directory: string;
  readonly identity: DirectoryIdentity;
} | null {
  const reviewDirectory = path.join(rootPath, REVIEW_DIRECTORY);
  try {
    assertSafeReviewDirectoryEntry(reviewDirectory);
    return {
      directory: reviewDirectory,
      identity: readSafeDirectoryIdentitySync(reviewDirectory),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function assertSafeReviewDirectoryEntry(reviewDirectory: string): void {
  const stats = lstatSync(reviewDirectory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error('Workspace review directory is unsafe');
  }
}

function clearNeedsReviewReport(rootPath: string, assertUsable?: AssertWorkspaceFileUsable): void {
  assertUsable?.();
  const reviewDirectory = existingSafeReviewDirectory(rootPath);
  if (!reviewDirectory) {
    return;
  }
  runInWorkspaceDirectorySync(
    {
      directory: reviewDirectory.directory,
      directoryIdentity: reviewDirectory.identity,
      validateDirectoryPath: true,
    },
    () => {
      assertUsable?.();
      const hasJsonReport = existsSync(REVIEW_JSON_FILE);
      const hasMarkdownReport = existsSync(REVIEW_MARKDOWN_FILE);
      if (!hasJsonReport && !hasMarkdownReport) {
        return;
      }
      rmSync(REVIEW_JSON_FILE, { force: true });
      rmSync(REVIEW_MARKDOWN_FILE, { force: true });
      fsyncCurrentWorkspaceDirectoryBestEffort();
    }
  );
}

export async function writeWorkspaceNeedsReviewReport({
  assertUsable,
  entries,
  rootPath,
}: {
  readonly assertUsable?: AssertWorkspaceFileUsable;
  readonly entries: readonly WorkspaceReviewEntryInput[];
  readonly rootPath: string;
}): Promise<WorkspaceReviewSummary | undefined> {
  const normalizedEntries = normalizeEntries(rootPath, entries);
  if (normalizedEntries.length === 0) {
    clearNeedsReviewReport(rootPath, assertUsable);
    return undefined;
  }

  const reviewDirectory = ensureReviewDirectory(rootPath, assertUsable);
  const reviewDirectoryIdentity = readSafeDirectoryIdentitySync(reviewDirectory);
  const report: WorkspaceReviewReport = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    summary: summarizeEntries(normalizedEntries),
    entries: normalizedEntries,
  };
  const markdown = renderReviewMarkdown(report);
  if (
    existingReportMatches({
      directory: reviewDirectory,
      directoryIdentity: reviewDirectoryIdentity,
      markdown,
      report,
    })
  ) {
    return report.summary;
  }
  await writeWorkspaceJsonAtomic(
    path.join(reviewDirectory, REVIEW_JSON_FILE),
    report,
    assertUsable
  );
  await writeWorkspaceFileAtomic(
    path.join(reviewDirectory, REVIEW_MARKDOWN_FILE),
    markdown,
    assertUsable
  );
  return report.summary;
}
