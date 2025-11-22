/**
 * batch - Execute multiple signal updates in a single batch
 *
 * Batching prevents intermediate re-renders and notifications when updating
 * multiple signals. All listeners are notified only once after the batch completes.
 *
 * Benefits:
 * - Performance: Single notification instead of multiple
 * - Consistency: Observers see all updates together
 * - Atomicity: Either all updates succeed or none (on error)
 *
 * @param fn - Function containing signal updates to batch
 * @returns The return value of the batched function
 *
 * @example
 * ```tsx
 * const count = signal(0);
 * const name = signal("Alice");
 *
 * // Without batch: 2 notifications
 * count.set(1);
 * name.set("Bob");
 *
 * // With batch: 1 notification
 * batch(() => {
 *   count.set(1);
 *   name.set("Bob");
 * });
 * ```
 *
 * @example Nested batches
 * ```tsx
 * batch(() => {
 *   count.set(1);
 *   batch(() => {
 *     name.set("Bob");
 *   }); // No notification yet
 * }); // Single notification for both
 * ```
 *
 * @example With return value
 * ```tsx
 * const result = batch(() => {
 *   count.set(1);
 *   name.set("Bob");
 *   return { count: count(), name: name() };
 * });
 * ```
 */

// Track batching state
let batchDepth = 0;
const pendingNotifications = new Set<() => void>();

export function batch<T>(fn: () => T): T {
  // Enter batch mode
  batchDepth++;

  try {
    // Execute the batched function
    const result = fn();

    // Check if result is a promise (async function)
    if (result && typeof result === "object" && "then" in result) {
      throw new Error(
        "batch() does not support async functions. " +
          "Batch operations must be synchronous to ensure all updates complete before notifications."
      );
    }

    return result;
  } finally {
    // Exit batch mode
    batchDepth--;

    // If we're back to depth 0, flush all pending notifications
    if (batchDepth === 0) {
      const notifications = Array.from(pendingNotifications);
      pendingNotifications.clear();

      // Execute all notifications
      notifications.forEach((notify) => notify());
    }
  }
}

/**
 * Check if currently inside a batch
 * @internal
 */
export function isBatching(): boolean {
  return batchDepth > 0;
}

/**
 * Schedule a notification to run after the current batch completes
 * If not batching, executes immediately
 * @internal
 */
export function scheduleNotification(notify: () => void): void {
  if (batchDepth > 0) {
    // We're batching - defer notification
    pendingNotifications.add(notify);
  } else {
    // Not batching - execute immediately
    notify();
  }
}
