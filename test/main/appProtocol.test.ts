import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as ts from 'typescript';

type SchemeRegistration = {
  readonly privileges: ReadonlyMap<string, boolean>;
  readonly scheme: string;
};

function readStringConstants(filePath: string): ReadonlyMap<string, string> {
  const sourceText = readFileSync(filePath, 'utf8');
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const constants = new Map<string, string>();

  function visit(node: ts.Node): void {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          ts.isStringLiteral(declaration.initializer)
        ) {
          constants.set(declaration.name.text, declaration.initializer.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return constants;
}

function propertyNameToText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function readBooleanLiteral(expression: ts.Expression): boolean | null {
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  return null;
}

function readPrivileges(expression: ts.Expression): ReadonlyMap<string, boolean> {
  assert.ok(ts.isObjectLiteralExpression(expression));
  const privileges = new Map<string, boolean>();
  for (const property of expression.properties) {
    assert.ok(ts.isPropertyAssignment(property));
    const name = propertyNameToText(property.name);
    assert.ok(name);
    const value = readBooleanLiteral(property.initializer);
    assert.notEqual(value, null);
    if (value === null) {
      throw new Error(`Expected boolean privilege for ${name}`);
    }
    privileges.set(name, value);
  }
  return privileges;
}

function readSchemeRegistration(
  expression: ts.Expression,
  stringConstants: ReadonlyMap<string, string>
): SchemeRegistration {
  assert.ok(ts.isObjectLiteralExpression(expression));
  let scheme: string | null = null;
  let privileges: ReadonlyMap<string, boolean> | null = null;

  for (const property of expression.properties) {
    assert.ok(ts.isPropertyAssignment(property));
    const name = propertyNameToText(property.name);
    if (name === 'scheme') {
      if (ts.isStringLiteral(property.initializer)) {
        scheme = property.initializer.text;
      }
      if (ts.isIdentifier(property.initializer)) {
        scheme = stringConstants.get(property.initializer.text) ?? null;
      }
    }
    if (name === 'privileges') {
      privileges = readPrivileges(property.initializer);
    }
  }

  assert.ok(scheme);
  assert.ok(privileges);
  return { privileges, scheme };
}

function readPrivilegedSchemes(): ReadonlyMap<string, SchemeRegistration> {
  const stringConstants = readStringConstants('src/main/appShellConstants.ts');
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');
  const source = ts.createSourceFile('appProtocol.ts', sourceText, ts.ScriptTarget.Latest, true);
  const registrations = new Map<string, SchemeRegistration>();

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === 'protocol' &&
      node.expression.name.text === 'registerSchemesAsPrivileged'
    ) {
      const firstArg = node.arguments[0];
      assert.ok(firstArg);
      assert.ok(ts.isArrayLiteralExpression(firstArg));
      for (const element of firstArg.elements) {
        const registration = readSchemeRegistration(element, stringConstants);
        registrations.set(registration.scheme, registration);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return registrations;
}

test('privileged schemes register reo-app and reo-attachment before app ready', () => {
  const indexSource = readFileSync('src/main/index.ts', 'utf8');
  const schemeRegistrationIndex = indexSource.indexOf('registerAppShellScheme();');
  const readyIndex = indexSource.indexOf('whenReady()');

  assert.notEqual(schemeRegistrationIndex, -1);
  assert.notEqual(readyIndex, -1);
  assert.ok(schemeRegistrationIndex < readyIndex);

  const schemes = readPrivilegedSchemes();
  assert.deepEqual([...schemes.keys()].sort(), ['reo-app', 'reo-attachment']);

  const appScheme = schemes.get('reo-app');
  assert.equal(appScheme?.privileges.get('secure'), true);
  assert.equal(appScheme?.privileges.get('standard'), true);

  const attachmentScheme = schemes.get('reo-attachment');
  assert.equal(attachmentScheme?.privileges.get('secure'), true);
  assert.equal(attachmentScheme?.privileges.get('supportFetchAPI'), true);
  assert.equal(attachmentScheme?.privileges.get('corsEnabled'), false);
  assert.equal(attachmentScheme?.privileges.get('stream'), true);
});

test('attachment protocol response serves bytes directly with no-store caching', () => {
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');

  assert.match(sourceText, /new Response\(resolved\.bytes,/);
  assert.match(sourceText, /'Cache-Control': 'no-store'/);
  assert.equal(sourceText.includes('resolved.absolutePath'), false);
  assert.equal(sourceText.includes('net.fetch(pathToFileURL(resolved'), false);
});

test('attachment protocol path decoding safely denies malformed percent escapes', () => {
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');

  assert.match(sourceText, /function decodeAttachmentPathSegments/);
  assert.match(sourceText, /decodeURIComponent/);
  assert.match(sourceText, /catch\s*{\s*return null;\s*}/);
});
