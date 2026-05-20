import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

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

export function classifyMarkdown(markdown) {
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

export function summarizeResults(results) {
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
    milkdownFallbackTriggered: subsetFailureRate > 0.05 || subset.some((result) => !result.pass),
  };
}

async function main() {
  const packageVersions = await readPackageVersions();
  const fixtureFiles = (await fs.readdir(fixturesDir))
    .filter((file) => file.endsWith('.md'))
    .sort();
  const results = [];
  const log = [];

  for (const fixture of fixtureFiles) {
    const markdown = await fs.readFile(path.join(fixturesDir, fixture), 'utf8');
    const expectedFromName = fixture.includes('__raw.md') ? 'raw' : 'subset';
    const classification = classifyMarkdown(markdown);
    const roundtrip = await checkBlockNoteRoundTrip(markdown);
    const actualKind = classification.rawTriggers.length > 0 || !roundtrip.ok ? 'raw' : 'subset';
    const pass =
      expectedFromName === classification.expectedKind && expectedFromName === actualKind;

    results.push({
      fixture,
      expectedKind: expectedFromName,
      actualKind,
      features: classification.features,
      pass,
      notes: buildNotes(classification, roundtrip),
    });
    log.push(formatLogLine(fixture, expectedFromName, actualKind, pass, roundtrip));
  }

  const summary = summarizeResults(results);
  await fs.writeFile(
    path.join(dirname, 'classification.json'),
    `${JSON.stringify({ summary, packageVersions, results }, null, 2)}\n`
  );
  await fs.writeFile(path.join(dirname, 'roundtrip.log'), `${log.join('\n')}\n`);
  await fs.writeFile(
    path.join(dirname, 'report.md'),
    buildReport({ summary, packageVersions, results, log })
  );

  console.log(`fixtures=${results.length}`);
  console.log(`subsetPassRate=${formatRate(summary.subsetPassRate)}`);
  console.log(`rawTriggerPassRate=${formatRate(summary.rawTriggerPassRate)}`);
  console.log(`failureCount=${summary.failureCount}`);
  console.log(`milkdownFallbackTriggered=${String(summary.milkdownFallbackTriggered)}`);
  if (summary.failureCount > 0) {
    process.exitCode = 1;
  }
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

async function checkBlockNoteRoundTrip(markdown) {
  const { content } = matter(markdown);
  try {
    installDom();
    const { BlockNoteEditor } = await import('@blocknote/core');
    const editor = BlockNoteEditor.create();
    const blocks = await editor.tryParseMarkdownToBlocks(content);
    const exported = await editor.blocksToMarkdownLossy(blocks);
    const inputTree = normalizeMarkdownAst(content);
    const outputTree = normalizeMarkdownAst(exported);
    const equivalent = JSON.stringify(inputTree) === JSON.stringify(outputTree);
    return {
      executed: true,
      ok: equivalent,
      blockCount: blocks.length,
      exportedMarkdown: exported,
      failure: equivalent ? null : 'BlockNote lossy markdown round-trip changed normalized AST',
    };
  } catch (error) {
    return {
      executed: false,
      ok: false,
      blockCount: 0,
      exportedMarkdown: '',
      failure: `${error.name}: ${error.message}`,
    };
  }
}

function buildNotes(classification, roundtrip) {
  const notes = [];
  if (classification.rawTriggers.length > 0) {
    notes.push(`raw triggers: ${classification.rawTriggers.join(', ')}`);
  }
  if (!roundtrip.executed) {
    notes.push(`BlockNote not executed: ${roundtrip.failure}`);
  } else if (!roundtrip.ok) {
    notes.push(roundtrip.failure);
    notes.push(`BlockNote export: ${oneLine(roundtrip.exportedMarkdown)}`);
  } else {
    notes.push(`BlockNote round-trip ok (${roundtrip.blockCount} blocks)`);
  }
  return notes.join('; ');
}

function formatLogLine(fixture, expectedKind, actualKind, pass, roundtrip) {
  return [
    pass ? 'PASS' : 'FAIL',
    fixture,
    `expected=${expectedKind}`,
    `actual=${actualKind}`,
    `blocknoteExecuted=${String(roundtrip.executed)}`,
    roundtrip.failure ? `failure=${roundtrip.failure}` : `blocks=${roundtrip.blockCount}`,
  ].join(' | ');
}

function buildReport({ summary, packageVersions, results, log }) {
  const failures = results.filter((result) => !result.pass);
  const subsetFailures = results.filter(
    (result) => result.expectedKind === 'subset' && !result.pass
  );
  const rawFailures = results.filter((result) => result.expectedKind === 'raw' && !result.pass);

  return `# Spike #2 Round-trip Report

## What Ran

- Sandbox: \`.tmp/note-foundation-spikes/spike-2-roundtrip/\`
- Fixtures: ${summary.total}
- Command: \`npm install @blocknote/core unified remark-parse remark-gfm remark-stringify gray-matter js-yaml toml\`
- Command: \`npm install jsdom\`
- Command: \`npm test\`
- Command: \`npm run check\`

## Package Versions

${Object.entries(packageVersions)
  .map(([name, version]) => `- \`${name}\`: \`${version}\``)
  .join('\n')}

