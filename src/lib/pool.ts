/**
 * Keep `concurrency` slots busy. When one finishes, start the next immediately.
 * A slot is whatever `take` returns: one id, or an Apple Lookup batch.
 * BRPOP only when every slot is idle.
 */
export async function runSlots(opts: {
  concurrency: number;
  stopping: () => boolean;
  take: (waitIfEmpty: boolean) => Promise<number[] | null>;
  run: (ids: number[]) => Promise<void>;
}): Promise<void> {
  const running = new Set<Promise<void>>();

  const launch = (ids: number[]) => {
    const job = opts
      .run(ids)
      .catch((err) => console.error("slot failed", err))
      .finally(() => running.delete(job));
    running.add(job);
  };

  while (!opts.stopping() || running.size > 0) {
    while (!opts.stopping() && running.size < opts.concurrency) {
      const ids = await opts.take(running.size === 0);
      if (!ids?.length) break;
      launch(ids);
    }

    if (running.size === 0) continue;
    await Promise.race(running);
  }
}
