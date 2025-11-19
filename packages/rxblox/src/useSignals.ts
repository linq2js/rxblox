import { useRef, useState } from "react";
import { MutableSignal } from "./types";
import { useUnmount } from "./useUnmount";
import { signal } from "./signal";
import { emitter } from "./emitter";
import { disposableToken } from "./disposableDispatcher";
import { createProxy } from "./utils/proxy/createProxy";

/**
 * The return type of `useSignals`, mapping each property to a mutable signal.
 *
 * Transforms `{ count: number, name: string }`
 * into `{ count: MutableSignal<number>, name: MutableSignal<string> }`
 */
export type UseSignalsResult<T extends object> = {
  readonly [K in keyof T]: T[K] extends () => any
    ? MutableSignal<ReturnType<T[K]>>
    : MutableSignal<T[K]>;
};

/**
 * Options for configuring `useSignals` behavior.
 */
export type UseSignalsOptions = {
  /**
   * Custom equality function to determine if signal values have changed.
   * Applied to all signals created by this hook.
   *
   * @default Object.is
   */
  equals?: (a: unknown, b: unknown) => boolean;

  /**
   * Automatically sync signal values when input values change on re-render.
   * When `true`, signal values are updated to match new input values on every render.
   * When `false`, signals retain their values across renders (default behavior).
   *
   * @default false
   *
   * @example
   * ```tsx
   * // With autoSync: false (default)
   * const [count, setCount] = useState(0);
   * const signals = useSignals({ count }); // count signal = 0
   * signals.count.set(5); // Update signal
   * setCount(10); // Re-render, but signal still = 5
   *
   * // With autoSync: true
   * const [count, setCount] = useState(0);
   * const signals = useSignals({ count }, { autoSync: true });
   * signals.count.set(5); // Update signal
   * setCount(10); // Re-render, signal now = 10 (synced)
   * ```
   */
  autoSync?: boolean;
};

/**
 * React hook that creates signals from an object of values without automatic reactivity.
 *
 * This hook provides **maximum flexibility** for reactive state management by giving you
 * full control over when and how reactivity happens. Unlike `blox` or `rx()` which track
 * automatically, `useSignals` creates signals that you control manually.
 *
 * **Key Features:**
 * - ✅ **No Automatic Reactivity**: Signals don't cause re-renders by default
 * - ✅ **Lazy Creation**: Signals are created only when first accessed
 * - ✅ **Flexible Integration**: Use with `rx()`, `useTracked()`, or manual updates
 * - ✅ **Automatic Cleanup**: All signals are disposed on unmount
 * - ✅ **Type-Safe**: Full TypeScript support with mapped types
 *
 * **When to Use:**
 * - You want fine-grained control over reactivity
 * - You need to combine manual and reactive updates
 * - You want to use signals with `rx()` for partial rendering
 * - You need conditional tracking with `useTracked()`
 *
 * **When NOT to Use:**
 * - You want automatic reactivity everywhere → use `blox`
 * - You need simple local state → use `useState`
 * - You want component-wide reactivity → use `rx()`
 *
 * @param values - Object of values to convert to signals. Each property becomes a signal.
 * @param options - Configuration options for signal behavior.
 *
 * @returns A proxy object where each property is a mutable signal.
 *
 * @example
 * **Basic Usage**
 * ```tsx
 * const Component = () => {
 *   const signals = useSignals({ count: 0, name: "Alice" });
 *
 *   // Manual updates (no re-render)
 *   const increment = () => signals.count.set(c => c + 1);
 *
 *   // Use with rx() for reactive display
 *   return (
 *     <div>
 *       <div>{rx(() => signals.count())}</div>
 *       <button onClick={increment}>Increment</button>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * **With useTracked for Conditional Tracking**
 * ```tsx
 * const Component = () => {
 *   const signals = useSignals({ count: 0, name: "Alice", age: 30 });
 *   const [showDetails, setShowDetails] = useState(false);
 *
 *   const tracked = useTracked({
 *     count: () => signals.count(),
 *     name: () => signals.name(),
 *     age: () => signals.age(),
 *   });
 *
 *   if (!showDetails) {
 *     // Only tracks 'count'
 *     return <div>{tracked.count}</div>;
 *   }
 *
 *   // Tracks all three when details shown
 *   return (
 *     <div>
 *       <div>{tracked.count}</div>
 *       <div>{tracked.name} - {tracked.age}</div>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * **Auto-Sync with Props**
 * ```tsx
 * const Component = ({ initialCount }: { initialCount: number }) => {
 *   const signals = useSignals(
 *     { count: initialCount },
 *     { autoSync: true } // Sync signal when prop changes
 *   );
 *
 *   return <div>{rx(() => signals.count())}</div>;
 * };
 * ```
 *
 * @example
 * **Manual Control Pattern**
 * ```tsx
 * const Component = () => {
 *   const [forceUpdate, setForceUpdate] = useState(0);
 *   const signals = useSignals({ data: [], loading: false });
 *
 *   const loadData = async () => {
 *     signals.loading.set(true);
 *     const result = await fetchData();
 *     signals.data.set(result);
 *     signals.loading.set(false);
 *     setForceUpdate(n => n + 1); // Manual re-render
 *   };
 *
 *   return (
 *     <div>
 *       {signals.loading() ? "Loading..." : signals.data().length + " items"}
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * **Custom Equality**
 * ```tsx
 * const signals = useSignals(
 *   { user: { id: 1, name: "Alice" } },
 *   { equals: (a, b) => a.id === b.id } // Compare by id
 * );
 * ```
 *
 * @see {@link useTracked} - For conditional reactive tracking
 * @see {@link rx} - For reactive expressions in JSX
 * @see {@link signal} - For creating individual signals
 */
