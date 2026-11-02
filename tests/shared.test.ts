import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanArticle, hasNeverPublish, toSymbols, nameHits, safeSources, bannedWordHits, unsupportedClaims, isNonEnglish } from '../writer/shared/clean';
import { factProblem, cleanRewrite } from '../writer/shared/humanize';
import { cleanSlug, titleShape, sentenceCase } from '../writer/shared/text';
import { backdateSlots, localDate, scheduleSlots, tzOffsetMinutes } from '../writer/shared/schedule';
import { goodAnchor, insertLink, linkifyBare, linkifyHtml } from '../writer/shared/links';
import { sanitizeHtml } from '../writer/shared/sanitize';
import { addSlips } from '../writer/shared/slips';
import { blocksToHtml, inline } from '../writer/shared/render';
import { unwrapDeadLinks, pageTitle, sitemap } from '../writer/site/blog';
import { DEFAULT_BANNED_NAMES } from '../writer/shared/settings';
import type { Block } from '../writer/shared/types';

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('typed symbols: percent, straight quotes, no em or en dashes', () => {
  assert.equal(toSymbols('About 13 percent of players'), 'About 13% of players');
  assert.equal(toSymbols('“Hi” it’s'), '"Hi" it\'s');
  assert.equal(toSymbols('A—B—C'), 'A, B, C');
  assert.equal(toSymbols('levels 4–6'), 'levels 4-6');
  assert.ok(!/[–—]/.test(toSymbols('one – two')));
});

test('never publish: markers, translation notes, pipeline and research remarks, non-English', () => {
  const body: Block[] = [
    { type: 'p', text: 'Players fill rows first. [TODO] The study could not be found in the notes. Chunk 3 has already covered boxes.' },
    { type: 'p', text: 'A 6×6 grid has 2×3 boxes (Keep exactly: 6×6). [ADD SOURCE]' },
    { type: 'p', text: 'Ye paheli bahut aasaan hai aur log isko jaldi hal karte hain kyunki yeh chhota hai.' },
    { type: 'p', text: '这是一个数字谜题，每一行都要填满。' },
    { type: 'p', text: 'Solvers check rows. A 6×6 grid uses 2×3 boxes [VERIFY: box shape].' },
  ];
  const r = cleanArticle(body, [{ q: 'Q?', a: 'Answer here. [CHECK]' }], true);
  const all = JSON.stringify(r.body) + JSON.stringify(r.faq);
  assert.ok(!/TODO|ADD SOURCE|Keep exactly|could not be found|Chunk 3|CHECK|VERIFY/.test(all), all);
  assert.ok(!/数字/.test(all));
  assert.equal(r.report.needsCheck.length, 1);
  assert.equal(hasNeverPublish(r.body, r.faq), null);
  assert.ok(isNonEnglish('这是一个数字谜题'));
  assert.ok(!isNonEnglish('Players check each row before they drop a number into the grid.'));
});

test('fact guard rejects lost numbers, names, translation notes and non-English', () => {
  const o = 'On a 9×9 board, NumFall players earn 3 stars by finishing fast with no mistakes.';
  assert.equal(factProblem(o, 'Players of NumFall get 3 stars on the 9×9 board when they finish quickly and make no mistakes.'), null);
  assert.match(factProblem(o, 'Players of NumFall get stars on the 9×9 board when they finish quickly and make no mistakes.')!, /number 3/);
  assert.match(factProblem(o, 'Players get 3 stars on the 9×9 board when they finish quickly and make no mistakes at all.')!, /NumFall/);
  assert.match(factProblem(o, 'Players of NumFall get 3 stars on the 9×9 board (keep exactly: 9×9) when they finish quickly.')!, /translation/);
  assert.equal(cleanRewrite('Here is the rewritten paragraph: "Text here."\n\nNote: I kept the numbers.', 'Text'), 'Text here.');
});

test('banned words, names and unsupported app claims are caught', () => {
  assert.deepEqual(bannedWordHits('This is a crucial step to unlock the realm.').sort(), ['crucial', 'realm', 'unlock']);
  assert.deepEqual(nameHits('Unlike sudoku or KenKen puzzles', DEFAULT_BANNED_NAMES).sort(), ['KenKen', 'Sudoku']);
  assert.equal(nameHits('A peak of 9 levels', DEFAULT_BANNED_NAMES).length, 0);
  assert.equal(unsupportedClaims('NumFall has 4.9 stars and 1 million downloads. NumFall is free.').length, 1);
  assert.equal(unsupportedClaims('NumFall runs on Apple Vision Pro.').length, 1);
});

