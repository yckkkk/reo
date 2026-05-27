import assert from 'node:assert/strict';
import test from 'node:test';
import type { JSONContent } from '@tiptap/core';
import {
  parseTiptapMarkdown,
  serializeTiptapMarkdown,
} from '../../src/main/tiptapMarkdownCodec.js';
import { REO_TIPTAP_HIGHLIGHT_COLOR_VALUES } from '../../src/tiptap-markdown/tiptapHighlightColors.js';

const DURABLE_TOOLBAR_HIGHLIGHT_TOKENS = [
  'var(--tt-color-highlight-gray)',
  'var(--tt-color-highlight-brown)',
  'var(--tt-color-highlight-orange)',
  'var(--tt-color-highlight-yellow)',
  'var(--tt-color-highlight-green)',
  'var(--tt-color-highlight-blue)',
  'var(--tt-color-highlight-purple)',
  'var(--tt-color-highlight-pink)',
  'var(--tt-color-highlight-red)',
] as const;

function walkJsonContent(node: JSONContent, visit: (node: JSONContent) => void): void {
  visit(node);
  for (const child of node.content ?? []) {
    walkJsonContent(child, visit);
  }
}

function textNodeWithMark(doc: JSONContent, markType: string): JSONContent | null {
  let matched: JSONContent | null = null;
  walkJsonContent(doc, (node) => {
    if (matched || node.type !== 'text') {
      return;
    }
    if ((node.marks ?? []).some((mark) => mark.type === markType)) {
      matched = node;
    }
  });
  return matched;
}

test('tiptap markdown codec roundtrips highlight markdown marks', () => {
  const parsed = parseTiptapMarkdown('这是 ==高亮== 文本');
  const highlighted = textNodeWithMark(parsed, 'highlight');

  assert.ok(highlighted);
  assert.equal(highlighted.text, '高亮');
  assert.match(serializeTiptapMarkdown(parsed), /==高亮==/);
});

test('tiptap markdown codec roundtrips underline markdown marks', () => {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'underlined',
            marks: [{ type: 'underline' }],
          },
        ],
      },
    ],
  };

  const markdown = serializeTiptapMarkdown(doc);
  assert.match(markdown, /\+\+underlined\+\+/);

  const parsed = parseTiptapMarkdown(markdown);
  const underlined = textNodeWithMark(parsed, 'underline');
  assert.ok(underlined);
  assert.equal(underlined.text, 'underlined');
});

test('tiptap markdown codec preserves colored highlight through html-compatible markdown', () => {
  const yellow = 'var(--tt-color-highlight-yellow)';
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'colored',
            marks: [{ type: 'highlight', attrs: { color: yellow } }],
          },
        ],
      },
    ],
  };

  const markdown = serializeTiptapMarkdown(doc);
  assert.match(markdown, /<mark\b/);
  assert.match(markdown, /data-color="var\(--tt-color-highlight-yellow\)"/);

  const parsed = parseTiptapMarkdown(markdown);
  const highlighted = textNodeWithMark(parsed, 'highlight');
  assert.ok(highlighted);
  assert.deepEqual(highlighted.marks?.[0]?.attrs, { color: yellow });
});

test('tiptap markdown codec accepts every durable toolbar highlight token', () => {
  assert.deepEqual(REO_TIPTAP_HIGHLIGHT_COLOR_VALUES, DURABLE_TOOLBAR_HIGHLIGHT_TOKENS);
  for (const color of DURABLE_TOOLBAR_HIGHLIGHT_TOKENS) {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: color,
              marks: [{ type: 'highlight', attrs: { color } }],
            },
          ],
        },
      ],
    };

    const markdown = serializeTiptapMarkdown(doc);
    assert.match(markdown, new RegExp(`data-color="${color.replace(/[()]/g, '\\$&')}"`));

    const parsed = parseTiptapMarkdown(markdown);
    const highlighted = textNodeWithMark(parsed, 'highlight');
    assert.ok(highlighted);
    assert.deepEqual(highlighted.marks?.[0]?.attrs, { color });
  }
});

test('tiptap markdown codec rejects arbitrary persisted highlight colors', () => {
  const arbitraryColorDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'unsafe',
            marks: [{ type: 'highlight', attrs: { color: '#facc15' } }],
          },
        ],
      },
    ],
  };

  assert.throws(() => serializeTiptapMarkdown(arbitraryColorDoc), /Unsupported Tiptap Markdown/);
  assert.throws(
    () =>
      serializeTiptapMarkdown({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'clear',
                marks: [{ type: 'highlight', attrs: { color: 'var(--tt-bg-color)' } }],
              },
            ],
          },
        ],
      }),
    /Unsupported Tiptap Markdown/
  );

  const parsed = parseTiptapMarkdown(
    '<mark data-color="#facc15" style="background-color: #facc15; color: inherit">unsafe</mark>'
  );
  const highlighted = textNodeWithMark(parsed, 'highlight');
  assert.ok(highlighted);
  assert.notEqual(highlighted.marks?.[0]?.attrs?.['color'], '#facc15');
  assert.doesNotMatch(serializeTiptapMarkdown(parsed), /#facc15/);
});

