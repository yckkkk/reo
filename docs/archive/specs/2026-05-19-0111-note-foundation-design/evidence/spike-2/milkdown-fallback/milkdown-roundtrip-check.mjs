import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import { JSDOM } from 'jsdom';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { Editor, defaultValueCtx, editorViewCtx, rootCtx, serializerCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener } from '@milkdown/kit/plugin/listener';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(dirname, 'fixtures');

const RAW_TRIGGER_LABELS = {
  footnote: 'footnote',
  math: 'math inline/block',
  callout: 'callout/admonition',
  definitionList: 'definition list',
  mdx: 'MDX/import/JSX',
  linkScheme: 'non-attachments image/link scheme',
  html: 'unknown inline HTML except attachments img',
  extraFrontmatter: 'extra YAML/TOML blocks beyond frontmatter',
};

async function main() {
  installDom();

  const packageVersions = await readPackageVersions();
  const fixtureFiles = (await fs.readdir(fixturesDir))
    .filter((file) => file.endsWith('.md'))
    .sort();
  const results = [];
  const log = [];

  for (const fixture of fixtureFiles) {
    const markdown = await fs.readFile(path.join(fixturesDir, fixture), 'utf8');
    const expectedKind = fixture.includes('__raw.md') ? 'raw' : 'subset';
    const classification = classifyMarkdown(markdown);
    const roundtrip = await checkMilkdownRoundTrip(markdown, fixture);
    const actualKind = classification.rawTriggers.length > 0 || !roundtrip.ok ? 'raw' : 'subset';
    const pass = expectedKind === classification.expectedKind && expectedKind === actualKind;

    results.push({
      fixture,
      expectedKind,
      actualKind,
      features: classification.features,
      pass,
      notes: buildNotes(classification, roundtrip),
      milkdown: {
        executed: roundtrip.executed,
        serializedMarkdown: roundtrip.serializedMarkdown,
        failure: roundtrip.failure,
      },
    });
    log.push(formatLogLine(fixture, expectedKind, actualKind, pass, roundtrip));
  }

  const summary = summarizeResults(results);
  const output = { summary, packageVersions, results };
  await fs.writeFile(
    path.join(dirname, 'milkdown-results.json'),
    `${JSON.stringify(output, null, 2)}\n`
  );
  await fs.writeFile(path.join(dirname, 'milkdown-roundtrip.log'), `${log.join('\n')}\n`);
  await fs.writeFile(path.join(dirname, 'milkdown-report.md'), buildReport(output, log));

  console.log(`fixtures=${results.length}`);
  console.log(`subsetPassRate=${formatRate(summary.subsetPassRate)}`);
  console.log(`rawTriggerPassRate=${formatRate(summary.rawTriggerPassRate)}`);
  console.log(`failureCount=${summary.failureCount}`);
  console.log(`recommendation=${summary.recommendation}`);

  if (summary.failureCount > 0) {
    process.exitCode = 1;
  }
}

function classifyMarkdown(markdown) {
  const { content } = matter(markdown);
  const tree = parseMarkdown(content);
  const features = new Set();
  const triggers = new Set();

  detectRegexTriggers(markdown, content, triggers);
  visit(tree, (node) => {
    detectFeatures(node, features);
    detectNodeTriggers(node, triggers);
  });

  return {
    expectedKind: triggers.size === 0 ? 'subset' : 'raw',
    features: [...features].sort(),
    rawTriggers: [...triggers],
  };
}

function summarizeResults(results) {
  const subset = results.filter((result) => result.expectedKind === 'subset');
  const raw = results.filter((result) => result.expectedKind === 'raw');
  const subsetPassCount = subset.filter((result) => result.pass).length;
  const rawPassCount = raw.filter((result) => result.pass).length;
  const subsetPassRate = subset.length === 0 ? 1 : subsetPassCount / subset.length;
  const rawTriggerPassRate = raw.length === 0 ? 1 : rawPassCount / raw.length;
  const subsetFailureRate = subset.length === 0 ? 0 : 1 - subsetPassRate;

  return {
    total: results.length,
    subsetCount: subset.length,
    rawCount: raw.length,
    failureCount: results.filter((result) => !result.pass).length,
    subsetPassRate,
    rawTriggerPassRate,
    subsetFailureRate,
    recommendation:
      subsetFailureRate === 0 ? 'milkdown-default-candidate' : 'pause-for-deeper-editor-spec',
  };
}

