// End-to-end test of the web prototype in a real browser (Playwright + Chromium).
// Plays the tutorial, picks a board, solves Quick Level 1 by tapping, runs a level's clock out,
// and checks 6x6 and 9x9 layouts on iPhone and iPad sizes.
// Run: node tools/failsafe/web.e2e.js [screenshotDir]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../prototype/web');
const SHOTS = process.argv[2] || path.join(require('os').tmpdir(), 'dropku-shots');
fs.mkdirSync(SHOTS, { recursive: true });
// Mimic the artifact page skeleton (doctype, viewport-fit=cover, safe-area padding) around index.html.
const wrapper = path.join(ROOT, '.e2e.html');
fs.writeFileSync(wrapper, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') + '</body></html>');
const URL = 'file://' + wrapper;
let pass = 0, fail = 0;
const ok = (name, cond, info) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, info === undefined ? '' : '-> ' + info); } };

async function open(browser, viewport, progress) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); // font requests are blocked offline on purpose
  await page.clock.install();
  if (progress) await page.addInitScript((p) => localStorage.setItem('dropku.web.v2', JSON.stringify(p)), progress);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(URL);
  return { ctx, page, errors };
}
const allOnScreen = (page) => page.evaluate(() => { const bad = [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.left < -0.5 || r.right > window.innerWidth + 0.5); }).map((b) => b.textContent.trim()); return bad.length ? bad.join(', ') : true; });
const trayOneRow = (page) => page.evaluate(() => { const t = [...document.querySelectorAll('.tray .num')].map((b) => Math.round(b.getBoundingClientRect().top)); return new Set(t).size === 1; });
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
const boardFits = (page) => page.evaluate(() => { const b = document.querySelector('.board'); if (!b) return 'no board'; const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 0.5 && r.top >= 0 && r.bottom <= window.innerHeight + 0.5 ? true : JSON.stringify(r); });
// Picking the number that is already selected would un-select it, so only tap the tray when needed.
async function drop(page, v, c) { if ((await page.getAttribute(`[data-act="pick"][data-v="${v}"]`, 'aria-pressed')) !== 'true') await page.click(`[data-act="pick"][data-v="${v}"]`); await page.click(`[data-act="drop"][data-c="${c}"]`); }
async function solveLevel(page, board, idx) {
  const L = await page.evaluate(([b, i]) => window.DROPKU_BOARDS.find((x) => x.id === b).levels[i], [board, idx]);
  const n = L.size, g = L.givens.map((r) => r.slice());
  for (let guard = 0; guard < 200; guard++) {
    let moved = false;
    for (let c = 0; c < n; c++) { let r = -1; for (let k = n - 1; k >= 0; k--) if (g[k][c] === 0) { r = k; break; } if (r < 0) continue;
      await drop(page, L.solution[r][c], c); g[r][c] = L.solution[r][c]; moved = true; }
    if (!moved) break;
  }
}

