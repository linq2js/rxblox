/**
 * wait.ts
 *
 * This module provides a small "wait" DSL for coordinating async work in two modes:
 *
 * - **Suspense mode (sync)**: `wait(...)`, `wait.any(...)`, `wait.race(...)`, `wait.settled(...)`
 *   without callbacks are synchronous helpers that:
 *   - Return plain values (or tuples/records/settled-shapes)
 *   - Throw Promises while pending so they work with React Suspense
 *   - Throw errors when underlying awaitables fail
 *
 * - **Promise mode (async)**: when you pass `onResolve` and optionally `onError`,
 *   the helpers return a Promise and run your callbacks. These Promises are also
 *   registered with the loadable cache (via `toLoadable`) so their status can be
 *   observed through the normal `Loadable` API without awaiting them.
 *
 * `wait.timeout` and `wait.delay` are Promise-only utilities with no callback overloads.
 */
import type { Loadable, Signal } from "./types";
import { toLoadable } from "./utils/loadable";
import { isPromiseLike } from "./utils/isPromiseLike";

/**
 * Represents a value that can be awaited by wait().
 *
 * - A Loadable<T>
 * - A PromiseLike<T>
 * - A Signal holding either PromiseLike<T> or Loadable<T>
 */
export type Awaitable<T> =
  | Loadable<T>
  | PromiseLike<T>
  | Signal<PromiseLike<T> | Loadable<T>>;

/**
 * Extract the resolved value type from a single Awaitable.
 */
export type AwaitedFromAwaitable<A> = A extends Loadable<infer T>
  ? T
  : A extends PromiseLike<infer T>
  ? T
  : A extends Signal<PromiseLike<infer T> | Loadable<infer T>>
  ? T
  : never;

/**
 * Resolved values for tuple/array of awaitables.
 */
export type AwaitedFromTuple<TAwaitables extends readonly Awaitable<any>[]> = {
  [K in keyof TAwaitables]: AwaitedFromAwaitable<TAwaitables[K]>;
};

/**
 * Resolved values for record of awaitables.
 */
export type AwaitedFromRecord<
  TAwaitables extends Record<string, Awaitable<any>>
> = {
  [K in keyof TAwaitables]: AwaitedFromAwaitable<TAwaitables[K]>;
};

/**
 * Result type for waitAny / waitRace over record of awaitables.
 * Produces a [value, key] tuple for whichever entry wins.
 */
export type AwaitedKeyedResult<
  TAwaitables extends Record<string, Awaitable<any>>
> = {
  [K in keyof TAwaitables]: [AwaitedFromAwaitable<TAwaitables[K]>, K];
}[keyof TAwaitables];

/**
 * Local runtime check for signals (functions).
 *
 * We treat any function value as a Signal here – at the call sites in this file
 * we only ever pass known `Signal` instances, so this is safe and avoids importing
 * the heavier `isSignal` helper from the main module.
 */
function isSignal(value: unknown): value is Signal<unknown> {
  return typeof value === "function";
}

/**
 * Checks if a value should be treated as a "single" awaitable
 * (vs an object/record of awaitables).
 */
function isSingleAwaitable(value: unknown): boolean {
  return typeof value === "function" || isPromiseLike(value);
}

/**
 * Resolves an awaitable to a Loadable representation.
 *
 * - Signal -> call to get underlying value
 * - Value -> normalized via toLoadable()
 */
function resolveAwaitable(awaitable: Awaitable<any>): Loadable<any> {
  let value: unknown = awaitable;

  // If it's a signal, call it to get the underlying value
  if (isSignal(value)) {
    value = (value as Signal<unknown>)();
  }

  return toLoadable(value);
}

/**
 * Synchronous "wait all" for a single awaitable.
 * Throws promise while loading, or error, or returns value.
 */
function waitAllSyncSingle<T>(awaitable: Awaitable<T>): T {
  const l = resolveAwaitable(awaitable);

  if (l.status === "loading") {
    throw l.promise;
  }

  if (l.status === "error") {
    throw l.error;
  }

  return l.value as T;
}

