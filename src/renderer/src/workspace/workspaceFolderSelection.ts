import type { WorkspaceDirectorySelection } from './workspaceApi';
import { chooseWorkspaceDirectory } from './workspaceApi';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

export const workspaceFolderErrorMessage = '请选择记忆空间文件夹';

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
    return {
      status: 'error',
      message: workspaceErrorDisplayMessage(response.error, '无法选择记忆空间文件夹。'),
    };
  }

  if (response.value.status === 'canceled') {
    return { status: 'canceled' };
  }

  if (!isSafeWorkspaceDisplayPath(response.value.displayPath)) {
    return { status: 'error', message: workspaceFolderErrorMessage };
  }

  return { status: 'selected', selection: response.value };
}
