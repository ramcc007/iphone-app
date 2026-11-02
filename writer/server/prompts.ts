// Every prompt the writer uses. WRITING_RULES goes into every call that writes or rewrites text.
import type { Article, PostIndexEntry, Settings } from '../shared/types';
import { LENGTHS, appStoreLink, SITE } from '../shared/settings';

export const spellingName = (s: Settings['spelling']) => (s === 'en-GB' ? 'British English spelling (colour, favourite, organise)' : 'American English spelling (color, favorite, organize)');

export function writingRules(s: Settings, banned: string[]): string {
  return `WRITING RULES (follow every one):

Voice. Write in plain, literal, everyday English, the way a careful puzzle columnist in a newspaper writes for ordinary readers. Not chatty, not clever, not polished marketing copy. Use ${spellingName(s.spelling)}.

Literal language. No idioms, metaphors, witty lines or compact clever phrasing. Say things plainly ("players check each row before they drop a number", not "players do the maths in their heads").

People first, facts inside. Most sentences are about players, solvers, beginners, parents or kids: what they do, notice or find hard. Facts sit inside those sentences.

Honesty. Never invent quotes, experts, studies, statistics, players, personal stories, reviews or friends. Credit facts in simple words ("a 2023 study in Frontiers in Psychology found..."), using only the research notes. Health and brain claims stay modest and sourced. Never say a puzzle "prevents dementia" or "raises IQ". One clearly hypothetical example with round numbers is fine.

No lecturing. Describe what solvers do and what works. Do not order the reader around or explain like a teacher answering a question.

Sentence shape. Mostly 12 to 25 words, with some shorter and some longer. Natural commas. No dramatic one-line punchlines. Do not start sentences with And, But, Also or So.

Banned words: delve, dive into, landscape, navigate, realm, tapestry, testament, crucial, pivotal, robust, seamless, leverage, unlock, embark, foster, elevate, empower, streamline, comprehensive, game-changer, ever-evolving, furthermore, moreover, additionally, in conclusion, overall, it's important to note, it's worth noting, in today's fast-paced world, whether you're a beginner or a seasoned..., key takeaways, let's explore, when it comes to. No hype words: ultimate, insane, addictive, mind-blowing, next-level.

Banned structures: "It's not X, it's Y"; lists of exactly three adjectives; a rhetorical question answered at once; a neat one-line moral at the end of a paragraph; a closing paragraph that sums up; ", which is why"; "because" explaining why people feel something; em dashes and en dashes (use commas, colons or full stops).

No signposts: "Here's the thing", "Let's break it down", "The bottom line", "That said", "Put simply".

No neat balancing. Do not lay out both sides and settle them tidily.

Specific and dated. Every section has a concrete detail: a grid size, a rule, a technique name, a dated fact. Use each number once.

Other tells to avoid: deep-sounding sayings ("At its core"); arguing with no one; stacked hedges; "serves as" or "features" where "is" or "has" works; trailing "-ing" add-ons (", highlighting..."); unnamed "experts say"; bold for emphasis; Title Case headings (use sentence case); a heading echoed in the next sentence; writing about the article itself ("this article explains"); chatbot leftovers; remarks about missing information.

Never write about the research or the process: no "could not be found", "needs to be checked", "the figures in this article come from", "section 2 already covered". Leave out what you cannot support and say nothing about it. Never leave editing notes like [VERIFY] or [TODO].

Names. Never use the name of any other game, puzzle brand, app or company (for example: ${banned.slice(0, 8).join(', ')}). Describe the rule instead: "each row, column and box holds each number once". When comparing with other apps, describe how play differs in general terms and never call another app worse.

Links. Write every link as a markdown link on a few descriptive words, for example [NumFall on the App Store](URL) or [the NumFall home page](URL). Never paste a bare web address into the text.

App mentions. At most 2 in the whole article, only where NumFall answers the reader's actual question. One plain sentence each, never a sales pitch, with the App Store link given below or a link to the home page. Use only the NumFall facts given; never invent features, ratings, download counts, awards or reviews.

Openings and endings. Open on something specific (a grid, a move, a common mistake), never a definition, a question or "In the world of...". End on a plain fact, a technique to try, or what happens next. Never a summary or a "download now" line.

Before you answer, check your text against every rule above and fix anything that breaks one.`;
}

