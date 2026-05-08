# Task 12：Runtime QA 与参考验证

创建时间：2026-05-07 16:48 America/Los_Angeles

## 目标

对 first product slice 当前 runtime 做真实 QA：启动 Electron app，验证 workspace 创建/打开、App shell、Home、Memory detail、recording drawer、录音权限路径、录音保存、播放入口、transcript/reflections 编辑、浅色/深色主题、未实现能力负向边界、reference mapping、accessibility 和安全边界。该 task 是验证型 slice；不把“检查通过”伪装成 RED/GREEN。若发现行为缺陷，需要在本 spec 记录可复现问题，再用 TDD 修复。

## 范围

- 使用 Computer Use 操作真实 Electron runtime。
- 对照 6 张主参考图和 `/private/tmp/reo-reference-frames/` 的结构、层级、状态与 micro-interactions。
- 验证当前已实现 UI 遵循 Reo design system，而不是复制参考图视觉系统。
- 验证 sidebar：240px 最小宽度、可拖到 520px、covered 状态内容面板覆盖 sidebar、左上 icon-only 折叠按钮、左下主题切换。
- 验证 Workspace entry Dialog 只从 Home `+` 入口打开，不是独立 page。
- 验证 Home/Memory detail 的 recording drawer target flow：Home 创建新 memory，detail 追加当前 memory。
- 验证 recording drawer 全状态：ready、acquiring、recording、paused、finalizing、editing、playback load、error 可见路径。
- 验证未实现的 photo/video/file/film/AI/auth/global search 不出现在 runtime command surface。
- 运行固定命令门禁，并记录归档前后 `docs/specs` 状态。

## 非范围

- 不新增产品功能。
- 不创建 screenshot baseline framework、generic QA harness、generic route service 或 generic IPC bridge。
- 不安装依赖。
- 不实现 camera、file upload、AI、auth、sync、share、global search、settings 或 updater。
- 不把 reference 图当作需要逐像素复制的视觉系统。

## 参考素材

- `/Users/yck/Downloads/PM/设计参考/记忆录音/home页面-sidebar展开态.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/home页面-sidebar rail态.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/workspace页面.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/录音详细页-没有录音弹层.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/录音详细页-录音中弹层.png`
- `/Users/yck/Downloads/PM/设计参考/记忆录音/ Reflections详细弹层.jpg`
- `/private/tmp/reo-reference-frames/`

## 成功标准

- 真实 Electron runtime 可启动并完成至少一个 local workspace create/open 验证路径。
- Runtime QA 覆盖浅色/深色、sidebar expand/covered、resize、Home、Memory detail、recording drawer、recording control、playback/editor surface。
- Runtime 负向能力边界通过：未实现能力不出现在 text、button、link 或 visible command surface。
- 如遇麦克风不可用或系统权限阻断，必须记录具体 blocker、已到达的 UI 状态和未完成验证项。
- `npm run verify:quick`、`git diff --check`、`diff -u AGENTS.md .claude/CLAUDE.md`、`find docs/specs -mindepth 1 -maxdepth 1 -print` 通过并记录。
- 完成后把长期 QA 结论压缩回 `docs/current/quality.md` 或相关 current docs，归档本 spec，并提交独立 commit。
