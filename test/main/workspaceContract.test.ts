import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_CHOOSE_DIRECTORY_CHANNEL,
  WORKSPACE_CREATE_MEMORY_CHANNEL,
  WORKSPACE_DELETE_MEMORY_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_DELETE_SEGMENT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_APPEND_SEGMENT_SUPPLEMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
  WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
  WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_DISCARD_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
  WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
  WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
  WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
  WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_READ_MEMORY_DETAIL_CHANNEL,
  WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL,
  WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_SUPPLEMENT_CHANNEL,
  WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL,
  WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL,
  WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
  WORKSPACE_RENDERER_EVENT_CHANNELS,
  WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_SUPPLEMENT_TITLE_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL,
  WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL,
  WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL,
  WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
  workspaceCreateMemoryRequestSchema,
  workspaceCreateMemoryResponseSchema,
  workspaceDeleteMemoryRequestSchema,
  workspaceDeleteMemoryResponseSchema,
  workspaceDeleteSegmentSupplementRequestSchema,
  workspaceDeleteSegmentSupplementResponseSchema,
  workspaceDeleteSegmentRequestSchema,
  workspaceDeleteSegmentResponseSchema,
  workspaceReadMemoryDetailRequestSchema,
  workspaceReadMemoryDetailResponseSchema,
  workspaceReadWorkspaceSnapshotRequestSchema,
  workspaceReadWorkspaceSnapshotResponseSchema,
  workspaceRestoreDeletedMemoryRequestSchema,
  workspaceRestoreDeletedMemoryResponseSchema,
  workspaceRestoreDeletedSegmentSupplementRequestSchema,
  workspaceRestoreDeletedSegmentSupplementResponseSchema,
  workspaceRestoreDeletedSegmentRequestSchema,
  workspaceRestoreDeletedSegmentResponseSchema,
  workspaceReadFinalizedAudioSegmentRequestSchema,
  workspaceReadFinalizedAudioSegmentResponseSchema,
  workspaceReadFinalizedAudioSegmentSupplementRequestSchema,
  workspaceReadFinalizedAudioSegmentSupplementResponseSchema,
  workspaceCreateRecordingDraftResponseSchema,
  workspaceCreateSegmentSupplementRecordingDraftRequestSchema,
  workspaceCreateSegmentSupplementRecordingDraftResponseSchema,
  workspaceAppendSegmentSupplementRecordingAudioRequestSchema,
  workspaceFinalizeSegmentSupplementRecordingDraftRequestSchema,
  workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema,
  workspaceSegmentSupplementIdRequestSchema,
  workspaceCloseRequestSchema,
  workspaceCloseResponseSchema,
  workspaceClearMicrophoneIntentResponseSchema,
  workspaceInitializeRequestSchema,
  workspaceInitializeResponseSchema,
  workspaceListMemorySpacesResponseSchema,
  workspaceMicrophoneIntentResponseSchema,
  workspaceRecordingTranscriptionAudioRequestSchema,
  workspaceRecordingTranscriptionCloseRequestSchema,
  workspaceRecordingTranscriptionControlResponseSchema,
  workspaceRecordingTranscriptionEventSchema,
  workspaceRecordingTranscriptionStartRequestSchema,
  workspaceUpdateMemoryTitleRequestSchema,
  workspaceUpdateMemoryTitleResponseSchema,
  workspaceUpdateSegmentSupplementTitleRequestSchema,
  workspaceUpdateSegmentSupplementTitleResponseSchema,
  workspaceUpdateSegmentTitleRequestSchema,
  workspaceUpdateSegmentTitleResponseSchema,
  workspaceUpdateMemorySpaceTitleRequestSchema,
  workspaceUpdateMemorySpaceTitleResponseSchema,
  workspaceRevealMemorySpaceInFinderRequestSchema,
  workspaceRevealMemoryInFinderRequestSchema,
  workspaceRevealSegmentInFinderRequestSchema,
  workspaceRevealSegmentSupplementInFinderRequestSchema,
  workspaceOpenMemorySpaceAgentsFileRequestSchema,
  workspaceOpenMemoryDocumentRequestSchema,
  workspaceOpenSegmentDocumentRequestSchema,
  workspaceOpenSegmentSupplementDocumentRequestSchema,
  workspaceCopyMemorySpaceAbsolutePathRequestSchema,
  workspaceCopyMemoryAbsolutePathRequestSchema,
  workspaceCopySegmentAbsolutePathRequestSchema,
  workspaceCopySegmentSupplementAbsolutePathRequestSchema,
  workspaceCopyMemoryRelativePathRequestSchema,
  workspaceCopySegmentRelativePathRequestSchema,
  workspaceCopySegmentSupplementRelativePathRequestSchema,
  workspaceEntityActionResponseSchema,
  workspaceOpenRequestSchema,
  workspaceOpenMemorySpaceRequestSchema,
  workspaceRemoveMemorySpaceResponseSchema,
  workspaceRemoveMemorySpaceRequestSchema,
  workspaceRecordingAppendRequestSchema,
  workspaceRecordingDraftPrefixCloneRequestSchema,
  workspaceRecordingDraftPrefixCloneResponseSchema,
  workspaceRecordingDraftAudioResponseSchema,
  workspaceRecordingDraftAudioRequestSchema,
  workspaceRecordingFinalizeRequestSchema,
  workspaceRecordingMarkdownSaveRequestSchema,
  workspaceSegmentSupplementMarkdownSaveRequestSchema,
  workspaceSegmentSupplementMarkdownSaveResponseSchema,
  workspaceRecordingReadRequestSchema,
  workspaceChooseDirectoryResponseSchema,
  workspaceChooseDirectoryResultSchema,
  workspaceClearVoiceTranscriptionApiKeyRequestSchema,
  workspaceClearVoiceTranscriptionApiKeyResponseSchema,
  workspaceErrorCodeSchema,
  workspaceErrorEnvelopeSchema,
  workspaceNoInputSchema,
  workspaceMemorySummarySchema,
  workspaceOpenVoiceTranscriptionProviderConsoleRequestSchema,
  workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema,
  workspaceReadVoiceTranscriptionSettingsRequestSchema,
  workspaceReadVoiceTranscriptionSettingsResponseSchema,
  workspaceSaveVoiceTranscriptionApiKeyRequestSchema,
  workspaceSaveVoiceTranscriptionApiKeyResponseSchema,
  workspaceSetVoiceTranscriptionEnabledRequestSchema,
  workspaceSetVoiceTranscriptionEnabledResponseSchema,
  workspaceSnapshotSchema,
  workspaceValidateVoiceTranscriptionCredentialsRequestSchema,
  workspaceValidateVoiceTranscriptionCredentialsResponseSchema,
  voiceTranscriptionSettingsSnapshotSchema,
  type VoiceTranscriptionSettingsSnapshot,
  type WorkspaceClearVoiceTranscriptionApiKeyRequest,
  type WorkspaceClearVoiceTranscriptionApiKeyResponse,
  type WorkspaceOpenVoiceTranscriptionProviderConsoleRequest,
  type WorkspaceOpenVoiceTranscriptionProviderConsoleResponse,
  type WorkspaceReadVoiceTranscriptionSettingsRequest,
  type WorkspaceReadVoiceTranscriptionSettingsResponse,
  type WorkspaceSaveVoiceTranscriptionApiKeyRequest,
  type WorkspaceSaveVoiceTranscriptionApiKeyResponse,
  type WorkspaceSetVoiceTranscriptionEnabledRequest,
  type WorkspaceSetVoiceTranscriptionEnabledResponse,
  type WorkspaceValidateVoiceTranscriptionCredentialsRequest,
  type WorkspaceValidateVoiceTranscriptionCredentialsResponse,
  type WorkspaceRevealMemorySpaceInFinderRequest,
  type WorkspaceRevealMemoryInFinderRequest,
  type WorkspaceRevealSegmentInFinderRequest,
  type WorkspaceRevealSegmentSupplementInFinderRequest,
  type WorkspaceOpenMemorySpaceAgentsFileRequest,
  type WorkspaceOpenMemoryDocumentRequest,
  type WorkspaceOpenSegmentDocumentRequest,
  type WorkspaceOpenSegmentSupplementDocumentRequest,
  type WorkspaceCopyMemorySpaceAbsolutePathRequest,
  type WorkspaceCopyMemoryAbsolutePathRequest,
  type WorkspaceCopySegmentAbsolutePathRequest,
  type WorkspaceCopySegmentSupplementAbsolutePathRequest,
  type WorkspaceCopyMemoryRelativePathRequest,
  type WorkspaceCopySegmentRelativePathRequest,
  type WorkspaceCopySegmentSupplementRelativePathRequest,
  type WorkspaceEntityActionResponse,
} from '../../src/workspace-contract/workspace-contract.js';