/**
 * Synchronous "wait all" for an array/tuple of awaitables.
 * Throws promise while any is loading, or first error, or returns values.
 */
function waitAllSyncArray<const TAwaitables extends readonly Awaitable<any>[]>(
  awaitables: TAwaitables
): AwaitedFromTuple<TAwaitables> {
  const loadables = awaitables.map(resolveAwaitable);

  // If any are loading, throw a combined promise
  const loading = loadables.find((l) => l.status === "loading");
  if (loading) {
    const promises = loadables.map((l) =>
      l.status === "loading" ? l.promise : Promise.resolve(l.value)
    );
    throw Promise.all(promises);
  }

  // If any errored, throw the first error
  const errored = loadables.find((l) => l.status === "error");
  if (errored) {
    throw errored.error;
  }

  // All succeeded
  return loadables.map((l) => l.value) as AwaitedFromTuple<TAwaitables>;
}

/**
 * Synchronous "wait all" for a record of awaitables.
 * Throws promise while any is loading, or first error, or returns record.
 */
function waitAllSyncRecord<
  const TAwaitables extends Record<string, Awaitable<any>>
>(awaitables: TAwaitables): AwaitedFromRecord<TAwaitables> {
  const entries = Object.entries(awaitables) as [string, Awaitable<unknown>][];

  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  const loading = loadables.find(({ loadable: l }) => l.status === "loading");
  if (loading) {
    const promises = loadables.map(({ loadable: l }) =>
      l.status === "loading" ? l.promise : Promise.resolve(l.value)
    );
    throw Promise.all(promises);
  }

  const errored = loadables.find(({ loadable: l }) => l.status === "error");
  if (errored) {
    throw errored.loadable.error;
  }

  const result: any = {};
  for (const { key, loadable: l } of loadables) {
    result[key] = l.value;
  }

  return result as AwaitedFromRecord<TAwaitables>;
}

/**
 * Async "wait all" for a single awaitable.
 */
async function waitAllAsyncSingle<T, R, E>(
  awaitable: Awaitable<T>,
  onResolve?: (value: T) => R | PromiseLike<R>,
  onError?: (error: unknown) => E | PromiseLike<E>
): Promise<R | E | T> {
  const l = resolveAwaitable(awaitable);

  const runResolve = async (value: T) => {
    if (!onResolve) return value;
    return await onResolve(value);
  };

  try {
    if (l.status === "loading") {
      const value = (await l.promise) as T;
      return await runResolve(value);
    }

    if (l.status === "error") {
      throw l.error;
    }

    return await runResolve(l.value as T);
  } catch (error) {
    if (!onError) {
      throw error;
    }
    return await onError(error);
  }
}

/**
 * Async "wait all" for an array/tuple of awaitables.
 */
async function waitAllAsyncArray<
  const TAwaitables extends readonly Awaitable<any>[],
  R,
  E
>(
  awaitables: TAwaitables,
  onResolve?: (...values: AwaitedFromTuple<TAwaitables>) => R | PromiseLike<R>,
  onError?: (error: unknown) => E | PromiseLike<E>
): Promise<R | E | AwaitedFromTuple<TAwaitables>> {
  const loadables = awaitables.map(resolveAwaitable);

  const promises = loadables.map((l) =>
    l.status === "loading"
      ? l.promise
      : l.status === "success"
      ? Promise.resolve(l.value)
      : Promise.reject(l.error)
  );

  const runResolve = async (values: AwaitedFromTuple<TAwaitables>) => {
    if (!onResolve) return values;
    return await onResolve(...values);
  };

  try {
    const values = (await Promise.all(
      promises
    )) as AwaitedFromTuple<TAwaitables>;
    return await runResolve(values);
  } catch (error) {
    if (!onError) {
      throw error;
    }
    return await onError(error);
  }
}

