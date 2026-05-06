export const WORKSPACE_CHOOSE_DIRECTORY_CHANNEL = 'workspace:chooseDirectory' as const;

export const WORKSPACE_IPC_CHANNELS = [WORKSPACE_CHOOSE_DIRECTORY_CHANNEL] as const;

export type WorkspaceIpcChannel = (typeof WORKSPACE_IPC_CHANNELS)[number];
