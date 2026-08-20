import { describe, expect, it } from "vitest";
import { runSlots } from "../src/lib/pool.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("runSlots", () => {
  it("keeps concurrency slots and refills as soon as one finishes", async () => {
    const q = [1, 2, 3, 4];
    let stop = false;
    let current = 0;
    let maxCurrent = 0;
    const done: number[] = [];
    const events: string[] = [];

    await runSlots({
      concurrency: 2,
      stopping: () => stop,
      take: async () => {
        const v = q.shift();
        if (v == null) {
          stop = true;
          return null;
        }
        return [v];
      },
      run: async ([id]) => {
        current += 1;
        maxCurrent = Math.max(maxCurrent, current);
        events.push(`start:${id}`);
        await sleep(id === 1 ? 40 : 10);
        events.push(`end:${id}`);
        current -= 1;
        done.push(id);
      },
    });

    expect(maxCurrent).toBe(2);
    expect(done.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(events.indexOf("start:3")).toBeLessThan(events.indexOf("end:1"));
  });
});
