# 架构

Reo 当前是最小 Electron + React + TypeScript + Vite 项目。

```text
src/
  main/       Electron main process
  renderer/   React renderer
docs/
  archive/    已收口任务记录
  current/    当前真源
  decisions/  长期 ADR
  initiatives/ 长期任务
  specs/      当前任务工作区
```

## 当前事实

- Electron main process 位于 `src/main`。
- React renderer 位于 `src/renderer`。
- Vite 集成由 `electron-vite` 管理。
- 当前没有 preload API。
- 当前没有 IPC surface。
- 当前没有 database layer。
- 当前没有 auth layer。
- 当前没有 packaging、updater、signing、notarization、ASAR 或 fuse config。

## 边界规则

- 保持目录浅，只有真实压力出现时才增加结构。
- 不得无明确边界创建 `services/`、`lib/`、`shared/`、`core/` 等桶。
- 优先采用包和框架的目录约定，不自创架构。
- 新可复用模块需要至少两个真实消费者，或明确的平台边界。
- 新抽象必须消除有意义的重复，或强制真实不变量。
- 不保留占位目录。

## 基础切片

除非用户调整优先级，按以下顺序引入基础能力：

1. Electron 安全与进程模型
2. Styling 与组件基础
3. Type、test 与质量基础
4. Auth 与数据库基础
5. Data fetching 与状态归属
6. Packaging、updater、logging 与 crash reporting

每个 slice 必须在代码变更前或同批更新对应 `docs/current/*`。
