import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyAppAdsBody, looksLikeAppAds } from "../src/lib/appads.js";

const example = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../docs/context/example-app-ads.txt"),
  "utf8",
);

describe("classifyAppAdsBody", () => {
  it("accepts a real app-ads.txt even if served as text/html", () => {
    expect(looksLikeAppAds(example)).toBe(true);
    expect(classifyAppAdsBody(example, "text/html; charset=utf-8", "https://example.com/app-ads.txt")).toBe(
      "file",
    );
  });

  it("rejects a homepage", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Facebook</title></head><body></body></html>`;
    expect(classifyAppAdsBody(html, "text/html", "https://facebook.com/app-ads.txt")).toBe("not_file");
  });

  it("treats recaptcha as captcha", () => {
    const html = `<!doctype html><html><head><base href="https://www.google.com/recaptcha/challengepage/"></head></html>`;
    expect(
      classifyAppAdsBody(html, "text/html", "https://www.google.com/recaptcha/challengepage/"),
    ).toBe("captcha");
  });

  it("rejects empty 200", () => {
    expect(classifyAppAdsBody("  \n", "text/plain", "https://x.com/app-ads.txt")).toBe("not_file");
  });
});
