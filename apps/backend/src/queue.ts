export class WorkQueue {
  private tail: Promise<void> = Promise.resolve();
  private readonly onError: (error: unknown) => void;

  constructor(onError: (error: unknown) => void = () => undefined) {
    this.onError = onError;
  }

  enqueue(task: () => Promise<void>): void {
    this.tail = this.tail.then(async () => {
      try {
        await task();
      } catch (error) {
        this.onError(error);
      }
    });
  }

  drain(): Promise<void> {
    return this.tail;
  }
}
