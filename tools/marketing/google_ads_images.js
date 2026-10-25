// Google Ads image assets for NumFall (run from the repo root: FONT=design/icon/Fredoka.woff2 node tools/marketing/google_ads_images.js).
// Writes design/marketing/google-ads/*.jpg at Google's recommended sizes: landscape 1200x628, square 1200x1200, portrait 1200x1500.
// Policy-minded: real game art, little text, no fake buttons, no borders or collages.
const { chromium } = require('playwright'); const fs = require('fs');
const { scene } = require('../appstore/header.js');
const jobs = [
  { name: 'landscape-hook-1200x628', w: 600, h: 314, o: { s: 30, bx: 48, by: 82, tx: 300, ty: 108, title: 44, sub: 19, subText: 'Only ONE number fits. See it?' } },
  { name: 'landscape-clean-1200x628', w: 600, h: 314, o: { s: 30, bx: 194, by: 70, title: 40, sub: 18, noText: true, safe: [186, 0, 414, 314], rain: 9, spread: true } },
  { name: 'square-hook-1200x1200', w: 600, h: 600, o: { s: 44, bx: 145, by: 262, tx: 40, ty: 34, title: 54, sub: 34, subText: 'Beat the clock to 0:00' } },
  { name: 'square-clean-1200x1200', w: 600, h: 600, o: { s: 46, bx: 138, by: 170, title: 40, sub: 18, noText: true, safe: [126, 70, 474, 520], rain: 11, spread: true } },
  { name: 'portrait-hook-1200x1500', w: 600, h: 750, o: { s: 52, bx: 116, by: 340, tx: 40, ty: 40, title: 60, sub: 38, subText: 'Easy at first. Then it isn’t.' } },
  { name: 'portrait-clean-1200x1500', w: 600, h: 750, o: { s: 54, bx: 109, by: 210, title: 40, sub: 18, noText: true, safe: [96, 100, 504, 620], rain: 13, spread: true } },
];
(async () => {
  fs.mkdirSync('design/marketing/google-ads', { recursive: true });
  const b = await chromium.launch();
  for (const j of jobs) {
    const pg = await (await b.newContext({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 2 })).newPage();
    await pg.setContent(scene(j.w, j.h, j.o)); await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: `design/marketing/google-ads/${j.name}.jpg`, type: 'jpeg', quality: 92 });
  }
  await b.close();
})();
