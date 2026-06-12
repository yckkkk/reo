import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  deleteHomeComponentFromFileTruth,
  readHomeComponentShellStateFromFileTruth,
  readHomeComponentsFromFileTruth,
  resolveHomeComponentDirectoryFromFileTruth,
  restoreDeletedHomeComponentFromFileTruth,
  updateHomeComponentTabOrderFromFileTruth,
  updateHomeComponentTitleFromFileTruth,
} from '../../src/main/homeComponents.js';

async function createAppDataRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'reo-home-components-'));
}

async function writeHomeComponent({
  appDataRootPath,
  componentId,
  entryHtml = '<!doctype html><html><body>Home Component</body></html>',
  title,
}: {
  readonly appDataRootPath: string;
  readonly componentId: string;
  readonly entryHtml?: string | null;
  readonly title: string;
}) {
  const directory = path.join(appDataRootPath, 'home-components', `${componentId}--${title}`);
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await writeFile(
    path.join(directory, 'component.md'),
    `---\nid: ${componentId}\ntitle: ${title}\nkind: home-component\nformat: html\nmount: home\n---\n# ${title}\n`
  );
  if (entryHtml !== null) {
    await writeFile(path.join(directory, 'entry.html'), entryHtml);
  }
  return directory;
}

async function pathExists(targetPath: string): Promise<boolean> {
  return stat(targetPath)
    .then(() => true)
    .catch(() => false);
}

test('home components scan from app file truth, persist shell state, and delete/restore', async () => {
  const appDataRootPath = await createAppDataRoot();
  await writeHomeComponent({
    appDataRootPath,
    componentId: 'hcmp_daily',
    title: 'Daily Panel',
  });
  await writeHomeComponent({
    appDataRootPath,
    componentId: 'hcmp_broken',
    title: 'Broken',
    entryHtml: null,
  });

  const scanned = await readHomeComponentsFromFileTruth({
    appDataRootPath,
    componentTabOrder: ['hcmp_broken', 'hcmp_daily'],
  });

  assert.deepEqual(
    scanned.components.map((component) => component.componentId),
    ['hcmp_broken', 'hcmp_daily']
  );
  assert.equal(scanned.components[0]?.runtimeFault?.reason, 'missing-entry');
  assert.equal(scanned.components[1]?.runtimeFault, undefined);
  assert.equal(scanned.components[1]?.mount, 'home');
  assert.equal('workspaceId' in (scanned.components[1] ?? {}), false);

  const reordered = await updateHomeComponentTabOrderFromFileTruth({
    appDataRootPath,
    componentTabOrder: ['hcmp_daily', 'hcmp_broken'],
    lastActiveComponentId: 'hcmp_daily',
  });
  assert.deepEqual(
    reordered.components.map((component) => component.componentId),
    ['hcmp_daily', 'hcmp_broken']
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(appDataRootPath, 'home-components.json'), 'utf8')),
    {
      schemaVersion: 1,
      componentTabOrder: ['hcmp_daily', 'hcmp_broken'],
      lastActiveComponentId: 'hcmp_daily',
    }
  );

  const shellState = await readHomeComponentShellStateFromFileTruth({ appDataRootPath });
  assert.deepEqual(shellState, {
    componentTabOrder: ['hcmp_daily', 'hcmp_broken'],
    lastActiveComponentId: 'hcmp_daily',
  });

  const deleted = await deleteHomeComponentFromFileTruth({
    appDataRootPath,
    componentId: 'hcmp_broken',
  });
  assert.deepEqual(
    deleted.components.map((component) => component.componentId),
    ['hcmp_daily']
  );
  assert.equal(deleted.restoreToken, 'hcmp_broken');
  assert.equal(
    await pathExists(path.join(appDataRootPath, 'home-components-trash', 'hcmp_broken')),
    true
  );

  const restored = await restoreDeletedHomeComponentFromFileTruth({
    appDataRootPath,
    restoreToken: deleted.restoreToken,
  });
  assert.equal(restored.component.componentId, 'hcmp_broken');
  assert.deepEqual(
    restored.components.map((component) => component.componentId),
    ['hcmp_daily', 'hcmp_broken']
  );
});