export interface AppFacts {
  text: string; // the facts sheet used in prompts
  checkedAt: string;
  changes: string[]; // differences found on the App Store page or the website
}

export const BASE_APP_FACTS = [
  'Name: NumFall: Number Puzzle Game. Subtitle: "Brain Games & Logic Puzzles". Category: Puzzle. Age rating 4+. Free.',
  'Devices: iPhone and iPad (iOS/iPadOS 17 or later), and Mac with Apple silicon (macOS 14 or later). Not on Android.',
  'How it plays: pick a number from the tray and tap a column. The number falls to the lowest empty cell. Every row, column and box must hold each number once. Because numbers fall, the order you drop them in is the puzzle.',
  'Boards: Quick 4×4 (30 levels), Classic 6×6 (100 levels), Master 9×9 (100 levels). Levels are timed, and finishing fast with no mistakes earns 3 stars. Levels come in named sets of ten, with flames for difficulty and a chest at the end of each set.',
  'Daily Drop: one puzzle a day, the same for every player, with a streak.',
  'Sparks are earned by playing, never bought, and pay for hints, undos, an extra heart or a skip. Every level can be solved by logic alone, with no guessing.',
  'No ads, no accounts, no purchases.',
  'Game Center leaderboards and achievements, iCloud sync, haptics, a one-minute tutorial. Supports Dynamic Type, VoiceOver and Reduce Motion.',
];

export function appFactsBlock(f: AppFacts, slug: string): string {
  return `NUMFALL FACTS (the only things you may say about the app; checked ${f.checkedAt.slice(0, 10)}):
${f.text}
App Store link for this article: ${appStoreLink(slug)}
Home page: ${SITE}/`;
}

export const lengthTarget = (a: Article) => LENGTHS[a.options.length] ?? LENGTHS.medium;

export function researchPrompt(a: Article): { system: string; user: string } {
  return {
    system: `You research facts for a puzzle website article. Use web search. Only facts you actually found go in, each with its source name, URL and publication date. Never invent a fact, source, URL or date.`,
    user: `Topic: ${a.options.topic}
The article is written as of ${a.options.asOf}. Only use sources published on or before ${a.options.asOf}, and nothing that happened after that date.

Find 6 to 12 useful, specific facts for this topic: rules and history of the puzzle type (described without brand or game names), named solving techniques, grid sizes, and, for brain or habit topics, findings from named studies or official bodies with their year. Keep health and brain findings modest and exactly as the source states them.

Return JSON: {"summary": "two sentences on what the sources agree on", "facts": [{"fact": "...", "source": "publication or organisation", "url": "https://...", "date": "YYYY-MM-DD or YYYY-MM or YYYY"}]}`,
  };
}

export const RESEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'facts'],
  properties: {
    summary: { type: 'string' },
    facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['fact', 'source', 'url', 'date'], properties: { fact: { type: 'string' }, source: { type: 'string' }, url: { type: 'string' }, date: { type: 'string' } } } },
  },
};

export function factSheet(a: Article): string {
  const f = a.research?.facts ?? [];
  return f.length ? f.map((x, i) => `${i + 1}. ${x.fact} (${x.source}, ${x.date}; ${x.url})`).join('\n') : '(no outside facts: write only from the puzzle rules and the NumFall facts, and make no claims that need a source)';
}