type WorkspaceEntityActionRequest =
  | WorkspaceRevealMemorySpaceInFinderRequest
  | WorkspaceRevealMemoryInFinderRequest
  | WorkspaceRevealSegmentInFinderRequest
  | WorkspaceRevealSegmentSupplementInFinderRequest
  | WorkspaceOpenMemorySpaceAgentsFileRequest
  | WorkspaceOpenMemoryDocumentRequest
  | WorkspaceOpenSegmentDocumentRequest
  | WorkspaceOpenSegmentSupplementDocumentRequest
  | WorkspaceCopyMemorySpaceAbsolutePathRequest
  | WorkspaceCopyMemoryAbsolutePathRequest
  | WorkspaceCopySegmentAbsolutePathRequest
  | WorkspaceCopySegmentSupplementAbsolutePathRequest
  | WorkspaceCopyMemoryRelativePathRequest
  | WorkspaceCopySegmentRelativePathRequest
  | WorkspaceCopySegmentSupplementRelativePathRequest;

function assertWorkspaceEntityActionRequest(_request: WorkspaceEntityActionRequest): void {
  void _request;
}

function assertWorkspaceEntityActionResponse(_response: WorkspaceEntityActionResponse): void {
  void _response;
}

function assertVoiceSettingsSnapshot(_snapshot: VoiceTranscriptionSettingsSnapshot): void {
  void _snapshot;
}

function assertVoiceSettingsContracts(
  _contracts: readonly [
    WorkspaceReadVoiceTranscriptionSettingsRequest,
    WorkspaceReadVoiceTranscriptionSettingsResponse,
    WorkspaceSetVoiceTranscriptionEnabledRequest,
    WorkspaceSetVoiceTranscriptionEnabledResponse,
    WorkspaceSaveVoiceTranscriptionApiKeyRequest,
    WorkspaceSaveVoiceTranscriptionApiKeyResponse,
    WorkspaceClearVoiceTranscriptionApiKeyRequest,
    WorkspaceClearVoiceTranscriptionApiKeyResponse,
    WorkspaceValidateVoiceTranscriptionCredentialsRequest,
    WorkspaceValidateVoiceTranscriptionCredentialsResponse,
    WorkspaceOpenVoiceTranscriptionProviderConsoleRequest,
    WorkspaceOpenVoiceTranscriptionProviderConsoleResponse,
  ]
): void {
  void _contracts;
}

test('workspace contract exposes only the explicit chooseDirectory channel', () => {
  assert.equal(WORKSPACE_CHOOSE_DIRECTORY_CHANNEL, 'workspace:chooseDirectory');
  assert.deepEqual(WORKSPACE_IPC_CHANNELS, [
    'workspace:chooseDirectory',
    'workspace:listMemorySpaces',
    'workspace:initialize',
    'workspace:open',
    'workspace:openMemorySpace',
    'workspace:removeMemorySpace',
    'workspace:updateMemorySpaceTitle',
    'workspace:close',
    'workspace:readWorkspaceSnapshot',
    'workspace:createMemory',
    'workspace:deleteMemory',
    'workspace:restoreDeletedMemory',
    'workspace:deleteSegment',
    'workspace:restoreDeletedSegment',
    'workspace:deleteSegmentSupplement',
    'workspace:restoreDeletedSegmentSupplement',
    'workspace:readMemoryDetail',
    'workspace:readFinalizedAudioSegment',
    'workspace:readFinalizedAudioSegmentSupplement',
    'workspace:createRecordingDraft',
    'workspace:createSegmentSupplementRecordingDraft',
    'workspace:readRecordingDraftAudio',
    'workspace:appendRecordingAudioChunk',
    'workspace:appendSegmentSupplementRecordingAudioChunk',
    'workspace:cloneRecordingDraftPrefix',
    'workspace:finalizeRecordingDraft',
    'workspace:finalizeSegmentSupplementRecordingDraft',
    'workspace:discardRecordingDraft',
    'workspace:discardSegmentSupplementRecordingDraft',
    'workspace:updateMemoryTitle',
    'workspace:updateSegmentTitle',
    'workspace:updateSegmentSupplementTitle',
    'workspace:saveTranscript',
    'workspace:saveSegmentSupplementTranscript',
    'workspace:beginMicrophoneIntent',
    'workspace:clearMicrophoneIntent',
    'workspace:startRecordingTranscription',
    'workspace:sendRecordingTranscriptionAudio',
    'workspace:finishRecordingTranscription',
    'workspace:closeRecordingTranscription',
    'workspace:readVoiceTranscriptionSettings',
    'workspace:setVoiceTranscriptionEnabled',
    'workspace:saveVoiceTranscriptionApiKey',
    'workspace:clearVoiceTranscriptionApiKey',
    'workspace:validateVoiceTranscriptionCredentials',
    'workspace:openVoiceTranscriptionProviderConsole',
    'workspace:revealMemorySpaceInFinder',
    'workspace:revealMemoryInFinder',
    'workspace:revealSegmentInFinder',
    'workspace:revealSegmentSupplementInFinder',
    'workspace:openMemorySpaceAgentsFile',
    'workspace:openMemoryDocument',
    'workspace:openSegmentDocument',
    'workspace:openSegmentSupplementDocument',
    'workspace:copyMemorySpaceAbsolutePath',
    'workspace:copyMemoryAbsolutePath',
    'workspace:copySegmentAbsolutePath',
    'workspace:copySegmentSupplementAbsolutePath',
    'workspace:copyMemoryRelativePath',
    'workspace:copySegmentRelativePath',
    'workspace:copySegmentSupplementRelativePath',
  ]);
  assert.ok(WORKSPACE_IPC_CHANNELS.every((channel) => !channel.includes('*')));
  assert.deepEqual(WORKSPACE_RENDERER_EVENT_CHANNELS, ['workspace:recordingTranscriptionEvent']);
  assert.equal(
    WORKSPACE_RECORDING_TRANSCRIPTION_EVENT_CHANNEL,
    'workspace:recordingTranscriptionEvent'
  );
  assert.equal(WORKSPACE_CREATE_MEMORY_CHANNEL, 'workspace:createMemory');
  assert.equal(WORKSPACE_DELETE_MEMORY_CHANNEL, 'workspace:deleteMemory');
  assert.equal(WORKSPACE_RESTORE_DELETED_MEMORY_CHANNEL, 'workspace:restoreDeletedMemory');
  assert.equal(WORKSPACE_DELETE_SEGMENT_CHANNEL, 'workspace:deleteSegment');
  assert.equal(WORKSPACE_RESTORE_DELETED_SEGMENT_CHANNEL, 'workspace:restoreDeletedSegment');
  assert.equal(WORKSPACE_DELETE_SEGMENT_SUPPLEMENT_CHANNEL, 'workspace:deleteSegmentSupplement');
  assert.equal(
    WORKSPACE_RESTORE_DELETED_SEGMENT_SUPPLEMENT_CHANNEL,
    'workspace:restoreDeletedSegmentSupplement'
  );
  assert.equal(WORKSPACE_READ_WORKSPACE_SNAPSHOT_CHANNEL, 'workspace:readWorkspaceSnapshot');
  assert.equal(WORKSPACE_READ_MEMORY_DETAIL_CHANNEL, 'workspace:readMemoryDetail');
  assert.equal(
    WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_CHANNEL,
    'workspace:readFinalizedAudioSegment'
  );
  assert.equal(
    WORKSPACE_READ_FINALIZED_AUDIO_SEGMENT_SUPPLEMENT_CHANNEL,
    'workspace:readFinalizedAudioSegmentSupplement'
  );
  assert.equal(WORKSPACE_READ_RECORDING_DRAFT_AUDIO_CHANNEL, 'workspace:readRecordingDraftAudio');
  assert.equal(
    WORKSPACE_CLONE_RECORDING_DRAFT_PREFIX_CHANNEL,
    'workspace:cloneRecordingDraftPrefix'
  );
  assert.equal(WORKSPACE_UPDATE_MEMORY_TITLE_CHANNEL, 'workspace:updateMemoryTitle');
  assert.equal(WORKSPACE_UPDATE_SEGMENT_TITLE_CHANNEL, 'workspace:updateSegmentTitle');
  assert.equal(
    WORKSPACE_UPDATE_SEGMENT_SUPPLEMENT_TITLE_CHANNEL,
    'workspace:updateSegmentSupplementTitle'
  );
  assert.equal(WORKSPACE_UPDATE_MEMORY_SPACE_TITLE_CHANNEL, 'workspace:updateMemorySpaceTitle');
  assert.equal(
    WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    'workspace:createSegmentSupplementRecordingDraft'
  );
  assert.equal(
    WORKSPACE_APPEND_SEGMENT_SUPPLEMENT_RECORDING_AUDIO_CHUNK_CHANNEL,
    'workspace:appendSegmentSupplementRecordingAudioChunk'
  );
  assert.equal(
    WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    'workspace:finalizeSegmentSupplementRecordingDraft'
  );
  assert.equal(
    WORKSPACE_DISCARD_SEGMENT_SUPPLEMENT_RECORDING_DRAFT_CHANNEL,
    'workspace:discardSegmentSupplementRecordingDraft'
  );
  assert.equal(
    WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_TRANSCRIPT_CHANNEL,
    'workspace:saveSegmentSupplementTranscript'
  );
  assert.equal(
    WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
    'workspace:readVoiceTranscriptionSettings'
  );
  assert.equal(
    WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
    'workspace:setVoiceTranscriptionEnabled'
  );
  assert.equal(
    WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
    'workspace:saveVoiceTranscriptionApiKey'
  );
  assert.equal(
    WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
    'workspace:clearVoiceTranscriptionApiKey'
  );
  assert.equal(
    WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
    'workspace:validateVoiceTranscriptionCredentials'
  );
  assert.equal(
    WORKSPACE_OPEN_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_CHANNEL,
    'workspace:openVoiceTranscriptionProviderConsole'
  );
});

