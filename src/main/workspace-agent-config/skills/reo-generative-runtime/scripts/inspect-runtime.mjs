#!/usr/bin/env node
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const targetArg = process.argv[2] ?? ".";
const root = process.cwd();
const rootReal = await realpath(root);
const target = path.resolve(root, targetArg);
const relative = path.relative(root, target);

function insideRoot(realPath) {
  const realRelative = path.relative(rootReal, realPath);
  return !realRelative.startsWith("..") && !path.isAbsolute(realRelative);
}

async function readText(fileName) {
  try {
    const filePath = path.join(target, fileName);
    const stats = await lstat(filePath);
    return stats.isFile() && !stats.isSymbolicLink() ? await readFile(filePath, "utf8") : null;
  } catch {
    return null;
  }
}

let ok = true;
try {
  const stats = await lstat(target);
  ok = !relative.startsWith("..") && !path.isAbsolute(relative) && !relative.split(path.sep).includes(".reo") && stats.isDirectory() && !stats.isSymbolicLink() && insideRoot(await realpath(target));
} catch {
  ok = false;
}

const entry = ok ? await readText("entry.html") : null;
const runtimeText = ok ? await readText("runtime.json") : null;
const stateText = ok ? await readText("state.json") : null;
let runtime = null;
let state = null;
try { runtime = runtimeText ? JSON.parse(runtimeText) : null; } catch {}
try { state = stateText ? JSON.parse(stateText) : null; } catch {}
let assets = [];
try { assets = (await readdir(path.join(target, "assets"), { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort(); } catch {}
const report = {
  ok: ok && !!entry && !!runtime && !!state,
  tool: "inspect-runtime",
  target: relative || ".",
  title: runtime && typeof runtime.title === "string" ? runtime.title : null,
  template: runtime && typeof runtime.template === "string" ? runtime.template : null,
  usesBridge: !!entry && /reo-render:\/\/vendor\/reo-render\/bridge\.js/.test(entry),
  files: { entry: !!entry, runtime: !!runtime, state: !!state, assets },
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