function detectRegexTriggers(markdown, body, triggers) {
  if (
    /^\s*(import|export)\s.+from\s+["']/m.test(body) ||
    /<[A-Z][A-Za-z0-9]*(\s|>|\/)/.test(body)
  ) {
    triggers.add(RAW_TRIGGER_LABELS.mdx);
  }
  if (/(^|\s)\$[^$\n]+\$(?=\s|[.,;:!?)]|$)/m.test(body) || /^\s*\$\$[\s\S]*?^\s*\$\$/m.test(body)) {
    triggers.add(RAW_TRIGGER_LABELS.math);
  }
  if (/^\s*(:::+|!!!)\s*\w+/m.test(body) || /^>\s*\[![A-Z]+\]/m.test(body)) {
    triggers.add(RAW_TRIGGER_LABELS.callout);
  }
  if (/^[^\n:][^\n]*\n:\s+\S/m.test(body)) {
    triggers.add(RAW_TRIGGER_LABELS.definitionList);
  }
  const withoutOpeningFrontmatter = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  if (/^\s*---\s*$/m.test(withoutOpeningFrontmatter) || /^\s*\+\+\+\s*$/m.test(markdown)) {
    triggers.add(RAW_TRIGGER_LABELS.extraFrontmatter);
  }
}

function detectFeatures(node, features) {
  switch (node.type) {
    case 'heading':
      features.add(`heading-h${node.depth}`);
      break;
    case 'paragraph':
      features.add('paragraph');
      break;
    case 'list':
      features.add(node.ordered ? 'ordered-list' : 'unordered-list');
      if (node.children?.some((item) => typeof item.checked === 'boolean')) {
        features.add('task-list');
      }
      break;
    case 'blockquote':
      features.add('blockquote');
      break;
    case 'code':
      features.add(node.lang ? 'code-fence-lang' : 'code-fence');
      break;
    case 'inlineCode':
      features.add('inline-code');
      break;
    case 'link':
      features.add('link');
      break;
    case 'image':
      if (isAttachmentPath(node.url)) {
        features.add('attachment-image');
      }
      break;
    case 'emphasis':
      features.add('emphasis');
      break;
    case 'strong':
      features.add('strong');
      break;
    case 'delete':
      features.add('strikethrough');
      break;
    case 'break':
      features.add('hard-break');
      break;
    case 'table':
      features.add('gfm-table');
      break;
    case 'html':
      if (isAllowedAttachmentImgHtml(node.value)) {
        features.add('attachment-image-html');
      }
      break;
  }
}

function detectNodeTriggers(node, triggers) {
  if (node.type === 'footnoteDefinition' || node.type === 'footnoteReference') {
    triggers.add(RAW_TRIGGER_LABELS.footnote);
  }
  if (node.type === 'image' && !isAttachmentPath(node.url)) {
    triggers.add(RAW_TRIGGER_LABELS.linkScheme);
  }
  if (node.type === 'link' && hasUnsupportedLinkScheme(node.url)) {
    triggers.add(RAW_TRIGGER_LABELS.linkScheme);
  }
  if (node.type === 'html' && !isAllowedAttachmentImgHtml(node.value)) {
    triggers.add(RAW_TRIGGER_LABELS.html);
  }
}

async function checkMilkdownRoundTrip(markdown, fixture) {
  const { content } = matter(markdown);
  const root = document.createElement('div');
  root.setAttribute('data-fixture', fixture);
  document.body.append(root);

  let editor;
  try {
    editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, content);
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .create();

    const serializedMarkdown = editor.action((ctx) => {
      const editorView = ctx.get(editorViewCtx);
      const serializer = ctx.get(serializerCtx);
      return serializer(editorView.state.doc);
    });
    const inputTree = normalizeMarkdownAst(content);
    const outputTree = normalizeMarkdownAst(serializedMarkdown);
    const equivalent = JSON.stringify(inputTree) === JSON.stringify(outputTree);

    return {
      executed: true,
      ok: equivalent,
      serializedMarkdown,
      failure: equivalent ? null : 'Milkdown markdown round-trip changed normalized AST',
    };
  } catch (error) {
    return {
      executed: false,
      ok: false,
      serializedMarkdown: '',
      failure: `${error.name}: ${error.message}`,
    };
  } finally {
    if (editor) {
      await editor.destroy();
    }
    root.remove();
  }
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1/',
  });
  for (const key of [
    'window',
    'document',
    'Node',
    'HTMLElement',
    'MutationObserver',
    'Event',
    'CustomEvent',
  ]) {
    globalThis[key] = dom.window[key];
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
  globalThis.removeEventListener = dom.window.removeEventListener.bind(dom.window);
  globalThis.dispatchEvent = dom.window.dispatchEvent.bind(dom.window);
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
  });
}

