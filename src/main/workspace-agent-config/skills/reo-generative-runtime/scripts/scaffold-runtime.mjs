#!/usr/bin/env node
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import path from 'node:path';

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const targetArg = process.argv[2];
if (!targetArg || targetArg.startsWith("--")) {
  console.error("Usage: scaffold-runtime.mjs <target-directory> --title <title> --template <family>");
  process.exit(1);
}

const root = process.cwd();
const rootReal = await realpath(root);
const target = path.resolve(root, targetArg);
const relative = path.relative(root, target);

function isInsideRoot(realPath) {
  const realRelative = path.relative(rootReal, realPath);
  return !realRelative.startsWith("..") && !path.isAbsolute(realRelative);
}

async function nearestExistingAncestor(start) {
  let current = start;
  while (true) {
    try {
      await lstat(current);
      return current;
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

async function assertSafeTarget() {
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep).includes(".reo")) {
    throw new Error("Target must be inside the memory space and outside .reo.");
  }
  const ancestor = await nearestExistingAncestor(target);
  if (!isInsideRoot(await realpath(ancestor))) {
    throw new Error("Target must stay inside the memory space.");
  }
  try {
    const stats = await lstat(target);
    if (stats.isSymbolicLink()) throw new Error("Target must not be a symlink.");
    if (!stats.isDirectory()) throw new Error("Target must be a directory.");
    if (!isInsideRoot(await realpath(target))) throw new Error("Target must stay inside the memory space.");
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
}

try {
  await assertSafeTarget();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Target must be inside the memory space and outside .reo.");
  process.exit(1);
}

const title = argValue("--title", path.basename(target));
const template = argValue("--template", "custom");
await mkdir(path.join(target, "assets"), { recursive: true });
try {
  await assertSafeTarget();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Target must be inside the memory space and outside .reo.");
  process.exit(1);
}

async function writeNoReplace(filePath, text) {
  let handle;
  try {
    handle = await open(filePath, "wx");
    await handle.writeFile(text);
  } catch (error) {
    if (error && error.code === "EEXIST") return false;
    throw error;
  } finally {
    await handle?.close();
  }
  return true;
}

function templateConfig(name) {
  const key = String(name || "custom").toLowerCase();
  const configs = {
    report: { id: "report", heading: "报告", summary: "把材料整理成清楚的段落、证据和下一步。", sections: ["重点", "证据", "下一步"] },
    explainer: { id: "explainer", heading: "解释器", summary: "用一个小例子把概念讲清楚。", sections: ["这个是什么", "为什么重要", "试试看"] },
    dashboard: { id: "dashboard", heading: "看板", summary: "用指标、列表和行动项快速看全局。", sections: ["指标", "趋势", "行动"] },
    editor: { id: "editor", heading: "编辑器", summary: "留下一个可以继续填写和整理的工作区。", sections: ["草稿", "检查", "完成"] },
    "spaced-review": { id: "spaced-review", heading: "复习表", summary: "安排今天、明天和本周要回顾的内容。", sections: ["今天", "明天", "本周"] },
    todo: { id: "todo", heading: "待办", summary: "记录下一步，并能在作品里勾选完成。", sections: ["今天", "以后", "完成"] },
    game: { id: "game", heading: "小游戏", summary: "用一个轻量互动帮助回顾和判断。", sections: ["问题", "选择", "结果"] },
    gallery: { id: "gallery", heading: "画廊", summary: "用一组卡片保存可继续扩展的材料。", sections: ["片段", "主题", "补充"] },
    map: { id: "map", heading: "地图", summary: "把关系、阶段或路径放到同一张图上。", sections: ["起点", "连接", "终点"] },
    prototype: { id: "prototype", heading: "原型", summary: "做一个可点击的简单流程。", sections: ["入口", "步骤", "结果"] },
    "data-tool": { id: "data-tool", heading: "数据工具", summary: "输入一个数字或文本，马上看到计算结果。", sections: ["输入", "计算", "结果"] },
    custom: { id: "custom", heading: "作品", summary: "一个可以被 agent 继续改写的本地 Web app。", sections: ["内容", "状态", "下一步"] },
  };
  return configs[key] || configs.custom;
}

function initialState(config) {
  if (config.id === "todo") {
    return { schemaVersion: 1, stores: { ui: { filter: "all" }, data: { items: [] }, progress: { completed: 0 }, draft: { text: "" } } };
  }
  return { schemaVersion: 1, stores: { ui: { selected: config.sections[0] }, data: { sections: config.sections }, progress: {}, draft: {} } };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
  });
}

