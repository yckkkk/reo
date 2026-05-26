import assert from 'node:assert/strict';
import test from 'node:test';
import type { JSONContent } from '@tiptap/core';
import {
  parseTiptapMarkdown,
  serializeTiptapMarkdown,
} from '../../src/main/tiptapMarkdownCodec.js';
import { REO_TIPTAP_HIGHLIGHT_COLOR_VALUES } from '../../src/tiptap-markdown/tiptapHighlightColors.js';

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
  const yellow = REO_TIPTAP_HIGHLIGHT_COLOR_VALUES[4];
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
