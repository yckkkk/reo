# Handoff

## 当前状态

Foundation completion initiative 已完成并归档。

当前 HEAD 会在 closeout commit 后记录于最终输出。

工作区应保持：

- `docs/specs` 为空。
- `docs/initiatives` 没有 active initiative。
- `docs/archive/initiatives/2026-05-05-foundation-completion/` 保存本 initiative。
- `docs/archive/specs/2026-05-05-2311-foundation-closeout/` 保存 closeout evidence。

## 当前事实

- Reo 仍是未发布 Electron 产品。
- 当前已安装：React、React DOM、Electron、Vite、electron-vite、TypeScript、ESLint、Prettier、Tailwind CSS。
- 当前未建立：preload、IPC、auth、database、updater、packaging、Sentry、logging、shadcn/ui、Vitest。
- 当前没有产品功能、agent runtime、voice、DB domain model、auth product flow 或 business screen。

## 下一步规则

下一 session 不应继续此 initiative。若要开始产品功能或新的 foundation surface，必须创建新的 `docs/specs/YYYY-MM-DD-HHMM-*/`。

默认启动读取：

1. `AGENTS.md`
2. `README.md`
3. `docs/README.md`
4. `docs/current/foundation.md`
5. `docs/current/architecture.md`
6. 按范围读取对应 `docs/current/*`

如果下一步是产品功能，先写具体 feature spec，并只引入当前 feature 真实需要的 foundation surface。不得因为 foundation-completion 已完成就安装所有已选型依赖。

## 禁止事项

- 不从 archived initiative 继续执行 Task 01-10。
- 不把 archived specs 当作当前真源。
- 不创建 generic preload/IPC、generic runtime、generic service layer 或空 component layer。
- 不安装 DB/auth/query/store/form/logging/packaging/updater 依赖，除非当前 spec 有真实 consumer 和验证计划。

## 可复用 verification

每次收口至少运行：

```bash
npm run verify:quick
npm run build
git diff --check
diff -u AGENTS.md .claude/CLAUDE.md
git ls-files out dist build .vite .tmp
find docs/specs -mindepth 1 -maxdepth 1 -print
git status --short
git ls-files --others --exclude-standard
```

Electron production loading、CSP、protocol、navigation 或 permission baseline 变化时，按 `docs/current/electron.md` 追加 runtime evidence。
