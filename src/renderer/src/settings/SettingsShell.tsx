import type { ReactNode } from 'react';
import { ArrowLeft, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SettingsCategory = 'voice';

export type SettingsShellProps = {
  readonly activeCategory: SettingsCategory;
  readonly children: ReactNode;
  readonly onReturnToApp: () => void;
  readonly onSelectCategory: (category: SettingsCategory) => void;
};

const SETTINGS_CATEGORY_LABEL: Record<SettingsCategory, string> = {
  voice: '语音',
};

const SETTINGS_CATEGORY_REGION_LABEL: Record<SettingsCategory, string> = {
  voice: '语音设置',
};

const SETTINGS_CATEGORIES = Object.keys(SETTINGS_CATEGORY_LABEL) as SettingsCategory[];

export function SettingsShell({
  activeCategory,
  children,
  onReturnToApp,
  onSelectCategory,
}: SettingsShellProps) {
  return (
    <div
      data-slot="settings-shell"
      className="flex h-full min-h-0 w-full overflow-hidden bg-background text-foreground"
    >
      <aside
        aria-label="设置侧边栏"
        className="flex w-[240px] shrink-0 flex-col border-r border-secondary bg-card px-12 py-16"
      >
        <Button
          type="button"
          variant="ghostIcon"
          size="compact"
          className="w-full justify-start px-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={onReturnToApp}
        >
          <ArrowLeft className="size-16" aria-hidden="true" />
          返回应用
        </Button>

        <nav className="mt-16 flex flex-col gap-4" aria-label="设置类目">
          {SETTINGS_CATEGORIES.map((category) => {
            const current = category === activeCategory;

            return (
              <Button
                key={category}
                type="button"
                variant="ghostIcon"
                size="compact"
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'w-full justify-start px-8',
                  current
                    ? 'bg-secondary text-foreground hover:bg-secondary hover:text-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
                onClick={() => onSelectCategory(category)}
              >
                <Mic className="size-16" aria-hidden="true" />
                {SETTINGS_CATEGORY_LABEL[category]}
              </Button>
            );
          })}
        </nav>
      </aside>

      <section
        aria-label={SETTINGS_CATEGORY_REGION_LABEL[activeCategory]}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-28 py-20"
      >
        <div className="mx-auto flex w-full max-w-[1120px] flex-col">
          <h1 className="text-heading-sm font-medium leading-heading-sm">
            {SETTINGS_CATEGORY_LABEL[activeCategory]}
          </h1>
          <div className="mt-24 min-h-0">{children}</div>
        </div>
      </section>
    </div>
  );
}
