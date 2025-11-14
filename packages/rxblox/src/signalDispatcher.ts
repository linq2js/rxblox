import { SignalDispatcher, Signal, SignalTrackFunction } from "./types";
import { dispatcherToken } from "./dispatcher";
import { Emitter } from "./emitter";

/**
 * Dispatcher token for signal tracking.
 *
 * Use this to:
 * - Create entries: `signalToken(dispatcher)`
 * - Retrieve dispatcher: `getDispatcher(signalToken)`
 */
export const signalToken =
  dispatcherToken<SignalDispatcher>("signalDispatcher");

/**
 * Creates a new signal dispatcher for tracking signal dependencies.
 *
 * A signal dispatcher is used to collect all signals that are accessed
 * during the execution of a function (e.g., in computed signals or effects).
 * This enables automatic dependency tracking and reactive updates.
 *
 * The dispatcher:
 * - Maintains a Set of signals that were accessed
 * - Provides methods to add signals, get all signals, and clear the set
 * - Is used in conjunction with `withSignalDispatcher()` to track dependencies
 *
 * @param onUpdate - Optional callback invoked when tracked signals change
 * @param onCleanup - Optional emitter for cleanup functions
 * @returns A new signal dispatcher instance
 *
 * @example
 * ```ts
 * import { withDispatchers, signalToken } from "./dispatcher";
 * import { emitter } from "./emitter";
 *
 * // Create dispatcher with callbacks
 * const onUpdate = () => console.log("signal changed");
 * const onCleanup = emitter();
 * const dispatcher = signalDispatcher(onUpdate, onCleanup);
 *
 * // Track signals accessed during function execution
 * const result = withDispatchers([signalToken(dispatcher)], () => {
 *   const value1 = signal1(); // signal1 is added to dispatcher
 *   const value2 = signal2(); // signal2 is added to dispatcher
 *   return value1 + value2;
 * });
 *
 * // Get all signals that were accessed
 * const dependencies = dispatcher.signals; // [signal1, signal2]
 * ```
 */
export function signalDispatcher(
  onUpdate?: VoidFunction,
  onCleanup?: Emitter
): SignalDispatcher {
  /**
   * Adds a signal to the dispatcher's tracking set.
   *
   * Called automatically by signals when they are read within a
   * `withSignalDispatcher()` context.
   *
   * @param signal - The signal to track
   */
  const add = (signal: Signal<unknown>) => {
    if (signals.has(signal)) {
      return false;
    }
    signals.add(signal);
    if (onUpdate) {
      onCleanup?.add(signal.on(onUpdate));
    }
    return true;
  };

  const track: SignalTrackFunction = (signals) => {
    return new Proxy(signals, {
      get(_target, prop) {
        const signal = signals[prop as keyof typeof signals];
        const value = signal();
        add(signal);
        return value;
      },
    }) as any;
  };
  /**
   * Set of signals that have been accessed during tracking.
   * Using a Set ensures each signal is only tracked once, even if accessed multiple times.
   */
  const signals = new Set<Signal<unknown>>();

  return {
    track,
    add,
    /**
     * Gets all signals that have been tracked.
     *
     * Returns a readonly array copy of the signals set.
     * This prevents external modification while allowing iteration.
     *
     * @returns A readonly array of all tracked signals
     */
    get signals(): readonly Signal<unknown>[] {
      return Array.from(signals);
    },
    /**
     * Clears all tracked signals from the dispatcher.
     *
     * Used to reset the dispatcher before tracking a new set of dependencies.
     */
    clear() {
      signals.clear();
    },
  };
}
