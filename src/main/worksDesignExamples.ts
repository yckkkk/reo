// Golden examples for the reo-works-design skill.
//
// Each entry is a self-contained, runnable `entry.html` that demonstrates ONE
// reusable explorable mechanism (source state -> pure derive -> render) dressed
// as a believable Reo work, on the Reo-aligned design tokens. Agents read the
// closest example and adapt it; the mechanism is the reusable part, the skin is
// a starting point, not a ceiling.
//
// These are materialized into `skills/reo-works-design/examples/` per memory
// space alongside the design references. Authoring constraint: the embedded HTML
// must not contain backticks or dollar-brace interpolation markers so it can
// live in a template literal here.

const REACTIVE_BINDING_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>复习强度</title>
<style>
  :root{
    --color-background-primary:#ffffff;--color-background-secondary:#f4f4f5;
    --color-text-primary:#18181b;--color-text-secondary:#3f3f46;--color-text-tertiary:#71717a;
    --color-border-tertiary:rgba(24,24,27,0.08);--color-border-secondary:rgba(24,24,27,0.14);
    --border-radius-sm:8px;--border-radius-lg:16px;
    --shadow-card:0 1px 2px rgba(17,24,39,0.04),0 2px 8px rgba(17,24,39,0.05);
    --font-sans:"Waldenburg","Inter",ui-sans-serif,system-ui,-apple-system,sans-serif;
    --teal-100:#9FE1CB;--teal-600:#1D9E75;--teal-800:#085041;
  }
  @media (prefers-color-scheme:dark){:root{
    --color-background-primary:#09090b;--color-background-secondary:#18181b;
    --color-text-primary:#fafafa;--color-text-secondary:#d4d4d8;--color-text-tertiary:#a1a1aa;
    --color-border-tertiary:rgba(255,255,255,0.10);--color-border-secondary:rgba(255,255,255,0.16);
    --shadow-card:0 1px 2px rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.34);
    --teal-100:#04342C;--teal-600:#5DCAA5;--teal-800:#9FE1CB;
  }}
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--font-sans);font-size:14px;line-height:1.6;color:var(--color-text-primary);background:var(--color-background-primary)}
  .work{max-width:560px;margin:0 auto;padding:24px 20px;min-width:0}
  h1{font-size:20px;font-weight:500;margin:0 0 4px}
  .caption{margin:0 0 20px;font-size:13px;color:var(--color-text-tertiary)}
  .row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
  .stepper{display:inline-flex;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-sm);overflow:hidden}
  .stepper button{border:0;background:var(--color-background-secondary);color:var(--color-text-primary);font-size:16px;width:34px;height:34px;cursor:pointer}
  input[type=range]{flex:1;min-width:0;accent-color:var(--teal-600)}
  .val{font-variant-numeric:tabular-nums;font-weight:500;min-width:34px;text-align:right}
  .chips{display:flex;gap:8px;margin-bottom:18px}
  .chip{border:0.5px solid var(--color-border-secondary);background:var(--color-background-primary);color:var(--color-text-secondary);border-radius:var(--border-radius-sm);padding:6px 12px;font-size:13px;cursor:pointer}
  .chip[aria-pressed=true]{background:var(--teal-100);color:var(--teal-800);border-color:transparent}
  .card{background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);box-shadow:var(--shadow-card);padding:16px}
  .bar{height:10px;border-radius:999px;background:var(--color-border-tertiary);overflow:hidden;margin:2px 0 12px}
  .bar>span{display:block;height:100%;background:var(--teal-600);border-radius:999px;transition:width .15s ease}
  .out{display:flex;justify-content:space-between;align-items:baseline}
  .out .big{font-size:24px;font-weight:500;font-variant-numeric:tabular-nums}
  .status{font-size:13px;color:var(--color-text-secondary)}
