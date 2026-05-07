import { Separator } from '@/components/ui/separator';
import { MemoryCard } from './MemoryCard';
import type { MemoryCardView } from './MemoryCard';

type MemorySectionProps = {
  readonly onOpenMemory: (memoryId: string) => void;
  readonly section: {
    readonly month: string;
    readonly countLabel: string;
    readonly memories: readonly MemoryCardView[];
  };
};

export function MemorySection({ onOpenMemory, section }: MemorySectionProps) {
  return (
    <section className="flex flex-col gap-20" aria-label={section.month}>
      <div className="flex items-center justify-between gap-16">
        <h2 className="font-waldenburg text-heading font-light leading-heading tracking-heading text-obsidian">
          {section.month}
        </h2>
        <Separator decorative className="hidden flex-1 sm:block" />
        <p className="text-body leading-body text-gravel">{section.countLabel}</p>
      </div>

      <div className="grid gap-16 lg:grid-cols-2">
        {section.memories.map((memory) => (
          <MemoryCard key={memory.memoryId} memory={memory} onOpenMemory={onOpenMemory} />
        ))}
      </div>
    </section>
  );
}
