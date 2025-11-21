import { SignalMap, ResolveValue } from "./types";
import { useSignals } from "./utils/useSignals";

/**
 * useAwaited - Access signals with automatic Suspense integration
 *
 * Returns a proxy that tracks signals and automatically awaits async values.
 * Integrates with React Suspense by throwing promises when values are pending.
 *
 * When you access a property:
 * - Tracks the signal as a dependency
 * - Returns awaited value for sync signals
 * - Throws promise for pending async signals (triggers Suspense)
 * - Throws error for rejected async signals (triggers ErrorBoundary)
 *
 * @param signals - Object mapping names to signal instances
 * @returns Proxy object for accessing awaited signal values
 *
 * @example
 * ```tsx
 * const user = signal(async () => fetchUser());
 * const posts = signal(async () => fetchPosts());
 *
 * const awaited = useAwaited({ user, posts });
 * return <div>{awaited.user.name}</div>;
 * ```
 */
export function useAwaited<TSignals extends SignalMap>(
  signals: TSignals
): ResolveValue<TSignals, "awaited"> {
  return useSignals(signals)("awaited");
}
