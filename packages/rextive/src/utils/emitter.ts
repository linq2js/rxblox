import { Listener, SingleOrMultipleListeners } from "../types";

/**
 * Creates an event emitter for managing and notifying listeners.
 *
 * An emitter provides a simple pub/sub pattern for managing event listeners.
 * It's used internally by signals and effects to manage subscriptions and notifications.
 *
 * Features:
 * - Add listeners that will be notified when events are emitted
 * - Emit events to all registered listeners
 * - Remove listeners via unsubscribe functions
 * - Clear all listeners at once
 * - Safe to call unsubscribe multiple times (idempotent)
 *
 * @template T - The type of payload that will be emitted to listeners (defaults to void)
 * @returns An emitter object with add, emit, and clear methods
 *
 * @example
 * ```ts
 * const eventEmitter = emitter<string>();
 *
 * // Subscribe to events
 * const unsubscribe = eventEmitter.add((message) => {
 *   console.log('Received:', message);
 * });
 *
 * // Emit an event
 * eventEmitter.emit('Hello'); // Logs: "Received: Hello"
 *
 * // Unsubscribe
 * unsubscribe();
 *
 * // Clear all listeners
 * eventEmitter.clear();
 * ```
 */
export function emitter<T = void>() {
  /**
   * Set of registered listeners that will be notified when events are emitted.
   * Using a Set provides O(1) removal and prevents duplicate listeners.
   */
  const listeners = new Set<Listener<T>>();
  const emit = (payload: T, clear: boolean) => {
    // Create snapshot - necessary because Set.forEach includes items added during iteration
    const copy = Array.from(listeners);
    if (clear) {
      listeners.clear();
    }
    // Use traditional for loop for maximum performance in this hot path
    const len = copy.length;
    for (let i = 0; i < len; i++) {
      copy[i](payload);
    }
  };

  return {
    /**
     * Adds one or more listeners to the emitter.
     *
     * The listener(s) will be called whenever `emit()` is called.
     * Returns an unsubscribe function that removes the listener(s).
     *
     * **Important**: The unsubscribe function is idempotent - calling it multiple
     * times is safe and won't cause errors. If the same listener is added multiple
     * times, it will only be called once per emit (Set deduplication).
     *
     * @param newListeners - Single listener or array of listeners to add
     * @returns An unsubscribe function that removes the listener(s)
     */
    on(newListeners: SingleOrMultipleListeners<T>): VoidFunction {
      if (Array.isArray(newListeners)) {
        newListeners.forEach((listener) => {
          listeners.add(listener);
        });
        return () => {
          newListeners.forEach((listener) => {
            listeners.delete(listener);
          });
        };
      }

      listeners.add(newListeners);

      return () => {
        listeners.delete(newListeners);
      };
    },
    /**
     * Emits an event to all registered listeners.
     *
     * **Important**: Creates a snapshot of listeners before iterating to ensure
     * that modifications during emission (adding/removing listeners) don't affect
     * the current emission cycle. This prevents:
     * - New listeners added during emission from being called immediately
     * - Issues with listeners that unsubscribe during emission
     *
     * Performance: For typical use cases (< 20 listeners), Array.from() overhead
     * is negligible compared to calling the listener functions themselves.
     *
     * @param payload - The value to pass to all listeners
     */
    emit(payload: T): void {
      emit(payload, false);
    },
    /**
     * Removes all registered listeners.
     *
     * After calling `clear()`, no listeners will be notified until new ones
     * are added via `on()`.
     */
    clear(): void {
      listeners.clear();
    },

    /**
     * Emits an event to all registered listeners and then clears all listeners.
     *
     * @param payload - The value to pass to all listeners
     */
    emitAndClear(payload: T): void {
      emit(payload, true);
    },
  };
}

/**
 * Type representing an emitter instance.
 *
 * This is the return type of the `emitter()` function.
 * It provides type-safe access to the emitter's methods.
 */
export type Emitter<T = void> = ReturnType<typeof emitter<T>>;
