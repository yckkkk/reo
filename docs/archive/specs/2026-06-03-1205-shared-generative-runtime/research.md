# Research Notes

本文件只记录影响 M2 设计的外部参照，不要求用户 agent 在创作作品时阅读这些来源。最终交付给用户 agent 的 Reo skills 应内化这些模式，不能把外部项目当作必读前置。

## Claude HTML

Claude 的 HTML workflow 证明 HTML 不只是静态展示文件。它适合作为 agent 快速生成、用户可直接查看、可交互、可反馈、可导出的临时创作面。

采用点：

- Reo 作品应默认视为小型 Web app，而不是静态 preview。
- 用户 agent 应通过模板快速生成可运行成品。
- 作品可以是报告、工具、可视化、编辑器、复习表、游戏或原型。

参考：https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html

## VS Code Webview

VS Code Webview 的可借鉴点是：iframe-like Webview、host message bridge、显式 API、可序列化 UI state，以及不要把整个运行上下文当作持久化真源。

采用点：

- Reo runtime 使用 host bridge，而不是把用户 HTML 放入 Reo renderer。
- Runtime state 采用可序列化 JSON。
- Bridge API 应比裸 `postMessage` 更易用。

参考：https://code.visualstudio.com/api/extension-guides/webview

## OpenAI Apps / MCP UI

OpenAI Apps SDK 和 MCP UI 都把交互 UI 放进 iframe，并通过 host bridge 与模型、工具、状态和宿主交互。重要模式不是某个组件库，而是 resource + iframe + `window.*` bridge + persistent state + tool/action call 的组合。

采用点：

- Reo 使用显式 `window.reo` bridge。
- Runtime object 通过结构化 metadata 和 bundle 被宿主识别。
- 作品内可以发起 agent prompt action，而不是只能从 Reo 外部菜单开始。
- Widget / component 的未来能力应继承同一 runtime bridge。

参考：

- https://developers.openai.com/
- https://github.com/openai/openai-apps-sdk-examples
- https://mcpui.dev/guide/embeddable-ui

## Electron Protocol And Browser Origin

Electron privileged custom protocol 可以注册为 secure + standard，以获得 Web 平台语义。要支持 localStorage、IndexedDB 和每对象隔离，M2 需要新的每对象 origin URL 模型，而不是 M1 共享 host 静态预览 URL。

采用点：

- M2 引入每 runtime object 独立 origin。
- 继续通过 Electron protocol handler 服务本地 bundle。
- 不使用 `file://` 作为作品资源模型。

参考：https://www.electronjs.org/docs/latest/api/protocol

## MDN iframe sandbox

M1 的 `sandbox="allow-scripts"` 会形成 opaque origin，限制 Web Storage 等完整 Web app 能力。M2 需要允许 same-origin，让每对象 origin 下的浏览器存储可用。

采用点：

- M2 runtime iframe 不再使用 M1 opaque-origin 静态沙箱模型。
- 宿主边界通过每对象 origin、bridge identity 和 Electron/renderer 隔离表达。

参考：https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
