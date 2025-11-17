import { isPromiseLike } from "./isPromiseLike";
import { loadable, Loadable } from "./loadable";
import { ComputedSignalContext, signal } from "./signal";
import { Tag } from "./tag";
import { Signal } from "./types";
import { getLoadable } from "./wait";

/**
 * A signal that wraps async operations and returns a Loadable.
 *
 * Extends Signal<Loadable<T>> with additional async-specific behavior:
 * - Automatic promise state tracking
 * - Request cancellation via AbortSignal
 * - Automatic re-computation when dependencies change
 */
export type AsyncSignal<T> = Signal<Loadable<T>> & {};

/**
 * Context provided to async signal functions.
 *
 * @property track - Function to create a proxy that tracks signal dependencies.
 *                   Only signals accessed through the proxy will be tracked.
 *                   This works even after `await` statements, unlike implicit tracking.
 * @property abortSignal - Signal for cancelling the current computation.
 *                         When a new computation starts, the previous one is aborted.
 *
 * @example
 * ```typescript
 * asyncSignal(async ({ track, abortSignal }) => {
 *   // Create a proxy for explicit tracking
 *   const proxy = track({ userId, filter });
 *
 *   // Can await before accessing signals
 *   await delay(10);
 *
 *   // Only tracks signals you actually access
 *   return proxy.userId + proxy.filter;
 * });
 * ```
 */
export type AsyncSignalContext = ComputedSignalContext & {
  abortSignal: AbortSignal;
};

/**
 * Options for configuring an async signal's behavior.
 * @property name - The name of the async signal.
 */
export type AsyncSignalOptions<T> = {
  name?: string;
  tags?: readonly Tag<NoInfer<Loadable<T>>>[];
};

/**
 * Function that performs an async computation.
 *
 * @param context - Context with AbortSignal for cancellation
 * @returns A promise that resolves to the result, or a synchronous value
 *
 * @example
 * ```typescript
 * const fetchUser: AsyncSignalFunction<User> = async ({ abortSignal }) => {
 *   const response = await fetch('/api/user', { signal: abortSignal });
 *   return response.json();
 * };
 * ```
 */
export type AsyncSignalFunction<T> = (
  context: AsyncSignalContext
) => PromiseLike<T> | T;

/**
 * Creates an async signal that automatically manages promise states.
 *
 * The async signal:
 * - Tracks promise loading/success/error states in a Loadable
 * - Cancels previous computations when a new one starts
 * - Re-computes when signal dependencies change
 * - Caches promise states to avoid redundant re-renders
 * - Uses lazy evaluation - only starts when first accessed
 *
 * **Signal Dependency Tracking**
 *
 * There are two ways to track signal dependencies:
 *
 * 1. **Implicit tracking** - Call signals directly (only works before first `await`)
 * 2. **Explicit tracking** - Use `track()` proxy (works anywhere, even after `await`)
 *
 * The `track()` function creates a proxy that lazily tracks only the signals you
 * actually access. This is perfect for conditional dependencies and tracking after
 * async operations.
 *
 * @template T - The type of the async result
 * @param fn - Async function to execute
 * @returns A signal that returns Loadable<T>
 *
 * @example
 * ```typescript
 * // Basic async signal
 * const user = asyncSignal(async ({ abortSignal }) => {
 *   const response = await fetch('/api/user', { signal: abortSignal });
 *   return response.json();
 * });
 *
 * // Access the loadable (this triggers the async operation)
 * const loadable = user();
 * if (loadable.status === "loading") {
 *   console.log("Loading...");
 * } else if (loadable.status === "success") {
 *   console.log("User:", loadable.value);
 * }
 *
 * // ✅ Using track() for explicit dependency tracking (RECOMMENDED)
 * const userId = signal(1);
 * const user = asyncSignal(async ({ track, abortSignal }) => {
 *   const proxy = track({ userId });
 *   // Can await before accessing signals!
 *   const response = await fetch(`/api/users/${proxy.userId}`, { signal: abortSignal });
 *   return response.json();
 * });
 *
 * // ✅ Conditional tracking - only tracks what you access
 * const data = asyncSignal(async ({ track }) => {
 *   const { condition, s1, s2 } = track({ condition, s1, s2 });
 *   await delay(10);
 *   return condition ? s1 : s2; // Only tracks condition + one of s1/s2
 * });
 *
 * // ✅ Implicit tracking (before await)
 * const user = asyncSignal(async ({ abortSignal }) => {
 *   const id = userId(); // Implicit tracking
 *   const response = await fetch(`/api/users/${id}`, { signal: abortSignal });
 *   return response.json();
 * });
 *
 * // ⚠️ Implicit tracking after await won't work
 * const badExample = asyncSignal(async () => {
 *   await delay(10);
 *   return userId(); // NOT TRACKED - use track() instead!
 * });
 *
 * // Changing userId triggers re-fetch (previous request is aborted)
 * userId.set(2);
 * ```
 */
