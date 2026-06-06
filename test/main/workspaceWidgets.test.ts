import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  initializeWorkspaceFiles,
  readWorkspaceSnapshotFromFileTruth,
} from '../../src/main/workspaceFiles.js';
import { renderWorkspaceMarkdownObject } from '../../src/main/workspaceMarkdownObjects.js';
import {
  deleteWorkspaceWidgetFromFileTruth,
  readWorkspaceWidgetsFromFileTruth,
  resolveWorkspaceWidgetDirectoryFromFileTruth,
  restoreDeletedWorkspaceWidgetFromFileTruth,
  updateWorkspaceWidgetTabOrderFromFileTruth,
  updateWorkspaceWidgetTitleFromFileTruth,
} from '../../src/main/workspaceWidgets.js';

async function createWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reo-widgets-'));
  const initialized = await initializeWorkspaceFiles({
    rootPath: root,
    title: 'Widget space',
    description: '',
    createWorkspaceId: () => 'ws_widgets',
    now: () => '2026-06-05T12:00:00.000Z',
  });
  assert.equal(initialized.ok, true);
  return root;
}

async function writeWidget({
  entryHtml = '<!doctype html><html><body>Widget</body></html>',
  root,
  title,
  widgetId,
}: {
  readonly entryHtml?: string | null;
  readonly root: string;
  readonly title: string;
  readonly widgetId: string;
}) {
  const directory = path.join(root, 'widgets', `${widgetId}--${title}`);
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await writeFile(
    path.join(directory, 'widget.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'widget',
      data: {
        title,
        kind: 'widget',
        format: 'html',
        mount: 'workspace-rail',
      },
      content: `# ${title}\n`,
    })
  );
  if (entryHtml !== null) {
    await writeFile(path.join(directory, 'entry.html'), entryHtml);
  }
  return directory;
}

function failOnSecondUsabilityCheck() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1
      ? ({ ok: true } as const)
      : ({
          ok: false,
          error: {
            code: 'ERR_WORKSPACE_LOCK_LOST',
            message: 'workspace lost',
          },
        } as const);
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  return stat(targetPath)
    .then(() => true)
    .catch(() => false);
}

test('workspace widgets scan from file truth, persist tab order, and delete/restore', async () => {
  const root = await createWorkspaceRoot();
  await writeWidget({ root, widgetId: 'wdg_overview', title: 'Overview' });
  await writeWidget({ root, widgetId: 'wdg_broken', title: 'Broken', entryHtml: null });

  const scanned = await readWorkspaceWidgetsFromFileTruth({
    rootPath: root,
    widgetTabOrder: ['wdg_broken', 'wdg_overview'],
    workspaceId: 'ws_widgets',
  });

  assert.deepEqual(
    scanned.widgets.map((widget) => widget.widgetId),
    ['wdg_broken', 'wdg_overview']
  );
  assert.equal(scanned.widgets[0]?.runtimeFault?.reason, 'missing-entry');
  assert.equal(scanned.widgets[1]?.runtimeFault, undefined);

  const reordered = await updateWorkspaceWidgetTabOrderFromFileTruth({
    rootPath: root,
    widgetTabOrder: ['wdg_overview', 'wdg_broken'],
    workspaceId: 'ws_widgets',
  });
  assert.deepEqual(
    reordered.widgets.map((widget) => widget.widgetId),
    ['wdg_overview', 'wdg_broken']
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(root, '.reo', 'workspace.json'), 'utf8')).widgetTabOrder,
    ['wdg_overview', 'wdg_broken']
  );

  const deleted = await deleteWorkspaceWidgetFromFileTruth({
    rootPath: root,
    widgetId: 'wdg_broken',
    workspaceId: 'ws_widgets',
  });
  assert.deepEqual(
    deleted.widgets.map((widget) => widget.widgetId),
    ['wdg_overview']
  );
  assert.equal(deleted.restoreToken, 'wdg_broken');

  const restored = await restoreDeletedWorkspaceWidgetFromFileTruth({
    restoreToken: deleted.restoreToken,
    rootPath: root,
    workspaceId: 'ws_widgets',
  });
  assert.equal(restored.widget.widgetId, 'wdg_broken');
  assert.deepEqual(
    restored.widgets.map((widget) => widget.widgetId),
    ['wdg_overview', 'wdg_broken']
  );
});

