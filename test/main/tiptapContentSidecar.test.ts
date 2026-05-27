import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { JSONContent } from '@tiptap/core';
import {
  hashTiptapJsonContent,
  readTiptapContentSidecar,
  reconcileTiptapContentSidecar,
  TIPTAP_CONTENT_SIDECAR_FILE,
  writeTiptapContentSidecar,
} from '../../src/main/tiptapContentSidecar.js';

async function objectDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'reo-tiptap-sidecar-'));
}

function paragraphDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

function highlightedAndUnderlinedDoc(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Codex highlight', marks: [{ type: 'highlight' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'underlined', marks: [{ type: 'underline' }] },
        ],
      },
    ],
  };
}

function coloredHighlightDoc(text: string, color: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text, marks: [{ type: 'highlight', attrs: { color } }] }],
      },
    ],
  };
}

function writableSidecar(sidecar: Awaited<ReturnType<typeof readTiptapContentSidecar>>) {
  const { currentContentHash: _currentContentHash, ...sidecarFile } = sidecar;
  void _currentContentHash;
  return sidecarFile;
}

type WritableSidecar = ReturnType<typeof writableSidecar>;

async function writeSidecarContent(
  directory: string,
  content: JSONContent,
  overrides: Partial<WritableSidecar> = {}
): Promise<string> {
  const sidecar = await readTiptapContentSidecar(directory);
  const text = `${JSON.stringify({ ...writableSidecar(sidecar), ...overrides, content }, null, 2)}\n`;
  await writeFile(path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE), text);
  return text;
}