</style>
</head>
<body>
<main class="work">
  <h1>复习强度</h1>
  <p class="caption">同一个掌握度，用滑块、加减或预设都能调；进度、状态和建议间隔都是它的投影。</p>
  <div class="row">
    <div class="stepper"><button id="dec" type="button" aria-label="减少">−</button><button id="inc" type="button" aria-label="增加">+</button></div>
    <input id="range" type="range" min="0" max="100" step="1" value="50" aria-label="掌握度" />
    <span class="val" id="val">50</span>
  </div>
  <div class="chips" role="group" aria-label="预设">
    <button class="chip" type="button" data-v="20">生疏</button>
    <button class="chip" type="button" data-v="50">熟悉</button>
    <button class="chip" type="button" data-v="80">牢固</button>
  </div>
  <div class="card">
    <div class="bar"><span id="fill"></span></div>
    <div class="out"><span class="status" id="status">熟悉</span><span class="big"><span id="days">7</span> 天后复习</span></div>
  </div>
</main>
<script>
  // 源状态：唯一真值
  var state={strength:50};
  // 派生：纯函数，从源算出间隔与状态
  function derive(s){
    return {
      interval: Math.round(1 + s.strength / 100 * 13),
      status: s.strength < 34 ? '生疏' : s.strength < 67 ? '熟悉' : '牢固'
    };
  }
  // 渲染：把源 + 派生投影到每个控件与读数
  function id(x){return document.getElementById(x);}
  function render(){
    var d=derive(state);
    id('range').value=state.strength;
    id('val').textContent=state.strength;
    id('fill').style.width=state.strength+'%';
    id('status').textContent=d.status;
    id('days').textContent=d.interval;
    var chips=document.querySelectorAll('.chip');
    for(var i=0;i<chips.length;i++){chips[i].setAttribute('aria-pressed',String(Number(chips[i].dataset.v)===state.strength));}
  }
  // 事件：每个入口只改源，再重渲染（双向绑定）
  function setStrength(v){state.strength=Math.max(0,Math.min(100,Math.round(v)));render();}
  id('range').addEventListener('input',function(e){setStrength(Number(e.target.value));});
  id('inc').addEventListener('click',function(){setStrength(state.strength+5);});
  id('dec').addEventListener('click',function(){setStrength(state.strength-5);});
  var chips=document.querySelectorAll('.chip');
  for(var i=0;i<chips.length;i++){chips[i].addEventListener('click',function(e){setStrength(Number(e.currentTarget.dataset.v));});}
  render();
