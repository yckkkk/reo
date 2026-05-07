import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const TRANSCRIPT_PREVIEW_LIMIT = 1200;

type TranscriptReflectionsEditorProps = {
  readonly onReflectionsChange: (value: string) => void;
  readonly onTranscriptChange: (value: string) => void;
  readonly reflections: string;
  readonly transcript: string;
};

export function TranscriptReflectionsEditor({
  onReflectionsChange,
  onTranscriptChange,
  reflections,
  transcript,
}: TranscriptReflectionsEditorProps) {
  return (
    <div className="flex flex-col gap-16">
      <TranscriptDraftPreview value={transcript} />
      <div className="grid gap-16 md:grid-cols-2">
        <DraftField
          id="recording-transcript"
          label="Transcript"
          value={transcript}
          onChange={onTranscriptChange}
        />
        <DraftField
          id="recording-reflections"
          label="Reflections"
          value={reflections}
          onChange={onReflectionsChange}
        />
      </div>
    </div>
  );
}

type TranscriptDraftPreviewProps = {
  readonly value: string;
};

function TranscriptDraftPreview({ value }: TranscriptDraftPreviewProps) {
  const preview = value.slice(0, TRANSCRIPT_PREVIEW_LIMIT);
  const truncated = value.length > TRANSCRIPT_PREVIEW_LIMIT;

  return (
    <section
      aria-label="Transcript preview"
      className="rounded-cards border border-chalk bg-card-white px-16 py-16"
    >
      <h3 className="mb-8 text-body-lg font-medium leading-body-lg text-obsidian">
        Transcript preview
      </h3>
      {preview.trim().length > 0 ? (
        <p className="whitespace-pre-wrap text-body leading-body text-cinder">{preview}</p>
      ) : (
        <p className="text-body leading-body text-gravel">Transcript draft is empty.</p>
      )}
      {truncated ? (
        <p className="mt-8 text-caption leading-caption text-gravel">
          Preview shows the first {TRANSCRIPT_PREVIEW_LIMIT} characters.
        </p>
      ) : null}
    </section>
  );
}

type DraftFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
};

function DraftField({ id, label, onChange, value }: DraftFieldProps) {
  return (
    <div className="flex flex-col gap-8">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
