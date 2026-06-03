import type { VoiceTranscriptionSettings } from './workspace/workspaceApi';

export type VoiceSpeechSynthesisSpeaker = VoiceTranscriptionSettings['speechSynthesisSpeaker'];

export const SPEECH_SYNTHESIS_SPEAKER_OPTIONS = [
  { value: 'zh_female_vv_uranus_bigtts', label: 'Vivi' },
  { value: 'zh_female_xiaohe_uranus_bigtts', label: '小荷' },
  { value: 'zh_male_m191_uranus_bigtts', label: '云舟' },
  { value: 'zh_male_shaonianzixin_uranus_bigtts', label: '少年梓辛' },
] as const satisfies readonly {
  readonly label: string;
  readonly value: VoiceSpeechSynthesisSpeaker;
}[];