## Execution Method

The script executed the official BlockNote APIs in Node with a JSDOM DOM shim:

- \`editor.tryParseMarkdownToBlocks(markdown)\`
- \`editor.blocksToMarkdownLossy(blocks)\`

The report treats BlockNote export as lossy, per official docs, and validates subset fixtures by comparing normalized Markdown AST before and after the BlockNote parse/export cycle.

## Results

- Subset pass rate: ${formatRate(summary.subsetPassRate)} (${summary.subsetCount - subsetFailures.length}/${summary.subsetCount})
- Raw trigger pass rate: ${formatRate(summary.rawTriggerPassRate)} (${summary.rawCount - rawFailures.length}/${summary.rawCount})
- Failure count: ${summary.failureCount}
- BlockNote threshold status: ${summary.subsetFailureRate > 0.05 || subsetFailures.length > 0 ? 'FAIL (>5% subset failure rate or any subset red)' : 'PASS'}
- Milkdown fallback decision: ${summary.milkdownFallbackTriggered ? 'TRIGGERED' : 'NOT TRIGGERED'}

## Exact Failures

${failures.length === 0 ? '- None' : failures.map((result) => `- \`${result.fixture}\`: expected \`${result.expectedKind}\`, actual \`${result.actualKind}\`; ${result.notes}`).join('\n')}

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

## Known Issue Coverage

- BlockNote #1762 blockquote: covered by \`07-blockquote-1762__subset.md\`.
- BlockNote #826 checklist: covered by \`06-task-list-826__subset.md\`.

## Implementation Recommendation

${
  summary.milkdownFallbackTriggered
    ? 'Do not adopt BlockNote as the default markdown-truth editor for Reo Note Foundation without a second editor evaluation. Start the Milkdown fallback evaluation because at least one subset fixture failed the BlockNote round-trip gate.'
    : 'BlockNote can remain the first candidate for the Notion-like adapter, but only behind the subset/raw gate. Persist Markdown/frontmatter only, never BlockNote JSON.'
}
`;
}

function parseMarkdown(markdown) {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

function normalizeMarkdownAst(markdown) {
  const tree = parseMarkdown(markdown);
  stripPositions(tree);
  stripGeneratedIds(tree);
  return tree;
}

function stripPositions(node) {
  if (node && typeof node === 'object') {
    delete node.position;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(stripPositions);
      } else if (value && typeof value === 'object') {
        stripPositions(value);
      }
    }
  }
}

function stripGeneratedIds(node) {
  if (node && typeof node === 'object') {
    delete node.identifier;
    delete node.label;
  }
}

function visit(node, visitor) {
  visitor(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach((child) => {
        if (child && typeof child.type === 'string') {
          visit(child, visitor);
        }
      });
    }
  }
}

function isAttachmentPath(url = '') {
  return /^attachments\/[A-Za-z0-9._/-]+$/.test(url) && !url.includes('..');
}

function hasUnsupportedLinkScheme(url = '') {
  if (/^(https?:|mailto:)/i.test(url)) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return true;
  }
  return false;
}

function isAllowedAttachmentImgHtml(value = '') {
  return /^<img\s+[^>]*src=["']attachments\/[^"']+["'][^>]*\/?>$/i.test(value.trim());
}

function installDom() {
  if (globalThis.document) {
    return;
  }
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
}

async function readPackageVersions() {
  const packageJson = JSON.parse(await fs.readFile(path.join(dirname, 'package.json'), 'utf8'));
  const names = Object.keys(packageJson.dependencies ?? {}).sort();
  const versions = {};
  for (const name of names) {
    const dependencyPackage = JSON.parse(
      await fs.readFile(path.join(dirname, 'node_modules', name, 'package.json'), 'utf8')
    );
    versions[name] = dependencyPackage.version;
  }
  return versions;
}

function formatRate(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function oneLine(value) {
  return JSON.stringify(value.replace(/\n/g, '\\n'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
