import { describe, expect, it } from "vitest";
import { roundUpToMultiple } from "../src/lib/config.js";

describe("roundUpToMultiple", () => {
  it("rounds concurrent ids up to Apple lookup batches of 50", () => {
    expect(roundUpToMultiple(10, 50)).toBe(50);
    expect(roundUpToMultiple(50, 50)).toBe(50);
    expect(roundUpToMultiple(51, 50)).toBe(100);
    expect(roundUpToMultiple(210, 50)).toBe(250);
  });
});
