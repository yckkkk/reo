export type WorkspaceRailTab =
  | {
      readonly kind: 'memories';
    }
  | {
      readonly kind: 'widget';
      readonly widgetId: string;
    };

export const MEMORY_RAIL_TAB: WorkspaceRailTab = { kind: 'memories' };
