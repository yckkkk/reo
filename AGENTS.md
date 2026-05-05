# Reo Agent Entry

Read `README.md`, `package.json`, and the source files directly needed for the task.

`AGENTS.md` and `.claude/CLAUDE.md` are mirrors. Update both together.

## Rules

- Keep the app small and aligned with electron-vite conventions.
- Prefer Electron, electron-vite, Vite, React, and TypeScript official docs.
- Do not add starter demo code, preload bridges, IPC surfaces, updater config, or packaging config without an explicit design decision.
- Renderer code must not use Node or Electron APIs directly.
- Use `.agents/skills/*` and `.claude/skills/*` as workflow references only. Skill examples are not Reo product or architecture truth.
- Use `npm run verify:quick` before claiming the project is clean.
