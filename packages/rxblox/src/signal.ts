import { produce } from "immer";
import type {
  Listener,
  MutableSignal,
  PersistInfo,
  Persistor,
  PersistStatus,
  Signal,
  TrackFunction,
} from "./types";
import { trackingDispatcher, trackingToken } from "./trackingDispatcher";
import { emitter } from "./emitter";
import { getDispatcher, withDispatchers } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";
import { isPromiseLike } from "./isPromiseLike";

/**
 * Context provided to computed signal functions.
 *
 * This context enables explicit dependency tracking via the `track()` function,
 * which creates a lazy tracking proxy that only subscribes to signals when
 * their properties are accessed.
 *
 * @example
 * ```ts
 * const result = signal(({ track }) => {
 *   const tracked = track({ condition, a, b });
 *   // Only 'condition' + one of 'a' or 'b' will be tracked
 *   return tracked.condition ? tracked.a : tracked.b;
 * });
 * ```
 */
export type ComputedSignalContext = {
  /**
   * Creates a lazy tracking proxy for explicit dependency management.
   *
   * The proxy enables fine-grained, conditional dependency tracking by only
   * subscribing to signals when their properties are accessed. This is useful
   * for conditional logic where you don't want to track all signals.
   *
   * @param signals - Record mapping property names to functions (signals or computed)
   * @returns A proxy that tracks dependencies lazily when properties are accessed
   *
   * @example
   * ```ts
   * const result = signal(({ track }) => {
   *   const tracked = track({
   *     condition,
   *     value1: a,
   *     value2: b,
   *     computed: () => c() * 2,
   *   });
   *
   *   // Only tracks 'condition' + one of the values
   *   return tracked.condition ? tracked.value1 : tracked.value2;
   * });
   * ```
   */
  track: TrackFunction;
};

/**
 * Options for configuring a signal's behavior.
 */
export type SignalOptions<T = any> = {
  /**
   * Custom equality function to determine if the signal value has changed.
   * Defaults to Object.is for reference equality.
   */
  equals?: (a: NoInfer<T>, b: NoInfer<T>) => boolean;

  /**
   * Optional persistor for storing signal value.
   *
   * When provided, the signal will:
   * - Load the persisted value on initialization
   * - Save changes automatically
   * - Track persistence status in `persistInfo`
   *
   * @example
   * ```ts
   * // Create your own persistor
   * function createLocalStoragePersistor<T>(key: string, debounceMs = 0): Persistor<T> {
   *   const setDebounced = debounceMs > 0
   *     ? debounce((val: T) => localStorage.setItem(key, JSON.stringify(val)), debounceMs)
   *     : (val: T) => localStorage.setItem(key, JSON.stringify(val));
   *
   *   return {
   *     get() {
   *       const item = localStorage.getItem(key);
   *       return item ? { value: JSON.parse(item) } : null;
   *     },
   *     set(value) {
   *       setDebounced(value);
   *     },
   *     on(callback) {
   *       const handler = (e: StorageEvent) => {
   *         if (e.key === key) callback();
   *       };
   *       window.addEventListener('storage', handler);
   *       return () => window.removeEventListener('storage', handler);
   *     }
   *   };
   * }
   *
   * const count = signal(0, {
   *   persist: createLocalStoragePersistor('count', 300)
   * });
   *
   * // Check persistence status
   * count.persistInfo.status; // "idle" | "reading" | "synced" | "read-failed" | "write-failed"
   * count.persistInfo.error;  // Error if failed
   * ```
   */
  persist?: Persistor<T>;
};

