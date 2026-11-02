// Clean-up in code: everything listed under "Never publish", typed symbols, and the checks that keep
// banned words, game names and AI tells out. Runs before the GPTZero scan and again before posting.
import type { Block, Faq } from './types';
import { sentences } from './text';

// "13 percent" -> "13%", straight quotes, and no em or en dashes ("A—B—C" -> "A, B, C", "4–6" -> "4-6").
export function toSymbols(t: string): string {
  return t
    .replace(/(\d(?:[\d,.]*\d)?)\s*(?:percent|per cent)\b/gi, '$1%')
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/(\d)\s*[‒–—―]\s*(\d)/g, '$1-$2')
    .replace(/\s*[‒–—―]\s*/g, ', ')
    .replace(/\s+--\s+/g, ', ')
    .replace(/…/g, '...')
    .replace(/,\s*([,.;:!?])/g, '$1')
    .replace(/^,\s*/, '')
    .replace(/[ \t]{2,}/g, ' ');
}

// Headings and FAQ questions: same symbols, but a dash in a heading becomes a colon, not a comma.
export function headingSymbols(t: string): string {
  return toSymbols(t.replace(/\s+[–—]\s+/g, ': '));
}

export const MARKER_RE = /\s*\[(?:VERIFY|CHECK|TODO|TBD|ADD\b[^\]]*|SOURCE|CITE|CITATION NEEDED|NOTE)\b[^\]]*\]/gi;
const TRANSLATION_NOTE_RE = /\s*\((?:keep exactly|do not translate|translator'?s? note|translation note|note to (?:self|editor)|original)[^)]*\)/gi;

const PIPELINE = [
  /\bchunk \d+\b/i,
  /\b(?:section|part|chunk) \d+ (?:has )?already (?:covers|covered)\b/i,
  /\b(?:this|the|that|earlier|previous) (?:section|part|chunk) (?:has )?already (?:covers|covered|explained|discussed)\b/i,
  /\b(?:the )?(?:section|part) above (?:already )?(?:covers|covered|has covered)\b/i,
  /\bwithout (?:restating|repeating) (?:any|the|those|the earlier) (?:numbers|figures|points)\b/i,
  /\bthis (?:section|part) (?:does not repeat|will cover|covers)\b/i,
  /\b(?:this|the) (?:article|piece|guide|post) (?:explains|covers|will|looks at|walks)\b/i,
  /\bin this (?:article|piece|guide|post)\b/i,
  /\bas (?:an|a) (?:AI|language model)\b/i,
  /\bI hope this helps\b/i,
  /\b(?:let me know|feel free to)\b/i,
];
const RESEARCH = [
  /\b(?:could|can) ?not be (?:found|verified|confirmed)\b/i,
  /\bcould not find\b|\bcouldn't find\b/i,
  /\b(?:was|were) not found\b/i,
  /\b(?:needs?|has|have) to be (?:checked|verified|confirmed)\b/i,
  /\b(?:yet|still) to be (?:checked|verified|confirmed)\b/i,
  /\bremains? unverified\b|\b(?:is|are) unverified\b/i,
  /\bresearch (?:notes?|done)? ?for this\b/i,
  /\bthe (?:research|fact) (?:notes|sheet)\b/i,
  /\bthe searches? (?:returned|found|did not)\b/i,
  /\bthe (?:figures|numbers|facts|data) (?:used )?in this (?:article|piece|page)\b/i,
  /\bno (?:reliable )?(?:source|data) (?:was|is) available\b/i,
  /\b(?:information|data) (?:on|about) this (?:is|was) (?:not available|limited|scarce)\b/i,
];

export const isPipelineNote = (s: string) => PIPELINE.some(r => r.test(s));
export const isResearchRemark = (s: string) => RESEARCH.some(r => r.test(s));
export const hasMarker = (s: string) => new RegExp(MARKER_RE.source, 'i').test(s);

// Non-English test, for text the humanizer may answer in another language.
//  - Any non-Latin script (Hindi, Chinese, Arabic, Cyrillic...) counts as non-English.
//  - Latin-script text is judged only when it is long enough (12+ words): English prose is roughly 40%
//    common function words, other languages almost none of these. Short lines (headings, FAQ questions)
//    are never judged by word share, so "Do crosswords help older adults think better?" passes.
const FUNCTION_WORDS = new Set(
  ('a an the and or but nor so yet if then than that this these those there here it its they them their theirs he him his she her hers we us our you your yours i me my mine ' +
   'is are was were be been being am do does did done have has had having can could will would shall should may might must ' +
   'of to in on at by for with from into onto over under about after before between through during without within along across around ' +
   'not no as up down out off just only also very too more most less least many much some any each every all both few other another such ' +
   'what which who whom whose when where why how one two three first next same own while because until though although whether ' +
   'player players solver solvers puzzle puzzles grid grids number numbers row rows column columns box boxes level levels game games time').split(' '),
);
export function englishShare(t: string): number {
  const ws = t.toLowerCase().match(/[a-z']+/g) ?? [];
  if (!ws.length) return 1;
  return ws.filter(w => FUNCTION_WORDS.has(w)).length / ws.length;
}
const NON_LATIN = /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u0DFF\u0E00-\u0FFF\u1100-\u11FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
export function isNonEnglish(t: string): boolean {
  if (NON_LATIN.test(t)) return true;
  const ws = t.match(/[A-Za-z']+/g) ?? [];
  if (ws.length < 12) return false;
  return englishShare(t) < 0.12;
}

export interface CleanReport {
  removed: string[]; // sentences or notes taken out, for the article record (never published)
  needsCheck: { path: string; sentence: string }[]; // sentences that carried an editing note
}

function cleanText(t: string, path: string, rep: CleanReport, keepNoteSentences: boolean): string {
  let out = t.replace(TRANSLATION_NOTE_RE, m => (rep.removed.push(m.trim()), ''));
  // A note after a full stop stands on its own and just goes; a note inside a sentence questions that sentence.
  out = out.replace(new RegExp(`([.!?])\\s*(${MARKER_RE.source.replace('\\s*', '')})`, 'gi'), '$1\n$2\n');
  const kept: string[] = [];
  for (const s of sentences(out)) {
    if (hasMarker(s)) {
      const bare = s.replace(MARKER_RE, '').trim();
      if (!bare || /^[.,;:]$/.test(bare)) {
        rep.removed.push(s);
        continue;
      }
      if (keepNoteSentences) {
        rep.needsCheck.push({ path, sentence: bare });
        kept.push(bare);
      } else rep.removed.push(s);
      continue;
    }
    if (isPipelineNote(s) || isResearchRemark(s)) {
      rep.removed.push(s);
      continue;
    }
    kept.push(s);
  }
  out = kept.join(' ');
  return toSymbols(out.replace(MARKER_RE, '').replace(/\s+([.,;:!?])/g, '$1').trim());
}

// Strips everything under "Never publish". With keepNoteSentences, a sentence that carried an editing
// note is kept (note removed) and listed in needsCheck, so one web search can verify or correct it.
export function cleanArticle(body: Block[], faq: Faq[], keepNoteSentences = false): { body: Block[]; faq: Faq[]; report: CleanReport } {
  const rep: CleanReport = { removed: [], needsCheck: [] };
  const out: Block[] = [];
  body.forEach((b, i) => {
    if (b.type === 'h2') {
      const text = headingSymbols(b.text.replace(MARKER_RE, '')).trim();
      if (text) out.push({ type: 'h2', text });
      return;
    }
    if (b.type === 'p') {
      if (isNonEnglish(b.text)) {
        rep.removed.push(b.text.slice(0, 120));
        return;
      }
      const text = cleanText(b.text, `body.${i}`, rep, keepNoteSentences);
      if (text) out.push({ type: 'p', text });
      return;
    }
    const items = b.items
      .filter(it => !isNonEnglish(it) || (rep.removed.push(it.slice(0, 120)), false))
      .map((it, j) => cleanText(it, `body.${i}.${j}`, rep, keepNoteSentences))
      .filter(Boolean);
    if (items.length) out.push({ ...b, items });
  });
  const f = faq
    .map((x, i) => ({ q: headingSymbols(x.q.replace(MARKER_RE, '')).trim(), a: isNonEnglish(x.a) ? '' : cleanText(x.a, `faq.${i}`, rep, keepNoteSentences) }))
    .filter(x => x.q && x.a);
  // Drop a heading left with nothing under it.
  const tidy = out.filter((b, i) => !(b.type === 'h2' && (i === out.length - 1 || out[i + 1].type === 'h2')));
  return { body: tidy, faq: f, report: rep };
}

export function hasNeverPublish(body: Block[], faq: Faq[], title = ''): string | null {
  const all = [title, ...body.flatMap(b => (b.type === 'ul' || b.type === 'ol' ? b.items : [b.text])), ...faq.flatMap(f => [f.q, f.a])];
  for (const t of all) {
    if (hasMarker(t)) return `editing note: ${t.slice(0, 80)}`;
    if (new RegExp(TRANSLATION_NOTE_RE.source, 'i').test(t)) return `translation note: ${t.slice(0, 80)}`;
    if (/[–—]/.test(t)) return `long dash: ${t.slice(0, 80)}`;
    if (isNonEnglish(t)) return `non-English text: ${t.slice(0, 80)}`;
    for (const s of sentences(t)) if (isPipelineNote(s) || isResearchRemark(s)) return `note about the process: ${s.slice(0, 80)}`;
  }
  return null;
}

// ---- Words and structures the writing rules ban. Used to lint drafts and pick sentences to rewrite. ----
export const BANNED_WORDS = [
  'delve', 'dive into', 'landscape', 'navigate', 'realm', 'tapestry', 'testament', 'crucial', 'pivotal', 'robust', 'seamless',
  'leverage', 'unlock', 'embark', 'foster', 'elevate', 'empower', 'streamline', 'comprehensive', 'game-changer', 'game changer',
  'ever-evolving', 'furthermore', 'moreover', 'additionally', 'in conclusion', 'overall', "it's important to note", 'it is important to note',
  "it's worth noting", 'it is worth noting', "in today's fast-paced world", 'whether you are a beginner', "whether you're a beginner",
  'key takeaways', "let's explore", 'when it comes to', 'ultimate', 'insane', 'addictive', 'mind-blowing', 'next-level',
  "here's the thing", "let's break it down", 'the bottom line', 'that said', 'put simply', 'at its core', 'serves as',
  'experts say', 'studies show', 'research shows',
];

export function bannedWordHits(t: string): string[] {
  const low = t.toLowerCase().replace(/[’]/g, "'");
  return BANNED_WORDS.filter(w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`).test(low));
}

export function structureHits(sentence: string): string[] {
  const out: string[] = [];
  if (/^(And|But|Also|So)\b/.test(sentence)) out.push('starts with And/But/Also/So');
  if (/\bit'?s not (?:just |only )?[^,.]{1,40}, it'?s\b/i.test(sentence) || /\bisn'?t (?:just |only )?[^,.]{1,40}, it'?s\b/i.test(sentence)) out.push('"not X, it\'s Y"');
  if (/, which is why\b/i.test(sentence)) out.push('", which is why"');
  if (/,\s+(?:highlighting|underscoring|showcasing|reflecting|emphasizing|emphasising|making it|ensuring)\b[^.]*\.$/i.test(sentence)) out.push('trailing -ing add-on');
  if (/\?\s*$/.test(sentence) === false && /^\w[^?]{0,60}\?\s+\w/.test(sentence)) out.push('question answered at once');
  if (/\b(\w+), (\w+),? and (\w+) (?:puzzles?|games?|grids?|play)\b/i.test(sentence) && /\b(fun|simple|calm|quick|easy|clean|smart|relaxing|challenging|engaging|satisfying)\b/i.test(sentence)) out.push('three adjectives');
  return out;
}

// Game, app and brand names that must never appear in public text (whole word, any case).
export function nameHits(t: string, names: string[]): string[] {
  return names.filter(n => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i').test(t));
}

// Any NumFall claim the facts sheet doesn't support. Checked on the final text.
const UNSUPPORTED_CLAIMS = [
  /\bandroid\b(?![^.]*\bnot\b)/i,
  /\b(?:\d[\d,.]*\s*(?:k|m|million|thousand)?\+?\s*(?:downloads|players|users|reviews))\b/i,
  /\b(?:award|award-winning|editor'?s choice|featured by apple)\b/i,
  /\b(?:\d(?:\.\d)?\s*(?:stars?|-star) rating|rated \d)/i,
  /\bvision pro\b/i,
  /\bno tracking\b|\bdoes(?:n't| not) track\b|\bcollects? no data\b/i,
];
export function unsupportedClaims(t: string): string[] {
  return sentences(t).filter(s => /numfall/i.test(s) && UNSUPPORTED_CLAIMS.some(r => r.test(s)));
}
