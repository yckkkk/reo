import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const bundledTemplateRoot = path.join(moduleDirectory, 'workspace-agent-config');
const sourceTemplateRoot = path.resolve(process.cwd(), 'src/main/workspace-agent-config');

function readManagedTemplate(relativePath: string): string {
  for (const root of [bundledTemplateRoot, sourceTemplateRoot]) {
    const filePath = path.join(root, relativePath);
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf8');
    }
  }
  throw new Error(`Missing Reo managed agent template: ${relativePath}`);
}

function extractFirstCssFence(markdown: string): string {
  const match = /```css\n([\s\S]*?)\n```/.exec(markdown);
  if (!match?.[1]) {
    throw new Error('Reo works design core reference is missing the token CSS fence');
  }
  return `${match[1]}\n`;
}

export const DEFAULT_WORKSPACE_AGENTS_MD = readManagedTemplate('AGENTS.md');
export const DEFAULT_WORKSPACE_REO_MD = readManagedTemplate('REO.md');

export const DEFAULT_REO_EDIT_SKILL_MD = readManagedTemplate('skills/reo-edit/SKILL.md');
export const DEFAULT_REO_COVER_IMAGE_SKILL_MD = readManagedTemplate(
  'skills/reo-cover-image/SKILL.md'
);
export const DEFAULT_REO_COVER_AESTHETIC_SKILL_MD = readManagedTemplate(
  'skills/reo-cover-aesthetic/SKILL.md'
);
export const DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD = readManagedTemplate(
  'skills/reo-generative-runtime/SKILL.md'
);
export const DEFAULT_REO_GENERATIVE_RUNTIME_INSPECT_SCRIPT_MJS = readManagedTemplate(
  'skills/reo-generative-runtime/scripts/inspect-runtime.mjs'
);
export const DEFAULT_REO_GENERATIVE_RUNTIME_SCAFFOLD_SCRIPT_MJS = readManagedTemplate(
  'skills/reo-generative-runtime/scripts/scaffold-runtime.mjs'
);
export const DEFAULT_REO_GENERATIVE_RUNTIME_VALIDATE_SCRIPT_MJS = readManagedTemplate(
  'skills/reo-generative-runtime/scripts/validate-runtime.mjs'
);
export const DEFAULT_REO_WORKS_SKILL_MD = readManagedTemplate('skills/reo-works/SKILL.md');
export const DEFAULT_REO_WORKS_DESIGN_SKILL_MD = readManagedTemplate(
  'skills/reo-works-design/SKILL.md'
);
export const DEFAULT_REO_DOCTOR_SKILL_MD = readManagedTemplate('skills/reo-doctor/SKILL.md');
export const DEFAULT_REO_DOCTOR_SCRIPT_MJS = readManagedTemplate(
  'skills/reo-doctor/scripts/reo-doctor.mjs'
);

export const DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES = {
  'bundle-contract.md': readManagedTemplate(
    'skills/reo-generative-runtime/references/bundle-contract.md'
  ),
  'bridge-api.md': readManagedTemplate('skills/reo-generative-runtime/references/bridge-api.md'),
  'state-and-storage.md': readManagedTemplate(
    'skills/reo-generative-runtime/references/state-and-storage.md'
  ),
  'templates.md': readManagedTemplate('skills/reo-generative-runtime/references/templates.md'),
  'validation.md': readManagedTemplate('skills/reo-generative-runtime/references/validation.md'),
} as const;

export const DEFAULT_REO_WORKS_REFERENCE_FILES = {
  'file-contract.md': readManagedTemplate('skills/reo-works/references/file-contract.md'),
  'workflows.md': readManagedTemplate('skills/reo-works/references/workflows.md'),
  'runtime-contract-check.md': readManagedTemplate(
    'skills/reo-works/references/runtime-contract-check.md'
  ),
} as const;