/**
 * Async "wait all" for a record of awaitables.
 */
async function waitAllAsyncRecord<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R,
  E
>(
  awaitables: TAwaitables,
  onResolve?: (values: AwaitedFromRecord<TAwaitables>) => R | PromiseLike<R>,
  onError?: (error: unknown) => E | PromiseLike<E>
): Promise<R | E | AwaitedFromRecord<TAwaitables>> {
  const entries = Object.entries(awaitables) as [string, Awaitable<unknown>][];

  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  const promises = loadables.map(({ loadable: l }) =>
    l.status === "loading"
      ? l.promise
      : l.status === "success"
      ? Promise.resolve(l.value)
      : Promise.reject(l.error)
  );

  const runResolve = async (values: AwaitedFromRecord<TAwaitables>) => {
    if (!onResolve) return values;
    return await onResolve(values);
  };

  try {
    const resolved = await Promise.all(promises);
    const result: any = {};
    resolved.forEach((value, index) => {
      const { key } = loadables[index];
      result[key] = value;
    });
    return await runResolve(result as AwaitedFromRecord<TAwaitables>);
  } catch (error) {
    if (!onError) {
      throw error;
    }
    return await onError(error);
  }
}

/**
 * Overloads
 *
 * 1) Synchronous:
 *    wait(awaitable);           // T
 *    wait(tuple);               // [...values]
 *    wait(record);              // { ...values }
 *
 * 2) Async with onResolve:
 *    wait(awaitable, onResolve);        // Promise<Awaited<R>>
 *    wait(tuple, onResolve);            // Promise<Awaited<R>>
 *    wait(record, onResolve);           // Promise<Awaited<R>>
 *
 * 3) Async with onResolve + onError:
 *    wait(awaitable, onResolve, onError);  // Promise<Awaited<R | E>>
 *    wait(tuple, onResolve, onError);      // Promise<Awaited<R | E>>
 *    wait(record, onResolve, onError);     // Promise<Awaited<R | E>>
 */

// 1) Synchronous overloads
export function waitAll<T>(awaitable: Awaitable<T>): T;

export function waitAll<const TAwaitables extends readonly Awaitable<any>[]>(
  awaitables: TAwaitables
): AwaitedFromTuple<TAwaitables>;

export function waitAll<
  const TAwaitables extends Record<string, Awaitable<any>>
>(awaitables: TAwaitables): AwaitedFromRecord<TAwaitables>;

// 2) Async with onResolve
export function waitAll<T, R>(
  awaitable: Awaitable<T>,
  onResolve: (value: T) => R | PromiseLike<R>
): Promise<Awaited<R>>;

export function waitAll<const TAwaitables extends readonly Awaitable<any>[], R>(
  awaitables: TAwaitables,
  onResolve: (...values: AwaitedFromTuple<TAwaitables>) => R | PromiseLike<R>
): Promise<Awaited<R>>;

export function waitAll<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R
>(
  awaitables: TAwaitables,
  onResolve: (values: AwaitedFromRecord<TAwaitables>) => R | PromiseLike<R>
): Promise<Awaited<R>>;

