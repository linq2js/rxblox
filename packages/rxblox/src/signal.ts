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
import type { Tag } from "./tag";
import { trackingDispatcher, trackingToken } from "./trackingDispatcher";
import { emitter } from "./emitter";
import { getDispatcher, getContextType, withDispatchers } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";
import { isPromiseLike } from "./isPromiseLike";
import { batchToken } from "./batchDispatcher";
import { createProxy } from "./utils/proxy/createProxy";

/**
 * Global queue for coordinating post-batch recomputations.
 * This ensures that cascading updates (e.g., computed signals that depend on other computed signals)
 * only trigger once even when multiple dependencies change.
 */
let postBatchQueue: Set<() => void> | null = null;
let postBatchScheduled = false;

function schedulePostBatchFlush() {
  if (!postBatchScheduled) {
    postBatchScheduled = true;
    Promise.resolve().then(() => {
      postBatchScheduled = false;

      // Process all pending recomputations in waves
      // Each wave may trigger new recomputations (cascading updates)
      // Continue until no more recomputations are pending
      while (postBatchQueue && postBatchQueue.size > 0) {
        const queue = postBatchQueue;
        postBatchQueue = new Set();

        // Execute all recomputations in this wave
        queue.forEach((fn) => fn());
      }

      // Clear the queue
      postBatchQueue = null;
    });
  }
}

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

  readonly abortSignal: AbortSignal;
};

/**
 * Options for configuring a signal's behavior.
 */
