import { loadable, Loadable, isLoadable } from "./loadable";
import { AwaitedOrSignalValue, Signal } from "./types";
import { isPromiseLike } from "./isPromiseLike";
import { delay as delayUtil } from "./delay";

/**
 * Represents a value that can be awaited in signal.async().
 * Can be a promise, signal containing promise, or signal containing loadable.
 */
export type Awaitable<T> =
  | PromiseLike<T>
  | Signal<PromiseLike<T>>
  | Signal<Loadable<T>>
  | Loadable<T>;

/**
 * Cache for tracking promise states across wait() calls.
 * Maps promises to their loadable representations.
 */
const promiseCache = new WeakMap<PromiseLike<unknown>, Loadable<unknown>>();

/**
 * Associates a loadable with a promise in the cache.
 * Used internally to track promise states.
 */
export function setLoadable<T>(promise: PromiseLike<T>, l: Loadable<T>) {
  promiseCache.set(promise, l);
  return l;
}

/**
 * Gets or creates a loadable for a promise.
 *
 * If the promise is already cached, returns the cached loadable.
 * Otherwise, creates a new loading loadable and sets up handlers
 * to update the cache when the promise settles.
 *
 * @param promise - The promise to get/create loadable for
 * @returns Loadable representing the promise state
 */
export function getLoadable<T>(promise: PromiseLike<T>): Loadable<T> {
  let l = promiseCache.get(promise) as Loadable<T> | undefined;
  if (l) return l;

  promise.then(
    (data) => {
      setLoadable(promise, loadable("success", data, promise as Promise<T>));
    },
    (error) => {
      setLoadable(
        promise,
        loadable("error", error, promise as Promise<unknown>)
      );
    }
  );

  return setLoadable(promise, loadable("loading", promise as Promise<T>));
}

/**
 * Checks if a value is a signal by checking for function type.
 */
function isSignal(value: unknown): value is Signal<unknown> {
  return typeof value === "function";
}

/**
 * Resolves an awaitable to a loadable.
 *
 * Handles the following cases:
 * 1. Signal<Loadable<T>> -> Extract and return loadable
 * 2. Signal<PromiseLike<T>> -> Extract promise, get/create loadable
 * 3. PromiseLike<T> -> Get/create loadable
 * 4. Direct value -> Wrap in success loadable
 *
 * @param awaitable - The awaitable value to resolve
 * @returns Loadable representing the current state
 */
function resolveAwaitable(awaitable: Awaitable<unknown>): Loadable<any> {
  let value: unknown = awaitable;

  // If it's a signal, call it to get the value
  if (isSignal(value)) {
    value = (value as Signal<unknown>)();
  }

  // If value is a loadable, return it
  if (isLoadable(value)) {
    return value;
  }

  // If value is a promise, get/create loadable from cache
  if (isPromiseLike(value)) {
    return getLoadable(value);
  }

  // Otherwise, wrap in success loadable
  return loadable("success", value);
}

/**
 * Waits for a single awaitable or all awaitables in an array.
 * Throws the promise if any are still loading.
 * Throws the error if any failed.
 * Returns unwrapped value(s) if all succeeded.
 *
 * @example
 * ```typescript
 * // Single value
 * const user = wait(userSignal);
 *
 * // Multiple values
 * const [user, posts] = wait([userSignal, postsSignal]);
 * ```
 */
function waitAll(awaitable: Awaitable<unknown>): any;
function waitAll<const TAwaitables extends readonly Awaitable<unknown>[]>(
  awaitables: TAwaitables
): {
  [K in keyof TAwaitables]: AwaitedOrSignalValue<TAwaitables[K]>;
};
function waitAll(awaitableOrArray: any): any {
  // Handle single awaitable
  if (!Array.isArray(awaitableOrArray)) {
    const l = resolveAwaitable(awaitableOrArray);
    if (l.status === "loading") {
      throw l.promise;
    }
    if (l.status === "error") {
      throw l.error;
    }
    return l.value;
  }

  // Handle array of awaitables
  const loadables = awaitableOrArray.map(resolveAwaitable);

  // Check if any are loading
  const loadingLoadable = loadables.find((l) => l.status === "loading");
  if (loadingLoadable) {
    // Throw Promise.all of all loading promises
    const promises = loadables.map((l) =>
      l.status === "loading" ? l.promise : Promise.resolve(l.value)
    );
    throw Promise.all(promises);
  }

  // Check if any errored
  const errorLoadable = loadables.find((l) => l.status === "error");
  if (errorLoadable) {
    throw errorLoadable.error;
  }

  // All succeeded, return data array
  return loadables.map((l) => l.value);
}

