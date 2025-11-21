import { Listener } from "./index";

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
   * Array of registered listeners that will be notified when events are emitted.
   * Using an array allows multiple listeners and maintains order.
   */
  const listeners: Listener<T>[] = [];

  return {
    /**
     * Adds a listener to the emitter.
     *
     * The listener will be called whenever `emit()` is called with a payload.
     * Returns an unsubscribe function that removes the listener.
     *
     * **Important**: The unsubscribe function is idempotent - calling it multiple
     * times is safe and won't cause errors.
     *
     * @param listener - Function to call when events are emitted
     * @returns An unsubscribe function that removes the listener
     */
    on(listener: Listener<T>): VoidFunction {
      /**
       * Flag to track if this listener is still active.
       * Prevents double-unsubscription if unsubscribe is called multiple times.
       */
      let active = true;
      listeners.push(listener);

      /**
       * Unsubscribe function that removes the listener from the emitter.
       * Safe to call multiple times - uses the `active` flag to prevent errors.
       */
      return () => {
        if (!active) {
          return;
        }
        active = false;
        // Find and remove the listener from the array
        listeners.splice(listeners.indexOf(listener), 1);
      };
    },
    /**
     * Emits an event to all registered listeners.
     *
     * **Important**: Uses `slice()` to create a copy of the listeners array
     * before iterating. This ensures that if a listener modifies the listeners
     * array (e.g., by unsubscribing) during emission, it won't affect the
     * current emission cycle.
     *
     * @param payload - The value to pass to all listeners
     */
    emit(payload: T): void {
      // Create a copy of listeners array to avoid issues if listeners modify the array during emission
      listeners.slice().forEach((listener) => listener(payload));
    },
    /**
     * Removes all registered listeners.
     *
     * After calling `clear()`, no listeners will be notified until new ones
     * are added via `add()`.
     */
    clear(): void {
      listeners.length = 0;
    },

    /**
     * Emits an event to all registered listeners and then clears all listeners.
     *
     * @param payload - The value to pass to all listeners
     */
    emitAndClear(payload: T): void {
      this.emit(payload);
      this.clear();
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
