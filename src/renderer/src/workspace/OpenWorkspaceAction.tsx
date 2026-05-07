import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { WorkspaceSession } from './workspaceApi';
import { openWorkspace } from './workspaceApi';
import { chooseSafeWorkspaceFolder } from './workspaceFolderSelection';
import { WorkspaceErrorBanner } from './WorkspaceErrorBanner';

type OpenWorkspaceActionProps = {
  readonly onWorkspaceReady: (workspaceSession: WorkspaceSession) => void;
};

export function OpenWorkspaceAction({ onWorkspaceReady }: OpenWorkspaceActionProps) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  async function handleOpenWorkspace() {
    if (opening) {
      return;
    }

    setOpening(true);
    setError(null);
    const selection = await chooseSafeWorkspaceFolder();

    if (selection.status === 'error') {
      setError(selection.message);
      setOpening(false);
      return;
    }

    if (selection.status === 'canceled') {
      setOpening(false);
      return;
    }

    const response = await openWorkspace({ selectionToken: selection.selection.selectionToken });
    setOpening(false);

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    onWorkspaceReady(response.value);
  }

  return (
    <section className="flex flex-col gap-12" aria-labelledby="open-workspace-title">
      <div className="flex flex-col gap-8">
        <h2
          id="open-workspace-title"
          className="text-body-lg font-bold leading-body-lg text-cinder"
        >
          Open existing workspace
        </h2>
        <p className="text-body leading-body text-gravel">
          Continue from a local Reo workspace folder.
        </p>
      </div>
      <Button type="button" variant="secondary" disabled={opening} onClick={handleOpenWorkspace}>
        {opening ? 'Opening workspace' : 'Open workspace'}
      </Button>
      {error ? <WorkspaceErrorBanner>{error}</WorkspaceErrorBanner> : null}
    </section>
  );
}
