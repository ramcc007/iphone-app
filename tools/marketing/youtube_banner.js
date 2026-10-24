// YouTube channel banner, 2560x1440. Logo, name and tagline sit inside YouTube's "safe on all devices" area (1546x423, centred);
// the falling tiles fill the parts that only TVs and desktops show.
// Run: NODE_PATH=$(npm root -g) FONT=design/icon/Fredoka.woff2 node tools/marketing/youtube_banner.js
const { chromium } = require('playwright'); const fs = require('fs');
const font = fs.readFileSync(process.env.FONT).toString('base64');
const COL = {1:['#FF6B7A','#FF97A2','#C94656'],2:['#FFB547','#FFCF85','#C9862A'],3:['#F5E663','#FAF29A','#BFB244'],4:['#6EE7A8','#A0F2C6','#3FB27A'],
  5:['#4FC3F7','#8ADAFB','#2E8DB8'],6:['#9D8CFF','#BDB2FF','#6F5ED1'],7:['#FF8AD8','#FFB3E6','#C25CA6'],8:['#2DD4BF','#7EE6D7','#1E9E8E'],G:['#2A3045','#363D57','#1C2030']};
const tile = (v, x, y, s, k, extra = '') => { const [c, l, e] = COL[k]; return `<div style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${s*.27}px;display:flex;align-items:center;justify-content:center;font-size:${s*.56}px;font-weight:600;line-height:1;background:linear-gradient(180deg,${l},${c} 60%);color:${k==='G'?'#E6E9F2':'#13161F'};box-shadow:inset 0 ${s*.035}px 0 rgba(255,255,255,.4),0 ${s*.065}px 0 ${e};${extra}">${v}</div>`; };
let rain = '';
const R = i => { const x = Math.sin(i * 91.7 + 13.1) * 43758.5; return x - Math.floor(x); };
for (let i = 0; i < 40; i++) {
  const x = R(i) * 1280, y = R(i + 50) * 720, s = 34 + R(i + 99) * 46, v = 1 + (i % 8);
  if (x > 200 && x < 1080 && y > 200 && y < 510) continue;             // keep the centre clear for the text
  const near = Math.abs(x - 640) < 560 && Math.abs(y - 360) < 230;
  rain += `<div style="position:absolute;left:${x}px;top:${y - s * 1.2}px;width:${s*.56}px;height:${s*1.2}px;margin-left:${s*.22}px;border-radius:${s*.3}px;background:linear-gradient(180deg,transparent,${COL[v][0]}55);opacity:${near ? .5 : .8}"></div>`;
  rain += tile(v, x, y, s, v, `opacity:${near ? .45 : .9};transform:rotate(${(R(i + 7) - .5) * 24}deg)`);
}
const m = 52, g = 9;
const mark = `<div style="position:relative;width:${2*m+g}px;height:${2*m+g}px;flex:none">${tile(4, m+g, 0, m, 2)}${tile(1, 0, m+g, m, 5)}${tile(3, m+g, m+g, m, 'G')}</div>`;
const html = `<html><head><style>@font-face{font-family:F;font-weight:300 700;src:url(data:font/woff2;base64,${font})}
body{margin:0;width:1280px;height:720px;overflow:hidden;font-family:F;position:relative;color:#fff;
background:radial-gradient(700px 360px at 50% 50%,#352a86 0%,transparent 70%),linear-gradient(160deg,#1A1A3A,#13161F 55%,#0E1018)}</style></head><body>${rain}
<div style="position:absolute;left:0;right:0;top:254px;height:212px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">
<div style="display:flex;align-items:center;gap:22px">${mark}<div style="font-size:96px;font-weight:700;letter-spacing:-.01em;line-height:1">NumFall</div></div>
<div style="font-size:28px;color:#D7DBE8">The number puzzle with gravity · New shorts every day</div></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })).newPage();
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  fs.mkdirSync('design/marketing', { recursive: true });
  await p.screenshot({ path: 'design/marketing/youtube-banner-2560x1440.png' });
  await b.close();
})();