test('tiptap markdown codec roundtrips text-aligned paragraphs', () => {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [{ type: 'text', text: 'centered' }],
      },
    ],
  };

  const markdown = serializeTiptapMarkdown(doc);
  assert.match(markdown, /text-align: center/);

  const parsed = parseTiptapMarkdown(markdown);
  assert.deepEqual(parsed.content?.[0]?.attrs, { textAlign: 'center' });
  assert.equal(parsed.content?.[0]?.content?.[0]?.text, 'centered');
});

test('tiptap markdown codec roundtrips text-aligned headings', () => {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2, textAlign: 'right' },
        content: [{ type: 'text', text: 'Right heading' }],
      },
    ],
  };

  const markdown = serializeTiptapMarkdown(doc);
  assert.match(markdown, /<h2\b/);
  assert.match(markdown, /text-align: right/);

  const parsed = parseTiptapMarkdown(markdown);
  assert.equal(parsed.content?.[0]?.type, 'heading');
  assert.deepEqual(parsed.content?.[0]?.attrs, { level: 2, textAlign: 'right' });
  assert.equal(parsed.content?.[0]?.content?.[0]?.text, 'Right heading');
});

test('tiptap markdown codec roundtrips superscript and subscript html marks', () => {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'sup', marks: [{ type: 'superscript' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'sub', marks: [{ type: 'subscript' }] },
        ],
      },
    ],
  };

  const markdown = serializeTiptapMarkdown(doc);
  assert.match(markdown, /<sup>sup<\/sup>/);
  assert.match(markdown, /<sub>sub<\/sub>/);

  const parsed = parseTiptapMarkdown(markdown);
  const superscript = textNodeWithMark(parsed, 'superscript');
  const subscript = textNodeWithMark(parsed, 'subscript');
  assert.ok(superscript);
  assert.ok(subscript);
  assert.equal(superscript.text, 'sup');
  assert.equal(subscript.text, 'sub');
});

test('tiptap markdown codec preserves core document structure', () => {
  const markdown = [
    '## 标题',
    '',
    '- [ ] task item',
    '- bullet item',
    '',
    '> 引用',
    '',
    '[link](https://example.com)',
    '',
    '![alt](attachments/image.png "title")',
    '',
    '`inline code`',
  ].join('\n');

  const parsed = parseTiptapMarkdown(markdown);
  const serialized = serializeTiptapMarkdown(parsed);

  assert.match(serialized, /^## 标题/m);
  assert.match(serialized, /\[link\]\(https:\/\/example\.com\)/);
  assert.match(serialized, /!\[alt\]\(attachments\/image\.png "title"\)/);
  assert.match(serialized, /`inline code`/);
});

test('tiptap markdown codec supports the durable toolbar format matrix from JSON', () => {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2, textAlign: 'center' },
        content: [{ type: 'text', text: 'Centered heading' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' italic', marks: [{ type: 'italic' }] },
          { type: 'text', text: ' strike', marks: [{ type: 'strike' }] },
          { type: 'text', text: ' code', marks: [{ type: 'code' }] },
          { type: 'text', text: ' underline', marks: [{ type: 'underline' }] },
          {
            type: 'text',
            text: ' green',
            marks: [{ type: 'highlight', attrs: { color: 'var(--tt-color-highlight-green)' } }],
          },
          {
            type: 'text',
            text: ' link',
            marks: [
              {
                type: 'link',
                attrs: {
                  href: 'https://example.com',
                  target: '_blank',
                  rel: 'noopener noreferrer nofollow',
                  class: null,
                  title: null,
                },
              },
            ],
          },
          { type: 'text', text: ' sup', marks: [{ type: 'superscript' }] },
          { type: 'text', text: ' sub', marks: [{ type: 'subscript' }] },
        ],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bullet' }] }],
          },
        ],
      },
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ordered' }] }],
          },
        ],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'task' }] }],
          },
        ],
      },
      {
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quote' }] }],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'ts' },
        content: [{ type: 'text', text: 'const value = 1' }],
      },
      { type: 'horizontalRule' },
      {
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [{ type: 'text', text: 'right aligned' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'image', attrs: { src: 'attachments/a.png', alt: 'A', title: 'Image A' } },
        ],
      },
    ],
  };

  const markdown = serializeTiptapMarkdown(doc);

  assert.match(markdown, /<h2\b[^>]*text-align: center/);
  assert.match(markdown, /\*\*bold\*\*/);
  assert.match(markdown, /\+\+underline\+\+/);
  assert.match(markdown, /var\(--tt-color-highlight-green\)/);
  assert.match(markdown, /\[link\]\(https:\/\/example\.com\)/);
  assert.match(markdown, /<sup>sup<\/sup>/);
  assert.match(markdown, /<sub>sub<\/sub>/);
  assert.match(markdown, /- bullet/);
  assert.match(markdown, /3\. ordered/);
  assert.match(markdown, /- \[ \] task/);
  assert.match(markdown, /> quote/);
  assert.match(markdown, /```ts\nconst value = 1\n```/);
  assert.match(markdown, /---/);
  assert.match(markdown, /<p\b[^>]*text-align: right/);
  assert.match(markdown, /!\[A\]\(attachments\/a\.png "Image A"\)/);

  const parsed = parseTiptapMarkdown(markdown);
  assert.equal(
    textNodeWithMark(parsed, 'highlight')?.marks?.[0]?.attrs?.['color'],
    'var(--tt-color-highlight-green)'
  );
  assert.ok(textNodeWithMark(parsed, 'underline'));
  assert.ok(textNodeWithMark(parsed, 'superscript'));
  assert.ok(textNodeWithMark(parsed, 'subscript'));
});