test('workspace IPC channels include application-scoped voice settings channels', () => {
  const voiceSettingsChannels = [
    'workspace:readVoiceTranscriptionSettings',
    'workspace:setVoiceTranscriptionEnabled',
    'workspace:saveVoiceTranscriptionApiKey',
    'workspace:clearVoiceTranscriptionApiKey',
    'workspace:validateVoiceTranscriptionCredentials',
    'workspace:openVoiceTranscriptionProviderConsole',
  ];

  assert.equal(voiceSettingsChannels.length, 6);

  for (const channel of voiceSettingsChannels) {
    assert.equal((WORKSPACE_IPC_CHANNELS as readonly string[]).includes(channel), true);
  }
});

test('workspace error code schema accepts voice settings and provider console errors', () => {
  const voiceSettingsErrorCodes = [
    'ERR_VOICE_SETTINGS_STORAGE_UNAVAILABLE',
    'ERR_VOICE_SETTINGS_WRITE_FAILED',
    'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED',
    'ERR_VOICE_TRANSCRIPTION_PROVIDER_CONSOLE_REJECTED',
  ];

  assert.equal(voiceSettingsErrorCodes.length, 4);

  for (const code of voiceSettingsErrorCodes) {
    assert.equal(workspaceErrorCodeSchema.safeParse(code).success, true);
  }
});

test('voice transcription settings contract exposes redacted snapshot and strict schemas', () => {
  const snapshot = voiceTranscriptionSettingsSnapshotSchema.parse({
    enabled: true,
    apiKeyConfigured: true,
    apiKeyLastFour: '1234',
    lastValidatedAt: '2026-05-16T13:05:00.000Z',
    lastValidationOk: false,
    lastValidationCode: 'auth',
  });

  assertVoiceSettingsSnapshot(snapshot);
  assert.deepEqual(snapshot, {
    enabled: true,
    apiKeyConfigured: true,
    apiKeyLastFour: '1234',
    lastValidatedAt: '2026-05-16T13:05:00.000Z',
    lastValidationOk: false,
    lastValidationCode: 'auth',
  });
  assert.equal('apiKey' in snapshot, false);
  assert.equal('apiKeyCiphertext' in snapshot, false);

  assert.deepEqual(
    voiceTranscriptionSettingsSnapshotSchema.parse({
      enabled: false,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    }),
    {
      enabled: false,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    }
  );

  assert.throws(() =>
    voiceTranscriptionSettingsSnapshotSchema.parse({
      ...snapshot,
      apiKeyLastFour: '12345',
    })
  );
  assert.throws(() =>
    voiceTranscriptionSettingsSnapshotSchema.parse({
      ...snapshot,
      lastValidationCode: 'timeout',
    })
  );
  assert.throws(() =>
    voiceTranscriptionSettingsSnapshotSchema.parse({
      ...snapshot,
      apiKey: 'full-secret-key',
    })
  );
});

test('voice transcription settings IPC schemas use undefined for no-payload requests', () => {
  const readRequest = workspaceReadVoiceTranscriptionSettingsRequestSchema.parse(undefined);
  const clearRequest = workspaceClearVoiceTranscriptionApiKeyRequestSchema.parse(undefined);
  const validateRequest =
    workspaceValidateVoiceTranscriptionCredentialsRequestSchema.parse(undefined);

  assert.equal(readRequest, undefined);
  assert.equal(clearRequest, undefined);
  assert.equal(validateRequest, undefined);
  assert.throws(() => workspaceReadVoiceTranscriptionSettingsRequestSchema.parse({}));
  assert.throws(() => workspaceClearVoiceTranscriptionApiKeyRequestSchema.parse({}));
  assert.throws(() => workspaceValidateVoiceTranscriptionCredentialsRequestSchema.parse({}));
});

test('voice transcription settings IPC schemas validate payloads and redacted responses', () => {
  const settings = {
    enabled: true,
    apiKeyConfigured: true,
    apiKeyLastFour: '1234',
    lastValidatedAt: '2026-05-16T13:05:00.000Z',
    lastValidationOk: true,
    lastValidationCode: 'ok',
  };

  const readRequest = workspaceReadVoiceTranscriptionSettingsRequestSchema.parse(undefined);
  const readResponse = workspaceReadVoiceTranscriptionSettingsResponseSchema.parse({
    ok: true,
    value: { settings },
  });
  const setEnabledRequest = workspaceSetVoiceTranscriptionEnabledRequestSchema.parse({
    enabled: false,
  });
  const setEnabledResponse = workspaceSetVoiceTranscriptionEnabledResponseSchema.parse({
    ok: true,
    value: { settings: { ...settings, enabled: false } },
  });
  const saveApiKeyRequest = workspaceSaveVoiceTranscriptionApiKeyRequestSchema.parse({
    apiKey: 'abcd1234',
  });
  const saveApiKeyResponse = workspaceSaveVoiceTranscriptionApiKeyResponseSchema.parse({
    ok: true,
    value: { settings },
  });
  const clearResponse = workspaceClearVoiceTranscriptionApiKeyResponseSchema.parse({
    ok: true,
    value: {
      settings: {
        enabled: true,
        apiKeyConfigured: false,
        apiKeyLastFour: null,
        lastValidatedAt: null,
        lastValidationOk: null,
        lastValidationCode: null,
      },
    },
  });
  const clearRequest = workspaceClearVoiceTranscriptionApiKeyRequestSchema.parse(undefined);
  const validateRequest =
    workspaceValidateVoiceTranscriptionCredentialsRequestSchema.parse(undefined);
  const validateResponse = workspaceValidateVoiceTranscriptionCredentialsResponseSchema.parse({
    ok: true,
    value: { code: 'network', message: 'Network unavailable' },
  });
  const openVoiceConsoleRequest =
    workspaceOpenVoiceTranscriptionProviderConsoleRequestSchema.parse(undefined);
  const openVoiceConsoleResponse =
    workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema.parse({
      ok: true,
      value: {},
    });

  assertVoiceSettingsContracts([
    readRequest,
    readResponse,
    setEnabledRequest,
    setEnabledResponse,
    saveApiKeyRequest,
    saveApiKeyResponse,
    clearRequest,
    clearResponse,
    validateRequest,
    validateResponse,
    openVoiceConsoleRequest,
    openVoiceConsoleResponse,
  ]);

  assert.deepEqual(saveApiKeyRequest, { apiKey: 'abcd1234' });
  assert.equal(readResponse.ok, true);
  assert.equal(saveApiKeyResponse.ok, true);
  if (readResponse.ok) {
    assert.equal('apiKey' in readResponse.value.settings, false);
  }
  if (saveApiKeyResponse.ok) {
    assert.equal('apiKey' in saveApiKeyResponse.value.settings, false);
  }
  assert.throws(() => workspaceSaveVoiceTranscriptionApiKeyRequestSchema.parse({ apiKey: 'abc' }));
  assert.throws(() =>
    workspaceSaveVoiceTranscriptionApiKeyRequestSchema.parse({ apiKey: 'a'.repeat(1025) })
  );
  assert.throws(() =>
    workspaceReadVoiceTranscriptionSettingsResponseSchema.parse({
      ok: true,
      value: { settings, apiKey: 'full-secret-key' },
    })
  );
  assert.throws(() =>
    workspaceValidateVoiceTranscriptionCredentialsResponseSchema.parse({
      ok: true,
      value: { code: 'ok', apiKey: 'full-secret-key' },
    })
  );
  assert.throws(() =>
    workspaceOpenVoiceTranscriptionProviderConsoleResponseSchema.parse({
      ok: true,
      value: { apiKey: 'full-secret-key' },
    })
  );
});