/**
 * Waits for the first successful result from a record of awaitables.
 * Returns [value, key] tuple indicating which succeeded first.
 * Only throws if ALL awaitables fail.
 *
 * @example
 * ```typescript
 * const [data, source] = wait.any({
 *   cache: cacheSignal,
 *   api: apiSignal,
 *   backup: backupSignal
 * });
 * console.log(`Loaded from: ${source}`); // "cache" | "api" | "backup"
 * ```
 */
function waitAny<const TAwaitables extends Record<string, Awaitable<unknown>>>(
  awaitables: TAwaitables
): {
  [K in keyof TAwaitables]: [AwaitedOrSignalValue<TAwaitables[K]>, K];
}[keyof TAwaitables];
function waitAny(awaitables: Record<string, Awaitable<unknown>>): any {
  const entries = Object.entries(awaitables);
  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  // Check if any succeeded
  const succeeded = loadables.find(({ loadable: l }) => l.status === "success");
  if (succeeded) {
    return [succeeded.loadable.value, succeeded.key];
  }

  // Check if all failed
  const allFailed = loadables.every(({ loadable: l }) => l.status === "error");
  if (allFailed) {
    // Throw error with all errors collected
    const errors = loadables.map(({ loadable: l }) => l.error);
    const error = new Error("All promises rejected");
    (error as any).errors = errors;
    throw error;
  }

  // Some are still loading, create Promise.any equivalent
  const promises = loadables.map(({ key, loadable: l }) =>
    l.status === "loading"
      ? l.promise.then((data) => [data, key])
      : l.status === "success"
      ? Promise.resolve([l.value, key])
      : Promise.reject(l.error)
  );

  // Promise.any polyfill: resolve with first success, reject if all fail
  throw new Promise((resolve, reject) => {
    let rejectionCount = 0;
    const rejections: any[] = [];

    promises.forEach((promise, index) => {
      promise.then(resolve, (error) => {
        rejections[index] = error;
        rejectionCount++;
        if (rejectionCount === promises.length) {
          const err = new Error("All promises rejected");
          (err as any).errors = rejections;
          reject(err);
        }
      });
    });
  });
}

/**
 * Waits for the first completed result (success or error) from a record of awaitables.
 * Returns [value, key] tuple indicating which completed first.
 * Throws the error if the first completion was a failure.
 *
 * @example
 * ```typescript
 * const [data, fastest] = wait.race({
 *   server1: server1Signal,
 *   server2: server2Signal,
 *   timeout: timeoutSignal
 * });
 * console.log(`Fastest: ${fastest}`);
 * ```
 */
function waitRace<const TAwaitables extends Record<string, Awaitable<unknown>>>(
  awaitables: TAwaitables
): {
  [K in keyof TAwaitables]: [AwaitedOrSignalValue<TAwaitables[K]>, K];
}[keyof TAwaitables];
function waitRace(awaitables: Record<string, Awaitable<unknown>>): any {
  const entries = Object.entries(awaitables);
  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  // Check if any completed (success or error)
  const completed = loadables.find(
    ({ loadable: l }) => l.status === "success" || l.status === "error"
  );

  if (completed) {
    if (completed.loadable.status === "error") {
      throw completed.loadable.error;
    }
    return [completed.loadable.value, completed.key];
  }

  // All still loading, throw Promise.race
  const promises = loadables.map(({ key, loadable: l }) =>
    l.promise.then(
      (data) => [data, key],
      (error) => Promise.reject(error)
    )
  );
  throw Promise.race(promises);
}

