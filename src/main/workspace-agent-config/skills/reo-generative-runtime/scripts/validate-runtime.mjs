#!/usr/bin/env node
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const toolName = "validate-runtime";
const targetArg = process.argv[2] ?? ".";
const root = process.cwd();
const rootReal = await realpath(root);
const target = path.resolve(root, targetArg);
const relative = path.relative(root, target);
const issues = [];
let targetUsable = true;

function add(code, file, message) { issues.push({ code, file, message }); }
function lexicalInsideRoot() { return !relative.startsWith("..") && !path.isAbsolute(relative); }
function realInsideRoot(realPath) {
  const realRelative = path.relative(rootReal, realPath);
  return !realRelative.startsWith("..") && !path.isAbsolute(realRelative);
}
function validateInlineScripts(html) {
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1] || "";
    const source = match[2] || "";
    const typeMatch = attrs.match(/\btype\s*=\s*["\']?([^"\'\s>]+)/i);
    const type = typeMatch ? typeMatch[1].split(";")[0].trim().toLowerCase() : "";
    if (/\bsrc\s*=/i.test(attrs) || source.trim().length === 0) continue;
    if (type && type !== "text/javascript" && type !== "application/javascript") continue;
    try {
      new Function(source);
    } catch (error) {
      add("entry-script-syntax", "entry.html", `Inline script must parse: ${error && error.message ? error.message : String(error)}.`);
      return;
    }
  }
}

async function readRequired(fileName) {
  const filePath = path.join(target, fileName);
  try {
    const stats = await lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) { add("not-file", fileName, "Expected an ordinary file."); return null; }
    return await readFile(filePath, "utf8");
  } catch (error) {
    add("missing", fileName, "Required runtime file is missing.");
    return null;
  }
}

if (!lexicalInsideRoot() || relative.split(path.sep).includes(".reo")) {
  add("target-outside-root", targetArg, "Target must be inside the memory space and outside .reo.");
  targetUsable = false;
} else {
  try {
    const stats = await lstat(target);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      add("target-not-directory", targetArg, "Target must be an ordinary directory.");
      targetUsable = false;
    } else if (!realInsideRoot(await realpath(target))) {
      add("target-outside-root", targetArg, "Target must stay inside the memory space.");
      targetUsable = false;
    }
  } catch {
    add("target-missing", targetArg, "Target directory is missing.");
    targetUsable = false;
  }
}

const entry = targetUsable ? await readRequired("entry.html") : null;
const runtime = targetUsable ? await readRequired("runtime.json") : null;
const state = targetUsable ? await readRequired("state.json") : null;

if (entry && !/<!doctype html>/i.test(entry)) add("entry-not-html-document", "entry.html", "entry.html should be a complete HTML document.");
if (entry && /file:\/\//i.test(entry)) add("file-url", "entry.html", "Copy local resources into assets/ instead of using file://.");
if (entry && /window\.reo\b/.test(entry) && !/reo-render:\/\/vendor\/reo-render\/bridge\.js/.test(entry)) add("bridge-script-missing", "entry.html", "Load reo-render://vendor/reo-render/bridge.js before using window.reo.");
if (entry) validateInlineScripts(entry);
for (const [fileName, text] of [["runtime.json", runtime], ["state.json", state]]) {
  if (!text) continue;
  try { JSON.parse(text); } catch { add("invalid-json", fileName, "File must parse as JSON."); }
}

if (targetUsable) {
  try {
    const assetsDir = path.join(target, "assets");
    const stats = await lstat(assetsDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) add("assets-not-directory", "assets", "assets/ must be an ordinary directory.");
    else {
      for (const entry of await readdir(assetsDir, { withFileTypes: true })) {
        if (!entry.isFile()) add("asset-not-file", `assets/${entry.name}`, "Assets must be ordinary direct files.");
      }
    }
  } catch {
    add("missing-assets", "assets", "Create assets/ even when it is empty.");
  }
}

const report = { ok: issues.length === 0, tool: toolName, target: relative || ".", issues };
console.log(JSON.stringify(report, null, 2));
process.exit(issues.length === 0 ? 0 : 1);
