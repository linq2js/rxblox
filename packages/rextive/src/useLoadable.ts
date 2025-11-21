import { SignalMap, ResolveValue } from "./types";
import { useSignals } from "./utils/useSignals";

/**
 * useLoadable - Access signals as Loadable state objects
 *
 * Returns a proxy that tracks signals and wraps async values in Loadable objects.
 * Unlike useAwaited, this does NOT throw promises - you handle loading states manually.
 *
 * When you access a property:
 * - Tracks the signal as a dependency
 * - Returns Loadable<T> with discriminated union: loading | success | error
 * - Allows manual handling of async states (no Suspense)
 *
 * @param signals - Object mapping names to signal instances
 * @returns Proxy object for accessing loadable signal values
 *
 * @example
 * ```tsx
 * const data = signal(async () => fetchData());
 *
 * const loadable = useLoadable({ data });
 * if (loadable.data.status === "loading") return <Spinner />;
 * return <div>{loadable.data.value}</div>;
 * ```
 */
export function useLoadable<TSignals extends SignalMap>(
  signals: TSignals
): ResolveValue<TSignals, "loadable"> {
  return useSignals(signals)("loadable");
}
