# 移动弹层重新设计

## 意图

`EntityMoveDialog` 当前把整棵 空间 › Memory › 片段 树常态全展开，并把非目标层渲染成灰显 disabled 按钮，三种相似图标（Folder / FolderInput / Layers3）平铺、靠缩进几像素区分层级。结果是扁平、错乱、不像正常文件移动弹层。

重做成**原地可折叠树 + 顶部搜索**：记忆空间（移动补充时连同 Memory）是可展开的文件夹，展开后露出可选目标叶子。

纯 renderer 改动，drop-in 重写 `EntityMoveDialog.tsx` 内部；props、`EntityMoveTargetSelection`、`onConfirm` 契约、IPC、main、schema 全部不变。

## 数据约束（决定模型）

`workspace:listEntityMoveTargets` 按 `targetLevel` 填充层级，子层只在需要时填充：

| 移动 | targetLevel | 空间 | Memory | 片段 |
|---|---|---|---|---|
| 记忆 | `workspace` | 选择叶子，`memories: []` | — | — |
| 片段 | `memory` | 文件夹，children=memories | 选择叶子，`segments: []` | — |
| 补充 | `segment` | 文件夹，children=memories | 文件夹，children=segments | 选择叶子 |

- **文件夹的子项数总是可得**（一个节点是文件夹，当且仅当它的子层已被填充）；**叶子层无更深计数**，且强行获取需要对每个空间每个 Memory 做完整 detail 读取，开销过大。
  - 规则：**文件夹显示直接子项数（裸数字）；选择叶子不显示数字。** 不引入假计数。
- `source.breadcrumb` 可得（如 `['测试','Codex Dogfood']`），用于「现位于」源上下文。
- `disabledReason='当前位置'` 由 main 填在被移动实体的当前父级，**只落在叶子层**。

## 结构模型

源类型决定深度，每层节点只有两种角色：**文件夹**（可展开、不可选）或**目标叶子**（可选、不可展开）。

不变量：

1. **选择永远是一个叶子**（targetLevel 那一层）。文件夹只切换展开/收起，不参与 `selection`。
2. **禁用态只在叶子层**。文件夹永不禁用——它即使包含「当前位置」叶子仍可展开，让用户把实体移到同空间/同 Memory 下的其它目标。
3. **空文件夹**（0 子项）= 死路径：渲染为无箭头、灰显、不可展开（移动片段时 0 个 Memory 的空间、移动补充时 0 个片段的 Memory）。
4. `selection` 全程是 `EntityMoveTargetSelection`（不变契约）；Confirm 启用 ⟺ `selection !== null`。

## 行模型（统一槽位）

```
[展开槽 20px][实体图标 16px][名称 …弹性 truncate…][右侧元信息槽]
左内距 paddingLeft = 12 + depth*22 (px)，depth: 空间=0 / Memory=1 / 片段=2
```

- **文件夹行**：`▸/▾`（ChevronRight 旋转）+ Folder 图标 + 名称 + 右侧裸子项数。整行点击 = toggle 展开。
- **叶子行**：展开槽留空对齐 + 实体图标 + 名称 + 选中时右侧 `Check`。整行点击 = `choose`。
  - 实体图标：移动记忆时空间叶子用 Folder；移动片段时 Memory 叶子用 Memory 图标；移动补充时片段叶子用片段图标。
- **当前位置叶子**：`text-muted-foreground` + 右侧 `〔当前位置〕` 标签，无 Check，不可点。

## 视觉（Reo 设计系统）

- 复用现有 shadcn `Dialog`（`bg-popover` / `shadow-modal`）；宽度 `sm:max-w-[460px]`。
- 行：min-h 34、`reo-squircle rounded-md`；hover `bg-accent`；**选中 `bg-secondary` + 文字 medium + 右侧 Check**（遵守「列表选中用灰阶+权重、不用品牌红状态点」）。
- 元信息（子项数 / 当前位置标签）：`text-muted-foreground`、12px。
- 动效：箭头旋转与展开过渡 `duration-150 ease-out`；`prefers-reduced-motion` 下关闭。
- 同平面不画 row divider；层级靠缩进 + 文件夹图标表达。
- 只消费现有语义 token，无硬编码颜色，不新增设计系统 token。

