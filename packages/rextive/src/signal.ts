import { emitter } from "./utils/emitter";
import { guardDisposed } from "./utils/guardDisposed";
import {
  Signal,
  SignalContext,
  SignalMap,
  SignalOptions,
  ResolveValue,
} from "./types";
import { createSignalAccessProxy } from "./utils/createSignalAccessProxy";
import { produce } from "immer";
import {
  persistSignals as persistSignalsImpl,
  PersistSignalsOptions,
  PersistSignalsResult,
} from "./persistSignals";

export const SIGNAL_TYPE = Symbol("SIGNAL_TYPE");
export const DISPOSED_MESSAGE = "Signal is disposed";

export type SignalExports = {
  /**
   * create a signal with no initial value (undefined)
   * @param options - The options of the signal
   * @returns The signal with value type T | undefined
   */
  <TValue = unknown>(options?: SignalOptions<TValue | undefined>): Signal<
    TValue | undefined
  >;

  /**
   * create a signal with value or lazy value
   * @param value - The value of the signal
   * @param options - The options of the signal
   * @returns The signal
   */
  <TValue>(
    value: TValue | ((context: SignalContext) => TValue),
    options?: SignalOptions<TValue>
  ): Signal<TValue>;

  /**
   * create a signal with dependencies
   * @param dependencies - The dependencies of the signal
   * @param compute - The compute function of the signal
   * @param options - The options of the signal
   * @returns The signal
   */
  <TValue, TDependencies extends SignalMap>(
    dependencies: TDependencies,
    compute: (context: SignalContext<NoInfer<TDependencies>>) => TValue,
    options?: SignalOptions<TValue>
  ): Signal<TValue>;

  /**
   * Persist multiple signals with centralized load/save operations
   */
  persist: <TSignals extends SignalMap>(
    signals: TSignals,
    options?: PersistSignalsOptions<TSignals>
  ) => PersistSignalsResult<TSignals>;
};

export const signal: SignalExports = Object.assign(
  (...args: any[]) => {
    // overload: signal() - no arguments, creates Signal<undefined>
    if (args.length === 0) {
      return createSignal({}, () => undefined, undefined, { value: undefined });
    }
    // overload: signal(deps, fn, options?)
    if (typeof args[1] === "function") {
      return createSignal(args[0], args[1], args[2], undefined);
    }
    // overload: signal(value, options?)
    const isLazy = typeof args[0] === "function";
    return createSignal(
      {},
      isLazy ? args[0] : () => args[0],
      args[1],
      isLazy ? undefined : { value: args[0] }
    );
  },
  {
    persist: persistSignalsImpl,
  }
) as SignalExports;

export class FallbackError extends Error {
  readonly originalError: unknown;
  readonly fallbackError: unknown;
  readonly signalName?: string;

  constructor(error: unknown, fallbackError: unknown, signalName?: string) {
    super(
      `Signal computation failed with: ${error}\nFallback also failed with: ${fallbackError}`
    );
    this.name = "FallbackError";
    this.originalError = error;
    this.fallbackError = fallbackError;
    this.signalName = signalName;
  }
}

/**
 * Internal function to create a signal instance.
 *
 * Signals are lazy - they don't compute until first access.
 * Signals with dependencies automatically track and recompute when deps change.
 *
 * @param deps - Map of dependency signals
 * @param fn - Computation function that receives a context with deps proxy
 * @param options - Signal options (equals, name, fallback)
 * @param eager - If true, compute immediately instead of lazily
 * @returns Signal instance
 */
