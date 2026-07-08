export async function runBoundedTasks<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  runTask: (input: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const limit = Math.max(1, concurrency);
  const results: Array<TOutput | undefined> = Array.from(
    { length: inputs.length },
    () => undefined as TOutput | undefined
  );
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex++;
      if (currentIndex >= inputs.length) return;
      results[currentIndex] = await runTask(inputs[currentIndex]!, currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, inputs.length) }, () => worker());
  await Promise.all(workers);

  return results.map((result) => {
    if (result === undefined) {
      throw new Error("bounded task completed without result");
    }
    return result;
  });
}
