import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type WorkspaceStarterHomeProps = {
  readonly onCreateWorkspace: () => void;
};

export function WorkspaceStarterHome({ onCreateWorkspace }: WorkspaceStarterHomeProps) {
  return (
    <section className="flex min-h-full flex-col px-32 py-40 sm:px-56">
      <header className="mx-auto flex w-full max-w-[960px] flex-col items-center gap-16 pt-32 text-center">
        <h1 className="font-waldenburg text-heading-lg font-light leading-heading-lg text-obsidian">
          All memories
        </h1>
        <p className="max-w-[560px] text-body-lg leading-body-lg text-gravel">
          Create a local workspace to start collecting memories.
        </p>
        <Button
          type="button"
          variant="accentCircle"
          size="iconLarge"
          className="mt-12"
          aria-label="Create workspace"
          onClick={onCreateWorkspace}
        >
          <Plus className="size-24" aria-hidden="true" />
        </Button>
      </header>
    </section>
  );
}
