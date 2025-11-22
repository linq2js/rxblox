// TypeScript-only tests for the signal API.
// These are compile-time checks – they should not be imported at runtime.

import { signal } from "./signal";
import type {
  Signal,
  MutableSignal,
  ComputedSignal,
  SignalContext,
} from "./types";

// Utility to assert inferred types at compile time
function expectType<T>(_value: T): void {
  // no runtime behaviour
}

// ---------------------------------------------------------------------------
// Overload 1: signal() - no arguments, no initial value
// Special behavior: get() returns T | undefined, but set() requires T
// ---------------------------------------------------------------------------

const noArgSignal = signal();
expectType<MutableSignal<unknown, undefined>>(noArgSignal);
expectType<unknown | undefined>(noArgSignal());

// Example: signal with no initial value for typed data
interface TodoPayload {
  id: number;
  title: string;
}

const payload = signal<TodoPayload>();
expectType<MutableSignal<TodoPayload, undefined>>(payload);

// get() returns TodoPayload | undefined
expectType<TodoPayload | undefined>(payload());

// set() requires TodoPayload (not TodoPayload | undefined)
payload.set({ id: 1, title: "Buy milk" });
// @ts-expect-error - cannot set undefined
payload.set(undefined);

// ---------------------------------------------------------------------------
// Overload 2: signal(value) - with initial value
// ---------------------------------------------------------------------------

// Primitive values
const numberSignal = signal(42);
expectType<MutableSignal<number>>(numberSignal);
expectType<number>(numberSignal());

const stringSignal = signal("hello");
expectType<MutableSignal<string>>(stringSignal);
expectType<string>(stringSignal());

const booleanSignal = signal(true);
expectType<MutableSignal<boolean>>(booleanSignal);
expectType<boolean>(booleanSignal());

// Object values
const objectSignal = signal({ name: "Alice", age: 30 });
expectType<MutableSignal<{ name: string; age: number }>>(objectSignal);
expectType<{ name: string; age: number }>(objectSignal());

// Array values
const arraySignal = signal([1, 2, 3]);
expectType<MutableSignal<number[]>>(arraySignal);
expectType<number[]>(arraySignal());

// ---------------------------------------------------------------------------
// Overload 2: signal(lazyFn) - with lazy initializer
// ---------------------------------------------------------------------------

const lazySignal = signal((context: SignalContext) => {
  expectType<SignalContext>(context);
  expectType<AbortSignal>(context.abortSignal);
  context.cleanup(() => {});
  return 42;
});
expectType<MutableSignal<number>>(lazySignal);
expectType<number>(lazySignal());

// Lazy with complex return type
const lazyObjectSignal = signal(() => ({
  user: { id: 1, name: "Bob" },
  posts: [1, 2, 3],
}));
expectType<
  MutableSignal<{
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
expectType<MutableSignal<number>>(signalWithEquals);

const signalWithName = signal("test", {
  name: "testSignal",
});
expectType<MutableSignal<string>>(signalWithName);

const signalWithFallback = signal(0, {
  fallback: (error) => {
    expectType<unknown>(error);
    return -1;
  },
});
expectType<MutableSignal<number>>(signalWithFallback);

const signalWithCallbacks = signal(0, {
  onChange: (value) => {
    expectType<number>(value);
  },
  onError: (error) => {
    expectType<unknown>(error);
  },
});
expectType<MutableSignal<number>>(signalWithCallbacks);

// ---------------------------------------------------------------------------
// Overload 3: signal(deps, compute) - with dependencies
// ---------------------------------------------------------------------------

const count = signal(0);
const doubled = signal({ count }, (ctx) => {
  expectType<ComputedSignalContext<{ count: Signal<number> }>>(ctx);
  expectType<number>(ctx.deps.count);
  expectType<AbortSignal>(ctx.abortSignal);
  ctx.cleanup(() => {});
  return ctx.deps.count * 2;
});
expectType<ComputedSignal<number>>(doubled);
expectType<number>(doubled());

// Multiple dependencies
const firstName = signal("John");
const lastName = signal("Doe");
const fullName = signal({ firstName, lastName }, (ctx) => {
  return `${ctx.deps.firstName} ${ctx.deps.lastName}`;
});
expectType<ComputedSignal<string>>(fullName);
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
expectType<ComputedSignal<{ userName: string; postCount: number }>>(summary);
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
  onChange: (value) => {
    expectType<number>(value);
  },
});
expectType<ComputedSignal<number>>(computedWithOptions);

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
expectType<MutableSignal<number>>(a);
expectType<ComputedSignal<number>>(b);
expectType<ComputedSignal<number>>(c);
expectType<number>(c());

// ---------------------------------------------------------------------------
// lazy option
// ---------------------------------------------------------------------------

// Lazy by default (no option)
const lazyDefault = signal(() => 42);
expectType<MutableSignal<number>>(lazyDefault);

// Explicit lazy: true
const lazyTrue = signal(() => 42, { lazy: true });
expectType<MutableSignal<number>>(lazyTrue);

// Eager evaluation with lazy: false
const eager = signal(() => 42, { lazy: false });
expectType<MutableSignal<number>>(eager);

// Lazy option with dependencies
const eagerDerived = signal({ count }, (ctx) => ctx.deps.count * 2, {
  lazy: false,
});
expectType<ComputedSignal<number>>(eagerDerived);

// Lazy option with other options
const eagerWithOptions = signal(() => 42, {
  lazy: false,
  name: "mySignal",
  equals: (a, b) => a === b,
});
expectType<MutableSignal<number>>(eagerWithOptions);

// ---------------------------------------------------------------------------
// toJSON method
// ---------------------------------------------------------------------------

// toJSON returns the signal value type
expectType<number>(count.toJSON());
expectType<string>(name.toJSON());
expectType<User>(user.toJSON());
expectType<number[]>(numbers.toJSON());

// toJSON with optional signals
const optional = signal<string>();
expectType<string | undefined>(optional.toJSON());

// toJSON works with JSON.stringify
const countJson: string = JSON.stringify(count);
expectType<string>(countJson);
