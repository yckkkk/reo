# Reo

Reo 是一个未发布的 Electron 应用，当前正在从干净基础重新建立。

## 当前事实

- 当前已安装：React、React DOM、Electron、Vite、electron-vite、TypeScript、ESLint、Prettier、Tailwind CSS。
- 当前已建立：Reo 设计系统源文件、Tailwind CSS v4 styling foundation。
- 当前未建立：preload、IPC、auth、database、updater、packaging、Sentry、logging、shadcn/ui、Vitest。
- 当前构建权威是 `electron-vite`。

## 技术路线

- React 19 + TypeScript
- Electron + Vite through `electron-vite`
- Tailwind CSS v4、shadcn/ui
- Zustand、TanStack Query、React Hook Form、Zod
- Better Auth、Drizzle ORM、`better-sqlite3`
- Electron Forge、`electron-updater`
- Vitest、Sentry、`electron-log`、`date-fns`

只有在实现对应 foundation slice 时才安装和配置未启用依赖。

技术路线不等于安装或激活许可。未启用依赖必须先有当前 feature 的 exact consumer、capability contract、测试路径和 `docs/current/*` 更新。

## 文档

Agent-facing 项目真源从 `docs/README.md` 开始。

## 命令

```bash
npm install
npm run dev
npm start
npm run build
npm run verify:quick
```
