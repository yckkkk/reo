import type { ReactNode } from 'react';

type WorkspaceErrorBannerProps = {
  readonly children: ReactNode;
};

export function WorkspaceErrorBanner({ children }: WorkspaceErrorBannerProps) {
  return (
    <p className="text-body leading-body text-ember" role="alert">
      {children}
    </p>
  );
}
