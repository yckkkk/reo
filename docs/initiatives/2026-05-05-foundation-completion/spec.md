# 规格

## 背景

当前 HEAD：`57d5d09 docs: define component foundation boundary`。

当前已安装：React、React DOM、Electron、Vite、electron-vite、TypeScript、ESLint、Prettier、Tailwind CSS。

当前未建立：preload、IPC、auth、database、updater、packaging、Sentry、logging、shadcn/ui、Vitest。

最近已完成 foundation slice：

- Quality/Test foundation：`012c2a2`。
- Tailwind styling foundation：`bf6f09e`。
- Component foundation boundary：`57d5d09`。

## 成功标准

- initiative 明确 10 天节奏、10 个子任务、顺序、依赖和验收门槛。
- 每个子任务都能拆成单 session spec slice。
- 每个子任务都明确是否允许安装依赖、是否需要 TDD、是否必须更新 `docs/current/*`。
- planning session 不安装依赖，不改 runtime 代码，不创建空架构层。
- 计划审查必须产出 scope challenge、what already exists、NOT in scope、failure modes、test strategy、parallelization/sequence analysis、outside voice / independent challenge。
- 计划完成后停止，不顺手执行第一个实现 slice。

## 非目标

- 不做产品功能。
- 不做 agent runtime、voice、DB domain model、auth product flow 或 business screen。
- 不引入 generic runtime、generic IPC bridge、generic privileged proxy 或 speculative service layer。
- 不为了“完整基础建设”一次性安装所有已选型依赖。
- 不初始化 shadcn/ui，除非某个后续 slice 同批证明真实 reusable component consumer。
- 不新增 preload、IPC、database、auth、updater、packaging、logging 或 telemetry surface。

## TDD 判断

本 session 是纯文档和规划，不改变 runtime 行为，不新增交互行为。

TDD 豁免：不执行 RED/GREEN/REFACTOR。验证以官方资料核对、plan review、独立 review、`npm run verify:quick`、`npm run build` 和 docs lifecycle 检查为准。

后续任何行为改动 slice 必须真实 TDD：RED -> GREEN -> REFACTOR。

## Skill 使用

- `$using-superpowers`：恢复 skill 工作流，但用户指定的 Reo 文档生命周期高于 Superpowers 默认 `docs/superpowers/*` 路径。
- `$brainstorming`：用于质疑 10 天 initiative 是否合理，并收敛到“长期路线图，不是大实现”。
- `$writing-plans`：用于把 initiative 拆成 10 个可执行 slice，但计划写入本 initiative。
- `$plan-eng-review`：用于审查 scope、架构、测试、失败模式、顺序和并行性。
- `$executing-plans`：仅作为执行边界检查，本 session 不执行实现计划。

## 官方资料核对

Context7 本 session 核对：

- Electron：`/electron/electron`，用于 security、sandbox、context isolation、preload 和 IPC 边界。
- shadcn/ui：`/shadcn-ui/ui`，用于 Vite、Tailwind v4、`components.json` 和 component source ownership 边界。
- Vitest：`/vitest-dev/vitest/v4.0.7`，用于 Vite-native runner、browser/component testing 和 Node test runner 分界。
- Drizzle：`/drizzle-team/drizzle-orm`，用于 SQLite、`better-sqlite3`、schema 和 migration 分界。
- Better Auth：`/better-auth/better-auth`，用于 Electron integration、system browser auth、session exchange 和 renderer listener 边界。
- TanStack Query：`/tanstack/query`，用于 query keys、deterministic hashing、mutation invalidation 和 server-state ownership。

Context7 查询在 planning session 只用于决定顺序和门槛，不替代后续 slice 的实现前核对。后续每个 slice 必须重新核对本 slice 会实际引入的包；未进入当前 slice 的包不因为本 initiative 出现而获得安装授权。

官方站点核对矩阵：

