// Thumbnails / covers (1080x1920) for each short: a strong frame from the video, darkened at the top, with a big headline.
// Run: NODE_PATH=$(npm root -g) FONT=design/icon/Fredoka.woff2 FRAMES=<dir with c_*.png> node tools/marketing/covers.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const font = fs.readFileSync(process.env.FONT).toString('base64');
const COVERS = [
  ['i-thought-this-was-easy', 'c_easy.png', 'This puzzle<br><b>HUMBLED</b> me', 'It looked easy…'],
  ['guess-the-number', 'c_guess.png', 'Only <b>ONE</b><br>number fits', 'Can you see it?'],
  ['one-more-level', 'c_more.png', '"Just <b>ONE</b><br>more level"', '…it’s 2 AM'],
  ['clutch', 'c_clutch.png', '<b>1 SECOND</b><br>LEFT', '3 gaps. 7 seconds.'],
  ['satisfying-sound', 'c_sound.png', 'Most <b>satisfying</b><br>puzzle sound?', 'Sound on'],
];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })).newPage();
  for (const [name, file, head, sub] of COVERS) {
    const img = fs.readFileSync(path.join(process.env.FRAMES, file)).toString('base64');
    await p.setContent(`<html><head><style>@font-face{font-family:F;font-weight:300 700;src:url(data:font/woff2;base64,${font})}
    body{margin:0;width:540px;height:960px;overflow:hidden;font-family:F;position:relative;background:#13161F}
    .bg{position:absolute;inset:0;background:url(data:image/png;base64,${img}) center/cover}
    .shade{position:absolute;inset:0;background:linear-gradient(180deg,#0C0E16 0%,#0C0E16 33%,rgba(12,14,22,0) 47%)}
    h1{position:absolute;left:20px;right:20px;top:118px;margin:0;text-align:center;font-size:64px;line-height:1.02;font-weight:700;color:#fff;
       -webkit-text-stroke:9px #0B0D14;paint-order:stroke fill;transform:rotate(-2deg)}
    h1 b{color:#F5E663}
    p{position:absolute;left:0;right:0;top:282px;margin:0;text-align:center;font-size:30px;font-weight:600;color:#D7DBE8}
    </style></head><body><div class="bg"></div><div class="shade"></div><h1>${head}</h1><p>${sub}</p></body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `design/marketing/covers/cover-${name}.jpg`, type: 'jpeg', quality: 90 });
  }
  await b.close();
})();