test('home component title updates metadata without renaming the component directory', async () => {
  const appDataRootPath = await createAppDataRoot();
  const directory = await writeHomeComponent({
    appDataRootPath,
    componentId: 'hcmp_title',
    title: 'Original',
  });

  const updated = await updateHomeComponentTitleFromFileTruth({
    appDataRootPath,
    componentId: 'hcmp_title',
    title: 'Renamed',
  });

  assert.equal(updated.component.title, 'Renamed');
  assert.equal(await pathExists(directory), true);
  assert.equal(
    await pathExists(path.join(appDataRootPath, 'home-components', 'hcmp_title--Renamed')),
    false
  );
  assert.match(await readFile(path.join(directory, 'component.md'), 'utf8'), /title: Renamed/);
});

test('home component custom icon URL is versioned by icon hash only', async () => {
  const appDataRootPath = await createAppDataRoot();
  const componentDirectory = await writeHomeComponent({
    appDataRootPath,
    componentId: 'hcmp_icon',
    title: 'Icon',
  });
  await writeFile(
    path.join(componentDirectory, 'assets', 'icon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16"/></svg>'
  );

  const initial = await readHomeComponentsFromFileTruth({ appDataRootPath });
  const initialComponent = initial.components[0];
  assert.equal(initialComponent?.icon.source, 'custom-mask');
  if (
    !initialComponent ||
    initialComponent.icon.source !== 'custom-mask' ||
    !('previewVersion' in initialComponent)
  ) {
    throw new Error('Expected a custom Home Component icon.');
  }

  await writeFile(path.join(componentDirectory, 'entry.html'), '<!doctype html><p>Updated</p>');
  const updated = await readHomeComponentsFromFileTruth({ appDataRootPath });
  const updatedComponent = updated.components[0];
  assert.equal(updatedComponent?.icon.source, 'custom-mask');
  if (
    !updatedComponent ||
    updatedComponent.icon.source !== 'custom-mask' ||
    !('previewVersion' in updatedComponent)
  ) {
    throw new Error('Expected the custom Home Component icon to remain available.');
  }

  assert.notEqual(updatedComponent.previewVersion, initialComponent.previewVersion);
  assert.equal(updatedComponent.icon.version, initialComponent.icon.version);
  assert.equal(updatedComponent.icon.url, initialComponent.icon.url);
});

test('home component preview version tracks runtime files but ignores metadata-only edits', async () => {
  const appDataRootPath = await createAppDataRoot();
  const componentDirectory = await writeHomeComponent({
    appDataRootPath,
    componentId: 'hcmp_preview',
    title: 'Preview',
  });
  await writeFile(path.join(componentDirectory, 'runtime.json'), '{"stores":{}}');
  await writeFile(path.join(componentDirectory, 'assets', 'panel.css'), 'body{color:red}');

  const initial = await readHomeComponentsFromFileTruth({ appDataRootPath });
  const initialComponent = initial.components[0];
  if (!initialComponent || !('previewVersion' in initialComponent)) {
    throw new Error('Expected a ready Home Component.');
  }

  const renamed = await updateHomeComponentTitleFromFileTruth({
    appDataRootPath,
    componentId: 'hcmp_preview',
    title: 'Preview Renamed',
  });
  assert.equal(
    'previewVersion' in renamed.component ? renamed.component.previewVersion : null,
    initialComponent.previewVersion
  );

  await writeFile(path.join(componentDirectory, 'runtime.json'), '{"stores":{"ui":{"v":2}}}');
  const runtimeUpdated = await readHomeComponentsFromFileTruth({ appDataRootPath });
  const runtimeUpdatedComponent = runtimeUpdated.components[0];
  if (!runtimeUpdatedComponent || !('previewVersion' in runtimeUpdatedComponent)) {
    throw new Error('Expected a ready Home Component after runtime.json update.');
  }
  assert.notEqual(runtimeUpdatedComponent.previewVersion, initialComponent.previewVersion);

  await writeFile(path.join(componentDirectory, 'state.json'), '{"stores":{"draft":{"v":3}}}');
  const stateUpdated = await readHomeComponentsFromFileTruth({ appDataRootPath });
  const stateUpdatedComponent = stateUpdated.components[0];
  if (!stateUpdatedComponent || !('previewVersion' in stateUpdatedComponent)) {
    throw new Error('Expected a ready Home Component after state.json update.');
  }
  assert.equal(stateUpdatedComponent.previewVersion, runtimeUpdatedComponent.previewVersion);

  await writeFile(path.join(componentDirectory, 'assets', 'panel.css'), 'body{color:blue}');
  const assetUpdated = await readHomeComponentsFromFileTruth({ appDataRootPath });
  const assetUpdatedComponent = assetUpdated.components[0];
  if (!assetUpdatedComponent || !('previewVersion' in assetUpdatedComponent)) {
    throw new Error('Expected a ready Home Component after asset update.');
  }
  assert.notEqual(assetUpdatedComponent.previewVersion, runtimeUpdatedComponent.previewVersion);
});

test('home component resolver accepts frontmatter id when the directory name has no id prefix', async () => {
  const appDataRootPath = await createAppDataRoot();
  const componentDirectory = path.join(appDataRootPath, 'home-components', 'Daily Panel');
  await mkdir(componentDirectory, { recursive: true });
  await writeFile(
    path.join(componentDirectory, 'component.md'),
    '---\nid: hcmp_frontmatter\ntitle: Daily Panel\nkind: home-component\nformat: html\nmount: home\n---\n# Daily Panel\n'
  );
  await writeFile(path.join(componentDirectory, 'entry.html'), '<!doctype html><p>Daily</p>');

  const scanned = await readHomeComponentsFromFileTruth({ appDataRootPath });
  assert.deepEqual(
    scanned.components.map((component) => component.componentId),
    ['hcmp_frontmatter']
  );

  assert.equal(
    await resolveHomeComponentDirectoryFromFileTruth({
      appDataRootPath,
      componentId: 'hcmp_frontmatter',
    }),
    componentDirectory
  );
});

test('home component scan ignores component.md without required id', async () => {
  const appDataRootPath = await createAppDataRoot();
  const componentDirectory = path.join(appDataRootPath, 'home-components', 'Missing Id');
  await mkdir(componentDirectory, { recursive: true });
  await writeFile(
    path.join(componentDirectory, 'component.md'),
    '---\ntitle: Missing Id\nkind: home-component\nformat: html\nmount: home\n---\n# Missing Id\n'
  );
  await writeFile(path.join(componentDirectory, 'entry.html'), '<!doctype html><p>Missing</p>');

  const scanned = await readHomeComponentsFromFileTruth({ appDataRootPath });
  assert.deepEqual(scanned.components, []);
  await assert.rejects(
    resolveHomeComponentDirectoryFromFileTruth({
      appDataRootPath,
      componentId: 'hcmp_missing',
    }),
    /not found/i
  );
});

test('home component restore refuses trash whose frontmatter id does not match the restore token', async () => {
  const appDataRootPath = await createAppDataRoot();
  await writeHomeComponent({
    appDataRootPath,
    componentId: 'hcmp_restore',
    title: 'Restore',
  });

  const deleted = await deleteHomeComponentFromFileTruth({
    appDataRootPath,
    componentId: 'hcmp_restore',
  });
  const trashDirectory = path.join(appDataRootPath, 'home-components-trash', deleted.restoreToken);
  await writeFile(
    path.join(trashDirectory, 'component.md'),
    '---\nid: hcmp_other\ntitle: Restore\nkind: home-component\nformat: html\nmount: home\n---\n# Restore\n'
  );

  await assert.rejects(
    restoreDeletedHomeComponentFromFileTruth({
      appDataRootPath,
      restoreToken: deleted.restoreToken,
    }),
    /restore token/i
  );
  assert.equal(await pathExists(trashDirectory), true);
  assert.equal(
    await pathExists(path.join(appDataRootPath, 'home-components', 'hcmp_restore--Restore')),
    false
  );
});

test('home components reject a symlinked app component root before scanning or mutating', async () => {
  const appDataRootPath = await createAppDataRoot();
  const outside = await createAppDataRoot();
  await writeHomeComponent({
    appDataRootPath: outside,
    componentId: 'hcmp_outside',
    title: 'Outside',
  });
  await rm(path.join(appDataRootPath, 'home-components'), { force: true, recursive: true });
  await symlink(
    path.join(outside, 'home-components'),
    path.join(appDataRootPath, 'home-components')
  );

  await assert.rejects(readHomeComponentsFromFileTruth({ appDataRootPath }), /unsafe|not safe/i);

  await assert.rejects(
    deleteHomeComponentFromFileTruth({
      appDataRootPath,
      componentId: 'hcmp_outside',
    }),
    /unsafe|not safe/i
  );
  assert.equal(
    await pathExists(path.join(outside, 'home-components', 'hcmp_outside--Outside')),
    true
  );
});
