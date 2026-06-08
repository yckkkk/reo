# 画廊球形瀑布流

Timezone: America/Los_Angeles

## 目标

把顶层「画廊」从 placeholder 改为全局录音/笔记画廊：展示所有可读记忆空间中的 Segment 与 SegmentSupplement，但过滤作品；使用给定球形瀑布流视觉模型和截图参数；点击卡片打开对应对象。

## 成功标准

- 画廊使用固定参数：排数 5、水平密度 10、垂直排距 1.6、球体半径 800、滚动速度 35、卡片宽度 330、卡片高度 140、视图缩放 1。
- 卡片图片使用父 Segment 封面；补充内容继承所属 Segment 的封面。
- 卡片文本显示标题、录音/笔记类型和正文/转录摘要，摘要从 Markdown 正文或 `## Transcript` 提取，控制在约 20-30 个文字。
- Hover 到某张卡片时，该卡片所在行停止转动，其它行继续。
- 画廊只展示 `audio` 与 `note`，不展示 `artifact`。
- 点击卡片复用现有近期表达打开逻辑，进入对应 Memory Studio 并聚焦 Segment 或 Supplement。
- 页面不显示额外的「画廊」标题、说明或状态文案；只保留无障碍名称。
- 真实本地数据进入画廊时不能卡死或持续触发 Chromium tile memory warning。
- 自定义封面加载失败时回退到 Segment 默认封面，不显示破碎图片或 alt 文本。
- 真实内容不足 50 个球面槽位时用骨架卡片补齐；用户点击非真实内容卡片区域可拖动球面左右旋转。

## 实现模型

- 数据层复用 `workspace:readRecentExpressions`，不新增 IPC channel。
- 扩展 recent expression item 的可选 `preview` 和 `cover` 投影；`cover` 取父 Segment cover。
- Renderer 新增 feature-local 画廊组件，使用 `requestAnimationFrame` + refs 做 3D transform，effect cleanup 取消 animation frame。
- Mousemove 视差不进入 React state，只通过 rAF 批量写入 stage transform。
- Recent expression feed 支持 request-side `contentKinds`；Home 请求全部类型，Gallery 请求 `audio` / `note`，main 在排序和 limit 前过滤，避免 artifact 挤掉真实录音/笔记。
- 画廊 query 在 Home 与 Gallery 顶层入口按各自 query key 启用；Gallery upstream 读取最多 300 条 audio/note recent expressions，renderer 固定 50 个球面物理槽位，超过 50 条通过行窗口偏移进入视野。
- 画廊只为前景卡片立即加载封面，其余封面分批加载；不在转到背面时反复卸载封面。
- 球面运动由 5 个行容器承担，每帧只更新行容器 transform；卡片自身使用静态球面位置 transform，避免 50 张卡片每帧写 style。
- Hover/click hit-test 先按球面行模型定位，再只测当前行及相邻行的前景卡片；`reo-attachment` 的普通附件与 artifact 仍只解析 active workspace root，Memory cover 仍 active-only，Segment cover route 单独允许从 system Draft 或 registry root 解析，用于全局画廊跨空间封面展示。

## 验证计划

- Focused main RED/GREEN：recent feed 返回 preview、cover，并过滤作品。
- Focused renderer/component：画廊渲染音频/笔记卡片、过滤作品、hover 暂停行、点击回调。
- App workflow targeted：点击 sidebar「画廊」显示真实画廊，并点击卡片打开对应对象。
- Runtime 视觉检查：打开本地 Electron/dev 场景或 browser 场景确认非空、卡片运动、hover 暂停。
- 收口前运行 `npm run verify:quick`。

## 验证证据

- Targeted tests: `typecheck:quick`、`test:main` focused recent expressions / protocol / system Draft、Gallery model、Gallery component、App workflow 全部通过。
- Runtime Gallery: `npm run dev` + Electron DevTools 协议真实打开；本地 recent feed 63 条，其中 Gallery 过滤后 45 条 note/audio、0 条 artifact、0 skipped；页面固定 5 行、50 槽位、45 张真实卡片、5 张骨架。
- Runtime covers/layout: 45/45 封面图片完成加载，placeholder 0，broken image 0；卡片内部固定 330x140、封面 96x96、文本列不溢出；页面 section 无额外「画廊」标题或状态文案。
- Runtime interaction: 5 行 hover 均能暂停当前行且其它行继续；空白区域拖动移动 5 行；动画采样 180 帧，p95 约 9.8ms，max 约 10.2ms；非中间行 `录音4` 点击后选中对应片段。
- Prompt copy regression: 真实 Electron 中验证 artifact create segment、artifact create supplement、widget create、needs-review 四类 bridge 复制，主机 `pbpaste` 均包含对应安全提示词；UI 首页「造出来」真实鼠标点击后剪贴板为创建作品片段提示词。
