import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_REO_EDIT_SKILL_MD,
  DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES,
  DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES,
  DEFAULT_WORKSPACE_AGENTS_MD,
  DEFAULT_WORKSPACE_REO_MD,
  WORKSPACE_MANAGED_AGENT_TEMPLATE_FILES,
} from '../../src/main/workspaceManagedAgentTemplates.js';

async function readTemplate(relativePath: string): Promise<string> {
  return await readFile(
    path.resolve(process.cwd(), 'src/main/workspace-agent-config', relativePath),
    'utf8'
  );
}

test('managed Reo agent templates are sourced from external files', async () => {
  const agentsMd = await readTemplate('AGENTS.md');
  const reoMd = await readTemplate('REO.md');
  const editSkillMd = await readTemplate('skills/reo-edit/SKILL.md');
  const tokenContractScript = await readTemplate(
    'skills/reo-generative-runtime/scripts/reo-token-contract.mjs'
  );
  const reactiveExampleHtml = await readTemplate(
    'skills/reo-works-design/examples/reactive-binding.html'
  );

  assert.equal(DEFAULT_WORKSPACE_AGENTS_MD, agentsMd);
  assert.equal(DEFAULT_WORKSPACE_REO_MD, reoMd);
  assert.equal(DEFAULT_REO_EDIT_SKILL_MD, editSkillMd);
  assert.equal(
    DEFAULT_REO_GENERATIVE_RUNTIME_SCRIPT_FILES['reo-token-contract.mjs'],
    tokenContractScript
  );
  assert.equal(
    DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES['reactive-binding.html'],
    reactiveExampleHtml
  );
  assert.equal(WORKSPACE_MANAGED_AGENT_TEMPLATE_FILES['AGENTS.md'], undefined);
  assert.equal(WORKSPACE_MANAGED_AGENT_TEMPLATE_FILES['.reo/REO.md'], reoMd);
  assert.equal(WORKSPACE_MANAGED_AGENT_TEMPLATE_FILES['skills/reo-edit/SKILL.md'], editSkillMd);
  assert.equal(
    WORKSPACE_MANAGED_AGENT_TEMPLATE_FILES[
      'skills/reo-generative-runtime/scripts/reo-token-contract.mjs'
    ],
    tokenContractScript
  );
  assert.equal(
    WORKSPACE_MANAGED_AGENT_TEMPLATE_FILES[
      'skills/reo-works-design/examples/reactive-binding.html'
    ],
    reactiveExampleHtml
  );
});
