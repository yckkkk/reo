# 产品功能说明（C）

## 目标

Reo 在用户不主动操作时，自动补齐「上次系统转写失败、转录仍为空」的 finalized audio Segment 与 SegmentSupplement；Memory Studio 内失败态 inline「重试」按钮可手动触发同一后台引擎，并在本地 optimistic running 态下等待结果。

## 用户体验

- 自动补转录静默运行，不弹 toast、不显示进度。
- 手动重试点击后立即显示「正在生成」，完成后显示 transcript，失败后回到可重试态并显示 root toast。
- 录音期间队列暂停出队，避免后台转写与录音收口竞争。
- 错 key、网络、格式、未配置 URL source、取消和 lock lost 都返回 typed error，不泄露 provider 原始错误或敏感数据。

## 功能边界

- 默认引擎是火山录音文件识别标准版 2.0 `volc.seedasr.auc`。
- 本地 `audio.webm` 通过 main-only TOS staging + OGG/Opus remux 转成短 TTL `audio.url`。
- 自动和手动任务共享 BackfillQueue；manual 插队但不抢占 in-flight。
- 不新增 main-to-renderer backfill event，不新增 Query key，不新增 Zustand store，不扩展 Segment/Supplement manifest schema。
- 不实现 D 的 More 菜单入口、任务取消 UI、进度条、长音频可视化或 transcript 编辑。

## 成功标准

- C-0b 的 URL-only gate 有安全交付方案和 ADR 记录。
- SeedASR AUC client、audio URL source、queue、scanner、trigger wiring、diagnostics、IPC/preload/renderer wrapper 都有行为测试。
- current docs、ADR、initiative 和 spec 同步。
- Electron sandbox、contextIsolation、nodeIntegration、CSP、permission、navigation 边界不放松。
- 最终验证包含 targeted tests、`format:check`、`verify:quick` 和 `git diff --check`。
