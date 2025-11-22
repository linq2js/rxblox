import { useLayoutEffect, useMemo, useState } from "react";
import { ResolveValue, Signal, SignalMap } from "./types";
import { useRerender } from "./useRerender";
import { createSignalAccessProxy } from "./utils/createSignalAccessProxy";
import { emitter } from "./utils/emitter";

/**
 * useSignals - Hook for reactive signal access with lazy tracking
 *
 * This hook implements conditional/lazy signal tracking:
 * - Only subscribes to signals that are actually accessed during render
 * - Tracks signals during render phase (when rerender.rendering() === true)
 * - Sets up subscriptions in useLayoutEffect (after render completes)
 * - Automatically cleans up subscriptions on unmount
 *
 * Returns a tuple of [awaited, loadable] proxies:
 * - awaited: Suspense-compatible (throws promises/errors)
 * - loadable: Manual state handling (returns Loadable objects)
 *
 * @param signals - Object mapping names to signal instances
 * @returns Tuple of [awaited, loadable] proxies
 *
 * @example
 * ```tsx
 * const [awaited, loadable] = useSignals({ user, posts });
 *
 * // Suspense pattern
 * return <div>{awaited.user.name}</div>;
 *
 * // Manual loading state pattern
 * if (loadable.user.status === "loading") return <Spinner />;
 * return <div>{loadable.user.value.name}</div>;
 * ```
 *
 * @example Lazy tracking behavior
 * ```tsx
 * const [awaited] = useSignals({ a, b, c });
 *
 * // Only subscribes to signals actually accessed:
 * awaited.a;  // ✅ Tracks a
 * // b, c not accessed → no subscription
 * ```
 */
export function useSignals<TSignals extends SignalMap>(
  signals: TSignals
): [ResolveValue<TSignals, "awaited">, ResolveValue<TSignals, "loadable">] {
  // Rerender function that triggers component re-render when signals change
  const rerender = useRerender();

  // Persistent ref object that survives re-renders
  // Stores current signals and tracks which ones were accessed
  const [ref] = useState(() => {
    return {
      propValueCache: {
        awaited: new Map<string, { value: any; error: any }>(),
        loadable: new Map<string, { value: any; error: any }>(),
      },
      signals, // Current signals object (updated each render)
      trackedSignals: new Set<Signal<any>>(), // Signals accessed during render
    };
  });

  // Update signals reference and clear tracking set for new render
  ref.signals = signals;
  ref.trackedSignals.clear();
  ref.propValueCache.awaited.clear();
  ref.propValueCache.loadable.clear();

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
      ref.propValueCache.awaited.clear();
      ref.propValueCache.loadable.clear();
    };
  });

  // Memoize both proxies
  // Recreates when rerender function or signals object changes
  return useMemo(() => {
    // Helper to create a proxy for a specific type
    const createProxy = <TType extends "awaited" | "loadable">(type: TType) => {
      return createSignalAccessProxy<
        TType,
        TSignals,
        ResolveValue<TSignals, TType>
      >({
        type,
        getSignals: () => ref.signals,
        onSignalAccess: (signal) => {
          // Track signal for subscription setup
          ref.trackedSignals.add(signal);
        },
        onFinally: () => {
          rerender();
        },
        isReading: rerender.rendering,
        // Lazy tracking: only track signals accessed during render phase
        // rerender.rendering() === true means we're currently rendering
        // This prevents tracking signals accessed outside render (e.g., in callbacks)
        shouldTrack: () => rerender.rendering(),
        propValueCache: ref.propValueCache[type],
      });
    };

    // Create and return both proxies as a tuple
    const awaited = createProxy("awaited") as ResolveValue<TSignals, "awaited">;
    const loadable = createProxy("loadable") as ResolveValue<
      TSignals,
      "loadable"
    >;

    return [awaited, loadable];
  }, [rerender]);
}
