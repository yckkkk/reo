import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Mic2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { byteLengthLabel, countLabel, durationLabel } from './memoryLabels';
import { memoryDetailQueryOptions } from './workspaceQueries';

type MemoryDetailPageProps = {
  readonly memoryId: string;
  readonly onBack: () => void;
  readonly onRecordMemory: () => void;
  readonly workspaceHandle: string;
  readonly workspaceId: string;
};

export function MemoryDetailPage({
  memoryId,
  onBack,
  onRecordMemory,
  workspaceHandle,
  workspaceId,
}: MemoryDetailPageProps) {
  const memoryQuery = useQuery(
    memoryDetailQueryOptions({ memoryId, workspaceHandle, workspaceId })
  );

  if (memoryQuery.isPending) {
    return (
      <section className="min-h-full px-24 py-32 text-obsidian sm:px-48 sm:py-48">
        <p className="text-body-lg leading-body-lg text-gravel">正在加载记忆。</p>
      </section>
    );
  }

  if (memoryQuery.isError) {
    return (
      <section className="min-h-full px-24 py-32 text-obsidian sm:px-48 sm:py-48">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-16" aria-hidden="true" />
          返回
        </Button>
        <p className="mt-24 text-body-lg leading-body-lg text-gravel">无法打开这条记忆。</p>
      </section>
    );
  }

  const memory = memoryQuery.data;
  const createdDateLabel = format(new Date(memory.createdAt), 'yyyy年M月d日');

  return (
    <section className="min-h-full px-24 py-32 text-obsidian sm:px-48 sm:py-48">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-40">
        <header className="grid gap-24">
          <Button type="button" variant="secondary" className="justify-self-start" onClick={onBack}>
            <ArrowLeft className="size-16" aria-hidden="true" />
            返回
          </Button>

          <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
            <h1 className="break-words font-waldenburg text-display font-light leading-display tracking-display text-obsidian">
              {memory.title}
            </h1>
            <time
              className="mt-12 font-waldenburgfh text-body font-bold uppercase leading-body text-gravel"
              dateTime={memory.createdAt}
            >
              {createdDateLabel}
            </time>
            <div className="mt-28 flex flex-wrap items-center justify-center gap-12">
              <Button type="button" onClick={onRecordMemory}>
                <Mic2 className="size-16" aria-hidden="true" />
                继续记录
              </Button>
            </div>
          </div>
        </header>

        <MemoryDetailSection
          id="voice-recordings"
          title="语音录音"
          meta={countLabel(memory.assetCount, '段录音')}
        >
          {memory.recordings.length === 0 ? (
            <p className="text-body-lg leading-body-lg text-gravel">还没有保存录音。</p>
          ) : (
            <div className="grid gap-16 lg:grid-cols-2">
              {memory.recordings.map((recording) => (
                <article
                  key={recording.recordingId}
                  className="rounded-cards border border-chalk bg-card-white px-20 py-20 shadow-subtle"
                >
                  <h3 className="break-words text-body-lg font-medium leading-body-lg text-obsidian">
                    {recording.title}
                  </h3>
                  <dl className="mt-20 grid grid-cols-2 gap-12">
                    <div>
                      <dt className="font-waldenburgfh text-caption font-bold uppercase leading-caption text-slate">
                        时长
                      </dt>
                      <dd className="mt-4 text-body leading-body text-gravel">
                        {durationLabel(recording.durationMs)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-waldenburgfh text-caption font-bold uppercase leading-caption text-slate">
                        音频
                      </dt>
                      <dd className="mt-4 text-body leading-body text-gravel">
                        {byteLengthLabel(recording.audioByteLength)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
          {memory.recordingsTruncated ? (
            <p className="text-body leading-body text-gravel">
              已显示前 {memory.recordings.length} 段录音。
            </p>
          ) : null}
        </MemoryDetailSection>

        <div className="grid gap-16 lg:grid-cols-3">
          <MemoryDetailSection id="transcript" title="转写">
            <p className="text-body leading-body text-gravel">
              {memory.hasTranscript ? '已保存转写。' : '还没有保存转写。'}
            </p>
          </MemoryDetailSection>
          <MemoryDetailSection id="reflections" title="反思">
            <p className="text-body leading-body text-gravel">
              {memory.hasReflections ? '已保存反思。' : '还没有保存反思。'}
            </p>
          </MemoryDetailSection>
          <MemoryDetailSection id="memory-content" title="记忆内容">
            <p className="text-body leading-body text-gravel">保存后的记忆内容会显示在这里。</p>
          </MemoryDetailSection>
        </div>
      </div>
    </section>
  );
}

function MemoryDetailSection({
  children,
  id,
  meta,
  title,
}: {
  readonly children: ReactNode;
  readonly id: string;
  readonly meta?: string;
  readonly title: string;
}) {
  const titleId = `${id}-title`;

  return (
    <section className="flex flex-col gap-20" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-16">
        <h2
          id={titleId}
          className="font-waldenburgfh text-body font-bold uppercase leading-body text-slate"
        >
          {title}
        </h2>
        <Separator decorative className="hidden flex-1 sm:block" />
        {meta ? <p className="text-body leading-body text-gravel">{meta}</p> : null}
      </div>
      {children}
    </section>
  );
}
