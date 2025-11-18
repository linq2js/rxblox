import { getDispatcher, withDispatchers, getContextType } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";
import { emitter } from "./emitter";
import { shallowEquals } from "./utils/shallowEquals";
import { objectKeyedCollection } from "./utils/objectKeyedCollection";

/**
 * Options for configuring pool instance behavior.
 */
export type PoolOptions<K> = {
  /**
   * Custom equality function for key comparison.
   * @default shallowEquals
   */
  equals?: (a: K, b: K) => boolean;

  /**
   * Disposal strategy for pooled instances.
   *
   * - `"auto"`: Enable automatic reference counting and GC when refs reach 0
   * - `"never"`: Keep instance forever (never garbage collect)
   *
   * @default "never" (instances are permanent by default)
   */
  dispose?: "auto" | "never";
};

/**
 * Internal entry structure with cleanup functions and metadata.
 */
type InternalEntry<R extends object> = {
  result: R;
  proxy: R; // Cached proxy to return same reference
  refs: number;
  cleanup: VoidFunction;
  deleted: boolean;
};

/**
 * A pool factory function that returns pooled instances for equal keys,
 * with a `.once()` method for one-off, manually disposable instances.
 */
export type PoolFunction<K, R extends object> = {
  /**
   * Get a pooled instance for the given key.
   * Instances are cached and reused based on key equality.
   */
  (...args: void extends K ? [] : [key: K]): R;

  /**
   * Create a one-off instance that is not pooled.
   * Returns a tuple of [instance, dispose function].
   *
   * The instance will not be cached or shared, and must be
   * manually disposed by calling the dispose function.
   *
   * @param key - The key to pass to the factory function
   * @returns A tuple of [instance, dispose function]
   *
   * @example
   * ```ts
   * const createConnection = pool((url: string) => {
   *   const ws = new WebSocket(url);
   *   return { ws };
   * });
   *
   * // One-off connection, not pooled
   * const [conn, dispose] = createConnection.once("wss://temp");
   * await doSomething(conn);
   * dispose(); // Manual cleanup
   * ```
   */
  once(...args: void extends K ? [] : [key: K]): [R, () => void];
};

