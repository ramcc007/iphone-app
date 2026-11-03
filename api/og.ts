// Open Graph / Twitter image per article: /og/<slug>.png (1200 × 630), drawn from the live post's title.
import { ImageResponse } from '@vercel/og';
import { db } from '../writer/server/db';
import { isWriterRole } from '../writer/server/role';

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown): El => ({ type, props: { style, children } });

async function title(slug: string): Promise<string | null> {
  const row = await db.liveGet<{ title: string; category: string }>(slug).catch(() => null);
  return row ? `${row.category}\n${row.title}` : null;
}

export async function GET(req: Request): Promise<Response> {
  if (isWriterRole()) return new Response('Not found', { status: 404 });
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').replace(/\.png$/, '');
  if (!/^[a-z0-9]+(-[a-z0-9]+){2,5}$/.test(slug)) return new Response('Not found', { status: 404 });
  const t = await title(slug);
  if (!t) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  const [category, text] = t.split('\n');
  const tiles = ['#FF6B7A', '#FFB547', '#6EE7A8', '#8ADAFB'];
  const el = h('div', { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: 'linear-gradient(135deg, #13161F 0%, #1E2230 60%, #2A2350 100%)', color: '#F5F6FA', fontFamily: 'sans-serif' }, [
    h('div', { display: 'flex', alignItems: 'center', gap: '18px' }, [
      h('div', { display: 'flex', flexWrap: 'wrap', width: '58px', height: '58px', gap: '6px' }, tiles.map(c => h('div', { width: '26px', height: '26px', borderRadius: '7px', background: c }))),
      h('div', { fontSize: '40px', fontWeight: 700 }, 'NumFall'),
      h('div', { fontSize: '26px', color: '#B3A8FF', marginLeft: '16px' }, category),
    ]),
    h('div', { fontSize: text.length > 48 ? '62px' : '72px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-1px' }, text),
    h('div', { fontSize: '28px', color: '#A3A9BF' }, 'numfall.store/blog'),
  ]);
  return new ImageResponse(el as unknown as ConstructorParameters<typeof ImageResponse>[0], {
    width: 1200,
    height: 630,
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800' },
  });
}
