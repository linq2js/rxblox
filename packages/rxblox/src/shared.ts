import { getDispatcher, withDispatchers, getContextType } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";
import { emitter } from "./emitter";
import { shallowEquals } from "./utils/shallowEquals";
import { objectKeyedCollection } from "./utils/objectKeyedCollection";

/**
 * Options for configuring shared instance behavior.
 */
export type SharedOptions<K> = {
  /**
   * Custom equality function for key comparison.
   * @default shallowEquals
   */
  equals?: (a: K, b: K) => boolean;

  /**
   * Disposal strategy for shared instances.
   *
   * - `"auto"`: Automatically dispose when reference count reaches zero
   * - `"never"`: Keep instance forever (never garbage collect)
   *
   * @default "auto" in blox/effect scope, "never" in global scope
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
 * A shared factory function that returns the same instance for equal keys.
 */
export type SharedFunction<K, R extends object> = (key: K) => R;

/**
 * Creates a factory for shared reactive logic instances.
 *
 * Instances are automatically shared based on key equality - multiple
 * calls with the same key return the same instance. Includes automatic
 * reference counting and cleanup when instances are no longer in use.
 *
 * ## Result Type Constraint
 *
 * The result **must extend `object`** (not primitives). This allows the
 * library to wrap results in a Proxy that throws errors if accessed after
 * the instance is garbage collected.
 *
 * ## Disposal Strategy
 *
 * By default, disposal behavior depends on where the instance is created:
 *
 * - **Global scope**: Instances are permanent (never GC)
 * - **Blox/Effect scope**: Automatic reference counting - instances are
 *   garbage collected when all components/effects stop using them
 *
 * You can override this default behavior with the `dispose` option:
 *
 * - `dispose: "auto"` - Always use reference counting and GC when refs reach 0
 * - `dispose: "never"` - Keep instance forever, even in blox/effect scope
 *
 * @param fn - Factory function to create instances (must be synchronous, must return object)
 * @param options - Configuration options
 * @returns A shared factory function
 *
 * @example Basic usage - shared across components
 * ```ts
 * const createUserLogic = shared((userId: number) => {
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
 * // Multiple components share same instance
 * const Component1 = blox(() => {
 *   const user = createUserLogic(1) // First component
 *   return <div>{user.name()}</div>
 * })
 *
 * const Component2 = blox(() => {
 *   const user = createUserLogic(1) // Same instance!
 *   return <div>{user.email()}</div>
 * })
 * ```
 *
 * @example Global scope (never GC by default)
 * ```ts
 * const createConfig = shared(() => {
 *   return { apiUrl: signal('https://api.example.com') }
 * })
 *
 * // Created in global scope = permanent instance (never GC)
 * const globalConfig = createConfig()
 * ```
 *
 * @example Force permanent instance (never dispose)
 * ```ts
 * const createPermanent = shared((id: number) => {
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
 * const createAutoDispose = shared((id: number) => {
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
 * const createConnection = shared((url: string) => {
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
 * @example Accessing deleted entry throws error
 * ```ts
 * const createLogic = shared((id: number) => {
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
 * // oldLogic.value() // Error: Cannot access deleted shared instance
 * ```
 */
export function shared<K, R extends object>(
  fn: (key: K) => R,
  options: SharedOptions<K> = {}
): SharedFunction<K, R> {
  // Validate fn is not async
  if (fn.constructor.name === "AsyncFunction") {
    throw new Error(
      "shared() function must be synchronous. " +
        "For async logic, use signal.async() or action() inside the function.\n\n" +
        "❌ Don't do this:\n" +
        "  shared(async (id) => {\n" +
        "    const data = await fetch(...)\n" +
        "    return data\n" +
        "  })\n\n" +
        "✅ Instead, use signal.async():\n" +
        "  shared((id) => {\n" +
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
            `Cannot access deleted shared instance. ` +
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
            `Cannot modify deleted shared instance. ` +
              `The instance was garbage collected when all components stopped using it.`
          );
        }
        return Reflect.set(target, prop, value, receiver);
      },
    });
  };

  const sharedFn = (key: K): R => {
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
    const isGlobalContext = !contextType;

    let shouldAutoDispose = false;
    let initialRefs = 0;

    if (dispose === "never") {
      // Explicit "never" - permanent instance
      shouldAutoDispose = false;
      initialRefs = -1;
    } else if (dispose === "auto") {
      // Explicit "auto" - always use ref counting
      shouldAutoDispose = true;
      initialRefs = isDisposableContext ? 1 : 0;
    } else {
      // Default behavior based on context
      if (isGlobalContext) {
        shouldAutoDispose = false;
        initialRefs = -1; // Global = never GC
      } else if (isDisposableContext) {
        shouldAutoDispose = true;
        initialRefs = 1; // Start with 1 ref
      }
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

  return sharedFn;
}
