// Data model for NumFall Writer. One Article is the whole working record of one piece, from topic to post.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

export interface Faq {
  q: string;
  a: string;
}

export type Effort = 'low' | 'medium' | 'high';
export type Spelling = 'en-US' | 'en-GB';
export type SlipLevel = 'off' | 'light' | 'heavy';
export type PublishMode = 'manual' | 'backdate' | 'schedule';
export type LengthKey = 'short' | 'medium' | 'long' | 'xlong';

export interface ResearchFact {
  fact: string;
  source: string;
  url: string;
  date: string; // as published, YYYY-MM-DD or YYYY-MM or YYYY
}

export interface Research {
  summary: string;
  facts: ResearchFact[];
  webChecked: boolean;
}

export interface PlanSection {
  heading: string; // sentence case; '' for the opening section with no heading
  brief: string;
  words: number;
}

export interface Plan {
  title: string;
  slug: string;
  searchPhrase: string;
  description: string; // meta description, <= 155 characters
  angle: string;
  persona: string;
  opening: string;
  structure: string;
  ending: string;
  category: string;
  tags: string[];
  sections: PlanSection[];
  related: string[]; // 3 to 5 slugs of existing articles to link to
  appMentions: number; // 0 to 2, where NumFall answers the reader's question
}

export interface Score {
  human: number; // 0..100
  ai: number;
  mixed: number;
  flagged: string[]; // sentences GPTZero highlights as AI-like
  words: number;
  at: string;
}

export interface HumanizeUnit {
  path: string; // body.<i>, body.<i>.<j> (list item) or faq.<i>
  original: string;
  text?: string;
  state: 'pending' | 'done' | 'kept' | 'reverted';
  note?: string;
}

export type Stage =
  | 'research'
  | 'plan'
  | 'write'
  | 'extras'
  | 'humanize'
  | 'meaning'
  | 'clean'
  | 'links'
  | 'scan'
  | 'rewrite'
  | 'publish'
  | 'done';

export type Status =
  | 'queued' // waiting its turn in a batch
  | 'generating' // research to links
  | 'checking' // scan and rewrite
  | 'publishing'
  | 'ready' // finished, waiting for you to post it
  | 'scheduled'
  | 'published'
  | 'failed';

export interface ArticleOptions {
  topic: string;
  length: LengthKey;
  author: string;
  spelling: Spelling;
  asOf: string; // YYYY-MM-DD the article is written as of (its publish date for backdated posts)
  publishMode: PublishMode;
  publishAt?: string; // ISO UTC slot for backdate/schedule
  hands_off: boolean; // batch article: always one scan and one rewrite, then posts itself into its slot
}

export interface Usage {
  costUsd: number;
  claudeIn: number;
  claudeOut: number;
  searches: number;
  gptzeroWords: number;
  humanizerUsd: number;
}

export interface Article {
  id: string;
  batchId?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  options: ArticleOptions;
  status: Status;
  stage: Stage;
  step: string; // what it is doing, in words
  error?: string;
  failures: number; // errors in a row; retries stop at the limit
  stopped: boolean;
  nextAttemptAt?: string;
  research?: Research;
  plan?: Plan;
  sectionsDone: number;
  title?: string;
  slug?: string;
  description?: string;
  body: Block[];
  faq: Faq[];
  humanize?: { units: HumanizeUnit[]; skipped?: string; via?: string[] };
  links?: { slug: string; anchor: string }[];
  scan?: Score;
  scanCount: number; // never more than 1 unless "rescan after rewrite" is on and it is not a batch article
  rescan?: Score;
  rewritten?: number;
  cleanReport?: { removed: string[]; verified: number };
  slips?: number;
  usage: Usage;
  publishedAt?: string;
  summary?: ArticleSummary;
}

export interface ArticleSummary {
  title: string;
  topic: string;
  author: string;
  status: Status;
  stage: Stage;
  step: string;
  human?: number;
  costUsd: number;
  publishAt?: string;
  slug?: string;
  error?: string;
  stopped: boolean;
}

export interface Settings {
  models: { research: string; plan: string; write: string; check: string };
  writeEffort: Effort;
  prices: Record<string, { inPerM: number; outPerM: number }>;
  searchPer1k: number;
  gptzeroPer1kWords: number;
  maxSearches: number;
  humanizer: {
    enabled: boolean;
    provider: 'groq' | 'openrouter';
    model: string;
    reasoningEffort: 'low' | 'medium' | 'high';
    method: 'paraphrase';
    temperature: number;
    topP: number;
    // Used automatically when the main provider is out for the day (or has no key).
    fallback: { enabled: boolean; provider: 'groq' | 'openrouter'; model: string };
  };
  slips: SlipLevel;
  spelling: Spelling;
  oneScan: boolean;
  rescanAfterRewrite: boolean;
  requirePass: boolean;
  passMark: number;
  autoPostBatches: boolean;
  internalLinks: boolean;
  authors: string[];
  timeZone: string;
  bannedNames: string[]; // game, app and brand names that must never appear in public text
  maxFailures: number;
  defaultLength: LengthKey;
}

export interface PostIndexEntry {
  article_id: string | null;
  slug: string;
  title: string;
  headings: string[];
  tags: string[];
  category: string;
  status: 'scheduled' | 'published' | 'unpublished';
  publish_at: string;
}
