# Research Notes

## External Direction

Claude Code 的 HTML 文章强调：当 agent 需要表达 richer visualizations、色彩、图表、交互和 shareable outputs 时，Markdown 会变成限制。Reo 的启发不是“把一切都做成 HTML”，而是 agent 综合大量上下文后，需要一个一等的视觉产物面。

Claude Artifacts 展示了 hosted model：生成的代码、文档、visualizations 在专用 surface 中迭代、导出，并在部分场景连接 MCP。Reo M1 不复制 hosted AI/runtime 模型，只复制产品经验：agent-created visual works 需要可查看、可更新、可全屏的闭环。

OpenAI Apps SDK 与 MCP Apps 指向 iframe-hosted UI + typed host bridge over `postMessage`。这更适合未来 Widget runtime，不进入静态作品 M1。

Electron security 文档强化 Reo 现有基线：不可信内容必须隔离，不能放松 Node integration、context isolation、navigation 或 CSP 边界。

Malleable software / end-user programming 的长期启发是：用户和 agent 可以共同生成小工具，但 host 必须拥有数据和权限边界。Reo 因此先区分 snapshot artifact 与 live Widget。

## Internal Generative UI Baseline Findings

可直接复制改写：

- guideline-loading 结构：core + `interactive`、`chart`、`mockup`、`art`、`diagram` 模块。
- complexity budget：稀疏 diagram、少量 color ramp、短 label、避免过重 DOM。
- token 系统：shared background/text/border/layout variables，light/dark compatibility，rounded-number display，responsive grids。Reo skill 群应以该 token 系统为基底再改写，不只是抽象借鉴 token shape。
- typed host/page protocol 的模型，可作为 M2 Widget 数据桥的参考。
- display-only default：agent 不直接接收页面内部交互事件，本地控件只改本地 DOM。

M1 不复制：

- streaming tool-call rendering。
- Native external-window model。
- CDN allowlist 和完整 browser capability。
- Host prompt, link helper, SVG copy/save 等 host RPC。
- Claude-specific typography、调色板或品牌视觉。
- fragment-only output；Reo 需要完整 HTML 文档。

Reo adaptation：

- 使用 Reo Red Fluid token 和 Memory Studio surface 语义，不照搬 claude.ai 视觉。
- 默认 self-contained HTML，无网络。
- 生成结果适配 Reo content panel 和 fullscreen viewer。
- 作品是 durable user artifact，可以保留必要 prose；它不是一次性 chat widget。
- 模块模板和 token 规则直接进入 Reo 托管 skill 群；最终用户可见 skill 不出现外部项目引用。

## Source Links

- Claude Code HTML article：
  `https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html`
- Claude Artifacts help：
  `https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them`
- Claude Artifacts launch：
  `https://claude.com/blog/artifacts`
- OpenAI Apps SDK：
  `https://developers.openai.com/apps-sdk/`
- OpenAI MCP Apps compatibility：
  `https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt`
- MCP extension matrix：
  `https://modelcontextprotocol.io/extensions/client-matrix`
- Electron security documentation：
  `https://www.electronjs.org/docs/latest/tutorial/security`
