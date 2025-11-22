// TypeScript-only tests for the rx API.
// These are compile-time checks – they should not be imported at runtime.

import { rx } from "./rx";
import type { Loadable, Signal } from "./types";
import type { ReactNode } from "react";

// Utility to assert inferred types at compile time
function expectType<T>(_value: T): void {
  // no runtime behaviour
}

// ---------------------------------------------------------------------------
// Test signals for use in examples
// ---------------------------------------------------------------------------

declare const count: Signal<number>;
declare const name: Signal<string>;
declare const user: Signal<{ id: number; name: string; email: string }>;
declare const posts: Signal<Array<{ id: number; title: string }>>;
declare const loading: Signal<Promise<string>>;

// ---------------------------------------------------------------------------
// Overload 1: rx(render) - Static render function
// ---------------------------------------------------------------------------

// Simple static render
const static1 = rx(() => <div>Hello</div>);
expectType<ReactNode>(static1);

// Static with JSX expression
const static2 = rx(() => {
  const message = "Hello World";
  return <div>{message}</div>;
});
expectType<ReactNode>(static2);

// Static returning null
const static3 = rx(() => null);
expectType<ReactNode>(static3);

// Static returning fragment
const static4 = rx(() => (
  <>
    <div>Line 1</div>
    <div>Line 2</div>
  </>
));
expectType<ReactNode>(static4);

// ---------------------------------------------------------------------------
// Overload 1: rx(render, options) - Static with options
// ---------------------------------------------------------------------------

// Static with watch dependencies
const staticWithWatch = rx(() => <div>Count: {5}</div>, {
  watch: [5],
});
expectType<ReactNode>(staticWithWatch);

// Static with multiple watch deps
const staticWithMultiWatch = rx(
  () => {
    const x = 10;
    const y = 20;
    return (
      <div>
        {x} + {y}
      </div>
    );
  },
  {
    watch: [10, 20],
  }
);
expectType<ReactNode>(staticWithMultiWatch);

// ---------------------------------------------------------------------------
// Overload 2: rx(signal) - Single signal shorthand
// ---------------------------------------------------------------------------

// Number signal
const singleNumber = rx(count);
expectType<ReactNode>(singleNumber);

// String signal
const singleString = rx(name);
expectType<ReactNode>(singleString);

// Object signal - should render the object value
const singleObject = rx(user);
expectType<ReactNode>(singleObject);

// Array signal
const singleArray = rx(posts);
expectType<ReactNode>(singleArray);

// ---------------------------------------------------------------------------
// Overload 2: rx(signal, options) - Single signal with options
// ---------------------------------------------------------------------------

// Single signal with watch
const singleWithWatch = rx(count, {
  watch: [5],
});
expectType<ReactNode>(singleWithWatch);

// ---------------------------------------------------------------------------
// Overload 3: rx(signals, render) - Multiple signals with awaited access
// ---------------------------------------------------------------------------

// Simple awaited access
const multi1 = rx({ count, name }, (awaited) => {
  expectType<{ count: number; name: string }>(awaited);
  return (
    <div>
      {awaited.count}: {awaited.name}
    </div>
  );
});
expectType<ReactNode>(multi1);

// Awaited with object signal
const multi2 = rx({ user }, (awaited) => {
  expectType<{ user: { id: number; name: string; email: string } }>(awaited);
  return (
    <div>
      <h1>{awaited.user.name}</h1>
      <p>{awaited.user.email}</p>
    </div>
  );
});
expectType<ReactNode>(multi2);