test('slugs are 3 to 6 words; title shapes and sentence case', () => {
  assert.equal(cleanSlug('How To Solve A 6x6 Logic Grid Without Guessing At All Ever', 'x'), 'solve-6x6-logic-grid-without-guessing');
  assert.equal(cleanSlug('pencil', 'pencil marks for beginners'), 'pencil-marks-for');
  assert.match(cleanSlug('ab', 'x'), /^[a-z0-9]+(-[a-z0-9]+){2,5}$/);
  assert.equal(titleShape('How to solve a 6×6 grid: 7 tips', '6×6 grid'), titleShape('How to solve a 9×9 grid: 5 tips', '9×9 grid'));
  assert.equal(sentenceCase('Rows First Before Boxes'), 'Rows first before boxes');
  assert.equal(sentenceCase('Using Sparks in the Daily Drop'), 'Using Sparks in the Daily Drop');
});

test('schedule: 9 am to 9 pm local, at most 2 a day, 4 hours apart, counting existing posts', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-11-02T06:00:00Z');
  const existing = ['2026-11-03T05:00:00Z'];
  const slots = scheduleSlots(12, 10, tz, now, existing, seeded());
  assert.equal(slots.length, 12);
  const all = [...slots, ...existing.map(e => new Date(e))].sort((a, b) => a.getTime() - b.getTime());
  for (let i = 1; i < all.length; i++) assert.ok(all[i].getTime() - all[i - 1].getTime() >= 4 * 3600_000, 'four hours apart');
  const perDay = new Map<string, number>();
  for (const s of all) {
    const d = localDate(tz, s);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
    const local = new Date(s.getTime() + tzOffsetMinutes(tz, s) * 60000);
    const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
    assert.ok(mins >= 9 * 60 && mins <= 21 * 60, `between 9 and 9: ${s.toISOString()}`);
    assert.ok(s.getTime() > now.getTime());
  }
  assert.ok([...perDay.values()].every(n => n <= 2));
  assert.throws(() => scheduleSlots(30, 3, tz, now, [], seeded()), /don't have room/);
});

test('backdate: last N days, at most 3 a date, counting existing posts', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-11-02T06:00:00Z');
  const existing = ['2026-11-01T06:00:00Z', '2026-11-01T07:00:00Z', '2026-11-01T08:00:00Z'];
  const slots = backdateSlots(9, 4, tz, now, existing, seeded(3));
  const perDay = new Map<string, number>();
  for (const s of slots) {
    assert.ok(s.getTime() < now.getTime());
    const d = localDate(tz, s);
    assert.notEqual(d, '2026-11-01', 'full date skipped');
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  assert.ok([...perDay.values()].every(n => n <= 3));
  assert.throws(() => backdateSlots(10, 4, tz, now, existing, seeded()), /Only 9 backdate slots/);
});

test('internal links use phrases already in the text, not headings or the opening', () => {
  const body: Block[] = [
    { type: 'p', text: 'Naked pairs show up early.' },
    { type: 'h2', text: 'Naked pairs' },
    { type: 'p', text: 'Solvers who mark naked pairs move faster.' },
  ];
  const out = insertLink(body, 'naked pairs', '/blog/naked-pairs-explained-guide')!;
  assert.equal((out[0] as { text: string }).text, 'Naked pairs show up early.');
  assert.equal((out[2] as { text: string }).text, 'Solvers who mark [naked pairs](/blog/naked-pairs-explained-guide) move faster.');
  assert.equal(insertLink(body, 'not in text', '/blog/x-y-z'), null);
});

