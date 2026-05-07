# Review

## 预期审查点

- 主题实现是否保持 Reo token 驱动，而不是散落页面级暗色补丁。
- 主题状态是否足够简单，且不会在 starter/loaded shell 切换时丢失。
- 侧边栏左下角按钮是否符合 icon-only + tooltip + lucide 规则。
- 深色模式是否覆盖当前已交付界面，不留下明显浅色面板。
- Dialog 可访问性是否符合 Radix 官方要求。
- 是否符合 `$ycksimplify`：不加 generic provider、不加持久化、不加系统主题跟随、不加多余 defensive code。

## 结果

结论：PASS。Task6A 无未解决 BLOCKER / MAJOR，可以提交并进入 Task 6。

## `$ycksimplify` 对抗审查

时间：2026-05-07 11:11 America/Los_Angeles

结论：PASS，无未解决 BLOCKER / MAJOR。

审查方式：

- 复用审查：检查主题实现是否复用 Reo token、shadcn/Radix primitive 和现有 App shell，而不是新增业务级 palette 或 ThemeProvider。
- 质量审查：检查 Dialog 可访问性、主题状态切换、starter/loaded shell 切换后的状态保持、测试覆盖和文档同步。
- 效率审查：检查是否有多余 provider、重复 class、未使用 Tailwind variant、过度 optional/defensive code 或无当前用途的 abstraction。

已修复事项：

- MAJOR：深色 token 只在 runtime CSS 中存在，设计系统源文件未同步。已补齐 `docs/current/design-system/*` 的 scrim、dark token、dark gradient 和使用规则。
- MINOR：曾新增未使用的 Tailwind `@custom-variant dark`。已删除。
- MINOR：document root `data-theme` 缺测试。已在 `App.test.tsx` 覆盖创建 workspace 前后 document root 主题保持。
- NIT：App shell icon-only control 重复写 `text-cinder`。已移除，保留 `Button` primitive variant 的单一来源。

保留决定：

- `App` 同时给 document root 与 App shell 根节点设置主题。document root 负责 Radix portal 继承主题，App shell 根节点负责页面 runtime 验证和组件局部级联，两者职责不同。
- `App` 使用一个 effect 写入 document root theme，另一个 unmount cleanup 移除属性。这样不会在每次主题切换时先 cleanup 再写入，避免 portal 级联出现短暂空档。

## Claude CLI 对抗审查

命令：

```bash
claude --model claude-opus-4-7 --effort max "审查提示词"
```

结论：PASS，无 BLOCKER / MAJOR。

Claude 提出的非阻断项与处理：

- 两个 `useEffect` 可读性略有争议：保留，原因见上方保留决定。
- document root 与 App shell 双 `data-theme` 需要明确职责：已在 review 记录并在 `docs/current/frontend.md` 写入当前规则。
- 深色 voice spectrum gradient 缺少覆盖：已补齐 runtime CSS、design-system CSS、variables 和 tokens。
- `verification.md` 有占位：本文件收口时同步补齐实际 RED/GREEN/runtime/final 证据。
