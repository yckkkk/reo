import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseWorkspaceMarkdownObject,
  renderWorkspaceMarkdownObject,
  validateWorkspaceRelativeResourcePath,
} from '../../src/main/workspaceMarkdownObjects.js';

test('workspace markdown object parses flat frontmatter and body content', () => {
  const object = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: `---\ntitle: Main recording\nkind: audio\ntags:\n  - architecture\n---\n# Main recording\n\n## Transcript\n\nhello\n`,
  });

  assert.deepEqual(object.data, {
    kind: 'audio',
    title: 'Main recording',
    tags: ['architecture'],
  });
  assert.equal(object.content, '# Main recording\n\n## Transcript\n\nhello\n');
});

test('workspace markdown object rejects invalid yaml and reserved technical fields', () => {
  assert.throws(
    () =>
      parseWorkspaceMarkdownObject({
        objectType: 'memory',
        markdown: `---\ntitle: [memory\n---\n`,
      }),
    /Invalid workspace markdown frontmatter/
  );

  assert.throws(
    () =>
      parseWorkspaceMarkdownObject({
        objectType: 'segment',
        markdown: `---\ntitle: Wrong layer\nreo_id: seg_audio\nprimary_file: audio.webm\n---\n`,
      }),
    /Invalid workspace markdown frontmatter/
  );
});

test('workspace markdown object renders yaml frontmatter without dropping body', () => {
  const markdown = renderWorkspaceMarkdownObject({
    objectType: 'memory',
    data: {
      title: 'Trip notes',
      tags: ['travel', 'voice'],
    },
    content: '# Trip notes\n\nBody stays editable.\n',
  });

  const object = parseWorkspaceMarkdownObject({
    objectType: 'memory',
    markdown,
  });

  assert.deepEqual(object.data, {
    title: 'Trip notes',
    tags: ['travel', 'voice'],
  });
  assert.equal(object.content, '# Trip notes\n\nBody stays editable.\n');
});

test('workspace markdown object rejects unsafe relative resource paths', () => {
  assert.equal(validateWorkspaceRelativeResourcePath('audio.webm'), 'audio.webm');
  assert.equal(validateWorkspaceRelativeResourcePath('files/original.pdf'), 'files/original.pdf');

  assert.throws(
    () => validateWorkspaceRelativeResourcePath('../outside.html'),
    /Resource path must stay inside the object directory/
  );
  assert.throws(
    () => validateWorkspaceRelativeResourcePath('/tmp/outside.html'),
    /Resource path must stay inside the object directory/
  );
  assert.throws(
    () => validateWorkspaceRelativeResourcePath('http://example.com/file.html'),
    /Resource path must be a relative file path/
  );
  assert.throws(
    () => validateWorkspaceRelativeResourcePath('..\\outside.html'),
    /Resource path must stay inside the object directory/
  );
  assert.throws(
    () => validateWorkspaceRelativeResourcePath('folder\\..\\..\\outside.html'),
    /Resource path must stay inside the object directory/
  );
  assert.throws(
    () => validateWorkspaceRelativeResourcePath('\\server\\share\\outside.html'),
    /Resource path must stay inside the object directory/
  );
});

test('workspace markdown object accepts note kind and rejects unsupported object kinds', () => {
  const note = parseWorkspaceMarkdownObject({
    objectType: 'segment',
    markdown: `---\ntitle: Supported note\nkind: note\n---\nbody\n`,
  });

  assert.deepEqual(note.data, {
    kind: 'note',
    title: 'Supported note',
  });
  assert.equal(note.content, 'body\n');

  assert.throws(
    () =>
      parseWorkspaceMarkdownObject({
        objectType: 'segment',
        markdown: `---\ntitle: HTML resource\nkind: html\n---\nbody\n`,
      }),
    /Invalid workspace markdown frontmatter/
  );
});
