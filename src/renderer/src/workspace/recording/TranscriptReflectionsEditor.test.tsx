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

    expect(screen.getByRole('region', { name: 'Transcript preview' })).toHaveTextContent(
      'What I said.'
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Transcript' }), {
      target: { value: 'Edited transcript' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Reflections' }), {
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

    const preview = screen.getByRole('region', { name: 'Transcript preview' });
    expect(preview).toHaveTextContent('Preview shows the first 1200 characters.');
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

    expect(screen.getByText('Transcript draft is empty.')).toBeInTheDocument();
  });
});