test('workspace widget custom icon URL is versioned by icon hash only', async () => {
  const root = await createWorkspaceRoot();
  const widgetDirectory = await writeWidget({ root, widgetId: 'wdg_icon', title: 'Icon' });
  await writeFile(
    path.join(widgetDirectory, 'assets', 'icon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16"/></svg>'
  );

  const initial = await readWorkspaceWidgetsFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_widgets',
  });
  const initialWidget = initial.widgets[0];
  assert.equal(initialWidget?.icon.source, 'custom-mask');
  if (
    !initialWidget ||
    initialWidget.icon.source !== 'custom-mask' ||
    !('previewVersion' in initialWidget)
  ) {
    throw new Error('Expected a custom Widget icon');
  }
  assert.equal(
    initialWidget.icon.url.endsWith(`?v=${encodeURIComponent(initialWidget.icon.version)}`),
    true
  );

  await writeFile(path.join(widgetDirectory, 'entry.html'), '<!doctype html><p>Updated</p>');

  const updated = await readWorkspaceWidgetsFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_widgets',
  });
  const updatedWidget = updated.widgets[0];
  assert.equal(updatedWidget?.icon.source, 'custom-mask');
  if (
    !updatedWidget ||
    updatedWidget.icon.source !== 'custom-mask' ||
    !('previewVersion' in updatedWidget)
  ) {
    throw new Error('Expected the custom Widget icon to remain available');
  }
  assert.notEqual(updatedWidget.previewVersion, initialWidget.previewVersion);
  assert.equal(updatedWidget.icon.version, initialWidget.icon.version);
  assert.equal(updatedWidget.icon.url, initialWidget.icon.url);
});

test('workspace widget resolver accepts frontmatter id when the directory name has no id prefix', async () => {
  const root = await createWorkspaceRoot();
  const widgetDirectory = path.join(root, 'widgets', 'Daily Panel');
  await mkdir(widgetDirectory, { recursive: true });
  await writeFile(
    path.join(widgetDirectory, 'widget.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'widget',
      data: {
        id: 'wdg_frontmatter',
        title: 'Daily Panel',
        kind: 'widget',
        format: 'html',
        mount: 'workspace-rail',
      },
      content: '# Daily Panel\n',
    })
  );
  await writeFile(path.join(widgetDirectory, 'entry.html'), '<!doctype html><p>Daily</p>');

  const scanned = await readWorkspaceWidgetsFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_widgets',
  });
  assert.deepEqual(
    scanned.widgets.map((widget) => widget.widgetId),
    ['wdg_frontmatter']
  );

  const updated = await updateWorkspaceWidgetTitleFromFileTruth({
    rootPath: root,
    title: 'Daily Focus',
    widgetId: 'wdg_frontmatter',
    workspaceId: 'ws_widgets',
  });
  assert.equal(updated.widget.title, 'Daily Focus');
});

test('workspace widgets reject a symlinked widgets root before scanning or mutating', async () => {
  const root = await createWorkspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-widget-root-outside-'));
  await writeWidget({ root: outside, widgetId: 'wdg_outside', title: 'Outside' });
  await rm(path.join(root, 'widgets'), { force: true, recursive: true });
  await symlink(path.join(outside, 'widgets'), path.join(root, 'widgets'));

  await assert.rejects(
    readWorkspaceWidgetsFromFileTruth({
      rootPath: root,
      workspaceId: 'ws_widgets',
    }),
    /unsafe|not safe/i
  );

  await assert.rejects(
    deleteWorkspaceWidgetFromFileTruth({
      rootPath: root,
      widgetId: 'wdg_outside',
      workspaceId: 'ws_widgets',
    }),
    /unsafe|not safe/i
  );
  assert.equal(await pathExists(path.join(outside, 'widgets', 'wdg_outside--Outside')), true);
});