function buildNotes(classification, roundtrip) {
  const notes = [];
  if (classification.rawTriggers.length > 0) {
    notes.push(`raw triggers: ${classification.rawTriggers.join(', ')}`);
  }
  if (!roundtrip.executed) {
    notes.push(`Milkdown not executed: ${roundtrip.failure}`);
  } else if (!roundtrip.ok) {
    notes.push(roundtrip.failure);
    notes.push(`Milkdown export: ${oneLine(roundtrip.serializedMarkdown)}`);
  } else {
    notes.push('Milkdown round-trip ok');
  }
  return notes.join('; ');
}

function buildReport({ summary, packageVersions, results }, log) {
  const failures = results.filter((result) => !result.pass);
  return `# Milkdown Fallback Round-trip Report

## What Ran

- Sandbox: \`.tmp/note-foundation-spikes/spike-2b-milkdown-fallback/\`
- Fixtures: ${summary.total}
- Command: \`npm install @milkdown/kit @milkdown/react @milkdown/crepe unified remark-parse remark-gfm remark-stringify gray-matter jsdom\`
- Command: \`npm install @milkdown/preset-gfm remark-stringify\`
- Command: \`npm test\`

## Package Versions

${Object.entries(packageVersions)
  .map(([name, version]) => `- \`${name}\`: \`${version}\``)
  .join('\n')}

## Execution Method

The script executed Milkdown in Node with a JSDOM DOM shim:

- \`Editor.make()\`
- \`rootCtx\` and \`defaultValueCtx\`
- \`commonmark\`, \`gfm\`, \`history\`, and \`listener\`
- Markdown readback through \`serializerCtx(editorViewCtx.state.doc)\`

Subset fixtures pass only when the normalized Markdown AST is unchanged after parse and serialize. Raw fixtures pass when the subset gate routes them to raw mode before editor conversion.

## Results

- Subset pass rate: ${formatRate(summary.subsetPassRate)} (${results.filter((result) => result.expectedKind === 'subset' && result.pass).length}/${summary.subsetCount})
- Raw trigger pass rate: ${formatRate(summary.rawTriggerPassRate)} (${results.filter((result) => result.expectedKind === 'raw' && result.pass).length}/${summary.rawCount})
- Failure count: ${summary.failureCount}
- Recommendation key: \`${summary.recommendation}\`

## Exact Failures

${
  failures.length === 0
    ? '- None'
    : failures.map((result) => `- \`${result.fixture}\`: ${result.notes}`).join('\n')
}

## Fixture Coverage

${results
  .map(
    (result) =>
      `- \`${result.fixture}\`: expected \`${result.expectedKind}\`, actual \`${result.actualKind}\`, pass=${String(result.pass)}, features=${result.features.join(', ') || 'none'}; ${result.notes}`
  )
  .join('\n')}

## Round-trip Log

\`\`\`text
${log.join('\n')}
\`\`\`
`;
}

function formatLogLine(fixture, expectedKind, actualKind, pass, roundtrip) {
  return [
    pass ? 'PASS' : 'FAIL',
    fixture,
    `expected=${expectedKind}`,
    `actual=${actualKind}`,
    `milkdownExecuted=${String(roundtrip.executed)}`,
    roundtrip.failure ? `failure=${roundtrip.failure}` : 'roundtrip=ok',
  ].join(' | ');
}

async function readPackageVersions() {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(dirname, 'package-lock.json'), 'utf8')
  );
  const dependencies = packageJson.packages[''].dependencies;
  const versions = {};

  for (const name of Object.keys(dependencies).sort()) {
    versions[name] = packageJson.packages[`node_modules/${name}`]?.version ?? dependencies[name];
  }

  return versions;
}

function parseMarkdown(markdown) {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

function normalizeMarkdownAst(markdown) {
  const tree = parseMarkdown(markdown);
  return stripAst(tree);
}

function stripAst(value) {
  if (Array.isArray(value)) {
    return value.map(stripAst);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const result = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (['position', 'identifier', 'label'].includes(key)) {
      continue;
    }
    result[key] = stripAst(childValue);
  }
  return result;
}

function visit(node, visitor) {
  visitor(node);
  for (const child of node.children ?? []) {
    visit(child, visitor);
  }
}

function isAttachmentPath(url = '') {
  return /^attachments\/[A-Za-z0-9._/-]+$/.test(url) && !url.includes('..');
}

function hasUnsupportedLinkScheme(url = '') {
  if (/^(https?:|mailto:)/i.test(url)) {
    return false;
  }
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(url) && !url.startsWith('reo-attachment://');
}

function isAllowedAttachmentImgHtml(value = '') {
  return /^<img\s+[^>]*src=["']attachments\/[A-Za-z0-9._/-]+["'][^>]*\/?>\s*$/i.test(value.trim());
}

function oneLine(value) {
  return JSON.stringify(value.length > 180 ? `${value.slice(0, 177)}...` : value);
}

function formatRate(value) {
  return `${(value * 100).toFixed(1)}%`;
}

await main();