</script>
</body>
</html>
`;

const DERIVE_CHAIN_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>复习计划测算</title>
<style>
  :root{
    --color-background-primary:#ffffff;--color-background-secondary:#f4f4f5;
    --color-text-primary:#18181b;--color-text-secondary:#3f3f46;--color-text-tertiary:#71717a;
    --color-border-tertiary:rgba(24,24,27,0.08);
    --border-radius-md:12px;--border-radius-lg:16px;
    --shadow-card:0 1px 2px rgba(17,24,39,0.04),0 2px 8px rgba(17,24,39,0.05);
    --font-sans:"Waldenburg","Inter",ui-sans-serif,system-ui,-apple-system,sans-serif;
    --purple-600:#534AB7;--purple-800:#3C3489;
  }
  @media (prefers-color-scheme:dark){:root{
    --color-background-primary:#09090b;--color-background-secondary:#18181b;
    --color-text-primary:#fafafa;--color-text-secondary:#d4d4d8;--color-text-tertiary:#a1a1aa;
    --color-border-tertiary:rgba(255,255,255,0.10);
    --shadow-card:0 1px 2px rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.34);
    --purple-600:#7F77DD;--purple-800:#CECBF6;
  }}
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--font-sans);font-size:14px;line-height:1.6;color:var(--color-text-primary);background:var(--color-background-primary)}
  .work{max-width:600px;margin:0 auto;padding:24px 20px;min-width:0}
  h1{font-size:20px;font-weight:500;margin:0 0 4px}
  .caption{margin:0 0 18px;font-size:13px;color:var(--color-text-tertiary)}
  .controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 24px;margin-bottom:18px}
  .control{min-width:0}
  .clab{display:flex;justify-content:space-between;font-size:13px;color:var(--color-text-secondary);margin-bottom:4px}
  .clab b{color:var(--color-text-primary);font-variant-numeric:tabular-nums}
  input[type=range]{width:100%;accent-color:var(--purple-600)}
  .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px}
  .metric{background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);box-shadow:var(--shadow-card);padding:12px 14px;min-width:0}
  .metric .l{font-size:12px;color:var(--color-text-tertiary);margin-bottom:4px}
  .metric .v{font-size:22px;font-weight:500;font-variant-numeric:tabular-nums}
  .metric .v .u{font-size:13px;color:var(--color-text-secondary);margin-left:2px}
  svg{width:100%;height:auto;display:block}
  .track{stroke:var(--color-border-tertiary);stroke-width:6;stroke-linecap:round}
  .fill{stroke:var(--purple-600);stroke-width:6;stroke-linecap:round}
  .tick{fill:var(--purple-800)}
  .ticklabel{fill:var(--color-text-tertiary);font-size:11px;font-family:var(--font-sans);text-anchor:middle}
</style>
</head>
<body>
<main class="work">
  <h1>复习计划测算</h1>
  <p class="caption">每天投入多少、要复习多少张卡，决定完成天数与里程碑——都是这两个源变量的派生。</p>
  <div class="controls">
    <div class="control">
      <div class="clab"><span>每天投入</span><b id="o-min">40 分钟</b></div>
      <input id="min" type="range" min="10" max="120" step="5" value="40" aria-label="每天投入分钟" />
    </div>
    <div class="control">
      <div class="clab"><span>卡片总量</span><b id="o-total">240 张</b></div>
      <input id="total" type="range" min="60" max="600" step="20" value="240" aria-label="卡片总量" />
    </div>
  </div>
  <div class="metrics">
    <div class="metric"><div class="l">每天可复习</div><div class="v"><span id="m-per">20</span><span class="u">张</span></div></div>
    <div class="metric"><div class="l">预计完成</div><div class="v"><span id="m-days">12</span><span class="u">天</span></div></div>
    <div class="metric"><div class="l">约</div><div class="v"><span id="m-weeks">1.7</span><span class="u">周</span></div></div>
  </div>
  <svg viewBox="0 0 600 70" role="img" aria-label="里程碑时间轴">
    <line class="track" x1="20" y1="30" x2="580" y2="30" />
    <line class="fill" x1="20" y1="30" x2="580" y2="30" />
    <g id="ticks"></g>
  </svg>
</main>
<script>
  var MIN_PER_CARD=2;
  var state={dailyMin:40,total:240};
  // 派生链：源 -> 每天张数 -> 天数 -> 周数 -> 里程碑天
  function derive(s){
    var perDay=Math.max(1,Math.floor(s.dailyMin/MIN_PER_CARD));
    var days=Math.ceil(s.total/perDay);
    var marks=[0.25,0.5,0.75,1].map(function(p){return {p:p,day:Math.ceil(s.total*p/perDay)};});
    return {perDay:perDay,days:days,weeks:days/7,marks:marks};
  }
  function id(x){return document.getElementById(x);}
  function render(){
    var d=derive(state);
    id('o-min').textContent=state.dailyMin+' 分钟';
    id('o-total').textContent=state.total+' 张';
    id('m-per').textContent=d.perDay;
    id('m-days').textContent=d.days;
    id('m-weeks').textContent=d.weeks.toFixed(1);
    var x=function(day){return 20+(day/d.days)*560;};
    var g=id('ticks');g.textContent='';
    var svgns='http://www.w3.org/2000/svg';
    d.marks.forEach(function(m){
      var cx=x(m.day),last=m.p>=1;
      var c=document.createElementNS(svgns,'circle');
      c.setAttribute('class','tick');c.setAttribute('cx',cx.toFixed(1));c.setAttribute('cy','30');c.setAttribute('r','4');
      g.appendChild(c);
      var t=document.createElementNS(svgns,'text');
      t.setAttribute('class','ticklabel');
      t.setAttribute('x',(last?Math.min(cx,582):cx).toFixed(1));
      t.setAttribute('y','54');
      if(last)t.setAttribute('style','text-anchor:end');
      t.textContent=Math.round(m.p*100)+'% · 第'+m.day+'天';
      g.appendChild(t);
    });
  }
  id('min').addEventListener('input',function(e){state.dailyMin=Number(e.target.value);render();});
  id('total').addEventListener('input',function(e){state.total=Number(e.target.value);render();});
  render();
</script>
</body>
</html>
`;

