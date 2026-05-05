# Reo 文档入口

文档优先服务 agent。目标是减少误判，而不是堆叠知识库。

## 默认阅读

每次任务读取：

1. `../AGENTS.md`
2. `../README.md`
3. `current/foundation.md`
4. `current/architecture.md`

然后只读取与改动范围匹配的 current 真源：

- Electron surface：`current/electron.md`
- 数据与状态归属：`current/data.md`
- 流程与时序：`current/flow.md`
- 前端与组件：`current/frontend.md`
- 质量门槛：`current/quality.md`

## 结构

```text
docs/
  current/     当前实现与设计真源
  decisions/   长期架构决策
  specs/       带时间戳的任务工作区
```

## 任务 Specs

任务 spec 路径格式：

```text
docs/specs/YYYY-MM-DD-HHMM-slug/
```

使用本机时区，并在 spec `README.md` 中显式写出 timezone。

已完成 specs 保留为任务记录，但不是默认阅读内容，也不能覆盖 `current/*`。

## 收口压缩

任务收口时：

1. 把仍然有效的长期事实写回 `current/*`。
2. 把长期架构决策写入 `decisions/*`。
3. 把任务证据留在 `specs/*`。
4. 除非用户明确要求，不创建额外顶层 docs 目录。
