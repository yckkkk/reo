import type { Editor } from '@tiptap/react';
import { useCurrentEditor, useEditorState } from '@tiptap/react';
import { useEffect, useState } from 'react';

const interactiveSelectionEditors = new WeakSet<Editor>();

export function isUsableTiptapEditor(editor: Editor | null | undefined): editor is Editor {
  return Boolean(editor && !editor.isDestroyed);
}

export function hasInteractiveTiptapSelection(editor: Editor | null | undefined): editor is Editor {
  return (
    isUsableTiptapEditor(editor) &&
    editor.isEditable &&
    editor.isFocused &&
    interactiveSelectionEditors.has(editor)
  );
}

export function setTiptapInteractiveSelectionReady(
  editor: Editor | null | undefined,
  ready: boolean
) {
  if (!isUsableTiptapEditor(editor)) {
    return;
  }
  if (ready) {
    interactiveSelectionEditors.add(editor);
    return;
  }
  interactiveSelectionEditors.delete(editor);
}

function getActivePageEditor(editor: Editor): Editor | null {
  const storage = editor.storage as unknown as Record<string, unknown>;
  const pages = storage['pages'] as { activeEditor?: Editor | null } | undefined;
  if (!pages || !('activeEditor' in pages)) return null;
  return isUsableTiptapEditor(pages.activeEditor) ? pages.activeEditor : null;
}

export function useTiptapEditor(providedEditor?: Editor | null): {
  editor: Editor | null;
  editorState?: Editor['state'] | undefined;
  canCommand?: Editor['can'] | undefined;
} {
  const { editor: coreEditor } = useCurrentEditor();
  const candidateEditor = providedEditor ?? coreEditor;
  const mainEditor = isUsableTiptapEditor(candidateEditor) ? candidateEditor : null;

  const [storageEditor, setStorageEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (!mainEditor) {
      setStorageEditor(null);
      return;
    }

    const updateHandler = () => setStorageEditor(getActivePageEditor(mainEditor));

    updateHandler();

    mainEditor.on('update', updateHandler);
    mainEditor.on('selectionUpdate', updateHandler);

    return () => {
      mainEditor.off('update', updateHandler);
      mainEditor.off('selectionUpdate', updateHandler);
    };
  }, [mainEditor]);

  useEffect(() => {
    if (!isUsableTiptapEditor(storageEditor)) {
      if (storageEditor) {
        setStorageEditor(null);
      }
      return;
    }

    const handleDestroy = () => setStorageEditor(null);

    storageEditor.on('destroy', handleDestroy);
    return () => {
      storageEditor.off('destroy', handleDestroy);
    };
  }, [storageEditor]);

  const activeEditor = isUsableTiptapEditor(storageEditor) ? storageEditor : mainEditor;
  const editorState = useEditorState({
    editor: activeEditor,
    selector(context) {
      if (!isUsableTiptapEditor(context.editor)) {
        return { editor: null, editorState: undefined, canCommand: undefined };
      }

      return {
        editor: context.editor,
        editorState: context.editor.state,
        canCommand: context.editor.can,
      };
    },
  });
  const resolvedEditor = isUsableTiptapEditor(editorState?.editor)
    ? editorState.editor
    : activeEditor;

  return {
    editor: resolvedEditor,
    editorState: editorState?.editorState ?? resolvedEditor?.state,
    canCommand: editorState?.canCommand ?? resolvedEditor?.can,
  };
}
