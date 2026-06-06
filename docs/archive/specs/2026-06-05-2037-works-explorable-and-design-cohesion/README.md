# 作品/Widget 技能升级：explorable 能力 + 设计系统融合 + 信息架构

Timezone: America/Los_Angeles
创建：2026-06-05 2037 PDT
Initiative：`docs/initiatives/2026-06-03-agent-created-works/`（active）

## 意图

把 Reo 托管的作品/Widget 生成技能（`reo-works`、`reo-works-design`、`reo-generative-runtime`）升级到「可探索解释（explorable）」水准，参照 ngrok quantization 文章那类交互图表的实现机制；同时修正技能内的设计系统使其忠实融合真实 Reo，并按渐进披露重排技能文档与记忆空间 `AGENTS.md` 的结构与逻辑。

这是 initiative 完成条件中「Reo 管理的 skill 群直接包含 prompt、模板、token、脚本和设计规则」「用户 agent 能快速创建可运行作品」两条的质量推进，不新增挂载点（M4+ 范畴另排）。

## 背景事实（已核对）

- 技能源不是磁盘 SKILL.md，而是 `src/main/workspaceFiles.ts` 里的字符串常量，由 `ensureWorkspaceManagedAgentConfig` + `writeManagedReferenceFiles` 物化进每个记忆空间的 `skills/`。
- `docs/current/architecture.md:60` 只枚举技能**目录**，不枚举内部 reference/example 文件 → 新增 `examples/` 子树不触达 docs/current 跟踪粒度。
- 采用「混合」交付（已定）：模型文档 + 可运行黄金范例 bundle；**不**引入 vendored JS 库 → 不动 `resources/artifact-vendor`、protocol、CSP、docs/current。
- 关键发现：`reo-works-design` 现写死的「Reo 设计系统」与真实 app `src/renderer/src/theme.css` 严重不一致（暖灰 vs 冷 zinc、自造 c-\* 强调色阶在 app 不存在、圆角错位、body 16 vs 14、字重两档 vs 四档、丢失 Waldenburg/Inter、一刀切禁效果而 app 实用 shadow-float/brand-gradient）。该「禁一切效果」还与既有设计哲学（干净=排版+层级、效果缩小不丢）冲突。

## ngrok 交互图表的实现机制（升级所依据的模型）

所有图表共用同一台机器，也是本仓库 UI/动画红线要求的「严谨最小数学模型」：

```
sourceState   ──（1~2 个独立源变量）
   │ derive()   纯函数：前向传播 / 最近可表示值 / 重合度 / 留存
   ▼
derivedModel
   │ render()   投影到 SVG / DOM / canvas
   ▼
projection ──（slider / 位点击 / stepper / 缩放 事件 → 改 source → 重渲染）
```

技术实现：内联 SVG（精确图）、`<input type=range>`、纯 vanilla JS 反应式回路、canvas 仅用于密集曲线、CSS 过渡 <200ms。每个图都可落成自包含单文件 `entry.html` —— 正是作品 bundle 形态。

## 决策（已与用户对齐）

1. 交付形态：模型文档 + 黄金范例 bundle（混合）。
2. 覆盖范围：作品 + 右栏 Widget 都升级；含一个窄栏 Widget 范例变体。
3. 范例取向：机制骨架 + Reo 场景外皮（表达记忆内容，非空泛 demo）。
4. 设计真源：以 `theme.css` 为**结构地基**（surface/zinc/radius/字阶/字体/缩小版阴影），**保留** skill 自己的强调色阶（`c-purple/teal/coral/pink` 等）——品牌色 red/magenta/ember 保留给 Reo 品牌，不作作品强调色。
5. 效果哲学：干净=排版+层级；效果按 Reo 真实强度缩小保留，不再一刀切禁止。
6. 创造力原则：模板/token/范例/复杂度预算全是**默认起点，不是天花板**，不约束 agent 想象力与创造力。

### 硬边界 vs 软默认（重写语气依据）

| 硬边界（不可破）                                                  | 软默认（明确可超越，鼓励创造）                  |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| 沙箱安全：禁 Node/Electron/raw path/`file://`/symlink/`.reo` 内部 | 模块清单（diagram/chart/interactive… 只是起点） |
| 文件与 state 合同、可运行、`window.reo` 边界                      | 复杂度预算（为可读性的默认值，有理由可突破）    |
| 数字格式化、窄栏不溢出                                            | 具体模板与布局模式                              |
| 作品要表达记忆内容（非通用壁纸）                                  | token 调色板（可按色阶逻辑派生新强调色）        |
| 与 Reo 视觉**融合**（不外星化）                                   | 效果强度、动画、版式野心                        |

写法用 skill-creator 方式：解释 why、少用全大写 MUST、把默认讲成「替你铺好的起点，可以走更远」。

## 三根支柱

### 支柱 2 · 设计系统融合（地基，先做）

作品仍内联自带一份 token（跨源 iframe 拿不到宿主变量），但**值**忠实投影 Reo：

| 维度      | 改为（Reo 真值，light / dark）                                                               |
| --------- | -------------------------------------------------------------------------------------------- |
| surface   | `#fff/#f4f4f5/#ebebed` ／ `#09090b/#18181b/#1f1f23`                                          |
| 文字      | `#18181b/#3f3f46/#71717a` ／ `#fafafa/#d4d4d8/#a1a1aa`（zinc）                               |
| 圆角      | sm 8 / md 12 / lg 16（对齐 theme.css）                                                       |
| 字体      | `'Waldenburg','Inter',…`；阅读型可用 `'Songti SC'` serif                                     |
| 字阶/字重 | ui 12/13、body 14、body-lg 16、subheading 18、heading 20+；字重 300–600                      |
| 效果      | 缩小版 `--shadow-card`（shadow-float 的克制投影），禁发光/噪点，渐变仅极淡品牌场景           |
| 强调色    | **保留** skill 的 `c-purple/teal/coral/pink` + 语义 blue/green/amber/red；品牌色不入作品强调 |