## 头部 + 搜索 + 底部

```
移动片段                                         ← DialogTitle（按 source.type 派生）
正在移动「Run id…」· 现位于 测试 › Codex Dogfood    ← 源上下文（breadcrumb.join(' › ')）
[ 🔍  搜索空间或记忆… ]                            ← Input，sticky，open 时聚焦
▾  📁 测试                                   6
      ○ Codex Dogfood Memory          〔当前位置〕
      ● Codex Cross Space Memory          ✓
      ○ 生活
▸  📁 草稿                                   1
   📁 启示录阅读记录（空·灰显·无箭头）          0
                                  〔取消〕 〔移动〕
```

- **搜索**：子串匹配（不分大小写、trim）。可见性：叶子命中名称，或其某个祖先文件夹命中名称 → 显示；文件夹命中名称，或其任一后代可见 → 显示。活动搜索时所有可见文件夹强制展开。空查询回到默认展开。无匹配 → 「无匹配结果」。
- **默认展开**：`open` 时按 `source.breadcrumb` 自动展开到「当前位置」所在路径（移动片段展开源空间；移动补充展开源空间 + 源 Memory）。`open`/`sourceKey` 变化时重置展开与 `selection`。
- **底部**：`取消` + `移动`（`disabled || !selection` 时禁用）。按钮文案静态「移动」；选中目标由高亮行表达。

## 成功标准

- 移动记忆：弹层是扁平可选空间列表（无折叠、无计数），当前空间标〔当前位置〕不可选。
- 移动片段：空间为可折叠文件夹（显 Memory 数），展开后 Memory 为可选叶子；源 Memory 标〔当前位置〕不可选但其所在空间可展开、可选同空间其它 Memory；空空间灰显不可展开。
- 移动补充：空间、Memory 皆可折叠文件夹（各显子项数），片段为可选叶子；源片段标〔当前位置〕。
- 搜索按名称过滤并强制展开命中路径；无匹配显示「无匹配结果」；无任何可选叶子显示「没有可用目标」。
- 选中态 `bg-secondary` + Check，无彩色状态点；hover `bg-accent`。
- props / `EntityMoveTargetSelection` / `onConfirm` / IPC / schema 不变；App 不需改 wiring。
- `npm run verify:quick` 通过。

## 范围与复用评估

- 仅重写 `src/renderer/src/workspace/EntityMoveDialog.tsx` 内部；可拆出 feature-local 递归行组件（同文件或同目录），不提升到 `components/ui`（仅此一处消费者）。
- 复用 shadcn/Radix：无 Tree primitive；对 3 层有界小树引第三方树库（react-arborist 等）属过度依赖。保持 feature-local 自绘折叠树，复用现有 `Dialog`/`Input`/`Button` primitive 与设计系统 token。
- 不动 main、preload、contract、query wiring。

## 不做

- 不改数据层、不加 per-leaf 计数、不加后端 detail 读取。
- 不加动态「移动到 X」按钮文案（防长名撑破布局）。
- 不实现完整 roving-tabindex 树键盘导航；保留 Tab + Enter（行即 button）。

## 风险面与验证

- 风险：用户可见 workflow（移动实体跨空间）+ 三种 source 模式分支 + 搜索过滤可见性逻辑。
- 验证：对「可见性/展开/选择投影」纯函数（按 source 模式、disabledReason、空文件夹、搜索查询推导每行角色与可见性）做 focused 行为测试；运行时对三种 source 各做一次视觉 + 交互核对（截图进 implementation-notes）。
- 不做一次性覆盖全流程的大 E2E；按 source 模式与状态拆小场景。
