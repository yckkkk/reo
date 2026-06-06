# Reo works explorables

用这份参考做任何「可探索解释」：滑块、步进、可拖动值、缩放、切换，让用户试 what-if 或看清实时因果。最好的可交互作品不是图表库，而是一台很小的反应式机器。

## 模型：source -> derive -> render

每个 explorable 都是同一个回路：

- sourceState：1–2 个独立源变量，是唯一真值（一个数值、计数、平移量、缩放档）。
- derive(s)：纯函数，从源算出要显示的一切（前向计算、最近值、留存、偏差、KL/重合度量）。不碰 DOM、无副作用。
- render(model)：把派生模型投影到 DOM / SVG / canvas。
- 事件：每个控件只改 sourceState，再调用 render。多个控件、多个视图可以共享同一个源——这就是双向绑定。

为什么重要：它让一个丰富的交互作品仍然简单。按**独立源变量个数**计预算（目标 1–2 个），不是按控件或视图个数。一个源投影成滑块 + 曲线 + 三个读数仍然简单；三个互不相关的控件才复杂。

```js
var state = { x: 0 };                       // 源
function derive(s){ return { y: f(s.x) }; } // 纯派生
function render(){ var d = derive(state); /* 投影到 DOM/SVG */ }
control.addEventListener('input', function(e){ state.x = Number(e.target.value); render(); });
render();
```

## 交互 SVG 的坐标系

- 用固定 viewBox（如 `0 0 600 H`）+ `width:100%` 让它自适应；每个位置都从源/派生值算出，不手摆。
- 值→屏幕是一个函数：`screenY = top + (1 - value) * plotH`，或带缩放 `mid - value * pxPerUnit * zoom`。保持纯函数，路径和标记复用同一个。
- 把映射后的坐标 clamp 到绘图框内，缩放或大值才不会溢出。
- 在 render() 里用 setAttribute 重建 SVG 几何，不要逐帧动画。

## 五个可复用机制

每个机制都有 `examples/` 里的黄金范例。读最接近的那个并改写——机制是可复用的，外皮只是起点，可以走更远。

1. 双向绑定：一个源值，多个同步控件 + 读数（滑块、步进、预设都写同一个值）。范例 `examples/reactive-binding.html`。
2. 派生链：一两个源经纯链算出多个输出和一个小可视化（前向计算）。范例 `examples/derive-chain.html`。
3. 数轴映射：连续源映射到 SVG 轴上最近的离散值；可拖动游标 + 方向键无障碍。范例 `examples/number-line.html`。
4. 缩放坐标变换：缩放源围绕中心放大数值轴，让细微差异可见；clamp 到绘图框。范例 `examples/zoomable-series.html`。
5. 平移上的实时度量：滑块平移一组序列，纯度量（偏差、重合度、KL 类）实时更新。范例 `examples/zoomable-series.html` 的平移 + 偏差/净偏差。

Widget 在窄栏里用同一套模型：见 `examples/rail-widget.html` 的响应式 SVG（viewBox + width:100%、min-width:0、ellipsis）。

## 纪律（默认，不是天花板）

- 静态内容在 JS 跑之前就要可读；JS 是增强，不是前提。
- 控件放在它驱动的可视化上方；当前值显示在旁边并格式化（`Math.round`、`toFixed`、`Intl.NumberFormat`）。
- 不用 animation loop；需要过渡时用 <200ms 的 CSS transition。
- 需要长期记住的用户状态写入 `state.json`（经 `window.reo.state`）；纯讲解器用内存状态即可。
- 这些机制可组合。当更丰富的交互更服务用户时就去做——只要保持一个真值源和一条 render 路径。
