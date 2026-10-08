// App Store product page header art for NumFall (run from the repo root: FONT=path/to/fredoka.woff2 node tools/appstore/header.js).
// Writes design/appstore/header-3840x1646.png and header-5244x2950.png.
const { chromium } = require('playwright'); const fs = require('fs');
const font = fs.readFileSync(process.env.FONT /* Fredoka (OFL) woff2, Latin subset */).toString('base64');
const COL = {1:['#FF6B7A','#FF97A2','#C94656'],2:['#FFB547','#FFCF85','#C9862A'],3:['#F5E663','#FAF29A','#BFB244'],
             4:['#6EE7A8','#A0F2C6','#3FB27A'],5:['#4FC3F7','#8ADAFB','#2E8DB8'],6:['#9D8CFF','#BDB2FF','#6F5ED1'],
             G:['#2A2F45','#353B57','#1D2134'],O:['#FFB547','#FFCF85','#C9862A'],B:['#4FC3F7','#8ADAFB','#2E8DB8']};
const SOL = [[1,2,3,4,5,6],[4,5,6,1,2,3],[2,3,1,5,6,4],[5,6,4,2,3,1],[3,1,2,6,4,5],[6,4,5,3,1,2]];
const H = [4,5,3,6,4,5];                                   // filled cells per column, from the bottom (gravity)
const PLAYER = new Set(['2,0','1,1','4,3','2,4','5,5','0,3','1,5','3,4','3,2','5,1']);
const tile = (v, x, y, s, kind, extra = '') => {
  const r = s * 0.27, box = `position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${r}px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:${s*0.56}px;line-height:1;${extra}`;
  if (kind === 'empty') return `<div style="${box}border:${Math.max(1.5,s*0.025)}px dashed rgba(255,255,255,.13);background:#1D2131"></div>`;
  if (kind === 'ghost') return `<div style="${box}border:${s*0.035}px dashed #F5E663;color:#D4CB6E;font-weight:600">${v}</div>`;
  const [c, l, e] = kind === 'given' ? COL.G : COL[kind] || COL[v];
  const given = kind === 'given';
  return `<div style="${box}background:linear-gradient(180deg,${l},${c} 60%);color:${kind==='given'?'#E6E9F2':'#13161F'};font-weight:${kind==='given'?500:600};box-shadow:inset 0 ${s*0.035}px 0 rgba(255,255,255,${kind==='given'?.07:.42}),0 ${s*0.065}px 0 ${e}${kind==='given'?'':`,0 ${s*0.15}px ${s*0.3}px rgba(0,0,0,.35)`}">${v}</div>`;
};
function scene(w, h, o) {
  const { s, bx, by, tx, ty, title, sub } = o, g = s*0.12, bg = s*0.1, pad = s*0.18;
  const cx = c => bx + pad + c*(s+g) + (c >= 3 ? bg : 0), cy = r => by + pad + r*(s+g) + Math.floor(r/2)*bg;
  const W = cx(5) + s + pad - bx, HH = cy(5) + s + pad - by;
  let out = `<div style="position:absolute;left:${bx}px;top:${by}px;width:${W}px;height:${HH}px;border-radius:${s*0.42}px;background:#161926;box-shadow:0 ${s*0.4}px ${s*1.2}px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)"></div>`;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    let kind = r >= 6 - H[c] ? (PLAYER.has(`${r},${c}`) ? 'player' : 'given') : 'empty';
    if (c === 0 && r === 1) kind = 'ghost';
    out += tile(kind === 'empty' ? '' : kind === 'ghost' ? 4 : SOL[r][c], cx(c), cy(r), s, kind);
  }
  const fall = (c, v, y) => `<div style="position:absolute;left:${cx(c)+s*0.22}px;top:${y-s*1.25}px;width:${s*0.56}px;height:${s*1.3}px;border-radius:${s*0.28}px;background:linear-gradient(180deg,transparent,${COL[v][0]}66)"></div>` + tile(v, cx(c), y, s, 'player');
  out += fall(0, 4, by - s*1.15) + fall(4, 2, by - s*2.1);
  const deco = [[.03,.1,3],[.42,.07,6],[.47,.8,1],[.97,.12,5],[.96,.78,2],[.06,.82,6],[.6,.04,4]]
    .map(([fx,fy,v]) => tile(v, fx*w - s*0.3, fy*h, s*0.6, 'player', 'opacity:.18;filter:blur(2px);transform:rotate(-9deg)')).join('');
  const m = title*0.42, mg = m*0.17;
  const mark = `<div style="position:relative;width:${2*m+mg}px;height:${2*m+mg}px;flex:none">`
    + tile('', m+mg, 0, m, 'O') + tile('', 0, m+mg, m, 'B')
    + tile('', m+mg, m+mg, m, 'given') + '</div>';
  return `<html><head><style>@font-face{font-family:F;font-weight:300 700;src:url(data:font/woff2;base64,${font})}
  body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:F;position:relative;
  background:radial-gradient(${w*0.42}px ${h*0.85}px at ${(bx+W/2)/w*100}% 55%,#302B72 0%,transparent 72%),radial-gradient(${w*0.4}px ${h*0.8}px at 18% 25%,#232A4D 0%,transparent 70%),linear-gradient(160deg,#181B2C,#0E1018)}</style></head>
  <body>
  <div style="position:absolute;left:${tx}px;top:${ty}px;color:#fff">
    <div style="display:flex;align-items:center;gap:${title*0.22}px">${mark}<div style="font-size:${title}px;font-weight:600;letter-spacing:-0.01em;line-height:1">NumFall</div></div>
    <div style="font-size:${sub}px;color:#BAC0D8;margin-top:${sub*0.8}px">Drop the numbers. Beat the clock.</div>
  </div>${out}</body></html>`;
}
(async () => {
  const b = await chromium.launch();
  const jobs = [
    { name: 'header-3840x1646', w: 1920, h: 823, o: { s: 74, bx: 1060, by: 225, tx: 300, ty: 300, title: 128, sub: 42 } },
    { name: 'header-5244x2950', w: 2622, h: 1475, o: { s: 128, bx: 1420, by: 360, tx: 330, ty: 560, title: 180, sub: 58 } },
  ];
  for (const j of jobs) {
    const pg = await (await b.newContext({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 2 })).newPage();
    await pg.setContent(scene(j.w, j.h, j.o)); await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: `design/appstore/${j.name}.png` });
  }
  await b.close();
})();