const NUMBER_LINE_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>目标分档</title>
<style>
  :root{
    --color-background-primary:#ffffff;--color-background-secondary:#f4f4f5;
    --color-text-primary:#18181b;--color-text-secondary:#3f3f46;--color-text-tertiary:#71717a;
    --color-border-tertiary:rgba(24,24,27,0.08);--color-border-secondary:rgba(24,24,27,0.14);
    --border-radius-lg:16px;
    --shadow-card:0 1px 2px rgba(17,24,39,0.04),0 2px 8px rgba(17,24,39,0.05);
    --font-sans:"Waldenburg","Inter",ui-sans-serif,system-ui,-apple-system,sans-serif;
    --coral-100:#F5C4B3;--coral-600:#D85A30;--coral-800:#712B13;
  }
  @media (prefers-color-scheme:dark){:root{
    --color-background-primary:#09090b;--color-background-secondary:#18181b;
    --color-text-primary:#fafafa;--color-text-secondary:#d4d4d8;--color-text-tertiary:#a1a1aa;
    --color-border-tertiary:rgba(255,255,255,0.10);--color-border-secondary:rgba(255,255,255,0.16);
    --shadow-card:0 1px 2px rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.34);
    --coral-100:#4A1B0C;--coral-600:#F0997B;--coral-800:#F5C4B3;
  }}
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--font-sans);font-size:14px;line-height:1.6;color:var(--color-text-primary);background:var(--color-background-primary)}
  .work{max-width:600px;margin:0 auto;padding:24px 20px;min-width:0}
  h1{font-size:20px;font-weight:500;margin:0 0 4px}
  .caption{margin:0 0 16px;font-size:13px;color:var(--color-text-tertiary)}
  .card{background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);box-shadow:var(--shadow-card);padding:14px 14px 8px}
  svg{width:100%;height:auto;display:block;touch-action:none}
  svg:focus{outline:none}
  svg:focus-visible .cursor{stroke:var(--coral-800);stroke-width:2}
  .axis{stroke:var(--color-border-secondary);stroke-width:1.5}
  .bucket{stroke:var(--color-border-secondary);stroke-width:1}
  .bucket.near{stroke:var(--coral-600);stroke-width:2}
  .blabel{fill:var(--color-text-tertiary);font-size:11px;font-family:var(--font-sans);text-anchor:middle}
  .blabel.near{fill:var(--coral-800);font-weight:500}
  .scalecap{fill:var(--color-text-tertiary);font-size:11px;font-family:var(--font-sans);text-anchor:start}
  .link{stroke:var(--coral-600);stroke-width:1.5;stroke-dasharray:3 3}
  .cursor{fill:var(--coral-600);cursor:grab}
  .cursor:active{cursor:grabbing}
  .read{display:flex;justify-content:space-between;align-items:baseline;margin-top:10px}
  .read .big{font-size:22px;font-weight:500;font-variant-numeric:tabular-nums}
  .hint{font-size:12px;color:var(--color-text-tertiary)}
