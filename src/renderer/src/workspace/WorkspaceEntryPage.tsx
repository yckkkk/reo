import { CreateWorkspaceForm } from './CreateWorkspaceForm';
import { OpenWorkspaceAction } from './OpenWorkspaceAction';
import type { WorkspaceSession } from './workspaceApi';

type WorkspaceEntryPageProps = {
  readonly onWorkspaceReady: (workspaceSession: WorkspaceSession) => void;
};

export function WorkspaceEntryPage({ onWorkspaceReady }: WorkspaceEntryPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-32 px-24 py-40 sm:px-40">
      <CreateWorkspaceForm onWorkspaceReady={onWorkspaceReady} />
      <OpenWorkspaceAction onWorkspaceReady={onWorkspaceReady} />
    </div>
  );
}
