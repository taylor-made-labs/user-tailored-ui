import { createServer } from 'node:http';
import { createBroker, defaultConfig } from './handler.js';

/** Local runner: `BROKER_ALLOWED_ORIGINS=http://localhost:5173 node dist/broker/server.js`. */
export function startLocal(env: Record<string, string | undefined> = process.env, port = Number(env['PORT'] ?? 8787)) {
  const origins = (env['BROKER_ALLOWED_ORIGINS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const config = defaultConfig(origins);
  const broker = createBroker({ config, env, fetch, log: (l) => console.log(l) });
  const server = createServer((rq, rs) => {
    const chunks: Buffer[] = [];
    let size = 0;
    rq.on('data', (c: Buffer) => {
      size += c.length;
      if (size <= config.maxBodyBytes + 1) chunks.push(c); // stop buffering past the cap
    });
    rq.on('end', () => {
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(rq.headers)) headers[k] = Array.isArray(v) ? v[0] : v;
      void broker({
        method: rq.method ?? 'GET',
        path: (rq.url ?? '/').split('?')[0] ?? '/',
        headers,
        body: Buffer.concat(chunks).toString('utf8'),
        ip: rq.socket.remoteAddress ?? 'unknown',
      }).then((r) => {
        rs.writeHead(r.status, r.headers);
        rs.end(r.body);
      });
    });
  });
  return server.listen(port);
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) startLocal();