(async () => {
  const browser = await chromium.launch();
  // 1. iPhone: tutorial -> level 1 -> win
  { const { ctx, page, errors } = await open(browser, { width: 390, height: 844 });
    ok('iPhone: first launch opens the tutorial', await page.isVisible('text=Lesson 1 of 3'));
    await page.screenshot({ path: path.join(SHOTS, 'iphone-tutorial.png') });
    await drop(page, 2, 1); await drop(page, 4, 3);
    ok('Tutorial lesson 1 completes', await page.isVisible('text=Lesson 1 done!'));
    await page.click('[data-act="nextLesson"]');
    await drop(page, 4, 3);
    ok('Lesson 2 explains the lower-gap trap', await page.isVisible('text=LOWER gap'));
    await page.clock.runFor(1000);
    await drop(page, 2, 3); await drop(page, 4, 3); await drop(page, 3, 2);
    await page.click('[data-act="nextLesson"]');
    const S4 = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]];
    for (const [v, c] of [[3, 0], [1, 0], [3, 2], [2, 3], [4, 3]]) await drop(page, v, c);
    ok('Tutorial finishes with the welcome gift', await page.isVisible('text=Welcome gift'));
    await page.click('[data-act="boards"]');
    ok('Home shows the three boards', (await page.locator('[data-act="board"]').count()) === 3);
    ok('Classic is the starting board', await page.isVisible('[data-act="board"][data-b="classic"][aria-pressed="true"]'));
    ok('Play button names the board and level', await page.isVisible('text=Play Classic Level 1'));
    await page.screenshot({ path: path.join(SHOTS, 'iphone-home.png') });
    await page.click('[data-act="board"][data-b="quick"]');
    ok('Switching board updates the Play button', await page.isVisible('text=Play Quick Level 1'));
    await page.click('.home [data-act="play"]');
    ok('Quick Level 1 shows the 30-second countdown', await page.isVisible('#timer >> text=30s'));
    ok('Header names the board', await page.isVisible('text=Quick · Level 1'));
    await page.clock.runFor(5000);
    ok('Countdown ticks down', await page.isVisible('#timer >> text=25s'));
    ok('iPhone: no sideways scrolling', await noHScroll(page));
    ok('iPhone: board fits on screen (4x4)', (await boardFits(page)) === true, await boardFits(page));
    await solveLevel(page, 'quick', 0);
    ok('Level 1 can be won by tapping', await page.isVisible('.sheet.win'));
    await page.screenshot({ path: path.join(SHOTS, 'iphone-win.png') });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dropku.web.v2')));
    ok('Win is saved (stars + Sparks + board)', saved.best['quick-001'] >= 1 && saved.wallet > 50 && saved.board === 'quick', JSON.stringify(saved));
    await page.click('.veil [data-act="home"]');
    ok('Back home, Quick shows 1 of 30 done', await page.isVisible('[data-b="quick"] >> text=1/30'));
    ok('No script errors (iPhone run)', errors.length === 0, errors.join(' | '));
    await ctx.close(); }

  // 2. iPhone: time's up on Quick level 2, then restart; skip offered after 2 fails
  { const progress = { wallet: 500, best: { 'quick-001': 3 }, skipped: {}, fails: {}, chests: {}, tutorialDone: true, muted: true, board: 'quick' };
    const { ctx, page, errors } = await open(browser, { width: 390, height: 844 }, progress);
    await page.click('[data-act="play"][data-i="1"]');
    await page.clock.runFor(31000);
    ok("Time's up pop-up appears at 0s", await page.isVisible("text=Time’s up!"));
    await page.screenshot({ path: path.join(SHOTS, 'iphone-timeup.png') });
    ok('No skip after only 1 fail', !(await page.isVisible('.veil [data-act="skip"]')));
    await page.click('.veil [data-act="restart"]');
    ok('Start again gives the full 30s', await page.isVisible('#timer >> text=30s'));
    await page.clock.runFor(31000);
    ok('Skip offered after 2 fails', await page.isVisible('.veil [data-act="skip"]'));
    await page.click('.veil [data-act="skip"]');
    ok('Skip spends 400 Sparks and unlocks the next level', await page.isVisible('text=Level skipped'));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dropku.web.v2')));
    ok('Skip saved, wallet 100', saved.skipped['quick-002'] === true && saved.wallet === 100, JSON.stringify(saved));
    // pause hides the board and stops the clock
    await page.click('.veil [data-act="next"]');
    await page.clock.runFor(3000);
    await page.click('[data-act="pause"]');
    const t1 = await page.textContent('#timer'); await page.clock.runFor(10000); const t2 = await page.textContent('#timer');
    ok('Pause stops the clock', t1 === t2, t1 + ' vs ' + t2);
    ok('Pause hides the board', await page.evaluate(() => document.querySelector('.board').classList.contains('hidden')));
    ok('No script errors (time/skip run)', errors.length === 0, errors.join(' | '));
    await ctx.close(); }

  // 3. Layout checks on 6x6 (Classic level 12) and 9x9 (Master level 1) across devices
  const unlockAll = { wallet: 320, best: Object.fromEntries(Array.from({ length: 11 }, (_, i) => ['classic-' + String(i + 1).padStart(3, '0'), 3])), skipped: {}, fails: {}, chests: {}, tutorialDone: true, muted: true, board: 'classic' };
  for (const [name, vp] of [['iPhone SE', { width: 375, height: 667 }], ['iPhone 16 Pro Max', { width: 440, height: 956 }], ['iPad mini portrait', { width: 744, height: 1133 }], ['iPad 13 landscape', { width: 1376, height: 1032 }], ['iPad split view narrow', { width: 375, height: 1032 }]]) {
    const { ctx, page, errors } = await open(browser, vp, unlockAll);
    await page.screenshot({ path: path.join(SHOTS, name.replace(/ /g, '-') + '-home.png') });
    const homeOffs = await allOnScreen(page); ok(`${name}: home and board picker fully on screen`, homeOffs === true, homeOffs);
    await page.click('[data-act="play"][data-i="11"]');
    const fits = await boardFits(page);
    const tile = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tile'));
    const trayVisible = await page.evaluate(() => { const t = document.querySelector('.tray'); const r = t.getBoundingClientRect(); return r.bottom <= window.innerHeight + 0.5 && r.right <= window.innerWidth + 0.5; });
    const ctlVisible = await page.evaluate(() => { const t = document.querySelector('.controls'); const r = t.getBoundingClientRect(); return r.bottom <= window.innerHeight + 0.5; });
    ok(`${name}: 6x6 board fits (tile ${tile.trim()})`, fits === true, fits);
    ok(`${name}: number tray and controls on screen`, trayVisible && ctlVisible, 'tray ' + trayVisible + ' controls ' + ctlVisible);
    ok(`${name}: no sideways scrolling`, await noHScroll(page));
    const offs = await allOnScreen(page); ok(`${name}: every button fully on screen`, offs === true, offs);
    if (vp.width < 900) ok(`${name}: 6 number tiles fit in one row`, await trayOneRow(page));
    await page.screenshot({ path: path.join(SHOTS, name.replace(/ /g, '-') + '-level12.png') });
    // 9x9: Master level 1
    await page.click('[data-act="pause"]'); await page.click('.veil [data-act="home"]');
    await page.click('[data-act="board"][data-b="master"]');
    await page.click('.home [data-act="play"]');
    const fits9 = await boardFits(page);
    const col9 = await page.evaluate(() => Math.round(document.querySelector('.col').getBoundingClientRect().width));
    const tray9 = await page.evaluate(() => { const t = document.querySelector('.tray'); const r = t.getBoundingClientRect(); return r.bottom <= window.innerHeight + 0.5 && r.right <= window.innerWidth + 0.5; });
    const ctl9 = await page.evaluate(() => { const t = document.querySelector('.controls'); const r = t.getBoundingClientRect(); return r.bottom <= window.innerHeight + 0.5; });
    ok(`${name}: 9x9 board fits (columns ${col9}px wide)`, fits9 === true && col9 >= 30, fits9 + ' col ' + col9);
    ok(`${name}: 9x9 number tray and controls on screen`, tray9 && ctl9, 'tray ' + tray9 + ' controls ' + ctl9);
    const offs9 = await allOnScreen(page); ok(`${name}: 9x9 every button fully on screen`, offs9 === true, offs9);
    const num9 = await page.evaluate(() => Math.round(Math.min(...[...document.querySelectorAll('.tray .num')].map((b) => b.getBoundingClientRect().width))));
    ok(`${name}: 9x9 number tiles at least 32px wide (${num9}px)`, num9 >= 32, num9);
    ok(`${name}: 9x9 shows the 240-second countdown`, await page.isVisible('#timer >> text=240s'));
    await page.screenshot({ path: path.join(SHOTS, name.replace(/ /g, '-') + '-master1.png') });
    ok(`${name}: no script errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  fs.unlinkSync(wrapper);
  console.log('\n' + pass + ' passed, ' + fail + ' failed. Screenshots: ' + SHOTS);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); try { fs.unlinkSync(wrapper); } catch (x) {} process.exit(1); });
