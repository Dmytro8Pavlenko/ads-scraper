import { describe, expect, it } from "vitest";
import { backoffMs } from "../src/lib/outcome.js";

describe("backoffMs", () => {
  it("starts at 1 minute and doubles, capped at 60", () => {
    expect(backoffMs(0)).toBe(60_000);
    expect(backoffMs(1)).toBe(120_000);
    expect(backoffMs(2)).toBe(240_000);
    expect(backoffMs(6)).toBe(60 * 60_000);
    expect(backoffMs(20)).toBe(60 * 60_000);
  });
});