export function planPrompt(a: Article, s: Settings, existing: PostIndexEntry[], facts: AppFacts): { system: string; user: string } {
  const L = lengthTarget(a);
  const live = existing.filter(p => p.status !== 'unpublished');
  return {
    system: `You plan articles for numfall.store, a website about number puzzles, logic puzzles, brain games, puzzle-solving techniques and casual mobile gaming. The site's goal is search traffic that turns into downloads of the NumFall iPhone app, where it fits naturally.`,
    user: `Plan one article.
Topic: ${a.options.topic}
Author: ${a.options.author} (the persona must fit this name; never invent personal stories)
Written as of: ${a.options.asOf}
Length: about ${L.words} words of body text in ${L.sections} sections (the first section has no heading), plus an FAQ written later.

Research notes:
${factSheet(a)}

${appFactsBlock(facts, 'preview')}

Existing titles and headings on the site (yours must not repeat any of them or reuse a title pattern):
${live.slice(0, 120).map(p => `- ${p.title} | ${p.headings.join(' / ')}`).join('\n') || '(none yet)'}

Existing articles you may link to (pick 3 to 5 related ones by slug, or fewer if few exist):
${live.slice(0, 120).map(p => `- ${p.slug}: ${p.title}`).join('\n') || '(none yet)'}

Rules for the plan:
- Title: 60 characters or less, sentence case, with the main search phrase near the start. Never a game, app or brand name. No colon-and-number template like "X: 7 tips".
- Slug: 3 to 6 lowercase words joined by hyphens, from the search phrase.
- Description (meta): 155 characters or less, plain, includes the search phrase, no hype.
- Headings: sentence case, specific, never a question-and-answer pair, never repeating a heading from the list above.
- appMentions: 0, 1 or 2. Use 0 when NumFall does not answer the reader's question.
- Category: one of How-to and techniques, Number puzzles, Brain and habits, Casual gaming, NumFall guides.

${writingRules(s, s.bannedNames)}`,
  };
}

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'slug', 'searchPhrase', 'description', 'angle', 'persona', 'opening', 'structure', 'ending', 'category', 'tags', 'sections', 'related', 'appMentions'],
  properties: {
    title: { type: 'string' },
    slug: { type: 'string' },
    searchPhrase: { type: 'string' },
    description: { type: 'string' },
    angle: { type: 'string' },
    persona: { type: 'string' },
    opening: { type: 'string' },
    structure: { type: 'string' },
    ending: { type: 'string' },
    category: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    sections: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['heading', 'brief', 'words'], properties: { heading: { type: 'string' }, brief: { type: 'string' }, words: { type: 'integer' } } } },
    related: { type: 'array', items: { type: 'string' } },
    appMentions: { type: 'integer' },
  },
};