/**
 * Waits for all awaitables to settle (complete with success or error).
 * Never throws - returns PromiseSettledResult for each awaitable.
 *
 * @example
 * ```typescript
 * // Single value
 * const result = wait.settled(userSignal);
 * if (result.status === 'fulfilled') {
 *   console.log(result.value);
 * }
 *
 * // Multiple values
 * const results = wait.settled([sig1, sig2, sig3]);
 * const successes = results.filter(r => r.status === 'fulfilled');
 * ```
 */
function waitSettled(awaitable: Awaitable<unknown>): PromiseSettledResult<any>;
function waitSettled<const TAwaitables extends readonly Awaitable<unknown>[]>(
  awaitables: TAwaitables
): {
  [K in keyof TAwaitables]: PromiseSettledResult<
    AwaitedOrSignalValue<TAwaitables[K]>
  >;
};
function waitSettled(awaitableOrArray: any): any {
  // Handle single awaitable
  if (!Array.isArray(awaitableOrArray)) {
    const l = resolveAwaitable(awaitableOrArray);
    if (l.status === "loading") {
      throw l.promise.then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason })
      );
    }
    if (l.status === "error") {
      return { status: "rejected" as const, reason: l.error };
    }
    return { status: "fulfilled" as const, value: l.value };
  }

  // Handle array of awaitables
  const loadables = awaitableOrArray.map(resolveAwaitable);

  // Check if any are loading
  const anyLoading = loadables.some((l) => l.status === "loading");
  if (anyLoading) {
    // Create Promise.allSettled equivalent
    const promises = loadables.map((l) =>
      l.status === "loading"
        ? l.promise
        : l.status === "success"
        ? Promise.resolve(l.value)
        : Promise.reject(l.error)
    );

    // Promise.allSettled polyfill
    throw Promise.all(
      promises.map((p) =>
        p.then(
          (value) => ({ status: "fulfilled" as const, value }),
          (reason) => ({ status: "rejected" as const, reason })
        )
      )
    );
  }

  // All settled, return results
  return loadables.map((l) =>
    l.status === "success"
      ? { status: "fulfilled" as const, value: l.value }
      : { status: "rejected" as const, reason: l.error }
  );
}

/**
 * Waits indefinitely (never resolves).
 * @example
 * ```typescript
 * const data = signal.async(({ wait }) => {
 *   wait.never();
 * });
 * ```
 */
export function waitNever(): never {
  throw new Promise(() => {});
}

/**
 * TimeoutError is thrown when a timeout occurs.
 */
