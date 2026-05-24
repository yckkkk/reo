import { describe, expect, it } from 'vitest';
import { applyLightweightMarkdownFormat } from './noteEditorModel';

describe('noteEditorModel lightweight Markdown formatting', () => {
  it('formats the current textarea selection with lightweight Markdown snippets', () => {
    expect(
      applyLightweightMarkdownFormat({
        action: 'bold',
        markdown: 'alpha beta',
        selectionEnd: 10,
        selectionStart: 6,
      })
    ).toEqual({
      markdown: 'alpha **beta**',
      selectionEnd: 12,
      selectionStart: 8,
    });

    expect(
      applyLightweightMarkdownFormat({
        action: 'emphasis',
        markdown: 'alpha beta',
        selectionEnd: 10,
        selectionStart: 6,
      })
    ).toEqual({
      markdown: 'alpha *beta*',
      selectionEnd: 11,
      selectionStart: 7,
    });

    expect(
      applyLightweightMarkdownFormat({
        action: 'heading',
        markdown: 'alpha\nbeta',
        selectionEnd: 8,
        selectionStart: 8,
      })
    ).toEqual({
      markdown: 'alpha\n## beta',
      selectionEnd: 11,
      selectionStart: 11,
    });

    expect(
      applyLightweightMarkdownFormat({
        action: 'separator',
        markdown: 'alpha',
        selectionEnd: 5,
        selectionStart: 5,
      })
    ).toEqual({
      markdown: 'alpha\n\n---\n\n',
      selectionEnd: 12,
      selectionStart: 12,
    });
  });

  it('prefixes every selected line while preserving the adjusted textarea selection', () => {
    expect(
      applyLightweightMarkdownFormat({
        action: 'bullet-list',
        markdown: 'alpha\nbeta\ngamma',
        selectionEnd: 10,
        selectionStart: 0,
      })
    ).toEqual({
      markdown: '- alpha\n- beta\ngamma',
      selectionEnd: 14,
      selectionStart: 2,
    });
  });
});