export function asyncSignal<T>(
  fn: AsyncSignalFunction<T>,
  options: AsyncSignalOptions<T> = {}
): AsyncSignal<T> {
  // Token tracks the current computation to handle cancellation
  let token: { context: AsyncSignalContext } | undefined;

  /**
   * Handles promise state tracking and updates.
   *
   * - Gets/creates loadable from promise cache
   * - Sets up handlers to update the signal when promise settles
   * - Prevents updates if token has changed (new computation started)
   *
   * @param promise - The promise to track
   * @param isResult - Whether this promise is the direct result of the async function (true)
   *                   or a thrown promise for suspense-like behavior (false)
   * @returns Loadable representing current promise state
   */
  const handlePromise = (promise: PromiseLike<T>, isResult: boolean) => {
    // Capture current token to detect if computation was cancelled
    const prevToken = token;

    /**
     * Handles promise settlement and updates the signal state.
     * Only updates if this is still the active computation.
     */
    const done = (status: "success" | "error", data: any) => {
      // If token changed, a new computation started - don't update
      if (prevToken !== token) {
        return;
      }

      // For direct async function results, directly update the signal's cache
      // This bypasses re-running the computation function, preventing infinite loops
      if (isResult) {
        token = undefined;
        if (status === "success") {
          inner.set(loadable("success", data, promise));
        } else {
          inner.set(loadable("error", data, promise));
        }
        return;
      }

      // For thrown promises (suspense-like), trigger a re-computation
      // The re-computation will fetch the settled loadable from the cache
      inner.reset();
    };

    // Get or create loadable from cache
    const l = getLoadable(promise);

    // If still loading, set up handlers to update when settled
    if (l.loading) {
      promise.then(
        (data) => done("success", data),
        (error) => done("error", error)
      );
    }

    return l;
  };

  /**
   * The underlying computed signal that executes the async computation.
   *
   * It tracks dependencies (both implicit and via track() proxy) and re-runs
   * when any tracked signal changes. When the async function returns a promise,
   * the signal initially returns a loading loadable, then updates directly via
   * .set() when the promise settles (to avoid re-running the async function).
   */
  const inner = signal<Loadable<T>>(({ track, abortSignal }) => {
    // Update token to track this computation
    token = {
      context: {
        abortSignal,
        track,
      },
    };

    try {
      // Execute async function (tracks signal dependencies implicitly)
      const result = fn(token.context);

      // If result is a promise, track its state via handlePromise
      // Returns a loading loadable initially, then updates via .set() when settled
      if (isPromiseLike<T>(result)) {
        return handlePromise(result, true);
      }

      // If synchronous result, wrap in success loadable immediately
      return loadable("success", result);
    } catch (error) {
      // If error is a thrown promise (suspense-like pattern), track it
      // This will trigger re-computation via .reset() when it settles
      if (isPromiseLike<T>(error)) {
        return handlePromise(error, false);
      }

      // If regular error, wrap in error loadable immediately
      return loadable("error", error);
    }
  }, options);

  return inner;
}
