import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rendererSourcePath = fileURLToPath(new URL('./src/renderer/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': rendererSourcePath,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: 'node',
          include: [
            'src/renderer/src/appProjection.test.ts',
            'src/renderer/src/workspace/memoryLabels.test.ts',
            'src/renderer/src/workspace/recording/recordingTimeline.test.ts',
            'src/renderer/src/workspace/recordingMachine.test.ts',
            'src/renderer/src/workspace/segmentDeleteProjection.test.ts',
            'src/renderer/src/workspace/workspaceErrorMessages.test.ts',
            'src/renderer/src/workspace/workspaceQueries.test.ts',
          ],
          name: 'renderer-node',
        },
      },
      {
        extends: true,
        test: {
          environment: 'jsdom',
          environmentOptions: {
            jsdom: {
              url: 'http://127.0.0.1/',
            },
          },
          include: [
            'src/renderer/src/app-shell/themePreference.test.ts',
            'src/renderer/src/settings/voiceSettingsQueries.test.ts',
            'src/renderer/src/workspace/audioWaveform.test.ts',
            'src/renderer/src/workspace/mediaRecorderAdapter.test.ts',
            'src/renderer/src/workspace/recordingRecovery.test.ts',
            'src/renderer/src/workspace/workspaceApi.test.ts',
          ],
          name: 'renderer-jsdom-browser',
          setupFiles: ['src/renderer/src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          environment: 'jsdom',
          environmentOptions: {
            jsdom: {
              url: 'http://127.0.0.1/',
            },
          },
          fileParallelism: false,
          include: ['src/renderer/src/**/*.test.tsx'],
          maxWorkers: 1,
          name: 'renderer-jsdom-components',
          setupFiles: ['src/renderer/src/test/setup.ts'],
        },
      },
    ],
  },
});
