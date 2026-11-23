// Small fetch helpers shared by every data source.
// A generic client name is sent to Wikimedia, as their API policy asks.

const USER_AGENT = "Sonder/0.1 (music discovery app; server-side)";

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly source: string,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

type FetchJsonOptions = {
  source: string;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
};

export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  const { source, timeoutMs = 9000, retries = 2, headers = {} } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        if (attempt < retries) await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 900 * (attempt + 1));
        throw new UpstreamError(`${source} responded ${res.status}`, source);
      }
      if (!res.ok) {
        throw new UpstreamError(`${source} responded ${res.status}`, source);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await wait(350 * (attempt + 1) + Math.random() * 200);
    }
  }
  throw lastError instanceof Error ? lastError : new UpstreamError(`${source} request failed`, source);
}

export function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Runs async work over a list with a fixed number of requests in flight. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * A per-service request queue: at most `maxInFlight` requests at once, with request
 * starts spaced `spacingMs` apart. Keeps us inside each API's fair-use limits.
 */
export function createLimiter(maxInFlight: number, spacingMs: number) {
  let inFlight = 0;
  let nextStart = 0;
  const queue: (() => void)[] = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (inFlight >= maxInFlight) await new Promise<void>((r) => queue.push(r));
    inFlight++;
    const now = Date.now();
    const startAt = Math.max(now, nextStart);
    nextStart = startAt + spacingMs;
    if (startAt > now) await wait(startAt - now);
    try {
      return await fn();
    } finally {
      inFlight--;
      queue.shift()?.();
    }
  };
}

/** Shares one in-flight promise between concurrent callers asking for the same key. */
export function shareInFlight<A extends unknown[], R>(keyOf: (...args: A) => string, fn: (...args: A) => Promise<R>) {
  const pending = new Map<string, Promise<R>>();
  return (...args: A): Promise<R> => {
    const key = keyOf(...args);
    const existing = pending.get(key);
    if (existing) return existing;
    const p = fn(...args).finally(() => pending.delete(key));
    pending.set(key, p);
    return p;
  };
}