test('workspace widget id resolution fails closed when duplicate widget ids exist', async () => {
  const root = await createWorkspaceRoot();
  const firstDirectory = await writeWidget({ root, widgetId: 'wdg_duplicate', title: 'First' });
  const secondDirectory = await writeWidget({ root, widgetId: 'wdg_duplicate', title: 'Second' });

  const scanned = await readWorkspaceWidgetsFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_widgets',
  });
  assert.deepEqual(scanned.widgets, []);
  assert.equal(
    scanned.reviewEntries.some((entry) => entry.reason === 'duplicate-id'),
    true
  );

  await assert.rejects(
    resolveWorkspaceWidgetDirectoryFromFileTruth({
      rootPath: root,
      widgetId: 'wdg_duplicate',
      workspaceId: 'ws_widgets',
    }),
    /duplicate/i
  );

  await assert.rejects(
    updateWorkspaceWidgetTitleFromFileTruth({
      rootPath: root,
      widgetId: 'wdg_duplicate',
      workspaceId: 'ws_widgets',
      title: 'Renamed',
    }),
    /duplicate/i
  );
  assert.match(await readFile(path.join(firstDirectory, 'widget.md'), 'utf8'), /# First/);
  assert.match(await readFile(path.join(secondDirectory, 'widget.md'), 'utf8'), /# Second/);
});

test('workspace widget order rejects symlinked and oversized workspace metadata before writing', async () => {
  const root = await createWorkspaceRoot();
  await writeWidget({ root, widgetId: 'wdg_metadata', title: 'Metadata' });
  const metadataPath = path.join(root, '.reo', 'workspace.json');
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-widget-metadata-outside-'));
  await writeFile(path.join(outside, 'workspace.json'), '{"schemaVersion":1}\n');
  await rm(metadataPath, { force: true });
  await symlink(path.join(outside, 'workspace.json'), metadataPath);

  await assert.rejects(
    updateWorkspaceWidgetTabOrderFromFileTruth({
      rootPath: root,
      widgetTabOrder: ['wdg_metadata'],
      workspaceId: 'ws_widgets',
    }),
    /unsafe|not safe/i
  );

  await rm(metadataPath, { force: true });
  await writeFile(metadataPath, `{"schemaVersion":1,"padding":"${'x'.repeat(1_100_000)}"}\n`);
  await assert.rejects(
    updateWorkspaceWidgetTabOrderFromFileTruth({
      rootPath: root,
      widgetTabOrder: ['wdg_metadata'],
      workspaceId: 'ws_widgets',
    }),
    /too large/i
  );
});

test('workspace widget delete rolls back the directory move when order persistence fails', async () => {
  const root = await createWorkspaceRoot();
  const widgetDirectory = await writeWidget({ root, widgetId: 'wdg_rollback', title: 'Rollback' });

  await assert.rejects(
    deleteWorkspaceWidgetFromFileTruth({
      assertWorkspaceUsable: failOnSecondUsabilityCheck(),
      rootPath: root,
      widgetId: 'wdg_rollback',
      workspaceId: 'ws_widgets',
    }),
    /workspace lost/
  );

  assert.equal(await pathExists(widgetDirectory), true);
  assert.equal(
    await pathExists(path.join(root, '.reo', 'trash', 'widgets', 'wdg_rollback')),
    false
  );

  const scanned = await readWorkspaceWidgetsFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_widgets',
  });
  assert.deepEqual(
    scanned.widgets.map((widget) => widget.widgetId),
    ['wdg_rollback']
  );
});

test('workspace widget restore rolls back the directory move when order persistence fails', async () => {
  const root = await createWorkspaceRoot();
  await writeWidget({ root, widgetId: 'wdg_restore_rollback', title: 'Restore Rollback' });
  const deleted = await deleteWorkspaceWidgetFromFileTruth({
    rootPath: root,
    widgetId: 'wdg_restore_rollback',
    workspaceId: 'ws_widgets',
  });
  const trashDirectory = path.join(root, '.reo', 'trash', 'widgets', deleted.restoreToken);
  const restoredDirectory = path.join(root, 'widgets', `${deleted.restoreToken}--Restore Rollback`);

  await assert.rejects(
    restoreDeletedWorkspaceWidgetFromFileTruth({
      assertWorkspaceUsable: failOnSecondUsabilityCheck(),
      restoreToken: deleted.restoreToken,
      rootPath: root,
      workspaceId: 'ws_widgets',
    }),
    /workspace lost/
  );

  assert.equal(await pathExists(trashDirectory), true);
  assert.equal(await pathExists(restoredDirectory), false);
  const scanned = await readWorkspaceWidgetsFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_widgets',
  });
  assert.deepEqual(scanned.widgets, []);
});

