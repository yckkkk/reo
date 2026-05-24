import { Eraser, ExternalLink, Maximize2, PencilLine } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';
import type { WorkspaceSegmentEntityActionRequest } from '../../../workspace-contract/workspace-contract';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { bindSegmentEntityActions } from './entityActionBindings';
import { EntityPathActionGroup, entityActionMenuSeparatorClassName } from './EntityPathActionGroup';

export type SegmentContentActionsMenuProps = {
  readonly actionIdentity: WorkspaceSegmentEntityActionRequest;
  readonly clearDisabled?: boolean;
  readonly contentAlign?: ComponentProps<typeof DropdownMenuContent>['align'];
  readonly contentKind: 'body' | 'transcript';
  readonly editDisabled?: boolean;
  readonly menuLabel: string;
  readonly onClear: () => void;
  readonly onCloseAutoFocus?:
    | ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus']
    | undefined;
  readonly onEdit: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRename: () => void;
  readonly open?: boolean;
  readonly trigger?: ReactElement;
};

function SegmentContentActionIcon({ icon: Icon }: { readonly icon: typeof ExternalLink }) {
  return <Icon className="size-16 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

export function SegmentContentActionsMenu({
  actionIdentity,
  clearDisabled = false,
  contentAlign = 'center',
  contentKind,
  editDisabled = false,
  menuLabel,
  onClear,
  onCloseAutoFocus,
  onEdit,
  onOpenChange,
  onRename,
  open,
  trigger,
}: SegmentContentActionsMenuProps) {
  const actionBindings = bindSegmentEntityActions(actionIdentity);
  const editLabel = contentKind === 'transcript' ? '编辑转录' : '编辑正文';
  const clearLabel = contentKind === 'transcript' ? '清空转录' : '清空正文';
  const defaultTrigger = (
    <Button type="button" variant="ghostIcon" size="icon" aria-label={menuLabel}>
      <Maximize2 className="size-16" aria-hidden="true" />
    </Button>
  );

  return (
    <DropdownMenu
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      <DropdownMenuTrigger asChild>{trigger ?? defaultTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={contentAlign}
        aria-label={menuLabel}
        aria-labelledby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        side="bottom"
      >
        <EntityPathActionGroup
          onCopyAbsolutePath={actionBindings.onCopyAbsolutePath}
          onCopyRelativePath={actionBindings.onCopyRelativePath}
          onOpenDefault={actionBindings.onOpenDefault}
          onRevealInFinder={actionBindings.onRevealInFinder}
        />
        <DropdownMenuSeparator className={entityActionMenuSeparatorClassName} />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={editDisabled} onSelect={onEdit}>
            <SegmentContentActionIcon icon={Maximize2} />
            {editLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRename}>
            <SegmentContentActionIcon icon={PencilLine} />
            重命名
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive data-[disabled]:text-destructive/50 data-[highlighted]:text-destructive"
            disabled={clearDisabled}
            onSelect={onClear}
          >
            <SegmentContentActionIcon icon={Eraser} />
            {clearLabel}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
