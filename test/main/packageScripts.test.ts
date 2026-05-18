import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

type PackageJson = {
  readonly scripts?: Record<string, string>;
};

async function readPackageScripts(): Promise<Record<string, string>> {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as PackageJson;
  return packageJson.scripts ?? {};
}

function* findFiles(directory: string): Generator<string> {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* findFiles(entryPath);
      continue;
    }
    if (entry.isFile()) {
      yield entryPath.split(path.sep).join('/');
    }
  }
}

type VitestProjectInclude = {
  readonly includes: readonly string[];
  readonly name: string;
};

function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function stringArrayLiteralValues(expression: ts.Expression): string[] {
  if (!ts.isArrayLiteralExpression(expression)) {
    return [];
  }
  return expression.elements.flatMap((element) =>
    ts.isStringLiteralLike(element) ? [element.text] : []
  );
}

function vitestProjectIncludes(config: string): VitestProjectInclude[] {
  const source = ts.createSourceFile('vitest.config.ts', config, ts.ScriptTarget.Latest, true);
  const projects: VitestProjectInclude[] = [];

  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      let name: string | null = null;
      let includes: readonly string[] = [];
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const propertyName = propertyNameText(property.name);
        if (propertyName === 'name' && ts.isStringLiteralLike(property.initializer)) {
          name = property.initializer.text;
        }
        if (propertyName === 'include') {
          includes = stringArrayLiteralValues(property.initializer);
        }
      }
      if (name && includes.length > 0) {
        projects.push({ includes, name });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return projects;
}

function includePatternMatchesPath(pattern: string, file: string): boolean {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? '';
    const nextChar = pattern[index + 1];
    const afterNextChar = pattern[index + 2];
    if (char === '*' && nextChar === '*' && afterNextChar === '/') {
      source += '(?:.*/)?';
      index += 2;
      continue;
    }
    if (char === '*' && nextChar === '*') {
      source += '.*';
      index += 1;
      continue;
    }
    if (char === '*') {
      source += '[^/]*';
      continue;
    }
    source += char.replace(/[\\^$+?.()|[\]{}]/g, '\\$&');
  }
  source += '$';
  return new RegExp(source).test(file);
}

test('verify:quick uses the quick typecheck boundary before main tests compile main code', async () => {
  const scripts = await readPackageScripts();
  const verifyQuickSteps = (scripts['verify:quick'] ?? '').split('&&').map((step) => step.trim());

  assert.deepEqual(verifyQuickSteps, [
    'npm run typecheck:quick',
    'npm run test:main',
    'npm run test:renderer',
    'npm run lint:strict',
    'npm run format:check',
  ]);
  assert.equal(
    scripts['typecheck:quick'],
    'tsc -p tsconfig.json --noEmit && tsc -p tsconfig.electron-vite.json --noEmit'
  );
  assert.match(scripts['test:main'] ?? '', /run-main-tests/);
  assert.equal(scripts['test:renderer'], 'node scripts/run-renderer-tests.mjs');
});

test('complexity scanner script uses the Reo scoped wrapper and excludes generated scopes', async () => {
  const scripts = await readPackageScripts();
  const script = await readFile('scripts/run-complexity-scan.mjs', 'utf8');

  assert.equal(scripts['complexity:scan'], 'node scripts/run-complexity-scan.mjs');
  assert.match(script, /COMPLEXITY_OPTIMIZER_SCANNER/);
  assert.match(script, /complexity-optimizer\/scripts\/analyze_complexity\.py/);
  assert.match(script, /'\.tmp'/);
  assert.match(script, /'\.agents'/);
  assert.match(script, /'\.claude'/);
  assert.match(script, /'out'/);
  assert.match(script, /'archive'/);
});