test('workspace widget delete rejects symlinked widget trash without moving active files', async () => {
  const root = await createWorkspaceRoot();
  const widgetDirectory = await writeWidget({ root, widgetId: 'wdg_trash_safe', title: 'Safe' });
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-widget-trash-outside-'));
  await rm(path.join(root, '.reo', 'trash'), { force: true, recursive: true });
  await symlink(outside, path.join(root, '.reo', 'trash'));

  await assert.rejects(
    deleteWorkspaceWidgetFromFileTruth({
      rootPath: root,
      widgetId: 'wdg_trash_safe',
      workspaceId: 'ws_widgets',
    }),
    /unsafe|not safe/i
  );

  assert.equal(await pathExists(widgetDirectory), true);
  assert.equal(await pathExists(path.join(outside, 'widgets', 'wdg_trash_safe')), false);
});

test('workspace widget restore rejects existing active target without moving trash files', async () => {
  const root = await createWorkspaceRoot();
  await writeWidget({ root, widgetId: 'wdg_restore_existing', title: 'Restore Existing' });
  const deleted = await deleteWorkspaceWidgetFromFileTruth({
    rootPath: root,
    widgetId: 'wdg_restore_existing',
    workspaceId: 'ws_widgets',
  });
  const trashDirectory = path.join(root, '.reo', 'trash', 'widgets', deleted.restoreToken);
  await writeWidget({ root, widgetId: 'wdg_restore_existing', title: 'Restore Existing' });

  await assert.rejects(
    restoreDeletedWorkspaceWidgetFromFileTruth({
      restoreToken: deleted.restoreToken,
      rootPath: root,
      workspaceId: 'ws_widgets',
    })
  );

  assert.equal(await pathExists(trashDirectory), true);
});

test('workspace snapshot reports invalid widget candidates as needs-review', async () => {
  const root = await createWorkspaceRoot();
  const invalidDirectory = path.join(root, 'widgets', 'wdg_invalid--Bad');
  await mkdir(invalidDirectory, { recursive: true });
  await writeFile(
    path.join(invalidDirectory, 'widget.md'),
    '---\ntitle: Bad\nkind: widget\nformat: html\nmount: unsupported\n---\n'
  );

  const opened = await readWorkspaceSnapshotFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_widgets',
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.snapshot.widgets?.length ?? 0, 0);
  assert.equal(opened.snapshot.review?.needsReviewCount, 1);
  const review = JSON.parse(
    await readFile(path.join(root, '.reo', 'review', 'needs-review.json'), 'utf8')
  );
  assert.equal(review.entries[0].reason, 'invalid-widget');
  assert.deepEqual(review.entries[0].paths, ['widgets/wdg_invalid--Bad/widget.md']);
});

test('workspace widget scan rejects symlinked and oversized widget markdown as needs-review', async () => {
  const root = await createWorkspaceRoot();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'reo-widget-outside-'));
  await writeFile(
    path.join(outside, 'widget.md'),
    renderWorkspaceMarkdownObject({
      objectType: 'widget',
      data: {
        id: 'wdg_symlinked',
        title: 'Symlinked',
        kind: 'widget',
        format: 'html',
        mount: 'workspace-rail',
      },
      content: '# Symlinked\n',
    })
  );
  const symlinkedDirectory = path.join(root, 'widgets', 'wdg_symlinked--Symlinked');
  await mkdir(symlinkedDirectory, { recursive: true });
  await symlink(path.join(outside, 'widget.md'), path.join(symlinkedDirectory, 'widget.md'));
  await writeFile(path.join(symlinkedDirectory, 'entry.html'), '<!doctype html><p>bad</p>');

  const oversizedDirectory = path.join(root, 'widgets', 'wdg_oversized--Oversized');
  await mkdir(oversizedDirectory, { recursive: true });
  await writeFile(
    path.join(oversizedDirectory, 'widget.md'),
    `---\ntitle: Oversized\nkind: widget\nformat: html\nmount: workspace-rail\n---\n${'x'.repeat(
      300_000
    )}`
  );
  await writeFile(path.join(oversizedDirectory, 'entry.html'), '<!doctype html><p>bad</p>');

  const scanned = await readWorkspaceWidgetsFromFileTruth({
    rootPath: root,
    workspaceId: 'ws_widgets',
  });

  assert.deepEqual(scanned.widgets, []);
  assert.deepEqual(scanned.reviewEntries.map((entry) => entry.reason).sort(), [
    'invalid-widget',
    'invalid-widget',
  ]);
});
