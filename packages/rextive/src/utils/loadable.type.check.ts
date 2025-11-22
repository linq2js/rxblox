// TypeScript-only tests for the loadable API.
// These are compile-time checks – they should not be imported at runtime.

import {
  loadable,
  isLoadable,
  getLoadable,
  setLoadable,
  toLoadable,
} from "./loadable";
import type {
  Loadable,
  LoadingLoadable,
  SuccessLoadable,
  ErrorLoadable,
} from "../types";

// Utility to assert inferred types at compile time
function expectType<T>(_value: T): void {
  // no runtime behaviour
}

// ---------------------------------------------------------------------------
// Helper: declare some test promises
// ---------------------------------------------------------------------------

declare const promiseNumber: PromiseLike<number>;
declare const promiseString: PromiseLike<string>;
declare const promiseUser: PromiseLike<{ id: number; name: string }>;

// ---------------------------------------------------------------------------
// Overload 1: loadable("loading", promise) - LoadingLoadable
// ---------------------------------------------------------------------------

const loadingNumber = loadable("loading", promiseNumber);
expectType<LoadingLoadable<number>>(loadingNumber);
expectType<"loading">(loadingNumber.status);
expectType<PromiseLike<number>>(loadingNumber.promise);
expectType<undefined>(loadingNumber.value);
expectType<undefined>(loadingNumber.error);
expectType<true>(loadingNumber.loading);

const loadingString = loadable("loading", promiseString);
expectType<LoadingLoadable<string>>(loadingString);
expectType<"loading">(loadingString.status);
expectType<PromiseLike<string>>(loadingString.promise);

const loadingUser = loadable("loading", promiseUser);
expectType<LoadingLoadable<{ id: number; name: string }>>(loadingUser);
expectType<"loading">(loadingUser.status);
expectType<PromiseLike<{ id: number; name: string }>>(loadingUser.promise);

// ---------------------------------------------------------------------------
// Overload 2: loadable("success", value) - SuccessLoadable
// ---------------------------------------------------------------------------

const successNumber = loadable("success", 42);
expectType<SuccessLoadable<number>>(successNumber);
expectType<"success">(successNumber.status);
expectType<number>(successNumber.value);
expectType<undefined>(successNumber.error);
expectType<false>(successNumber.loading);
expectType<PromiseLike<number>>(successNumber.promise);

const successString = loadable("success", "hello");
expectType<SuccessLoadable<string>>(successString);
expectType<"success">(successString.status);
expectType<string>(successString.value);

const successUser = loadable("success", { id: 1, name: "Alice" });
expectType<SuccessLoadable<{ id: number; name: string }>>(successUser);
expectType<"success">(successUser.status);
expectType<{ id: number; name: string }>(successUser.value);

const successArray = loadable("success", [1, 2, 3]);
expectType<SuccessLoadable<number[]>>(successArray);
expectType<"success">(successArray.status);
expectType<number[]>(successArray.value);

// With explicit promise
const successWithPromise = loadable("success", 100, Promise.resolve(100));
expectType<SuccessLoadable<number>>(successWithPromise);
expectType<number>(successWithPromise.value);
expectType<PromiseLike<number>>(successWithPromise.promise);

// ---------------------------------------------------------------------------
// Overload 3: loadable("error", error) - ErrorLoadable
// ---------------------------------------------------------------------------

const errorWithError = loadable("error", new Error("Something failed"));
expectType<ErrorLoadable<unknown>>(errorWithError);
expectType<"error">(errorWithError.status);
expectType<unknown>(errorWithError.error);
expectType<undefined>(errorWithError.value);
expectType<false>(errorWithError.loading);
expectType<PromiseLike<unknown>>(errorWithError.promise);

const errorWithString = loadable("error", "Error message");
expectType<ErrorLoadable<unknown>>(errorWithString);
expectType<"error">(errorWithString.status);
expectType<unknown>(errorWithString.error);

const errorWithNumber = loadable("error", 404);
expectType<ErrorLoadable<unknown>>(errorWithNumber);
expectType<"error">(errorWithNumber.status);
expectType<unknown>(errorWithNumber.error);

// With explicit type parameter
const errorTyped = loadable<string>(
  "error",
  new Error("Failed to load string")
);
expectType<ErrorLoadable<string>>(errorTyped);
expectType<"error">(errorTyped.status);
expectType<unknown>(errorTyped.error);