export class TimeoutError extends Error {
  constructor(message: string = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Adds timeout to a single awaitable.
 * Throws TimeoutError if the awaitable doesn't resolve within the specified time.
 *
 * @param awaitable - The awaitable to add timeout to
 * @param ms - Timeout duration in milliseconds
 * @param error - Optional error message or error factory function
 * @returns The unwrapped value if resolved within timeout
 *
 * @example
 * ```typescript
 * const user = wait.timeout(userSignal, 5000, 'User fetch timed out');
 * ```
 */
function waitTimeoutAwaitable<T>(
  awaitable: Awaitable<unknown>,
  ms: number,
  error?: string | (() => unknown)
): T;

/**
 * Adds timeout to an array of awaitables.
 * Throws TimeoutError if any awaitable doesn't resolve within the specified time.
 *
 * @param awaitables - Array of awaitables
 * @param ms - Timeout duration in milliseconds
 * @param error - Optional error message or error factory function
 * @returns Array of unwrapped values if all resolve within timeout
 *
 * @example
 * ```typescript
 * const [user, posts] = wait.timeout([userSignal, postsSignal], 5000);
 * ```
 */
function waitTimeoutAwaitable<
  const TAwaitables extends readonly Awaitable<unknown>[]
>(
  awaitables: TAwaitables,
  ms: number,
  error?: string | (() => unknown)
): {
  [K in keyof TAwaitables]: AwaitedOrSignalValue<TAwaitables[K]>;
};

/**
 * Adds timeout to a record of awaitables.
 * Throws TimeoutError if any awaitable doesn't resolve within the specified time.
 *
 * @param awaitables - Record of awaitables
 * @param ms - Timeout duration in milliseconds
 * @param error - Optional error message or error factory function
 * @returns Record with same keys and unwrapped values if all resolve within timeout
 *
 * @example
 * ```typescript
 * const data = wait.timeout({ user: userSignal, posts: postsSignal }, 5000);
 * ```
 */
function waitTimeoutAwaitable<
  const TAwaitables extends Record<string, Awaitable<unknown>>
>(
  awaitables: TAwaitables,
  ms: number,
  error?: string | (() => unknown)
): {
  [K in keyof TAwaitables]: AwaitedOrSignalValue<TAwaitables[K]>;
};

function waitTimeoutAwaitable(
  awaitableOrCollection: any,
  ms: number,
  error?: string | (() => unknown)
): any {
  // Handle array
  if (Array.isArray(awaitableOrCollection)) {
    const loadables = awaitableOrCollection.map(resolveAwaitable);
    const anyLoading = loadables.some((l) => l.status === "loading");

    if (!anyLoading) {
      return waitAll(awaitableOrCollection);
    }

    const promises = loadables.map((l) =>
      l.status === "loading"
        ? l.promise
        : l.status === "success"
        ? Promise.resolve(l.value)
        : Promise.reject(l.error)
    );

    const timeoutPromise = delayUtil(ms).then(() => {
      const err =
        typeof error === "function"
          ? error()
          : error
          ? new TimeoutError(error)
          : new TimeoutError();
      throw err;
    });

    throw Promise.race([Promise.all(promises), timeoutPromise]);
  }

  // Check if it's a plain object (record) vs a single awaitable
  // Single awaitables can be: function (signal), promise, or loadable
  const isSingleAwaitable =
    typeof awaitableOrCollection === "function" ||
    isPromiseLike(awaitableOrCollection) ||
    isLoadable(awaitableOrCollection);

  if (isSingleAwaitable) {
    // Handle single awaitable
    const loadableVal = resolveAwaitable(awaitableOrCollection);
    if (loadableVal.status !== "loading") {
      return waitAll(awaitableOrCollection);
    }

    // Create timeout promise
    const timeoutPromise = delayUtil(ms).then(() => {
      const err =
        typeof error === "function"
          ? error()
          : error
          ? new TimeoutError(error)
          : new TimeoutError();
      throw err;
    });

    // Race between the awaitable and timeout
    throw Promise.race([loadableVal.promise, timeoutPromise]);
  }

  // Handle object/record
  const entries = Object.entries(awaitableOrCollection);
  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable as Awaitable<unknown>),
  }));

  const anyLoading = loadables.some(
    ({ loadable: l }) => l.status === "loading"
  );

  if (!anyLoading) {
    const result: any = {};
    for (const { key, loadable } of loadables) {
      if (loadable.status === "error") {
        throw loadable.error;
      }
      result[key] = loadable.value;
    }
    return result;
  }

  const promises = loadables.map(({ loadable: l }) =>
    l.status === "loading"
      ? l.promise
      : l.status === "success"
      ? Promise.resolve(l.value)
      : Promise.reject(l.error)
  );

  const timeoutPromise = delayUtil(ms).then(() => {
    const err =
      typeof error === "function"
        ? error()
        : error
        ? new TimeoutError(error)
        : new TimeoutError();
    throw err;
  });

  throw Promise.race([
    Promise.all(promises).then(() => {
      const result: any = {};
      for (const { key } of loadables) {
        result[key] = waitAll(awaitableOrCollection[key]);
      }
      return result;
    }),
    timeoutPromise,
  ]);
}

export type WaitFallbackResult<T, F> =
  | [result: AwaitedOrSignalValue<T>, error: undefined]
  | [result: F, error: unknown];

