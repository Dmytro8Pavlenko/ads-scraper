const ADS_RECORD =
  /^\s*[^#\s][^,\n]*,\s*[^,\n]+,\s*(DIRECT|RESELLER)\b/im;
const ADS_VAR = /^\s*(CONTACT|OWNERDOMAIN|MANAGERDOMAIN|SUBDOMAIN)\s*=/im;

export type AppAdsBodyKind = "file" | "not_file" | "captcha";

export function looksLikeAppAds(body: string): boolean {
  return ADS_RECORD.test(body) || ADS_VAR.test(body);
}

export function looksLikeHtml(body: string, contentType?: string | null): boolean {
  const ct = contentType?.toLowerCase() ?? "";
  if (ct.includes("text/html")) return true;
  const head = body.slice(0, 800).trim();
  return /^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head);
}

export function isAppAdsCaptcha(body: string, finalUrl: string): boolean {
  const url = finalUrl.toLowerCase();
  if (url.includes("/sorry/") || url.includes("recaptcha") || url.includes("challengepage")) {
    return true;
  }
  if (/unusual traffic/i.test(body)) return true;
  if (/<html/i.test(body) && /recaptcha/i.test(body)) return true;
  return false;
}

export function classifyAppAdsBody(
  body: string,
  contentType: string | null,
  finalUrl: string,
): AppAdsBodyKind {
  if (isAppAdsCaptcha(body, finalUrl)) return "captcha";
  if (looksLikeAppAds(body)) return "file";
  if (!body.trim()) return "not_file";
  if (looksLikeHtml(body, contentType)) return "not_file";
  return "not_file";
}
