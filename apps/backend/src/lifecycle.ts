import type { WorkQueue } from "./queue.js";

export async function boot(listen: () => Promise<void>, register: () => Promise<void>): Promise<void> {
  await listen();
  await register();
}

export type SignalSource = {
  on(signal: NodeJS.Signals, listener: () => void): void;
};

export function installShutdown(source: SignalSource, run: () => Promise<void>): void {
  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
  for (const signal of signals) {
    source.on(signal, () => {
      void run();
    });
  }
}

export type Stoppable = {
  stop(): void | Promise<void>;
};

export async function shutdown(
  close: () => Promise<void>,
  queue: WorkQueue,
  cleanup?: () => void | Promise<void>,
  scheduler?: Stoppable,
): Promise<void> {
  if (scheduler) {
    await scheduler.stop();
  }
  await close();
  await queue.drain();
  if (cleanup) {
    await cleanup();
  }
}
