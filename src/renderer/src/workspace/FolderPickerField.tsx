import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { WorkspaceDirectorySelection } from './workspaceApi';
import { chooseSafeWorkspaceFolder } from './workspaceFolderSelection';
import { WorkspaceErrorBanner } from './WorkspaceErrorBanner';

type FolderPickerFieldProps = {
  readonly disabled?: boolean;
  readonly displayPath: string;
  readonly error?: string | undefined;
  readonly onCancel?: () => void;
  readonly onError: (message: string) => void;
  readonly onSelection: (selection: WorkspaceDirectorySelection) => void;
};

export function FolderPickerField({
  disabled = false,
  displayPath,
  error,
  onCancel,
  onError,
  onSelection,
}: FolderPickerFieldProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [selecting, setSelecting] = useState(false);

  async function handleChooseFolder() {
    if (disabled || selecting) {
      return;
    }

    setSelecting(true);
    let result: Awaited<ReturnType<typeof chooseSafeWorkspaceFolder>>;
    try {
      result = await chooseSafeWorkspaceFolder();
    } finally {
      setSelecting(false);
    }

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
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex min-w-0 items-center gap-8">
        <div
          className="min-h-32 min-w-0 flex-1 truncate rounded-inputs border border-transparent px-12 py-8 text-ui-sm font-medium leading-ui-sm text-cinder"
          aria-label="已选择文件夹"
        >
          {displayPath || '未选择文件夹'}
        </div>
        <Button
          ref={buttonRef}
          type="button"
          variant="secondary"
          size="compact"
          disabled={disabled || selecting}
          onClick={handleChooseFolder}
        >
          {selecting ? '选择中' : '浏览'}
        </Button>
      </div>
      {error ? <WorkspaceErrorBanner>{error}</WorkspaceErrorBanner> : null}
    </div>
  );
}
