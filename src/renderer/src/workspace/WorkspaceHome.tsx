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
  const month = format(createdAt, 'yyyy年M月');
  const createdDateLabel = format(createdAt, 'yyyy年M月d日');

  return {
    createdAt: memory.createdAt,
    createdDateLabel,
    createdTimestamp: createdAt.getTime(),
    durationLabel: durationLabel(memory.durationMs),
    hasReflections: memory.hasReflections,
    hasTranscript: memory.hasTranscript,
    memoryId: memory.memoryId,
    month,
    recordingCountLabel: countLabel(memory.recordingCount, '段录音'),
    searchText: [
      memory.title,
      month,
      createdDateLabel,
      memory.hasTranscript ? '转写' : '',
      memory.hasReflections ? '反思' : '',
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
    countLabel: countLabel(section.memories.length, '条记忆'),
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
              全部记忆
            </h1>
            {snapshot.description ? (
              <p className="mt-12 break-words text-body-lg leading-body-lg text-gravel">
                {snapshot.description}
              </p>
            ) : null}
          </div>
          <Button type="button" onClick={onStartRecording}>
            记录记忆
          </Button>
        </header>

        <Separator decorative />

        <section className="flex flex-col gap-24" aria-labelledby="memories-list-title">
          <h2 id="memories-list-title" className="sr-only">
            已保存的记忆
          </h2>
          <div className="flex flex-col gap-16 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-[420px]">
              <Input
                aria-label="搜索记忆"
                placeholder="搜索记忆"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <p className="text-body leading-body text-gravel">
              {countLabel(visibleMemories.length, '条记忆')}
            </p>
          </div>

          {monthSections.length === 0 ? (
            <div className="rounded-cards border border-chalk bg-card-white px-24 py-32 shadow-subtle">
              <p className="text-body-lg leading-body-lg text-obsidian">
                {isSearching ? '没有匹配的记忆。' : '还没有记忆。'}
              </p>
              <p className="mt-8 text-body leading-body text-gravel">
                {isSearching ? '清空搜索即可返回此记忆空间。' : '保存后的记忆会显示在这里。'}
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
