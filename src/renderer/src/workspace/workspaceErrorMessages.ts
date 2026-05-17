import type { WorkspaceErrorCode } from '../../../workspace-contract/workspace-contract';

type WorkspaceErrorLike = {
  readonly code?: string;
  readonly message?: string;
};

const workspaceErrorMessages = {
  ERR_MEMORY_CREATE_FAILED: '无法新建记忆。',
  ERR_MEMORY_NOT_FOUND: '找不到这条记忆。',
  ERR_MEMORY_UPDATE_FAILED: '无法更新这条记忆。',
  ERR_MIC_INTENT_ALREADY_ACTIVE: '麦克风正在被另一个录音流程使用。',
  ERR_RECORDING_APPEND_FAILED: '无法保存录音音频。',
  ERR_RECORDING_APPEND_IN_FLIGHT: '正在保存上一段录音音频。',
  ERR_RECORDING_AUDIO_MISSING: '找不到录音音频。',
  ERR_RECORDING_CHUNK_TOO_LARGE: '录音片段过大。',
  ERR_RECORDING_FINALIZED: '录音已经完成保存。',
  ERR_RECORDING_FINALIZE_FAILED: '无法完成录音保存。',
  ERR_RECORDING_INVALID_ID: '无法创建录音。',
  ERR_RECORDING_INVALID_RANGE: '录音音频读取范围无效。',
  ERR_RECORDING_NOT_FOUND: '找不到这段录音。',
  ERR_RECORDING_SEQUENCE: '录音片段顺序不正确。',
  ERR_BACKFILL_ALREADY_RUNNING: '该录音正在生成中，请稍候。',
  ERR_BACKFILL_API_KEY_MISSING: '请先在设置里保存 X-Api-Key。',
  ERR_BACKFILL_AUDIO_URL_FAILED: '补转录音频准备失败，请稍后重试。',
  ERR_BACKFILL_AUDIO_URL_UNCONFIGURED: '补转录音频交付尚未配置。',
  ERR_BACKFILL_CANCELED: '转录已取消。',
  ERR_BACKFILL_ENGINE_UNKNOWN: '补转录失败，请稍后重试。',
  ERR_BACKFILL_PROVIDER_FAILED: '补转录失败，请稍后重试。',
  ERR_BACKFILL_TARGET_NOT_ELIGIBLE: '这段录音暂时不能生成转录。',
  ERR_BACKFILL_VOICE_DISABLED: '先在设置里启用语音识别。',
  ERR_CLIPBOARD_WRITE_FAILED: '无法复制路径。',
  ERR_ENTITY_DOCUMENT_MISSING: '找不到对应的正文文件。',
  ERR_MEMORY_SPACE_AGENTS_FILE_MISSING: '找不到记忆空间入口文件。',
  ERR_SEGMENT_DELETE_FAILED: '无法删除片段。',
  ERR_SEGMENT_RESTORE_FAILED: '无法恢复片段。',
  ERR_SEGMENT_RESTORE_PARENT_MISSING: '无法恢复片段，所属记忆已不存在。',
  ERR_SHELL_OPEN_FAILED: '无法完成系统操作。',
  ERR_VOICE_SETTINGS_STORAGE_UNAVAILABLE: '当前系统不可安全保存语音识别密钥。',
  ERR_VOICE_SETTINGS_WRITE_FAILED: '语音设置无法写入本地配置。',
  ERR_VOICE_TRANSCRIPTION_PROBE_FAILED: '请先填写或重新保存 X-Api-Key。',
  ERR_WORKSPACE_AGENTS_CONFLICT: '该文件夹已包含 AGENTS.md。请选择空文件夹作为 Reo 记忆空间。',
  ERR_WORKSPACE_ALREADY_EXISTS: '同名记忆空间文件夹已存在。',
  ERR_WORKSPACE_CHOOSE_FAILED: '无法打开文件夹选择器。',
  ERR_WORKSPACE_HANDLE_NOT_FOUND: '当前记忆空间会话已失效。',
  ERR_WORKSPACE_HANDLE_UNTRUSTED: '当前窗口无权访问此记忆空间。',
  ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH: '记忆空间会话不匹配。',
  ERR_WORKSPACE_INDEX_WRITE_FAILED: '记忆空间索引无法更新。',
  ERR_WORKSPACE_INIT_FAILED: '无法创建记忆空间。',
  ERR_WORKSPACE_INVALID_REQUEST: '请求无效。',
  ERR_WORKSPACE_LOCKED: '该记忆空间已在其他窗口打开。',
  ERR_WORKSPACE_LOCK_FAILED: '无法获取记忆空间锁。',
  ERR_WORKSPACE_LOCK_LOST: '记忆空间锁已失效。',
  ERR_WORKSPACE_METADATA_INVALID: '该文件夹不是有效的 Reo 记忆空间。',
  ERR_WORKSPACE_OPEN_FAILED: '无法打开记忆空间。',
  ERR_WORKSPACE_UPDATE_FAILED: '无法更新记忆空间。',
  ERR_WORKSPACE_MEMORY_SPACE_NOT_FOUND: '找不到这个记忆空间。',
  ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_READ_FAILED: '无法读取记忆空间列表。',
  ERR_WORKSPACE_MEMORY_SPACE_REGISTRY_WRITE_FAILED: '无法保存记忆空间列表。',
  ERR_WORKSPACE_MEMORY_NOT_FOUND: '找不到这条记忆。',
  ERR_WORKSPACE_ROOT_MISSING: '记忆空间文件夹已不存在。',
  ERR_WORKSPACE_SEGMENT_NOT_FOUND: '找不到这个片段。',
  ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND: '找不到这个补充内容。',
  ERR_WORKSPACE_SELECTION_EXPIRED: '文件夹选择已过期，请重新选择。',
  ERR_WORKSPACE_SELECTION_NOT_FOUND: '文件夹选择已失效，请重新选择。',
  ERR_WORKSPACE_SELECTION_SENDER_MISMATCH: '文件夹选择来自其他窗口，请重新选择。',
  ERR_WORKSPACE_UNSAFE_PATH: '该文件夹不适合作为记忆空间。',
  ERR_WORKSPACE_UNTRUSTED_SENDER: '当前窗口没有权限执行此操作。',
} satisfies Partial<Record<WorkspaceErrorCode, string>>;

function isMappedWorkspaceErrorCode(code: string): code is keyof typeof workspaceErrorMessages {
  return code in workspaceErrorMessages;
}

function isEnglishMessage(message: string) {
  return /[A-Za-z]/.test(message);
}

export function workspaceErrorDisplayMessage(
  error: WorkspaceErrorLike | null | undefined,
  fallback = '操作失败，请重试。'
): string {
  if (!error) {
    return fallback;
  }

  const mappedMessage =
    error.code && isMappedWorkspaceErrorCode(error.code)
      ? workspaceErrorMessages[error.code]
      : undefined;
  if (mappedMessage) {
    return mappedMessage;
  }

  const message = error.message?.trim();
  if (!message) {
    return fallback;
  }

  return isEnglishMessage(message) ? fallback : message;
}

export function unknownErrorDisplayMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return workspaceErrorDisplayMessage({ message: error.message }, fallback);
  }

  return fallback;
}