test('workspace error code schema accepts entity actions menu error codes', () => {
  const entityActionErrorCodes = [
    'ERR_WORKSPACE_MEMORY_NOT_FOUND',
    'ERR_WORKSPACE_SEGMENT_NOT_FOUND',
    'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND',
    'ERR_MEMORY_SPACE_AGENTS_FILE_MISSING',
    'ERR_ENTITY_DOCUMENT_MISSING',
    'ERR_SHELL_OPEN_FAILED',
    'ERR_CLIPBOARD_WRITE_FAILED',
  ];

  assert.equal(entityActionErrorCodes.length, 7);

  for (const code of entityActionErrorCodes) {
    assert.equal(workspaceErrorCodeSchema.safeParse(code).success, true);
  }
});

test('workspace IPC channels include entity actions menu shell channels', () => {
  const entityActionChannels = [
    'workspace:revealMemorySpaceInFinder',
    'workspace:revealMemoryInFinder',
    'workspace:revealSegmentInFinder',
    'workspace:revealSegmentSupplementInFinder',
    'workspace:openMemorySpaceAgentsFile',
    'workspace:openMemoryDocument',
    'workspace:openSegmentDocument',
    'workspace:openSegmentSupplementDocument',
    'workspace:copyMemorySpaceAbsolutePath',
    'workspace:copyMemoryAbsolutePath',
    'workspace:copySegmentAbsolutePath',
    'workspace:copySegmentSupplementAbsolutePath',
    'workspace:copyMemoryRelativePath',
    'workspace:copySegmentRelativePath',
    'workspace:copySegmentSupplementRelativePath',
  ];

  assert.equal(entityActionChannels.length, 15);

  for (const channel of entityActionChannels) {
    assert.equal((WORKSPACE_IPC_CHANNELS as readonly string[]).includes(channel), true);
  }
});

test('workspace entity action schemas accept memory-space identity only', () => {
  const request = { workspaceId: 'ws_1' };

  assert.deepEqual(workspaceRevealMemorySpaceInFinderRequestSchema.parse(request), request);
  assert.deepEqual(workspaceOpenMemorySpaceAgentsFileRequestSchema.parse(request), request);
  assert.deepEqual(workspaceCopyMemorySpaceAbsolutePathRequestSchema.parse(request), request);

  assertWorkspaceEntityActionRequest(
    workspaceRevealMemorySpaceInFinderRequestSchema.parse(request)
  );
  assertWorkspaceEntityActionRequest(
    workspaceOpenMemorySpaceAgentsFileRequestSchema.parse(request)
  );
  assertWorkspaceEntityActionRequest(
    workspaceCopyMemorySpaceAbsolutePathRequestSchema.parse(request)
  );
  assert.throws(() =>
    workspaceRevealMemorySpaceInFinderRequestSchema.parse({
      ...request,
      rootPath: '/Users/example/Memory Space',
    })
  );
});

test('workspace entity action schemas require memory identity', () => {
  const request = {
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
  };

  assert.deepEqual(workspaceRevealMemoryInFinderRequestSchema.parse(request), request);
  assert.deepEqual(workspaceOpenMemoryDocumentRequestSchema.parse(request), request);
  assert.deepEqual(workspaceCopyMemoryAbsolutePathRequestSchema.parse(request), request);
  assert.deepEqual(workspaceCopyMemoryRelativePathRequestSchema.parse(request), request);

  assertWorkspaceEntityActionRequest(workspaceRevealMemoryInFinderRequestSchema.parse(request));
  assertWorkspaceEntityActionRequest(workspaceOpenMemoryDocumentRequestSchema.parse(request));
  assertWorkspaceEntityActionRequest(workspaceCopyMemoryAbsolutePathRequestSchema.parse(request));
  assertWorkspaceEntityActionRequest(workspaceCopyMemoryRelativePathRequestSchema.parse(request));
  assert.throws(() =>
    workspaceRevealMemoryInFinderRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
    })
  );
});

test('workspace entity action schemas require segment identity chain', () => {
  const request = {
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
  };

  assert.deepEqual(workspaceRevealSegmentInFinderRequestSchema.parse(request), request);
  assert.deepEqual(workspaceOpenSegmentDocumentRequestSchema.parse(request), request);
  assert.deepEqual(workspaceCopySegmentAbsolutePathRequestSchema.parse(request), request);
  assert.deepEqual(workspaceCopySegmentRelativePathRequestSchema.parse(request), request);

  assertWorkspaceEntityActionRequest(workspaceRevealSegmentInFinderRequestSchema.parse(request));
  assertWorkspaceEntityActionRequest(workspaceOpenSegmentDocumentRequestSchema.parse(request));
  assertWorkspaceEntityActionRequest(workspaceCopySegmentAbsolutePathRequestSchema.parse(request));
  assertWorkspaceEntityActionRequest(workspaceCopySegmentRelativePathRequestSchema.parse(request));
  assert.throws(() =>
    workspaceRevealSegmentInFinderRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
    })
  );
});

test('workspace entity action schemas require supplement identity chain', () => {
  const request = {
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
  };

  assert.deepEqual(workspaceRevealSegmentSupplementInFinderRequestSchema.parse(request), request);
  assert.deepEqual(workspaceOpenSegmentSupplementDocumentRequestSchema.parse(request), request);
  assert.deepEqual(workspaceCopySegmentSupplementAbsolutePathRequestSchema.parse(request), request);
  assert.deepEqual(workspaceCopySegmentSupplementRelativePathRequestSchema.parse(request), request);

  assertWorkspaceEntityActionRequest(
    workspaceRevealSegmentSupplementInFinderRequestSchema.parse(request)
  );
  assertWorkspaceEntityActionRequest(
    workspaceOpenSegmentSupplementDocumentRequestSchema.parse(request)
  );
  assertWorkspaceEntityActionRequest(
    workspaceCopySegmentSupplementAbsolutePathRequestSchema.parse(request)
  );
  assertWorkspaceEntityActionRequest(
    workspaceCopySegmentSupplementRelativePathRequestSchema.parse(request)
  );
  assert.throws(() =>
    workspaceRevealSegmentSupplementInFinderRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    })
  );
});

test('workspace entity action response schema returns only ok or error envelope', () => {
  const ok = workspaceEntityActionResponseSchema.parse({ ok: true });
  assert.deepEqual(ok, { ok: true });
  assertWorkspaceEntityActionResponse(ok);

  const error = workspaceEntityActionResponseSchema.parse({
    ok: false,
    error: { code: 'ERR_WORKSPACE_ROOT_MISSING', message: 'x' },
  });
  assert.deepEqual(error, {
    ok: false,
    error: { code: 'ERR_WORKSPACE_ROOT_MISSING', message: 'x' },
  });
  assertWorkspaceEntityActionResponse(error);

  assert.throws(() =>
    workspaceEntityActionResponseSchema.parse({
      ok: true,
      value: { rootPath: '/Users/example/Memory Space' },
    })
  );
  assert.throws(() =>
    workspaceEntityActionResponseSchema.parse({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_ROOT_MISSING',
        message: 'x',
        dataRetention: 'none-written',
      },
    })
  );
});

test('segment supplement title update contract renames the file-space node without raw paths', () => {
  assert.deepEqual(
    workspaceUpdateSegmentSupplementTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      title: '现场补充',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      title: '现场补充',
    }
  );

  const response = workspaceUpdateSegmentSupplementTitleResponseSchema.parse({
    ok: true,
    value: {
      memory: {
        memoryId: 'mem_1',
        title: 'Memory',
        createdAt: '2026-05-10T13:00:00.000Z',
        updatedAt: '2026-05-10T13:00:00.000Z',
        segmentCount: 1,
        durationMs: 1500,
        audioByteLength: 7,
        hasTranscript: false,
        supplementCount: 1,
      },
      segment: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        type: 'audio',
        title: 'Segment',
        createdAt: '2026-05-10T13:00:00.000Z',
        updatedAt: '2026-05-10T13:00:00.000Z',
        durationMs: 1000,
        audioByteLength: 3,
        transcript: { exists: false },
        supplementCount: 1,
        supplements: [
          {
            workspaceId: 'ws_1',
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            supplementId: 'sup_1',
            type: 'audio',
            title: '现场补充',
            createdAt: '2026-05-10T13:01:00.000Z',
            updatedAt: '2026-05-10T13:01:00.000Z',
            durationMs: 500,
            audioByteLength: 4,
            transcript: { exists: false },
          },
        ],
      },
      supplement: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        type: 'audio',
        title: '现场补充',
        createdAt: '2026-05-10T13:01:00.000Z',
        updatedAt: '2026-05-10T13:01:00.000Z',
        durationMs: 500,
        audioByteLength: 4,
        transcript: { exists: false },
      },
    },
  });

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal('rootPath' in response.value, false);
    assert.equal('workspaceHandle' in response.value, false);
    assert.equal('rootPath' in response.value.supplement, false);
  }
});