改 `DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS`、`*_TOKEN_CSS_MARKDOWN_LINES`、`DEFAULT_REO_WORKS_DESIGN_CORE_REFERENCE_MD` 及 SKILL.md 的排版/效果/色阶段落。

### 支柱 1 · explorable 能力（建在修正后的系统上）

- 新增 `skills/reo-works-design/references/explorables.md`：源状态→derive→render 反应式模型 + 5 机制（双向绑定 / 派生链 / 数轴最近值映射 / 缩放坐标变换 / 分布叠加+实时度量），各配最小骨架、a11y、数字格式化、对应范例、坐标系约定。
- 5 个黄金范例（自包含单文件 `entry.html`，机制骨架 + Reo 外皮，≤~6KB，明确「这是起点，可改写超越」）：

| 文件                    | 机制（ngrok 对应）           | Reo 外皮                                          |
| ----------------------- | ---------------------------- | ------------------------------------------------- |
| `reactive-binding.html` | 双向绑定（int8 位）          | 复习强度 slider↔stepper↔下次复习日 同步           |
| `derive-chain.html`     | 派生链（前向传播）           | 计划 what-if：每日时长→总周数/完成日/里程碑       |
| `number-line.html`      | 数轴最近值映射（float 对照） | 目标值→最近里程碑分档，拖拽+键盘导航              |
| `zoomable-series.html`  | 缩放变换+实时度量（sine/KL） | 进度曲线 1×/4×/16× + 计划vs实际差异度             |
| `rail-widget.html`      | 反应式模型在窄栏常驻         | 今日复习进度小组件（响应式 viewBox、min-width:0） |

视觉/交互基准 = 已验收原型「间隔复习留存曲线」（见 `evidence/`）。

### 支柱 3 · 信息架构（结构层，最后做）

- 按渐进披露重排 `reo-works`/`reo-works-design`/`reo-generative-runtime` 的 SKILL.md 与 references 的层级、描述、逻辑；优化 frontmatter `description` 的触发性。
- 重排记忆空间受管 `AGENTS.md`（`DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK`）结构与逻辑层级。仓库根 `AGENTS.md`/`.claude/CLAUDE.md` 是项目自身，本 spec 不改。
- `reo-generative-runtime` templates/SKILL 把 explorable 做成一等模板并加窄栏 Widget 提示；`reo-works` 加 explorable/范例指引。

## 编辑落点

- `src/main/workspaceFiles.ts`：token 常量、`DEFAULT_REO_WORKS_DESIGN_SKILL_MD`、`*_CORE/_MODULES/_INTERACTIONS/_CHARTS/_SVG_DIAGRAMS_REFERENCE_MD`、新增 `*_EXPLORABLES_REFERENCE_MD` 并注册进 `DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES`；`DEFAULT_REO_WORKS_SKILL_MD`、runtime templates/SKILL；`DEFAULT_WORKSPACE_AGENTS_MANAGED_BLOCK`；`ensureWorkspaceManagedAgentConfig` 增 `examples/` 受管目录 + 一次 `writeManagedReferenceFiles`。
- 新模块 `src/main/worksDesignExamples.ts`：导出 `DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES`（flat map `<name>.html`→内容），避免继续撑大 3580 行的 workspaceFiles.ts。
- 测试：`test/main/workspaceIpc.test.ts`（断言 examples 物化、AGENTS 块变化、新 reference 存在）等受影响断言。
- 不改：docs/current、protocol、CSP、vendor bridge。

## 分阶段（每阶段过 /review + /simplify 再推进）

- Phase A 设计系统融合：token 重写 + core-design-system + SKILL 设计/效果/排版规则。验证：用新 token 重渲染原型与一份样例作品，确认原生融合。
- Phase B explorable：explorables.md + 5 范例 + worksDesignExamples.ts + seeding + 测试。验证：物化进测试记忆空间、逐个打开截图、对每个 `validate-runtime.mjs` 通过。
- Phase C 信息架构：重排各 SKILL/references 层级与描述、runtime explorable+widget、reo-works 指引、AGENTS 受管块。验证：skill-creator 评测环（子 agent「升级后 vs 现状」各对 2–3 个真实 prompt 生成作品，渲染对比）。

## 验证

- 阶段内：targeted `node:test`（物化/seeding）、`typecheck:quick`、运行时视觉验证（渲染范例截图）。
- 收口：`npm run verify:quick` 一次。
- E2E 不一次性大测；按状态机拆小场景断言副作用（文件物化、AGENTS 块、preview version、范例可运行）。

## 非目标

- 不引入 vendored runtime JS 库；不动 protocol/CSP/vendor/docs/current。
- 不放松沙箱/安全边界，不把性能做成 runtime 门禁。
- 不改仓库根 `AGENTS.md`/`.claude/CLAUDE.md`。
- 不新增 widget 挂载点（M4+ 另排）。

## 收口

- 长期结论（设计系统真源对齐方式、explorable 反应式模型为一等能力）压回 `docs/current/*` 或 `docs/decisions/*`（仅当确为稳定跨任务事实）。
- 更新 initiative `tasks.md` 状态与下一步；spec 证据移入 `docs/archive/specs/*`。