test('links to posts that are not live show as plain text; unsafe links are dropped', () => {
  const html = blocksToHtml([{ type: 'p', text: 'See [one](/blog/live-post-here) and [two](/blog/not-live-post) and [bad](javascript:alert(1)).' }]);
  const out = unwrapDeadLinks(html, new Set(['live-post-here']));
  assert.match(out, /<a href="\/blog\/live-post-here">one<\/a>/);
  assert.ok(!out.includes('not-live-post'));
  assert.ok(!out.includes('javascript'));
  assert.equal(inline('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
});

test('grammar slips stay out of headings, quotes, numbers and the first sentence', () => {
  const body: Block[] = [
    { type: 'h2', text: 'The grid until the end' },
    { type: 'p', text: 'Most players wait until the grid fills up before they guess anything at all here. Most players check the column until they are sure, but some solvers prefer the row first and stay with it.' },
    { type: 'p', text: 'There are several ways to try to read the board, but most solvers try to read the row until it is clear what goes where.' },
  ];
  const r = addSlips(body, [{ q: 'Q', a: 'Most players wait until the tray is empty, but beginners try to check rows first before anything.' }], 'seed', 'heavy');
  assert.equal((r.body[0] as { text: string }).text, 'The grid until the end');
  assert.ok((r.body[1] as { text: string }).text.startsWith('Most players wait until the grid fills up'));
  assert.ok(r.count >= 1);
  assert.equal(addSlips(body, [], 's', 'off').count, 0);
});

test('page titles drop the site name when they would go over 60 characters', () => {
  assert.equal(pageTitle('Short title'), 'Short title | NumFall');
  const long = 'How to solve a 9×9 logic grid without guessing at any point';
  assert.equal(pageTitle(long), long);
});

test('bare web addresses become links with readable words', () => {
  assert.equal(
    linkifyBare('The app is available on the App Store at https://apps.apple.com/app/apple-store/id6820579220?pt=1&ct=x.'),
    'The app is available on [the App Store](https://apps.apple.com/app/apple-store/id6820579220?pt=1&ct=x).',
  );
  assert.equal(linkifyBare('Try https://apps.apple.com/app/id1 now'), 'Try [NumFall on the App Store](https://apps.apple.com/app/id1) now');
  assert.equal(linkifyBare('See [this](https://a.org/b) and https://example.org/x.'), 'See [this](https://a.org/b) and [example.org](https://example.org/x).');
  assert.match(linkifyHtml('<p>At https://apps.apple.com/app/id1?a=1&amp;b=2.</p>'), /<a href="https:\/\/apps\.apple\.com\/app\/id1\?a=1&amp;b=2"[^>]*>NumFall on the App Store<\/a>\./);
  assert.equal(linkifyHtml('<a href="https://x.org">https://x.org</a>'), '<a href="https://x.org">https://x.org</a>');
});

test('editor HTML is cleaned: only text tags, safe links, the app-card marker', () => {
  const out = sanitizeHtml('<div><p style="color:red" onclick="x">Hi <b>bold</b> <i>it</i></p><script>bad()</script><iframe src=x></iframe><!--app-card--><!--other--><a href="javascript:alert(1)">no</a><a href="https://example.org" target=_self>yes</a><h2 class=x>Head</h2><img src=x onerror=y></div>');
  assert.equal(out, '<p>Hi <strong>bold</strong> <em>it</em></p><!--app-card-->no<a href="https://example.org" rel="noopener" target="_blank">yes</a><h2>Head</h2>');
});

test('sitemap: changefreq and priority on every URL, no lastmod', () => {
  const f = { layout: '', analytics: '', llms: '', config: {}, staticPages: ['/', '/blog', '/support'] };
  const post = { slug: 'pencil-marks-six-grid', title: 't', description: 'd', author: 'a', category: 'How-to and techniques', tags: [], html: '', faq: [], related: [], reading_minutes: 1, publish_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z', status: 'published' };
  const xml = sitemap(f, [post]);
  assert.ok(!xml.includes('lastmod'));
  assert.ok(xml.includes('<url>\n<loc>https://www.numfall.store/blog/category/how-to-and-techniques</loc>\n<changefreq>weekly</changefreq>\n<priority>0.5</priority>\n</url>'));
  assert.ok(xml.includes('<loc>https://www.numfall.store/blog/pencil-marks-six-grid</loc>\n<changefreq>monthly</changefreq>\n<priority>0.7</priority>'));
  assert.ok(xml.includes('<loc>https://www.numfall.store/</loc>\n<changefreq>weekly</changefreq>\n<priority>1.0</priority>'));
  assert.equal((xml.match(/<url>/g) ?? []).length, 5);
});

test('non-English check: short English questions pass; other languages and scripts are caught', () => {
  for (const ok of [
    'Do crosswords help older adults think better?',
    'Are logic puzzles good for seniors?',
    'Crosswords, word searches and number grids',
    'Daily puzzles improve working memory in healthy adults, according to a 2023 review covering 21 trials.',
    'Most players check each row before they drop a number into the grid, and many beginners skip that step.',
  ]) assert.equal(isNonEnglish(ok), false, ok);
  for (const bad of [
    'Ye paheli bahut aasaan hai aur log isko jaldi hal karte hain kyunki yeh chhota hai aur maza aata hai.',
    'Los jugadores revisan cada fila antes de colocar un número en la cuadrícula para evitar errores comunes.',
    '这是一个数字谜题，每一行都要填满。',
    'Игроки проверяют каждую строку.',
  ]) assert.equal(isNonEnglish(bad), true, bad);
});

test('internal link anchors must read like a search for the linked article', () => {
  const target = { title: 'Naked pairs in small grids', tags: ['6x6', 'techniques'], slug: 'naked-pairs-small-grids' };
  assert.equal(goodAnchor('naked pairs', target), true);
  assert.equal(goodAnchor('spot a naked pair', target), true);
  assert.equal(goodAnchor('a 6x6 grid', target), true);
  assert.equal(goodAnchor('this article', target), false);
  assert.equal(goodAnchor('read more', target), false);
  assert.equal(goodAnchor('the first move', target), false, 'nothing in common with the target');
  assert.equal(goodAnchor('pairs', target), false, 'one word is too short');
});

test('game names in headings and FAQ questions are cleaned before posting', async () => {
  const { codeRules, finalCheck } = await import('../writer/server/steps');
  const { DEFAULT_SETTINGS } = await import('../writer/shared/settings');
  const a = {
    id: 'x', slug: 'daily-puzzles-kept-small', title: 'Daily puzzles kept small', description: 'd', options: { hands_off: true },
    body: [{ type: 'h2', text: 'How Sudoku rules carry over' }, { type: 'p', text: 'Solvers check every row twice. '.repeat(60) }],
    faq: [
      { q: 'What is a classic Sudoku grid made of?', a: 'Nine rows, nine columns and nine boxes.' },
      { q: 'How long should a daily puzzle take?', a: 'Most solvers spend five to ten minutes.' },
      { q: 'Is a 4x4 grid good for kids?', a: 'Many kids start there because each box has four cells.' },
      { q: 'Do small puzzles help focus?', a: 'Short breaks help some people reset.' },
    ],
  } as unknown as import('../writer/shared/types').Article;
  codeRules(a, DEFAULT_SETTINGS);
  assert.equal((a.body[0] as { text: string }).text, 'How number grid rules carry over');
  assert.equal(a.faq.length, 3);
  assert.ok(!JSON.stringify(a).match(/sudoku/i));
  assert.equal(finalCheck(a, DEFAULT_SETTINGS), null);
});

test('banned names are caught inside longer words and web addresses, but short names only as words', () => {
  assert.deepEqual(nameHits('according to the Eversudoku history guide', DEFAULT_BANNED_NAMES), ['Sudoku']);
  assert.deepEqual(nameHits('https://en.wikipedia.org/wiki/Glossary_of_Sudoku', DEFAULT_BANNED_NAMES), ['Sudoku']);
  assert.deepEqual(nameHits('onlinekakuro.com', DEFAULT_BANNED_NAMES), ['Kakuro']);
  assert.deepEqual(nameHits('A Latin square fills a grid with each number once.', DEFAULT_BANNED_NAMES), []);
  assert.deepEqual(nameHits('the settings menu', ['Set']), [], 'a short name never matches inside a word');
  assert.deepEqual(nameHits('play Set with friends', ['Set']), ['Set']);
  const kept = safeSources([
    { name: 'Sudoku Royale', url: 'https://www.sudoku-royale.com/x' },
    { name: 'Puzzle Wiki', url: 'https://www.puzzles.wiki/wiki/Kakuro' },
    { name: 'Cornell University', url: 'https://pi.math.cornell.edu/x' },
  ], DEFAULT_BANNED_NAMES);
  assert.deepEqual(kept.map(x => x.name), ['Cornell University']);
});
