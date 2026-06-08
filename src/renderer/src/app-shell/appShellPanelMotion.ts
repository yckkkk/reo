import { createContext, useContext } from 'react';

type AppShellPanelMotionContextValue = {
  readonly panelMotionActive: boolean;
};

const DEFAULT_APP_SHELL_PANEL_MOTION: AppShellPanelMotionContextValue = {
  panelMotionActive: false,
};

export const AppShellPanelMotionContext = createContext<AppShellPanelMotionContextValue>(
  DEFAULT_APP_SHELL_PANEL_MOTION
);

export function useAppShellPanelMotion() {
  return useContext(AppShellPanelMotionContext);
}