test('workspace snapshot read contract refreshes file truth without exposing raw paths', () => {
  assert.deepEqual(
    workspaceReadWorkspaceSnapshotRequestSchema.parse({
      workspaceHandle: 'wh_1',
    }),
    {
      workspaceHandle: 'wh_1',
    }
  );
  const response = workspaceReadWorkspaceSnapshotResponseSchema.parse({
    ok: true,
    value: {
      workspaceId: 'ws_1',
      title: '外部更新空间',
      description: '由 Codex 更新',
      memories: [
        {
          memoryId: 'mem_1',
          title: '外部更新记忆',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          segmentCount: 1,
          durationMs: 1000,
          audioByteLength: 3,
          hasTranscript: true,
          supplementCount: 0,
        },
      ],
    },
  });

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal('rootPath' in response.value, false);
    assert.equal('workspaceHandle' in response.value, false);
  }
});

test('memory dangerous operation contract keeps delete and restore path explicit', () => {
  assert.deepEqual(
    workspaceDeleteMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
    }),
    {
      workspaceHandle: 'wh_1',
      memoryId: 'mem_1',
    }
  );
  assert.deepEqual(
    workspaceDeleteMemoryResponseSchema.parse({
      ok: true,
      value: {
        memoryId: 'mem_1',
        restoreToken: 'mem_1',
        memories: [],
      },
    }),
    {
      ok: true,
      value: {
        memoryId: 'mem_1',
        restoreToken: 'mem_1',
        memories: [],
      },
    }
  );
  assert.deepEqual(
    workspaceRestoreDeletedMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      restoreToken: 'mem_1',
    }),
    {
      workspaceHandle: 'wh_1',
      restoreToken: 'mem_1',
    }
  );
  const restored = workspaceRestoreDeletedMemoryResponseSchema.parse({
    ok: true,
    value: {
      memory: {
        memoryId: 'mem_1',
        title: 'Memory',
        createdAt: '2026-05-10T13:00:00.000Z',
        updatedAt: '2026-05-10T13:00:00.000Z',
        segmentCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        supplementCount: 0,
      },
      memories: [
        {
          memoryId: 'mem_1',
          title: 'Memory',
          createdAt: '2026-05-10T13:00:00.000Z',
          updatedAt: '2026-05-10T13:00:00.000Z',
          segmentCount: 0,
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
          supplementCount: 0,
        },
      ],
    },
  });
  assert.equal(restored.ok, true);
});

test('segment dangerous operation contract keeps parent identity and restore token explicit', () => {
  assert.deepEqual(
    workspaceDeleteSegmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    }
  );
  assert.deepEqual(
    workspaceDeleteSegmentResponseSchema.parse({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: 'Memory',
          createdAt: '2026-05-10T13:00:00.000Z',
          updatedAt: '2026-05-10T13:00:00.000Z',
          segmentCount: 0,
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
          supplementCount: 0,
        },
        segmentId: 'seg_1',
        restoreToken: 'seg_1',
      },
    }),
    {
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_1',
          title: 'Memory',
          createdAt: '2026-05-10T13:00:00.000Z',
          updatedAt: '2026-05-10T13:00:00.000Z',
          segmentCount: 0,
          durationMs: 0,
          audioByteLength: 0,
          hasTranscript: false,
          supplementCount: 0,
        },
        segmentId: 'seg_1',
        restoreToken: 'seg_1',
      },
    }
  );
  assert.deepEqual(
    workspaceRestoreDeletedSegmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      restoreToken: 'seg_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      restoreToken: 'seg_1',
    }
  );
  const restored = workspaceRestoreDeletedSegmentResponseSchema.parse({
    ok: true,
    value: {
      memory: {
        memoryId: 'mem_1',
        title: 'Memory',
        createdAt: '2026-05-10T13:00:00.000Z',
        updatedAt: '2026-05-10T13:00:00.000Z',
        segmentCount: 1,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: false,
        supplementCount: 0,
      },
      segment: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        type: 'audio',
        title: 'Segment',
        createdAt: '2026-05-10T13:13:00.000Z',
        updatedAt: '2026-05-10T13:14:00.000Z',
        durationMs: 1000,
        audioByteLength: 3,
        transcript: { exists: false },
        supplementCount: 0,
        supplements: [],
      },
    },
  });
  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal('rootPath' in restored.value, false);
    assert.equal('workspaceHandle' in restored.value, false);
  }
});

test('segment supplement dangerous operation contract keeps parent identity and restore token explicit', () => {
  assert.deepEqual(
    workspaceDeleteSegmentSupplementRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
    }
  );

  const memory = {
    memoryId: 'mem_1',
    title: 'Memory',
    createdAt: '2026-05-10T13:00:00.000Z',
    updatedAt: '2026-05-10T13:00:00.000Z',
    segmentCount: 1,
    durationMs: 1000,
    audioByteLength: 3,
    hasTranscript: false,
    supplementCount: 0,
  };
  const supplement = {
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    type: 'audio',
    title: '现场补充',
    createdAt: '2026-05-10T13:15:00.000Z',
    updatedAt: '2026-05-10T13:16:00.000Z',
    durationMs: 1000,
    audioByteLength: 3,
    transcript: { exists: true },
  };
  const segment = {
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    type: 'audio',
    title: 'Segment',
    createdAt: '2026-05-10T13:13:00.000Z',
    updatedAt: '2026-05-10T13:14:00.000Z',
    durationMs: 1000,
    audioByteLength: 3,
    transcript: { exists: false },
    supplementCount: 0,
    supplements: [],
  };

  assert.deepEqual(
    workspaceDeleteSegmentSupplementResponseSchema.parse({
      ok: true,
      value: {
        memory,
        segment,
        supplementId: 'sup_1',
        restoreToken: 'sup_1',
      },
    }),
    {
      ok: true,
      value: {
        memory,
        segment,
        supplementId: 'sup_1',
        restoreToken: 'sup_1',
      },
    }
  );

  assert.deepEqual(
    workspaceRestoreDeletedSegmentSupplementRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      restoreToken: 'sup_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      restoreToken: 'sup_1',
    }
  );

  const restored = workspaceRestoreDeletedSegmentSupplementResponseSchema.parse({
    ok: true,
    value: {
      memory: { ...memory, supplementCount: 1 },
      segment: {
        ...segment,
        supplementCount: 1,
        supplements: [supplement],
      },
      supplement,
    },
  });
  assert.equal(restored.ok, true);
  if (restored.ok) {
    assert.equal('rootPath' in restored.value, false);
    assert.equal('workspaceHandle' in restored.value, false);
  }

  const parentMissing = workspaceErrorEnvelopeSchema.parse({
    ok: false,
    error: {
      code: 'ERR_SEGMENT_SUPPLEMENT_RESTORE_PARENT_MISSING',
      message: 'Parent Memory or Segment no longer exists.',
      dataRetention: 'previous-file-preserved',
    },
  });
  assert.equal(parentMissing.ok, false);
});

test('segment supplement recording contract keeps parent identity explicit', () => {
  assert.deepEqual(
    workspaceCreateSegmentSupplementRecordingDraftRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
    }
  );
  assert.deepEqual(
    workspaceCreateSegmentSupplementRecordingDraftResponseSchema.parse({
      ok: true,
      value: {
        supplementId: 'sup_1',
        nextSequence: 0,
      },
    }),
    {
      ok: true,
      value: {
        supplementId: 'sup_1',
        nextSequence: 0,
      },
    }
  );
  assert.deepEqual(
    workspaceAppendSegmentSupplementRecordingAudioRequestSchema.parse({
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    }),
    {
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
      sequence: 0,
      chunk: new Uint8Array([1]),
    }
  );
  const response = workspaceFinalizeSegmentSupplementRecordingDraftResponseSchema.parse({
    ok: true,
    value: {
      memory: {
        memoryId: 'mem_1',
        title: 'Memory',
        createdAt: '2026-05-10T13:13:00.000Z',
        updatedAt: '2026-05-10T13:14:00.000Z',
        segmentCount: 1,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: false,
        supplementCount: 1,
      },
      segment: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        type: 'audio',
        title: 'Segment',
        createdAt: '2026-05-10T13:13:00.000Z',
        updatedAt: '2026-05-10T13:14:00.000Z',
        durationMs: 1000,
        audioByteLength: 3,
        transcript: { exists: false },
        supplementCount: 1,
        supplements: [
          {
            workspaceId: 'ws_1',
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            supplementId: 'sup_1',
            type: 'audio',
            title: 'Supplement',
            createdAt: '2026-05-10T13:14:00.000Z',
            updatedAt: '2026-05-10T13:15:00.000Z',
            durationMs: 500,
            audioByteLength: 2,
            transcript: { exists: false },
          },
        ],
      },
      supplement: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        type: 'audio',
        title: 'Supplement',
        createdAt: '2026-05-10T13:14:00.000Z',
        updatedAt: '2026-05-10T13:15:00.000Z',
        durationMs: 500,
        audioByteLength: 2,
        transcript: { exists: false },
      },
    },
  });
  assert.equal(response.ok, true);
  assert.deepEqual(
    workspaceFinalizeSegmentSupplementRecordingDraftRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      title: 'Supplement',
      durationMs: 500,
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      title: 'Supplement',
      durationMs: 500,
    }
  );
  assert.deepEqual(
    workspaceSegmentSupplementIdRequestSchema.parse({
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
    }),
    {
      workspaceHandle: 'wh_1',
      supplementId: 'sup_1',
    }
  );
  assert.deepEqual(
    workspaceReadFinalizedAudioSegmentSupplementRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      requestId: 'request_sup_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      requestId: 'request_sup_1',
    }
  );
  assert.deepEqual(
    workspaceReadFinalizedAudioSegmentSupplementResponseSchema.parse({
      ok: true,
      value: {
        requestId: 'request_sup_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        audio: new Uint8Array([4, 5]),
        audioByteLength: 2,
        transcript: { exists: true, text: '补充录音转写正文' },
      },
    }),
    {
      ok: true,
      value: {
        requestId: 'request_sup_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        audio: new Uint8Array([4, 5]),
        audioByteLength: 2,
        transcript: { exists: true, text: '补充录音转写正文' },
      },
    }
  );
});

