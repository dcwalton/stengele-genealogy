import { getStore } from '@netlify/blobs';

/**
 * Serverless equivalent of server.js: stores each genealogy as a blob
 * keyed by name. Handles:
 *   GET    /api/genealogies          -> string[]
 *   GET    /api/genealogy/:name      -> JsonGedcomData
 *   PUT    /api/genealogy/:name      -> { ok: true }
 *   DELETE /api/genealogy/:name      -> { ok: true }
 */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidGenealogy(data: unknown): data is { indis: unknown[]; fams: unknown[] } {
  return (
    !!data &&
    typeof data === 'object' &&
    Array.isArray((data as { indis?: unknown }).indis) &&
    Array.isArray((data as { fams?: unknown }).fams)
  );
}

export default async (req: Request): Promise<Response> => {
  // Strip the function prefix; the original /api path is preserved in req.url.
  const pathname = new URL(req.url).pathname;
  const segments = pathname
    .replace(/^\/.netlify\/functions\/api/, '')
    .replace(/^\/api/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);

  const store = getStore('genealogies');

  // GET /api/genealogies
  if (req.method === 'GET' && segments.length === 1 && segments[0] === 'genealogies') {
    const { blobs } = await store.list();
    const names = blobs.map((b) => b.key).sort((a, b) => a.localeCompare(b));
    return json(names);
  }

  // /api/genealogy/:name
  if (segments[0] === 'genealogy' && segments[1]) {
    const name = segments[1];

    if (req.method === 'GET') {
      const data = await store.get(name, { type: 'json' });
      return data ? json(data) : json({ error: 'No genealogy data stored under that name.' }, 404);
    }

    if (req.method === 'PUT') {
      let data: unknown;
      try {
        data = await req.json();
      } catch {
        return json({ error: 'Invalid JSON body.' }, 400);
      }
      if (!isValidGenealogy(data)) {
        return json({ error: 'Invalid genealogy data: expected { indis: [], fams: [] }.' }, 400);
      }
      await store.set(name, JSON.stringify(data));
      return json({ ok: true });
    }

    if (req.method === 'DELETE') {
      try {
        await store.delete(name);
        return json({ ok: true });
      } catch {
        return json({ error: 'No genealogy stored under that name.' }, 404);
      }
    }
  }

  return json({ error: 'Not found.' }, 404);
};