function bodyForTemplate(config) {
  if (config.id === "todo") {
    return `<form id="todo-form" class="toolbar"><input id="todo-input" placeholder="写下一件事"><button type="submit">新增一项</button></form><ul id="todo-list" class="list"></ul>`;
  }
  if (config.id === "dashboard") {
    return `<div class="metrics"><div><span>已整理</span><strong>3</strong></div><div><span>待处理</span><strong>2</strong></div><div><span>下一步</span><strong>1</strong></div></div>`;
  }
  return `<div class="grid">${config.sections.map(function (section) { return `<section class="panel"><h2>${escapeHtml(section)}</h2><p>把和「${escapeHtml(section)}」有关的内容放在这里，后续可以继续改写。</p></section>`; }).join("")}</div>`;
}

const BASE_CSS = ":root {\n  --color-background-primary: #ffffff;\n  --color-background-secondary: #f4f4f5;\n  --color-background-tertiary: #ebebed;\n  --color-background-info: #e6f1fb;\n  --color-background-danger: #fcebeb;\n  --color-background-success: #eaf3de;\n  --color-background-warning: #faeeda;\n  --color-text-primary: #18181b;\n  --color-text-secondary: #3f3f46;\n  --color-text-tertiary: #71717a;\n  --color-text-info: #0c447c;\n  --color-text-danger: #791f1f;\n  --color-text-success: #27500a;\n  --color-text-warning: #633806;\n  --color-border-tertiary: rgba(24, 24, 27, 0.08);\n  --color-border-secondary: rgba(24, 24, 27, 0.14);\n  --color-border-primary: rgba(24, 24, 27, 0.22);\n  --font-sans: \"Waldenburg\", \"Inter\", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n  --font-serif: \"Songti SC\", \"Noto Serif CJK SC\", ui-serif, Georgia, Cambria, \"Times New Roman\", serif;\n  --font-mono: \"Geist Mono\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", monospace;\n  --border-radius-sm: 8px;\n  --border-radius-md: 12px;\n  --border-radius-lg: 16px;\n  --border-radius-xl: 20px;\n  --shadow-card: 0 1px 2px rgba(17, 24, 39, 0.04), 0 2px 8px rgba(17, 24, 39, 0.05);\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    --color-background-primary: #09090b;\n    --color-background-secondary: #18181b;\n    --color-background-tertiary: #1f1f23;\n    --color-background-info: #0c447c;\n    --color-background-danger: #791f1f;\n    --color-background-success: #27500a;\n    --color-background-warning: #633806;\n    --color-text-primary: #fafafa;\n    --color-text-secondary: #d4d4d8;\n    --color-text-tertiary: #a1a1aa;\n    --color-text-info: #b5d4f4;\n    --color-text-danger: #f7c1c1;\n    --color-text-success: #c0dd97;\n    --color-text-warning: #fac775;\n    --color-border-tertiary: rgba(255, 255, 255, 0.10);\n    --color-border-secondary: rgba(255, 255, 255, 0.16);\n    --color-border-primary: rgba(255, 255, 255, 0.24);\n    --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 2px 10px rgba(0, 0, 0, 0.34);\n  }\n}\n";

