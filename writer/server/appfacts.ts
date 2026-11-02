// Before writing, the NumFall facts are checked against the App Store listing (Apple's public lookup API)
// and the website, at most once a day. A fact that is no longer true is dropped or corrected.
import { APP_ID, SITE } from '../shared/settings';
import { BASE_APP_FACTS, type AppFacts } from './prompts';
import { db } from './db';
import { optEnv } from './http';

const KEY = 'app_facts';
const DAY = 86400_000;

interface Lookup {
  trackName?: string;
  price?: number;
  formattedPrice?: string;
  contentAdvisoryRating?: string;
  minimumOsVersion?: string;
  primaryGenreName?: string;
  description?: string;
  version?: string;
}

export async function appFacts(force = false): Promise<AppFacts> {
  const cached = await db.getState<AppFacts>(KEY).catch(() => null);
  if (!force && cached && Date.now() - Date.parse(cached.checkedAt) < DAY) return cached;
  const facts = [...BASE_APP_FACTS];
  const changes: string[] = [];
  try {
    const r = await fetch(`${optEnv('APPSTORE_LOOKUP_URL', 'https://itunes.apple.com/lookup')}?id=${APP_ID}&country=us`, { signal: AbortSignal.timeout(8_000) });
    const app = ((await r.json()) as { results?: Lookup[] }).results?.[0];
    if (!app) throw new Error('not found');
    if (app.price && app.price > 0) {
      facts[0] = facts[0].replace(' Free.', ` Price: ${app.formattedPrice}.`);
      changes.push(`price is now ${app.formattedPrice}`);
    }
    if (app.contentAdvisoryRating && app.contentAdvisoryRating !== '4+') {
      facts[0] = facts[0].replace('Age rating 4+', `Age rating ${app.contentAdvisoryRating}`);
      changes.push(`age rating is now ${app.contentAdvisoryRating}`);
    }
    if (app.minimumOsVersion && !app.minimumOsVersion.startsWith('17')) {
      facts[1] = facts[1].replace('iOS/iPadOS 17 or later', `iOS/iPadOS ${app.minimumOsVersion} or later`);
      changes.push(`minimum iOS is now ${app.minimumOsVersion}`);
    }
    if (app.trackName && !/NumFall/i.test(app.trackName)) changes.push(`App Store name is now "${app.trackName}"`);
    // A feature the listing no longer mentions is left out of articles until it is back.
    const desc = (app.description ?? '').toLowerCase();
    if (desc) {
      for (const [word, starts] of [['daily', 'Daily Drop'], ['spark', 'Sparks']] as const) {
        if (!desc.includes(word)) {
          const i = facts.findIndex(f => f.startsWith(starts));
          if (i >= 0) facts.splice(i, 1);
          changes.push(`the App Store description no longer mentions ${starts}, so articles leave it out`);
        }
      }
    }
  } catch (e) {
    if (cached) return { ...cached, changes: [...cached.changes, `App Store check failed (${e instanceof Error ? e.message : 'error'}); using the last checked facts`] };
    changes.push('App Store check failed; using the facts from the brief');
  }
  try {
    const home = await (await fetch(`${optEnv('SITE_CHECK_URL', SITE)}/`, { signal: AbortSignal.timeout(8_000) })).text();
    if (!/no ads/i.test(home) || !/no accounts/i.test(home) || !/no purchases|no in-app purchases/i.test(home)) {
      const i = facts.indexOf('No ads, no accounts, no purchases.');
      if (i >= 0) facts.splice(i, 1);
      changes.push('the website no longer states "no ads, no accounts, no purchases", so articles leave it out');
    }
  } catch {
    changes.push('website check failed');
  }
  const out: AppFacts = { text: facts.map(f => `- ${f}`).join('\n'), checkedAt: new Date().toISOString(), changes };
  await db.putState(KEY, out).catch(() => undefined);
  return out;
}
