import { describe, expect, it } from "vitest";
import { isDue } from "../src/lib/due.js";

const interval = 7 * 24 * 60 * 60 * 1000;

describe("isDue", () => {
  it("is due when never fetched", () => {
    expect(isDue({ availableAt: null, lastSuccessfullyFetched: null }, interval)).toBe(true);
  });

  it("waits out retry backoff", () => {
    const now = 1_000_000;
    expect(
      isDue({ availableAt: new Date(now + 1000), lastSuccessfullyFetched: null }, interval, now),
    ).toBe(false);
  });

  it("retries when backoff elapsed even if cadence window is fresh", () => {
    const now = 1_000_000;
    expect(
      isDue(
        { availableAt: new Date(now - 1), lastSuccessfullyFetched: new Date(now) },
        interval,
        now,
      ),
    ).toBe(true);
  });
});
