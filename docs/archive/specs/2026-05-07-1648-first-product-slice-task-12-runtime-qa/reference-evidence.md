# 参考验证记录

## 目标

记录 runtime 与参考素材的结构、层级、状态和 micro-interaction 对照。参考图约束信息架构与交互，不覆盖 Reo design system token。

## 待验证素材

- `home页面-sidebar展开态.png`：展开 sidebar、Home 结构、主内容层级、Home `+` 入口。
- `home页面-sidebar rail态.png`：只作为 covered/折叠结构背景；当前 Reo 不设计 rail sidebar，折叠按钮在红绿灯旁。
- `workspace页面.png`：workspace loaded shell、列表/内容层级、信息密度。
- `录音详细页-没有录音弹层.png`：recording drawer ready/empty 状态。
- `录音详细页-录音中弹层.png`：recording drawer recording/paused/finalizing 状态。
- ` Reflections详细弹层.jpg`：editing drawer、Transcript/Reflections 层级和长内容滚动。
- `/private/tmp/reo-reference-frames/ref1-02.jpg` 至 `ref1-13.jpg`：第一组录音 overlay/drawer 过渡、handle/header/footer/action hierarchy 和编辑面板节奏。
- `/private/tmp/reo-reference-frames/ref1-contact.jpg`：仅作为 future contact/entity 类页面背景参考；当前 runtime 不显示 contact/entity command。
- `/private/tmp/reo-reference-frames/ref2-01.jpg` 至 `ref2-09.jpg`：第二组录音入口、ready、acquiring、recording、paused、stop/finalizing micro-interactions。
- `/private/tmp/reo-reference-frames/ref2-10.jpg` 至 `ref2-17.jpg`：第二组 editing、Transcript preview、Reflections/editor、playback load 和 local playback surface。
- `/private/tmp/reo-reference-frames/ref2-18.jpg` 至 `ref2-27.jpg`：第二组 drawer close/reopen、detail 背景层级和长内容滚动参考。
- `/private/tmp/reo-reference-frames/ref2-contact.jpg`：仅作为 future contact/entity 类页面背景参考；当前 runtime 不显示 contact/entity command。

## Evidence

- Home sidebar 展开态：Computer Use 首屏看到底层 sidebar、左上 icon-only hide control、左下 theme toggle、Home nav、主内容上层 panel 和 Home `+` workspace 入口；结构匹配 `home页面-sidebar展开态.png` 的层级，视觉使用 Reo tokens。
- Covered sidebar：点击 `Hide sidebar` 后，主内容 panel 覆盖 sidebar、左侧贴边、折叠 icon 留在红绿灯旁，未创建 rail sidebar；该行为按用户修正后的 covered 模型验证。
- 深色模式：点击 sidebar 左下角 theme control 后，App shell、Home、Dialog/Drawer portal surface 同步进入暗色 token，文本层级、边界和主要 action 可读。
- Workspace entry：Home `+` 打开 `Create workspace` Dialog；Dialog 包含 create/open 两条 branch，不是独立 page；通过 OS folder picker 选择 `runtime-qa-empty` 后创建 workspace。
- Loaded Home：显示 workspace title 标签、`All memories`、description、`Record memory`、`Search memories`、empty state；未出现 photo/video/file/film/AI/auth/global search command。
- Recording drawer ready：Home `Record memory` 打开 bottom Drawer，显示 `Recording` 标题、local audio 说明、ready status、waveform 和 `Start recording`；结构映射 `录音详细页-没有录音弹层.png`。
- Recording drawer active：点击 `Start recording` 后先进入 `Preparing microphone access`，随后进入 `Recording local audio`；忙碌态禁用 close，显示 `Pause recording` 和 `Stop recording`；结构映射 `录音详细页-录音中弹层.png`、`ref2-01.jpg` 至 `ref2-09.jpg`。
- Recording paused/resumed：`Pause recording` 切换为 `Resume recording`，status 显示 paused；resume 后回到 recording。
- Editing drawer：stop 后进入 `Edit recording`，显示 Transcript preview、Transcript/Reflections textarea、`Load recording` 和固定 close command；结构映射 ` Reflections详细弹层.jpg`、`ref1-02.jpg` 至 `ref1-13.jpg`、`ref2-10.jpg` 至 `ref2-17.jpg` 的编辑层级，使用 Reo design system。
- Playback：`Load recording` 成功后显示 `Local recording` surface、play/pause button、position slider 和 time labels；映射 `ref2-10.jpg` 至 `ref2-17.jpg` 的本地音频播放面板，不引入云端 agent/API key/model copy。
- Save failure：在第三段 finalized recording 的 editing drawer 中，临时把 recording 目录改为不可写后编辑 Transcript，runtime 显示 `Recording markdown could not be saved`；恢复目录写权限后再次编辑为 `Runtime save recovery note`，错误消失并写入 `transcript.md`。
- Memory detail：关闭 drawer 后 Home 出现 memory card；打开 card 后进入 detail，显示 title、Back、`Record memory`、Voice recordings、Transcript、Reflections、Memory content。
- Existing-memory append：从 Memory detail 点击 `Record memory` 并完成第二段录音后，detail 的 Voice recordings 从 `1 recording` 更新为 `2 recordings`，同一 memory 下显示两张 recording card；后续 save-failure 验证生成第三段录音后，detail 更新为 `3 recordings`。
- Open existing workspace：关闭当前窗口状态回到 starter 后，通过 `Open existing workspace` OS picker 重新打开 `runtime-qa-empty`，Home 从 workspace files 恢复 1 个 memory 和 2 段 recording，且 Transcript/Reflections presence 仍显示。
- Reference frame conclusion：所有 frame 只约束结构、状态和 motion intent；Reo 使用 Tailwind/shadcn/Radix/Vaul/lucide/token 系统重建层级，不复制参考图品牌、字体、颜色或 contact/entity future surface。
- 文件真源：`find /private/tmp/reo-task5-create-runtime/runtime-qa-empty` 显示 stable `AGENTS.md`、`.reo/workspace.json`、`.reo/index.json`、`memories/<memoryId>/memory.json` 和三个 `recordings/<recordingId>/`；三段 `audio.webm` 分别为 459443 bytes、239953 bytes 与 173235 bytes，第一段 transcript/reflections markdown 均为 23 bytes，第三段 transcript 为 26 bytes 且包含 save recovery runtime 输入。
