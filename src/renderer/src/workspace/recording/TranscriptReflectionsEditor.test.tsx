import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TranscriptReflectionsEditor } from './TranscriptReflectionsEditor';

describe('TranscriptReflectionsEditor', () => {
  it('combines transcript preview with local transcript and reflections drafts', () => {
    const onReflectionsChange = vi.fn();
    const onTranscriptChange = vi.fn();

    render(
      <TranscriptReflectionsEditor
        reflections="What I noticed."
        transcript="What I said."
        onReflectionsChange={onReflectionsChange}
        onTranscriptChange={onTranscriptChange}
      />
    );

    expect(screen.getByRole('region', { name: '转写预览' })).toHaveTextContent('What I said.');
    fireEvent.change(screen.getByRole('textbox', { name: '转写' }), {
      target: { value: 'Edited transcript' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '反思' }), {
      target: { value: 'Edited reflection' },
    });

    expect(onTranscriptChange).toHaveBeenCalledWith('Edited transcript');
    expect(onReflectionsChange).toHaveBeenCalledWith('Edited reflection');
    expect(screen.queryByText(/speech-to-text|transcribing|\bAI\b/i)).not.toBeInTheDocument();
  });

  it('bounds the live transcript preview on long drafts', () => {
    render(
      <TranscriptReflectionsEditor
        reflections=""
        transcript={`${'a'.repeat(1200)}tail`}
        onReflectionsChange={() => {}}
        onTranscriptChange={() => {}}
      />
    );

    const preview = screen.getByRole('region', { name: '转写预览' });
    expect(preview).toHaveTextContent('预览仅显示前 1200 个字符。');
    expect(within(preview).queryByText(/tail/)).not.toBeInTheDocument();
  });

  it('uses the empty transcript label for whitespace-only drafts', () => {
    render(
      <TranscriptReflectionsEditor
        reflections=""
        transcript="   "
        onReflectionsChange={() => {}}
        onTranscriptChange={() => {}}
      />
    );

    expect(screen.getByText('转写草稿为空。')).toBeInTheDocument();
  });
});
