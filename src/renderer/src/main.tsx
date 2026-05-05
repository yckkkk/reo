import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function App() {
  return (
    <main className="app-shell">
      <section className="app-panel" aria-labelledby="app-title">
        <p className="eyebrow">Electron</p>
        <h1 id="app-title">Reo</h1>
        <p className="summary">React + TypeScript + Vite + Electron.</p>
      </section>
    </main>
  );
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