function styleCss() {
  return BASE_CSS + `body{margin:0;font-family:var(--font-sans);background:var(--color-background-primary);color:var(--color-text-primary);padding:24px;line-height:1.6}main{max-width:820px;margin:0 auto}h1{font-size:22px;font-weight:500;margin:0 0 8px}h2{font-size:16px;font-weight:500;margin:0 0 6px}.lead{color:var(--color-text-secondary);margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.panel,.metrics>div{background:var(--color-background-secondary);border-radius:var(--border-radius-lg);padding:16px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.metrics span{display:block;color:var(--color-text-secondary);font-size:13px}.metrics strong{font-size:24px;font-weight:500}.toolbar{display:flex;gap:8px;margin:16px 0}.toolbar input{flex:1;min-width:0;border:0;background:var(--color-background-secondary);color:var(--color-text-primary);border-radius:var(--border-radius-md);padding:10px 12px}.toolbar input::placeholder{color:var(--color-text-tertiary)}.toolbar button,.list button{border:0;border-radius:var(--border-radius-md);background:var(--color-text-primary);color:var(--color-background-primary);padding:10px 12px}.list{list-style:none;padding:0;margin:0;display:grid;gap:8px}.list li{display:flex;align-items:center;justify-content:space-between;background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:10px 12px}`;
}

function entryHtml(title, config) {
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${escapeHtml(title)}</title>\n  <style>${styleCss()}</style>\n</head>\n<body data-template="${config.id}">\n  <main>\n    <h1>${escapeHtml(title)}</h1>\n    <p class="lead">${escapeHtml(config.summary)}</p>\n    ${bodyForTemplate(config)}\n  </main>\n  <script src="reo-render://vendor/reo-render/bridge.js"></script>\n  <script>\n    (function(){\n      var currentVersion = null;\n      var state = { schemaVersion: 1, stores: { data: { items: [] } } };\n      function items(){ return ((state.stores || {}).data || {}).items || []; }\n      function render(){ var list = document.getElementById("todo-list"); if (!list) return; list.textContent = ""; items().forEach(function(item, index){ var row = document.createElement("li"); var label = document.createElement("span"); var button = document.createElement("button"); label.textContent = String(item && item.text ? item.text : ""); button.type = "button"; button.setAttribute("data-index", String(index)); button.textContent = item && item.done ? "已完成" : "完成"; row.appendChild(label); row.appendChild(button); list.appendChild(row); }); }\n      function save(next){ if (!window.reo || !currentVersion) { state = next; render(); return Promise.resolve(); } return window.reo.state.write(next, { baselineVersion: currentVersion }).then(function(result){ if (result.status === "saved") { state = result.state; currentVersion = result.version; } else if (result.status === "stale") { state = result.currentState; currentVersion = result.currentVersion; } render(); }).catch(function(){ state = next; render(); }); }\n      window.reo?.state?.read?.().then(function(snapshot){ state = snapshot.state || state; currentVersion = snapshot.version; render(); }).catch(render);\n      document.addEventListener("submit", function(event){ if (event.target && event.target.id === "todo-form") { event.preventDefault(); var input = document.getElementById("todo-input"); var text = input && input.value ? input.value.trim() : ""; if (!text) return; if (input) input.value = ""; var next = Object.assign({}, state, { stores: Object.assign({}, state.stores, { data: { items: items().concat([{ text: text, done: false }]) } }) }); void save(next); } });\n      document.addEventListener("click", function(event){ var button = event.target && event.target.closest ? event.target.closest("[data-index]") : null; if (!button) return; var index = Number(button.getAttribute("data-index")); var nextItems = items().map(function(item, itemIndex){ return itemIndex === index ? Object.assign({}, item, { done: !item.done }) : item; }); var next = Object.assign({}, state, { stores: Object.assign({}, state.stores, { data: { items: nextItems }, progress: { completed: nextItems.filter(function(item){ return item.done; }).length } }) }); void save(next); });\n    })();\n  </script>\n</body>\n</html>\n`;
}

const config = templateConfig(template);
const runtimeManifest = {
  schemaVersion: 1,
  title,
  entry: "entry.html",
  template: config.id,
  state: { schemaVersion: 1, stores: ["ui", "data", "progress", "draft"] },
  bridge: { needs: ["state"] },
};
await writeNoReplace(path.join(target, "runtime.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
await writeNoReplace(path.join(target, "state.json"), `${JSON.stringify(initialState(config), null, 2)}\n`);
await writeNoReplace(path.join(target, "entry.html"), entryHtml(title, config));
console.log(JSON.stringify({ ok: true, target: relative || ".", template: config.id }, null, 2));