</style>
</head>
<body>
<main class="work">
  <h1>目标分档</h1>
  <p class="caption">把一个连续目标值映射到最近的里程碑档位。拖动圆点，或聚焦后用左右方向键。</p>
  <div class="card">
    <svg id="svg" viewBox="0 0 600 150" role="slider" tabindex="0" aria-label="目标值 0 到 100" aria-valuemin="0" aria-valuemax="100" aria-valuenow="62">
      <text class="scalecap" x="40" y="26">目标</text>
      <line class="axis" x1="40" y1="46" x2="560" y2="46" />
      <line id="link" class="link" x1="0" y1="46" x2="0" y2="104" />
      <circle id="cursor" class="cursor" cx="0" cy="46" r="8" />
      <text class="scalecap" x="40" y="92">档位</text>
      <line class="axis" x1="40" y1="104" x2="560" y2="104" />
      <g id="buckets"></g>
    </svg>
    <div class="read"><span class="big" id="r-target">62</span><span class="hint">最接近：<span id="r-bucket">熟练</span></span></div>
  </div>
</main>
<script>
  var BUCKETS=[{v:0,name:'起步'},{v:25,name:'入门'},{v:50,name:'熟练'},{v:75,name:'精通'},{v:100,name:'大师'}];
  var X0=40,X1=560;
  var state={target:62};
  function x(v){return X0+v/100*(X1-X0);}
  // 派生：最近档位
  function derive(s){
    var best=BUCKETS[0];
    for(var i=1;i<BUCKETS.length;i++){if(Math.abs(BUCKETS[i].v-s.target)<Math.abs(best.v-s.target))best=BUCKETS[i];}
    return {nearest:best};
  }
  function id(x){return document.getElementById(x);}
  function render(){
    var d=derive(state),cx=x(state.target);
    id('cursor').setAttribute('cx',cx.toFixed(1));
    id('link').setAttribute('x1',cx.toFixed(1));
    id('link').setAttribute('x2',x(d.nearest.v).toFixed(1));
    id('r-target').textContent=Math.round(state.target);
    id('r-bucket').textContent=d.nearest.name;
    var svg=id('svg');
    svg.setAttribute('aria-valuenow',String(Math.round(state.target)));
    svg.setAttribute('aria-valuetext',Math.round(state.target)+'，最接近'+d.nearest.name);
    var g=id('buckets');g.textContent='';
    var svgns='http://www.w3.org/2000/svg';
    BUCKETS.forEach(function(b){
      var bx=x(b.v),near=b===d.nearest;
      var tick=document.createElementNS(svgns,'line');
      tick.setAttribute('class','bucket'+(near?' near':''));
      tick.setAttribute('x1',bx.toFixed(1));tick.setAttribute('x2',bx.toFixed(1));
      tick.setAttribute('y1','98');tick.setAttribute('y2','110');
      g.appendChild(tick);
      var lab=document.createElementNS(svgns,'text');
      lab.setAttribute('class','blabel'+(near?' near':''));
      lab.setAttribute('x',bx.toFixed(1));lab.setAttribute('y','128');
      lab.textContent=b.name;
      g.appendChild(lab);
    });
  }
  function setTarget(v){state.target=Math.max(0,Math.min(100,v));render();}
  function fromClientX(clientX){
    var svg=id('svg'),rect=svg.getBoundingClientRect();
    var px=(clientX-rect.left)/rect.width*600;
    return (px-X0)/(X1-X0)*100;
  }
  var dragging=false,svg=id('svg');
  svg.addEventListener('pointerdown',function(e){dragging=true;svg.setPointerCapture(e.pointerId);setTarget(fromClientX(e.clientX));});
  svg.addEventListener('pointermove',function(e){if(dragging)setTarget(fromClientX(e.clientX));});
  svg.addEventListener('pointerup',function(){dragging=false;});
  svg.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'){setTarget(state.target+(e.shiftKey?10:1));e.preventDefault();}
    else if(e.key==='ArrowLeft'){setTarget(state.target-(e.shiftKey?10:1));e.preventDefault();}
  });
  render();
