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

    const contentResponse = await window.reoWorkspace.readFinalizedAudioSegment({
      workspaceHandle: 'dev-scenario-workspace-handle',
      workspaceId: 'dev-memory-studio-rich',
      memoryId: 'mem_dev_ui_review',
      segmentId: 'seg_dev_interview',
      requestId: 'request_visible_waveform',
    });

    expect(contentResponse.ok).toBe(true);
    if (!contentResponse.ok) {
      return;
    }

    const response = await window.reoWorkspace.readFinalizedAudioSegmentAudio({
      workspaceHandle: 'dev-scenario-workspace-handle',
      workspaceId: 'dev-memory-studio-rich',
      memoryId: 'mem_dev_ui_review',
      segmentId: 'seg_dev_interview',
      requestId: 'request_visible_waveform_audio',
      audioByteLength: contentResponse.value.audioByteLength,
      audioHash: contentResponse.value.audioHash,
    });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }

    expect(maxPcm16Amplitude(response.value.audio)).toBeGreaterThan(0);
  });

  it('can expand the rich dev scenario into many real Segments from the URL parameter', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    window.history.replaceState({}, '', '/?reoScenario=memory-studio-rich&reoSegmentCount=120');

    const scenarioModule = await import('./devWorkspaceScenario');
    expect(scenarioModule.installDevWorkspaceScenarioBridge()).toBe('memory-studio-rich');

    const response = await window.reoWorkspace.readMemoryDetail({
      workspaceHandle: 'dev-scenario-workspace-handle',
      workspaceId: 'dev-memory-studio-rich',
      memoryId: 'mem_dev_ui_review',
      requestId: 'request_many_segments',
    });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }

    expect(response.value.detail.segmentCount).toBe(120);
    expect(response.value.detail.segments).toHaveLength(120);
    expect(response.value.detail.segments[0]?.segmentId).toBe('seg_dev_interview');
    expect(response.value.detail.segments[1]?.segmentId).toBe('seg_dev_note');
    expect(response.value.detail.segments[119]?.segmentId).toBe('seg_dev_note_119');
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