test('workspace memory detail contract keeps handle out of response data', () => {
  assert.deepEqual(
    workspaceReadMemoryDetailRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      requestId: 'request_mem_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      requestId: 'request_mem_1',
    }
  );

  const response = workspaceReadMemoryDetailResponseSchema.parse({
    ok: true,
    value: {
      requestId: 'request_mem_1',
      detail: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        title: '产品灵感与思考',
        createdAt: '2026-05-08T14:42:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 1,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: true,
        supplementCount: 0,
        segments: [
          {
            workspaceId: 'ws_1',
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            type: 'audio',
            title: '第一段录音',
            createdAt: '2026-05-08T14:42:00.000Z',
            updatedAt: '2026-05-08T14:43:00.000Z',
            durationMs: 1000,
            audioByteLength: 3,
            transcript: { exists: true },
            supplementCount: 0,
            supplements: [],
          },
        ],
      },
    },
  });

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal('workspaceHandle' in response.value.detail, false);
    assert.equal('rootPath' in response.value.detail, false);
    const [segment] = response.value.detail.segments;
    assert.ok(segment);
    assert.equal('workspaceHandle' in segment, false);
  }
});

test('workspace memory space registry contract exposes memory space metadata but never rootPath', () => {
  const response = workspaceListMemorySpacesResponseSchema.parse({
    ok: true,
    value: {
      memorySpaces: [
        {
          workspaceId: 'ws_1',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          addedAt: '2026-05-08T07:48:00.000Z',
          lastOpenedAt: '2026-05-08T07:49:00.000Z',
        },
      ],
    },
  });

  assert.deepEqual(response, {
    ok: true,
    value: {
      memorySpaces: [
        {
          workspaceId: 'ws_1',
          title: 'Runtime validated memory',
          description: 'Final runtime validation workspace.',
          addedAt: '2026-05-08T07:48:00.000Z',
          lastOpenedAt: '2026-05-08T07:49:00.000Z',
        },
      ],
    },
  });

  assert.deepEqual(workspaceOpenMemorySpaceRequestSchema.parse({ workspaceId: 'ws_1' }), {
    workspaceId: 'ws_1',
  });
  assert.deepEqual(workspaceRemoveMemorySpaceRequestSchema.parse({ workspaceId: 'ws_1' }), {
    workspaceId: 'ws_1',
  });
  assert.throws(() =>
    workspaceListMemorySpacesResponseSchema.parse({
      ok: true,
      value: {
        memorySpaces: [
          {
            workspaceId: 'ws_1',
            title: 'Runtime validated memory',
            description: 'Final runtime validation workspace.',
            rootPath: '/Users/example/Runtime validated memory',
            addedAt: '2026-05-08T07:48:00.000Z',
            lastOpenedAt: '2026-05-08T07:49:00.000Z',
          },
        ],
      },
    })
  );
  assert.throws(() =>
    workspaceOpenMemorySpaceRequestSchema.parse({
      workspaceId: 'ws_1',
      rootPath: '/Users/example/Runtime validated memory',
    })
  );
  assert.throws(() =>
    workspaceRemoveMemorySpaceRequestSchema.parse({
      workspaceId: 'ws_1',
      rootPath: '/Users/example/Runtime validated memory',
    })
  );
});

test('initializeWorkspace contract returns opaque handle, workspaceId, snapshot, and no rootPath', () => {
  assert.deepEqual(
    workspaceInitializeRequestSchema.parse({
      selectionToken: 'selection-token-1',
      title: '新的 workspace',
      description: '',
    }),
    {
      selectionToken: 'selection-token-1',
      title: '新的 workspace',
      description: '',
    }
  );

  assert.deepEqual(
    workspaceInitializeResponseSchema.parse({
      ok: true,
      value: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: '新的 workspace',
          description: '',
          memories: [],
        },
      },
    }),
    {
      ok: true,
      value: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        snapshot: {
          workspaceId: 'ws_1',
          title: '新的 workspace',
          description: '',
          memories: [],
        },
      },
    }
  );
  assert.throws(() =>
    workspaceInitializeResponseSchema.parse({
      ok: true,
      value: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        rootPath: '/Users/example/Voice Notes',
        snapshot: {
          workspaceId: 'ws_1',
          title: '新的 workspace',
          description: '',
          memories: [],
        },
      },
    })
  );
});

test('workspace snapshot contract rejects top-level segments projection', () => {
  assert.throws(() =>
    workspaceSnapshotSchema.parse({
      workspaceId: 'ws_1',
      title: '新的 workspace',
      description: '',
      memories: [],
      segments: [],
    })
  );
});

test('workspace memory summary contract rejects unknown nested fields', () => {
  assert.deepEqual(
    workspaceMemorySummarySchema.parse({
      memoryId: 'mem_1',
      title: '产品灵感',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 2048,
      hasTranscript: false,
      supplementCount: 0,
    }),
    {
      memoryId: 'mem_1',
      title: '产品灵感',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 2048,
      hasTranscript: false,
      supplementCount: 0,
    }
  );
  assert.throws(() =>
    workspaceMemorySummarySchema.parse({
      memoryId: 'mem_1',
      title: '产品灵感',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 2048,
      hasTranscript: false,
      supplementCount: 0,
      staleRecordingProjection: ['seg_old'],
    })
  );
  assert.throws(() =>
    workspaceMemorySummarySchema.parse({
      memoryId: 'recording_1',
      title: '产品灵感',
      createdAt: '2026-05-08T14:42:00.000Z',
      updatedAt: '2026-05-08T14:42:00.000Z',
      segmentCount: 1,
      durationMs: 1000,
      audioByteLength: 2048,
      hasTranscript: false,
      supplementCount: 0,
    })
  );
});

test('createRecordingDraft response contract exposes a flat draft identity payload', () => {
  assert.deepEqual(
    workspaceCreateRecordingDraftResponseSchema.parse({
      ok: true,
      value: {
        segmentId: 'seg_20260508_000001',
        nextSequence: 0,
      },
    }),
    {
      ok: true,
      value: {
        segmentId: 'seg_20260508_000001',
        nextSequence: 0,
      },
    }
  );
  assert.throws(() =>
    workspaceCreateRecordingDraftResponseSchema.parse({
      ok: true,
      value: {
        ok: true,
        segmentId: 'seg_20260508_000001',
        nextSequence: 0,
      },
    })
  );
});

test('initializeWorkspace contract rejects unsafe workspace folder names and reports same-name folders', () => {
  assert.throws(() =>
    workspaceInitializeRequestSchema.parse({
      selectionToken: 'selection-token-1',
      title: 'nested/workspace',
      description: '',
    })
  );
  assert.deepEqual(
    workspaceErrorEnvelopeSchema.parse({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_ALREADY_EXISTS',
        message: 'Workspace directory already exists',
        dataRetention: 'none-written',
      },
    }),
    {
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_ALREADY_EXISTS',
        message: 'Workspace directory already exists',
        dataRetention: 'none-written',
      },
    }
  );
});

test('open and close contracts use token or handle but never rootPath', () => {
  assert.deepEqual(workspaceOpenRequestSchema.parse({ selectionToken: 'selection-token-1' }), {
    selectionToken: 'selection-token-1',
  });
  assert.throws(() =>
    workspaceOpenRequestSchema.parse({
      selectionToken: 'selection-token-1',
      rootPath: '/Users/example/Voice Notes',
    })
  );

  assert.deepEqual(workspaceCloseRequestSchema.parse({ workspaceHandle: 'wh_1' }), {
    workspaceHandle: 'wh_1',
  });
  assert.deepEqual(workspaceCloseResponseSchema.parse({ ok: true, value: { closed: true } }), {
    ok: true,
    value: { closed: true },
  });
  assert.throws(() => workspaceCloseResponseSchema.parse({ ok: true, value: { removed: true } }));
  assert.deepEqual(
    workspaceRemoveMemorySpaceResponseSchema.parse({ ok: true, value: { removed: true } }),
    {
      ok: true,
      value: { removed: true },
    }
  );
  assert.deepEqual(
    workspaceClearMicrophoneIntentResponseSchema.parse({ ok: true, value: { cleared: true } }),
    {
      ok: true,
      value: { cleared: true },
    }
  );
});

