import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installDevWorkspaceScenarioBridge } from './devWorkspaceScenario';
import './index.css';
import { ReoQueryProvider } from './queryClient';

const DevAgentationRoot =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? lazy(async () => {
        const { DevAgentation } = await import('./DevAgentation');
        return { default: DevAgentation };
      })
    : null;

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root element');
}

installDevWorkspaceScenarioBridge();

createRoot(root).render(
  <StrictMode>
    <ReoQueryProvider>
      <App />
    </ReoQueryProvider>
    {DevAgentationRoot ? (
      <Suspense fallback={null}>
        <DevAgentationRoot />
      </Suspense>
    ) : null}
  </StrictMode>
);