export const DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES = {
  'core-design-system.md': readManagedTemplate(
    'skills/reo-works-design/references/core-design-system.md'
  ),
  'modules.md': readManagedTemplate('skills/reo-works-design/references/modules.md'),
  'explorables.md': readManagedTemplate('skills/reo-works-design/references/explorables.md'),
  'interaction-patterns.md': readManagedTemplate(
    'skills/reo-works-design/references/interaction-patterns.md'
  ),
  'svg-and-diagrams.md': readManagedTemplate(
    'skills/reo-works-design/references/svg-and-diagrams.md'
  ),
  'charts.md': readManagedTemplate('skills/reo-works-design/references/charts.md'),
  'mockups-and-art.md': readManagedTemplate(
    'skills/reo-works-design/references/mockups-and-art.md'
  ),
} as const;

export const DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES = {
  'reactive-binding.html': readManagedTemplate(
    'skills/reo-works-design/examples/reactive-binding.html'
  ),
  'derive-chain.html': readManagedTemplate('skills/reo-works-design/examples/derive-chain.html'),
  'number-line.html': readManagedTemplate('skills/reo-works-design/examples/number-line.html'),
  'zoomable-series.html': readManagedTemplate(
    'skills/reo-works-design/examples/zoomable-series.html'
  ),
  'rail-widget.html': readManagedTemplate('skills/reo-works-design/examples/rail-widget.html'),
} as const;

export const DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS = extractFirstCssFence(
  DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES['core-design-system.md']
);

export const WORKSPACE_MANAGED_AGENT_TEMPLATE_FILES: Readonly<Record<string, string>> = {
  '.reo/REO.md': DEFAULT_WORKSPACE_REO_MD,
  'skills/reo-edit/SKILL.md': DEFAULT_REO_EDIT_SKILL_MD,
  'skills/reo-cover-image/SKILL.md': DEFAULT_REO_COVER_IMAGE_SKILL_MD,
  'skills/reo-cover-aesthetic/SKILL.md': DEFAULT_REO_COVER_AESTHETIC_SKILL_MD,
  'skills/reo-generative-runtime/SKILL.md': DEFAULT_REO_GENERATIVE_RUNTIME_SKILL_MD,
  ...Object.fromEntries(
    Object.entries(DEFAULT_REO_GENERATIVE_RUNTIME_REFERENCE_FILES).map(([filename, text]) => [
      `skills/reo-generative-runtime/references/${filename}`,
      text,
    ])
  ),
  'skills/reo-generative-runtime/scripts/inspect-runtime.mjs':
    DEFAULT_REO_GENERATIVE_RUNTIME_INSPECT_SCRIPT_MJS,
  'skills/reo-generative-runtime/scripts/scaffold-runtime.mjs':
    DEFAULT_REO_GENERATIVE_RUNTIME_SCAFFOLD_SCRIPT_MJS,
  'skills/reo-generative-runtime/scripts/validate-runtime.mjs':
    DEFAULT_REO_GENERATIVE_RUNTIME_VALIDATE_SCRIPT_MJS,
  'skills/reo-works/SKILL.md': DEFAULT_REO_WORKS_SKILL_MD,
  ...Object.fromEntries(
    Object.entries(DEFAULT_REO_WORKS_REFERENCE_FILES).map(([filename, text]) => [
      `skills/reo-works/references/${filename}`,
      text,
    ])
  ),
  'skills/reo-works-design/SKILL.md': DEFAULT_REO_WORKS_DESIGN_SKILL_MD,
  ...Object.fromEntries(
    Object.entries(DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES).map(([filename, text]) => [
      `skills/reo-works-design/references/${filename}`,
      text,
    ])
  ),
  ...Object.fromEntries(
    Object.entries(DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES).map(([filename, text]) => [
      `skills/reo-works-design/examples/${filename}`,
      text,
    ])
  ),
  'skills/reo-doctor/SKILL.md': DEFAULT_REO_DOCTOR_SKILL_MD,
  'skills/reo-doctor/scripts/reo-doctor.mjs': DEFAULT_REO_DOCTOR_SCRIPT_MJS,
} as const;