export function useSignals<T extends object>(
  values: T,
  options: UseSignalsOptions = {}
): UseSignalsResult<T> {
  // Store current values and options in refs to access latest values in callbacks
  // without recreating signals or subscriptions
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Create stable references on mount (never recreated)
  const [ref] = useState(() => {
    // Map to store created signals (lazy creation)
    const signals = new Map<keyof T, MutableSignal<T[keyof T]>>();

    // Emitter for cleanup - collects all signal disposers
    const onCleanup = emitter<void>();

    return {
      signals,
      onCleanup,
      /**
       * Proxy that intercepts property access to enable lazy signal creation.
       *
       * **How it works:**
       * - First access: creates signal and stores in map
       * - Subsequent access: returns cached signal from map
       * - Signals are created with disposable dispatcher for automatic cleanup
       */
      proxy: createProxy({
        get: () => values,
        traps: {
          /**
           * Intercept property access to return signals instead of raw values.
           * Implements lazy creation - signals are only created when accessed.
           */
          get(_, prop) {
            // Ignore symbol properties (e.g., Symbol.iterator)
            if (typeof prop === "symbol") {
              return undefined;
            }

            // Check if signal already exists
            let s = signals.get(prop as keyof T);
            if (!s) {
              // First access - create new signal
              const initialValue = valuesRef.current[prop as keyof T];

              // Create signal with disposable dispatcher so it can be cleaned up
              // when the component unmounts via onCleanup.emitAndClear()
              s = disposableToken.with(onCleanup, () =>
                signal(initialValue, {
                  equals: optionsRef.current.equals,
                })
              );

              // Cache signal for subsequent access
              signals.set(prop as keyof T, s);
            }

            return s;
          },

          /**
           * Return object keys for Object.keys(), for...in, etc.
           * Uses current values to reflect any changes.
           */
          ownKeys() {
            return Object.keys(valuesRef.current);
          },

          /**
           * Define property descriptors for proper enumeration.
           * Required for Object.keys() to work correctly with the proxy.
           */
          getOwnPropertyDescriptor(_, prop) {
            if (typeof prop === "symbol") return undefined;
            return {
              enumerable: true,
              configurable: true,
            };
          },
        },
      }),
    };
  });

  /**
   * Auto-sync: update signal values when input values change on re-render.
   *
   * **Important:** Only syncs non-function values to avoid updating computed signals.
   * Function values are treated as computed signal definitions and should not be synced.
   */
  if (optionsRef.current.autoSync) {
    ref.signals.forEach((signal, key) => {
      const value = valuesRef.current[key as keyof T];

      // Don't update computed signals (function values)
      // These should recompute based on their dependencies
      if (typeof value === "function") {
        return;
      }

      // Update signal with new value
      signal.set(value);
    });
  }

  /**
   * Cleanup on unmount: dispose all created signals.
   *
   * This calls all disposers collected by the disposable dispatcher,
   * ensuring proper cleanup of subscriptions and preventing memory leaks.
   */
  useUnmount(() => {
    ref.onCleanup.emitAndClear();
  });

  return ref.proxy as UseSignalsResult<T>;
}
