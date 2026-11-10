import { createBroker, defaultConfig } from './handler.js';

interface LambdaEvent {
  rawPath?: string;
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
  requestContext?: { http?: { method?: string; sourceIp?: string } };
}

/** Lambda function-URL / API Gateway v2 wrapper. Origins come from BROKER_ALLOWED_ORIGINS (comma list). */
export function createLambdaHandler(env: Record<string, string | undefined> = process.env) {
  const origins = (env['BROKER_ALLOWED_ORIGINS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const broker = createBroker({ config: defaultConfig(origins), env, fetch });
  return async (ev: LambdaEvent) => {
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(ev.headers ?? {})) headers[k.toLowerCase()] = v;
    const raw = ev.body ?? '';
    const res = await broker({
      method: ev.requestContext?.http?.method ?? 'POST',
      path: ev.rawPath ?? '/',
      headers,
      body: ev.isBase64Encoded === true ? Buffer.from(raw, 'base64').toString('utf8') : raw,
      ip: ev.requestContext?.http?.sourceIp ?? 'unknown',
    });
    return { statusCode: res.status, headers: res.headers, body: res.body };
  };
}