async function reconcileSidecarAuthoredContent({
  content,
  expectedMarkdown,
}: {
  readonly content: JSONContent;
  readonly expectedMarkdown: readonly RegExp[];
}): Promise<void> {
  const directory = await objectDirectory();
  let bodyMarkdown = 'Original body\n';
  try {
    const initial = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
    });
    assert.equal(initial.ok, true);

    await writeSidecarContent(directory, content);

    const reconciled = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
      writeBodyMarkdown: async (nextBodyMarkdown: string) => {
        bodyMarkdown = nextBodyMarkdown;
      },
    });

    assert.equal(reconciled.ok, true);
    for (const expected of expectedMarkdown) {
      assert.match(bodyMarkdown, expected);
    }
    const updated = await readTiptapContentSidecar(directory);
    assert.deepEqual(updated.content, content);
    assert.equal(updated.source.hash, reconciled.baselineContentHash);
    assert.equal(updated.contentHash, reconciled.baselineTiptapContentHash);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test('tiptap content sidecar is generated from markdown when missing', async () => {
  const directory = await objectDirectory();
  try {
    const result = await reconcileTiptapContentSidecar({
      bodyMarkdown: 'Original body\n',
      objectDirectory: directory,
    });

    assert.equal(result.ok, true);
    assert.equal(result.bodyMarkdown, 'Original body\n');
    assert.ok(result.tiptapJson.content?.length);
    const sidecar = await readTiptapContentSidecar(directory);
    assert.equal(sidecar.source.hash, result.baselineContentHash);
    assert.equal(sidecar.contentHash, result.baselineTiptapContentHash);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar existing-only reconcile does not create a missing sidecar', async () => {
  const directory = await objectDirectory();
  try {
    const result = await reconcileTiptapContentSidecar({
      bodyMarkdown: 'Original body\n',
      objectDirectory: directory,
      createIfMissing: false,
    });

    assert.equal(result.ok, true);
    assert.equal(result.bodyMarkdown, 'Original body\n');
    assert.equal(result.bodyMarkdownChanged, false);
    await assert.rejects(
      readFile(path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE), 'utf8'),
      (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar updates markdown when json adds highlight and underline', async () => {
  const directory = await objectDirectory();
  let bodyMarkdown = 'Original body\n';
  try {
    const nextContent = highlightedAndUnderlinedDoc();
    const initial = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
    });
    assert.equal(initial.ok, true);

    await writeSidecarContent(directory, nextContent);

    const reconciled = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
      writeBodyMarkdown: async (nextBodyMarkdown: string) => {
        bodyMarkdown = nextBodyMarkdown;
      },
    });

    assert.equal(reconciled.ok, true);
    assert.match(bodyMarkdown, /==Codex highlight==/);
    assert.match(bodyMarkdown, /\+\+underlined\+\+/);
    assert.equal(reconciled.bodyMarkdown, bodyMarkdown);
    const updated = await readTiptapContentSidecar(directory);
    assert.deepEqual(updated.content, nextContent);
    assert.equal(updated.source.hash, reconciled.baselineContentHash);
    assert.equal(updated.contentHash, reconciled.baselineTiptapContentHash);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar mirrors json edits even when contentHash is updated externally', async () => {
  const directory = await objectDirectory();
  let bodyMarkdown = 'Original body\n';
  const coloredHighlight = coloredHighlightDoc(
    'Color highlight',
    'var(--tt-color-highlight-green)'
  );
  try {
    const initial = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
    });
    assert.equal(initial.ok, true);

    await writeSidecarContent(directory, coloredHighlight, {
      contentHash: hashTiptapJsonContent(coloredHighlight),
    });

    const reconciled = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
      writeBodyMarkdown: async (nextBodyMarkdown: string) => {
        bodyMarkdown = nextBodyMarkdown;
      },
    });

    assert.equal(reconciled.ok, true);
    assert.match(
      bodyMarkdown,
      /<mark data-color="var\(--tt-color-highlight-green\)" style="background-color: var\(--tt-color-highlight-green\); color: inherit">Color highlight<\/mark>/
    );
    const updated = await readTiptapContentSidecar(directory);
    assert.deepEqual(updated.content, coloredHighlight);
    assert.equal(updated.source.hash, reconciled.baselineContentHash);
    assert.equal(updated.contentHash, reconciled.baselineTiptapContentHash);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar mirrors json-only durable toolbar matrix to markdown', async (t) => {
  const cases: readonly {
    readonly name: string;
    readonly content: JSONContent;
    readonly expectedMarkdown: readonly RegExp[];
  }[] = [
    {
      name: 'link mark',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Spec link',
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: 'https://example.com',
                      target: '_blank',
                      rel: 'noopener noreferrer nofollow',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      expectedMarkdown: [/\[Spec link\]\(https:\/\/example\.com\)/],
    },
    {
      name: 'heading node',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Sidecar heading' }],
          },
        ],
      },
      expectedMarkdown: [/^### Sidecar heading/m],
    },
    {
      name: 'bullet ordered and task lists',
      content: {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bullet item' }] }],
              },
            ],
          },
          {
            type: 'orderedList',
            attrs: { start: 3 },
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ordered item' }] }],
              },
            ],
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
              },
            ],
          },
        ],
      },
      expectedMarkdown: [/- bullet item/, /3\. ordered item/, /- \[x\] done/],
    },
    {
      name: 'inline code and code block',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'inline', marks: [{ type: 'code' }] }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'ts' },
            content: [{ type: 'text', text: 'const value = 1' }],
          },
        ],
      },
      expectedMarkdown: [/`inline`/, /```ts\nconst value = 1\n```/],
    },
    {
      name: 'blockquote node',
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] }],
          },
        ],
      },
      expectedMarkdown: [/> quoted/],
    },
    {
      name: 'paragraph and heading alignment',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{ type: 'text', text: 'center paragraph' }],
          },
          {
            type: 'heading',
            attrs: { level: 2, textAlign: 'right' },
            content: [{ type: 'text', text: 'right heading' }],
          },
        ],
      },
      expectedMarkdown: [
        /<p style="text-align: center">center paragraph<\/p>/,
        /<h2 style="text-align: right">right heading<\/h2>/,
      ],
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      await reconcileSidecarAuthoredContent(testCase);
    });
  }
});

