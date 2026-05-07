import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { MemoryCardView } from './MemoryCard';
import { countLabel, durationLabel } from './memoryLabels';
import { MemorySection } from './MemorySection';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceHomeProps = {
  readonly onOpenMemory: (memoryId: string) => void;
  readonly workspaceSession: WorkspaceSession;
  readonly onStartRecording: () => void;
};

type WorkspaceMemory = WorkspaceSession['snapshot']['memories'][number];

type MemoryView = MemoryCardView & {
  readonly createdTimestamp: number;
  readonly month: string;
  readonly searchText: string;
};

type MemoryMonthSection = {
  readonly month: string;
  readonly countLabel: string;
  readonly memories: readonly MemoryCardView[];
};

function createMemoryView(memory: WorkspaceMemory): MemoryView {
  const createdAt = new Date(memory.createdAt);
  const month = format(createdAt, 'MMMM yyyy');
  const createdDateLabel = format(createdAt, 'MMM d, yyyy');

  return {
    createdAt: memory.createdAt,
    createdDateLabel,
    createdTimestamp: createdAt.getTime(),
    durationLabel: durationLabel(memory.durationMs),
    hasReflections: memory.hasReflections,
    hasTranscript: memory.hasTranscript,
    memoryId: memory.memoryId,
    month,
    recordingCountLabel: countLabel(memory.recordingCount, 'recording', 'recordings'),
    searchText: [
      memory.title,
      month,
      createdDateLabel,
      memory.hasTranscript ? 'Transcript' : '',
      memory.hasReflections ? 'Reflections' : '',
    ]
      .join(' ')
      .toLowerCase(),
    title: memory.title,
  };
}

function groupMemoryViews(memories: readonly MemoryView[]): MemoryMonthSection[] {
  const sections: Array<{ month: string; memories: MemoryView[] }> = [];

  for (const memory of memories) {
    const currentSection = sections[sections.length - 1];

    if (currentSection && currentSection.month === memory.month) {
      currentSection.memories.push(memory);
    } else {
      sections.push({ month: memory.month, memories: [memory] });
    }
  }

  return sections.map((section) => ({
    countLabel: countLabel(section.memories.length, 'memory', 'memories'),
    memories: section.memories,
    month: section.month,
  }));
}

export function WorkspaceHome({
  onOpenMemory,
  onStartRecording,
  workspaceSession,
}: WorkspaceHomeProps) {
  const { snapshot } = workspaceSession;
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const sortedMemories = useMemo(
    () =>
      snapshot.memories
        .map(createMemoryView)
        .sort((left, right) => right.createdTimestamp - left.createdTimestamp),
    [snapshot.memories]
  );
  const visibleMemories = useMemo(
    () =>
      normalizedSearchTerm
        ? sortedMemories.filter((memory) => memory.searchText.includes(normalizedSearchTerm))
        : sortedMemories,
    [normalizedSearchTerm, sortedMemories]
  );
  const monthSections = useMemo(() => groupMemoryViews(visibleMemories), [visibleMemories]);
  const isSearching = normalizedSearchTerm.length > 0;

  return (
    <section className="min-h-full px-24 py-32 text-obsidian sm:px-48 sm:py-48">
      <section className="mx-auto flex w-full max-w-[1120px] flex-col gap-32">
        <header className="flex flex-col gap-24 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-[640px]">
            <p className="break-words font-waldenburgfh text-body font-bold uppercase leading-body text-gravel">
              {snapshot.title}
            </p>
            <h1 className="mt-8 font-waldenburg text-display font-light leading-display tracking-display text-obsidian">
              All memories
            </h1>
            {snapshot.description ? (
              <p className="mt-12 break-words text-body-lg leading-body-lg text-gravel">
                {snapshot.description}
              </p>
            ) : null}
          </div>
          <Button type="button" onClick={onStartRecording}>
            Record memory
          </Button>
        </header>

        <Separator decorative />

        <section className="flex flex-col gap-24" aria-labelledby="memories-list-title">
          <h2 id="memories-list-title" className="sr-only">
            Saved memories
          </h2>
          <div className="flex flex-col gap-16 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-[420px]">
              <Input
                aria-label="Search memories"
                placeholder="Search memories"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <p className="text-body leading-body text-gravel">
              {countLabel(visibleMemories.length, 'memory', 'memories')}
            </p>
          </div>

          {monthSections.length === 0 ? (
            <div className="rounded-cards border border-chalk bg-card-white px-24 py-32 shadow-subtle">
              <p className="text-body-lg leading-body-lg text-obsidian">
                {isSearching ? 'No matching memories.' : 'No memories yet.'}
              </p>
              <p className="mt-8 text-body leading-body text-gravel">
                {isSearching
                  ? 'Clear search to return to this workspace.'
                  : 'Recorded memories appear here after they are saved.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-32">
              {monthSections.map((section) => (
                <MemorySection key={section.month} section={section} onOpenMemory={onOpenMemory} />
              ))}
            </div>
          )}
        </section>
      </section>
    </section>
  );
}