test('complexity scanner wrapper passes scoped excludes to the configured scanner', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reo-complexity-scan-'));
  try {
    const scannerPath = path.join(directory, 'fake-scanner.py');
    const outputPath = path.join(directory, 'args.json');
    await writeFile(
      scannerPath,
      [
        'import json',
        'import os',
        'import sys',
        "with open(os.environ['REO_COMPLEXITY_SCAN_ARGS_OUT'], 'w', encoding='utf-8') as file:",
        '    json.dump(sys.argv[1:], file)',
        '',
      ].join('\n')
    );

    const result = spawnSync(
      process.execPath,
      ['scripts/run-complexity-scan.mjs', '--max-findings', '3'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          COMPLEXITY_OPTIMIZER_SCANNER: scannerPath,
          REO_COMPLEXITY_SCAN_ARGS_OUT: outputPath,
        },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), [
      '.',
      '--exclude',
      '.tmp',
      '--exclude',
      '.agents',
      '--exclude',
      '.claude',
      '--exclude',
      'out',
      '--exclude',
      'archive',
      '--max-findings',
      '3',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('complexity scanner wrapper reports an actionable missing-scanner error', () => {
  const missingScanner = path.join(tmpdir(), 'reo-missing-complexity-scanner.py');
  const result = spawnSync(process.execPath, ['scripts/run-complexity-scan.mjs'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      COMPLEXITY_OPTIMIZER_SCANNER: missingScanner,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Complexity scanner not found/);
  assert.match(result.stderr, /COMPLEXITY_OPTIMIZER_SCANNER/);
});

test('complexity scanner wrapper propagates scanner failures', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reo-complexity-scan-fail-'));
  try {
    const scannerPath = path.join(directory, 'failing-scanner.py');
    await writeFile(scannerPath, 'import sys\nsys.exit(7)\n');

    const result = spawnSync(process.execPath, ['scripts/run-complexity-scan.mjs'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        COMPLEXITY_OPTIMIZER_SCANNER: scannerPath,
      },
    });

    assert.equal(result.status, 7);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('quick format check excludes archived task evidence while retaining an all-files check', async () => {
  const scripts = await readPackageScripts();
  const formatCheck = scripts['format:check'] ?? '';

  assert.match(formatCheck, /prettier --check/);
  assert.match(formatCheck, /\.claude\/CLAUDE\.md/);
  assert.match(formatCheck, /docs\/specs/);
  assert.match(formatCheck, /vitest\.config\.ts/);
  assert.doesNotMatch(formatCheck, /prettier\.config\.\*/);
  assert.doesNotMatch(formatCheck, /docs\/archive/);
  assert.ok(
    formatCheck.indexOf('--no-error-on-unmatched-pattern') > formatCheck.indexOf('&& prettier')
  );
  assert.ok(
    formatCheck.indexOf('--no-error-on-unmatched-pattern') < formatCheck.indexOf('docs/specs')
  );
  assert.equal(scripts['format:check:all'], 'prettier --check .');
});

test('quick format check tolerates a missing active specs directory', () => {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/prettier/bin/prettier.cjs',
      '--check',
      '--no-error-on-unmatched-pattern',
      'docs/__missing_specs_for_format_check_test__',
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
});

test('main test runner uses a bounded default batch with an explicit environment override', async () => {
  const script = await readFile('scripts/run-main-tests.mjs', 'utf8');

  assert.match(script, /const defaultBatchSize = 64;/);
  assert.match(script, /function readBatchSizeFromEnv\(\)/);
  assert.match(script, /MAIN_TEST_BATCH_SIZE must be 0 or a positive integer/);
  assert.match(script, /MAIN_TEST_FILES/);
  assert.match(script, /readdirSync\(directory, \{ withFileTypes: true \}\)\.sort/);
  assert.doesNotMatch(script, /findTestFiles\(testDir\)\]\.sort/);
  assert.match(script, /const nodeTestArgs = process\.argv\.slice\(2\);/);
  assert.match(script, /filterMainTestFiles\(discoveredTestFiles, process\.env\.MAIN_TEST_FILES\)/);
  assert.match(script, /buildNodeTestArgBatches\(testFiles, batchSize, nodeTestArgs\)/);
});

test('renderer test runner only filters the known Node localStorage warning', async () => {
  const script = await readFile('scripts/run-renderer-tests.mjs', 'utf8');

  assert.match(script, /LOCAL_STORAGE_WARNING/);
  assert.match(script, /Unexpected ExperimentalWarning/);
  assert.doesNotMatch(script, /--disable-warning=ExperimentalWarning/);
});

test('main test runner batch helpers preserve node args and reject invalid batch sizes', async () => {
  const runner = (await import(pathToFileURL(path.resolve('scripts/run-main-tests.mjs')).href)) as {
    readonly buildNodeTestArgBatches: (
      testFiles: readonly string[],
      batchSize: number,
      nodeTestArgs: readonly string[]
    ) => readonly (readonly string[])[];
    readonly filterMainTestFiles: (
      testFiles: readonly string[],
      rawFilters: string | undefined
    ) => readonly string[];
    readonly mainTestFileFilterToCompiledPath: (filePath: string) => string;
    readonly parseMainTestBatchSize: (raw: string | undefined) => number;
    readonly parseMainTestFiles: (raw: string | undefined) => readonly string[];
  };

  assert.equal(runner.parseMainTestBatchSize(undefined), 64);
  assert.equal(runner.parseMainTestBatchSize('0'), 0);
  assert.equal(runner.parseMainTestBatchSize('2'), 2);
  assert.throws(() => runner.parseMainTestBatchSize('1.5'), /MAIN_TEST_BATCH_SIZE/);
  assert.throws(() => runner.parseMainTestBatchSize('-1'), /MAIN_TEST_BATCH_SIZE/);

  assert.deepEqual(
    runner.buildNodeTestArgBatches(['a.test.js', 'b.test.js', 'c.test.js'], 2, [
      '--test-name-pattern=target',
    ]),
    [
      ['--test', '--test-name-pattern=target', 'a.test.js', 'b.test.js'],
      ['--test', '--test-name-pattern=target', 'c.test.js'],
    ]
  );
  assert.deepEqual(runner.buildNodeTestArgBatches(['a.test.js', 'b.test.js'], 0, ['--watch']), [
    ['--test', '--watch', 'a.test.js', 'b.test.js'],
  ]);
  assert.deepEqual(runner.parseMainTestFiles(' test/main/a.test.ts, b.test.js '), [
    'test/main/a.test.ts',
    'b.test.js',
  ]);
  assert.equal(
    runner.mainTestFileFilterToCompiledPath('test/main/packageScripts.test.ts'),
    '.tmp/test-main/test/main/packageScripts.test.js'
  );
  assert.deepEqual(
    runner.filterMainTestFiles(
      [
        '.tmp/test-main/test/main/memoryFiles.test.js',
        '.tmp/test-main/test/main/packageScripts.test.js',
      ],
      'test/main/packageScripts.test.ts'
    ),
    ['.tmp/test-main/test/main/packageScripts.test.js']
  );
  assert.throws(
    () =>
      runner.filterMainTestFiles(
        [
          '.tmp/test-main/test/main/memoryFiles.test.js',
          '.tmp/test-main/test/main/packageScripts.test.js',
        ],
        'test/main/packageScripts.test.ts,test/main/missing.test.ts'
      ),
    /MAIN_TEST_FILES did not match compiled tests/
  );
});

test('renderer test runner filters only the known localStorage warning behaviorally', async () => {
  const runner = (await import(
    pathToFileURL(path.resolve('scripts/run-renderer-tests.mjs')).href
  )) as {
    readonly classifyRendererTestStderrLine: (
      line: string,
      suppressNextTraceHint: boolean
    ) => {
      readonly nextSuppressTraceHint: boolean;
      readonly unexpectedExperimentalWarning: boolean;
      readonly write: boolean;
    };
  };

  assert.deepEqual(
    runner.classifyRendererTestStderrLine(
      'ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.',
      false
    ),
    {
      nextSuppressTraceHint: true,
      unexpectedExperimentalWarning: false,
      write: false,
    }
  );
  assert.deepEqual(
    runner.classifyRendererTestStderrLine('Use `node --trace-warnings ...` to show where', true),
    {
      nextSuppressTraceHint: false,
      unexpectedExperimentalWarning: false,
      write: false,
    }
  );
  assert.deepEqual(
    runner.classifyRendererTestStderrLine('ExperimentalWarning: a new warning', false),
    {
      nextSuppressTraceHint: false,
      unexpectedExperimentalWarning: true,
      write: true,
    }
  );
});

test('vitest separates parallel browser API jsdom tests from serial component jsdom tests', async () => {
  const config = await readFile('vitest.config.ts', 'utf8');

  assert.match(config, /name: 'renderer-jsdom-browser'/);
  assert.match(config, /name: 'renderer-jsdom-components'/);
  assert.match(config, /src\/renderer\/src\/workspace\/audioWaveform\.test\.ts/);
  assert.match(config, /include: \['src\/renderer\/src\/\*\*\/\*\.test\.tsx'\]/);

  const includePaths = vitestProjectIncludes(config)
    .flatMap((project) => project.includes)
    .filter((include) => !include.includes('*'));
  const rendererTsTests = [...findFiles('src/renderer/src')].filter(
    (file) => file.endsWith('.test.ts') && !file.endsWith('.test.tsx')
  );
  const missingTests = rendererTsTests.filter((file) => !includePaths.includes(file));
  const duplicateTests = includePaths.filter(
    (file, index) => file.endsWith('.test.ts') && includePaths.indexOf(file) !== index
  );

  assert.deepEqual(missingTests, []);
  assert.deepEqual(duplicateTests, []);
});

test('vitest assigns each renderer test file to exactly one project', async () => {
  const config = await readFile('vitest.config.ts', 'utf8');
  const projects = vitestProjectIncludes(config);
  const rendererTests = [...findFiles('src/renderer/src')].filter(
    (file) => file.endsWith('.test.ts') || file.endsWith('.test.tsx')
  );

  const memberships = rendererTests.map((file) => {
    const matchingProjects = projects.filter((project) =>
      project.includes.some((include) => includePatternMatchesPath(include, file))
    );
    const count = matchingProjects.length;
    return { count, file };
  });

  assert.deepEqual(
    memberships.filter((membership) => membership.count !== 1),
    []
  );
  assert.deepEqual(
    projects.flatMap((project) =>
      project.includes.filter(
        (include) => include.startsWith('src/renderer/') && !include.startsWith('src/renderer/src/')
      )
    ),
    []
  );
});

test('memory studio layout measurement covers a bounded rendered-item sample with explicit full mode', async () => {
  const script = await readFile('scripts/measure-memory-studio-layout.mjs', 'utf8');

  assert.match(script, /const defaultMaxItems = 24;/);
  assert.match(script, /const maxMountedItems = 96;/);
  assert.match(script, /Too many mounted Segment items/);
  assert.match(script, /maxItems: defaultMaxItems/);
  assert.match(script, /const addIndex = \(index\) =>/);
  assert.match(script, /item\.getAttribute\('aria-current'\) === 'true'/);
  assert.match(script, /item\.offsetLeft/);
  assert.match(script, /item\.offsetWidth/);
  assert.doesNotMatch(script, /rect\.right >= 0 && rect\.left <= window\.innerWidth/);
  assert.match(script, /case '--full':/);
  assert.match(script, /options\.maxItems = undefined/);
});

test('memory studio Segment strip scroll sync keeps layout reads behind refresh paths', async () => {
  const source = await readFile('src/renderer/src/workspace/MemoryStudio.tsx', 'utf8');

  assert.match(source, /const syncScrollState = \(refreshItemStep = false\) =>/);
  assert.match(
    source,
    /if \(refreshItemStep\) \{\s*segmentStripItemStepRef\.current = readSegmentStripItemStep\(element\);/
  );
  assert.match(source, /const scheduleScrollSync = \(\) => scheduleSyncScrollState\(false\);/);
  assert.match(source, /const scheduleResizeSync = \(\) => scheduleSyncScrollState\(true\);/);
  assert.match(
    source,
    /element\.addEventListener\('scroll', scheduleScrollSync, \{ passive: true \}\);/
  );
});

test('titlebar measurement classifies traffic-light pixels in one pass', async () => {
  const script = await readFile('scripts/measure-titlebar-alignment.mjs', 'utf8');

  assert.match(script, /function trafficLightComponents\(pixels, width\)/);
  assert.match(script, /const trafficComponents = trafficLightComponents\(pixels, width\)/);
  assert.match(script, /findComponentsFromActive\(red, width\)/);
});

test('measurement scripts reject missing option values before treating flags as paths', () => {
  const memoryStudio = spawnSync(
    process.execPath,
    ['scripts/measure-memory-studio-layout.mjs', '--metrics', '--json'],
    { encoding: 'utf8' }
  );
  assert.notEqual(memoryStudio.status, 0);
  assert.match(`${memoryStudio.stderr}${memoryStudio.stdout}`, /--metrics requires a value/);

  const titlebar = spawnSync(
    process.execPath,
    ['scripts/measure-titlebar-alignment.mjs', '--image', '--json'],
    { encoding: 'utf8' }
  );
  assert.notEqual(titlebar.status, 0);
  assert.match(`${titlebar.stderr}${titlebar.stdout}`, /--image requires a value/);
});
