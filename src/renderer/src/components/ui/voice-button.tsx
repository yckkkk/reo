import { Mic2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Waveform } from './waveform';

const VOICE_BUTTON_WAVEFORM_DATA = [0.3, 0.58, 0.42, 0.72, 0.36, 0.62, 0.48, 0.76] as const;

export type VoiceButtonState = 'idle' | 'recording' | 'processing';

type VoiceButtonProps = ComponentProps<typeof Button> & {
  readonly label: ReactNode;
  readonly state?: VoiceButtonState;
};

export function VoiceButton({
  className,
  label,
  state = 'idle',
  variant = 'default',
  ...props
}: VoiceButtonProps) {
  const showWaveform = state === 'recording' || state === 'processing';

  return (
    <Button className={cn('gap-12', className)} type="button" variant={variant} {...props}>
      <Mic2 className="size-16" aria-hidden="true" />
      <span>{label}</span>
      {showWaveform ? (
        <Waveform
          active={state === 'recording'}
          barGap={2}
          barWidth={3}
          className="h-20 max-w-80 gap-2"
          data={VOICE_BUTTON_WAVEFORM_DATA}
          decorative
          height={20}
        />
      ) : null}
    </Button>
  );
}
