import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('main window teardown releases workspace handles', async () => {
  const source = await readFile('src/main/index.ts', 'utf8');

  assert.match(source, /closeAllWorkspaceHandles/);
  assert.match(source, /bindWorkspaceHandleLifecycle/);
  assert.match(source, /closeWorkspaceHandles:\s*closeWorkspaceRuntime/);
  assert.match(source, /uncaughtException[\s\S]*closeWorkspaceRuntime\(\)/);
});

test('main window uses hidden-inset chrome for the layered app shell', async () => {
  const source = await readFile('src/main/index.ts', 'utf8');

  assert.match(source, /titleBarStyle:\s*'hiddenInset'/);
});

test('main bootstrap wires voice settings store into recording transcription at app ready', async () => {
  const source = await readFile('src/main/index.ts', 'utf8');

  assert.match(source, /safeStorage/);
  assert.match(
    source,
    /let closeWorkspaceRuntime:\s*\(\)\s*=>\s*Promise<void>\s*=\s*closeAllWorkspaceHandles/
  );
  assert.match(source, /createVoiceSettingsStore/);
  assert.match(source, /createRecordingTranscriptionSessionRegistry/);
  assert.match(
    source,
    /whenReady\(\)[\s\S]*createVoiceSettingsStore\(\{[\s\S]*safeStorage[\s\S]*userDataDir:\s*app\.getPath\('userData'\)[\s\S]*registerWorkspaceIpc/
  );
  assert.match(
    source,
    /createRecordingTranscriptionSessionRegistry\(\{[\s\S]*resolveVoiceSettings:\s*\(\)\s*=>[\s\S]*voiceSettingsStore\.read\(\)[\s\S]*voiceSettingsStore\.readDecryptedApiKey\(\)/
  );
  assert.match(
    source,
    /closeWorkspaceRuntime\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*recordingTranscriptionSessions\.closeAll\(\)[\s\S]*closeAllWorkspaceHandles\(\)/
  );
  assert.match(source, /closeWorkspaceHandles:\s*closeWorkspaceRuntime/);
  assert.match(source, /uncaughtException[\s\S]*closeWorkspaceRuntime\(\)/);
  assert.match(source, /registerWorkspaceIpc\(\{[\s\S]*recordingTranscriptionSessions/);
});

test('main bootstrap wires backfill runtime into workspace and app lifecycle', async () => {
  const source = await readFile('src/main/index.ts', 'utf8');

  assert.match(source, /createWorkspaceBackfillQueue/);
  assert.match(source, /createBackfillTriggerWiring/);
  assert.match(source, /scanWorkspaceBackfillTargets/);
  assert.match(source, /voiceSettingsStore\.onSnapshotChange/);
  assert.match(source, /backfillTriggerWiring\.workspaceSwitched\(\)/);
  assert.match(
    source,
    /app\.on\('before-quit'[\s\S]*backfillQueue\.cancelAllAndDrain\('app-quit'\)/
  );
  assert.match(source, /registerWorkspaceIpc\(\{[\s\S]*backfillQueue[\s\S]*backfillTriggerWiring/);
});
