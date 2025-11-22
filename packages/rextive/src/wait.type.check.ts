// TypeScript-only tests for the wait API.
// These are compile-time checks – they should not be imported at runtime.

import { wait, type Awaitable } from "./wait";
import type { Loadable, Signal } from "./types";

// Utility to assert inferred types at compile time
function expectType<T>(_value: T): void {
  // no runtime behaviour
}

// ---------------------------------------------------------------------------
// Helpers: generic awaitables
// ---------------------------------------------------------------------------

declare const loadableNumber: Loadable<number>;
declare const loadableString: Loadable<string>;

declare const promiseNumber: Promise<number>;
declare const promiseString: Promise<string>;

declare const signalNumberAwaitable: Signal<Promise<number> | Loadable<number>>;
declare const signalStringAwaitable: Signal<Promise<string> | Loadable<string>>;

const awaitableNumber: Awaitable<number> =
  loadableNumber ?? promiseNumber ?? signalNumberAwaitable;
const awaitableString: Awaitable<string> =
  loadableString ?? promiseString ?? signalStringAwaitable;

// ---------------------------------------------------------------------------
// wait / wait.all – Suspense-style (no callbacks)
// ---------------------------------------------------------------------------

// Tuple form
const tupleResult = wait([awaitableNumber, awaitableString]);
expectType<readonly [number, string]>(tupleResult);

// Record form
const recordResult = wait({
  num: awaitableNumber,
  str: awaitableString,
});
expectType<{ num: number; str: string }>(recordResult);

// Single awaitable
const singleResult = wait(awaitableNumber);
expectType<number>(singleResult);

// ---------------------------------------------------------------------------
// wait / wait.all – Promise mode (with callbacks)
// ---------------------------------------------------------------------------

// Tuple with onResolve
const tuplePromise = wait(
  [awaitableNumber, awaitableString],
  (n, s) => `${n}:${s}`
);
expectType<Promise<string>>(tuplePromise);

// Tuple with onResolve + onError
const tuplePromiseWithError = wait(
  [awaitableNumber, awaitableString],
  (n, s) => `${n}:${s}`,
  (error) => (error instanceof Error ? error.message : "unknown")
);
expectType<Promise<string>>(tuplePromiseWithError);

// Record with onResolve
const recordPromise = wait(
  { num: awaitableNumber, str: awaitableString },
  (values) => values.num + values.str.length
);
expectType<Promise<number>>(recordPromise);

// ---------------------------------------------------------------------------
// wait.any
// ---------------------------------------------------------------------------

const anyResult = wait.any({
  num: awaitableNumber,
  str: awaitableString,
});
expectType<[number | string, "num" | "str"]>(anyResult);

const anyPromise = wait.any(
  { num: awaitableNumber, str: awaitableString },
  ([_value, key]) => key
);
expectType<Promise<"num" | "str">>(anyPromise);

const anyPromiseWithError = wait.any(
  { num: awaitableNumber, str: awaitableString },
  ([_value, key]) => key,
  (error) => (error instanceof Error ? error.message : "err")
);
expectType<Promise<"num" | "str" | string>>(anyPromiseWithError);

// ---------------------------------------------------------------------------
// wait.race
// ---------------------------------------------------------------------------

const raceResult = wait.race({
  num: awaitableNumber,
  str: awaitableString,
});
expectType<[number | string, "num" | "str"]>(raceResult);

const racePromise = wait.race(
  { num: awaitableNumber, str: awaitableString },
  ([value, key]) => ({ key, value })
);
expectType<Promise<{ key: "num" | "str"; value: number | string }>>(
  racePromise
);

// ---------------------------------------------------------------------------
// wait.settled
// ---------------------------------------------------------------------------

const settledTuple = wait.settled([awaitableNumber, awaitableString]);
expectType<
  readonly [PromiseSettledResult<number>, PromiseSettledResult<string>]
>(settledTuple);

const settledRecord = wait.settled({
  num: awaitableNumber,
  str: awaitableString,
});
expectType<{
  num: PromiseSettledResult<number>;
  str: PromiseSettledResult<string>;
}>(settledRecord);

const settledPromise = wait.settled(
  [awaitableNumber, awaitableString],
  (results) => results.map((r) => r.status)
);
expectType<Promise<("fulfilled" | "rejected")[]>>(settledPromise);

// ---------------------------------------------------------------------------
// wait.timeout & wait.delay
// ---------------------------------------------------------------------------

const timeoutSingle = wait.timeout(awaitableNumber, 1000);
expectType<Promise<number>>(timeoutSingle);

const timeoutTuple = wait.timeout([awaitableNumber, awaitableNumber], 1000);
expectType<Promise<readonly [number, number]>>(timeoutTuple);

const timeoutRecord = wait.timeout(
  { a: awaitableNumber, b: awaitableString },
  1000
);
expectType<Promise<{ a: number; b: string }>>(timeoutRecord);

const delayPromise = wait.delay(500);
expectType<Promise<void>>(delayPromise);
