# Phase 1 · Implementation Notes

执行过程证据按时间顺序记录。每完成一个 Task 在此追加一节。

格式参考：

```
## Task N · <名称>
- 时间：2026-05-28 HH:MM PDT
- 改动：<文件清单>
- 验证：<执行的命令 + 结果摘要>
- 备注：<任何偏离 plan 的决定、风险记录>
```

## Task 1 · 重写 tokens.json

- 时间：2026-05-28 07:20 PDT
- 改动：`docs/current/design-system/tokens.json`（完整重写）
- 验证：JSON 结构有效（写入后 file 大小 ~5.4 KB，所有 brand/surface/gradient/shadow/radius/font section 都存在；color 与 dark 两套保持平行结构）
- 备注：tokens.json 是设计系统数据源；下游 variables.css 与 theme.css 必须与此严格对齐。`color-mix`、`var()` 表达式作为 token 值是允许的（W3C Design Tokens 规范不限制 value 语法）
- Commit: `4766208d feat(design-system): rewrite tokens.json for red fluid system`

## Task 2 · 重写 variables.css

- 时间：2026-05-28 07:25 PDT
- 改动：`docs/current/design-system/variables.css`（完整重写）
- 验证：与 tokens.json 逐项对齐——`:root/[data-theme='light']` 段含 Layer 1 raw + Layer 2 semantic + Layer 3 radius + Layer 4 effect；`[data-theme='dark']` 段含同样的 Layer 1 raw + Layer 2 semantic + Layer 4 effect（radius 继承自 :root）。所有新增 token 名落入 spec Section 6.7 reserved prefix
- 备注：variables.css 不被 runtime build 直接引用，是 design-system 源文件镜像；runtime 真源是 theme.css（Task 4 处理）
