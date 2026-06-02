# Memory 封面文件合同与同步模型

## 当前范围

本 spec 只实现 MemoryRail 的 Memory 封面。后续 Segment 横向流封面单独开 spec，但从当前合同开始预留同一模型。

## 默认模板池

- 默认封面模板是 App 内置资产，不复制进每个 workspace。
- Repo 位置使用 `src/renderer/src/workspace/covers/defaults/`。
- 同目录提供 TS registry，供 Memory 和未来 Segment 封面共用。
- 默认模板通过实体 id 做 deterministic random 映射：
  - Memory 使用 `memoryId`。
  - 未来 Segment 使用 `segmentId`。
- 没有自定义封面时，renderer 根据实体 id 从内置 registry 选择默认模板。

## Memory 自定义封面

- Memory 自定义封面位于用户文件真源内：

```text
memories/<memory-directory>/cover/
```

- `cover/` 属于用户/agent 可直接编辑的普通文件目录，不放入 `.reo`。
- 允许格式：`png`、`jpg`、`jpeg`、`webp`。
- `cover/` 语义上应只有一张有效图片。
- 如果目录内存在多张有效图片，Reo 按文件名排序取第一张作为当前封面。
- 如果 `cover/` 缺失、为空或没有有效图片，显示内置默认模板。

## Renderer 读取

- 不向 renderer 暴露 raw file path。
- 扩展现有 `reo-attachment://` 安全协议读取 Memory cover。
- Workspace snapshot 的 Memory summary 投影 cover 状态；默认封面投影为 `{ source: 'default' }`，custom cover 投影为 filename 和 version，不投影内置模板最终 URL。
- 建议投影形状：

```ts
type WorkspaceMemoryCoverProjection =
  | {
      source: 'custom';
      filename: string;
      version: string;
    }
  | {
      source: 'default';
    };
```

- `version` 使用 `mtimeNs+size` 派生，保证 agent 快速替换同名图片后 `<img src>` 改变并重新加载。
- Renderer 根据投影决定：
  - `custom`：构造 `reo-attachment://<workspaceId>/memories/<memoryId>/cover/<encodedFilename>?v=<version>`。
  - `default`：按 `memoryId` 从内置模板 registry 取图。

## 同步模型

- 复用现有 workspace file truth watcher。
- Agent 或用户替换 `memories/<memory>/cover/` 下的图片后：
  1. main-owned watcher 发送同 workspace file truth event。
  2. renderer 重读 Workspace snapshot。
  3. snapshot 投影新的 custom cover source/version。
  4. MemoryRail 重新渲染并加载新图片。
- 不新增 DB、Zustand store 或 renderer-side file probing。
- 不把 cover 选择状态写入 `.reo` manifest。

## More 菜单

- `MemoryActionsMenu` 新增菜单项：`恢复随机默认图片`。
- 当 Memory 没有 custom cover 时，该菜单项禁用显示；tooltip 文案说明当前已是随机默认图片。
- 当 Memory 有 custom cover 时，该菜单项可点击。
- 点击后执行真实 main mutation：
  1. main 将该 Memory 的 `cover/` 目录移入 `.reo/trash/memory-covers/<restoreToken>`，生成 restore token。
  2. main 返回更新后的 Workspace snapshot 和 restore token。
  3. renderer 显示内置默认模板，并弹出 undo toast。
  4. undo 使用 restore token 恢复原 `cover/` 目录。
- 不做永久删除。
- 本 spec 不增加选择图片、上传图片或拖拽设置封面的 UI。

## 后续 Segment 准备

- 后续 Segment 横向流封面沿用同一合同：

```text
memories/<memory-directory>/segments/<segment-directory>/cover/
```

- Segment 封面使用同一个内置模板 registry、同一 `reo-attachment://` 安全读取思路、同一 watcher refresh 模型。
- Segment spec 再定义 Segment projection 字段、菜单项和 reset/undo mutation。