/**
 * Creates a reactive signal that holds a value and notifies listeners when it changes.
 *
 * A signal can be:
 * - Read by calling it as a function: `const val = mySignal()`
 * - Peeked (read without tracking): `const val = mySignal.peek()`
 * - Set with a new value: `mySignal.set(newValue)`
 * - Set with an updater function: `mySignal.set(prev => prev + 1)`
 * - Listened to for changes: `mySignal.on(newValue => console.log(newValue))`
 *
 * Signals can be created with:
 * - A static value: `signal(42)`
 * - A computed value (function): `signal(() => otherSignal() * 2)`
 * - A computed value with explicit tracking: `signal(({ track }) => { ... })`
 *
 * **Dependency Tracking for Computed Signals:**
 *
 * Computed signals support two ways to track dependencies:
 * 1. **Implicit tracking** - Call signals directly (e.g., `otherSignal()`)
 * 2. **Explicit tracking** - Use `track()` proxy for lazy/conditional tracking
 *
 * The `track()` function creates a proxy that only tracks signals you actually access,
 * making it perfect for conditional dependencies.
 *
 * @param value - The initial value or a function that computes the value
 * @param options - Configuration options for the signal
 * @returns A mutable signal that can be read, set, and subscribed to
 *
 * @example
 * ```ts
 * // Simple signal with a value
 * const count = signal(0);
 * count.set(1); // Updates to 1
 *
 * // Computed signal with implicit tracking
 * const doubled = signal(() => count() * 2);
 * count.set(2); // doubled() automatically becomes 4
 *
 * // Computed signal with explicit tracking
 * const result = signal(({ track }) => {
 *   const { condition, a, b } = track({ condition, a, b });
 *   return condition ? a : b; // Only tracks condition + one of a/b
 * });
 *
 * // With custom equality
 * const obj = signal({ id: 1 }, {
 *   equals: (a, b) => a.id === b.id
 * });
 * ```
 */
