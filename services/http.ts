import { redact } from '@/security/core/sanitize';

/**
 * Hardened JSON HTTP client:
 * - HTTPS only (plain HTTP allowed solely for explicitly whitelisted local dev hosts)
 * - per-request timeout via AbortController
 * - exponential backoff with full jitter on network errors, 429 and 5xx (honours Retry-After)
 * - in-flight request de-duplication (identical concurrent GETs share one network call)
 * - response size cap and JSON-only parsing
 * - redacted error messages (no tokens / keys in logs)
 */

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  /** Allow http:// for this request (only used for user-approved local development backends). */
  allowInsecureDev?: boolean;
  signal?: AbortSignal;
  maxBytes?: number;
}

const inflight = new Map<string, Promise<unknown>>();
const DEV_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function backoffDelay(attempt: number, baseMs = 400, capMs = 8000, rand: () => number = Math.random): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(rand() * exp);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new HttpError('Request cancelled', null, false));
    });
  });

function checkUrl(url: string, allowInsecureDev?: boolean): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new HttpError('Invalid URL', null, false);
  }
  if (u.protocol === 'https:') return u;
  if (u.protocol === 'http:' && allowInsecureDev && DEV_HOST.test(u.hostname)) return u;
  throw new HttpError('Blocked insecure (non-HTTPS) request', null, false);
}

async function once<T>(url: string, opts: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  opts.signal?.addEventListener('abort', () => controller.abort());
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { Accept: 'application/json', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
    } as RequestInit);
    if (!res.ok) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const err = new HttpError(`HTTP ${res.status}`, res.status, res.status === 429 || res.status >= 500);
      (err as HttpError & { retryAfterMs?: number }).retryAfterMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined;
      throw err;
    }
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) throw new HttpError('Unexpected content type', res.status, false);
    const text = await res.text();
    if (text.length > (opts.maxBytes ?? 8_000_000)) throw new HttpError('Response too large', res.status, false);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new HttpError('Malformed JSON response', res.status, false);
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const aborted = (e as Error)?.name === 'AbortError';
    throw new HttpError(aborted ? 'Request timed out' : `Network error: ${redact(String((e as Error)?.message ?? e))}`, null, true);
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJson<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  checkUrl(url, opts.allowInsecureDev);
  const method = opts.method ?? 'GET';
  const key = method === 'GET' ? `${url}|${JSON.stringify(opts.headers ?? {})}` : null;
  if (key && inflight.has(key)) return inflight.get(key) as Promise<T>;

  const run = (async () => {
    const retries = opts.retries ?? (method === 'GET' ? 3 : 0);
    let attempt = 0;
    for (;;) {
      try {
        return await once<T>(url, opts);
      } catch (e) {
        const err = e as HttpError & { retryAfterMs?: number };
        if (!err.retryable || attempt >= retries) throw err;
        await sleep(err.retryAfterMs ?? backoffDelay(attempt), opts.signal);
        attempt++;
      }
    }
  })();
  if (key) {
    inflight.set(key, run);
    run.finally(() => inflight.delete(key)).catch(() => undefined);
  }
  return run;
}

/** Test hook. */
export function _inflightCount(): number {
  return inflight.size;
}
