import { useLayoutEffect, useMemo, useState } from "react";
import { ResolveValue, ResolveValueType, Signal, SignalMap } from "../types";
import { useRerender } from "../useRerender";
import { createSignalAccessProxy } from "./createSignalAccessProxy";
import { getLoadable } from "../loadable";
import { emitter } from "../emitter";

/**
 * useSignals - Creates lazy-tracking proxies for signal access
 *
 * This hook implements conditional/lazy signal tracking:
 * - Only subscribes to signals that are actually accessed during render
 * - Tracks signals during render phase (when rerender.rendering() === true)
 * - Sets up subscriptions in useLayoutEffect (after render completes)
 * - Automatically cleans up subscriptions on unmount
 *
 * Returns a factory function that creates proxies for different access patterns:
 * - "value": Direct signal value (sync or async, no transformation)
 * - "awaited": Suspense-compatible (throws promises/errors)
 * - "loadable": Manual state handling (returns Loadable objects)
 *
 * @param signals - Object mapping names to signal instances
 * @returns Factory function: (type) => proxy for that access pattern
 *
 * @example
 * ```tsx
 * const getProxy = useSignals({ user, posts });
 * const awaited = getProxy("awaited");  // Suspense pattern
 * const loadable = getProxy("loadable"); // Manual pattern
 *
 * // Only subscribes to signals actually accessed:
 * awaited.user;  // ✅ Subscribes to user
 * // posts not accessed → no subscription
 * ```
 *
 * @example Lazy tracking behavior
 * ```tsx
 * const getProxy = useSignals({ a, b, c });
 * const awaited = getProxy("awaited");
 *
 * // First render: only accesses a
 * if (flag) {
 *   awaited.a;  // ✅ Tracks a
 * } else {
 *   awaited.b;  // ✅ Tracks b (different render)
 * }
 * // c never accessed → never tracked
 * ```
 */
export function useSignals<TSignals extends SignalMap>(
  signals: TSignals
): <TType extends ResolveValueType>(
  type: TType
) => ResolveValue<TSignals, TType> {
  // Rerender function that triggers component re-render when signals change
  const rerender = useRerender();

  // Persistent ref object that survives re-renders
  // Stores current signals and tracks which ones were accessed
  const [ref] = useState(() => {
    return {
      signals, // Current signals object (updated each render)
      trackedSignals: new Set<Signal<any>>(), // Signals accessed during render
    };
  });

  // Update signals reference and clear tracking set for new render
  ref.signals = signals;
  ref.trackedSignals.clear();

  // Set up subscriptions AFTER render completes (useLayoutEffect runs synchronously)
  // This ensures we only subscribe to signals that were actually accessed
  useLayoutEffect(() => {
    // Create cleanup emitter to collect unsubscribe functions
    const onCleanup = emitter();

    // Subscribe to all signals that were tracked during render
    ref.trackedSignals.forEach((signal) => {
      // Subscribe to signal changes and store unsubscribe function
      onCleanup.on(signal.on(rerender));
    });

    // Cleanup: unsubscribe from all signals when:
    // - Component unmounts
    // - Signals object changes (new render cycle)
    // - Dependencies change
    return () => {
      onCleanup.emitAndClear();
    };
  });

  // Memoize proxy factory function
  // Recreates when rerender function or signals object changes
  return useMemo(() => {
    // Cache proxies by type to avoid recreating them
    const proxies: Partial<
      Record<ResolveValueType, ResolveValue<TSignals, ResolveValueType>>
    > = {};

    // Return factory function that creates/returns proxy for requested type
    return <TType extends ResolveValueType>(type: TType) => {
      // Return cached proxy if it exists
      let proxy = proxies[type];
      if (!proxy) {
        // Create new proxy for this access type using shared utility
        proxy = createSignalAccessProxy<
          TSignals,
          ResolveValue<TSignals, TType>
        >({
          getSignals: () => ref.signals,
          onSignalAccess: (signal) => {
            // Track signal for subscription setup
            ref.trackedSignals.add(signal);
          },
          getValue: (signal) => {
            // Get current signal value
            const value = signal();

            // Handle different access patterns
            if (type === "value") {
              // Direct value access - return as-is (sync or async)
              return value;
            }

            // Convert to loadable for awaited/loadable patterns
            const loadable = getLoadable(value);

            if (type === "awaited") {
              // Suspense pattern: throw promises/errors for React boundaries
              if (loadable.status === "loading") {
                throw loadable.promise; // Suspense catches this
              }
              if (loadable.status === "error") {
                throw loadable.error; // ErrorBoundary catches this
              }
              // Return resolved value
              return loadable.value;
            }

            if (loadable.status === "loading") {
              loadable.promise.then(
                () => {
                  rerender();
                },
                () => {
                  rerender();
                }
              );
            }

            // loadable pattern: return Loadable object for manual handling
            return loadable;
          },
          // Lazy tracking: only track signals accessed during render phase
          // rerender.rendering() === true means we're currently rendering
          // This prevents tracking signals accessed outside render (e.g., in callbacks)
          shouldTrack: () => rerender.rendering(),
        });
        proxies[type] = proxy as any;
      }
      return proxy as ResolveValue<TSignals, TType>;
    };
  }, [rerender]);
}
