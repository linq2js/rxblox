import {
  TrackingDispatcher,
  Subscribable,
  TrackFunction,
  MutableSignal,
} from "./types";
import { dispatcherToken } from "./dispatcher";
import { emitter, Emitter } from "./emitter";
import { disposableToken } from "./disposableDispatcher";
import { signal } from "./signal";
import { createProxy } from "./utils/proxy/createProxy";

/**
 * Dispatcher token for dependency tracking.
 *
 * Use this to:
 * - Create entries: `trackingToken(dispatcher)`
 * - Retrieve dispatcher: `getDispatcher(trackingToken)`
 */
export const trackingToken =
  dispatcherToken<TrackingDispatcher>("trackingDispatcher");

/**
 * Creates a new tracking dispatcher for tracking dependencies.
 *
 * A tracking dispatcher is used to collect all subscribables (signals, computed values, etc.)
 * that are accessed during the execution of a function (e.g., in computed signals or effects).
 * This enables automatic dependency tracking and reactive updates.
 *
 * The dispatcher uses a minimal `Subscribable` interface (only requires `on()` method),
 * making it decoupled from the full Signal API and flexible for various reactive primitives.
 *
 * The dispatcher:
 * - Maintains a Set of subscribables that were accessed
 * - Provides methods to add, get, and clear tracked dependencies
 * - Is used in conjunction with `withDispatchers()` to track dependencies
 *
 * @param onUpdate - Optional callback invoked when tracked subscribables change
 * @param onCleanup - Optional emitter for cleanup functions
 * @returns A new tracking dispatcher instance
 *
 * @example
 * ```ts
 * import { withDispatchers, trackingToken } from "./dispatcher";
 * import { emitter } from "./emitter";
 *
 * // Create dispatcher with callbacks
 * const onUpdate = () => console.log("dependency changed");
 * const onCleanup = emitter();
 * const dispatcher = trackingDispatcher(onUpdate, onCleanup);
 *
 * // Track subscribables accessed during function execution
 * const result = withDispatchers([trackingToken(dispatcher)], () => {
 *   const value1 = signal1(); // signal1 is added to dispatcher
 *   const value2 = signal2(); // signal2 is added to dispatcher
 *   return value1 + value2;
 * });
 *
 * // Get all subscribables that were accessed
 * const dependencies = dispatcher.subscribables; // [signal1, signal2]
 * ```
 */
