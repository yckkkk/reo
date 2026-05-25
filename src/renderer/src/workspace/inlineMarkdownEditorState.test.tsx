import { describe, expect, it } from 'vitest';
import {
  createInlineMarkdownEditorState,
  inlineMarkdownEditorIsDirty,
  inlineMarkdownEditorReducer,
} from './inlineMarkdownEditorState';

describe('inlineMarkdownEditorState', () => {
  it('keeps focus independent from dirty state and clears focus after a successful save', () => {
    let state = createInlineMarkdownEditorState({
      baselineContentHash: 'a'.repeat(64),
      markdown: 'Original body',
    });

    state = inlineMarkdownEditorReducer(state, {
      type: 'textarea-focus-changed',
      textareaFocused: true,
    });
    expect(state.textareaFocused).toBe(true);
    expect(inlineMarkdownEditorIsDirty(state)).toBe(false);

    state = inlineMarkdownEditorReducer(state, { type: 'markdown-changed', markdown: 'Updated' });
    expect(state.textareaFocused).toBe(true);
    expect(inlineMarkdownEditorIsDirty(state)).toBe(true);

    state = inlineMarkdownEditorReducer(state, { type: 'save-started' });
    state = inlineMarkdownEditorReducer(state, {
      type: 'save-succeeded',
      nextBaselineContentHash: 'b'.repeat(64),
    });

    expect(state.textareaFocused).toBe(false);
    expect(state.markdown).toBe('Updated');
    expect(state.cleanMarkdown).toBe('Updated');
    expect(state.activeBaselineContentHash).toBe('b'.repeat(64));
    expect(inlineMarkdownEditorIsDirty(state)).toBe(false);
  });

  it('resets focus and dirty state when the active editor target changes', () => {
    let state = createInlineMarkdownEditorState({
      baselineContentHash: 'a'.repeat(64),
      markdown: 'Original body',
    });

    state = inlineMarkdownEditorReducer(state, {
      type: 'textarea-focus-changed',
      textareaFocused: true,
    });
    state = inlineMarkdownEditorReducer(state, { type: 'markdown-changed', markdown: 'Draft' });
    state = inlineMarkdownEditorReducer(state, {
      type: 'target-changed',
      baselineContentHash: 'c'.repeat(64),
      markdown: 'Next body',
    });

    expect(state.textareaFocused).toBe(false);
    expect(state.markdown).toBe('Next body');
    expect(state.cleanMarkdown).toBe('Next body');
    expect(state.activeBaselineContentHash).toBe('c'.repeat(64));
    expect(inlineMarkdownEditorIsDirty(state)).toBe(false);
  });
});
