import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, Mic, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MIN_SIDEBAR_WIDTH, TITLEBAR_HEIGHT } from '../app-shell/appShellGeometry';

export type SettingsSection = 'permissions' | 'voice';

export type SettingsShellProps = {
  readonly activeSection?: SettingsSection;
  readonly children: ReactNode;
  readonly onSectionChange?: (section: SettingsSection) => void;
  readonly onReturnToApp: () => void;
  readonly returnDisabled?: boolean;
};

const settingsSections = [
  { icon: ShieldCheck, id: 'permissions', label: '权限' },
  { icon: Mic, id: 'voice', label: '语音' },
] as const;

export function SettingsShell({
  activeSection = 'voice',
  children,
  onSectionChange,
  onReturnToApp,
  returnDisabled = false,
}: SettingsShellProps) {
  const activeSectionLabel =
    settingsSections.find((section) => section.id === activeSection)?.label ?? '语音';

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || returnDisabled) {
        return;
      }
      event.preventDefault();
      onReturnToApp();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReturnToApp, returnDisabled]);

  return (
    <div
      data-slot="settings-shell"
      className="relative flex h-dvh min-h-0 w-full overflow-hidden bg-background text-foreground"
    >
      <div
        role="banner"
        aria-label="设置标题栏"
        data-slot="settings-titlebar"
        className="pointer-events-auto absolute inset-x-0 top-0 z-10 bg-background [-webkit-app-region:drag]"
        style={{ height: TITLEBAR_HEIGHT }}
      />
      <aside
        aria-label="设置侧边栏"
        className="relative z-20 flex shrink-0 flex-col bg-card px-8 pb-16 [-webkit-app-region:drag]"
        style={{ paddingTop: TITLEBAR_HEIGHT, width: MIN_SIDEBAR_WIDTH }}
      >
        <Button
          type="button"
          variant="ghostIcon"
          size="compact"
          className="w-full justify-start px-8 text-muted-foreground hover:bg-secondary hover:text-foreground [-webkit-app-region:no-drag]"
          disabled={returnDisabled}
          onClick={onReturnToApp}
        >
          <ArrowLeft className="size-16" aria-hidden="true" />
          返回应用
        </Button>

        <nav
          className="mt-4 flex flex-col gap-4 [-webkit-app-region:no-drag]"
          aria-label="设置类目"
        >
          {settingsSections.map((section) => {
            const SectionIcon = section.icon;
            const active = section.id === activeSection;

            return (
              <Button
                key={section.id}
                type="button"
                variant="ghostIcon"
                size="compact"
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'w-full justify-start !bg-secondary px-8 !text-foreground hover:!bg-secondary hover:!text-foreground [-webkit-app-region:no-drag]'
                    : 'w-full justify-start px-8 text-muted-foreground hover:bg-secondary hover:text-foreground [-webkit-app-region:no-drag]'
                }
                onClick={() => onSectionChange?.(section.id)}
              >
                <SectionIcon className="size-16" aria-hidden="true" />
                {section.label}
              </Button>
            );
          })}
        </nav>
      </aside>

      <section
        aria-label={`${activeSectionLabel}设置`}
        className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-[44px] py-[92px]"
      >
        <div className="flex w-full max-w-[720px] flex-col">
          <h1 className="text-left text-heading-sm font-medium leading-heading-sm">
            {activeSectionLabel}
          </h1>
          <div className="mt-28 min-h-0">{children}</div>
        </div>
      </section>
    </div>
  );
}
