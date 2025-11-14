import { withDispatchers } from "./dispatcher";
import { addEffect } from "./effectDispatcher";
import { emitter } from "./emitter";
import { signalDispatcher, signalToken } from "./signalDispatcher";
import { Effect, SignalTrackFunction } from "./types";

export type EffectContext = {
  track: SignalTrackFunction;
};

/**
 * Creates a reactive effect that tracks signals and re-runs when dependencies change.
 *
 * An effect:
 * - Automatically tracks signals accessed during execution
 * - Re-runs whenever any tracked signal changes
 * - Can return a cleanup function that runs before the next execution
 * - Is registered with the current effect dispatcher (default runs immediately)
 * - Returns a cleanup function from `run()` that stops the effect
 *
 * Effects are useful for:
 * - Side effects (logging, API calls, DOM manipulation)
 * - Synchronizing state between different parts of the application
 * - Cleanup operations (unsubscribing from external services)
 *
 * @param fn - Function to execute. Can return a cleanup function that will be
 *             called before the next execution or when the effect cleanup is called.
 * @returns An effect object with a `run()` method that returns a cleanup function
 *
 * @example
 * ```ts
 * const count = signal(0);
 *
 * // Effect that logs whenever count changes
 * const logEffect = effect(() => {
 *   console.log('Count is:', count());
 * });
 * // Effect runs immediately (default dispatcher)
 *
 * count.set(1); // Logs: "Count is: 1"
 *
 * // Stop the effect
 * const cleanup = logEffect.run(); // Re-runs the effect
 * cleanup(); // Stops tracking and cleans up
 *
 * // Effect with cleanup
 * const subscriptionEffect = effect(() => {
 *   const subscription = subscribeToService();
 *   return () => subscription.unsubscribe(); // Cleanup function
 * });
 * ```
 */
export function effect(
  fn: (context: EffectContext) => void | Promise<void> | VoidFunction
): Effect {
  // Emitter for managing cleanup functions (effect cleanup and signal unsubscribe functions)
  // Uses void type since cleanup functions don't take parameters
  const onCleanup = emitter<void>();

  /**
   * Executes the effect function:
   * 1. Runs all registered cleanup functions (from previous execution and signal subscriptions)
   * 2. Clears all registered cleanup functions
   * 3. Creates a signal dispatcher to track dependencies
   * 4. Executes the effect function
   * 5. Registers any returned cleanup function with the emitter
   * 6. Subscribes to all signals accessed during execution and registers their unsubscribe functions
   */
  const run = () => {
    // Execute all cleanup functions (effect cleanup and signal unsubscribes from previous run)
    // Pass undefined since cleanup functions don't take parameters
    onCleanup.emit(undefined);
    // Clear all registered cleanup functions to prepare for new subscriptions
    onCleanup.clear();

    // Track which signals are accessed during execution
    const dispatcher = signalDispatcher(run, onCleanup);
    const result = withDispatchers([signalToken(dispatcher)], () =>
      fn({ track: dispatcher.track })
    );
    // Register the effect's cleanup function if one was returned
    if (typeof result === "function") {
      onCleanup.add(result);
    }
  };

  const cleanup = () => {
    // Execute all cleanup functions (effect cleanup and signal unsubscribes from previous run)
    // Pass undefined since cleanup functions don't take parameters
    onCleanup.emit(undefined);
    // Clear all registered cleanup functions to prepare for new subscriptions
    onCleanup.clear();
  };

  /**
   * Runs the effect:
   * 1. Cleans up previous subscriptions and cleanup functions
   * 2. Tracks signals accessed during execution
   * 3. Executes the effect function
   * 4. Registers cleanup function if returned
   * 5. Subscribes to all accessed signals
   *
   * @returns A cleanup function that stops the effect and runs all cleanup functions
   */
  const effectImpl: Effect = {
    run() {
      cleanup();

      // Track which signals are accessed during execution
      const dispatcher = signalDispatcher(run, onCleanup);
      const result = withDispatchers([signalToken(dispatcher)], () =>
        fn({ track: dispatcher.track })
      );
      // Register the effect's cleanup function if one was returned
      if (typeof result === "function") {
        onCleanup.add(result);
      }
      return cleanup;
    },
  };

  // Register effect with dispatcher (default dispatcher runs it immediately)
  addEffect(effectImpl);

  // Return the effect object (for custom dispatchers that don't run immediately)
  return effectImpl;
}
