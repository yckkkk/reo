import type { ReactNode } from 'react';
import {
  TITLEBAR_ACTION_RIGHT,
  TITLEBAR_CONTROL_GAP,
  TITLEBAR_CONTROL_LEFT,
  TITLEBAR_CONTROL_SIZE,
  TITLEBAR_CONTROL_TOP,
} from '../app-shell/appShellGeometry';
import { ImmersiveWorkspaceReturnButton } from './ImmersiveWorkspaceReturnButton';

const IMMERSIVE_WORKSPACE_TITLEBAR_TITLE_LEFT =
  TITLEBAR_CONTROL_LEFT + TITLEBAR_CONTROL_SIZE + TITLEBAR_CONTROL_GAP;

type ImmersiveWorkspaceTitlebarProps = {
  readonly actions?: ReactNode;
  readonly actionsTestId?: string;
  readonly onReturn: () => void;
  readonly returnDisabled?: boolean;
  readonly title: ReactNode;
  readonly titleAs?: 'span' | 'h1';
  readonly titleTestId?: string;
};

export function ImmersiveWorkspaceTitlebar({
  actions,
  actionsTestId,
  onReturn,
  returnDisabled = false,
  title,
  titleAs = 'span',
  titleTestId,
}: ImmersiveWorkspaceTitlebarProps) {
  const TitleElement = titleAs;

  return (
    <>
      <ImmersiveWorkspaceReturnButton disabled={returnDisabled} onReturn={onReturn} />
      <div
        className="absolute z-10 flex h-32 max-w-[calc(100vw-280px)] items-center text-body font-regular leading-body text-foreground"
        data-testid={titleTestId}
        style={{ left: IMMERSIVE_WORKSPACE_TITLEBAR_TITLE_LEFT, top: TITLEBAR_CONTROL_TOP }}
      >
        <TitleElement className="min-w-0 truncate">{title}</TitleElement>
      </div>
      {actions ? (
        <div
          className="absolute z-10 flex h-48 items-center gap-8"
          data-testid={actionsTestId}
          style={{ right: TITLEBAR_ACTION_RIGHT, top: 0 }}
        >
          {actions}
        </div>
      ) : null}
    </>
  );
}