| 技术             | 官方资料                                                                                                                                                     | 对 Reo plan 的约束                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Electron         | https://www.electronjs.org/docs/latest/tutorial/security/ 与 https://www.electronjs.org/docs/latest/tutorial/context-isolation                               | 继续保持 sandbox、contextIsolation、nodeIntegration false；preload 只能暴露窄 API；IPC 不能是通用 bridge。            |
| electron-vite    | https://electron-vite.org/guide/build.html 与 https://electron-vite.org/guide/typescript                                                                     | 当前 build authority 仍是 electron-vite；packaging slice 不得混入 Forge snippets，除非同批切换 packaging model。      |
| Vite             | https://vite.dev/guide/                                                                                                                                      | renderer build 和 React TS integration 服从 Vite/electron-vite 配置，不自创 bundler layer。                           |
| Tailwind v4      | https://tailwindcss.com/docs/installation/using-vite 与 https://tailwindcss.com/docs/theme                                                                   | Tailwind v4 继续使用 `@tailwindcss/vite`、CSS import 和 `@theme` token，不引入 v3 config 思维。                       |
| shadcn/ui        | https://ui.shadcn.com/docs/installation/vite 与 https://ui.shadcn.com/docs/components-json                                                                   | shadcn CLI 会生成项目源码和 `components.json`；没有真实 consumer 时不初始化。                                         |
| Vitest           | https://vitest.dev/guide/browser/                                                                                                                            | Vitest 价值在 Vite transform、React component/browser testing；当前 Node main tests 不需要替换。                      |
| Drizzle          | https://orm.drizzle.team/docs/get-started-sqlite 与 https://orm.drizzle.team/docs/drizzle-kit-generate                                                       | Drizzle + `better-sqlite3` 需要 schema、migration 和 driver ownership；无 domain schema 时不建空 DB。                 |
| Better Auth      | https://better-auth.com/docs/integrations/electron                                                                                                           | Electron auth 依赖 system browser、PKCE/state、main bridge 和 session exchange；不能无 preload/IPC 设计直接接入。     |
| TanStack Query   | https://tanstack.com/query/latest/docs/framework/react/guides/query-keys 与 https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation | query keys 必须稳定且序列化；mutation 必须定义 invalidation 或 rollback。                                             |
| Zustand          | https://zustand.docs.pmnd.rs/reference/apis/create 与 https://zustand.docs.pmnd.rs/reference/middlewares/persist                                             | Zustand 只管跨 component subtree 的本地 UI state；persist 必须有 storage、version、partialize/migrate 判断。          |
| React Hook Form  | https://react-hook-form.com/docs/useform 与 https://github.com/react-hook-form/resolvers                                                                     | form state 属于 RHF；Zod resolver 可推导类型，但 schema/version mismatch 必须在 slice 中验证。                        |
| Zod              | https://zod.dev/basics                                                                                                                                       | 不可信边界使用 `safeParse`/parse 和 `z.infer`，不要用 TypeScript 类型假装 runtime validation。                        |
| Electron Forge   | https://www.electronforge.io/ 与 https://www.electronforge.io/config/plugins                                                                                 | Forge 是 packaging/distribution pipeline，不是当前 dev/build authority；引入时必须整体设计 makers、plugins、publish。 |
| electron-updater | https://www.electron.build/auto-update.html 与 https://www.electronjs.org/docs/latest/api/auto-updater                                                       | updater 依赖 release metadata、publish target、signing 和 packaged app；不能先写 UI 或 polling shell。                |
| Sentry           | https://docs.sentry.io/platforms/javascript/guides/electron/                                                                                                 | Sentry 需要 main、renderer、utility/preload 初始化策略和 source map/privacy 设计；不是单行 install。                  |
| electron-log     | https://github.com/megahertz/electron-log                                                                                                                    | 本地日志要区分 main/renderer/preload/file transport；生产 IPC transport 和敏感信息需要约束。                          |

## 10 个候选子任务审查

1. Initiative scope 是必要的起点，否则 10 天计划会变成大而全实现。
2. Quality/Test 完整化应排在前面，因为后续所有行为 slice 都依赖真实 TDD 和验证层。
3. Electron runtime readiness 必须早于 auth、DB renderer access、logging renderer capture 和 updater UI。
4. Data foundation 不能先做 domain model；只能在真实 durable data contract 出现时引入。
5. Auth foundation 依赖 Electron bridge、安全 persistence 和 session lifecycle，因此不能早于 Electron/data 边界。
6. Data fetching/state/forms ownership 应在 data/auth 边界后落实，否则 query/store/form 只能是空壳。
7. Component/UI foundation 当前默认 gate，不执行 shadcn 初始化，除非后续 slice 出现真实 reusable consumer。
8. Logging/error foundation 应在 packaging 前建立本地诊断语义，但不等于立即接 Sentry。
9. Packaging/update foundation 依赖 Electron security、logging 和 release target；Forge/updater/fuses/signing 必须同批设计。
10. Full foundation closeout 必须压缩 `docs/current/*`、记录 decisions、归档 specs 并输出 verification matrix。

## 排序结论

排序以“先提高后续 slice 的验证能力，再增加权限面和持久化面，最后做发布面”为准。任何子任务如果没有真实 consumer，应输出 no-op / defer 结论，而不是安装依赖占位。