// 3) Async with onResolve + onError
export function waitAll<T, R, E>(
  awaitable: Awaitable<T>,
  onResolve: (value: T) => R | PromiseLike<R>,
  onError: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>>;

export function waitAll<
  const TAwaitables extends readonly Awaitable<any>[],
  R,
  E
>(
  awaitables: TAwaitables,
  onResolve: (...values: AwaitedFromTuple<TAwaitables>) => R | PromiseLike<R>,
  onError: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>>;

export function waitAll<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R,
  E
>(
  awaitables: TAwaitables,
  onResolve: (values: AwaitedFromRecord<TAwaitables>) => R | PromiseLike<R>,
  onError: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>>;

// Implementation
export function waitAll(
  awaitableOrCollection: any,
  onResolve?: any,
  onError?: any
): any {
  const hasOnResolve = typeof onResolve === "function";
  const hasOnError = typeof onError === "function";

  // Synchronous mode (no handlers)
  if (!hasOnResolve && !hasOnError) {
    if (Array.isArray(awaitableOrCollection)) {
      return waitAllSyncArray(awaitableOrCollection);
    }
    if (isSingleAwaitable(awaitableOrCollection)) {
      return waitAllSyncSingle(awaitableOrCollection);
    }
    return waitAllSyncRecord(awaitableOrCollection);
  }

  // Async mode (with onResolve / onError)
  if (Array.isArray(awaitableOrCollection)) {
    const promise = waitAllAsyncArray(
      awaitableOrCollection,
      onResolve,
      hasOnError ? onError : undefined
    );
    toLoadable(promise);
    return promise;
  }

  if (isSingleAwaitable(awaitableOrCollection)) {
    const promise = waitAllAsyncSingle(
      awaitableOrCollection,
      onResolve,
      hasOnError ? onError : undefined
    );
    toLoadable(promise);
    return promise;
  }

  const promise = waitAllAsyncRecord(
    awaitableOrCollection,
    onResolve,
    hasOnError ? onError : undefined
  );
  toLoadable(promise);
  return promise;
}

/**
 * Synchronous core for waitAny.
 * Throws promise while loading, or aggregated error if all fail.
 */
function waitAnySync<const TAwaitables extends Record<string, Awaitable<any>>>(
  awaitables: TAwaitables
): AwaitedKeyedResult<TAwaitables> {
  const entries = Object.entries(awaitables) as [string, Awaitable<unknown>][];

  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  // Check if any succeeded immediately
  const succeeded = loadables.find(({ loadable: l }) => l.status === "success");
  if (succeeded) {
    return [
      succeeded.loadable.value,
      succeeded.key,
    ] as AwaitedKeyedResult<TAwaitables>;
  }

  // Check if all failed
  const allFailed = loadables.every(({ loadable: l }) => l.status === "error");
  if (allFailed) {
    const errors = loadables.map(({ loadable: l }) => l.error);
    const error = new Error("All awaitables failed");
    (error as any).errors = errors;
    throw error;
  }

  // Some are still loading - create Promise.any equivalent and throw it
  const promises = loadables.map(({ key, loadable: l }) =>
    l.status === "loading"
      ? l.promise.then<[unknown, string]>((data) => [data, key])
      : l.status === "success"
      ? Promise.resolve<[unknown, string]>([l.value, key])
      : Promise.reject(l.error)
  );

  const anyPromise = new Promise<[unknown, string]>((resolve, reject) => {
    let rejectionCount = 0;
    const rejections: any[] = [];

    promises.forEach((p, index) => {
      p.then(resolve, (error) => {
        rejections[index] = error;
        rejectionCount++;
        if (rejectionCount === promises.length) {
          const err = new Error("All awaitables failed");
          (err as any).errors = rejections;
          reject(err);
        }
      });
    });
  });

  throw anyPromise;
}

/**
 * Async helper for waitAny with onResolve/onError.
 */
async function waitAnyAsync<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R,
  E
>(
  awaitables: TAwaitables,
  onResolve?: (result: AwaitedKeyedResult<TAwaitables>) => R | PromiseLike<R>,
  onError?: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>> {
  const entries = Object.entries(awaitables) as [string, Awaitable<unknown>][];

  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  const promises = loadables.map(({ key, loadable: l }) =>
    l.status === "loading"
      ? l.promise.then<[unknown, string]>((data) => [data, key])
      : l.status === "success"
      ? Promise.resolve<[unknown, string]>([l.value, key])
      : Promise.reject(l.error)
  );

  try {
    const [value, key] = await new Promise<[unknown, string]>(
      (resolve, reject) => {
        let rejectionCount = 0;
        const rejections: any[] = [];

        promises.forEach((p, index) => {
          p.then(resolve, (error) => {
            rejections[index] = error;
            rejectionCount++;
            if (rejectionCount === promises.length) {
              const err = new Error("All awaitables failed");
              (err as any).errors = rejections;
              reject(err);
            }
          });
        });
      }
    );
    const result = [value, key] as AwaitedKeyedResult<TAwaitables>;
    return (
      onResolve ? await onResolve(result) : (result as unknown)
    ) as Awaited<R | E>;
  } catch (error) {
    if (!onError) throw error;
    return (await onError(error)) as Awaited<R | E>;
  }
}

/**
 * Overloads for waitAny:
 *
 * 1) Synchronous (no handlers): Suspense-style (throws promises/errors, returns [value, key])
 * 2) Async with onResolve / onError: Promise-based
 */
export function waitAny<
  const TAwaitables extends Record<string, Awaitable<any>>
>(awaitables: TAwaitables): AwaitedKeyedResult<TAwaitables>;
export function waitAny<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R
>(
  awaitables: TAwaitables,
  onResolve: (result: AwaitedKeyedResult<TAwaitables>) => R | PromiseLike<R>
): Promise<Awaited<R>>;
export function waitAny<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R,
  E
>(
  awaitables: TAwaitables,
  onResolve: (result: AwaitedKeyedResult<TAwaitables>) => R | PromiseLike<R>,
  onError: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>>;
export function waitAny(
  awaitables: Record<string, Awaitable<any>>,
  onResolve?: any,
  onError?: any
): any {
  const hasOnResolve = typeof onResolve === "function";
  const hasOnError = typeof onError === "function";

  if (!hasOnResolve && !hasOnError) {
    // Synchronous Suspense-style
    return waitAnySync(awaitables);
  }

  const promise = waitAnyAsync(
    awaitables,
    onResolve,
    hasOnError ? onError : undefined
  );
  // Track this Promise in the loadable cache so its state is observable
  toLoadable(promise);
  return promise;
}

/**
 * Synchronous core for waitRace.
 * Throws promise while loading, or error for first failed completion.
 */
function waitRaceSync<const TAwaitables extends Record<string, Awaitable<any>>>(
  awaitables: TAwaitables
): AwaitedKeyedResult<TAwaitables> {
  const entries = Object.entries(awaitables) as [string, Awaitable<unknown>][];

  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  // Check if any already completed
  const completed = loadables.find(
    ({ loadable: l }) => l.status === "success" || l.status === "error"
  );

  if (completed) {
    if (completed.loadable.status === "error") {
      throw completed.loadable.error;
    }
    return [
      completed.loadable.value,
      completed.key,
    ] as AwaitedKeyedResult<TAwaitables>;
  }

  // All still loading - throw Promise.race of underlying promises
  const promises = loadables.map(({ key, loadable: l }) =>
    l.promise.then<[unknown, string]>(
      (data) => [data, key],
      (error) => Promise.reject(error)
    )
  );
  throw Promise.race(promises);
}

/**
 * Async helper for waitRace with onResolve/onError.
 */
async function waitRaceAsync<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R,
  E
>(
  awaitables: TAwaitables,
  onResolve?: (result: AwaitedKeyedResult<TAwaitables>) => R | PromiseLike<R>,
  onError?: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>> {
  const entries = Object.entries(awaitables) as [string, Awaitable<unknown>][];

  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  const promises = loadables.map(({ key, loadable: l }) =>
    l.status === "loading"
      ? l.promise.then<[unknown, string]>((data) => [data, key])
      : l.status === "success"
      ? Promise.resolve<[unknown, string]>([l.value, key])
      : Promise.reject(l.error)
  );

  try {
    const [value, key] = await Promise.race(promises);
    const result = [value, key] as AwaitedKeyedResult<TAwaitables>;
    return (
      onResolve ? await onResolve(result) : (result as unknown)
    ) as Awaited<R | E>;
  } catch (error) {
    if (!onError) throw error;
    return (await onError(error)) as Awaited<R | E>;
  }
}

/**
 * Overloads for waitRace:
 *
 * 1) Synchronous (no handlers): Suspense-style (throws promises/errors, returns [value, key])
 * 2) Async with onResolve / onError: Promise-based
 */
export function waitRace<
  const TAwaitables extends Record<string, Awaitable<any>>
>(awaitables: TAwaitables): AwaitedKeyedResult<TAwaitables>;
export function waitRace<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R
>(
  awaitables: TAwaitables,
  onResolve: (result: AwaitedKeyedResult<TAwaitables>) => R | PromiseLike<R>
): Promise<Awaited<R>>;
export function waitRace<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R,
  E
>(
  awaitables: TAwaitables,
  onResolve: (result: AwaitedKeyedResult<TAwaitables>) => R | PromiseLike<R>,
  onError: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>>;
export function waitRace(
  awaitables: Record<string, Awaitable<any>>,
  onResolve?: any,
  onError?: any
): any {
  const hasOnResolve = typeof onResolve === "function";
  const hasOnError = typeof onError === "function";

  if (!hasOnResolve && !hasOnError) {
    // Synchronous Suspense-style
    return waitRaceSync(awaitables);
  }

  const promise = waitRaceAsync(
    awaitables,
    onResolve,
    hasOnError ? onError : undefined
  );
  toLoadable(promise);
  return promise;
}

/**
 * Synchronous core for waitSettled.
 * Returns PromiseSettledResult shapes, but uses promise-throwing when still loading.
 */
function waitSettledSync(awaitable: Awaitable<any>): PromiseSettledResult<any>;
function waitSettledSync<const TAwaitables extends readonly Awaitable<any>[]>(
  awaitables: TAwaitables
): {
  [K in keyof TAwaitables]: PromiseSettledResult<
    AwaitedFromAwaitable<TAwaitables[K]>
  >;
};
function waitSettledSync<
  const TAwaitables extends Record<string, Awaitable<any>>
>(
  awaitables: TAwaitables
): {
  [K in keyof TAwaitables]: PromiseSettledResult<
    AwaitedFromAwaitable<TAwaitables[K]>
  >;
};
function waitSettledSync(awaitableOrCollection: any): any {
  // Single awaitable
  if (
    !Array.isArray(awaitableOrCollection) &&
    isSingleAwaitable(awaitableOrCollection)
  ) {
    const l = resolveAwaitable(awaitableOrCollection);
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

  // Array of awaitables
  if (Array.isArray(awaitableOrCollection)) {
    const loadables = awaitableOrCollection.map(resolveAwaitable);

    const anyLoading = loadables.some((l) => l.status === "loading");
    if (anyLoading) {
      const promises = loadables.map((l) =>
        l.status === "loading"
          ? l.promise
          : l.status === "success"
          ? Promise.resolve(l.value)
          : Promise.reject(l.error)
      );

      throw Promise.all(
        promises.map((p) =>
          p.then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason })
          )
        )
      );
    }

    // All settled
    return loadables.map((l) =>
      l.status === "success"
        ? { status: "fulfilled" as const, value: l.value }
        : { status: "rejected" as const, reason: l.error }
    );
  }

  // Record of awaitables
  const entries = Object.entries(awaitableOrCollection) as [
    string,
    Awaitable<unknown>
  ][];
  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  const anyLoading = loadables.some(
    ({ loadable: l }) => l.status === "loading"
  );

  if (anyLoading) {
    const promises = loadables.map(({ loadable: l }) =>
      l.status === "loading"
        ? l.promise
        : l.status === "success"
        ? Promise.resolve(l.value)
        : Promise.reject(l.error)
    );

    throw Promise.all(
      promises.map((p) =>
        p.then(
          (value) => ({ status: "fulfilled" as const, value }),
          (reason) => ({ status: "rejected" as const, reason })
        )
      )
    );
  }

  const result: any = {};
  loadables.forEach(({ key, loadable: l }) => {
    result[key] =
      l.status === "success"
        ? { status: "fulfilled" as const, value: l.value }
        : { status: "rejected" as const, reason: l.error };
  });
  return result;
}

/**
 * Async helper for waitSettled that always resolves (never throws).
 */
async function waitSettledAsync(
  awaitable: Awaitable<any>
): Promise<PromiseSettledResult<any>>;
async function waitSettledAsync<
  const TAwaitables extends readonly Awaitable<any>[]
>(
  awaitables: TAwaitables
): Promise<{
  [K in keyof TAwaitables]: PromiseSettledResult<
    AwaitedFromAwaitable<TAwaitables[K]>
  >;
}>;
async function waitSettledAsync<
  const TAwaitables extends Record<string, Awaitable<any>>
>(
  awaitables: TAwaitables
): Promise<{
  [K in keyof TAwaitables]: PromiseSettledResult<
    AwaitedFromAwaitable<TAwaitables[K]>
  >;
}>;
async function waitSettledAsync(awaitableOrCollection: any): Promise<any> {
  // Single
  if (
    !Array.isArray(awaitableOrCollection) &&
    isSingleAwaitable(awaitableOrCollection)
  ) {
    const l = resolveAwaitable(awaitableOrCollection);
    if (l.status === "loading") {
      try {
        const value = await l.promise;
        return { status: "fulfilled" as const, value };
      } catch (reason) {
        return { status: "rejected" as const, reason };
      }
    }
    if (l.status === "error") {
      return { status: "rejected" as const, reason: l.error };
    }
    return { status: "fulfilled" as const, value: l.value };
  }

  // Array
  if (Array.isArray(awaitableOrCollection)) {
    const loadables = awaitableOrCollection.map(resolveAwaitable);
    const promises = loadables.map((l) =>
      l.status === "loading"
        ? l.promise
        : l.status === "success"
        ? Promise.resolve(l.value)
        : Promise.reject(l.error)
    );

    const results = await Promise.all(
      promises.map((p) =>
        p.then(
          (value) => ({ status: "fulfilled" as const, value }),
          (reason) => ({ status: "rejected" as const, reason })
        )
      )
    );
    return results;
  }

  // Record
  const entries = Object.entries(awaitableOrCollection) as [
    string,
    Awaitable<unknown>
  ][];
  const loadables = entries.map(([key, awaitable]) => ({
    key,
    loadable: resolveAwaitable(awaitable),
  }));

  const promises = loadables.map(({ loadable: l }) =>
    l.status === "loading"
      ? l.promise
      : l.status === "success"
      ? Promise.resolve(l.value)
      : Promise.reject(l.error)
  );

  const settled = await Promise.all(
    promises.map((p) =>
      p.then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason })
      )
    )
  );

  const result: any = {};
  settled.forEach((entry, index) => {
    const { key } = loadables[index];
    result[key] = entry;
  });
  return result;
}

/**
 * Overloads for waitSettled:
 *
 * 1) Synchronous (no handlers): Suspense-style (throws promises/errors, returns settled shapes)
 * 2) Async (with onResolve/onError): Promise-based
 */
export function waitSettled(
  awaitable: Awaitable<any>
): PromiseSettledResult<any>;
export function waitSettled<
  const TAwaitables extends readonly Awaitable<any>[]
>(
  awaitables: TAwaitables
): {
  [K in keyof TAwaitables]: PromiseSettledResult<
    AwaitedFromAwaitable<TAwaitables[K]>
  >;
};
export function waitSettled<
  const TAwaitables extends Record<string, Awaitable<any>>
>(
  awaitables: TAwaitables
): {
  [K in keyof TAwaitables]: PromiseSettledResult<
    AwaitedFromAwaitable<TAwaitables[K]>
  >;
};
export function waitSettled<R, E = never>(
  awaitable: Awaitable<any>,
  onResolve: (result: PromiseSettledResult<any>) => R | PromiseLike<R>,
  onError?: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>>;
export function waitSettled<
  const TAwaitables extends readonly Awaitable<any>[],
  R,
  E = never
>(
  awaitables: TAwaitables,
  onResolve: (result: {
    [K in keyof TAwaitables]: PromiseSettledResult<
      AwaitedFromAwaitable<TAwaitables[K]>
    >;
  }) => R | PromiseLike<R>,
  onError?: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>>;
export function waitSettled<
  const TAwaitables extends Record<string, Awaitable<any>>,
  R,
  E = never
>(
  awaitables: TAwaitables,
  onResolve: (result: {
    [K in keyof TAwaitables]: PromiseSettledResult<
      AwaitedFromAwaitable<TAwaitables[K]>
    >;
  }) => R | PromiseLike<R>,
  onError?: (error: unknown) => E | PromiseLike<E>
): Promise<Awaited<R | E>>;
export function waitSettled(
  awaitableOrCollection: any,
  onResolve?: any,
  onError?: any
): any {
  const hasOnResolve = typeof onResolve === "function";
  const hasOnError = typeof onError === "function";

  if (!hasOnResolve && !hasOnError) {
    // Synchronous Suspense-style
    return waitSettledSync(awaitableOrCollection);
  }

  const promise = waitSettledAsync(awaitableOrCollection)
    .then((result) => (onResolve ? onResolve(result) : result))
    .catch((error) => {
      if (!onError) throw error;
      return onError(error);
    });
  toLoadable(promise);
  return promise;
}

/**
 * Waits for awaitables with a timeout. Resolves with the same shape as waitAll,
 * or rejects with a TimeoutError when the timeout elapses first.
 */
export class TimeoutError extends Error {
  constructor(message: string = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function waitTimeout<T>(
  awaitable: Awaitable<T>,
  ms: number,
  error?: string | (() => unknown)
): Promise<T>;
export function waitTimeout<
  const TAwaitables extends readonly Awaitable<any>[]
>(
  awaitables: TAwaitables,
  ms: number,
  error?: string | (() => unknown)
): Promise<AwaitedFromTuple<TAwaitables>>;
export function waitTimeout<
  const TAwaitables extends Record<string, Awaitable<any>>
>(
  awaitables: TAwaitables,
  ms: number,
  error?: string | (() => unknown)
): Promise<AwaitedFromRecord<TAwaitables>>;
export function waitTimeout(
  awaitableOrCollection: any,
  ms: number,
  error?: string | (() => unknown)
): Promise<any> {
  const makeTimeoutError = () => {
    const err =
      typeof error === "function"
        ? error()
        : error
        ? new TimeoutError(error)
        : new TimeoutError();
    return err;
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(makeTimeoutError());
    }, ms);
  });

  let mainPromise: Promise<any>;

  if (Array.isArray(awaitableOrCollection)) {
    mainPromise = waitAllAsyncArray(
      awaitableOrCollection,
      undefined,
      undefined
    );
  } else if (isSingleAwaitable(awaitableOrCollection)) {
    mainPromise = waitAllAsyncSingle(
      awaitableOrCollection,
      undefined,
      undefined
    );
  } else {
    mainPromise = waitAllAsyncRecord(
      awaitableOrCollection,
      undefined,
      undefined
    );
  }

  const promise = Promise.race([mainPromise, timeoutPromise]);
  toLoadable(promise);
  return promise;
}

/**
 * Simple delay helper. Returns a Promise that resolves after the given duration.
 */
export function waitDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Exported wait API:
 *
 * - wait() is the primary entry point (alias of waitAll)
 * - wait.all, wait.any, wait.race, wait.settled, wait.timeout, wait.delay
 *   provide Promise-based helpers for common coordination patterns
 */
export const wait = Object.assign(waitAll, {
  all: waitAll,
  any: waitAny,
  race: waitRace,
  settled: waitSettled,
  timeout: waitTimeout,
  delay: waitDelay,
});