export function signal<T>(
  value: T | ((context: ComputedSignalContext) => T),
  options: SignalOptions<NoInfer<T>> = {}
): MutableSignal<T> & { persistInfo: PersistInfo } {
  // Cache for the current computed value (for computed signals)
  let current: { value: T } | undefined;
  const onCleanup = emitter<void>();
  const { equals = Object.is, persist } = options;

  // Persistence state
  let persistInfo: PersistInfo = {
    status: persist ? "idle" : "idle",
    error: undefined,
  };
  let isDirty = false; // Track if value was modified before hydration completes

  /**
   * Computes the signal's value. For computed signals, this:
   * 1. Unsubscribes from previous dependencies
   * 2. Creates a new signal dispatcher to track current dependencies
   * 3. Executes the computation function
   * 4. Subscribes to all signals accessed during computation
   * 5. Caches the result
   */
  const compute = () => {
    // Clean up previous subscriptions
    onCleanup.emit();
    onCleanup.clear();

    if (typeof value === "function") {
      // This is a computed signal - track dependencies
      const dispatcher = trackingDispatcher(recompute, onCleanup);
      const context: ComputedSignalContext = {
        track: dispatcher.track,
      };
      // Execute the computation function and track which signals it accesses
      // The dispatcher tracks implicit accesses (signal calls)
      // The track() proxy tracks explicit accesses (proxy property access)
      current = {
        value: withDispatchers([trackingToken(dispatcher)], () =>
          (value as (context: ComputedSignalContext) => T)(context)
        ),
      };
    } else {
      // Static value - just cache it
      current = { value };
    }
    return current.value;
  };

  const recompute = () => {
    const prev = current;
    const nextValue = compute();
    if (!prev || !equals(prev.value, nextValue)) {
      current = { value: nextValue };
      onChange.emit(nextValue);
    }
  };

  /**
   * Persists the current value to storage.
   * Note: This will be enhanced with reactive status updates if persist option is provided.
   */
  let persistValue = (_val: T) => {
    // Will be replaced if persist option is provided
  };

  /**
   * Gets the current signal value. If accessed within a computed signal context,
   * registers this signal as a dependency.
   */
  const get = () => {
    try {
      // Compute if not already cached
      if (!current) {
        return compute();
      }
      return current.value;
    } finally {
      // If we're inside a computed signal, register this signal as a dependency
      getDispatcher(trackingToken)?.add(s);
    }
  };

  const onChange = emitter<T>();

  // Create the signal object by assigning methods to the get function
  let s: MutableSignal<T> & { persistInfo: PersistInfo } = Object.assign(get, {
    readonly: undefined as unknown as Signal<T>,
    persistInfo,
    get: () => get(),
    /**
     * Sets the signal to a new value or updates it using a function.
     * Uses immer's produce for immutable updates when a function is provided.
     * Only notifies listeners if the value actually changed (according to equals).
     *
     * @param value - The new value or a function that receives the previous value
     */
    set(value: T | ((prev: T) => T | void)): void {
      const prevValue = get();
      // If value is a function, use produce to create an immutable update
      const nextValue =
        typeof value === "function"
          ? (produce(prevValue, value as (draft: T) => T | void) as T)
          : (value as T);

      // Only update and notify if the value actually changed
      if (!equals(prevValue, nextValue)) {
        current = { value: nextValue };
        isDirty = true; // Mark as dirty
        // Notify all listeners (use slice() to avoid issues if listeners modify the array)
        onChange.emit(nextValue);
        // Persist the new value
        persistValue(nextValue);
      }
    },
    /**
     * Reads the signal value without tracking it as a dependency.
     * Useful when you want to read a signal inside a computed signal
     * without creating a dependency on it.
     *
     * @returns The current signal value
     */
    peek() {
      if (!current) {
        return compute();
      }
      return current.value;
    },
    /**
     * Subscribes to changes in the signal value.
     * The listener will be called whenever the signal value changes.
     *
     * @param listener - Function to call when the signal value changes
     * @returns An unsubscribe function to remove the listener
     */
    on(listener: Listener<T>): VoidFunction {
      return onChange.on(listener);
    },

    reset() {
      current = undefined;
      recompute();
    },
  });

  Object.assign(s, { readonly: s });

  getDispatcher(disposableToken)?.on(() => {
    onCleanup.emitAndClear();
  });

  // Initialize persistence (hydration)
  if (persist) {
    /**
     * Emitter for persistInfo changes.
     *
     * This emitter notifies reactive contexts (effects, computed signals, rx expressions)
     * when the persistence status changes. It acts as a subscribable that integrates
     * with the tracking dispatcher.
     */
    const onPersistInfoChange = emitter<void>();

    /**
     * Updates persist info and notifies reactive subscribers.
     *
     * Only emits a change notification if the status or error actually changed,
     * preventing unnecessary reactive updates.
     *
     * @param status - The new persistence status
     * @param error - Optional error if status is a failure state
     * @param promise - The promise for async operations (undefined to clear)
     * @param keepPromise - If true, preserves current promise when promise param is undefined
     */
    const setPersistInfo = (
      status: PersistStatus,
      error?: unknown,
      promise?: Promise<unknown>,
      keepPromise = false
    ) => {
      // Preserve current promise only if explicitly requested
      const newPromise =
        keepPromise && promise === undefined ? persistInfo.promise : promise;

      if (
        status === persistInfo.status &&
        error === persistInfo.error &&
        newPromise === persistInfo.promise
      ) {
        return;
      }
      persistInfo = { status, error, promise: newPromise };
      onPersistInfoChange.emit();
    };

    /**
     * Persists the current value to storage with reactive status tracking.
     *
     * Updates persistInfo.status through the lifecycle:
     * - "writing": While persist.set() is in progress
     * - "synced": After successful write
     * - "write-failed": If persist.set() throws
     *
     * **Race Condition Handling:**
     * Tracks the current promise to handle concurrent writes correctly.
     * If a new write starts before the previous one completes, only the
     * latest write's result will update the status.
     *
     * All status changes trigger reactive updates via setPersistInfo().
     */
    persistValue = (val: T) => {
      try {
        const result = persist.set(val);
        if (isPromiseLike(result)) {
          setPersistInfo("writing", undefined, result);
          result.then(
            () => {
              // Only update status if this promise is still current
              if (persistInfo.promise === result) {
                setPersistInfo("synced", undefined, undefined, true);
              }
            },
            (error) => {
              // Only update status if this promise is still current
              if (persistInfo.promise === result) {
                setPersistInfo("write-failed", error, undefined, true);
              }
            }
          );
        } else {
          // Synchronous write - clear promise
          setPersistInfo("synced", undefined, undefined);
        }
      } catch (error) {
        // Synchronous error - clear promise
        setPersistInfo("write-failed", error, undefined);
      }
    };

    const applyHydratedValue = (result: { value: T } | null | undefined) => {
      // Only apply hydrated value if not dirty
      if (result && !isDirty) {
        const hydratedValue = result.value;

        // Ensure current is computed
        const currentValue = current ? current.value : compute();

        // Only update if value actually changed
        if (!equals(currentValue, hydratedValue)) {
          current = { value: hydratedValue };
          onChange.emit(hydratedValue);
        }
      }

      // Preserve promise when setting synced status
      setPersistInfo("synced", undefined, undefined, true);
    };

    /**
     * Hydrates the signal from persistent storage.
     *
     * **Race Condition Handling:**
     * Tracks the current promise to handle scenarios where hydration
     * is triggered multiple times (e.g., from external storage events).
     * Only the latest hydration's result will update the status.
     */
    const hydrate = () => {
      try {
        const result = persist.get();

        // Handle sync vs async
        if (isPromiseLike(result)) {
          setPersistInfo("reading", undefined, result);
          // Async: handle in microtask
          result.then(
            (resolved) => {
              // Only apply if this promise is still current
              if (persistInfo.promise === result) {
                applyHydratedValue(resolved);
              }
            },
            (error) => {
              // Only update status if this promise is still current
              if (persistInfo.promise === result) {
                setPersistInfo("read-failed", error, undefined, true);
              }
            }
          );
        } else {
          // Sync: apply immediately (no flicker!), clear promise
          applyHydratedValue(result);
        }
      } catch (error) {
        // Sync error - clear promise
        setPersistInfo("read-failed", error, undefined);
      }
    };

    let unsubscribe: VoidFunction | undefined;

    const cleanupPersist = () => {
      unsubscribe?.();
    };

    // Start hydration
    hydrate();

    // Subscribe to external changes (e.g., from other tabs)
    if (persist.on) {
      unsubscribe = persist.on(() => {
        hydrate();
      });
    }

    getDispatcher(disposableToken)?.on(cleanupPersist);

    /**
     * Define persistInfo as a reactive getter property.
     *
     * This getter enables automatic reactivity for persistence status tracking:
     *
     * **How it works:**
     * 1. When accessed in a reactive context (rx, effect, computed signal),
     *    the tracking dispatcher is automatically captured via getDispatcher()
     * 2. The getter registers onPersistInfoChange as a subscribable dependency
     * 3. When persistInfo changes (via setPersistInfo), onPersistInfoChange emits
     * 4. All reactive contexts that accessed persistInfo automatically re-run
     *
     * **Key benefits:**
     * - Natural API: `count.persistInfo.status` (no function call needed)
     * - Automatic tracking: Works seamlessly with rx(), effect(), etc.
     * - Transparent reactivity: Behaves like a plain object but is reactive
     * - No signal exposure: persistInfo isn't meant to be passed around independently
     *
     * **Example usage:**
     * ```ts
     * const count = signal(0, { persist: persistor });
     *
     * // Automatically reactive - UI updates when status changes
     * rx(() => {
     *   if (count.persistInfo.status === "writing") {
     *     return <Spinner />;
     *   }
     *   return <div>{count()}</div>;
     * });
     *
     * // Works in effects too
     * effect(() => {
     *   console.log("Status:", count.persistInfo.status);
     *   // Re-runs whenever status changes
     * });
     * ```
     *
     * @see setPersistInfo - The function that triggers updates
     * @see onPersistInfoChange - The emitter that notifies subscribers
     */
    Object.defineProperties(s, {
      persistInfo: {
        get() {
          // Register persistInfo as a tracked dependency in reactive contexts
          getDispatcher(trackingToken)?.add(onPersistInfoChange);

          return persistInfo;
        },
        enumerable: true,
        configurable: false,
      },
    });
  }

  return s;
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
  return typeof value === "function" && "peek" in value && "on" in value;
}

/**
 * Type guard to check if a value is a mutable signal.
 *
 * Checks for the presence of mutation methods (`set`, `reset`) in addition
 * to signal methods. Use this when you need to distinguish between read-only
 * and mutable signals.
 *
 * @param value - Value to check
 * @returns True if the value is a mutable signal
 *
 * @example
 * ```ts
 * const count = signal(0);
 * const readonly = count.readonly;
 *
 * if (isMutableSignal(count)) {
 *   count.set(42); // Safe to mutate
 * }
 *
 * if (isMutableSignal(readonly)) {
 *   // This block won't execute - readonly doesn't have set/reset
 * }
 * ```
 */
export function isMutableSignal<T>(value: any): value is MutableSignal<T> {
  return isSignal(value) && "set" in value && "reset" in value;
}
