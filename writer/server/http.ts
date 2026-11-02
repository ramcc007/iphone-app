export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...headers },
  });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Missing environment variable ${name}. Add it in Vercel > numfall-site > Settings > Environment Variables, then redeploy.`);
  return v;
}

export const optEnv = (name: string, fallback = '') => process.env[name] || fallback;

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: e instanceof Error ? e.message : String(e) }, 500);
}