test('recording append contract caps chunks at 1 MiB and requires opaque workspace handle', () => {
  const chunk = new Uint8Array(1_048_576);
  assert.deepEqual(
    workspaceRecordingAppendRequestSchema.parse({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      sequence: 0,
      chunk,
    }),
    {
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      sequence: 0,
      chunk,
    }
  );
  assert.throws(() =>
    workspaceRecordingAppendRequestSchema.parse({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      sequence: 0,
      chunk: new Uint8Array(1_048_577),
    })
  );
});

test('recording draft prefix clone contract keeps replacement copy explicit and bounded', () => {
  assert.deepEqual(
    workspaceRecordingDraftPrefixCloneRequestSchema.parse({
      workspaceHandle: 'workspace-handle-secret',
      sourceSegmentId: 'seg_source',
      targetSegmentId: 'seg_target',
      retainedByteLength: 2048,
      nextSequence: 0,
    }),
    {
      workspaceHandle: 'workspace-handle-secret',
      sourceSegmentId: 'seg_source',
      targetSegmentId: 'seg_target',
      retainedByteLength: 2048,
      nextSequence: 0,
    }
  );
  assert.throws(() =>
    workspaceRecordingDraftPrefixCloneRequestSchema.parse({
      workspaceHandle: 'workspace-handle-secret',
      sourceSegmentId: 'seg_same',
      targetSegmentId: 'seg_same',
      retainedByteLength: 2048,
      nextSequence: 0,
    })
  );
  assert.deepEqual(
    workspaceRecordingDraftPrefixCloneResponseSchema.parse({
      ok: true,
      value: { audioByteLength: 2048, nextSequence: 1 },
    }),
    {
      ok: true,
      value: { audioByteLength: 2048, nextSequence: 1 },
    }
  );
});

test('draft audio read response returns only current draft bytes and append cursor', () => {
  assert.deepEqual(
    workspaceRecordingDraftAudioRequestSchema.parse({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      maxBytes: 4096,
    }),
    {
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      maxBytes: 4096,
    }
  );
  assert.throws(() =>
    workspaceRecordingDraftAudioRequestSchema.parse({
      workspaceHandle: 'wh_1',
      segmentId: 'seg_20260506_000001',
      maxBytes: 64 * 1024 * 1024 + 1,
    })
  );

  const audio = new Uint8Array([1, 2, 3]);
  assert.deepEqual(
    workspaceRecordingDraftAudioResponseSchema.parse({
      ok: true,
      value: {
        audio,
        audioByteLength: 3,
        nextSequence: 2,
      },
    }),
    {
      ok: true,
      value: {
        audio,
        audioByteLength: 3,
        nextSequence: 2,
      },
    }
  );
  assert.throws(() =>
    workspaceRecordingDraftAudioResponseSchema.parse({
      ok: true,
      value: {
        audio: [1, 2, 3],
        audioByteLength: 3,
        nextSequence: 2,
      },
    })
  );
});

test('recording finalize contract requires explicit durable duration', () => {
  assert.deepEqual(
    workspaceRecordingFinalizeRequestSchema.parse({
      durationMs: 2000,
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    }),
    {
      durationMs: 2000,
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    }
  );
  assert.throws(() =>
    workspaceRecordingFinalizeRequestSchema.parse({
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    })
  );
  assert.throws(() =>
    workspaceRecordingFinalizeRequestSchema.parse({
      durationMs: 2000,
      segmentId: 'seg_20260506_000001',
      title: '录音',
      workspaceHandle: 'wh_1',
    })
  );
});

test('finalized audio segment transcript save contract requires memory id plus segment id', () => {
  assert.deepEqual(
    workspaceRecordingReadRequestSchema.parse({
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      workspaceHandle: 'wh_1',
    }),
    {
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      workspaceHandle: 'wh_1',
    }
  );
  assert.throws(() =>
    workspaceRecordingReadRequestSchema.parse({
      segmentId: 'seg_20260506_000001',
      workspaceHandle: 'wh_1',
    })
  );
  assert.throws(() =>
    workspaceRecordingMarkdownSaveRequestSchema.parse({
      markdown: 'note',
      segmentId: 'seg_20260506_000001',
      workspaceHandle: 'wh_1',
    })
  );
});

test('finalized audio segment read contract requires memory and segment identity', () => {
  assert.deepEqual(
    workspaceReadFinalizedAudioSegmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      requestId: 'request_1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      requestId: 'request_1',
    }
  );
  const response = workspaceReadFinalizedAudioSegmentResponseSchema.parse({
    ok: true,
    value: {
      requestId: 'request_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      transcript: { exists: true, text: '正文' },
    },
  });
  assert.equal(response.ok, true);
  if (response.ok) {
    assert.deepEqual(response.value, {
      requestId: 'request_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      transcript: { exists: true, text: '正文' },
    });
  }
  assert.throws(() =>
    workspaceReadFinalizedAudioSegmentRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      segmentId: 'seg_20260506_000001',
      requestId: 'request_1',
    })
  );
});

test('memory title update contract is scoped to a memory container and strips raw paths', () => {
  assert.deepEqual(
    workspaceUpdateMemoryTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '产品灵感与思考',
    }),
    {
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '产品灵感与思考',
    }
  );
  assert.throws(() =>
    workspaceUpdateMemoryTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '',
    })
  );
  assert.throws(() =>
    workspaceUpdateMemoryTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '产品灵感与思考',
      segmentId: 'seg_20260506_000001',
    })
  );

  assert.throws(() =>
    workspaceUpdateMemoryTitleResponseSchema.parse({
      ok: true,
      value: {
        memoryId: 'mem_20260506_000001',
        title: '产品灵感与思考',
        createdAt: '2026-05-06T13:08:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 5,
        durationMs: 1000,
        audioByteLength: 3,
        hasTranscript: true,
        supplementCount: 0,
        rootPath: '/Users/example/Reo',
        segmentIds: ['seg_20260506_000001'],
      },
    })
  );
});

test('segment title update contract returns memory and segment projections without raw paths', () => {
  assert.deepEqual(
    workspaceUpdateSegmentTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音1',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音1',
    }
  );
  assert.throws(() =>
    workspaceUpdateSegmentTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '录音1',
    })
  );
  assert.throws(() =>
    workspaceUpdateSegmentTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_20260506_000001',
      segmentId: 'seg_20260506_000001',
      title: '',
    })
  );

  assert.throws(() =>
    workspaceUpdateSegmentTitleResponseSchema.parse({
      ok: true,
      value: {
        memory: {
          memoryId: 'mem_20260506_000001',
          title: '产品灵感与思考',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          segmentCount: 1,
          durationMs: 1000,
          audioByteLength: 3,
          hasTranscript: true,
          supplementCount: 0,
        },
        segment: {
          workspaceId: 'ws_1',
          memoryId: 'mem_20260506_000001',
          segmentId: 'seg_20260506_000001',
          type: 'audio',
          title: '录音1',
          createdAt: '2026-05-06T13:08:00.000Z',
          updatedAt: '2026-05-08T14:42:00.000Z',
          durationMs: 1000,
          audioByteLength: 3,
          transcript: { exists: true },
          supplementCount: 0,
          supplements: [],
          rootPath: '/Users/example/Reo',
        },
      },
    })
  );
});

test('memory space title update contract accepts either active handle or registry workspace id', () => {
  assert.deepEqual(
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      workspaceHandle: 'wh_1',
      title: '测试工作区1',
    }),
    {
      workspaceHandle: 'wh_1',
      title: '测试工作区1',
    }
  );
  assert.deepEqual(
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      workspaceId: 'ws_1',
      title: '测试工作区1',
    }),
    {
      workspaceId: 'ws_1',
      title: '测试工作区1',
    }
  );
  assert.throws(() =>
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      title: '测试工作区1',
    })
  );
  assert.throws(() =>
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      workspaceId: 'ws_1',
      workspaceHandle: 'wh_1',
      title: '测试工作区1',
    })
  );
  assert.throws(() =>
    workspaceUpdateMemorySpaceTitleRequestSchema.parse({
      workspaceId: 'ws_1',
      title: '',
    })
  );
  for (const unsafeTitle of ['.', '..', 'bad/name', 'bad\\name', 'bad\0name']) {
    assert.throws(() =>
      workspaceUpdateMemorySpaceTitleRequestSchema.parse({
        workspaceId: 'ws_1',
        title: unsafeTitle,
      })
    );
  }
  assert.deepEqual(
    workspaceUpdateMemorySpaceTitleResponseSchema.parse({
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: '测试工作区1',
        description: 'Private notes',
        memories: [],
      },
    }),
    {
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: '测试工作区1',
        description: 'Private notes',
        memories: [],
      },
    }
  );
  assert.throws(() =>
    workspaceUpdateMemorySpaceTitleResponseSchema.parse({
      ok: true,
      value: {
        workspaceId: 'ws_1',
        title: '测试工作区1',
        description: 'Private notes',
        memories: [],
        rootPath: '/Users/example/Workspace',
      },
    })
  );
});

