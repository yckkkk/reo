# 计划

## 当前真源输入

- 当前未安装 Vitest，`README.md` 明确 Vitest 只在对应 foundation slice 激活。
- 当前 renderer `App` 写在 `src/renderer/src/main.tsx` 内。
- 当前 `verify:quick` 只运行 typecheck、main tests、lint 和 format check。

## 必检问题

- DB schema：本切片不创建或修改 DB、schema、migration 或 tables。
- 表关系：本切片不引入实体关系。
- 数据获取模式：本切片不引入 TanStack Query、IPC request/response 或 filesystem scan。
- 可复用组件：本切片只提取 `App` root，不创建 shadcn/ui 或 reusable primitive。
- 文件夹结构：本切片不创建用户 workspace 文件结构。
- Electron/preload/IPC/security：本切片不新增 preload、IPC、permission、protocol 或 security surface。
- 错误处理：只保留现有缺失 `#root` 抛错；不新增用户可见错误流。

## 任务

1. 写 `src/renderer/src/App.test.tsx`，断言页面有 accessible `main`、标题 `Reo`，且不出现 `Photo`、`Video`、`File`、`Film`。
2. 在 `package.json` 增加 `test:renderer`，暂不安装 Vitest，运行 RED。
3. 安装 renderer 测试依赖。
4. 创建 `vitest.config.ts` 和测试 setup。
5. 提取 `src/renderer/src/App.tsx`，让 `main.tsx` 只负责挂载。
6. 运行 GREEN 和 REFACTOR 验证。
7. 更新 `docs/current/quality.md`。
8. 提交 `test: add renderer test foundation`。
