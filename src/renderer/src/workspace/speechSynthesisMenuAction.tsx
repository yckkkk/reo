import { Volume2 } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  SPEECH_SYNTHESIS_SPEAKER_OPTIONS,
  type VoiceSpeechSynthesisSpeaker,
} from '../voiceSpeechSynthesisSpeakers';
import type { EntityActionMenuExtraSubmenu } from './entityActionMenu';

export type SpeechSynthesisSpeakerSelect = (speaker: VoiceSpeechSynthesisSpeaker) => void;

export function createSpeechSynthesisExtraAction(
  onSelect: SpeechSynthesisSpeakerSelect,
  disabledReason: string | null | undefined
): EntityActionMenuExtraSubmenu {
  return {
    ...(disabledReason !== undefined ? { disabledReason } : {}),
    icon: Volume2,
    items: SPEECH_SYNTHESIS_SPEAKER_OPTIONS.map((speaker) => ({
      label: speaker.label,
      onSelect: () => onSelect(speaker.value),
    })),
    kind: 'submenu',
    label: '生成/重新生成语音',
  };
}

export function SpeechSynthesisSpeakerSubmenu({
  disabledReason,
  onSelect,
}: {
  readonly disabledReason?: string | null | undefined;
  readonly onSelect: SpeechSynthesisSpeakerSelect;
}) {
  const disabled = disabledReason !== null && disabledReason !== undefined;
  if (disabled) {
    const item = (
      <DropdownMenuItem disabled onSelect={(event) => event.preventDefault()}>
        <Volume2 className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />
        生成/重新生成语音
      </DropdownMenuItem>
    );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{item}</TooltipTrigger>
          <TooltipContent side="right">{disabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Volume2 className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />
        生成/重新生成语音
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {SPEECH_SYNTHESIS_SPEAKER_OPTIONS.map((speaker) => (
          <DropdownMenuItem key={speaker.value} onSelect={() => onSelect(speaker.value)}>
            {speaker.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
