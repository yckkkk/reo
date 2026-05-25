import { afterEach, describe, expect, it, vi } from 'vitest';

describe('devWorkspaceScenario', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
    Reflect.deleteProperty(window, 'reoWorkspace');
  });

  it('keeps the rich browser scenario eligible for auto-open after a dev module reload', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    window.history.replaceState({}, '', '/?reoScenario=memory-studio-rich');

    const firstModule = await import('./devWorkspaceScenario');
    expect(firstModule.installDevWorkspaceScenarioBridge()).toBe('memory-studio-rich');

    vi.resetModules();

    const reloadedModule = await import('./devWorkspaceScenario');
    expect(reloadedModule.readAutoOpenDevWorkspaceScenarioName()).toBe('memory-studio-rich');
  });

  it('provides non-silent audio bytes so the rich scenario renders a visible waveform', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    window.history.replaceState({}, '', '/?reoScenario=memory-studio-rich');

    const scenarioModule = await import('./devWorkspaceScenario');
    expect(scenarioModule.installDevWorkspaceScenarioBridge()).toBe('memory-studio-rich');

    const response = await window.reoWorkspace.readFinalizedAudioSegment({
      workspaceHandle: 'dev-scenario-workspace-handle',
      workspaceId: 'dev-memory-studio-rich',
      memoryId: 'mem_dev_ui_review',
      segmentId: 'seg_dev_interview',
      requestId: 'request_visible_waveform',
    });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }

    expect(maxPcm16Amplitude(response.value.audio)).toBeGreaterThan(0);
  });
});

function maxPcm16Amplitude(wavBytes: Uint8Array): number {
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  let maxAmplitude = 0;

  for (let offset = 44; offset + 1 < wavBytes.byteLength; offset += 2) {
    maxAmplitude = Math.max(maxAmplitude, Math.abs(view.getInt16(offset, true)));
  }

  return maxAmplitude;
}