/**
 * Executes a function and returns a tuple of [result, error].
 * If the function throws or returns a rejected promise, returns the fallback value.
 *
 * This is useful for error handling in reactive contexts where you want to provide
 * a default value instead of propagating errors.
 *
 * @param fn - The function to execute (can be sync or return a promise/signal)
 * @param fallback - The fallback value or factory function to use on error
 * @returns Tuple of [result, error] where error is undefined on success
 *
 * @example
 * ```typescript
 * // With async signal
 * const userSignal = asyncSignal(() => fetchUser(id));
 * const [user, error] = wait.fallback(
 *   () => userSignal,
 *   { name: 'Guest', id: 0 }
 * );
 *
 * // With promise
 * const [data, error] = wait.fallback(
 *   () => fetch('/api/data').then(r => r.json()),
 *   []
 * );
 *
 * // With fallback factory
 * const [result, error] = wait.fallback(
 *   () => riskyOperation(),
 *   () => computeDefaultValue()
 * );
 * ```
 */
function waitFallback<T, F>(
  fn: () => T,
  fallback: F | (() => F)
): WaitFallbackResult<T, F> {
  try {
    // Execute the function
    const result = fn();

    // If result is a loadable or promise, wait for it using waitAll
    // This will throw if the promise rejects or loadable contains an error
    if (isPromiseLike(result) || isLoadable(result)) {
      const awaitedResult = waitAll(result);
      return [awaitedResult, undefined] as const;
    }

    // Synchronous success - return result with no error
    return [result as AwaitedOrSignalValue<T>, undefined] as const;
  } catch (error) {
    // Error occurred (either sync throw or promise/loadable rejection caught by waitAll)
    // Compute fallback value (calling factory if needed)
    const fallbackResult =
      typeof fallback === "function"
        ? (fallback as () => F)()
        : (fallback as AwaitedOrSignalValue<F>);

    // Return fallback value with the error
    return [fallbackResult as F, error as unknown] as const;
  }
}

/**
 * Waits for a single awaitable until predicate returns true.
 * Re-throws the promise if predicate returns false.
 *
 * @param awaitable - The awaitable to wait for
 * @param predicate - Function that receives the unwrapped value and returns boolean
 * @returns The unwrapped value when predicate returns true
 *
 * @example
 * ```typescript
 * const count = signal(0);
 * const value = wait.until(count, (c) => c > 10);
 * ```
 */
function waitUntil<T>(
  awaitable: Awaitable<T>,
  predicate: (value: T) => boolean
): T;

/**
 * Waits for an array of awaitables until predicate returns true.
 * Re-throws if predicate returns false.
 *
 * @param awaitables - Array of awaitables
 * @param predicate - Function that receives unwrapped values as arguments
 * @returns Array of unwrapped values when predicate returns true
 *
 * @example
 * ```typescript
 * const [user, posts] = wait.until(
 *   [userSignal, postsSignal],
 *   (user, posts) => user.id > 0 && posts.length > 0
 * );
 * ```
 */
function waitUntil<const TAwaitables extends readonly Awaitable<unknown>[]>(
  awaitables: TAwaitables,
  predicate: (
    ...values: {
      [K in keyof TAwaitables]: AwaitedOrSignalValue<TAwaitables[K]>;
    }
  ) => boolean
): {
  [K in keyof TAwaitables]: AwaitedOrSignalValue<TAwaitables[K]>;
};

/**
 * Waits for a record of awaitables until predicate returns true.
 * Re-throws if predicate returns false.
 *
 * @param awaitables - Record of awaitables
 * @param predicate - Function that receives unwrapped values as record
 * @returns Record of unwrapped values when predicate returns true
 *
 * @example
 * ```typescript
 * const data = wait.until(
 *   { user: userSignal, posts: postsSignal },
 *   ({ user, posts }) => user.id > 0 && posts.length > 0
 * );
 * ```
 */
function waitUntil<
  const TAwaitables extends Record<string, Awaitable<unknown>>
