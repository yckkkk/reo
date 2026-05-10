import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RecordingRecoveryDraft } from './recordingRecovery';

type RecordingRecoveryDialogProps = {
  readonly canReview?: boolean;
  readonly disabled?: boolean;
  readonly draft: RecordingRecoveryDraft | null;
  readonly onDiscard: () => void;
  readonly onReview: () => void;
  readonly onSave: () => void;
};

export function RecordingRecoveryDialog({
  canReview = true,
  disabled = false,
  draft,
  onDiscard,
  onReview,
  onSave,
}: RecordingRecoveryDialogProps) {
  const finalizedRecordingSaved = Boolean(draft?.finalizedAudio || draft?.finalizedAttachment);
  const saveLabel = draft?.finalizedAttachment
    ? '完成恢复'
    : finalizedRecordingSaved
      ? '重试保存转写'
      : '保存录音';
  return (
    <Dialog open={draft !== null}>
      <DialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{finalizedRecordingSaved ? '录音已保存' : '未完成录音'}</DialogTitle>
          <DialogDescription>
            {finalizedRecordingSaved
              ? '录音音频已保存，转写尚未完成保存。'
              : '检测到一段未完成的录音。'}
          </DialogDescription>
        </DialogHeader>

        <p className="text-ui-sm leading-ui-sm text-gravel">
          {finalizedRecordingSaved
            ? '可以重试保存转写，或只关闭这个恢复提示。'
            : '可以先保存到当前记忆，或放弃这段未完成内容。'}
        </p>

        <div className="flex justify-end gap-8">
          <Button type="button" variant="secondary" disabled={disabled} onClick={onDiscard}>
            {finalizedRecordingSaved ? '关闭提示' : '放弃'}
          </Button>
          {finalizedRecordingSaved || !canReview ? null : (
            <Button type="button" variant="secondary" disabled={disabled} onClick={onReview}>
              继续检查
            </Button>
          )}
          <Button type="button" disabled={disabled} onClick={onSave}>
            {saveLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
