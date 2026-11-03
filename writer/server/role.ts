// Which app this deployment is. One repo, two Vercel projects:
//   site   (default): numfall.store - public pages, OG images and the admin area (/admin, /api/admin/*)
//   writer (APP_ROLE=writer): numfall-writer.vercel.app - the article-generation tool (/api/writer, /api/tick)
export const appRole = (): 'site' | 'writer' => (process.env.APP_ROLE === 'writer' ? 'writer' : 'site');
export const isSiteRole = () => appRole() === 'site';
export const isWriterRole = () => appRole() === 'writer';
