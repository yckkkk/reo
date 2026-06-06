import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rendererSourcePath = fileURLToPath(new URL('./src/renderer/src', import.meta.url));
const workspaceAgentConfigSourcePath = fileURLToPath(
  new URL('./src/main/workspace-agent-config', import.meta.url)
);
const workspaceAgentConfigBuildPath = fileURLToPath(
  new URL('./out/main/workspace-agent-config', import.meta.url)
);

export default defineConfig({
  main: {
    plugins: [
      {
        name: 'copy-workspace-agent-config',
        apply: 'build',
        closeBundle() {
          rmSync(workspaceAgentConfigBuildPath, { recursive: true, force: true });
          cpSync(workspaceAgentConfigSourcePath, workspaceAgentConfigBuildPath, {
            recursive: true,
          });
        },
      },
    ],
  },
  preload: {
    build: {
      rolldownOptions: {
        output: {
          entryFileNames: '[name].cjs',
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': rendererSourcePath,
      },
    },
    server: {
      port: 5183,
      strictPort: true,
    },
  },
});
