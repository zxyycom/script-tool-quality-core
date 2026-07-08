import { performance } from "node:perf_hooks";

export type Timings = ReturnType<typeof createTimings>;

export function createTimings(timingsEnabled = false) {
  const startedAt = performance.now();
  const records: { durationMs: number; label: string }[] = [];

  const record = (label: string, startMs: number) => {
    records.push({ label, durationMs: performance.now() - startMs });
  };

  return {
    measure<T>(label: string, callback: () => T): T {
      if (!timingsEnabled) return callback();
      const startMs = performance.now();
      try {
        return callback();
      } finally {
        record(label, startMs);
      }
    },
    async measureAsync<T>(label: string, callback: () => Promise<T>): Promise<T> {
      if (!timingsEnabled) return callback();
      const startMs = performance.now();
      try {
        return await callback();
      } finally {
        record(label, startMs);
      }
    },
    print(): void {
      if (!timingsEnabled) return;
      const totalMs = performance.now() - startedAt;
      const longest = [...records].sort((a, b) => b.durationMs - a.durationMs).slice(0, 12);
      console.log("");
      console.log("Timing breakdown:");
      for (const record of longest) {
        console.log(`  ${formatTiming(record.durationMs).padStart(7)}  ${record.label}`);
      }
      console.log(`  ${formatTiming(totalMs).padStart(7)}  total`);
    }
  };
}

function formatTiming(durationMs: number): string {
  return `${durationMs.toFixed(durationMs < 100 ? 1 : 0)}ms`;
}
