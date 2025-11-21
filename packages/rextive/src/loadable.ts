import { isPromiseLike } from "./isPromiseLike";
import {
  LOADABLE_TYPE,
  type LoadableStatus,
  type LoadingLoadable,
  type SuccessLoadable,
  type ErrorLoadable,
  type Loadable,
} from "./types";

// Re-export types for backward compatibility
export { LOADABLE_TYPE };
export type {
  LoadableStatus,
  LoadingLoadable,
  SuccessLoadable,
  ErrorLoadable,
  Loadable,
};

/**
 * Creates a loading loadable from a promise.
 *
 * @param promise - The promise representing the ongoing operation
 * @returns A LoadingLoadable wrapping the promise
 *
 * @example
 * ```typescript
 * const userPromise = fetchUser(1);
 * const loading = loadable("loading", userPromise);
 * // { status: "loading", promise: userPromise, data: undefined, error: undefined, loading: true }
 * ```
 */
export function loadable<TValue>(
  status: "loading",
  promise: PromiseLike<TValue>
): LoadingLoadable<TValue>;

/**
 * Creates a success loadable with data and the resolved promise.
 *
 * @template TValue - The type of the successful result
 * @param status - Must be "success"
 * @param value - The successful result data
 * @param promise - The resolved promise (optional, will create one if not provided)
 * @returns A SuccessLoadable containing the data
 *
 * @example
 * ```typescript
 * const user = { id: 1, name: "Alice" };
 * const success = loadable("success", user);
 * // { status: "success", promise: Promise.resolve(user), data: user, error: undefined, loading: false }
 * ```
 */
export function loadable<TValue>(
  status: "success",
  value: TValue,
  promise?: PromiseLike<TValue>
): SuccessLoadable<TValue>;

/**
 * Creates an error loadable with error information.
 *
 * @param status - Must be "error"
 * @param error - The error that occurred
 * @param promise - The rejected promise (optional, will create one if not provided)
 * @returns An ErrorLoadable containing the error
 *
 * @example
 * ```typescript
 * const err = new Error("User not found");
 * const error = loadable("error", err);
 * // { status: "error", promise: Promise.reject(err), data: undefined, error: err, loading: false }
 * ```
 */
export function loadable<TValue>(
  status: "error",
  error: unknown,
  promise?: PromiseLike<TValue>
): ErrorLoadable<TValue>;

/**
 * Internal implementation of the loadable factory function.
 * Use the typed overloads above for type-safe loadable creation.
 */
export function loadable(
  status: LoadableStatus,
  dataOrError?: unknown,
  promise?: PromiseLike<unknown>
): Loadable<any> {
  if (status === "loading") {
    if (!promise && isPromiseLike(dataOrError)) {
      promise = dataOrError as PromiseLike<unknown>;
    }

    if (!promise) {
      throw new Error("Loading loadable requires a promise");
    }
    return {
      [LOADABLE_TYPE]: true,
      status: "loading",
      promise,
      value: undefined,
      error: undefined,
      loading: true,
    };
  }

  if (status === "success") {
    const data = dataOrError;
    const resolvedPromise = promise || Promise.resolve(data);
    return {
      [LOADABLE_TYPE]: true,
      status: "success",
      promise: resolvedPromise,
      value: data,
      error: undefined,
      loading: false,
    };
  }

  if (status === "error") {
    const error = dataOrError;
    const rejectedPromise = promise || Promise.reject(error);
    if (rejectedPromise instanceof Promise) {
      // Prevent unhandled rejection warnings
      rejectedPromise.catch(() => {});
    }
    return {
      [LOADABLE_TYPE]: true,
      status: "error",
      promise: rejectedPromise,
      value: undefined,
      error,
      loading: false,
    };
  }

  throw new Error(`Invalid loadable status: ${status}`);
}

/**
 * Type guard to check if a value is a Loadable.
 *
 * This function performs runtime type checking using the LOADABLE_TYPE symbol,
 * which is more reliable than duck typing on the shape of the object.
 *
 * @template T - The expected data type of the loadable
 * @param value - The value to check
 * @returns True if value is a Loadable, false otherwise
 *
 * @example
 * ```typescript
 * const value: unknown = getAsyncData();
 *
 * if (isLoadable(value)) {
 *   // TypeScript knows value is Loadable<unknown>
 *   switch (value.status) {
 *     case "loading":
 *       console.log("Loading...");
 *       break;
 *     case "success":
 *       console.log("Data:", value.value);
 *       break;
 *     case "error":
 *       console.error("Error:", value.error);
 *       break;
 *   }
 * }
 * ```
 */
export function isLoadable<T = unknown>(value: unknown): value is Loadable<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    LOADABLE_TYPE in value &&
    (value as any)[LOADABLE_TYPE] === true
  );
}

/**
 * Cache for tracking promise states across calls.
 * Maps promises to their loadable representations.
 */
const promiseCache = new WeakMap<PromiseLike<unknown>, Loadable<unknown>>();

/**
 * Associates a loadable with a promise in the cache.
 * Used internally to track promise states.
 *
 * @param promise - The promise to cache
 * @param l - The loadable to associate with the promise
 * @returns The loadable that was cached
 *
 * @example
 * ```typescript
 * const promise = fetchUser(1);
 * const l = loadable("loading", promise);
 * setLoadable(promise, l);
 * ```
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
 *
 * @example
 * ```typescript
 * const promise = fetchUser(1);
 * const l = getLoadable(promise);
 *
 * // First call creates loading loadable
 * console.log(l.status); // "loading"
 *
 * // Promise resolves, cache is updated
 * await promise;
 *
 * // Second call returns cached success loadable
 * const l2 = getLoadable(promise);
 * console.log(l2.status); // "success"
 * ```
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
