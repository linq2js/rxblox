import { dispatcherToken } from "./dispatcher";

/**
 * Dispatcher token for accessing the current batch context.
 * Used internally to detect if code is executing within a batch.
 */
export const batchToken = dispatcherToken<BatchDispatcher>("batchDispatcher");

/**
 * Batch dispatcher for queuing and flushing signal notifications.
 *
 * The batch dispatcher maintains a queue of pending notifications during
 * a batch operation. Notifications are keyed by signal identity to ensure
 * deduplication - only the last notification for each signal is kept.
 */
export type BatchDispatcher = {
  /**
   * Enqueues a notification function to be executed after the batch completes.
   * @param fn - The notification function to queue
   * @param key - Optional key for deduplication (typically the signal instance)
   */
  enqueue(fn: VoidFunction, key?: unknown): void;

  /**
   * Removes a queued notification by its key.
   * @param key - The key of the notification to remove
   */
  dequeue(key: unknown): void;

  /**
   * Executes all queued notifications and clears the queue.
   */
  flush(): void;
};

/**
 * Creates a new batch dispatcher instance.
 *
 * The dispatcher uses a Map to ensure notification deduplication:
 * - Multiple updates to the same signal only trigger one notification
 * - The last notification overwrites previous ones
 * - Notifications execute in insertion order
 */
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
