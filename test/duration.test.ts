import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDuration } from "../src/lib/duration.js";

const example = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../docs/context/example-app-ads.txt"),
  "utf8",
);

describe("parseDuration", () => {
  it("parses env forms used by the service", () => {
    expect(parseDuration("60s")).toEqual({ input: "60s", ms: 60_000, pg: "60 seconds" });
    expect(parseDuration("10m").pg).toBe("10 minutes");
    expect(parseDuration("24h").ms).toBe(24 * 3_600_000);
    expect(parseDuration("7d").pg).toBe("7 days");
  });
});

describe("example-app-ads.txt", () => {
  it("hashes stably", () => {
    const hash = createHash("sha256").update(example, "utf8").digest("hex");
    expect(hash).toHaveLength(64);
    expect(example).toMatch(/google\.com, pub-1234567890123456, DIRECT/);
  });
});
