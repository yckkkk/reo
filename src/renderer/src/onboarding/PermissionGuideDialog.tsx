import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import {
  appPermissionActionAriaLabel,
  appPermissionFocusLabel,
  appPermissionRows,
  appPermissionTrailingLabel,
  PermissionChecklistRow,
  permissionActionButtonClassName,
  PermissionStatusBadge,
  type AppPermissionRowId,
} from '../app-permissions/PermissionChecklistRow';
import type { AppPermissionStatusSnapshot } from '../workspace/workspaceApi';
import type { OnboardingStartupTarget, PermissionGuideItemId } from './onboardingState';

export type PermissionGuideDialogProps = {
  readonly open: boolean;
  readonly pendingPermissionRequest?: AppPermissionRowId | null;
  readonly permissions: AppPermissionStatusSnapshot | null;
  readonly startupTarget: OnboardingStartupTarget;
  readonly voiceSettingsConfigured: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onOpenVoiceSettings: () => void;
  readonly onRequestPermission: (permission: AppPermissionRowId) => void | Promise<void>;
  readonly onSkip: () => void;
};

function guideDescription(startupTarget: OnboardingStartupTarget) {
  if (
    startupTarget.kind === 'permission-guide' &&
    startupTarget.reason === 'permission-restart-required' &&
    startupTarget.focusItem !== undefined &&
    startupTarget.focusItem !== 'voice'
  ) {
    return `重启后继续完成${appPermissionFocusLabel(startupTarget.focusItem)}权限`;
  }
  if (
    startupTarget.kind === 'permission-guide' &&
    startupTarget.reason === 'action-required' &&
    startupTarget.focusItem !== undefined &&
    startupTarget.focusItem !== 'voice'
  ) {
    return `${appPermissionFocusLabel(startupTarget.focusItem)}权限需要在这里完成。`;
  }

  return '先完成 Reo 的录音、摄像头、辅助功能权限与基础语音设置。';
}

function rowIsFocused(startupTarget: OnboardingStartupTarget, id: PermissionGuideItemId) {
  return startupTarget.kind === 'permission-guide' && startupTarget.focusItem === id;
}

export function PermissionGuideDialog({
  open,
  pendingPermissionRequest = null,
  permissions,
  startupTarget,
  voiceSettingsConfigured,
  onOpenChange,
  onOpenVoiceSettings,
  onRequestPermission,
  onSkip,
}: PermissionGuideDialogProps) {
  return (
    <Dialog open={open} {...(onOpenChange ? { onOpenChange } : {})}>
      <DialogContent className="sm:w-[min(680px,calc(100vw-(var(--spacing-40)*2)))]">
        <DialogHeader>
          <DialogTitle>设置 Reo 权限</DialogTitle>
          <DialogDescription>{guideDescription(startupTarget)}</DialogDescription>
        </DialogHeader>

        <FieldGroup aria-label="Reo 权限与设置" className="mt-24 gap-8">
          {appPermissionRows.map((row) => {
            const status = permissions?.[row.id]?.status ?? null;
            const isActionable = status !== null && status !== 'granted';
            const focused = rowIsFocused(startupTarget, row.id);
            const permissionActionDisabled = pendingPermissionRequest !== null;

            return (
              <PermissionChecklistRow
                key={row.id}
                detail={row.detail}
                focused={focused}
                granted={status === 'granted'}
                icon={row.icon}
                label={row.label}
                testId={`permission-guide-row-${row.id}`}
                trailing={
                  isActionable ? (
                    <Button
                      type="button"
                      size="compact"
                      variant="default"
                      aria-label={appPermissionActionAriaLabel(row.id, status)}
                      className={permissionActionButtonClassName}
                      disabled={permissionActionDisabled}
                      onClick={() => {
                        onRequestPermission(row.id);
                      }}
                    >
                      {appPermissionTrailingLabel(row.id, status)}
                    </Button>
                  ) : (
                    <PermissionStatusBadge status={status === 'granted' ? 'granted' : 'loading'}>
                      {appPermissionTrailingLabel(row.id, status)}
                    </PermissionStatusBadge>
                  )
                }
              />
            );
          })}

          <PermissionChecklistRow
            detail="Reo 仅在您启用时使用语音识别与朗读。"
            focused={rowIsFocused(startupTarget, 'voice')}
            granted={voiceSettingsConfigured}
            icon={KeyRound}
            label="设置语音服务"
            testId="permission-guide-row-voice"
            trailing={
              voiceSettingsConfigured ? (
                <PermissionStatusBadge status="voice-ready">已设置</PermissionStatusBadge>
              ) : (
                <Button
                  type="button"
                  size="compact"
                  variant="default"
                  aria-label="设置语音服务"
                  className={permissionActionButtonClassName}
                  onClick={onOpenVoiceSettings}
                >
                  设置语音服务
                </Button>
              )
            }
          />
        </FieldGroup>

        <div className="mt-24 flex justify-end">
          <Button type="button" variant="secondary" onClick={onSkip}>
            稍后
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
