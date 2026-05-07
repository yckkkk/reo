import type { WorkspaceDirectorySelection } from './workspaceApi';
import { chooseWorkspaceDirectory } from './workspaceApi';

export const workspaceFolderErrorMessage = 'Choose a workspace folder';

export function isSafeWorkspaceDisplayPath(displayPath: string) {
  return displayPath.trim().length > 0 && !/[\\/]/.test(displayPath);
}

type SafeWorkspaceFolderSelection =
  | {
      readonly status: 'selected';
      readonly selection: WorkspaceDirectorySelection;
    }
  | {
      readonly status: 'canceled';
    }
  | {
      readonly status: 'error';
      readonly message: string;
    };

export async function chooseSafeWorkspaceFolder(): Promise<SafeWorkspaceFolderSelection> {
  const response = await chooseWorkspaceDirectory();

  if (!response.ok) {
    return { status: 'error', message: response.error.message };
  }

  if (response.value.status === 'canceled') {
    return { status: 'canceled' };
  }

  if (!isSafeWorkspaceDisplayPath(response.value.displayPath)) {
    return { status: 'error', message: workspaceFolderErrorMessage };
  }

  return { status: 'selected', selection: response.value };
}
