import { Agent, fetch, ProxyAgent, type Dispatcher } from "undici";

export type HttpGetResult = {
  status: number;
  body: string;
  headers: Headers;
  finalUrl: string;
};

export type HttpGetOptions = {
  headers?: Record<string, string>;
  timeoutMs: number;
  userAgent: string;
  proxyUrl?: string;
};

export function isRetryableHttp(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}

export class HttpError extends Error {
  readonly kind: "timeout" | "network";
  readonly status = null;

  constructor(kind: "timeout" | "network", message: string) {
    super(message);
    this.kind = kind;
    this.name = "HttpError";
  }
}

function dispatcher(proxyUrl?: string): Dispatcher {
  if (proxyUrl) return new ProxyAgent(proxyUrl);
  return new Agent({ keepAliveTimeout: 10_000 });
}

let proxyCursor = 0;

export function pickProxy(proxies: string[]): string | undefined {
  if (proxies.length === 0) return undefined;
  const url = proxies[proxyCursor % proxies.length];
  proxyCursor += 1;
  return url;
}

export async function httpGet(url: string, opts: HttpGetOptions): Promise<HttpGetResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ac.signal,
      dispatcher: dispatcher(opts.proxyUrl),
      headers: {
        "user-agent": opts.userAgent,
        accept: "*/*",
        ...opts.headers,
      },
    });
    const body = await res.text();
    return {
      status: res.status,
      body,
      headers: res.headers as unknown as Headers,
      finalUrl: res.url,
    };
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") {
      throw new HttpError("timeout", "timeout");
    }
    throw new HttpError("network", e.message || "network");
  } finally {
    clearTimeout(timer);
  }
}
