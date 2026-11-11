export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Lets a test hold an async call open and decide the completion order of overlapping operations,
 * which is the only way to reproduce stale-overwrite and reversed-write races deterministically.
 */
export function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/** Lets already-resolved promise chains inside the code under test run to completion. */
export function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
