import type { LengthKey, Settings } from './types';

export const SITE = 'https://www.numfall.store';
export const APP_ID = '6820579220';

// The App Store link for articles. The ct token shows in App Store Connect which article brought each download.
export const appStoreLink = (slug: string) =>
  `https://apps.apple.com/app/apple-store/id${APP_ID}?pt=129582636&mt=8&ct=${encodeURIComponent(slug.slice(0, 40))}`;

export const LENGTHS: Record<LengthKey, { label: string; words: number; sections: number }> = {
  short: { label: 'Short (about 700 words)', words: 700, sections: 4 },
  medium: { label: 'Medium (about 1,100 words)', words: 1100, sections: 5 },
  long: { label: 'Long (about 1,600 words)', words: 1600, sections: 6 },
  xlong: { label: 'Very long (about 2,200 words)', words: 2200, sections: 8 },
};

// Names that must never appear in anything public (owner's rule in CLAUDE.md, App Review guidelines 2.3.7 and 5.2).
export const DEFAULT_BANNED_NAMES = [
  'Sudoku', 'KenKen', 'Kakuro', 'Nikoli', 'Wordle', 'Tetris', 'Picross', 'Candy Crush', 'Lumosity', 'Brain Test',
  'Monument Valley', 'Mathdoku', 'Calcudoku', 'Futoshiki', 'Hitori', 'Shikaku', 'Nurikabe',
];

// Prices in USD. Sonnet 5.5 matches Scripwise Writer's settings; check the others against your Anthropic
// and Groq price pages and correct them in Settings if they differ.
export const DEFAULT_SETTINGS: Settings = {
  models: { research: 'claude-haiku-5-5', plan: 'claude-haiku-5-5', write: 'claude-sonnet-5-5', check: 'claude-haiku-5-5' },
  writeEffort: 'medium',
  prices: {
    'claude-haiku-5-5': { inPerM: 1, outPerM: 5 },
    'claude-sonnet-5-5': { inPerM: 2, outPerM: 10 },
    'claude-opus-5-5': { inPerM: 4, outPerM: 20 },
    'openai/gpt-oss-20b': { inPerM: 0.075, outPerM: 0.3 },
    'openai/gpt-oss-120b': { inPerM: 0.15, outPerM: 0.6 },
  },
  searchPer1k: 10,
  gptzeroPer1kWords: 0.15,
  maxSearches: 4,
  humanizer: {
    enabled: true,
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    reasoningEffort: 'low',
    method: 'paraphrase',
    temperature: 1.1,
    topP: 1,
  },
  slips: 'light',
  spelling: 'en-US',
  oneScan: true,
  rescanAfterRewrite: false,
  requirePass: false,
  passMark: 80,
  autoPostBatches: true,
  internalLinks: true,
  authors: ['Prateek Desai', 'Ram Das', 'Preeta Kulkarni', 'Rahul Dev', 'Veena Sharma', 'Ankit Gupta', 'Vaibhav Poddar', 'Avinash Solanki'],
  timeZone: 'Asia/Kolkata',
  bannedNames: DEFAULT_BANNED_NAMES,
  maxFailures: 4,
  defaultLength: 'medium',
};

const clamp = (n: unknown, lo: number, hi: number, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d);

export function mergeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const s = raw ?? {};
  const d = DEFAULT_SETTINGS;
  const authors = Array.isArray(s.authors) ? s.authors.map(a => String(a).trim()).filter(Boolean) : d.authors;
  const banned = Array.isArray(s.bannedNames) ? s.bannedNames.map(a => String(a).trim()).filter(Boolean) : d.bannedNames;
  return {
    ...d,
    ...s,
    models: { ...d.models, ...(s.models ?? {}) },
    prices: { ...d.prices, ...(s.prices ?? {}) },
    humanizer: {
      ...d.humanizer,
      ...(s.humanizer ?? {}),
      method: 'paraphrase',
      temperature: clamp(s.humanizer?.temperature, 0, 2, d.humanizer.temperature),
      topP: clamp(s.humanizer?.topP, 0.05, 1, d.humanizer.topP),
    },
    passMark: clamp(s.passMark, 0, 100, d.passMark),
    maxSearches: clamp(s.maxSearches, 1, 10, d.maxSearches),
    maxFailures: clamp(s.maxFailures, 1, 10, d.maxFailures),
    authors: authors.length ? authors : d.authors,
    bannedNames: banned,
    timeZone: isTimeZone(s.timeZone) ? s.timeZone! : d.timeZone,
    slips: s.slips === 'off' || s.slips === 'heavy' ? s.slips : 'light',
    spelling: s.spelling === 'en-GB' ? 'en-GB' : 'en-US',
  };
}

export function isTimeZone(tz: unknown): boolean {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function priceOf(s: Settings, model: string) {
  return s.prices[model] ?? { inPerM: 3, outPerM: 15 };
}
