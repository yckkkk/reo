import type { Editor } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import { canExecuteUndoRedoAction, executeUndoRedoAction } from './use-undo-redo';

function createDestroyedEditor(): Editor {
  return {
    isDestroyed: true,
    isEditable: true,
    state: {
      selection: {
        empty: true,
      },
    },
    can: vi.fn(() => {
      throw new TypeError("Cannot read properties of null (reading 'can')");
    }),
    chain: vi.fn(() => {
      throw new TypeError("Cannot read properties of null (reading 'chain')");
    }),
  } as unknown as Editor;
}

describe('undo redo toolbar actions', () => {
  it('treats a destroyed editor as unavailable before reading command capabilities', () => {
    const editor = createDestroyedEditor();

    expect(canExecuteUndoRedoAction(editor, 'undo')).toBe(false);
    expect(executeUndoRedoAction(editor, 'undo')).toBe(false);
    expect(editor.can).not.toHaveBeenCalled();
    expect(editor.chain).not.toHaveBeenCalled();
  });
});
