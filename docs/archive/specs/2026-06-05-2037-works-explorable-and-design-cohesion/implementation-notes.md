# 实现笔记

按时间顺序记录执行、决策与验证证据。长期结论收口时压回 `docs/current/*` 或 `docs/decisions/*`，过程留此。

## 2026-06-05 对齐与原型

- 完成意图对齐（交付形态=混合、范围=作品+Widget、范例取向=机制骨架+Reo 外皮、设计真源=theme.css 地基+保留强调色、效果=排版+层级缩小保留、创造力=默认非天花板、硬/软边界划分）。
- 核对事实：技能源在 `src/main/workspaceFiles.ts` 常量；seeding 经 `ensureWorkspaceManagedAgentConfig`/`writeManagedReferenceFiles`；`docs/current/architecture.md:60` 不枚举技能内部文件；技能设计系统与 `theme.css` 严重不一致（见 README 背景事实）。
- 归档旧 spec `2026-06-05-0730-workspace-widget-e2e-qa` → `docs/archive/specs/`（已验证收口）。
- 验收原型「间隔复习留存曲线」（`evidence/prototype-retention-curve/entry.html`）：双源滑块→纯 derive(R=e^(-t/S))→render(SVG 曲线+阈值+当前点+下次复习标记+派生卡)。亮/暗均原生融合，作为 Phase A/B 视觉与交互基准。
  - 待正式版微调的语义点：超期时「下次复习」标记落当前点左侧、读数显示「现在」——逻辑对，但标签应改「建议复习点 / 已超期 N 天」。

## 2026-06-05 Phase A 设计系统融合（完成）

改 `src/main/workspaceFiles.ts`：

- `DEFAULT_REO_WORKS_DESIGN_TOKEN_CSS`：结构中性改为 Reo zinc/surface（text #18181b/#3f3f46/#71717a，surface #fff/#f4f4f5/#ebebed；dark #fafafa/#d4d4d8/#a1a1aa，#09090b/#18181b/#1f1f23），border 改 zinc alpha，radius 改 8/12/16/20 并加 `--border-radius-sm`，字体加 Waldenburg/Inter + Songti serif + Geist Mono，新增 `--shadow-card`（light+dark）。保留语义 info/danger/success/warning 与 c-\* 强调色阶值不变。token 变量名全部保留（works 内联私有名，改名无收益且会扩散破坏）。
- SKILL 核心设计规则：效果哲学改「干净=排版+层级，效果缩小保留」，排版对齐 Reo（正文 14、字重 300–600、h1 20/h2 18/h3 16），强调色与品牌色分离声明，「默认非天花板」创造力框架，radius-sm。
- SKILL 组件 token：Card/Metric 加 `box-shadow: var(--shadow-card)`。
- SKILL 色阶 + core-design-system.md：`c-gray` 改为 Reo zinc 中性；core Philosophy 改 Layered（非剥平）、Typography 对齐 Reo、品牌色保留声明 + defaults-not-ceilings。

验证：`typecheck:quick` 通过；`workspaceFiles.test.ts` 63/63 通过（更新 1 处 pin 旧 border 值的断言 → 新 Reo 值，属设计真值变更，非假改）。设计真值 = 已验收原型同一套 zinc/surface/radius/shadow，视觉融合已验。自检无残留旧 hex、无矛盾效果规则、新 token 引用全部有定义。

注：原型 `evidence/` 用了 `--surface-1` 等示例名；正式黄金范例（Phase B）改用 skill 规范名 `--color-background-primary` 等，保持范例与 skill token 块一致。

phase-gate：Phase A 为纯内容/CSS 字符串，已 typecheck + targeted 测试 + 自检 + 视觉基准对齐；正式 /code-review + /simplify 放在 Phase B（代码落地：seeding 管线 + 新模块）边界一并覆盖，更贴合风险面。

## 2026-06-05 Phase B explorable + 黄金范例（完成）