>(
  awaitables: TAwaitables,
  predicate: (values: {
    [K in keyof TAwaitables]: AwaitedOrSignalValue<TAwaitables[K]>;
  }) => boolean
): {
  [K in keyof TAwaitables]: AwaitedOrSignalValue<TAwaitables[K]>;
};

function waitUntil(awaitableOrCollection: any, predicate: any): any {
  // Handle single awaitable
  if (
    !Array.isArray(awaitableOrCollection) &&
    (typeof awaitableOrCollection === "function" ||
      isPromiseLike(awaitableOrCollection) ||
      isLoadable(awaitableOrCollection))
  ) {
    const value = waitAll(awaitableOrCollection);
    if (!predicate(value)) {
      waitNever();
    }
    return value;
  }

  // Handle array
  if (Array.isArray(awaitableOrCollection)) {
    const values = waitAll(awaitableOrCollection);
    if (!predicate(...values)) {
      waitNever();
    }
    return values;
  }

  // Handle object/record
  const entries = Object.entries(awaitableOrCollection);
  const result: any = {};
  for (const [key, awaitable] of entries) {
    result[key] = waitAll(awaitable as any);
  }

  if (!predicate(result)) {
    waitNever();
  }
  return result;
}

/**
 * Timeout function for awaitables.
 */
function waitTimeout<T>(
  awaitable: Awaitable<T>,
  ms: number,
  error?: string | (() => unknown)
): T;
function waitTimeout<const TAwaitables extends readonly Awaitable<unknown>[]>(
  awaitables: TAwaitables,
  ms: number,
  error?: string | (() => unknown)
): {
  [K in keyof TAwaitables]: TAwaitables[K] extends Awaitable<infer T>
    ? T
    : never;
};
function waitTimeout<
  const TAwaitables extends Record<string, Awaitable<unknown>>
>(
  awaitables: TAwaitables,
  ms: number,
  error?: string | (() => unknown)
): {
  [K in keyof TAwaitables]: TAwaitables[K] extends Awaitable<infer T>
    ? T
    : never;
};
function waitTimeout(
  awaitableOrCollection: any,
  ms: number,
  error?: string | (() => unknown)
): any {
  return waitTimeoutAwaitable(awaitableOrCollection, ms, error);
}

/**
 * Main wait function with variants for different async coordination patterns.
 *
 * - `wait()` or `wait.all()` - Wait for all (default)
 * - `wait.any()` - Wait for first success
 * - `wait.race()` - Wait for first completion
 * - `wait.settled()` - Wait for all to settle (never throws)
 * - `wait.never()` - Wait indefinitely (never resolves)
 * - `wait.timeout()` - Add timeout to awaitable
 * - `wait.fallback()` - Provide fallback on error
 * - `wait.until()` - Wait until predicate is true
 *
 * @example
 * ```typescript
 * const data = signal.async(({ wait }) => {
 *   // Wait for all
 *   const [user, posts] = wait([userSig, postsSig]);
 *
 *   // First success
 *   const [data, source] = wait.any({ cache, api, backup });
 *
 *   // First complete
 *   const [result, fastest] = wait.race({ server1, server2 });
 *
 *   // All settled
 *   const results = wait.settled([sig1, sig2, sig3]);
 *
 *   // Never resolve (suspend indefinitely)
 *   wait.never();
 *
 *   // With timeout
 *   const user = wait.timeout(userSignal, 5000);
 *
 *   // With fallback - error handling with default values
 *   const [user, error] = wait.fallback(
 *     () => userSignal,
 *     { name: 'Guest', id: 0 }
 *   );
 *
 *   // Wait until condition is met
 *   const count = wait.until(counterSignal, c => c > 10);
 * });
 * ```
 */
export const wait = Object.assign(waitAll, {
  all: waitAll,
  any: waitAny,
  race: waitRace,
  settled: waitSettled,
  never: waitNever,
  timeout: waitTimeout,
  fallback: waitFallback,
  until: waitUntil,
});
