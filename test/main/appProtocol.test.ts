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
    assert.ok(value !== null, `Expected boolean privilege for ${name}`);
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

function readObjectArgumentPropertiesForCall(
  filePath: string,
  callName: string
): ReadonlyMap<string, string> {
  const sourceText = readFileSync(filePath, 'utf8');
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const properties = new Map<string, string>();

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === callName
    ) {
      const firstArg = node.arguments[0];
      assert.ok(firstArg && ts.isObjectLiteralExpression(firstArg));
      for (const property of firstArg.properties) {
        assert.ok(ts.isPropertyAssignment(property));
        const name = propertyNameToText(property.name);
        assert.ok(name);
        assert.ok(ts.isIdentifier(property.initializer));
        properties.set(name, property.initializer.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return properties;
}

test('privileged schemes register reo-app, reo-attachment, and reo-artifact before app ready', () => {
  const indexSource = readFileSync('src/main/index.ts', 'utf8');
  const schemeRegistrationIndex = indexSource.indexOf('registerAppShellScheme();');
  const readyIndex = indexSource.indexOf('whenReady()');

  assert.notEqual(schemeRegistrationIndex, -1);
  assert.notEqual(readyIndex, -1);
  assert.ok(schemeRegistrationIndex < readyIndex);

  const schemes = readPrivilegedSchemes();
  assert.deepEqual([...schemes.keys()].sort(), ['reo-app', 'reo-artifact', 'reo-attachment']);

  const appScheme = schemes.get('reo-app');
  assert.equal(appScheme?.privileges.get('secure'), true);
  assert.equal(appScheme?.privileges.get('standard'), true);

  const attachmentScheme = schemes.get('reo-attachment');
  assert.equal(attachmentScheme?.privileges.get('secure'), true);
  assert.equal(attachmentScheme?.privileges.get('supportFetchAPI'), true);
  assert.equal(attachmentScheme?.privileges.get('corsEnabled'), true);
  assert.equal(attachmentScheme?.privileges.get('stream'), true);

  const artifactScheme = schemes.get('reo-artifact');
  assert.equal(artifactScheme?.privileges.get('secure'), true);
  assert.equal(artifactScheme?.privileges.get('standard'), true);
  assert.equal(artifactScheme?.privileges.get('supportFetchAPI'), true);
  assert.equal(artifactScheme?.privileges.get('stream'), true);
});

test('main bootstrap wires attachment and artifact protocol roots to the active workspace', () => {
  const protocolOptions = readObjectArgumentPropertiesForCall(
    'src/main/index.ts',
    'registerAppShellProtocolWithOptions'
  );

  assert.equal(
    protocolOptions.get('resolveAttachmentRoot'),
    'resolveActiveWorkspaceRootForProtocol'
  );
  assert.equal(protocolOptions.get('resolveArtifactRoot'), 'resolveActiveWorkspaceRootForProtocol');
});

test('attachment protocol response keeps attachments no-store and caches versioned covers', () => {
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');

  assert.match(sourceText, /new Response\(resolved\.bytes,/);
  assert.match(sourceText, /ATTACHMENT_PROTOCOL_NO_STORE_CACHE_CONTROL = 'no-store'/);
  assert.match(sourceText, /MEMORY_COVER_PROTOCOL_CACHE_CONTROL = 'max-age=31536000, immutable'/);
  assert.match(sourceText, /cacheControl: MEMORY_COVER_PROTOCOL_CACHE_CONTROL/);
  assert.match(sourceText, /cacheControl: ATTACHMENT_PROTOCOL_NO_STORE_CACHE_CONTROL/);
  assert.match(sourceText, /'Cache-Control': resolved\.cacheControl/);
  assert.equal(sourceText.includes('resolved.absolutePath'), false);
  assert.equal(sourceText.includes('net.fetch(pathToFileURL(resolved'), false);
});

test('cover protocol responses allow canvas sampling without widening ordinary attachments', () => {
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');

  assert.match(sourceText, /coverCanvasAccess: true/);
  assert.match(sourceText, /coverCanvasAccess: false/);
  assert.match(sourceText, /resolveCoverCanvasAccessOrigin/);
  assert.match(sourceText, /'Access-Control-Allow-Origin'/);
  assert.match(sourceText, /origin === APP_SHELL_ORIGIN/);
  assert.match(sourceText, /origin === devServerOrigin/);
});

test('attachment protocol path decoding safely denies malformed percent escapes', () => {
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');

  assert.match(sourceText, /function decodeAttachmentPathSegments/);
  assert.match(sourceText, /decodeURIComponent/);
  assert.match(sourceText, /catch\s*{\s*return null;\s*}/);
});

test('attachment protocol has an explicit Memory cover route without broadening fetch access', () => {
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');

  assert.match(sourceText, /segments\[0\]\s*!==\s*'segments'/);
  assert.match(sourceText, /segments\[0\]\s*===\s*'memories'/);
  assert.match(sourceText, /resolveMemoryCoverFile/);
  assert.equal(sourceText.includes('connect-src reo-attachment'), false);
});

test('attachment protocol has an explicit Segment cover route before note attachments', () => {
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');
  const segmentCoverRoute = sourceText.indexOf("segments.length === 4 && segments[2] === 'cover'");
  const noteAttachmentRoute = sourceText.indexOf('segments.length === 3');

  assert.notEqual(segmentCoverRoute, -1);
  assert.notEqual(noteAttachmentRoute, -1);
  assert.ok(segmentCoverRoute < noteAttachmentRoute);
  assert.match(sourceText, /resolveSegmentCoverFile/);
  assert.match(sourceText, /cacheControl: MEMORY_COVER_PROTOCOL_CACHE_CONTROL/);
});

test('artifact protocol handler is isolated from attachment protocol and returns CSP headers', () => {
  const sourceText = readFileSync('src/main/appProtocol.ts', 'utf8');

  assert.match(sourceText, /protocol\.handle\(ARTIFACT_SCHEME/);
  assert.match(sourceText, /request\.method !== 'GET'/);
  assert.match(sourceText, /resolveArtifactProtocolRequest/);
  assert.match(sourceText, /'Cache-Control': resolved\.cacheControl/);
  assert.match(sourceText, /'Content-Security-Policy': resolved\.contentSecurityPolicy/);
  assert.match(sourceText, /'Content-Type': resolved\.mimeType/);
  assert.equal(sourceText.includes('connect-src reo-artifact'), false);
});
