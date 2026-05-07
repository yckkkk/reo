import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { WorkspaceDirectorySelection } from './workspaceApi';
import { chooseSafeWorkspaceFolder } from './workspaceFolderSelection';
import { WorkspaceErrorBanner } from './WorkspaceErrorBanner';

type FolderPickerFieldProps = {
  readonly displayPath: string;
  readonly error?: string | undefined;
  readonly onCancel?: () => void;
  readonly onError: (message: string) => void;
  readonly onSelection: (selection: WorkspaceDirectorySelection) => void;
};

export function FolderPickerField({
  displayPath,
  error,
  onCancel,
  onError,
  onSelection,
}: FolderPickerFieldProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [selecting, setSelecting] = useState(false);

  async function handleChooseFolder() {
    if (selecting) {
      return;
    }

    setSelecting(true);
    const result = await chooseSafeWorkspaceFolder();
    setSelecting(false);

    if (result.status === 'error') {
      onError(result.message);
      buttonRef.current?.focus();
      return;
    }

    if (result.status === 'canceled') {
      onCancel?.();
      buttonRef.current?.focus();
      return;
    }

    onSelection(result.selection);
  }

  return (
    <section className="flex flex-col gap-12" aria-label="Workspace folder">
      <div className="flex flex-col gap-12 sm:flex-row sm:items-center">
        <Button
          ref={buttonRef}
          type="button"
          variant="default"
          disabled={selecting}
          onClick={handleChooseFolder}
        >
          {selecting ? 'Choosing folder' : 'Choose folder'}
        </Button>
        {displayPath ? (
          <p className="text-body leading-body text-cinder" aria-label="Selected folder">
            {displayPath}
          </p>
        ) : (
          <p className="text-body leading-body text-gravel">No folder selected.</p>
        )}
      </div>
      {error ? <WorkspaceErrorBanner>{error}</WorkspaceErrorBanner> : null}
    </section>
  );
}
