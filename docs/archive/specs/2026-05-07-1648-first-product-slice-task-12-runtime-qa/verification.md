# 验证记录

## Runtime QA

- `npm run dev` 启动 Electron runtime 成功，renderer dev URL 为 `http://localhost:5173/`。
- Computer Use 识别 app `Electron — com.github.Electron`，窗口标题 `Reo`。
- Starter Home：验证 `All memories`、说明文案、Home `+` create workspace 入口、sidebar Home、左上 hide icon、左下 theme toggle。
- Workspace create：在 `Create workspace` Dialog 中输入 title/description，通过 OS folder picker 选择 `/private/tmp/reo-task5-create-runtime/runtime-qa-empty`，create 成功后进入 loaded Home。
- App shell：验证浅色/深色切换、sidebar default 240、covered 状态、左上 show/hide icon-only control、左下 theme control。
- Home runtime：验证 workspace title、description、`Record memory`、`Search memories`、empty state、memory card、month section 和 search field。
- Recording runtime：验证 ready、preparing microphone、recording、paused、resumed、finalizing/editing、busy close disabled、editor textarea、playback load、local playback play/pause。
- Save failure runtime：第三段 finalized recording 停在 editing drawer 后，临时执行 `chmod u-w recordings/rec_20260508001052_868323ed`，编辑 Transcript 触发 `Recording markdown could not be saved`；恢复写权限后再次编辑为 `Runtime save recovery note`，错误消失，`transcript.md` 写入 26 bytes。
- Memory detail runtime：验证 Home card 打开 detail、Back、detail `Record memory`、bounded Voice recordings、Transcript/Reflections saved state、Memory content section。
- Existing-memory append：detail 录音完成后同一 memory detail 从 1 recording 更新到 2 recordings；save-failure 验证生成第三段后更新到 3 recordings；open existing workspace 后仍从 workspace files 恢复 1 memory / 2 recordings，后续第三段也落盘在同一 memory。
- 负向能力边界：Computer Use runtime accessibility tree 和 visible UI 未出现 photo、video、file upload、film、AI、auth、global search、share、sync、camera、entity/contact graph command。
- 文件真源检查：`find /private/tmp/reo-task5-create-runtime/runtime-qa-empty -maxdepth 5 \( -type f -o -type d \)` 显示 stable workspace files、`.reo` metadata、1 个 memory 和 3 个 finalized recording directories；`rg` 查到第一段 `transcript.md`/`reflections.md` 与第三段 `transcript.md` 中的 runtime 输入；`wc -c` 显示三段 audio 和 metadata/markdown 文件存在。

## 命令验证

- `npm run verify:quick`：通过。`test:main` 249 tests passed，`test:renderer` 17 files / 96 tests passed，`lint` 通过，`format:check` 输出 `All matched files use Prettier code style!`。
- `git diff --check`：通过，无输出。
- `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- `find docs/specs -mindepth 1 -maxdepth 1 -print`：归档前只输出当前 spec：`docs/specs/2026-05-07-1648-first-product-slice-task-12-runtime-qa`。
- 归档后 `git diff --check`：通过，无输出。
- 归档后 `diff -u AGENTS.md .claude/CLAUDE.md`：通过，无输出。
- 归档后 `find docs/specs -mindepth 1 -maxdepth 1 -print`：通过，无输出。
