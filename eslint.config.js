import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { builtinModules } from 'node:module';

const nodeBuiltinImports = [
  ...new Set(
    builtinModules.flatMap((moduleName) => {
      const bareName = moduleName.replace(/^node:/, '');
      return [bareName, `node:${bareName}`];
    })
  ),
];
const rendererRestrictedDynamicImportPattern = `^(?:${['electron', ...nodeBuiltinImports]
  .map((source) => source.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&'))
  .join('|')})$`;
const preloadRestrictedImportPattern =
  '^(?!electron$|\\.\\/|\\.\\.\\/workspace-contract\\/(?:workspace-channels|reo-workspace-bridge)\\.js$).+';

export default defineConfig([
  globalIgnores([
    'node_modules',
    'out',
    '.tmp',
    '.agents/skills',
    '.claude/skills',
    '.superpowers',
  ]),
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: ['electron', ...nodeBuiltinImports],
          patterns: ['node:*'],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `ImportExpression[source.value=/${rendererRestrictedDynamicImportPattern}/]`,
          message: 'Renderer source cannot dynamically import Electron or Node builtins.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/preload/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltinImports,
          patterns: [
            {
              regex: preloadRestrictedImportPattern,
              message:
                'Preload source may only import Electron and relative preload/contract modules.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `ImportExpression[source.value=/${preloadRestrictedImportPattern}/]`,
          message:
            'Preload source may only dynamically import Electron and relative preload/contract modules.',
        },
      ],
    },
  },
  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'src/workspace-contract/**/*.ts',
      'test/**/*.ts',
      'electron.vite.config.ts',
      'vitest.config.ts',
    ],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
  },
]);
