import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import {
  appPermissionActionAriaLabel,
  appPermissionRows,
  appPermissionTrailingLabel,
  PermissionChecklistRow,
  permissionActionButtonClassName,
  PermissionStatusBadge,
  type AppPermissionRowId,
} from '../app-permissions/PermissionChecklistRow';
import { appPermissionStatusQueryOptions } from './appPermissionQueries';

export type PermissionSettingsPanelProps = {
  readonly pendingPermissionRequest?: AppPermissionRowId | null;
  readonly onRequestPermission: (permission: AppPermissionRowId) => void | Promise<void>;
};

export function PermissionSettingsPanel({
  pendingPermissionRequest = null,
  onRequestPermission,
}: PermissionSettingsPanelProps) {
  const { data: permissions, isError, isLoading } = useQuery(appPermissionStatusQueryOptions());

  if (isLoading) {
    return <p className="text-ui-sm leading-ui-sm text-muted-foreground">正在检查权限状态。</p>;
  }

  if (isError || !permissions) {
    return <p className="text-ui-sm leading-ui-sm text-destructive">无法加载权限状态。</p>;
  }

  return (
    <FieldGroup aria-label="Reo 权限状态" className="gap-8">
      {appPermissionRows.map((row) => {
        const status = permissions[row.id].status;
        const isActionable = status !== 'granted';
        const permissionActionDisabled = pendingPermissionRequest !== null;

        return (
          <PermissionChecklistRow
            key={row.id}
            detail={row.detail}
            granted={status === 'granted'}
            icon={row.icon}
            label={row.label}
            testId={`permission-settings-row-${row.id}`}
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
                <PermissionStatusBadge status="granted">
                  {appPermissionTrailingLabel(row.id, status)}
                </PermissionStatusBadge>
              )
            }
          />
        );
      })}
    </FieldGroup>
  );
}