test('tiptap content sidecar regenerates json when markdown changed and json stayed on baseline', async () => {
  const directory = await objectDirectory();
  try {
    const initial = await reconcileTiptapContentSidecar({
      bodyMarkdown: 'Original body\n',
      objectDirectory: directory,
    });
    assert.equal(initial.ok, true);

    const reconciled = await reconcileTiptapContentSidecar({
      bodyMarkdown: 'Human edited body\n',
      objectDirectory: directory,
    });

    assert.equal(reconciled.ok, true);
    assert.equal(reconciled.bodyMarkdown, 'Human edited body\n');
    assert.notEqual(reconciled.baselineContentHash, initial.baselineContentHash);
    const updated = await readTiptapContentSidecar(directory);
    assert.equal(updated.source.hash, reconciled.baselineContentHash);
    assert.equal(updated.contentHash, reconciled.baselineTiptapContentHash);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar reports conflict when markdown and json both changed', async () => {
  const directory = await objectDirectory();
  try {
    const initial = await reconcileTiptapContentSidecar({
      bodyMarkdown: 'Original body\n',
      objectDirectory: directory,
    });
    assert.equal(initial.ok, true);

    const text = await writeSidecarContent(directory, paragraphDoc('Codex body'));

    const result = await reconcileTiptapContentSidecar({
      bodyMarkdown: 'Human body\n',
      objectDirectory: directory,
      writeBodyMarkdown: async () => {
        throw new Error('conflict must not write markdown');
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'content-conflict');
    assert.equal(await readFile(path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE), 'utf8'), text);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar reports invalid sidecar without changing markdown', async () => {
  const directory = await objectDirectory();
  let bodyMarkdown = 'Original body\n';
  try {
    await writeFile(path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE), '{bad json');

    const result = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
      writeBodyMarkdown: async (nextBodyMarkdown: string) => {
        bodyMarkdown = nextBodyMarkdown;
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid-sidecar');
    assert.equal(bodyMarkdown, 'Original body\n');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar reports unsupported tiptap content without rewriting markdown', async () => {
  const directory = await objectDirectory();
  let bodyMarkdown = 'Original body\n';
  try {
    const initial = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
    });
    assert.equal(initial.ok, true);

    const sidecar = await readTiptapContentSidecar(directory);
    await writeFile(
      path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE),
      `${JSON.stringify(
        {
          ...writableSidecar(sidecar),
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Unsupported mark',
                    marks: [{ type: 'futureMark' }],
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      )}\n`
    );

    const result = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
      writeBodyMarkdown: async (nextBodyMarkdown: string) => {
        bodyMarkdown = nextBodyMarkdown;
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unsupported-tiptap-content');
    assert.equal(bodyMarkdown, 'Original body\n');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar reports official-incompatible attrs without rewriting markdown', async () => {
  const directory = await objectDirectory();
  let bodyMarkdown = 'Original body\n';
  try {
    const initial = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
    });
    assert.equal(initial.ok, true);

    await writeSidecarContent(directory, {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'middle' },
          content: [{ type: 'text', text: 'Invalid align' }],
        },
      ],
    });

    const result = await reconcileTiptapContentSidecar({
      bodyMarkdown,
      objectDirectory: directory,
      writeBodyMarkdown: async (nextBodyMarkdown: string) => {
        bodyMarkdown = nextBodyMarkdown;
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unsupported-tiptap-content');
    assert.equal(bodyMarkdown, 'Original body\n');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar reports unsupported markdown-derived content without creating sidecar', async () => {
  const directory = await objectDirectory();
  try {
    const result = await reconcileTiptapContentSidecar({
      bodyMarkdown: '[Unsafe link](javascript:alert(1))\n',
      objectDirectory: directory,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unsupported-tiptap-content');
    await assert.rejects(readFile(path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE), 'utf8'), {
      code: 'ENOENT',
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar rejects transient image upload nodes before persistence', async () => {
  const directory = await objectDirectory();
  try {
    await assert.rejects(
      writeTiptapContentSidecar({
        bodyMarkdown: '',
        objectDirectory: directory,
        tiptapJson: {
          type: 'doc',
          content: [
            {
              type: 'imageUpload',
              attrs: {
                accept: 'image/*',
                limit: 1,
                maxSize: 0,
              },
            },
          ],
        },
      }),
      /Unsupported Tiptap Markdown content/
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar rejects oversized external json content', async () => {
  const directory = await objectDirectory();
  try {
    const oversizedDoc = paragraphDoc('x'.repeat(1_048_577));
    await writeFile(
      path.join(directory, TIPTAP_CONTENT_SIDECAR_FILE),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          objectType: 'tiptap-content',
          source: { format: 'markdown', hash: 'a'.repeat(64) },
          profile: { name: 'reo-tiptap-markdown', version: 1 },
          contentHash: hashTiptapJsonContent(oversizedDoc),
          content: oversizedDoc,
        },
        null,
        2
      )}\n`
    );

    const result = await reconcileTiptapContentSidecar({
      bodyMarkdown: '',
      objectDirectory: directory,
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid-sidecar');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('tiptap content sidecar rejects mismatched markdown and json writes', async () => {
  const directory = await objectDirectory();
  try {
    await assert.rejects(
      writeTiptapContentSidecar({
        bodyMarkdown: 'Markdown body',
        objectDirectory: directory,
        tiptapJson: paragraphDoc('Different JSON body'),
      }),
      /does not match Markdown body/
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