export type SignalOptions<T = any> = {
  name?: string;
  /**
   * Custom equality function to determine if the signal value has changed.
   * Defaults to Object.is for reference equality.
   */
  equals?: (a: NoInfer<T>, b: NoInfer<T>) => boolean;

  /**
   * Optional tags for grouping signals together.
   * Tags allow batch operations on multiple signals.
   *
   * @example
   * ```ts
   * const formTag = tag<string>();
   * const name = signal("", { tags: [formTag] });
   * const email = signal("", { tags: [formTag] });
   *
   * // Reset all form fields
   * formTag.forEach(signal => signal.reset());
   * ```
   */
  tags?: readonly Tag<T>[];

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

export type SignalComputeFn<T> = (context: ComputedSignalContext) => T;

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
 * **⚠️ Important: Signals cannot hold Promise values.**
 * Use `signal.async()` for async operations or manage loading states with `loadable`.
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
 *
 * // ❌ Promises not allowed - use signal.async() instead
 * // const data = signal(fetch('/api')); // Throws error!
 * // const result = signal(async () => {...}); // Throws error!
 * ```
 */
export function signal<T>(
  value: T | SignalComputeFn<T>,
  options: SignalOptions<NoInfer<T>> = {}
): MutableSignal<T> {
  // Prevent signal creation inside rx() or batch() blocks
  const contextType = getContextType();
  if (contextType === "rx") {
    throw new Error(
      "Cannot create signals inside rx() blocks. " +
        "Signals created in rx() would be recreated on every re-render, causing memory leaks.\n\n" +
        "❌ Don't do this:\n" +
        "  rx(() => {\n" +
        "    const count = signal(0);  // Created on every re-render!\n" +
        "    return <div>{count()}</div>;\n" +
        "  })\n\n" +
        "✅ Instead, create signals in stable scope:\n" +
        "  const MyComponent = blox(() => {\n" +
        "    const count = signal(0);  // Created once\n" +
        "    return <div>{rx(() => <span>{count()}</span>)}</div>;\n" +
        "  });\n\n" +
        "See: https://github.com/linq2js/rxblox#best-practices"
    );
  }

  if (contextType === "batch") {
    throw new Error(
      "Cannot create signals inside batch() blocks. " +
        "batch() is for grouping signal updates, not creating new signals.\n\n" +
        "❌ Don't do this:\n" +
        "  batch(() => {\n" +
        "    const count = signal(0);  // Wrong scope!\n" +
        "    count.set(1);\n" +
        "  })\n\n" +
        "✅ Instead, create signals outside batch:\n" +
        "  const count = signal(0);  // Create outside\n" +
        "  batch(() => {\n" +
        "    count.set(1);  // Just update inside\n" +
        "    count.set(2);\n" +
        "  });\n\n" +
        "See: https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/context-and-scope.md"
    );
  }

  // Validate that initial value is not a Promise
  if (typeof value !== "function" && isPromiseLike(value)) {
    throw new Error(
      "Signals cannot hold Promise values directly. " +
        "Promises would cause reactivity issues and memory leaks.\n\n" +
        "❌ Don't do this:\n" +
        "  const data = signal(fetchData());  // Promise!\n" +
        "  const result = signal(async () => { ... });  // Returns Promise!\n\n" +
        "✅ Instead, use signal.async() for async values:\n" +
        "  const data = signal.async(async () => {\n" +
        "    const response = await fetch('/api/data');\n" +
        "    return response.json();\n" +
        "  });\n\n" +
        "✅ Or use loadable with wait():\n" +
        "  const data = signal(loadable('loading'));\n" +
        "  fetch('/api/data')\n" +
        "    .then(res => res.json())\n" +
        "    .then(result => data.set(loadable('success', result)))\n" +
        "    .catch(error => data.set(loadable('error', undefined, error)));\n\n" +
        "See: https://github.com/linq2js/rxblox#async-data"
    );
  }

  // Cache for the current computed value (for computed signals)
  let current: { value: T } | undefined;
  const onCleanup = emitter<void>();
  const { equals = Object.is, persist, tags } = options;
  let hydrate = () => {};

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
    // Clean up previous computation dependencies
    onCleanup.emitAndClear();

    let computedValue: T;

    if (typeof value === "function") {
      // This is a computed signal - track dependencies
      const tracking$ = trackingDispatcher(recompute, onCleanup);
      let abortController: AbortController | undefined;
      const context: ComputedSignalContext = {
        track: tracking$.track,
        get abortSignal() {
          if (!abortController) {
            abortController = new AbortController();
            onCleanup.on(() => {
              abortController?.abort();
              abortController = undefined;
            });
          }
          return abortController.signal;
        },
      };
      // Execute the computation function and track which signals it accesses
      // The dispatcher tracks implicit accesses (signal calls)
      // The track() proxy tracks explicit accesses (proxy property access)
      computedValue = withDispatchers(
        [
          trackingToken(tracking$),
          // Allow all reactive things created during the computation to be cleaned up
          disposableToken(onCleanup),
        ],
        () => (value as (context: ComputedSignalContext) => T)(context)
      );
    } else {
      // Static value - just cache it
      computedValue = value;
    }

    // Validate that the value is not a Promise
    if (isPromiseLike(computedValue)) {
      throw new Error(
        "Signals cannot hold Promise values directly. " +
          "Promises would cause reactivity issues and memory leaks.\n\n" +
          "❌ Don't do this:\n" +
          "  const data = signal(fetchData());  // Promise!\n" +
          "  const result = signal(async () => { ... });  // Returns Promise!\n\n" +
          "✅ Instead, use signal.async() for async values:\n" +
          "  const data = signal.async(async () => {\n" +
          "    const response = await fetch('/api/data');\n" +
          "    return response.json();\n" +
          "  });\n\n" +
          "✅ Or use loadable with wait():\n" +
          "  const data = signal(loadable('loading'));\n" +
          "  fetch('/api/data')\n" +
          "    .then(res => res.json())\n" +
          "    .then(result => data.set(loadable('success', result)))\n" +
          "    .catch(error => data.set(loadable('error', undefined, error)));\n\n" +
          "See: https://github.com/linq2js/rxblox#async-data"
      );
    }

    current = { value: computedValue };
    return computedValue;
  };

  // Track whether we have a pending recomputation scheduled
  let pendingRecompute = false;

  const performRecompute = () => {
    pendingRecompute = false;
    const prev = current;
    const nextValue = compute();
    if (!prev || !equals(prev.value, nextValue)) {
      current = { value: nextValue };
      onChange.emit(nextValue);
    }
  };

  const recompute = () => {
    // If we're inside a batch OR there's an active post-batch flush in progress,
    // defer the recomputation to ensure cascading updates are also batched
    const batch$ = getDispatcher(batchToken);
    if (batch$ || postBatchQueue) {
      // Only queue one recomputation per signal
      if (!pendingRecompute) {
        pendingRecompute = true;

        // Initialize the global queue if needed
        if (!postBatchQueue) {
          postBatchQueue = new Set();
          schedulePostBatchFlush();
        }

        // Add this signal's recomputation to the global queue
        // The queue will be flushed in waves until all cascading updates complete
        postBatchQueue.add(performRecompute);
      }
      return;
    }

    // Not in a batch and no flush in progress - perform the recomputation immediately
    performRecompute();
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

  /**
   * Sets the signal to a new value or updates it using a function.
   * Uses immer's produce for immutable updates when a function is provided.
   * Only notifies listeners if the value actually changed (according to equals).
   *
   * @param value - The new value or a function that receives the previous value
   */
  const set = (
    value: T | ((prev: T) => T | void),
    shouldPersist = true,
    shouldMarkDirty = true
  ): void => {
    const prevValue = get();
    // If value is a function, use produce to create an immutable update
    const nextValue =
      typeof value === "function"
        ? (produce(prevValue, value as (draft: T) => T | void) as T)
        : (value as T);

    // Validate that the new value is not a Promise
    if (isPromiseLike(nextValue)) {
      throw new Error(
        "Signals cannot hold Promise values directly. " +
          "Promises would cause reactivity issues and memory leaks.\n\n" +
          "❌ Don't do this:\n" +
          "  const data = signal(fetchData());  // Promise!\n" +
          "  const result = signal(async () => { ... });  // Returns Promise!\n\n" +
          "✅ Instead, use signal.async() for async values:\n" +
          "  const data = signal.async(async () => {\n" +
          "    const response = await fetch('/api/data');\n" +
          "    return response.json();\n" +
          "  });\n\n" +
          "✅ Or use loadable with wait():\n" +
          "  const data = signal(loadable('loading'));\n" +
          "  fetch('/api/data')\n" +
          "    .then(res => res.json())\n" +
          "    .then(result => data.set(loadable('success', result)))\n" +
          "    .catch(error => data.set(loadable('error', undefined, error)));\n\n" +
          "See: https://github.com/linq2js/rxblox#async-data"
      );
    }

    // Only update and notify if the value actually changed
    if (!equals(prevValue, nextValue)) {
      current = { value: nextValue };
      if (shouldMarkDirty) {
        isDirty = true; // Mark as dirty
      }
      const batchDispatcher = getDispatcher(batchToken);
      if (batchDispatcher) {
        batchDispatcher.enqueue(() => {
          onChange.emit(nextValue);
        }, s);
      } else {
        // Notify all listeners (use slice() to avoid issues if listeners modify the array)
        onChange.emit(nextValue);
      }

      // Persist the new value
      if (shouldPersist) {
        persistValue(nextValue);
      }
    }
  };

  const onChange = emitter<T>();

  // Create the signal object by assigning methods to the get function
  let s: MutableSignal<T> & { persistInfo: PersistInfo } = Object.assign(get, {
    readonly: undefined as unknown as Signal<T>,
    persistInfo,
    hydrate,
    proxy: undefined as any, // Will be properly defined via Object.defineProperty
    toJSON() {
      return s.peek();
    },
    get: () => get(),
    /**
     * Sets the signal to a new value or updates it using a function.
     * Uses immer's produce for immutable updates when a function is provided.
     * Only notifies listeners if the value actually changed (according to equals).
     *
     * @param value - The new value or a function that receives the previous value
     */
    set(value: T | ((prev: T) => T | void)): void {
      set(value, true);
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

  getDispatcher(disposableToken)?.on(() => {
    onCleanup.emitAndClear();
  });

  // Initialize persistence (hydration)
  if (persist && (persist.get || persist.set)) {
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
      if (!persist.set) return;

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
        set(hydratedValue, false, false);
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
    hydrate = () => {
      if (!persist.get) return;

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
      /**
       * Manually reload the signal value from persistent storage.
       *
       * This method:
       * 1. Clears the "dirty" flag (allows storage value to overwrite local changes)
       * 2. Triggers the persistor's `get()` method
       * 3. Updates the signal value if storage returns a value
       * 4. Updates persistInfo.status to reflect the operation state
       *
       * **Use Cases:**
       * - Retry after a read error
       * - Manually refresh data from storage
       * - Discard local changes and reload from storage
       * - Sync with external storage updates
       *
       * **Example:**
       * ```ts
       * const user = signal(null, { persist: userPersistor });
       *
       * // Retry after error
       * if (user.persistInfo.status === "read-failed") {
       *   user.hydrate(); // Retry loading from storage
       * }
       *
       * // Manual refresh
       * button.onClick(() => {
       *   user.hydrate(); // Refresh from storage
       * });
       *
       * // Discard local changes
       * user.set(localChanges);
       * user.hydrate(); // Reload from storage (local changes discarded)
       * ```
       *
       * @see persistInfo - For checking operation status
       * @see Persistor - The storage interface
       */
      hydrate: {
        value() {
          // Clear dirty flag to allow hydrated value to overwrite
          isDirty = false;
          // Call the internal hydrate function
          hydrate();
        },
        enumerable: true,
        configurable: false,
      },
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

  Object.assign(s, {
    readonly: s,
    displayName: options.name,
  });

  // Add .proxy property for stable, readonly access to object/function values
  // Cache the proxy for stable reference
  let cachedProxy: any = undefined;

  Object.defineProperty(s, "proxy", {
    get() {
      if (!cachedProxy) {
        // The proxy calls s() on every property access, making all reads reactive.
        // This ensures that any property access (e.g., `signal.proxy.count`)
        // will register the signal as a dependency in reactive contexts
        // (effects, computed signals, rx expressions).
        cachedProxy = createProxy({
          get: s.get,
          // No set option = readonly
        });
      }
      return cachedProxy;
    },
    enumerable: true,
    configurable: false,
  });

  // Register signal with tags
  if (tags && tags.length > 0) {
    tags.forEach((tag) => tag._add(s));

    // Remove from tags on disposal
    getDispatcher(disposableToken)?.on(() => {
      tags.forEach((tag) => tag._remove(s));
    });
  }

  return s as PromiseLike<any> extends T ? never : MutableSignal<T>;
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
