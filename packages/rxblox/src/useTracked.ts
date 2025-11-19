import { useLayoutEffect, useRef, useState } from "react";
import { useRerender } from "./useRerender";
import { trackingDispatcher, trackingToken } from "./trackingDispatcher";
import { emitter } from "./emitter";
import { createProxy } from "./utils/proxy/createProxy";

/**
 * The return type of `useTracked`, mapping getters to their return types.
 *
 * Transforms `{ count: () => number, name: () => string }`
 * into `{ count: number, name: string }`
 */
export type Tracked<T extends Record<string, () => unknown>> = {
  [key in keyof T]: ReturnType<T[key]>;
};

/**
 * React hook for lazy signal tracking with conditional dependencies.
 *
 * Creates a reactive proxy that enables **conditional tracking** in React components
 * and custom hooks. Unlike `rx()` or `blox`, which track all accessed signals,
 * `useTracked` only tracks signals when they're actually accessed through the proxy.
 *
 * **Key Features:**
 * - ✅ **Lazy Tracking**: Only tracks signals when accessed
 * - ✅ **Conditional Dependencies**: Different code paths track different signals
 * - ✅ **Works Anywhere**: React components, custom hooks, event handlers
 * - ✅ **Type-Safe**: Full TypeScript support with return type inference
 * - ✅ **Supports Signals & Computed**: Pass signals or computed functions
 *
 * **How It Works:**
 * 1. Creates a proxy that wraps your getters/signals
 * 2. During render: tracks which signals are accessed
 * 3. After render: subscribes to those specific signals
 * 4. On signal change: triggers component re-render
 * 5. Next render: clears old subscriptions, tracks new ones
 *
 * **When to Use:**
 * - Conditional signal access (if/else, switch, early returns)
 * - Dynamic dependencies based on state
 * - Event handlers that need reactivity
 * - Custom hooks with reactive logic
 *
 * **When NOT to Use:**
 * - Simple signal display → use `rx()`
 * - Component-level reactivity → use `blox`
 * - Async operations → use `signal.async()` with `track()`
 *
 * @example
 * **Basic Usage**
 * ```tsx
 * const MyComponent = () => {
 *   const tracked = useTracked({
 *     count: () => count(),
 *     user: () => user()
 *   });
 *
 *   // Only tracks 'count' - 'user' never accessed
 *   return <div>{tracked.count}</div>;
 * };
 * ```
 *
 * @example
 * **Conditional Tracking**
 * ```tsx
 * const Profile = () => {
 *   const [showDetails, setShowDetails] = useState(false);
 *   const tracked = useTracked({
 *     name: () => user().name,
 *     email: () => user().email,
 *     phone: () => user().phone
 *   });
 *
 *   // Only tracks 'name' initially
 *   if (!showDetails) {
 *     return <div>{tracked.name}</div>;
 *   }
 *
 *   // Tracks all three when details shown
 *   return (
 *     <div>
 *       <div>{tracked.name}</div>
 *       <div>{tracked.email}</div>
 *       <div>{tracked.phone}</div>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * **With Computed Properties**
 * ```tsx
 * const tracked = useTracked({
 *   firstName: () => user().firstName,
 *   lastName: () => user().lastName,
 *   fullName: () => `${user().firstName} ${user().lastName}`,
 *   age: () => new Date().getFullYear() - user().birthYear
 * });
 *
 * return <div>{tracked.fullName} ({tracked.age})</div>;
 * ```
 *
 * @example
 * **In Event Handlers**
 * ```tsx
 * const tracked = useTracked({ count: () => count() });
 *
 * const handleClick = () => {
 *   console.log('Current:', tracked.count); // Reactive access!
 *   count.set(tracked.count + 1);
 * };
 * ```
 *
 * @example
 * **In Custom Hooks**
 * ```tsx
 * function useUserData() {
 *   const tracked = useTracked({
 *     user: () => currentUser(),
 *     isAdmin: () => currentUser().role === 'admin'
 *   });
 *
 *   useEffect(() => {
 *     if (tracked.isAdmin) {
 *       loadAdminPanel();
 *     }
 *   }, [tracked.isAdmin]); // Reactive dependency!
 *
 *   return tracked.user;
 * }
 * ```
 *
 * @param gettersOrSignals - Object mapping keys to getter functions or signals.
 *   Each value must be a function that returns the desired value.
 *   For signals: `{ count: () => count() }`
 *   For computed: `{ double: () => count() * 2 }`
 *
 * @returns A reactive proxy where each key returns the computed value.
 *   Accessing a property during render tracks that signal as a dependency.
 *
 * @throws Error if any property value is not a function
 *
 * @see {@link trackingDispatcher} - The underlying tracking mechanism
 * @see {@link rx} - For simple reactive expressions in JSX
 * @see {@link blox} - For fully reactive components
 */
export function useTracked<T extends Record<string, () => unknown>>(
  gettersOrSignals: T
): Tracked<T> {
  // Store getters in ref to allow updates without recreating proxy
  const gettersRef = useRef<T>(gettersOrSignals);
  gettersRef.current = gettersOrSignals;

  const rerender = useRerender<any>();

  // Create proxy and dispatcher once on mount
  const [ref] = useState(() => {
    const dispatcher = trackingDispatcher();

    return {
      /**
       * Proxy that intercepts property access to enable lazy tracking.
       *
       * **How it works:**
       * - During render: Wraps getter with tracking dispatcher
       * - Outside render: Returns value without tracking (avoids memory leaks)
       * - Each access is tracked individually (enables conditional dependencies)
       */
      tracked: createProxy({
        get: () => gettersOrSignals,
        traps: {
          get(_, prop) {
            const getter = gettersRef.current[prop as keyof T];

            // Runtime validation: ensure all values are functions
            if (typeof getter !== "function") {
              throw new Error(`Prop ${prop as string} must be a function`);
            }

            // Outside render phase: return value without tracking
            // This prevents memory leaks from event handlers, effects, etc.
            if (!rerender.rendering()) {
              return getter();
            }

            // During render phase: track this getter as a dependency
            return trackingToken.with(dispatcher, getter);
          },
          ownKeys() {
            return Object.keys(gettersRef.current);
          },
          getOwnPropertyDescriptor(_, prop) {
            if (typeof prop === "symbol") return undefined;
            return {
              enumerable: true,
              configurable: true,
            };
          },
        },
      }),
      dispatcher,
    };
  });

  /**
   * Clear previous subscriptions before each render.
   *
   * This ensures that:
   * 1. Conditional dependencies are re-evaluated
   * 2. Old subscriptions don't accumulate
   * 3. Component tracks only currently-accessed signals
   */
  ref.dispatcher.clear();

  /**
   * Subscribe to tracked signals after render.
   *
   * **Lifecycle:**
   * 1. Render phase: dispatcher.clear() + proxy access builds new subscription list
   * 2. Layout effect: subscribe to all tracked signals
   * 3. Signal changes: trigger rerender
   * 4. Cleanup: unsubscribe from all signals (on unmount or re-run)
   */
  useLayoutEffect(() => {
    const onCleanup = emitter();

    // Subscribe to each signal that was accessed during render
    ref.dispatcher.subscribables.forEach((subscribable) => {
      onCleanup.on(subscribable.on(rerender));
    });

    // Return cleanup function to unsubscribe on unmount/re-run
    return () => onCleanup.emitAndClear();
  });

  return ref.tracked as Tracked<T>;
}