// With explicit promise
const errorWithPromise = loadable<number>(
  "error",
  new Error("Failed"),
  Promise.reject(new Error("Failed"))
);
expectType<ErrorLoadable<number>>(errorWithPromise);
expectType<unknown>(errorWithPromise.error);
expectType<PromiseLike<number>>(errorWithPromise.promise);

// ---------------------------------------------------------------------------
// isLoadable() type guard
// ---------------------------------------------------------------------------

const unknownValue: unknown = { status: "success", value: 42 };

if (isLoadable(unknownValue)) {
  expectType<Loadable<unknown>>(unknownValue);
  expectType<"loading" | "success" | "error">(unknownValue.status);
}

// With type parameter
if (isLoadable<number>(unknownValue)) {
  expectType<Loadable<number>>(unknownValue);

  if (unknownValue.status === "success") {
    expectType<number>(unknownValue.value);
  }
}

// Narrowing within loadable
const maybeLoadable: unknown = successNumber;
if (isLoadable<string>(maybeLoadable)) {
  if (maybeLoadable.status === "success") {
    expectType<string>(maybeLoadable.value);
  }
  if (maybeLoadable.status === "loading") {
    expectType<PromiseLike<string>>(maybeLoadable.promise);
  }
  if (maybeLoadable.status === "error") {
    expectType<unknown>(maybeLoadable.error);
  }
}

// ---------------------------------------------------------------------------
// getLoadable() - Get or create loadable from promise
// ---------------------------------------------------------------------------

const getLoadNumber = getLoadable(promiseNumber);
expectType<Loadable<number>>(getLoadNumber);
// First call creates loading, subsequent calls may return success/error
expectType<"loading" | "success" | "error">(getLoadNumber.status);

const getLoadString = getLoadable(promiseString);
expectType<Loadable<string>>(getLoadString);

const getLoadUser = getLoadable(promiseUser);
expectType<Loadable<{ id: number; name: string }>>(getLoadUser);

// ---------------------------------------------------------------------------
// setLoadable() - Associate loadable with promise
// ---------------------------------------------------------------------------

const setLoad1 = setLoadable(promiseNumber, successNumber);
expectType<SuccessLoadable<number>>(setLoad1);

const setLoad2 = setLoadable(promiseString, loadingString);
expectType<LoadingLoadable<string>>(setLoad2);

const setLoad3 = setLoadable(
  promiseUser,
  loadable<{ id: number; name: string }>("error", new Error("Failed"))
);
expectType<ErrorLoadable<unknown>>(setLoad3);

// ---------------------------------------------------------------------------
// toLoadable() - Normalize any value to loadable
// ---------------------------------------------------------------------------

// From plain value
const toLoad1 = toLoadable(42);
expectType<Loadable<unknown>>(toLoad1);

const toLoad2 = toLoadable<number>(42);
expectType<Loadable<number>>(toLoad2);

// From promise
const toLoad3 = toLoadable(promiseNumber);
expectType<Loadable<unknown>>(toLoad3);

const toLoad4 = toLoadable<number>(promiseNumber);
expectType<Loadable<number>>(toLoad4);

// From existing loadable
const toLoad5 = toLoadable(successNumber);
expectType<Loadable<unknown>>(toLoad5);

const toLoad6 = toLoadable<number>(successNumber);
expectType<Loadable<number>>(toLoad6);

// From object
const toLoad7 = toLoadable({ id: 1, name: "Alice" });
expectType<Loadable<unknown>>(toLoad7);

const toLoad8 = toLoadable<{ id: number; name: string }>({
  id: 1,
  name: "Alice",
});
expectType<Loadable<{ id: number; name: string }>>(toLoad8);

// From null/undefined
const toLoad9 = toLoadable(null);
expectType<Loadable<unknown>>(toLoad9);

const toLoad10 = toLoadable(undefined);
expectType<Loadable<unknown>>(toLoad10);

// ---------------------------------------------------------------------------
// Status narrowing with discriminated union
// ---------------------------------------------------------------------------

const testLoadable: Loadable<number> = successNumber as any;

