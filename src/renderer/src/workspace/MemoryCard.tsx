export type MemoryCardView = {
  readonly memoryId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly createdDateLabel: string;
  readonly recordingCountLabel: string;
  readonly durationLabel: string;
  readonly hasTranscript: boolean;
  readonly hasReflections: boolean;
};

type MemoryCardProps = {
  readonly memory: MemoryCardView;
  readonly onOpenMemory: (memoryId: string) => void;
};

export function MemoryCard({ memory, onOpenMemory }: MemoryCardProps) {
  const hasStatus = memory.hasTranscript || memory.hasReflections;

  return (
    <article className="relative rounded-cards border border-chalk bg-card-white px-20 py-20 text-left shadow-subtle transition-colors hover:border-slate focus-within:ring-2 focus-within:ring-signal-blue focus-within:ring-offset-2 focus-within:ring-offset-eggshell">
      <button
        type="button"
        aria-label={`Open ${memory.title}`}
        className="absolute inset-0 z-10 rounded-cards focus-visible:outline-none"
        onClick={() => onOpenMemory(memory.memoryId)}
      />
      <h3 className="break-words text-body-lg font-medium leading-body-lg text-obsidian">
        {memory.title}
      </h3>
      <time className="mt-8 block text-body leading-body text-gravel" dateTime={memory.createdAt}>
        {memory.createdDateLabel}
      </time>

      <dl className="mt-20 grid grid-cols-2 gap-12">
        <div>
          <dt className="font-waldenburgfh text-caption font-bold uppercase leading-caption text-slate">
            Recordings
          </dt>
          <dd className="mt-4 text-body leading-body text-gravel">{memory.recordingCountLabel}</dd>
        </div>
        <div>
          <dt className="font-waldenburgfh text-caption font-bold uppercase leading-caption text-slate">
            Duration
          </dt>
          <dd className="mt-4 text-body leading-body text-gravel">{memory.durationLabel}</dd>
        </div>
      </dl>

      {hasStatus ? (
        <div className="mt-16 flex flex-wrap gap-8">
          {memory.hasTranscript ? (
            <span className="rounded-tags border border-chalk bg-eggshell px-12 py-4 text-body leading-body text-gravel">
              Transcript
            </span>
          ) : null}
          {memory.hasReflections ? (
            <span className="rounded-tags border border-chalk bg-eggshell px-12 py-4 text-body leading-body text-gravel">
              Reflections
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
