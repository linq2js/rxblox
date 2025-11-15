import { SignalDispatcher, Signal, TrackFunction } from "./types";
import { dispatcherToken, withDispatchers } from "./dispatcher";
import { Emitter } from "./emitter";

/**
 * Dispatcher token for dependency tracking.
 *
 * Use this to:
 * - Create entries: `trackingToken(dispatcher)`
 * - Retrieve dispatcher: `getDispatcher(trackingToken)`
 */
export const trackingToken =
  dispatcherToken<SignalDispatcher>("trackingDispatcher");

/**
 * Creates a new tracking dispatcher for tracking signal dependencies.
 *
 * A tracking dispatcher is used to collect all signals that are accessed
 * during the execution of a function (e.g., in computed signals or effects).
 * This enables automatic dependency tracking and reactive updates.
 *
 * The dispatcher:
 * - Maintains a Set of signals that were accessed
 * - Provides methods to add signals, get all signals, and clear the set
 * - Is used in conjunction with `withDispatchers()` to track dependencies
 *
 * @param onUpdate - Optional callback invoked when tracked signals change
 * @param onCleanup - Optional emitter for cleanup functions
 * @returns A new tracking dispatcher instance
 *
 * @example
 * ```ts
 * import { withDispatchers, trackingToken } from "./dispatcher";
 * import { emitter } from "./emitter";
 *
 * // Create dispatcher with callbacks
 * const onUpdate = () => console.log("signal changed");
 * const onCleanup = emitter();
 * const dispatcher = trackingDispatcher(onUpdate, onCleanup);
 *
 * // Track signals accessed during function execution
 * const result = withDispatchers([trackingToken(dispatcher)], () => {
 *   const value1 = signal1(); // signal1 is added to dispatcher
 *   const value2 = signal2(); // signal2 is added to dispatcher
 *   return value1 + value2;
 * });
 *
 * // Get all signals that were accessed
 * const dependencies = dispatcher.signals; // [signal1, signal2]
 * ```
 */
export function trackingDispatcher(
  onUpdate?: VoidFunction,
  onCleanup?: Emitter
): SignalDispatcher {
  /**
   * Adds a signal to the dispatcher's tracking set.
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
   * @param signals - Object mapping property names to functions (signals or computed)
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
  const track: TrackFunction = (signals) => {
    return new Proxy(signals, {
      get(_target, prop) {
        const value = signals[prop as keyof typeof signals];
        if (typeof value !== "function") {
          throw new Error(`Track prop ${prop as string} must be a function`);
        }
        // Execute function with dispatcher context to perform tracking
        // This ensures tracking happens at property access time, maintaining
        // the dispatcher context even in async scenarios
        return withDispatchers([trackingToken(dispatcher)], value);
      },
    }) as any;
  };
  /**
   * Set of signals that have been accessed during tracking.
   * Using a Set ensures each signal is only tracked once, even if accessed multiple times.
   */
  const signals = new Set<Signal<unknown>>();

  const dispatcher: SignalDispatcher = {
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

  return dispatcher;
}

