import { Waveform } from '@/components/ui/waveform';
import type { RecordingState } from '../recordingMachine';

const RECORDING_WAVEFORM_DATA = [
  0.18, 0.32, 0.46, 0.28, 0.72, 0.56, 0.34, 0.62, 0.84, 0.4, 0.24, 0.68, 0.52, 0.3, 0.76, 0.48,
  0.26, 0.58, 0.7, 0.36, 0.2, 0.64, 0.44, 0.82,
] as const;

type RecordingWaveformProps = {
  readonly state: RecordingState;
};

export function RecordingWaveform({ state }: RecordingWaveformProps) {
  return (
    <Waveform
      active={state.status === 'recording'}
      className="rounded-panels border border-chalk bg-card-white px-20 py-16 shadow-subtle"
      data={RECORDING_WAVEFORM_DATA}
      data-vaul-no-drag
    />
  );
}