// Awaited with array signal
const multi3 = rx({ posts }, (awaited) => {
  expectType<{ posts: Array<{ id: number; title: string }> }>(awaited);
  return (
    <ul>
      {awaited.posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
});
expectType<ReactNode>(multi3);

// ---------------------------------------------------------------------------
// Overload 3: rx(signals, render) - Using loadable for manual control
// ---------------------------------------------------------------------------

// Loadable access for loading states
const withLoadable1 = rx({ count }, (_, loadable) => {
  expectType<{ count: Loadable<number> }>(loadable);

  if (loadable.count.status === "loading") {
    return <div>Loading...</div>;
  }

  if (loadable.count.status === "error") {
    return <div>Error: {String(loadable.count.error)}</div>;
  }

  return <div>Count: {loadable.count.value}</div>;
});
expectType<ReactNode>(withLoadable1);

// Loadable with promise signal
const withLoadable2 = rx({ loading }, (_, loadable) => {
  expectType<{
    loading: Loadable<string>;
  }>(loadable);

  if (loadable.loading.loading) {
    return <div>Loading...</div>;
  }

  return <div>{loadable.loading.value}</div>;
});
expectType<ReactNode>(withLoadable2);

// Using both awaited and loadable
const withBoth = rx({ count, name }, (awaited, loadable) => {
  expectType<{ count: number; name: string }>(awaited);
  expectType<{
    count: Loadable<number>;
    name: Loadable<string>;
  }>(loadable);

  // Use loadable for conditional rendering
  if (loadable.name.loading) {
    return <div>Loading name...</div>;
  }

  // Use awaited for direct value access (will suspend if needed)
  return (
    <div>
      Count: {awaited.count}, Name: {awaited.name}
    </div>
  );
});
expectType<ReactNode>(withBoth);

// ---------------------------------------------------------------------------
// Overload 3: rx(signals, render, options) - With watch dependencies
// ---------------------------------------------------------------------------

// With watch option
const withWatch1 = rx(
  { count, name },
  (awaited) => (
    <div>
      {awaited.count}: {awaited.name}
    </div>
  ),
  {
    watch: [],
  }
);
expectType<ReactNode>(withWatch1);

// With multiple watch deps
const withWatch2 = rx({ count }, (awaited) => <div>{awaited.count}</div>, {
  watch: ["some", "deps"],
});
expectType<ReactNode>(withWatch2);

// ---------------------------------------------------------------------------
// Complex scenarios
// ---------------------------------------------------------------------------

// Multiple signals of different types
const complex1 = rx(
  {
    count,
    name,
    user,
    posts,
  },
  (awaited) => {
    expectType<{
      count: number;
      name: string;
      user: { id: number; name: string; email: string };
      posts: Array<{ id: number; title: string }>;
    }>(awaited);

    return (
      <div>
        <h1>{awaited.user.name}</h1>
        <p>Count: {awaited.count}</p>
        <p>Name: {awaited.name}</p>
        <ul>
          {awaited.posts.map((post) => (
            <li key={post.id}>{post.title}</li>
          ))}
        </ul>
      </div>
    );
  }
);
expectType<ReactNode>(complex1);

// Nested JSX
const complex2 = rx({ user, posts }, (awaited) => {
  const renderPosts = () =>
    awaited.posts.map((post) => <li key={post.id}>{post.title}</li>);

  return (
    <div>
      <header>
        <h1>{awaited.user.name}</h1>
      </header>
      <main>
        <ul>{renderPosts()}</ul>
      </main>
    </div>
  );
});
expectType<ReactNode>(complex2);

// Conditional rendering with awaited
const conditional1 = rx({ count, name }, (awaited) => {
  if (awaited.count > 10) {
    return <div>High: {awaited.name}</div>;
  }
  return <div>Low: {awaited.name}</div>;
});
expectType<ReactNode>(conditional1);

// Conditional rendering with loadable
const conditional2 = rx({ user }, (awaited, loadable) => {
  if (loadable.user.status === "loading") {
    return <div>Loading user...</div>;
  }

  if (loadable.user.status === "error") {
    return <div>Error loading user</div>;
  }

  // Safe to use awaited here since we checked loadable
  return <div>Welcome, {awaited.user.name}!</div>;
});
expectType<ReactNode>(conditional2);

// Early return patterns
const earlyReturn = rx({ count }, (awaited, loadable) => {
  if (loadable.count.loading) return <div>Loading...</div>;
  if (loadable.count.status === "error") return <div>Error</div>;

  return <div>{awaited.count}</div>;
});
expectType<ReactNode>(earlyReturn);

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

// Empty signals object
const emptySignals = rx({}, (awaited) => {
  expectType<{}>(awaited);
  return <div>No signals</div>;
});
expectType<ReactNode>(emptySignals);

// Single signal in signals object
const singleInObject = rx({ count }, (awaited) => {
  expectType<{ count: number }>(awaited);
  return <div>{awaited.count}</div>;
});
expectType<ReactNode>(singleInObject);

// Returning various ReactNode types
const variousReturns1 = rx(() => "string");
expectType<ReactNode>(variousReturns1);

const variousReturns2 = rx(() => 123);
expectType<ReactNode>(variousReturns2);

const variousReturns3 = rx(() => true);
expectType<ReactNode>(variousReturns3);

const variousReturns4 = rx(() => [<div key="1">a</div>, <div key="2">b</div>]);
expectType<ReactNode>(variousReturns4);