/**
 * Creates a pool for reactive logic instances.
 *
 * Instances are automatically pooled based on key equality - multiple
 * calls with the same key return the same cached instance. Includes automatic
 * reference counting and cleanup when instances are no longer in use.
 *
 * For one-off instances that should not be pooled, use the `.once()` method.
 *
 * ## Disposal Strategy
 *
 * **By default (`dispose` not specified):**
 * - Instances are permanent and never garbage collected
 * - This is the safest default - no surprise cleanups
 * - Pooled instances persist until manually cleared or app closes
 *
 * **With `dispose: "auto"`:**
 * - Automatic reference counting is enabled
 * - In **blox/effect scope**: Instances are garbage collected when all
 *   components/effects stop using them (refs reach 0)
 * - In **global scope**: Instance created with refs=0, GC'd when all refs are released
 *
 * **With `dispose: "never"`:**
 * - Explicitly keep instances forever (same as default, but explicit)
 * - Useful when you want to be clear about the intention
 *
 * @param fn - Factory function to create instances (must be synchronous, must return object)
 * @param options - Configuration options
 * @returns A pool factory function with `.once()` method
 *
 * @example Basic usage - pooled across components
 * ```ts
 * const createUserLogic = pool((userId: number) => {
 *   const name = signal(`User ${userId}`)
 *   const email = signal(`user${userId}@email.com`)
 *
 *   effect(() => {
 *     console.log('User name:', name())
 *   })
 *
 *   return { name, email }
 * })
 *
 * // Multiple components share same pooled instance
 * const Component1 = blox(() => {
 *   const user = createUserLogic(1) // First component
 *   return <div>{user.name()}</div>
 * })
 *
 * const Component2 = blox(() => {
 *   const user = createUserLogic(1) // Same pooled instance!
 *   return <div>{user.email()}</div>
 * })
 * ```
 *
 * @example Global scope (never GC by default)
 * ```ts
 * const createConfig = pool(() => {
 *   return { apiUrl: signal('https://api.example.com') }
 * })
 *
 * // Created in global scope = permanent instance (never GC)
 * const globalConfig = createConfig()
 * ```
 *
 * @example Force permanent instance (never dispose)
 * ```ts
 * const createPermanent = pool((id: number) => {
 *   return { value: signal(id) }
 * }, { dispose: "never" })
 *
 * const Component = blox(() => {
 *   const logic = createPermanent(1)
 *   return <div>{logic.value()}</div>
 * })
 *
 * // Instance persists even after all components unmount
 * const { unmount } = render(<Component />)
 * unmount() // Instance is NOT garbage collected
 * ```
 *
 * @example Force auto-disposal in global scope
 * ```ts
 * const createAutoDispose = pool((id: number) => {
 *   return { value: signal(id) }
 * }, { dispose: "auto" })
 *
 * // Even in global scope, you can force ref counting
 * const logic = createAutoDispose(1) // refs = 0, but no cleanup yet
 *
 * // Use in component to start tracking
 * const Component = blox(() => {
 *   const logic = createAutoDispose(1) // refs++
 *   return <div>{logic.value()}</div>
 * })
 * ```
 *
 * @example WebSocket connection (auto-cleanup)
 * ```ts
 * const createConnection = pool((url: string) => {
 *   const ws = new WebSocket(url)
 *   const messages = signal<string[]>([])
 *
 *   ws.onmessage = (e) => messages.set(prev => [...prev, e.data])
 *
 *   getDispatcher(disposableToken)?.on(() => ws.close())
 *
 *   return { ws, messages }
 * })
 *
 * // When used in blox components, automatically cleans up
 * // when all components unmount
 * ```
 *
 * @example One-off instance with .once()
 * ```ts
 * const createTask = pool((taskId: number) => {
 *   const status = signal<'pending' | 'running' | 'done'>('pending')
 *   const result = signal<any>(null)
 *
 *   return { status, result, run: async () => { ... } }
 * })
 *
 * // Pooled instance (shared, auto-managed)
 * const task1 = createTask(1)
 *
 * // One-off instance (not pooled, manual dispose)
 * const [task2, dispose] = createTask.once(2)
 * await task2.run()
 * dispose() // Manual cleanup
 * ```
 *
 * @example Accessing deleted entry throws error
 * ```ts
 * const createLogic = pool((id: number) => {
 *   return { value: signal(0) }
 * })
 *
 * const Component = blox(() => {
 *   const logic = createLogic(1)
 *   return <div>{logic.value()}</div>
 * })
 *
 * const { unmount } = render(<Component />)
 * unmount() // Auto GC deletes instance
 *
 * const logic = createLogic(1) // New instance
 * // Old reference throws if accessed:
 * // oldLogic.value() // Error: Cannot access deleted pooled instance
 * ```
 */
