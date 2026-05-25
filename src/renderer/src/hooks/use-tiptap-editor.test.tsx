import type { Editor } from '@tiptap/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTiptapEditor } from './use-tiptap-editor';

function createDestroyedEditor(): Editor {
  return {
    isDestroyed: true,
    off: vi.fn(),
    on: vi.fn(),
    state: {
      selection: {
        empty: true,
      },
    },
    storage: {},
  } as unknown as Editor;
}

function EditorProbe({ editor }: { readonly editor: Editor }) {
  const { editor: resolvedEditor } = useTiptapEditor(editor);

  return <output data-testid="resolved-editor">{resolvedEditor ? 'ready' : 'null'}</output>;
}

describe('useTiptapEditor', () => {
  it('normalizes a destroyed provided editor to null', () => {
    const editor = createDestroyedEditor();

    render(<EditorProbe editor={editor} />);

    expect(screen.getByTestId('resolved-editor')).toHaveTextContent('null');
    expect(editor.on).not.toHaveBeenCalled();
  });
});
