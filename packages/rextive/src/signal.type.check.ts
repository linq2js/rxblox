// TypeScript-only tests for the signal API.
// These are compile-time checks – they should not be imported at runtime.

import { signal } from "./signal";
import type { Signal, SignalContext } from "./types";

// Utility to assert inferred types at compile time
function expectType<T>(_value: T): void {
  // no runtime behaviour
}

// ---------------------------------------------------------------------------
// Overload 1: signal() - no arguments
// ---------------------------------------------------------------------------

const noArgSignal = signal();
expectType<Signal<undefined | unknown>>(noArgSignal);
expectType<undefined | unknown>(noArgSignal());

// ---------------------------------------------------------------------------
// Overload 2: signal(value) - with initial value
// ---------------------------------------------------------------------------

// Primitive values
const numberSignal = signal(42);
expectType<Signal<number>>(numberSignal);
expectType<number>(numberSignal());

const stringSignal = signal("hello");
expectType<Signal<string>>(stringSignal);
expectType<string>(stringSignal());

const booleanSignal = signal(true);
expectType<Signal<boolean>>(booleanSignal);
expectType<boolean>(booleanSignal());

// Object values
const objectSignal = signal({ name: "Alice", age: 30 });
expectType<Signal<{ name: string; age: number }>>(objectSignal);
expectType<{ name: string; age: number }>(objectSignal());

// Array values
const arraySignal = signal([1, 2, 3]);
expectType<Signal<number[]>>(arraySignal);
expectType<number[]>(arraySignal());

// ---------------------------------------------------------------------------
// Overload 2: signal(lazyFn) - with lazy initializer
// ---------------------------------------------------------------------------

const lazySignal = signal((context: SignalContext) => {
  expectType<SignalContext>(context);
  return 42;
});
expectType<Signal<number>>(lazySignal);
expectType<number>(lazySignal());

// Lazy with complex return type
const lazyObjectSignal = signal(() => ({
  user: { id: 1, name: "Bob" },
  posts: [1, 2, 3],
}));
expectType<
  Signal<{
    user: { id: number; name: string };
    posts: number[];
  }>
>(lazyObjectSignal);

// ---------------------------------------------------------------------------
// Overload 2: signal(value, options) - with options
// ---------------------------------------------------------------------------

const signalWithEquals = signal(42, {
  equals: (a, b) => a === b,
});
expectType<Signal<number>>(signalWithEquals);

const signalWithName = signal("test", {
  name: "testSignal",
});
expectType<Signal<string>>(signalWithName);

const signalWithFallback = signal(0, {
  fallback: (error) => {
    expectType<unknown>(error);
    return -1;
  },
});
expectType<Signal<number>>(signalWithFallback);

const signalWithCallbacks = signal(0, {
  onInit: (sig) => {
    expectType<Signal<number>>(sig);
  },
  onChange: (value) => {
    expectType<number>(value);
  },
  onError: (error) => {
    expectType<unknown>(error);
  },
});
expectType<Signal<number>>(signalWithCallbacks);

// ---------------------------------------------------------------------------
// Overload 3: signal(deps, compute) - with dependencies
// ---------------------------------------------------------------------------

const count = signal(0);
const doubled = signal({ count }, (ctx) => {
  expectType<SignalContext<{ count: Signal<number> }>>(ctx);
  return ctx.deps.count * 2;
});
expectType<Signal<number>>(doubled);
expectType<number>(doubled());

// Multiple dependencies
const firstName = signal("John");
const lastName = signal("Doe");
const fullName = signal({ firstName, lastName }, (ctx) => {
  return `${ctx.deps.firstName} ${ctx.deps.lastName}`;
});
expectType<Signal<string>>(fullName);
expectType<string>(fullName());

// Dependencies with different types
const user = signal({ id: 1, name: "Alice" });
const posts = signal([1, 2, 3]);
const summary = signal({ user, posts }, (ctx) => {
  return {
    userName: ctx.deps.user.name,
    postCount: ctx.deps.posts.length,
  };
});
expectType<Signal<{ userName: string; postCount: number }>>(summary);
expectType<{ userName: string; postCount: number }>(summary());

// ---------------------------------------------------------------------------
// Overload 3: signal(deps, compute, options) - with dependencies and options
// ---------------------------------------------------------------------------

const computedWithOptions = signal({ count }, (ctx) => ctx.deps.count * 2, {
  name: "doubled",
  equals: (a, b) => a === b,
  fallback: (error) => {
    expectType<unknown>(error);
    return 0;
  },
  onInit: (sig) => {
    expectType<Signal<number>>(sig);
  },
  onChange: (value) => {
    expectType<number>(value);
  },
});
expectType<Signal<number>>(computedWithOptions);

// ---------------------------------------------------------------------------
// Signal methods type checking
// ---------------------------------------------------------------------------

const testSignal = signal(42);

// get() method
expectType<number>(testSignal.get());

// set() method
testSignal.set(100);
testSignal.set((current) => current + 1);

// on() method
const unsubscribe = testSignal.on(() => {
  console.log("changed");
});
expectType<() => void>(unsubscribe);

// dispose() method
testSignal.dispose();

// setIfUnchanged() method
const optimisticSet = testSignal.setIfUnchanged();
expectType<(value: number) => boolean>(optimisticSet);
const didSet = optimisticSet(50);
expectType<boolean>(didSet);

// reset() method
testSignal.reset();

// displayName
expectType<string | undefined>(testSignal.displayName);

// ---------------------------------------------------------------------------
// Signal context features
// ---------------------------------------------------------------------------

void signal({ count }, (ctx) => {
  // Access abort signal
  expectType<AbortSignal>(ctx.abortSignal);

  // Use in fetch
  fetch("/api/data", { signal: ctx.abortSignal });

  return ctx.deps.count * 2;
});

// ---------------------------------------------------------------------------
// Edge cases and complex scenarios
// ---------------------------------------------------------------------------

// Union types
const unionSignal = signal<string | number>(42);
expectType<Signal<string | number>>(unionSignal);
unionSignal.set("hello");
unionSignal.set(100);

// Optional types
const optionalSignal = signal<string | undefined>(undefined);
expectType<Signal<string | undefined>>(optionalSignal);
optionalSignal.set("hello");
optionalSignal.set(undefined);

// Nullable types
const nullableSignal = signal<string | null>(null);
expectType<Signal<string | null>>(nullableSignal);
nullableSignal.set("hello");
nullableSignal.set(null);

// Generic types
interface User<T> {
  id: T;
  name: string;
}

const genericSignal = signal<User<number>>({ id: 1, name: "Alice" });
expectType<Signal<User<number>>>(genericSignal);
expectType<User<number>>(genericSignal());

// Computed signal with async dependencies (returns promise-like)
const asyncData = signal({ count }, (ctx) => {
  return Promise.resolve(ctx.deps.count * 2);
});
expectType<Signal<Promise<number>>>(asyncData);

// Nested signal dependencies
const a = signal(1);
const b = signal({ a }, (ctx) => ctx.deps.a * 2);
const c = signal({ b }, (ctx) => ctx.deps.b * 2);
expectType<Signal<number>>(a);
expectType<Signal<number>>(b);
expectType<Signal<number>>(c);
expectType<number>(c());
