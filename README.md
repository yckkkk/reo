# Reo

Reo 是一个 agent-native 的个人内容生成环境：本地文件是真源，记录和判断留给人，组织、改写、生成作品交给 agent——让 agent 为用户的材料工作，而不是让用户去适应应用的功能。

**当前状态**：核心机制已完成、端到端可运行——agent 在用户材料上生成 HTML 作品、artifact 隔离预览协议、文件驱动、双向 prompt bridge 等都已跑通。auth、关系型 database、打包分发等刻意暂未接入：核心持久化基于本地文件（files-as-source-of-truth），这些是留到产品化阶段再做的工程，而非缺失的能力。尚未对外发布。

## 当前事实

- 当前已安装：React、React DOM、Electron、Vite、electron-vite、TypeScript、ESLint、Prettier、Tailwind CSS、Vitest、Testing Library、Zod、React Hook Form、TanStack Query、Radix AlertDialog/Dialog/DropdownMenu/Label/Slot/Tooltip/Separator/Switch、Tiptap React/StarterKit/Markdown/Image/Highlight/TextAlign/List/Typography/Subscript/Superscript、Blossom Carousel Core、PrimeReact、Vaul、Sonner、date-fns、lucide-react、electron-log、@ffmpeg-installer/ffmpeg、shadcn/ui source 所需工具包、Agentation dev-only toolbar。
- 当前已建立：Reo 设计系统源文件、Tailwind CSS v4 styling foundation、renderer 测试基础、Agentation dev-only renderer feedback toolbar、记忆空间 preload/IPC 边界、记忆空间文件事务基础、main-owned memory space registry、main-owned 本地诊断日志、main-owned 语音设置、豆包流式语音识别、finalized audio 文件转录队列、artifact 作品文件识别与隔离预览协议、agent prompt-copy bridge、React Hook Form 记忆空间表单、TanStack Query memory space list/snapshot cache、shadcn/ui Button/Input/Label/Dialog/Drawer/DropdownMenu/Textarea/Tooltip/Separator/Field/Breadcrumb/AlertDialog/Switch source、Tiptap-backed lightweight Markdown editor、Floating Action Button Speed Dial、Sonner root toast host、Reo recording waveform。
- 刻意暂未接入（留到产品化阶段，非能力缺失）：auth、关系型 database、updater、packaging、Sentry、远程 telemetry、Zustand store、wavesurfer integration。
- 当前构建权威是 `electron-vite`。

## 技术路线

- React 19 + TypeScript
- Electron + Vite through `electron-vite`
- Tailwind CSS v4、shadcn/ui
- Zustand、TanStack Query、React Hook Form、Zod
- Better Auth、Drizzle ORM、`better-sqlite3`
- Electron Forge、`electron-updater`
- Vitest、Sentry、`electron-log`、`date-fns`

只有在实现对应基础能力时才安装和配置未启用依赖。

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

`npm run dev` 会先加载本机 `.env.local`，再启动 `electron-vite dev`。`.env.local` 不进入 git，用于放置仅 main process 消费的本地开发密钥；语法遵循 Node DotEnv，值里包含 `#` 时必须加引号。
