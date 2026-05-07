import { Button } from '@/components/ui/button';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceHomeProps = {
  readonly workspaceSession: WorkspaceSession;
  readonly onStartRecording: () => void;
};

export function WorkspaceHome({ onStartRecording, workspaceSession }: WorkspaceHomeProps) {
  const { snapshot } = workspaceSession;

  return (
    <section className="min-h-full px-24 py-40 text-obsidian sm:px-40 sm:py-56">
      <section className="mx-auto flex w-full max-w-[960px] flex-col gap-48">
        <header className="mx-auto flex max-w-[720px] flex-col items-center gap-20 text-center">
          <p className="font-waldenburgfh text-body font-bold uppercase leading-body text-gravel">
            Reo Workspace
          </p>
          <h1 className="font-waldenburg text-display font-light leading-display tracking-display text-obsidian">
            {snapshot.title}
          </h1>
          {snapshot.description ? (
            <p className="max-w-[560px] text-body-lg leading-body-lg text-gravel">
              {snapshot.description}
            </p>
          ) : null}
          <Button type="button" onClick={onStartRecording}>
            Record memory
          </Button>
        </header>

        <section className="flex flex-col gap-20" aria-labelledby="memory-content-title">
          <div className="flex items-center justify-between gap-16">
            <h2
              id="memory-content-title"
              className="font-waldenburg text-heading font-light leading-heading tracking-heading text-obsidian"
            >
              Memory Content
            </h2>
            <p className="text-body leading-body text-gravel">{snapshot.recordings.length} items</p>
          </div>

          {snapshot.recordings.length === 0 ? (
            <div className="border border-chalk bg-card-white px-24 py-32 shadow-subtle">
              <p className="text-body-lg leading-body-lg text-obsidian">No recordings yet.</p>
              <p className="mt-8 text-body leading-body text-gravel">
                Recorded memories appear here after they are saved.
              </p>
            </div>
          ) : (
            <div className="grid gap-12 sm:grid-cols-2">
              {snapshot.recordings.map((recording) => (
                <article
                  className="border border-chalk bg-card-white px-20 py-20 shadow-subtle"
                  key={recording.recordingId}
                >
                  <h3 className="text-body-lg font-medium leading-body-lg text-obsidian">
                    {recording.title}
                  </h3>
                  <p className="mt-8 text-body leading-body text-gravel">
                    {recording.audioByteLength} bytes
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </section>
  );
}
