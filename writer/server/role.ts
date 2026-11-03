// Which app this deployment is. One repo, two Vercel projects:
//   site   (default): numfall.store - public pages, OG images and the admin area (/admin, /api/admin/*)
//   writer (APP_ROLE=writer): numfall-writer.vercel.app - the article-generation tool (/api/writer, /api/tick)
export const appRole = (): 'site' | 'writer' => (process.env.APP_ROLE === 'writer' ? 'writer' : 'site');
export const isSiteRole = () => appRole() === 'site';
export const isWriterRole = () => appRole() === 'writer';

// The article writer's old addresses on numfall.store: gone for good (410), never indexed.
export const gone = () =>
  new Response(JSON.stringify({ error: 'The article writer has moved off numfall.store.' }), {
    status: 410,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600', 'x-robots-tag': 'noindex' },
  });