</script>
</body>
</html>
`;

const ZOOMABLE_SERIES_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>复习偏差</title>
<style>
  :root{
    --color-background-primary:#ffffff;--color-background-secondary:#f4f4f5;
    --color-text-primary:#18181b;--color-text-secondary:#3f3f46;--color-text-tertiary:#71717a;
    --color-border-tertiary:rgba(24,24,27,0.08);--color-border-secondary:rgba(24,24,27,0.14);
    --border-radius-md:12px;--border-radius-lg:16px;
    --shadow-card:0 1px 2px rgba(17,24,39,0.04),0 2px 8px rgba(17,24,39,0.05);
    --font-sans:"Waldenburg","Inter",ui-sans-serif,system-ui,-apple-system,sans-serif;
    --teal-600:#1D9E75;--coral-600:#D85A30;
  }
  @media (prefers-color-scheme:dark){:root{
    --color-background-primary:#09090b;--color-background-secondary:#18181b;
    --color-text-primary:#fafafa;--color-text-secondary:#d4d4d8;--color-text-tertiary:#a1a1aa;
    --color-border-tertiary:rgba(255,255,255,0.10);--color-border-secondary:rgba(255,255,255,0.16);
    --shadow-card:0 1px 2px rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.34);
    --teal-600:#5DCAA5;--coral-600:#F0997B;
  }}
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--font-sans);font-size:14px;line-height:1.6;color:var(--color-text-primary);background:var(--color-background-primary)}
  .work{max-width:600px;margin:0 auto;padding:24px 20px;min-width:0}
  h1{font-size:20px;font-weight:500;margin:0 0 4px}
  .caption{margin:0 0 16px;font-size:13px;color:var(--color-text-tertiary)}
  .bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:14px}
  .zoom{display:inline-flex;border:0.5px solid var(--color-border-secondary);border-radius:8px;overflow:hidden}
  .zoom button{border:0;background:var(--color-background-secondary);color:var(--color-text-secondary);padding:6px 12px;font-size:13px;cursor:pointer}
  .zoom button[aria-pressed=true]{background:var(--teal-600);color:#fff}
  .shift{display:flex;align-items:center;gap:8px;flex:1;min-width:160px}
  .shift input{flex:1;min-width:0;accent-color:var(--coral-600)}
  .legend{display:flex;gap:16px;font-size:12px;color:var(--color-text-secondary);margin-bottom:6px}
  .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}
  .plot{background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);box-shadow:var(--shadow-card);padding:12px}
  svg{width:100%;height:auto;display:block}
  .zero{stroke:var(--color-border-secondary);stroke-width:1;stroke-dasharray:4 4}
  .zerolabel{fill:var(--color-text-tertiary);font-size:11px;font-family:var(--font-sans);text-anchor:end}
  .dev{fill:none;stroke:var(--color-text-secondary);stroke-width:2;stroke-linejoin:round}
  .metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
  .metric{background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);box-shadow:var(--shadow-card);padding:12px 14px}
  .metric .l{font-size:12px;color:var(--color-text-tertiary);margin-bottom:4px}
  .metric .v{font-size:22px;font-weight:500;font-variant-numeric:tabular-nums}
  .metric .v .u{font-size:13px;color:var(--color-text-secondary);margin-left:2px}
</style>
</head>
<body>
<main class="work">
  <h1>复习偏差</h1>
  <p class="caption">每天实际比计划多或少多少张。多数日子贴近 0，放大纵轴才能看清；拖动平移做整体 what-if。</p>
  <div class="bar">
    <div class="zoom" role="group" aria-label="纵向放大">
      <button type="button" data-z="1" aria-pressed="true">1×</button>
      <button type="button" data-z="4" aria-pressed="false">4×</button>
      <button type="button" data-z="16" aria-pressed="false">16×</button>
    </div>
    <label class="shift">平移<input id="shift" type="range" min="-2" max="2" step="0.25" value="0" aria-label="整体平移" /><span id="o-shift" style="font-variant-numeric:tabular-nums;min-width:40px;text-align:right">+0.0</span></label>
  </div>
  <div class="plot">
    <div class="legend"><span><i style="background:var(--teal-600)"></i>超前</span><span><i style="background:var(--coral-600)"></i>落后</span></div>
    <svg viewBox="0 0 600 220" role="img" aria-label="每天复习相对计划的偏差">
      <line class="zero" x1="36" y1="106" x2="588" y2="106" />
      <text class="zerolabel" x="34" y="110">0</text>
      <path id="dev" class="dev" d="" />
      <g id="dots"></g>
    </svg>
  </div>
  <div class="metrics">
    <div class="metric"><div class="l">平均偏差</div><div class="v"><span id="m-dev">0.00</span><span class="u">张/天</span></div></div>
    <div class="metric"><div class="l">净偏差</div><div class="v"><span id="m-net">+0.0</span><span class="u">张</span></div></div>
  </div>
</main>
<script>
  // 每天实际−计划的偏差，多数贴近 0：1× 看整体，放大才看清近 0 的日子
  var DIFF=[0.2,-0.4,0.9,-0.1,-0.8,1.4,-0.3,0.15,1.1,-1.3,0.4,0.95,-0.2,0.5];
  var N=DIFF.length,L=36,R=588,T=16,B=196,MID=106;
  var maxBase=2; for(var i=0;i<N;i++){maxBase=Math.max(maxBase,Math.abs(DIFF[i]));}
  maxBase+=2; // 给平移留出范围，保证 1× 不裁切
  var basePx=((B-MID)-8)/maxBase;
  var state={zoom:1,shift:0};
  function X(i){return L+i/(N-1)*(R-L);}
  // 坐标变换：缩放围绕 0 基线放大纵向偏差，并裁切到画布内
  function Y(d){return Math.max(T,Math.min(B,MID-d*basePx*state.zoom));}
  // 派生：平移后的偏差序列 + 度量
  function derive(s){
    var series=DIFF.map(function(v){return v+s.shift;});
    var sumAbs=0,net=0;
    for(var i=0;i<N;i++){sumAbs+=Math.abs(series[i]);net+=series[i];}
    return {series:series,meanAbs:sumAbs/N,net:net};
  }
  function pathFor(a){var d='';for(var i=0;i<N;i++){d+=(i===0?'M':'L')+X(i).toFixed(1)+' '+Y(a[i]).toFixed(1)+' ';}return d.trim();}
  function id(x){return document.getElementById(x);}
  function render(){
    var d=derive(state),a=d.series;
    id('dev').setAttribute('d',pathFor(a));
    var dots=id('dots');dots.textContent='';var ns='http://www.w3.org/2000/svg';
    for(var i=0;i<N;i++){
      var c=document.createElementNS(ns,'circle');
      c.setAttribute('cx',X(i).toFixed(1));c.setAttribute('cy',Y(a[i]).toFixed(1));c.setAttribute('r','2.5');
      c.setAttribute('fill',a[i]>=0?'var(--teal-600)':'var(--coral-600)');
      dots.appendChild(c);
    }
    id('o-shift').textContent=(state.shift>=0?'+':'')+state.shift.toFixed(1);
    id('m-dev').textContent=d.meanAbs.toFixed(2);
    id('m-net').textContent=(d.net>=0?'+':'')+d.net.toFixed(1);
  }
  var zb=document.querySelectorAll('.zoom button');
  for(var i=0;i<zb.length;i++){zb[i].addEventListener('click',function(e){
    state.zoom=Number(e.currentTarget.dataset.z);
    for(var j=0;j<zb.length;j++){zb[j].setAttribute('aria-pressed',String(zb[j]===e.currentTarget));}
    render();
  });}
  id('shift').addEventListener('input',function(e){state.shift=Number(e.target.value);render();});
  render();
</script>
</body>
</html>
`;

