import { Camera, Mic, PencilLine, Upload, Video } from 'lucide-react';
import {
  FloatingActionButtonSpeedDial,
  type FloatingActionButtonSpeedDialAction,
} from '@/components/ui/floating-action-button-speed-dial';

type ExpressionDockProps = {
  readonly onStartRecording: () => void;
};

export function ExpressionDock({ onStartRecording }: ExpressionDockProps) {
  const actions: readonly FloatingActionButtonSpeedDialAction[] = [
    {
      disabled: true,
      disabledLabel: '上传暂不可用',
      id: 'upload',
      icon: Upload,
      label: '上传',
    },
    {
      disabled: true,
      disabledLabel: '视频暂不可用',
      id: 'video',
      icon: Video,
      label: '视频',
    },
    {
      disabled: true,
      disabledLabel: '拍照暂不可用',
      id: 'photo',
      icon: Camera,
      label: '拍照',
    },
    {
      disabled: true,
      disabledLabel: '笔记暂不可用',
      id: 'note',
      icon: PencilLine,
      label: '笔记',
    },
    {
      id: 'recording',
      icon: Mic,
      label: '录音',
      onSelect: onStartRecording,
    },
  ];

  return (
    <section aria-label="表达入口" className="pointer-events-none mx-auto w-full">
      <FloatingActionButtonSpeedDial
        actions={actions}
        closeLabel="关闭表达入口"
        id="workspace-floating-action-button-speed-dial"
        menuLabel="表达方式"
        openLabel="打开表达入口"
      />
    </section>
  );
}
