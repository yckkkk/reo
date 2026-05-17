export type LastTranscriptionAttemptOnFinalize = NonNullable<
  Parameters<
    Window['reoWorkspace']['finalizeRecordingDraft']
  >[0]['lastTranscriptionAttemptOnFinalize']
>;

export function lastTranscriptionAttemptOnFinalize(
  transcriptionEnabled: boolean
): LastTranscriptionAttemptOnFinalize {
  return transcriptionEnabled ? 'failed' : 'never';
}
