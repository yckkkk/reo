# Reo 设计系统

本目录保存 Reo 当前设计系统源文件。

## 文件

- `DESIGN.md`：当前视觉规则、组件形态、surface、elevation、layout 和 usage rules。
- `theme.css`：Tailwind v4 `@theme` token source。
- `variables.css`：CSS custom properties source。
- `tokens.json`：结构化 design token source。

## Runtime 投影

- Renderer 可执行主题文件是 `../../../src/renderer/src/theme.css`。
- Renderer 样式入口是 `../../../src/renderer/src/index.css`。
- Runtime theme 使用 `@theme static` 发出完整 token 集合。
- Runtime CSS 只使用合法 CSS 值；Cinder 当前值是 `#57534f`。
- Runtime theme 通过 `data-theme="dark"` 覆盖同名 token；不得另建业务级暗色 class palette。

## 使用规则

- 前端实现先核对本目录，再改 renderer theme 或组件样式。
- `theme.css`、`variables.css`、`tokens.json` 与 runtime theme 的 token 语义必须保持一致。
- 组件命名、产品文案和业务结构不从设计系统示例推导。
- 本目录定义 Reo 视觉真源，不替代 UI 技术框架。
- UI 技术框架是 Tailwind CSS v4 + shadcn/ui + Radix primitives；组件 source 必须映射回 Reo tokens/theme。
