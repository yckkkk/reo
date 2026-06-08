import { Accessibility, Camera, Check, Mic } from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { FieldControl, FieldHint, FieldLabel, FieldRow } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import type { AppPermissionStatusSnapshot } from '../workspace/workspaceApi';
import { APP_PERMISSION_IDS, type AppPermissionRowId } from './appPermissionIds';

export type { AppPermissionRowId } from './appPermissionIds';
export type AppPermissionStatus =
  AppPermissionStatusSnapshot[keyof AppPermissionStatusSnapshot]['status'];
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type AppPermissionRowMetadata = {
  readonly actionLabel: string;
  readonly detail: string;
  readonly focusLabel: string;
  readonly grantedAriaLabel: string;
  readonly icon: IconComponent;
  readonly id: AppPermissionRowId;
  readonly label: string;
};

export const appPermissionMetadata = {
  microphone: {
    actionLabel: '允许麦克风',
    detail: 'Reo 仅在您主动录音时访问麦克风。',
    focusLabel: '麦克风',
    grantedAriaLabel: '麦克风已允许',
    icon: Mic,
    id: 'microphone',
    label: '允许使用麦克风权限',
  },
  camera: {
    actionLabel: '允许摄像头',
    detail: 'Reo 仅在您主动拍摄时访问摄像头。',
    focusLabel: '摄像头',
    grantedAriaLabel: '摄像头已允许',
    icon: Camera,
    id: 'camera',
    label: '允许使用摄像头权限',
  },
  accessibility: {
    actionLabel: '开启辅助功能',
    detail: 'Reo 仅在您主动使用时捕获快捷键。',
    focusLabel: '辅助功能',
    grantedAriaLabel: '辅助功能已开启',
    icon: Accessibility,
    id: 'accessibility',
    label: '允许开启辅助功能',
  },
} as const satisfies Record<AppPermissionRowId, AppPermissionRowMetadata>;

export const appPermissionRows = APP_PERMISSION_IDS.map((id) => appPermissionMetadata[id]);

export const permissionTrailingClassName =
  'min-h-[36px] min-w-[72px] rounded-md px-12 text-ui-md leading-ui-md';
export const permissionActionButtonClassName =
  'min-h-[40px] min-w-[112px] rounded-md px-16 text-ui-md leading-ui-md';

const permissionRowClassName =
  'grid-cols-[minmax(0,1fr)_auto] items-center gap-16 rounded-md bg-card px-16 py-12 md:!grid-cols-[minmax(0,1fr)_auto] md:!items-center md:!gap-16';
const permissionRowFocusedClassName = 'bg-secondary ring-2 ring-ring/35';
const permissionRowContentClassName =
  'grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-12';

type BadgeVariant = Exclude<BadgeProps['variant'], null | undefined>;
type PermissionBadgeStatus = 'granted' | 'loading' | 'voice-ready';

export function appPermissionFocusLabel(permission: AppPermissionRowId) {
  return appPermissionMetadata[permission].focusLabel;
}

export function appPermissionActionLabel(permission: AppPermissionRowId) {
  return appPermissionMetadata[permission].actionLabel;
}

export function appPermissionTrailingLabel(
  permission: AppPermissionRowId,
  status: AppPermissionStatus | null
) {
  if (status === null) {
    return '待检查';
  }
  if (status === 'granted') {
    return '已允许';
  }
  return appPermissionActionLabel(permission);
}

export function appPermissionActionAriaLabel(
  permission: AppPermissionRowId,
  status: AppPermissionStatus | null
) {
  if (status !== 'granted') {
    return appPermissionActionLabel(permission);
  }

  return appPermissionMetadata[permission].grantedAriaLabel;
}

export function permissionStatusBadgeVariant(status: PermissionBadgeStatus): BadgeVariant {
  return status === 'loading' ? 'outline' : 'secondary';
}

function PermissionStatusMark({
  Icon,
  granted,
}: {
  readonly Icon: IconComponent;
  readonly granted: boolean;
}) {
  const VisibleIcon = granted ? Check : Icon;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-[40px] shrink-0 place-items-center rounded-md bg-secondary',
        granted ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      <VisibleIcon className={cn('size-[20px]', granted ? 'stroke-[2.6]' : 'stroke-[2.2]')} />
    </span>
  );
}

export function PermissionChecklistRow({
  detail,
  focused = false,
  granted,
  icon,
  label,
  testId,
  trailing,
}: {
  readonly detail: string;
  readonly focused?: boolean;
  readonly granted: boolean;
  readonly icon: IconComponent;
  readonly label: string;
  readonly testId: string;
  readonly trailing: ReactNode;
}) {
  return (
    <FieldRow
      data-focused={focused ? 'true' : undefined}
      data-testid={testId}
      className={cn(permissionRowClassName, focused ? permissionRowFocusedClassName : null)}
    >
      <div className={permissionRowContentClassName}>
        <PermissionStatusMark Icon={icon} granted={granted} />
        <div className="flex min-w-0 flex-col justify-center gap-4">
          <div className="flex min-w-0 items-center">
            <FieldLabel className="text-ui-md leading-[1.25]">{label}</FieldLabel>
          </div>
          <FieldHint className="mt-0 text-ui-sm leading-[1.35]">{detail}</FieldHint>
        </div>
      </div>
      <FieldControl className="flex justify-start sm:justify-end">{trailing}</FieldControl>
    </FieldRow>
  );
}

export function PermissionStatusBadge({
  children,
  status,
}: {
  readonly children: ReactNode;
  readonly status: PermissionBadgeStatus;
}) {
  return (
    <Badge className={permissionTrailingClassName} variant={permissionStatusBadgeVariant(status)}>
      {children}
    </Badge>
  );
}
