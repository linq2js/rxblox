import { getDispatcher, getContextType } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";
import { addEffect } from "./effectDispatcher";
import { emitter } from "./emitter";
import { trackingDispatcher, trackingToken } from "./trackingDispatcher";
import { Effect, TrackFunction } from "./types";

export type EffectContext = {
  track: TrackFunction;
  readonly abortSignal: AbortSignal;
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
  // Prevent effect creation inside rx() blocks - this would create subscription leaks
  if (getContextType() === "rx") {
    throw new Error(
      "Cannot create effects inside rx() blocks. " +
        "Effects created in rx() would be recreated on every re-render, causing subscription leaks.\n\n" +
        "❌ Don't do this:\n" +
        "  rx(() => {\n" +
        "    effect(() => console.log('leak'));  // Created on every re-render!\n" +
        "    return <div>Content</div>;\n" +
        "  })\n\n" +
        "✅ Instead, create effects in stable scope:\n" +
        "  const MyComponent = blox(() => {\n" +
        "    effect(() => console.log('once'));  // Created once\n" +
        "    return <div>{rx(() => <span>Content</span>)}</div>;\n" +
        "  });\n\n" +
        "See: https://github.com/linq2js/rxblox#best-practices"
    );
  }

  // Emitter for managing cleanup functions (effect cleanup and signal unsubscribe functions)
  // Uses void type since cleanup functions don't take parameters
  const onCleanup = emitter<void>();
  let abortController: AbortController | undefined;

  const getAbortSignal = () => {
    if (!abortController) {
      abortController = new AbortController();
    }
    return abortController.signal;
  };

  /**
   * Executes the effect function:
   * 1. Runs all registered cleanup functions (from previous execution and signal subscriptions)
   * 2. Clears all registered cleanup functions
   * 3. Creates a signal dispatcher to track dependencies
   * 4. Executes the effect function
   * 5. Registers any returned cleanup function with the emitter
   * 6. Subscribes to all signals accessed during execution and registers their unsubscribe functions
   */
  const reRun = () => {
    cleanup();

    // Track which signals are accessed during execution
    const dispatcher = trackingDispatcher(reRun, onCleanup);
    const result = trackingToken.with(dispatcher, () =>
      fn({
        track: dispatcher.track,
        get abortSignal() {
          return getAbortSignal();
        },
      })
    );
    // Register the effect's cleanup function if one was returned
    if (typeof result === "function") {
      onCleanup.on(result);
    }
  };

  const cleanup = () => {
    // Execute all cleanup functions (effect cleanup and signal unsubscribes from previous run)
    // Pass undefined since cleanup functions don't take parameters
    onCleanup.emitAndClear();
    abortController?.abort();
    abortController = undefined;
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
      const dispatcher = trackingDispatcher(reRun, onCleanup);
      const result = trackingToken.with(dispatcher, () =>
        fn({
          track: dispatcher.track,
          get abortSignal() {
            return getAbortSignal();
          },
        })
      );
      // Register the effect's cleanup function if one was returned
      if (typeof result === "function") {
        onCleanup.on(result);
      }
      return cleanup;
    },
  };

  // Register effect with dispatcher (default dispatcher runs it immediately)
  addEffect(effectImpl);

  getDispatcher(disposableToken)?.on(cleanup);

  // Return the effect object (for custom dispatchers that don't run immediately)
  return effectImpl;
}