- 新模块 `src/main/worksDesignExamples.ts`：导出 `DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES`（5 个自包含单文件 entry.html，用 skill 规范 token 名 + 反应式模型 + Reo 外皮，均 ≤7KB，无 backtick/`${` 以便存于模板字面量）。
- 新参考 `DEFAULT_REO_WORKS_DESIGN_EXPLORABLES_REFERENCE_MD`（explorables.md）：source→derive→render 模型、坐标系约定、5 机制各配范例、按独立源变量计预算、纪律=默认非天花板。注册进 `DEFAULT_REO_WORKS_DESIGN_REFERENCE_FILES`（doctor 脚本内嵌该 map，自动纳入）。
- seeding：`ensureWorkspaceManagedAgentConfig` 增 `examples/` 受管目录 + 一次 `writeManagedReferenceFiles`；import examples 模块。
- SKILL：渐进读取加 explorables.md + examples/ 指引；module 列表升级 interactive/explorable；复杂度预算重构为「按独立源变量计（1–2），默认非天花板」。
- 范例为设计/交互参考单文件（非部署 bundle），不含 runtime.json/state.json → 不走 validate-runtime；以运行时渲染验证（更强）。
- 运行时视觉验证（playwright headless chromium，亮/暗、窄栏 240px）：5 个全部正确渲染并交互联动。修了两处：derive-chain 100% 里程碑标签右溢出（改 anchor end）；zoomable-series 改为「偏差曲线 + 围绕 0 缩放」模型，使缩放真正揭示近零日（旧的两线全局缩放会过度裁切，教错机制）。
- 测试：更新 reo-works-design 目录/references 列表断言（加 examples、explorables.md）+ 新增 examples/explorables 内容断言（含「无 backtick 泄漏」「含 derive」「explorables 引用范例与独立源变量」）。typecheck:quick 通过；workspaceFiles 63/63；workspaceIpc 214/214。

## 2026-06-05 Phase C 信息架构（完成）

改 `src/main/workspaceFiles.ts`，外科式补链，不重写已结构良好的块：

- `reo-works-design` SKILL frontmatter `description`：升级触发性，含「作品+右栏 Widget」「source→derive→render 反应式模型」「可运行黄金范例」「任何 slider/stepper/拖动/缩放/切换的可交互作品都用它」。
- runtime `templates.md`：`explainer` 升级为 `explainer / explorable`，点明反应式模型并交叉链接 `skills/reo-works-design/references/explorables.md` 与 `examples/`。
- runtime SKILL.md Templates 段：family 列表加 `explorable` 并一句话定义 + 指回 templates.md，保持 SKILL 体与 reference 渐进披露一致。
- `reo-works` SKILL「设计与交互」：新增一行——可交互作品按 source→derive→render 组织，先读 explorables.md + examples/，范例为起点非天花板。
- AGENTS 受管块作品路由行（原 line 93）：追加一句，slider/缩放/切换驱动图表的可交互作品参考 explorables.md + examples/ 反应式范例（不新增 bullet，最小扩展）。

决策：AGENTS 受管块、runtime SKILL、reo-works SKILL 结构本已清晰，只做交叉链接式补充，不做有回归风险的重排。仓库根 `AGENTS.md`/`.claude/CLAUDE.md` 未改（本 spec 非目标）。

验证：`typecheck:quick` 通过；main 测试 277/277（workspaceFiles 63 + workspaceIpc 214）；无测试 pin 旧 `explainer`/`Useful families` 字符串（grep 确认），无需改断言。

## 2026-06-05 阶段闸门 / simplify（完成）

用户选择「原地范围化自检」：不 commit、不切分支，只审查本 spec 的 3 个代码文件（`src/main/workspaceFiles.ts`、`src/main/worksDesignExamples.ts`、`test/main/workspaceFiles.test.ts`），工作树里的无关既有改动不纳入判断。

范围化 review + simplify 修复两点：

- `DEFAULT_REO_WORKS_DESIGN_MODULES_REFERENCE_MD` 仍保留旧的 “3 core inputs” 口径，和新 `source->derive->render` / 独立源变量预算冲突；已改成 `interactive / explorable` 与 1-2 个独立源变量口径。
- 范例测试只抽查 `reactive-binding.html`，没有覆盖 5 个黄金范例的模板字面量安全约束；已改为遍历全部 examples，断言完整 HTML、Reo token、`derive()` 和无 backtick / `${` 输出。`zoomable-series.html` 也显式改成 `derive(state) -> render()`，避免黄金范例教错结构。

验证：

- `npm run typecheck:quick` 通过。
- `MAIN_TEST_FILES="test/main/workspaceFiles.test.ts,test/main/workspaceIpc.test.ts" npm run test:main` 通过，277/277。

收口判断：

- `docs/current/*` / `docs/decisions/*` 不更新：`architecture.md` 只追踪受管 skill 目录级能力，不枚举内部 reference/example 文件；`frontend.md` 的设计系统真源是 renderer app，不需要记录 skill 内的投影值；`quality.md` 的命令、分层和测试边界未改变。
- initiative `docs/initiatives/2026-06-03-agent-created-works/tasks.md` 更新本 spec 状态；本 spec 完成后归档。

## 待办

- [x] Phase A 设计系统融合。
- [x] Phase B explorable + 范例 + seeding + 测试。
- [x] Phase C 信息架构（SKILL/references 描述、runtime explorable、reo-works 指引、AGENTS 受管块）。
- [x] phase-gate /code-review + /simplify（用户选择原地范围化自检；已完成 review + simplify）。
- [x] 收口：verify:quick、压回 current/decisions、更新 initiative tasks.md。