// Narrow by status
if (testLoadable.status === "loading") {
  expectType<LoadingLoadable<number>>(testLoadable);
  expectType<undefined>(testLoadable.value);
  expectType<undefined>(testLoadable.error);
  expectType<PromiseLike<number>>(testLoadable.promise);
  expectType<true>(testLoadable.loading);
} else if (testLoadable.status === "success") {
  expectType<SuccessLoadable<number>>(testLoadable);
  expectType<number>(testLoadable.value);
  expectType<undefined>(testLoadable.error);
  expectType<PromiseLike<number>>(testLoadable.promise);
  expectType<false>(testLoadable.loading);
} else if (testLoadable.status === "error") {
  expectType<ErrorLoadable<number>>(testLoadable);
  expectType<undefined>(testLoadable.value);
  expectType<unknown>(testLoadable.error);
  expectType<PromiseLike<number>>(testLoadable.promise);
  expectType<false>(testLoadable.loading);
}

// Switch statement
switch (testLoadable.status) {
  case "loading":
    expectType<LoadingLoadable<number>>(testLoadable);
    expectType<PromiseLike<number>>(testLoadable.promise);
    break;
  case "success":
    expectType<SuccessLoadable<number>>(testLoadable);
    expectType<number>(testLoadable.value);
    break;
  case "error":
    expectType<ErrorLoadable<number>>(testLoadable);
    expectType<unknown>(testLoadable.error);
    break;
}

// ---------------------------------------------------------------------------
// Complex scenarios
// ---------------------------------------------------------------------------

// Union types
const unionLoadable = loadable<string | number>("success", 42);
expectType<SuccessLoadable<string | number>>(unionLoadable);
expectType<string | number>(unionLoadable.value);

// Optional types
const optionalLoadable = loadable<string | undefined>("success", undefined);
expectType<SuccessLoadable<string | undefined>>(optionalLoadable);
expectType<string | undefined>(optionalLoadable.value);

// Nullable types
const nullableLoadable = loadable<string | null>("success", null);
expectType<SuccessLoadable<string | null>>(nullableLoadable);
expectType<string | null>(nullableLoadable.value);

// Generic types
interface Result<T> {
  data: T;
  timestamp: number;
}

const genericLoadable = loadable<Result<number>>("success", {
  data: 42,
  timestamp: Date.now(),
});
expectType<SuccessLoadable<Result<number>>>(genericLoadable);
expectType<Result<number>>(genericLoadable.value);

// Array of loadables
const loadableArray: Array<Loadable<number>> = [
  loadable("loading", promiseNumber),
  loadable("success", 42),
  loadable("error", new Error("Failed")),
];
expectType<Array<Loadable<number>>>(loadableArray);

// Map of loadables
const loadableMap: Record<string, Loadable<string>> = {
  a: loadable("success", "hello"),
  b: loadable("loading", promiseString),
  c: loadable("error", new Error("Failed")),
};
expectType<Record<string, Loadable<string>>>(loadableMap);

// Async function returning loadable
async function fetchData(): Promise<Loadable<number>> {
  const data = await promiseNumber;
  return loadable("success", data);
}

const asyncResult = fetchData();
expectType<PromiseLike<Loadable<number>>>(asyncResult);

// Helper function to map loadable values
function mapLoadable<T, U>(l: Loadable<T>, fn: (value: T) => U): Loadable<U> {
  if (l.status === "success") {
    return loadable("success", fn(l.value));
  }
  if (l.status === "loading") {
    return loadable("loading", l.promise.then(fn));
  }
  return loadable("error", l.error);
}

const mapped = mapLoadable(successNumber, (n) => n * 2);
expectType<Loadable<number>>(mapped);

// Helper to extract value or default
function getValueOr<T>(l: Loadable<T>, defaultValue: T): T {
  return l.status === "success" ? l.value : defaultValue;
}

const extracted = getValueOr(successNumber, 0);
expectType<number>(extracted);

// Chaining loadables
const chain1 = loadable("success", 5);
const chain2 = mapLoadable(chain1, (n) => n.toString());
expectType<Loadable<string>>(chain2);

// Error recovery
function recoverFromError<T>(l: Loadable<T>, recovery: T): SuccessLoadable<T> {
  if (l.status === "error") {
    return loadable("success", recovery);
  }
  if (l.status === "success") {
    return l;
  }
  // Loading state - need to handle somehow
  throw new Error("Cannot recover from loading state");
}

const recovered = recoverFromError(errorWithNumber as Loadable<number>, 0);
expectType<SuccessLoadable<number>>(recovered);