test('tiptap markdown codec accepts default link html attrs but rejects non-durable link attrs', () => {
  const defaultLinkDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'link',
            marks: [
              {
                type: 'link',
                attrs: {
                  href: 'https://example.com',
                  target: '_blank',
                  rel: 'noopener noreferrer nofollow',
                  class: null,
                  title: null,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  assert.match(serializeTiptapMarkdown(defaultLinkDoc), /\[link\]\(https:\/\/example\.com\)/);

  const nonDurableLinkDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'link',
            marks: [
              {
                type: 'link',
                attrs: {
                  href: 'https://example.com',
                  target: '_self',
                },
              },
            ],
          },
        ],
      },
    ],
  };

  assert.throws(() => serializeTiptapMarkdown(nonDurableLinkDoc), /Unsupported Tiptap Markdown/);
});

test('tiptap markdown codec rejects official-incompatible durable attrs', () => {
  const cases: ReadonlyArray<{ readonly name: string; readonly doc: JSONContent }> = [
    {
      name: 'heading level below official range',
      doc: {
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 0 }, content: [{ type: 'text', text: 'H' }] }],
      },
    },
    {
      name: 'heading level above official range',
      doc: {
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 7 }, content: [{ type: 'text', text: 'H' }] }],
      },
    },
    {
      name: 'heading level string',
      doc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: '2' }, content: [{ type: 'text', text: 'H' }] },
        ],
      },
    },
    {
      name: 'heading empty level',
      doc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: '' }, content: [{ type: 'text', text: 'H' }] },
        ],
      },
    },
    {
      name: 'paragraph invalid textAlign',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'middle' },
            content: [{ type: 'text', text: 'P' }],
          },
        ],
      },
    },
    {
      name: 'paragraph unknown false attr',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { draggable: false },
            content: [{ type: 'text', text: 'P' }],
          },
        ],
      },
    },
    {
      name: 'heading invalid textAlign',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2, textAlign: 'middle' },
            content: [{ type: 'text', text: 'H' }],
          },
        ],
      },
    },
    {
      name: 'ordered list non-number start',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            attrs: { start: '3' },
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'ordered list start below one',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            attrs: { start: 0 },
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'task item non-boolean checked',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: 'true' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'task' }] }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'task item empty checked',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: '' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'task' }] }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'code block non-string language',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 42 },
            content: [{ type: 'text', text: 'const value = 1' }],
          },
        ],
      },
    },
    {
      name: 'image non-string src',
      doc: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'image', attrs: { src: { file: 'a.png' } } }] },
        ],
      },
    },
    {
      name: 'link non-string href',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'link',
                marks: [{ type: 'link', attrs: { href: 42 } }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'link javascript href',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'link',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'link credential href',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'link',
                marks: [{ type: 'link', attrs: { href: 'https://user@example.com' } }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'link non-string title',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'link',
                marks: [{ type: 'link', attrs: { href: 'https://example.com', title: 7 } }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'link empty target',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'link',
                marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '' } }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'link unknown false attr',
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'link',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'https://example.com', draggable: false },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ];

  for (const { doc, name } of cases) {
    assert.throws(
      () => serializeTiptapMarkdown(doc),
      /Unsupported Tiptap Markdown/,
      `expected ${name} to be rejected`
    );
  }
});
