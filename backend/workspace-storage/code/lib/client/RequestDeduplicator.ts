export class RequestDeduplicator {
  private inFlight = new Map<string, Promise<any>>();

  public async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>;
    }

    const promise = fetcher().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  public cancel(key: string): void {
    this.inFlight.delete(key);
  }

  public clear(): void {
    this.inFlight.clear();
  }
}

export const globalRequestDeduplicator = new RequestDeduplicator();