test('memory create contract creates a named Memory container without raw path authority', () => {
  assert.deepEqual(
    workspaceCreateMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      title: '产品灵感与思考',
    }),
    {
      workspaceHandle: 'wh_1',
      title: '产品灵感与思考',
    }
  );
  assert.throws(() =>
    workspaceCreateMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      title: '',
    })
  );
  assert.throws(() =>
    workspaceCreateMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      title: '产品灵感与思考',
      rootPath: '/Users/example/Reo',
    })
  );
  assert.throws(() =>
    workspaceCreateMemoryRequestSchema.parse({
      workspaceHandle: 'wh_1',
      memoryId: 'mem_20260506_000001',
      title: '产品灵感与思考',
    })
  );

  assert.throws(() =>
    workspaceCreateMemoryResponseSchema.parse({
      ok: true,
      value: {
        memoryId: 'mem_20260506_000001',
        title: '产品灵感与思考',
        createdAt: '2026-05-08T14:42:00.000Z',
        updatedAt: '2026-05-08T14:42:00.000Z',
        segmentCount: 0,
        durationMs: 0,
        audioByteLength: 0,
        hasTranscript: false,
        supplementCount: 0,
        rootPath: '/Users/example/Reo',
        segmentIds: [],
      },
    })
  );
});

test('microphone intent response exposes no token-like authority', () => {
  assert.throws(() =>
    workspaceMicrophoneIntentResponseSchema.parse({
      ok: true,
      value: {
        registered: true,
        microphoneIntentId: 'mic_1',
        expiresAt: 16_000,
      },
    })
  );
});

test('finalized audio segment supplement transcript save contract requires parent identity', () => {
  assert.deepEqual(
    workspaceSegmentSupplementMarkdownSaveRequestSchema.parse({
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      markdown: '补充录音转写',
    }),
    {
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
      memoryId: 'mem_1',
      segmentId: 'seg_1',
      supplementId: 'sup_1',
      markdown: '补充录音转写',
    }
  );

  const response = workspaceSegmentSupplementMarkdownSaveResponseSchema.parse({
    ok: true,
    value: {
      saved: true,
      memory: {
        memoryId: 'mem_1',
        title: 'Memory',
        createdAt: '2026-05-10T13:00:00.000Z',
        updatedAt: '2026-05-10T13:00:00.000Z',
        segmentCount: 1,
        durationMs: 1500,
        audioByteLength: 7,
        hasTranscript: false,
        supplementCount: 1,
      },
      segment: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        type: 'audio',
        title: '录音',
        createdAt: '2026-05-10T13:00:00.000Z',
        updatedAt: '2026-05-10T13:00:00.000Z',
        durationMs: 1500,
        audioByteLength: 7,
        transcript: { exists: false },
        supplementCount: 1,
        supplements: [
          {
            workspaceId: 'ws_1',
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            supplementId: 'sup_1',
            type: 'audio',
            title: '补充录音',
            createdAt: '2026-05-10T13:01:00.000Z',
            updatedAt: '2026-05-10T13:01:00.000Z',
            durationMs: 500,
            audioByteLength: 3,
            transcript: { exists: true },
          },
        ],
      },
      supplement: {
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        type: 'audio',
        title: '补充录音',
        createdAt: '2026-05-10T13:01:00.000Z',
        updatedAt: '2026-05-10T13:01:00.000Z',
        durationMs: 500,
        audioByteLength: 3,
        transcript: { exists: true },
      },
    },
  });
  assert.equal(response.ok, true);
  assert.equal(response.value.saved, true);
  assert.equal('rootPath' in response.value, false);
  assert.equal('workspaceHandle' in response.value, false);
});

test('recording transcription contract keeps credentials out of renderer payloads', () => {
  const start = workspaceRecordingTranscriptionStartRequestSchema.parse({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    timeOffsetMs: 2000,
    workspaceHandle: 'wh_1',
  });
  assert.deepEqual(start, {
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    timeOffsetMs: 2000,
    workspaceHandle: 'wh_1',
  });
  assert.throws(() =>
    workspaceRecordingTranscriptionStartRequestSchema.parse({
      ...start,
      accessToken: 'secret',
      appId: 'secret',
    })
  );

  const audio = new Uint8Array([1, 2, 3]);
  assert.deepEqual(
    workspaceRecordingTranscriptionAudioRequestSchema.parse({
      chunk: audio,
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    }),
    {
      chunk: audio,
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    }
  );
  assert.throws(() =>
    workspaceRecordingTranscriptionAudioRequestSchema.parse({
      chunk: new Uint8Array(65_537),
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    })
  );

  assert.deepEqual(
    workspaceRecordingTranscriptionCloseRequestSchema.parse({
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    }),
    {
      recordingFlowSessionId: 'recording-1',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      workspaceHandle: 'wh_1',
    }
  );
  assert.deepEqual(
    workspaceRecordingTranscriptionControlResponseSchema.parse({
      ok: true,
      value: { accepted: true },
    }),
    { ok: true, value: { accepted: true } }
  );
  assert.deepEqual(
    workspaceRecordingTranscriptionControlResponseSchema.parse({
      ok: true,
      value: { accepted: true, transcriptionMode: 'live' },
    }),
    { ok: true, value: { accepted: true, transcriptionMode: 'live' } }
  );
  assert.deepEqual(
    workspaceRecordingTranscriptionControlResponseSchema.parse({
      ok: true,
      value: { accepted: true, transcriptionMode: 'disabled' },
    }),
    { ok: true, value: { accepted: true, transcriptionMode: 'disabled' } }
  );
  assert.throws(() =>
    workspaceRecordingTranscriptionControlResponseSchema.parse({
      ok: true,
      value: { accepted: true, transcriptionMode: 'batch' },
    })
  );
});

test('recording transcription event contract carries only segment state and safe errors', () => {
  assert.deepEqual(
    workspaceRecordingTranscriptionEventSchema.parse({
      kind: 'segments',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      segments: [
        {
          endTimeMs: 2400,
          isFinal: false,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 1200,
          text: '实时转写',
        },
      ],
    }),
    {
      kind: 'segments',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      segments: [
        {
          endTimeMs: 2400,
          isFinal: false,
          recordingSessionId: 'recording-1',
          revisionId: 'recording-1-revision-0',
          startTimeMs: 1200,
          text: '实时转写',
        },
      ],
    }
  );
  assert.throws(() =>
    workspaceRecordingTranscriptionEventSchema.parse({
      kind: 'segments',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
      rootPath: '/Users/example/Reo',
      segments: [],
    })
  );
  assert.throws(() =>
    workspaceRecordingTranscriptionEventSchema.parse({
      kind: 'error',
      accessToken: 'secret',
      message: 'failed',
      recordingSessionId: 'recording-1',
      revisionId: 'recording-1-revision-0',
    })
  );
});

test('chooseDirectory has no request payload', () => {
  assert.equal(workspaceNoInputSchema.parse(undefined), undefined);
  assert.throws(() => workspaceNoInputSchema.parse({}));
});

test('chooseDirectory result does not expose raw root path or early judgments', () => {
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'selected',
      selectionToken: 'selection-token-1',
      displayPath: 'Voice Notes',
      rootPath: '/Users/example/Voice Notes',
      conflict: true,
      permission: 'granted',
    })
  );
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'selected',
      rootPath: '/Users/example/Voice Notes',
    })
  );
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'conflict',
      displayPath: '/Users/example/Voice Notes',
    })
  );
  assert.throws(() =>
    workspaceChooseDirectoryResultSchema.parse({
      status: 'permissionDenied',
      displayPath: '/Users/example/Voice Notes',
    })
  );
});

test('workspace response envelope rejects unsafe error fields', () => {
  assert.deepEqual(
    workspaceChooseDirectoryResponseSchema.parse({
      ok: true,
      value: { status: 'canceled' },
    }),
    { ok: true, value: { status: 'canceled' } }
  );

  assert.throws(() =>
    workspaceErrorEnvelopeSchema.parse({
      ok: false,
      error: {
        code: 'ERR_WORKSPACE_UNTRUSTED_SENDER',
        message: 'Sender is not trusted',
        rootPath: '/Users/example/Voice Notes',
      },
    })
  );
});
