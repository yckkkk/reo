import type { JSONContent } from '@tiptap/core';
import type { NoteContentConflict } from './noteEditorModel';

export type InlineMarkdownEditorState = {
  readonly activeBaselineContentHash: string;
  readonly activeBaselineTiptapContentHash: string | null;
  readonly cleanMarkdown: string;
  readonly cleanTiptapJson: JSONContent | null;
  readonly cleanTiptapJsonKey: string;
  readonly conflict: NoteContentConflict | null;
  readonly diskChangeNoticeVisible: boolean;
  readonly errorMessage: string | null;
  readonly lastInputBaselineContentHash: string;
  readonly lastInputBaselineTiptapContentHash: string | null;
  readonly lastInputMarkdown: string;
  readonly lastInputTiptapJson: JSONContent | null;
  readonly lastInputTiptapJsonKey: string;
  readonly markdown: string;
  readonly tiptapJson: JSONContent | null;
  readonly tiptapJsonKey: string;
  readonly pending: boolean;
  readonly editorFocused: boolean;
};

type InlineMarkdownEditorStateInput = {
  readonly baselineContentHash: string;
  readonly baselineTiptapContentHash?: string | null;
  readonly markdown: string;
  readonly tiptapJson?: JSONContent | null;
};

export type InlineMarkdownEditorAction =
  | {
      readonly type: 'target-changed';
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash?: string | null;
      readonly markdown: string;
      readonly tiptapJson?: JSONContent | null;
    }
  | {
      readonly type: 'input-received';
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash?: string | null;
      readonly markdown: string;
      readonly tiptapJson?: JSONContent | null;
    }
  | { readonly type: 'workspace-session-changed' }
  | {
      readonly type: 'markdown-changed';
      readonly markdown: string;
      readonly tiptapJson?: JSONContent;
      readonly tiptapJsonKey?: string;
    }
  | { readonly type: 'editor-focus-changed'; readonly editorFocused: boolean }
  | { readonly type: 'save-started' }
  | { readonly type: 'save-stale-session' }
  | {
      readonly type: 'save-succeeded';
      readonly nextBaselineContentHash?: string;
      readonly nextBaselineTiptapContentHash?: string;
    }
  | { readonly type: 'save-conflicted'; readonly conflict: NoteContentConflict }
  | { readonly type: 'save-failed'; readonly message: string }
  | {
      readonly type: 'disk-version-accepted';
      readonly baselineContentHash: string;
      readonly baselineTiptapContentHash?: string | null;
      readonly markdown: string;
      readonly tiptapJson?: JSONContent | null;
    }
  | { readonly type: 'cancel-clean' }
  | { readonly type: 'conflict-dismissed' }
  | { readonly type: 'error-set'; readonly message: string | null };

function tiptapJsonKey(content: JSONContent | null): string {
  return content === null ? 'null' : JSON.stringify(content);
}

export function createInlineMarkdownEditorState({
  baselineContentHash,
  baselineTiptapContentHash = null,
  markdown,
  tiptapJson = null,
}: InlineMarkdownEditorStateInput): InlineMarkdownEditorState {
  const initialTiptapJsonKey = tiptapJsonKey(tiptapJson);
  return {
    activeBaselineContentHash: baselineContentHash,
    activeBaselineTiptapContentHash: baselineTiptapContentHash,
    cleanMarkdown: markdown,
    cleanTiptapJson: tiptapJson,
    cleanTiptapJsonKey: initialTiptapJsonKey,
    conflict: null,
    diskChangeNoticeVisible: false,
    errorMessage: null,
    lastInputBaselineContentHash: baselineContentHash,
    lastInputBaselineTiptapContentHash: baselineTiptapContentHash,
    lastInputMarkdown: markdown,
    lastInputTiptapJson: tiptapJson,
    lastInputTiptapJsonKey: initialTiptapJsonKey,
    markdown,
    tiptapJson,
    tiptapJsonKey: initialTiptapJsonKey,
    pending: false,
    editorFocused: false,
  };
}

export function inlineMarkdownEditorIsDirty(state: InlineMarkdownEditorState) {
  return state.markdown !== state.cleanMarkdown || state.tiptapJsonKey !== state.cleanTiptapJsonKey;
}

export function inlineMarkdownEditorHasUnacceptedDiskVersion(state: InlineMarkdownEditorState) {
  return (
    state.lastInputBaselineContentHash !== state.activeBaselineContentHash ||
    state.lastInputBaselineTiptapContentHash !== state.activeBaselineTiptapContentHash
  );
}

