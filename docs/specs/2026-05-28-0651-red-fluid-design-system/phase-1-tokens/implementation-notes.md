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