function createSignal(
  deps: SignalMap,
  fn: (context: SignalContext<SignalMap>) => any,
  options: SignalOptions<any> = {},
  initialValue: { value: any } | undefined
): Signal<any> {
  const { equals = Object.is, name, fallback } = options;

  // Emitter for notifying listeners when signal value changes
  const onChange = emitter<void>();

  // Emitter for cleanup tasks (unsubscribing from deps, aborting requests)
  const onCleanup = emitter<void>();

  // Current state: { value } for success, { error, value: undefined } for errors
  // undefined means not yet computed (lazy evaluation)
  let current: { value: any; error?: unknown } | undefined = initialValue;

  // Disposal flag - once disposed, signal becomes read-only (last known value)
  let disposed = false;

  // Computation context - recreated on each recompute
  // Contains: deps proxy, trackedDeps set, abortController, abortSignal
  let context:
    | (SignalContext<SignalMap> & {
        trackedDeps: Set<Signal<any>>; // Set of dep signals to avoid duplicate subscriptions
        abortController: AbortController;
      })
    | undefined;

  const isDisposed = () => disposed;

  /**
   * Dispose the signal and cleanup all resources.
   * After disposal, signal remains readable but won't recompute.
   */
  const dispose = () => {
    if (disposed) return;

    // Mark as disposed but keep current state for reading
    disposed = true;
    context = undefined;

    // Clear listeners and trigger cleanup (unsubscribes from deps)
    onChange.clear();
    onCleanup.emitAndClear();
  };

  /**
   * Recompute the signal value.
   *
   * This function:
   * 1. Cleans up previous computation (unsubscribes from old deps)
   * 2. Creates new computation context with fresh AbortController
   * 3. Executes computation function with dependency tracking
   * 4. Updates current state if value changed (using equals)
   * 5. Handles errors with optional fallback
   *
   * Note: Does NOT emit onChange - that's handled by onDepChange wrapper
   */
  const recompute = () => {
    if (disposed) return;

    // Cleanup previous computation:
    // - Calls all unsubscribe functions from tracked deps
    // - Aborts previous AbortController
    // - Clears trackedDeps set
    onCleanup.emitAndClear();

    try {
      // Create fresh abort controller for this computation
      const abortController = new AbortController();

      // Track which dependency signals we've subscribed to
      // Used to avoid duplicate subscriptions when same dep accessed multiple times
      const trackedDeps = new Set<any>();

      // Register cleanup for next recompute or disposal
      onCleanup.on(() => {
        trackedDeps.clear();
        abortController.abort();
      });

      // Create computation context
      context = {
        abortController,
        trackedDeps,
        // Proxy for dependency access with auto-tracking
        deps: createSignalAccessProxy<
          "value",
          SignalMap,
          ResolveValue<SignalMap, "value">
        >({
          type: "value",
          getSignals: () => deps,
          onSignalAccess: (depSignal) => {
            // Auto-subscribe to dependency if not already tracked
            if (!trackedDeps.has(depSignal)) {
              trackedDeps.add(depSignal); // Mark as tracked
              // Subscribe to dep changes and store unsubscribe function in onCleanup
              onCleanup.on(depSignal.on(onDepChange));
            }
          },
        }),
        abortSignal: abortController.signal,
      };

      // Execute computation function
      const value = fn(context);

      // Update current state only if value changed (using equals function)
      // This prevents unnecessary onChange emissions
      if (!current || !equals(current.value, value)) {
        current = { value };
      }
    } catch (error) {
      // Error handling with optional fallback
      if (fallback) {
        try {
          // Try to recover using fallback function
          const fallbackValue = fallback(error);
          current = { value: fallbackValue };
        } catch (fallbackError) {
          // Fallback also failed - store the fallback error
          current = { error: fallbackError, value: undefined };
        }
      } else {
        // No fallback - store the original error
        current = { error, value: undefined };
      }
    }
  };

  /**
   * Callback invoked when a dependency signal changes.
   *
   * This wrapper is crucial for performance:
   * - Captures reference to current state before recompute
   * - Only emits onChange if current state object actually changed
   * - Prevents unnecessary listener notifications when value is equal
   *
   * Example: if deps change but computed result is same (per equals),
   * recompute() won't update current object, so we don't emit.
   */
  const onDepChange = () => {
    const prev = current;
    recompute();
    // Only emit if current state object changed (reference equality)
    if (prev !== current) {
      onChange.emit();
    }
  };

  /**
   * Get current signal value.
   *
   * - Lazy: triggers computation on first access
   * - Throws if computation resulted in error
   * - After disposal: returns last known value or throws last error
   */
  const get = () => {
    // Lazy evaluation - compute on first access (but not if disposed)
    if (!current && !disposed) {
      recompute();
    }

    // Throw if computation failed
    if (current?.error) {
      throw current.error;
    }

    return current!.value;
  };

  const reset = () => {
    // Capture previous value before reset
    const prevValue = current?.value;

    // Reset to initial state
    current = initialValue;

    // Recompute
    recompute();

    // Emit if value actually changed
    if (!current || current.error || !equals(prevValue, current.value)) {
      onChange.emit();
    }
  };

  /**
   * Set signal value directly.
   *
   * - Supports value or updater function (via immer)
   * - Only updates and emits if value changed (using equals)
   * - Throws if signal is disposed
   */
  const set = guardDisposed(isDisposed, DISPOSED_MESSAGE, (value: any) => {
    // Ensure signal is initialized
    if (!current) {
      get();
    }

    // Handle updater function using immer for immutable updates
    const next = typeof value === "function" ? produce(get(), value) : value;

    // Only update and emit if value changed
    if (!equals(current!.value, next)) {
      current = { value: next };
      onChange.emit();
    }
  });

  /**
   * Wrapper for onChange.on that ensures lazy signals are computed
   * before subscribing. This allows derived signals to react to changes.
   */
  const on = (listener: VoidFunction) => {
    // If signal has dependencies and hasn't been computed yet, compute it now
    // This ensures we subscribe to dependencies before returning
    if (!current && Object.keys(deps).length > 0) {
      get();
    }
    return onChange.on(listener);
  };

  /**
   * Returns a setter function that captures the current state.
   * The returned function will only set the value if the state hasn't changed
   * since the setter was created (checked via reference equality).
   *
   * This enables optimistic updates that auto-cancel if signal changed:
   *
   * @example
   * ```ts
   * const optimisticSet = signal.setIfUnchanged();
   *
   * fetchData().then(data => {
   *   // Only sets if signal hasn't changed since optimisticSet was created
   *   if (!optimisticSet(data)) {
   *     console.log('Signal changed, update cancelled');
   *   }
   * });
   * ```
   */
  const setIfUnchanged = () => {
    // Capture current state at time of call
    const snapshot = current;

    // Return setter that checks snapshot
    return (value: any) => {
      // Cancel if current state changed (reference equality)
      if (snapshot !== current) return false;

      // Otherwise, perform normal set
      set(value);
      return true;
    };
  };

  // Create signal instance by combining getter function with methods
  const instance = Object.assign(get, {
    [SIGNAL_TYPE]: true, // Internal marker for isSignal() type guard
    displayName: name, // Debug name
    get, // Explicit getter (same as calling signal)
    on, // Subscribe to changes (with auto-computation)
    dispose, // Cleanup and mark as disposed
    set, // Direct value setter
    setIfUnchanged, // Optimistic setter factory
    reset, // Reset the signal to its initial value
  });

  return instance as unknown as Signal<any>;
}

/**
 * Type guard to check if a value is a signal.
 *
 * Checks for the presence of signal-specific methods (`peek`, `on`) to
 * determine if a value is a signal (either read-only or mutable).
 *
 * @param value - Value to check
 * @returns True if the value is a signal
 *
 * @example
 * ```ts
 * const count = signal(0);
 * const obj = { value: 42 };
 *
 * if (isSignal(count)) {
 *   console.log(count()); // Safe to call as signal
 * }
 *
 * if (isSignal(obj)) {
 *   // This block won't execute
 * }
 * ```
 */
export function isSignal<T>(value: any): value is Signal<T> {
  return typeof value === "function" && value[SIGNAL_TYPE] === true;
}
