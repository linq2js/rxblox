import { dispatcherToken, getDispatcher, withDispatchers } from "./dispatcher";

export const batchToken = dispatcherToken<BatchDispatcher>("batchDispatcher");

export type BatchDispatcher = {
  enqueue(fn: VoidFunction, key?: unknown): void;
  dequeue(key: unknown): void;
  flush(): void;
};

export function batchDispatcher(): BatchDispatcher {
  const queue = new Map<unknown, VoidFunction>();

  return {
    enqueue(fn: VoidFunction, key?: unknown): void {
      queue.set(key ?? {}, fn);
    },
    dequeue(key: unknown): void {
      queue.delete(key);
    },
    flush(): void {
      queue.forEach((fn) => fn());
    },
  };
}

export function batch(fn: () => void) {
  if (getDispatcher(batchToken)) {
    return fn();
  }

  const dispatcher = batchDispatcher();
  return withDispatchers([batchToken(dispatcher)], () => {
    try {
      return fn();
    } finally {
      dispatcher.flush();
    }
  });
}
