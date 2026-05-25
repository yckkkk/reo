import type { NoteContentConflict } from './noteEditorModel';

export type InlineMarkdownEditorState = {
  readonly activeBaselineContentHash: string;
  readonly cleanMarkdown: string;
  readonly conflict: NoteContentConflict | null;
  readonly diskChangeNoticeVisible: boolean;
  readonly errorMessage: string | null;
  readonly lastInputBaselineContentHash: string;
  readonly lastInputMarkdown: string;
  readonly markdown: string;
  readonly pending: boolean;
  readonly editorFocused: boolean;
};

type InlineMarkdownEditorStateInput = {
  readonly baselineContentHash: string;
  readonly markdown: string;
};

export type InlineMarkdownEditorAction =
  | {
      readonly type: 'target-changed';
      readonly baselineContentHash: string;
      readonly markdown: string;
    }
  | {
      readonly type: 'input-received';
      readonly baselineContentHash: string;
      readonly markdown: string;
    }
  | { readonly type: 'workspace-session-changed' }
  | { readonly type: 'markdown-changed'; readonly markdown: string }
  | { readonly type: 'editor-focus-changed'; readonly editorFocused: boolean }
  | { readonly type: 'save-started' }
  | { readonly type: 'save-stale-session' }
  | { readonly type: 'save-succeeded'; readonly nextBaselineContentHash?: string }
  | { readonly type: 'save-conflicted'; readonly conflict: NoteContentConflict }
  | { readonly type: 'save-failed'; readonly message: string }
  | {
      readonly type: 'disk-version-accepted';
      readonly baselineContentHash: string;
      readonly markdown: string;
    }
  | { readonly type: 'cancel-clean' }
  | { readonly type: 'conflict-dismissed' }
  | { readonly type: 'error-set'; readonly message: string | null };

export function createInlineMarkdownEditorState({
  baselineContentHash,
  markdown,
}: InlineMarkdownEditorStateInput): InlineMarkdownEditorState {
  return {
    activeBaselineContentHash: baselineContentHash,
    cleanMarkdown: markdown,
    conflict: null,
    diskChangeNoticeVisible: false,
    errorMessage: null,
    lastInputBaselineContentHash: baselineContentHash,
    lastInputMarkdown: markdown,
    markdown,
    pending: false,
    editorFocused: false,
  };
}

export function inlineMarkdownEditorIsDirty(state: InlineMarkdownEditorState) {
  return state.markdown !== state.cleanMarkdown;
}

export function inlineMarkdownEditorReducer(
  state: InlineMarkdownEditorState,
  action: InlineMarkdownEditorAction
): InlineMarkdownEditorState {
  switch (action.type) {
    case 'target-changed':
      return createInlineMarkdownEditorState({
        baselineContentHash: action.baselineContentHash,
        markdown: action.markdown,
      });

    case 'input-received': {
      const nextState = {
        ...state,
        lastInputBaselineContentHash: action.baselineContentHash,
        lastInputMarkdown: action.markdown,
      };
      if (action.baselineContentHash === state.lastInputBaselineContentHash) {
        return {
          ...nextState,
          diskChangeNoticeVisible: false,
        };
      }
      if (action.baselineContentHash === state.activeBaselineContentHash) {
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
        cleanMarkdown: action.markdown,
        diskChangeNoticeVisible: false,
        errorMessage: null,
        markdown: action.markdown,
      };
    }

    case 'workspace-session-changed':
      return {
        ...state,
        conflict: null,
        pending: false,
        editorFocused: false,
      };

    case 'markdown-changed':
      return {
        ...state,
        errorMessage: null,
        markdown: action.markdown,
      };

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
      return {
        ...state,
        activeBaselineContentHash: nextBaselineContentHash,
        cleanMarkdown: state.markdown,
        conflict: null,
        diskChangeNoticeVisible: false,
        errorMessage: null,
        lastInputBaselineContentHash: nextBaselineContentHash,
        lastInputMarkdown: state.markdown,
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

    case 'disk-version-accepted':
      return {
        ...state,
        activeBaselineContentHash: action.baselineContentHash,
        cleanMarkdown: action.markdown,
        conflict: null,
        diskChangeNoticeVisible: false,
        errorMessage: null,
        lastInputBaselineContentHash: action.baselineContentHash,
        lastInputMarkdown: action.markdown,
        markdown: action.markdown,
        editorFocused: false,
      };

    case 'cancel-clean':
      return {
        ...state,
        conflict: null,
        diskChangeNoticeVisible: false,
        errorMessage: null,
        markdown: state.cleanMarkdown,
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