export function pool<K = void, R extends object = {}>(
  fn: (key: K) => R,
  options: PoolOptions<K> = {}
): R extends PromiseLike<any> ? never : PoolFunction<K, R> {
  // Validate fn is not async
  if (fn.constructor.name === "AsyncFunction") {
    throw new Error(
      "pool() function must be synchronous. " +
        "For async logic, use signal.async() or action() inside the function.\n\n" +
        "❌ Don't do this:\n" +
        "  pool(async (id) => {\n" +
        "    const data = await fetch(...)\n" +
        "    return data\n" +
        "  })\n\n" +
        "✅ Instead, use signal.async():\n" +
        "  pool((id) => {\n" +
        "    const data = signal.async(() => fetch(...))\n" +
        "    return { data }\n" +
        "  })"
    );
  }

  const { equals = shallowEquals, dispose } = options;

  const cache = objectKeyedCollection<K, InternalEntry<R>>(equals);

  // Schedule GC for entry when refs reach 0
  const scheduleGC = (key: K, entry: InternalEntry<R>) => {
    if (entry.refs > 0) return;

    // Immediate GC
    if (cache.delete(key)) {
      entry.deleted = true;
      entry.cleanup();
    }
  };

  // Helper to create proxy that checks if entry is deleted
  const createProxy = (entry: InternalEntry<R>): R => {
    return new Proxy(entry.result, {
      get(target, prop, receiver) {
        if (entry.deleted) {
          throw new Error(
            `Cannot access deleted pooled instance. ` +
              `The instance was garbage collected when all components stopped using it.\n\n` +
              `This usually happens when:\n` +
              `1. You stored a reference to the instance\n` +
              `2. All components using it unmounted (triggering GC)\n` +
              `3. You tried to access the stored reference\n\n` +
              `Solution: Always call the factory function to get the current instance:\n` +
              `  const logic = createLogic(key) // Always get fresh reference`
          );
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        if (entry.deleted) {
          throw new Error(
            `Cannot modify deleted pooled instance. ` +
              `The instance was garbage collected when all components stopped using it.`
          );
        }
        return Reflect.set(target, prop, value, receiver);
      },
    });
  };

  const poolFn = (key: K): R => {
    // Find existing entry with equal key
    const existingEntry = cache.get(key); // Automatically moves to end (LRU)

    if (existingEntry) {
      // Cache hit

      // Determine if we should track refs for this entry
      const shouldAutoDispose = existingEntry.refs !== -1; // -1 means permanent (never dispose)

      if (shouldAutoDispose) {
        const contextType = getContextType();
        const isDisposableContext =
          contextType === "blox" || contextType === "effect";

        if (isDisposableContext) {
          existingEntry.refs++;

          // Register decrement on cleanup
          const outerDisposableApi = getDispatcher(disposableToken);
          outerDisposableApi?.on(() => {
            existingEntry.refs--;
            if (existingEntry.refs === 0) {
              scheduleGC(key, existingEntry);
            }
          });
        }
      }

      return existingEntry.proxy; // Return cached proxy
    }

    // Cache miss - create with disposable context

    // Determine disposal strategy and initial refs BEFORE creating result
    const contextType = getContextType();
    const isDisposableContext =
      contextType === "blox" || contextType === "effect";

    let shouldAutoDispose = false;
    let initialRefs = 0;

    if (dispose === "auto") {
      // Explicit "auto" - enable ref counting and auto-disposal
      shouldAutoDispose = true;
      initialRefs = isDisposableContext ? 1 : 0;
    } else {
      // Default or explicit "never" - permanent instance
      shouldAutoDispose = false;
      initialRefs = -1; // Never GC
    }

    // Create placeholder entry (will update result later)
    const entry: InternalEntry<R> = {
      result: undefined as any, // Temporary
      proxy: undefined as any, // Temporary
      refs: initialRefs,
      cleanup: () => {},
      deleted: false,
    };

    // Register decrement on cleanup BEFORE creating result
    // (so we capture the outer disposable context)
    if (shouldAutoDispose && isDisposableContext) {
      const outerDisposableApi = getDispatcher(disposableToken);
      outerDisposableApi?.on(() => {
        entry.refs--;
        if (entry.refs === 0) {
          scheduleGC(key, entry);
        }
      });
    }

    // Now create result with its own disposable context
    const cleanup = emitter();
    const result = withDispatchers([disposableToken(cleanup)], () => fn(key));

    // Update entry with result and cleanup
    entry.result = result;
    entry.cleanup = () => cleanup.emitAndClear();

    // Create and cache proxy
    entry.proxy = createProxy(entry);

    // Store entry in cache
    cache.set(key, entry);

    return entry.proxy;
  };

  // Implement .once() method for one-off, non-pooled instances
  poolFn.once = (key: K): [R, () => void] => {
    // Create instance without caching
    const cleanup = emitter();
    const result = disposableToken.with(cleanup, () => fn(key));

    return [result, () => cleanup.emitAndClear()];
  };

  return poolFn as any;
}