const RAIL_WIDGET_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>今日复习</title>
<style>
  :root{
    --color-background-primary:#ffffff;--color-background-secondary:#f4f4f5;
    --color-text-primary:#18181b;--color-text-secondary:#3f3f46;--color-text-tertiary:#71717a;
    --color-border-tertiary:rgba(24,24,27,0.08);--color-border-secondary:rgba(24,24,27,0.14);
    --border-radius-md:12px;
    --shadow-card:0 1px 2px rgba(17,24,39,0.04),0 2px 8px rgba(17,24,39,0.05);
    --font-sans:"Waldenburg","Inter",ui-sans-serif,system-ui,-apple-system,sans-serif;
    --teal-600:#1D9E75;
  }
  @media (prefers-color-scheme:dark){:root{
    --color-background-primary:#09090b;--color-background-secondary:#18181b;
    --color-text-primary:#fafafa;--color-text-secondary:#d4d4d8;--color-text-tertiary:#a1a1aa;
    --color-border-tertiary:rgba(255,255,255,0.10);--color-border-secondary:rgba(255,255,255,0.16);
    --shadow-card:0 1px 2px rgba(0,0,0,0.4),0 2px 10px rgba(0,0,0,0.34);
    --teal-600:#5DCAA5;
  }}
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--font-sans);font-size:14px;line-height:1.5;color:var(--color-text-primary);background:transparent}
  /* 窄栏常驻：min-width:0 + 自适应，保证 240px 不溢出 */
  .widget{padding:14px;min-width:0}
  .title{font-size:13px;font-weight:500;color:var(--color-text-secondary);margin:0 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .source{font-size:11px;color:var(--color-text-tertiary);margin:0 0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ring{display:block;width:100%;max-width:140px;height:auto;margin:0 auto}
  .ring-bg{fill:none;stroke:var(--color-border-tertiary);stroke-width:10}
  .ring-fg{fill:none;stroke:var(--teal-600);stroke-width:10;stroke-linecap:round;transition:stroke-dashoffset .2s ease}
  .pct{fill:var(--color-text-primary);font-size:22px;font-weight:500;text-anchor:middle;font-family:var(--font-sans)}
  .sub{fill:var(--color-text-tertiary);font-size:9px;text-anchor:middle;font-family:var(--font-sans)}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;min-width:0}
  .foot span{font-size:12px;color:var(--color-text-secondary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .foot button{border:0.5px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;white-space:nowrap}
  .foot button:disabled{opacity:.5;cursor:default}
</style>
</head>
<body>
<main class="widget">
  <p class="title">今日复习</p>
  <p class="source">本记忆空间 · 间隔复习</p>
  <svg class="ring" viewBox="0 0 120 120" role="img" aria-label="今日复习进度">
    <circle class="ring-bg" cx="60" cy="60" r="50" />
    <circle id="fg" class="ring-fg" cx="60" cy="60" r="50" transform="rotate(-90 60 60)" stroke-dasharray="314.16" stroke-dashoffset="314.16" />
    <text id="pct" class="pct" x="60" y="62">0%</text>
    <text id="sub" class="sub" x="60" y="78">0 / 24</text>
  </svg>
  <div class="foot"><span id="left">还剩 24 张</span><button id="plus" type="button">复习一张</button></div>
</main>
<script>
  var C=2*Math.PI*50; // 周长
  var state={done:0,total:24};
  function derive(s){return {ratio:s.total?s.done/s.total:0,left:Math.max(0,s.total-s.done)};}
  function id(x){return document.getElementById(x);}
  function render(){
    var d=derive(state);
    id('fg').setAttribute('stroke-dashoffset',(C*(1-d.ratio)).toFixed(2));
    id('pct').textContent=Math.round(d.ratio*100)+'%';
    id('sub').textContent=state.done+' / '+state.total;
    id('left').textContent=d.left===0?'今天完成了':'还剩 '+d.left+' 张';
    id('plus').disabled=d.left===0;
  }
  id('plus').addEventListener('click',function(){state.done=Math.min(state.total,state.done+1);render();});
  render();
</script>
</body>
</html>
`;

export const DEFAULT_REO_WORKS_DESIGN_EXAMPLE_FILES = {
  'reactive-binding.html': REACTIVE_BINDING_HTML,
  'derive-chain.html': DERIVE_CHAIN_HTML,
  'number-line.html': NUMBER_LINE_HTML,
  'zoomable-series.html': ZOOMABLE_SERIES_HTML,
  'rail-widget.html': RAIL_WIDGET_HTML,
} as const;
