import psl from "psl";

export function hostFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  let host = url.hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.startsWith("www.")) host = host.slice(4);
  if (!host || host.includes(":")) return null;
  return host;
}

export function etldPlusOne(host: string): string | null {
  const parsed = psl.parse(host);
  if ("error" in parsed && parsed.error) return null;
  if (!("domain" in parsed) || !parsed.domain) return null;
  return parsed.domain;
}

export function fallbackHosts(host: string): string[] {
  const root = etldPlusOne(host);
  if (root && root !== host) return [host, root];
  return [host];
}