export function trackingDispatcher(
  onUpdate?: VoidFunction,
  onCleanup?: Emitter
): TrackingDispatcher {
  const onCleanupDynamicTracking = emitter<void>();
  /**
   * Adds a subscribable to the dispatcher's tracking set.
   *
   * @param subscribable - The subscribable to track
   * @returns True if added, false if already tracked
   */
  const add = (subscribable: Subscribable) => {
    if (subscribables.has(subscribable)) {
      return false;
    }
    subscribables.add(subscribable);

    if (onUpdate) {
      onCleanup?.on(subscribable.on(onUpdate));
    }

    return true;
  };

  /**
   * Creates a lazily-initialized trackable expression with automatic cleanup.
   *
   * This function creates a computed signal that is:
   * 1. **Lazy**: Only created when first accessed
   * 2. **Trackable**: Accesses are tracked by the dispatcher
   * 3. **Disposable**: Automatically cleaned up when dispatcher is disposed
   *
   * **How it works:**
   * - Returns a getter function that lazily creates a signal on first call
   * - The signal is wrapped with `disposableToken` for cleanup tracking
   * - Each access uses `trackingToken` to ensure proper dependency tracking
   * - The signal computes its value by executing `exp()` with tracking enabled
   *
   * **Memory management:**
   * - The `dynamicSignal` is stored in the closure (potential memory leak if never cleaned up)
   * - Cleanup happens when `onCleanupDynamicTracking.emit()` is called
   * - This is typically triggered when the parent tracking dispatcher is disposed
   * - Without cleanup, the signal and all its subscriptions remain in memory
   *
   * @param exp - Function to compute the expression value (can access other signals)
   * @param equals - Equality function to determine if value changed
   * @returns A getter function that lazily creates and accesses the trackable signal
   *
   * @example
   * ```ts
   * const dispatcher = trackingDispatcher(onUpdate);
   *
   * // Create a trackable expression (not executed yet)
   * const getter = createTrackableExpression(
   *   () => signal1() + signal2(),
   *   (a, b) => a === b
   * );
   *
   * // First call: creates signal and tracks signal1, signal2
   * const value1 = getter(); // Creates signal, computes value
   *
   * // Subsequent calls: reuses existing signal
   * const value2 = getter(); // Reuses signal, returns cached/recomputed value
   *
   * // Cleanup to prevent memory leak
   * onCleanupDynamicTracking.emit();
   * ```
   *
   * @internal
   */
  const createTrackableExpression = (
    exp: () => unknown,
    equals: (a: unknown, b: unknown) => boolean
  ) => {
    // Signal is undefined until first access (lazy initialization)
    // ⚠️ MEMORY LEAK RISK: This closure captures the signal permanently
    // until onCleanupDynamicTracking is called
    let dynamicSignal: MutableSignal<unknown> | undefined;

    return () => {
      // Lazy initialization: create signal on first access
      if (!dynamicSignal) {
        // Create signal with disposable context for cleanup
        // The signal will be disposed when onCleanupDynamicTracking.emit() is called
        dynamicSignal = disposableToken.with(onCleanupDynamicTracking, () =>
          signal(exp, { equals })
        );
      }

      // Access signal value with tracking enabled
      // This ensures the current tracking context registers this access
      return trackingToken.with(dispatcher, dynamicSignal.get);
    };
  };

  /**
   * Creates a lazy tracking proxy for explicit dependency management.
   *
   * This method returns a proxy that enables fine-grained, lazy dependency tracking
   * by deferring signal subscription until properties are actually accessed. This is
   * especially powerful in async contexts where the normal tracking context is lost
   * after `await` statements.
   *
   * **Key Features:**
   * - **Lazy Tracking**: Signals are only tracked when their properties are accessed
   * - **Async-Safe**: Maintains tracking context across `await` boundaries
   * - **Conditional Tracking**: Supports conditional logic without over-tracking
   * - **Type-Safe**: Full TypeScript inference for signal values
   * - **Custom Properties**: Accepts computed functions with custom names
   *
   * **How it works:**
   * 1. Accept an object where values are functions (signals or computed properties)
   * 2. Return a proxy that wraps these functions
   * 3. When a property is accessed, execute its function with the dispatcher context
   * 4. This ensures tracking happens at access time, not at proxy creation time
   *
   * @param getters - Object mapping property names to functions (signals or computed)
   * @returns A proxy that tracks dependencies lazily when properties are accessed
   *
   * @example
   * ```ts
   * // In an effect with async operations
   * // Create signals at module/component scope
   * const userId = signal(1);
   * const userName = signal("Alice");
   *
   * effect(({ track }) => {
   *   // Create tracked proxy (no tracking yet)
   *   const tracked = track({ userId, userName });
   *
   *   async function fetchData() {
   *     // Before await - tracking works
   *     const id = tracked.userId; // ✅ userId is tracked
   *
   *     await fetch(`/api/users/${id}`);
   *
   *     // After await - tracking still works!
   *     const name = tracked.userName; // ✅ userName is tracked
   *     console.log(name);
   *   }
   *
   *   fetchData();
   * });
   * ```
   *
   * @example
   * ```ts
   * // Tracking props in blox component async context
   * const UserProfile = blox((props) => {
   *   effect(({ track }) => {
   *     // Track props (which are already signals)
   *     const tracked = track({
   *       userId: props.userId,
   *       status: props.status,
   *     });
   *
   *     async function loadUser() {
   *       const id = tracked.userId; // Track before await
   *
   *       await delay(100);
   *
   *       const status = tracked.status; // Track after await
   *       console.log(`User ${id} status: ${status}`);
   *     }
   *
   *     loadUser();
   *   });
   *
   *   return rx(() => <div>User: {props.userId()}</div>);
   * });
   * ```
   *
   * @example
   * ```ts
   * // Conditional tracking with custom computed properties
   * // Create signals at module/component scope
   * const isLoggedIn = signal(true);
   * const userId = signal(123);
   * const userName = signal("Alice");
   *
   * effect(({ track }) => {
   *   const tracked = track({
   *     isLoggedIn,
   *     userId,
   *     displayName: () => `User: ${userName()}`, // Custom computed
   *   });
   *
   *   if (tracked.isLoggedIn) {
   *     // Only tracks isLoggedIn initially
   *     console.log(tracked.displayName); // Now tracks userName too
   *   }
   *   // userId is never tracked since never accessed
   * });
   * ```
   *
   * @example
   * ```ts
   * // Avoid premature destructuring - use conditional access
   * // Create signals at module/component scope
   * const a = signal(1);
   * const b = signal(2);
   * const c = signal(3);
   *
   * effect(({ track }) => {
   *   const tracked = track({ a, b, c });
   *
   *   // ❌ BAD: Immediate destructuring tracks all signals
   *   // const { a, b, c } = tracked;
   *
   *   // ✅ GOOD: Conditional access for lazy tracking
   *   if (tracked.a > 0) {
   *     const { b, c } = tracked; // Only track b and c when needed
   *   }
   * });
   * ```
   */
  const track: TrackFunction = (
    getters: Record<string, () => unknown> | (() => unknown),
    equals?: (a: unknown, b: unknown) => boolean
  ) => {
    if (typeof getters === "function") {
      return createTrackableExpression(getters, equals!);
    }

    return createProxy({
      get: () => getters,
      traps: {
        get(target, prop) {
          const value = target[prop as keyof typeof target];
          
          // Skip built-in function properties that aren't in the getters object
          // These are added by createProxy's ownKeys trap but aren't signal getters
          if (value === undefined) {
            const builtInProps = ['length', 'name', 'prototype', 'arguments', 'caller', 'constructor', 'toString', 'apply', 'call', 'bind'];
            if (builtInProps.includes(String(prop))) {
              // Return undefined for built-in properties not in getters
              return undefined;
            }
          }

          if (typeof value !== "function") {
            throw new Error(`Track prop ${prop as string} must be a function`);
          }
          // Execute function with dispatcher context to perform tracking
          // This ensures tracking happens at property access time, maintaining
          // the dispatcher context even in async scenarios
          return trackingToken.with(dispatcher, value);
        },
      },
    }) as any;
  };
  /**
   * Set of subscribables that have been accessed during tracking.
   * Using a Set ensures each subscribable is only tracked once, even if accessed multiple times.
   */
  const subscribables = new Set<Subscribable>();

  const dispatcher: TrackingDispatcher = {
    track,
    add,
    /**
     * Gets all subscribables that have been tracked.
     *
     * Returns a readonly array copy of the subscribables set.
     * This prevents external modification while allowing iteration.
     *
     * @returns A readonly array of all tracked subscribables
     */
    get subscribables(): readonly Subscribable[] {
      return Array.from(subscribables);
    },
    /**
     * Clears all tracked subscribables from the dispatcher.
     *
     * Used to reset the dispatcher before tracking a new set of dependencies.
     */
    clear() {
      subscribables.clear();
      onCleanupDynamicTracking.emitAndClear();
    },
  };

  return dispatcher;
}