export function inlineMarkdownEditorReducer(
  state: InlineMarkdownEditorState,
  action: InlineMarkdownEditorAction
): InlineMarkdownEditorState {
  switch (action.type) {
    case 'target-changed':
      return createInlineMarkdownEditorState({
        baselineContentHash: action.baselineContentHash,
        baselineTiptapContentHash: action.baselineTiptapContentHash ?? null,
        markdown: action.markdown,
        tiptapJson: action.tiptapJson ?? null,
      });

    case 'input-received': {
      const nextBaselineTiptapContentHash = action.baselineTiptapContentHash ?? null;
      const nextInputTiptapJson = action.tiptapJson ?? null;
      const nextState = {
        ...state,
        lastInputBaselineContentHash: action.baselineContentHash,
        lastInputBaselineTiptapContentHash: nextBaselineTiptapContentHash,
        lastInputMarkdown: action.markdown,
        lastInputTiptapJson: nextInputTiptapJson,
        lastInputTiptapJsonKey: tiptapJsonKey(nextInputTiptapJson),
      };
      if (
        action.baselineContentHash === state.lastInputBaselineContentHash &&
        nextBaselineTiptapContentHash === state.lastInputBaselineTiptapContentHash
      ) {
        return {
          ...nextState,
          diskChangeNoticeVisible: false,
        };
      }
      if (
        action.baselineContentHash === state.activeBaselineContentHash &&
        nextBaselineTiptapContentHash === state.activeBaselineTiptapContentHash
      ) {
        return {
          ...nextState,
          diskChangeNoticeVisible: false,
        };
      }
      if (inlineMarkdownEditorIsDirty(state)) {
        return {
          ...nextState,
          diskChangeNoticeVisible: true,
        };
      }
      return {
        ...nextState,
        activeBaselineContentHash: action.baselineContentHash,
        activeBaselineTiptapContentHash: nextBaselineTiptapContentHash,
        cleanMarkdown: action.markdown,
        cleanTiptapJson: nextInputTiptapJson,
        cleanTiptapJsonKey: tiptapJsonKey(nextInputTiptapJson),
        diskChangeNoticeVisible: false,
        errorMessage: null,
        markdown: action.markdown,
        tiptapJson: nextInputTiptapJson,
        tiptapJsonKey: tiptapJsonKey(nextInputTiptapJson),
      };
    }

    case 'workspace-session-changed':
      return {
        ...state,
        conflict: null,
        pending: false,
        editorFocused: false,
      };

    case 'markdown-changed': {
      const nextTiptapJson = action.tiptapJson ?? state.tiptapJson;
      return {
        ...state,
        errorMessage: null,
        markdown: action.markdown,
        tiptapJson: nextTiptapJson,
        tiptapJsonKey: action.tiptapJsonKey ?? tiptapJsonKey(nextTiptapJson),
      };
    }

    case 'editor-focus-changed':
      return {
        ...state,
        editorFocused: action.editorFocused,
      };

    case 'save-started':
      return {
        ...state,
        errorMessage: null,
        pending: true,
      };

    case 'save-stale-session':
      return {
        ...state,
        pending: false,
      };

    case 'save-succeeded': {
      const nextBaselineContentHash =
        action.nextBaselineContentHash ?? state.activeBaselineContentHash;
      const nextBaselineTiptapContentHash =
        action.nextBaselineTiptapContentHash ?? state.activeBaselineTiptapContentHash;
      return {
        ...state,
        activeBaselineContentHash: nextBaselineContentHash,
        activeBaselineTiptapContentHash: nextBaselineTiptapContentHash,
        cleanMarkdown: state.markdown,
        cleanTiptapJson: state.tiptapJson,
        cleanTiptapJsonKey: state.tiptapJsonKey,
        conflict: null,
        diskChangeNoticeVisible: false,
        errorMessage: null,
        lastInputBaselineContentHash: nextBaselineContentHash,
        lastInputBaselineTiptapContentHash: nextBaselineTiptapContentHash,
        lastInputMarkdown: state.markdown,
        lastInputTiptapJson: state.tiptapJson,
        lastInputTiptapJsonKey: state.tiptapJsonKey,
        pending: false,
        editorFocused: false,
      };
    }

    case 'save-conflicted':
      return {
        ...state,
        conflict: action.conflict,
        pending: false,
      };

    case 'save-failed':
      return {
        ...state,
        errorMessage: action.message,
        pending: false,
      };

    case 'disk-version-accepted': {
      const nextTiptapJson = action.tiptapJson ?? null;
      const nextTiptapJsonKey = tiptapJsonKey(nextTiptapJson);
      return {
        ...state,
        activeBaselineContentHash: action.baselineContentHash,
        activeBaselineTiptapContentHash: action.baselineTiptapContentHash ?? null,
        cleanMarkdown: action.markdown,
        cleanTiptapJson: nextTiptapJson,
        cleanTiptapJsonKey: nextTiptapJsonKey,
        conflict: null,
        diskChangeNoticeVisible: false,
        errorMessage: null,
        lastInputBaselineContentHash: action.baselineContentHash,
        lastInputBaselineTiptapContentHash: action.baselineTiptapContentHash ?? null,
        lastInputMarkdown: action.markdown,
        lastInputTiptapJson: nextTiptapJson,
        lastInputTiptapJsonKey: nextTiptapJsonKey,
        markdown: action.markdown,
        tiptapJson: nextTiptapJson,
        tiptapJsonKey: nextTiptapJsonKey,
        editorFocused: false,
      };
    }

    case 'cancel-clean':
      return {
        ...state,
        conflict: null,
        diskChangeNoticeVisible: false,
        errorMessage: null,
        markdown: state.cleanMarkdown,
        tiptapJson: state.cleanTiptapJson,
        tiptapJsonKey: state.cleanTiptapJsonKey,
        editorFocused: false,
      };

    case 'conflict-dismissed':
      return {
        ...state,
        conflict: null,
      };

    case 'error-set':
      return {
        ...state,
        errorMessage: action.message,
      };
  }
}