export function sectionPrompt(a: Article, s: Settings, i: number, facts: AppFacts, mentionsLeft: number): { system: string; user: string } {
  const p = a.plan!;
  const sec = p.sections[i];
  const before = a.body.length ? a.body.map(b => (b.type === 'h2' ? `## ${b.text}` : b.type === 'p' ? b.text : b.items.map(x => `- ${x}`).join('\n'))).join('\n\n') : '(nothing yet: this is the opening)';
  return {
    system: `You are ${a.options.author}, writing for numfall.store. Persona: ${p.persona}. You write one section at a time.`,
    user: `Article title: ${p.title}
Angle: ${p.angle}
Opening plan: ${p.opening}
Structure: ${p.structure}
Ending plan: ${p.ending}
Written as of ${a.options.asOf}: write about the world as it was on that date and mention no later events.

Write section ${i + 1} of ${p.sections.length}${sec.heading ? ` (its heading "${sec.heading}" is added for you; do not repeat it)` : ' (the opening, no heading)'}.
What it covers: ${sec.brief}
Length: about ${sec.words} words.
${i === p.sections.length - 1 ? 'This is the last section: end on a plain fact, a technique to try, or what happens next. No summary.' : 'Do not sum up at the end of the section.'}
${mentionsLeft > 0 ? `You may mention NumFall at most ${mentionsLeft} more time(s) in the whole article, only if it answers the reader's question here.` : 'Do not mention NumFall in this section.'}

Research notes (the only outside facts you may use):
${factSheet(a)}

${appFactsBlock(facts, a.slug ?? p.slug)}

Text so far (do not repeat its points or numbers):
${before}

Format: plain paragraphs separated by blank lines. A list is allowed only for real steps, written as lines starting with "- ". Links in markdown form [words](url), only to the App Store link or home page above. No headings, no bold.

${writingRules(s, s.bannedNames)}`,
  };
}

export function faqPrompt(a: Article, s: Settings): { system: string; user: string } {
  return {
    system: `You are ${a.options.author}, writing the FAQ for an article on numfall.store.`,
    user: `Article title: ${a.title}
Article text:
${a.body.map(b => (b.type === 'h2' ? `## ${b.text}` : b.type === 'p' ? b.text : b.items.join('\n'))).join('\n\n')}

Research notes:
${factSheet(a)}

Write 3 to 5 FAQ questions worded the way people type them into Google, each answered in 1 to 3 sentences, with varied openings (do not start every answer the same way). Do not repeat sentences from the article. Do not mention NumFall unless a question is about it.
Also write a meta description of 155 characters or less that includes "${a.plan?.searchPhrase}".

Return JSON {"faq": [{"q": "...", "a": "..."}], "description": "..."}

${writingRules(s, s.bannedNames)}`,
  };
}

export const FAQ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['faq', 'description'],
  properties: {
    faq: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['q', 'a'], properties: { q: { type: 'string' }, a: { type: 'string' } } } },
    description: { type: 'string' },
  },
};

export function rewritePrompt(a: Article, s: Settings, items: { id: number; sentence: string; context: string }[]): { system: string; user: string } {
  return {
    system: `You are ${a.options.author}, editing your own article on numfall.store. You rewrite single sentences.`,
    user: `Rewrite each sentence below so it reads like a careful person wrote it: plain and literal, with a different structure from the original. Keep every fact, number and name. Each rewrite must fit back into its paragraph (shown for context) and must not add anything.

${items.map(x => `#${x.id}\nSENTENCE: ${x.sentence}\nPARAGRAPH: ${x.context}`).join('\n\n')}

Return JSON {"rewrites": [{"id": 1, "text": "..."}]}

${writingRules(s, s.bannedNames)}`,
  };
}

export const REWRITE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rewrites'],
  properties: { rewrites: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id: { type: 'integer' }, text: { type: 'string' } } } } },
};

export function linksPrompt(a: Article, candidates: PostIndexEntry[]): { system: string; user: string } {
  return {
    system: 'You choose internal links for a puzzle website, the way an SEO editor would.',
    user: `Pick 2 or 3 of these live articles that a reader of this article would find useful. For each, choose the anchor text: the words in this article that will become the link.

Anchor rules:
- The anchor must already appear word for word in a paragraph of the article below (not in a heading, not in the first paragraph). Do not change any text.
- Choose words a person would type into Google to find the linked article: its topic or technique, such as "naked pairs", "6x6 grid puzzle", "daily puzzle routine" or "puzzles for older adults". Use the linked article's title and tags to judge this.
- 2 to 5 words. Never generic words like "this article", "read more", "learn more", "here", "this guide" or "click".
- Each anchor different, and each linked article used once.
- If no phrase in the article fits a link that well, leave that link out. Fewer good links are better than a weak one.

Live articles (slug: title [tags]):
${candidates.map(p => `- ${p.slug}: ${p.title}${p.tags.length ? ` [${p.tags.join(', ')}]` : ''}`).join('\n')}

Article:
${a.body.filter(b => b.type !== 'h2').map(b => (b.type === 'p' ? b.text : b.items.join('\n'))).join('\n\n')}

Return JSON {"links": [{"slug": "...", "anchor": "..."}]}`,
  };
}

export const LINKS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['links'],
  properties: { links: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['slug', 'anchor'], properties: { slug: { type: 'string' }, anchor: { type: 'string' } } } } },
};

export function titlePrompt(a: Article, existing: string[]): { system: string; user: string } {
  return {
    system: 'You write article titles for a puzzle website.',
    user: `The planned title "${a.plan?.title}" repeats the pattern of a title already on the site. Write one new title for the same article.
Main search phrase: ${a.plan?.searchPhrase}
Rules: 60 characters or less, sentence case, the search phrase near the start, plain and literal, no game, app or brand names, no hype words, no "X: N tips" template, and not shaped like any of these:
${existing.slice(0, 60).map(t => `- ${t}`).join('\n')}

Return JSON {"title": "..."}`,
  };
}

export const TITLE_SCHEMA = { type: 'object', additionalProperties: false, required: ['title'], properties: { title: { type: 'string' } } };

export function verifyPrompt(a: Article, items: { id: number; sentence: string }[]): { system: string; user: string } {
  return {
    system: 'You fact-check sentences for a puzzle website with one web search each. Never invent a source.',
    user: `Each sentence below was flagged for checking. Search once per sentence. If the sentence is right, return it unchanged. If it is wrong and the search shows the right fact, return a corrected sentence in the same plain style. If you cannot confirm it, return an empty string so the sentence is removed. Only use sources dated on or before ${a.options.asOf}.

${items.map(x => `#${x.id}: ${x.sentence}`).join('\n')}

Return JSON {"results": [{"id": 1, "text": "..."}]}`,
  };
}

export const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: { results: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id: { type: 'integer' }, text: { type: 'string' } } } } },
};
