# 验证 — 实体 More 菜单 Shell 动作扩展

## 命令验证

- [x] `npm run typecheck`
- [x] `npm run test:main`
- [x] `npm run test:renderer`
- [x] `npm run lint`
- [x] `npm run format:check`
- [x] `npm run verify:quick`
- [x] `npm run build`

`npm run build` 通过；输出包含 Node `module.register()` deprecation warning，不影响构建结果。

## 运行时环境

运行时 fixture：

- Workspace: `Reo Actions Runtime 20260516005001`
- Memory: `Runtime Memory 20260516005001`
- Segment: `Runtime Segment 20260516005001`
- SegmentSupplement: `Runtime Supplement 20260516005001`
- Root: `/var/folders/ql/82hx_cy97xd902x7ryf2dx3m0000gn/T/reo-actions-menu-runtime-20260516005001/Reo Actions Runtime 20260516005001`

`REMOTE_DEBUGGING_PORT=9233 npm start` 能启动 packaged-like app，并显示上述 fixture；证据见 [runtime-00-start.png](artifacts/runtime-00-start.png)。

`npm start` 的 preview runtime 没有暴露可用 CDP page target；逐 surface 菜单截图和动作点击证据使用 `REMOTE_DEBUGGING_PORT=9233 npm run dev` 采集。该运行时使用相同 Electron main/preload/renderer 代码和真实 userData registry；CDP target 为 `Reo` / `http://localhost:5173/`。已打开工作区截图见 [runtime-01-dev-opened-workspace.png](artifacts/runtime-01-dev-opened-workspace.png)。

完整机器可读证据见 [runtime-dev-evidence.json](artifacts/runtime-dev-evidence.json)。

## 菜单证据

| 入口                       | 截图                                                                                             | 观察到的条目                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Sidebar Memory Space More  | [runtime-02-sidebar-memory-space-menu.png](artifacts/runtime-02-sidebar-memory-space-menu.png)   | 用默认应用打开 / 在访达中显示 / 复制绝对路径 / 重命名 / 移除                |
| Titlebar Memory Space More | [runtime-03-titlebar-memory-space-menu.png](artifacts/runtime-03-titlebar-memory-space-menu.png) | 用默认应用打开 / 在访达中显示 / 复制绝对路径 / 重命名 / 移除                |
| Titlebar Memory More       | [runtime-04-titlebar-memory-menu.png](artifacts/runtime-04-titlebar-memory-menu.png)             | 用默认应用打开 / 在访达中显示 / 复制相对路径 / 复制绝对路径 / 重命名 / 删除 |
| MemoryRail Memory More     | [runtime-05-memory-rail-memory-menu.png](artifacts/runtime-05-memory-rail-memory-menu.png)       | 用默认应用打开 / 在访达中显示 / 复制相对路径 / 复制绝对路径 / 重命名 / 删除 |
| Segment card More          | [runtime-06-segment-card-menu.png](artifacts/runtime-06-segment-card-menu.png)                   | 用默认应用打开 / 在访达中显示 / 复制相对路径 / 复制绝对路径 / 重命名 / 删除 |
| SegmentSupplement tab More | [runtime-07-supplement-tab-menu.png](artifacts/runtime-07-supplement-tab-menu.png)               | 用默认应用打开 / 在访达中显示 / 复制相对路径 / 复制绝对路径 / 重命名 / 删除 |

菜单 icon 与分割线复核见 [runtime-review-sidebar-menu-after-fix.png](artifacts/runtime-review-sidebar-menu-after-fix.png) 和 [runtime-review-sidebar-menu-after-fix.json](artifacts/runtime-review-sidebar-menu-after-fix.json)：Sidebar Memory Space More 菜单 5 个 menuitem 均有 `svg` icon，2 条 `separator` 高度为 `1px` 且背景色非透明；分组间实际垂直间距为 `9px`，同组条目间距为 `0px`。

## 动作证据

| 动作           | 入口                       | 结果                                                                                                                                                                                   |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 复制绝对路径   | Sidebar Memory Space More  | 剪贴板写入 root 绝对路径；`/var` 与 `/private/var` realpath 归一后匹配；toast 为 `已复制路径`。                                                                                        |
| 复制相对路径   | Titlebar Memory More       | 剪贴板写入 `memories/mem_actions_20260516005001--Runtime Memory 20260516005001`；toast 为 `已复制路径`。                                                                               |
| 复制绝对路径   | Segment card More          | 剪贴板写入 Segment 目录绝对路径；realpath 归一后匹配；toast 为 `已复制路径`。                                                                                                          |
| 复制相对路径   | SegmentSupplement tab More | 剪贴板写入 `memories/.../segments/.../supplements/...` POSIX 相对路径；toast 为 `已复制路径`。                                                                                         |
| 用默认应用打开 | Titlebar Memory More       | 菜单动作执行后没有 renderer error toast；外部默认应用进程取焦点为 `stable`。                                                                                                           |
| 在访达中显示   | Titlebar Memory More       | 菜单动作执行后没有 renderer error toast；Finder selection probe 返回空，Finder window-introspection AppleScript 在当前环境挂起。该项不作为“已观察到 Finder 选中目录”的证据。           |
| 缺失文件错误   | Titlebar Memory More       | 临时移走 `memory.md` 后触发「用默认应用打开」，root error toast 显示 `找不到对应的正文文件。`；截图见 [runtime-08-after-error-toast.png](artifacts/runtime-08-after-error-toast.png)。 |

## 覆盖边界

- Main handler tests 覆盖 resolver 成功/失败、`shell.openPath`、`shell.showItemInFolder`、`clipboard.writeText` 和 typed error envelope。
- Renderer tests 覆盖四个 typed menu 组件和六个 surface 的文案、分组、触发与 dialog 互不污染。
- 运行时证据覆盖六个 surface 的菜单结构、复制动作剪贴板结果、默认打开无错误 toast、缺失文件 error toast。
- 当前环境未取得可采信的 Finder 真实选中目录样本；不能用本 verification 宣称 Finder selection 已被视觉确认。
