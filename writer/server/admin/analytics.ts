// Traffic snapshot for the admin dashboard from the GA4 Data API, read with a service account.
// Env: GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_EMAIL, GA4_SERVICE_ACCOUNT_PRIVATE_KEY (literal "\n" in the key is fine).
// Google's own error text never reaches the page: problems come back as one plain sentence (details go to the error log).
import { db } from '../db';
import { HttpError } from '../http';

export const RANGES = {
  today: { startDate: 'today', endDate: 'today', label: 'Today' },
  yesterday: { startDate: 'yesterday', endDate: 'yesterday', label: 'Yesterday' },
  '7d': { startDate: '6daysAgo', endDate: 'today', label: 'Last 7 days' },
  '30d': { startDate: '29daysAgo', endDate: 'today', label: 'Last 30 days' },
} as const;
export type RangeKey = keyof typeof RANGES;

export const GA4_ENV = ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_EMAIL', 'GA4_SERVICE_ACCOUNT_PRIVATE_KEY'] as const;

export class NotConfigured extends Error {
  constructor(public missing: string[]) {
    super(`Google Analytics is not set up. Add ${missing.join(', ')} in Vercel > numfall-site > Settings > Environment Variables, then redeploy.`);
  }
}

export interface Snapshot {
  range: RangeKey;
  label: string;
  tiles: { activeUsers: number; newUsers: number; sessions: number; pageViews: number; avgSessionSeconds: number };
  topPages: { path: string; title: string; views: number }[];
  devices: { device: string; users: number }[];
  locations: { city: string; country: string; users: number }[];
  generatedAt: string;
}

type Row = { dimensionValues?: { value?: string | null }[] | null; metricValues?: { value?: string | null }[] | null };
type Report = { rows?: Row[] | null };
type Client = { runReport(req: Record<string, unknown>): Promise<[Report, ...unknown[]]> };

let client: Client | null = null;
async function getClient(): Promise<Client> {
  if (client) return client;
  const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
  client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GA4_SERVICE_ACCOUNT_EMAIL,
      private_key: String(process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY).replace(/\\n/g, '\n'),
    },
  }) as unknown as Client;
  return client;
}

const num = (v: string | null | undefined) => Number(v ?? 0) || 0;
const dims = (r: Row, i: number) => r.dimensionValues?.[i]?.value ?? '';
const met = (r: Row, i: number) => num(r.metricValues?.[i]?.value);

export async function snapshot(range: RangeKey, getReports: (reqs: Record<string, unknown>[]) => Promise<Report[]> = defaultReports): Promise<Snapshot> {
  const missing = GA4_ENV.filter(k => !process.env[k]);
  if (missing.length) throw new NotConfigured(missing);
  const r = RANGES[range];
  const base = { property: `properties/${process.env.GA4_PROPERTY_ID}`, dateRanges: [{ startDate: r.startDate, endDate: r.endDate }] };
  let reports: Report[];
  try {
    // All four reports in parallel.
    reports = await getReports([
      { ...base, metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }] },
      { ...base, dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 },
      { ...base, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 5 },
      { ...base, dimensions: [{ name: 'city' }, { name: 'country' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 10 },
    ]);
  } catch (e) {
    await db.logError({ stage: 'admin analytics', kind: 'error', message: `GA4 Data API: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) });
    throw new HttpError(502, 'Google Analytics did not answer. Check GA4_PROPERTY_ID, and that the service account has Viewer access to the property in GA4 > Admin > Property access management.');
  }
  const [totals, pages, devices, places] = reports;
  const t = totals.rows?.[0];
  return {
    range,
    label: r.label,
    tiles: {
      activeUsers: t ? met(t, 0) : 0,
      newUsers: t ? met(t, 1) : 0,
      sessions: t ? met(t, 2) : 0,
      pageViews: t ? met(t, 3) : 0,
      avgSessionSeconds: t ? Math.round(met(t, 4)) : 0,
    },
    topPages: (pages.rows ?? []).map(x => ({ path: dims(x, 0), title: dims(x, 1), views: met(x, 0) })),
    devices: (devices.rows ?? []).map(x => ({ device: dims(x, 0), users: met(x, 0) })),
    locations: (places.rows ?? []).map(x => ({ city: dims(x, 0), country: dims(x, 1), users: met(x, 0) })),
    generatedAt: new Date().toISOString(),
  };
}

async function defaultReports(reqs: Record<string, unknown>[]): Promise<Report[]> {
  const c = await getClient();
  return Promise.all(reqs.map(async q => (await c.runReport(q))[0]));
}
