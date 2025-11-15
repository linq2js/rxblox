# 🎯 rxblox

**Fine-grained reactive state management for React.**  
Signals, computed values, and reactive components with zero boilerplate.

[![npm version](https://img.shields.io/npm/v/rxblox.svg)](https://www.npmjs.com/package/rxblox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why rxblox?

**React state management needs better tools.**

Traditional React re-renders entire component functions when state changes. You spend significant time managing `useCallback`, `useMemo`, and `useEffect` dependency arrays just to avoid unnecessary work. Component optimization often becomes a maintenance burden.

**rxblox** provides **fine-grained reactivity** - only the exact UI subtrees that depend on changed state re-execute. Component definition phases run once per mount. Reactive expressions (`rx()`) update independently. No manual dependency arrays. No Rules of Hooks limitations.

```tsx
// ❌ Traditional React - entire function body re-executes
function Counter() {
  const [count, setCount] = useState(0);
  console.log("Component function executed"); // Runs on EVERY state change
  return <div>{count}</div>;
}
```

```tsx
// ✅ rxblox - definition runs once, only rx() subtrees re-execute
import { signal, rx } from "rxblox";

const count = signal(0);

const Counter = blox(() => {
  console.log("Component mounted"); // Runs ONCE

  return (
    <div>
      {rx(count)} {/* only this part will update */}
      <HeavyComponent />
    </div>
  ); // Only this subtree re-executes on signal changes
});
```

### Key Benefits

- 🎯 **Fine-grained reactivity** - Subtree updates instead of full component re-execution
- 🚀 **Minimal boilerplate** - No actions, reducers, or centralized store configuration
- 🔄 **Computed values** - Automatic dependency tracking and memoization
- ⚡ **Performance optimizations** - Reduced reconciliation overhead for signal-driven updates
- 🎨 **Reactive components** - `blox()` components with definition-phase-once semantics
- 🔌 **Dependency injection** - Provider pattern with fine-grained subscriptions
- 🧹 **Automatic cleanup** - `blox` lifecycle manages subscriptions and effects
- 📦 **TypeScript first** - Full type inference and type safety
- 🪶 **Lightweight** - Small bundle footprint
- 🎪 **Flexible signal access** - Call signals conditionally, in loops, outside React render
- 🔀 **Async signals** - Built-in async state management with loading/success/error tracking
- 📊 **Loadable states** - Discriminated union types for async operation states

---

## 🔥 The Dependency Array Problem

The real pain? **Dependency arrays.**

Every React developer knows this hell:

```tsx
// The dependency array hell we all know too well
useEffect(() => {
  fetchData(userId, filters, sortBy);
}, [userId, filters, sortBy]); // ⚠️ ESLint warning: missing 'fetchData'

// Add fetchData, now it's infinite loop!
useEffect(() => {
  fetchData(userId, filters, sortBy);
}, [userId, filters, sortBy, fetchData]); // 🔥 Infinite re-renders!

// Wrap in useCallback... now fetchData needs dependencies
const fetchData = useCallback(
  (userId, filters, sortBy) => {
    // ...
  },
  [
    /* wait, what goes here? */
  ]
);

// Hours later... you have this monstrosity:
const fetchData = useCallback(
  (userId, filters, sortBy) => {
    // ...
  },
  [apiToken, config, retryCount]
); // And if ONE changes, everything breaks

useEffect(() => {
  fetchData(userId, filters, sortBy);
}, [userId, filters, sortBy, fetchData]);
```

**Every. Single. Time.**

You're not writing business logic. You're babysitting dependency arrays. You're debugging why `useEffect` fired 47 times. You're hunting down stale closures at 2 AM because you forgot to add one variable to a dependency array three functions deep.

State management shouldn't require a PhD in React optimization. You shouldn't need to memorize the Rules of Hooks. You shouldn't need a 10-line dependency chain just to fetch data. Your UI should just... _react_.

### The rxblox Solution

**Automatic dependency tracking. Zero arrays.**

Here's that same data fetching with rxblox:

```tsx
// No dependency arrays. No useCallback. No infinite loops. Just... works.
const userId = signal(1);
const filters = signal({ status: "active" });
const sortBy = signal("date");

const data = signal.async(async ({ track }) => {
  // Automatic dependency tracking - no arrays needed!
  const tracked = track({ userId, filters, sortBy });

  const response = await fetch(
    `/api/data?user=${tracked.userId}&filters=${JSON.stringify(
      tracked.filters
    )}&sort=${tracked.sortBy}`
  );
  return response.json();
});

// Changes automatically trigger re-fetch. Previous requests auto-canceled.
userId.set(2); // Just works. No dependency arrays. No stale closures. No bugs.
```

**What you get:**

- ❌ No `useCallback` - functions are stable by default
- ❌ No `useMemo` - computed signals handle it automatically
- ❌ No dependency arrays - automatic tracking "just works"
- ❌ Reduced function re-execution - only reactive expressions update
- ❌ No stale closures - signals always have the current value
- ❌ No Rules of Hooks - call signals anywhere, anytime

**Just reactive state that works the way you think.**

### Why This Matters

This isn't just about performance. It's about **developer experience**.

Every millisecond counts. Every re-render matters. Every line of boilerplate is time stolen from building features. With rxblox, you write what you mean and it just works.

- **Components run once** - Reduced function re-execution, no optimization needed
- **Dependencies auto-track** - No arrays, no stale closures, no bugs
- **Code is simple** - Write business logic, not React plumbing

Fine-grained reactivity isn't just a feature—it's the future. Solid.js proved it works. Preact Signals brought it to Preact. **rxblox brings the full power of fine-grained reactivity to React**, with first-class TypeScript support and zero dependencies.

Go home on time. Build features, not workarounds.

---

## Installation

```bash
npm install rxblox
# or
pnpm add rxblox
# or
yarn add rxblox
```

## Quick Start

```tsx
import { signal, rx } from "rxblox";

const count = signal(0);

function Counter() {
  return (
    <div>
      {/* Only this reactive expression updates when count changes */}
      <h1>Count: {rx(count)}</h1>

      <button onClick={() => count.set(count() + 1)}>Increment</button>
    </div>
  );
}
```

---

## Table of Contents

- [Why rxblox?](#why-rxblox)
- [The Dependency Array Problem](#-the-dependency-array-problem)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Signals](#1-signals---reactive-state-primitives)
  - [Computed Signals](#2-computed-signals---derived-state)
  - [Effects](#3-effects---side-effects-with-auto-tracking)
  - [Reactive Expressions](#4-reactive-expressions---rx)
  - [Reactive Components](#5-reactive-components---blox)
  - [Providers](#6-providers---dependency-injection)
  - [Async Signals](#7-async-signals---signalasync)
  - [Loadable States](#8-loadable-states)
  - [Wait Utilities](#9-wait-utilities)
  - [Actions](#10-actions)
- [Lifecycle & Cleanup](#lifecycle--cleanup)
- [Performance & Memory Considerations](#performance--memory-considerations)
- [Patterns & Best Practices](#patterns--best-practices)
  - [Common Patterns](#common-patterns)
  - [Organizing Signals](#organizing-signals)
  - [Composable Logic](#composable-logic)
- [Comparison with Other Solutions](#comparison-with-other-solutions)
- [API Reference](#api-reference)
- [Development](#development)
- [Contributing](#contributing)

---

## Core Concepts

### 1. Signals - Reactive State Primitives

Signals are reactive containers for values. They track subscribers and notify them when values change.

```tsx
import { signal } from "rxblox";

// Create a signal
const count = signal(0);

// Read the current value
const value = count(); // 0

// Update the value
count.set(10);

// Update with a function (immutable updates via immer)
count.set((prev) => prev + 1);

// Peek without tracking as dependency
const current = count.peek();

// Subscribe to changes
const unsubscribe = count.on((newValue) => {
  console.log("Count changed:", newValue);
});

// Cleanup
unsubscribe();
```

### 2. Computed Signals - Derived State

Computed signals automatically track dependencies and recompute when dependencies change.

```tsx
const firstName = signal("John");
const lastName = signal("Doe");

// Automatically recomputes when firstName or lastName changes
const fullName = signal(() => `${firstName()} ${lastName()}`);

console.log(fullName()); // "John Doe"

firstName.set("Jane");
console.log(fullName()); // "Jane Doe" - recomputed automatically
```

**Computed signals are lazy** - they only recompute when accessed and cache their result.

#### Explicit Dependency Tracking with `track()`

For conditional dependencies or more control, use the `track()` function:

```tsx
const condition = signal(true);
const a = signal(10);
const b = signal(20);

// Only tracks the signals you actually access
const result = signal(({ track }) => {
  const { condition: cond, a: valA, b: valB } = track({ condition, a, b });

  // Only tracks 'condition' + one of 'a' or 'b'
  return cond ? valA : valB;
});

console.log(result()); // 10

// Changing 'b' won't trigger recomputation (not accessed when condition is true)
b.set(30);
console.log(result()); // Still 10

// Changing 'a' will trigger recomputation
a.set(15);
console.log(result()); // 15
```

The `track()` function creates a proxy that lazily tracks only the signals you access, perfect for conditional dependencies!

### 3. Effects - Side Effects with Auto-Tracking

Effects run side effects when their signal dependencies change. They automatically track which signals they access.

```tsx
import { signal, effect } from "rxblox";

const count = signal(0);

effect(() => {
  console.log("Count is:", count());

  // Optional: return cleanup function
  return () => {
    console.log("Effect cleanup");
  };
});

count.set(5); // Logs: "Count is: 5"
```

### 4. Reactive Expressions - `rx()`

Use `rx()` to create reactive UI that updates when signals change, without re-rendering the parent component.

```tsx
import { signal, rx } from "rxblox";

const count = signal(0);
const doubled = signal(() => count() * 2);

function App() {
  // Function body executes once per mount
  console.log("App rendered");

  return (
    <div>
      {/* Only this updates when signals change */}
      {rx(() => (
        <div>
          <p>Count: {count()}</p>
          <p>Doubled: {doubled()}</p>
        </div>
      ))}
      <button onClick={() => count.set(count() + 1)}>+1</button>
    </div>
  );
}
```

**Shorthand for single signals:**

```tsx
// Full syntax
{
  rx(() => count());
}

// Shorthand (for single signals)
{
  rx(count);
}
```

### 5. Reactive Components - `blox()`

`blox()` creates reactive components where props become signals and effects are automatically managed.

#### Structure of a `blox` Component

A `blox` component has two distinct parts with different execution behavior:

```tsx
const Counter = blox<Props>((props, ref) => {
  // 🔵 DEFINITION PHASE: Runs once per mount (twice in Strict Mode)
  // - Create signals
  // - Set up effects
  // - Define event handlers
  // - Register cleanup with blox.onUnmount()
  const count = signal(0);

  effect(() => {
    console.log("Count:", count());
  });

  // 🟢 SHAPE PHASE: Returns static JSX that does not re-execute the component function
  // - Only rx() expressions update
  // - Event handlers work normally
  // - No re-execution of this JSX
  return (
    <div>
      {rx(count)} {/* Only this updates */}
      <button onClick={() => count.set(count() + 1)}>+</button>
    </div>
  );
});
```

**Key Insight**: The component body runs **once**, the returned JSX is **static**. Only `rx()` expressions re-execute when signals change.

#### Complete Example

```tsx
import { blox, signal, rx, effect } from "rxblox";

interface CounterProps {
  initialCount: number;
  label: string;
}

const Counter = blox<CounterProps>((props) => {
  // Runs once on mount
  console.log("Component initialized");

  // Local state as signal
  const count = signal(props.initialCount);

  // Effect with automatic cleanup
  effect(() => {
    if (count() === 10) {
      console.log("Reached 10!");
    }
  });

  // Props are automatically signals
  effect(() => {
    console.log("Label changed:", props.label);
  });

  // Static JSX structure - does not re-execute the component function
  return (
    <div>
      <h3>{props.label}</h3>
      {rx(() => (
        <div>Count: {count()}</div>
      ))}
      <button onClick={() => count.set(count() + 1)}>+</button>
    </div>
  );
});

// Use it
<Counter initialCount={0} label="My Counter" />;
```

**Key differences from regular React components:**

- **Definition phase runs once** - The component body executes only on mount, not on every prop change
- **Shape is static** - The returned JSX structure does not re-execute the component function
- **Props are signals** - `props.label` tracks the prop as a dependency when accessed
- **Only `rx()` updates** - Reactive expressions re-execute when dependencies change
- **Effects auto-cleanup** - Effects created inside are automatically cleaned up on unmount
- **Local signals persist** - Signals keep their state across prop changes

#### Why `blox` vs Traditional React?

Traditional React components require extensive use of hooks to optimize performance:

```tsx
// ❌ Traditional React - Hook Overload
function Counter({ label, onCountChange }) {
  const [count, setCount] = useState(0);

  // Need useCallback to prevent re-creating functions
  const increment = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  // Need useMemo to prevent re-computing
  const doubled = useMemo(() => count * 2, [count]);

  // Need useEffect for side effects
  useEffect(() => {
    onCountChange(count);
  }, [count, onCountChange]);

  // Need useRef for mutable values
  const renderCount = useRef(0);
  renderCount.current++;

  // Entire component re-renders on every state change
  console.log(`Rendered ${renderCount.current} times`);

  return (
    <div>
      <h3>{label}</h3>
      <div>Count: {count}</div>
      <div>Doubled: {doubled}</div>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

```tsx
// ✅ rxblox - Simple and Performant
const Counter = blox<{ label: string; onCountChange: (n: number) => void }>(
  (props) => {
    const count = signal(0);

    // No useCallback needed - functions never re-create
    const increment = () => count.set(count() + 1);

    // No useMemo needed - computed signals are automatic
    const doubled = signal(() => count() * 2);

    // No useEffect needed - effects are built-in
    effect(() => {
      props.onCountChange(count());
    });

    // No useRef needed - everything runs once
    console.log("Component initialized ONCE");

    // Static JSX structure - does not re-execute the component function
    return (
      <div>
        <h3>{props.label}</h3>
        {rx(() => (
          <>
            <div>Count: {count()}</div>
            <div>Doubled: {doubled()}</div>
          </>
        ))}
        <button onClick={increment}>+</button>
      </div>
    );
  }
);
```

**Benefits of `blox`:**

- 🚫 **No `useCallback`** - Functions are stable by default (component body runs once per mount (twice in Strict Mode during development))
- 🚫 **No `useMemo`** - Computed signals handle memoization automatically
- 🚫 **No `useEffect` complexity** - `effect()` is simpler with automatic cleanup
- 🚫 **No `useRef` for values** - Regular variables work fine (definition phase runs once)
- ⚡ **Fine-grained updates** - Only `rx()` expressions update, not the entire component
- 🎯 **Less re-renders** - Component body runs once per mount (twice in Strict Mode during development), JSX is static
- 📝 **Less code** - No need for dependency arrays, no stale closure issues
- 🧠 **Simpler mental model** - Reactive primitives instead of hook rules

#### Using React Hooks with `blox`

Since `blox` components only run their definition phase **once**, you can't use React hooks directly in the definition phase. Use the `blox.handle()` utility to capture hook results:

```tsx
import { blox, signal, rx } from "rxblox";
import { useHistory, useEffect, useState } from "react";

const Counter = blox<Props>((props) => {
  // 🔵 Definition phase - runs ONCE
  const count = signal(0);

  // ✅ CORRECT: Use blox.handle() to capture React hooks
  const router = blox.handle(() => {
    const history = useHistory();
    const location = useLocation();
    return { history, location };
  });

  // ❌ WRONG: Can't use hooks directly in definition phase
  // const history = useHistory(); // Error: hooks called outside render!

  const handleNavigate = () => {
    // Access hook results in event handlers
    router.current?.history.push("/next");
  };

  return (
    <div>
      {/* Access hook results in rx() expressions */}
      {rx(() => (
        <div>
          <div>Count: {count()}</div>
          <div>Path: {router.current?.location.pathname}</div>
        </div>
      ))}
      <button onClick={handleNavigate}>Navigate</button>
      <button onClick={() => count.set(count() + 1)}>+</button>
    </div>
  );
});
```

**Important Notes:**

- **Use `blox.handle()`** - The recommended way to capture React hook results
- **Access via `.current`** - Hook results available in `rx()` expressions and event handlers
- **Undefined in definition phase** - `blox.handle().current` is `undefined` during the definition phase
- **Runs on every render** - The callback passed to `blox.handle()` executes during React's render phase

**Alternative: Manual pattern with `blox.onRender()`:**

If you prefer more control, you can manually use `blox.onRender()`:

```tsx
const MyComponent = blox(() => {
  // Define variable in blox scope
  let someHookResult: SomeType | undefined;

  blox.onRender(() => {
    // Assign hook result to outer variable
    someHookResult = useSomeHook();
  });

  // Now you can use someHookResult in event handlers
  const handleClick = () => {
    console.log(someHookResult);
  };

  return <button onClick={handleClick}>Click</button>;
});
```

**When to use hooks in `blox`:**

- ✅ Integrating with React Router hooks (`useHistory`, `useParams`, `useLocation`)
- ✅ Using custom hooks from third-party libraries
- ✅ Calling React hooks like `useContext` to access React Context
- ❌ Not needed for rxblox's own `signal`, `effect` - use them directly in definition phase

### 6. Providers - Dependency Injection

Providers inject values

> **⚠️ Important: Provider Behavior**
>
> Components that call `withXXX()` to access provider values do NOT automatically re-render when the provider value changes. This is fundamentally different from React Context.
>
> **You must use `rx()` or `effect()` to react to provider value changes:**
>
> ```tsx
> // ❌ Won't update when theme changes
> const MyComponent = blox(() => {
>   const theme = withTheme();
>   return <div>{theme()}</div>;
> });
>
> // ✅ Correctly updates
> const MyComponent = blox(() => {
>   const theme = withTheme();
>   return rx(() => <div>{theme()}</div>);
> });
> ```
>
> Think of providers as dependency injection for signals, not as React Context replacements.

down the component tree without causing re-renders like React Context.

```tsx
import { useState } from "react";
import { provider, blox, rx } from "rxblox";

// Create provider (returns [withXXX, XXXProvider])
const [withTheme, ThemeProvider] = provider(
  "theme",
  "light" as "light" | "dark"
);

// Consumer component
const ThemeDisplay = blox(() => {
  const theme = withTheme(); // Returns Signal<"light" | "dark"> (read-only)

  // ⚠️ Component itself won't re-render when theme changes!
  // Only rx() or effect() will react to changes

  // ✅ Correct: Use rx() to make it reactive
  return rx(() => (
    <div
      style={{
        background: theme() === "light" ? "#fff" : "#333",
        color: theme() === "light" ? "#000" : "#fff",
      }}
    >
      Current theme: {theme()}
    </div>
  ));

  // ❌ Wrong: Component won't update
  // return <div>{theme()}</div>;
});

function App() {
  const [theme, setTheme] = useState("light");

  return (
    <ThemeProvider value={theme}>
      <ThemeDisplay />
      <button
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      >
        Toggle Theme
      </button>
    </ThemeProvider>
  );
}
```

**⚠️ Critical Differences from React Context:**

1. **No automatic re-renders**: The component using `withXXX()` does NOT re-render when the provider value changes
2. **Only `rx()` and `effect()` react**: You must explicitly wrap reactive code
3. **Returns signals**: `withTheme()` returns a signal, not the raw value
4. **Read-only for consumers**: Consumers get `Signal<T>` (without `.set()` or `.reset()`), only the Provider can change the value

Think of providers as **dependency injection for signals**, not React Context.

#### Passing Signals to Providers

**New Feature**: The Provider component now accepts `Signal<T>` directly as the `value` prop. This allows you to pass reactive signals to providers, and the provider will automatically subscribe and update consumers when the signal changes.

```tsx
import { signal, provider, blox, rx } from "rxblox";

const [withTheme, ThemeProvider] = provider(
  "theme",
  "light" as "light" | "dark"
);

const App = blox(() => {
  // Create a reactive signal for theme
  const theme = signal<"light" | "dark">("light");

  const toggleTheme = () => {
    theme.set(theme() === "light" ? "dark" : "light");
  };

  return (
    <div>
      <button onClick={toggleTheme}>Toggle Theme</button>

      {/* Pass signal directly to provider */}
      <ThemeProvider value={theme}>
        <ThemeDisplay />
      </ThemeProvider>
    </div>
  );
});

const ThemeDisplay = blox(() => {
  const theme = withTheme();

  return rx(() => <div>Current theme: {theme()}</div>);
});
```

**With Computed Signals:**

```tsx
const App = blox(() => {
  const isDark = signal(false);

  // Computed signal automatically updates when isDark changes
  const theme = signal(() => (isDark() ? "dark" : "light"));

  return (
    <div>
      <button onClick={() => isDark.set(!isDark())}>Toggle Mode</button>

      {/* Computed signal updates consumers automatically */}
      <ThemeProvider value={theme}>
        <ThemeDisplay />
      </ThemeProvider>
    </div>
  );
});
```

**Benefits:**

- ✅ **Reactive updates** - Consumers update automatically when source signal changes
- ✅ **Works with computed signals** - Pass derived values directly
- ✅ **Type-safe** - Full TypeScript support for `T | Signal<T>`
- ✅ **No manual subscription** - Provider handles signal subscription automatically
- ✅ **Automatic cleanup** - Signal subscription cleaned up on unmount

**Use Cases:**

- Sharing global signals across the component tree
- Providing computed/derived values to children
- Coordinating state between parent and deeply nested children
- Creating reactive themes, settings, or configuration

### 7. Async Signals - `signal.async()`

Async signals (`signal.async()`) manage asynchronous operations with automatic loading/success/error state tracking.

```tsx
import { signal } from "rxblox";

const userId = signal(1);

// Create an async signal that fetches user data
const user = signal.async(async ({ track, abortSignal }) => {
  // Use track() to explicitly track signal dependencies
  const tracked = track({ userId });

  const response = await fetch(`/api/users/${tracked.userId}`, {
    signal: abortSignal, // Automatic cancellation
  });

  return response.json();
});

// The async signal returns a Loadable
function UserProfile() {
  return rx(() => {
    const loadable = user();

    if (loadable.status === "loading") {
      return <div>Loading...</div>;
    }

    if (loadable.status === "error") {
      return <div>Error: {loadable.error.message}</div>;
    }

    // loadable.status === "success"
    return <div>User: {loadable.value.name}</div>;
  });
}

// Changing userId automatically triggers re-fetch (previous request aborted)
userId.set(2);
```

**Key Features:**

- 📊 **Loadable return type** - Returns `Loadable<T>` with `status`, `value`, `error`, `promise`, `loading`
- 🔄 **Automatic re-fetch** - Re-runs when tracked signals change
- 🚫 **Auto-cancellation** - Previous requests aborted via `AbortSignal`
- ⚡ **Promise caching** - Efficient state management
- 🎯 **Lazy evaluation** - Only starts when first accessed
- ✨ **Explicit tracking** - Use `track()` to track signals even after `await`

#### Dependency Tracking in Async Signals

There are two ways to track signal dependencies:

```tsx
// ✅ Method 1: Use track() for explicit tracking (RECOMMENDED)
const data = signal.async(async ({ track }) => {
  const tracked = track({ userId, filter });

  // Can await before accessing signals!
  await delay(10);

  return fetchData(tracked.userId, tracked.filter);
});

// ✅ Method 2: Implicit tracking (before await only)
const data = signal.async(async () => {
  const id = userId(); // Tracked implicitly

  // Must access signals BEFORE any await
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});

// ❌ WRONG: Implicit tracking after await doesn't work
const data = signal.async(async () => {
  await delay(10);
  return userId(); // NOT TRACKED - use track() instead!
});
```

**Best Practice:** Use `track()` for maximum flexibility and clarity.

#### The `track()` Method - Lazy Tracking for Async Contexts

The `track()` method provides **lazy, fine-grained dependency tracking** that works seamlessly in async contexts. It's available in:

- `signal.async(async ({ track }) => ...)` - Async signal contexts
- `effect(({ track }) => ...)` - Effect contexts

**How it works:**

1. Pass an object where values are **functions** (signals or computed properties)
2. `track()` returns a **lazy proxy** that doesn't track anything yet
3. When you access a property, the proxy executes the function with the dispatcher context
4. This ensures tracking happens at **access time**, maintaining the tracking context even after `await`

##### Basic Usage

```tsx
// In signal.async
const userId = signal(1);
const filter = signal("active");

const data = signal.async(async ({ track }) => {
  // Create tracked proxy - no tracking happens yet
  const tracked = track({ userId, filter });

  // Before await - tracking works
  const id = tracked.userId; // ✅ userId is now tracked

  await delay(100);

  // After await - tracking STILL works!
  const filterValue = tracked.filter; // ✅ filter is now tracked

  return fetchData(id, filterValue);
});
```

##### Tracking Props in `blox` Components

A powerful use case is tracking `blox` component props in async contexts:

```tsx
const UserProfile = blox<{ userId: number; status: string }>((props) => {
  const userData = signal.async(async ({ track }) => {
    // Track props as dependencies
    const tracked = track({
      userId: props.userId,
      status: props.status,
    });

    // Can await before accessing props
    await delay(100);

    // Still tracks correctly after await!
    return fetchUser(tracked.userId, tracked.status);
  });

  return rx(() => {
    const { status, value } = userData();
    if (status === "loading") return <div>Loading...</div>;
    return <div>{value.name}</div>;
  });
});

// Changing props triggers re-fetch automatically
<UserProfile userId={1} status="active" />;
```

##### Custom Computed Properties

You can pass custom functions for computed tracking:

```tsx
// Create signals at module/component scope
const count = signal(5);
const multiplier = signal(2);

const data = signal.async(async ({ track }) => {
  const tracked = track({
    count, // Direct signal
    doubled: () => count() * 2, // Custom computed
    tripled: () => count() * 3, // Another computed
    multiplied: () => count() * multiplier(), // Uses multiple signals
  });

  await delay(10);

  // Access computed properties after await
  return {
    doubled: tracked.doubled, // Tracks count
    multiplied: tracked.multiplied, // Tracks count AND multiplier
  };
});
```

##### Conditional Tracking (Lazy Benefits)

The proxy is **lazy** - it only tracks signals when you actually access them:

```tsx
// Create signals at module/component scope
const isLoggedIn = signal(true);
const userId = signal(123);
const adminData = signal({ role: "admin" });

effect(({ track }) => {
  const tracked = track({ isLoggedIn, userId, adminData });

  // Only track isLoggedIn
  if (tracked.isLoggedIn) {
    // Now also track userId
    console.log("User:", tracked.userId);

    // adminData is NEVER tracked because never accessed
  }
});
```

##### Best Practices for `track()`

**✅ DO: Use conditional access for fine-grained tracking**

```tsx
const tracked = track({ condition, data, error });

if (tracked.condition) {
  // Only track what you need
  const { data, error } = tracked;
}
```

**❌ DON'T: Destructure immediately (tracks everything)**

```tsx
const tracked = track({ a, b, c });
const { a, b, c } = tracked; // Tracks all signals immediately
```

**✅ DO: Pass signals as-is or use arrow functions**

```tsx
const tracked = track({
  userId: props.userId, // Direct signal
  fullName: () => `${firstName()} ${lastName()}`, // Computed
});
```

**❌ DON'T: Pass non-function values**

```tsx
const tracked = track({
  userId: props.userId,
  constant: 123, // ❌ ERROR: Must be a function
});
```

##### Tracking in Regular Effects

`track()` is also available in regular `effect()` calls:

```tsx
const count = signal(0);
const name = signal("Alice");

effect(({ track }) => {
  const tracked = track({ count, name });

  async function doAsync() {
    // Before await
    const c = tracked.count; // ✅ Tracked

    await delay(100);

    // After await - still works
    const n = tracked.name; // ✅ Tracked
    console.log(`${n}: ${c}`);
  }

  doAsync();
});
```

##### Why Use `track()` Over Implicit Tracking?

| Feature | `track()` | Implicit Tracking |
| --- | --- | --- |
| **Works after await** | ✅ Yes | ❌ No |
| **Conditional tracking** | ✅ Yes (lazy proxy) | ⚠️ Limited |
| **Custom computed** | ✅ Yes | ❌ No |
| **Type safety** | ✅ Full inference | ✅ Full inference |
| **Clarity** | ✅ Explicit intent | ⚠️ Can be unclear |

**Use `track()` when:**

- Your function has `await` statements
- You want conditional dependency tracking
- You need to track props from `blox` components
- You want explicit, clear intent about what's tracked

**Use implicit tracking when:**

- Your function is fully synchronous
- You access all signals before any async operations
- You want the simplest possible code

### 8. Loadable States

Loadable is a discriminated union type representing the state of an asynchronous operation.

```tsx
type Loadable<T> =
  | {
      status: "loading";
      value: undefined;
      error: undefined;
      loading: true;
      promise: Promise<T>;
    }
  | {
      status: "success";
      value: T;
      error: undefined;
      loading: false;
      promise: Promise<T>;
    }
  | {
      status: "error";
      value: undefined;
      error: unknown;
      loading: false;
      promise: Promise<T>;
    };
```

#### Creating Loadables

```tsx
import { loadable } from "rxblox";

// Loading state
const loading = loadable("loading", promise);

// Success state
const success = loadable("success", data);

// Error state
const error = loadable("error", errorObj);
```

#### Type Guard

```tsx
import { isLoadable } from "rxblox";

if (isLoadable(value)) {
  // TypeScript knows value is Loadable<T>
  if (value.status === "success") {
    console.log(value.value);
  }
}
```

#### React Suspense Integration

To integrate async signals with React Suspense, use the `wait` API to throw promises/errors:

```tsx
import { Suspense } from "react";
import { signal, wait } from "rxblox";

const user = signal.async(async () => {
  const response = await fetch("/api/user");
  return response.json();
});

function UserProfile() {
  return rx(() => {
    // wait() throws promise if loading, throws error if failed
    // Only returns data when status is "success"
    const userData = wait(user);

    return <div>User: {userData.name}</div>;
  });
}

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserProfile />
    </Suspense>
  );
}
```

**Manual handling without Suspense:**

```tsx
function UserProfile() {
  return rx(() => {
    const loadable = user();

    // Handle loading/error states manually
    if (loadable.status === "loading") {
      return <div>Loading...</div>;
    }

    if (loadable.status === "error") {
      return <div>Error: {loadable.error.message}</div>;
    }

    // loadable.status === "success"
    return <div>User: {loadable.value.name}</div>;
  });
}
```

### 9. Wait Utilities

The `wait` utilities help coordinate multiple asynchronous operations (signals or promises) and integrate with React Suspense.

**Key behaviors:**

- 🎯 **Throws for Suspense** - Throws promises when loading, enabling React Suspense integration
- 💥 **Throws errors** - Throws errors for ErrorBoundary to catch
- ✅ **Returns data** - Only returns unwrapped data when all dependencies are ready

**⚠️ Important Caveat:**

**`wait` can ONLY be used in contexts that handle promise throwing. Valid contexts:**

- ✅ **`rx()` scope** - React Suspense integration
- ✅ **`blox` scope** - Inside blox component definition
- ✅ **`signal.async()` scope** - Async signal body
- ✅ **Custom logic functions** - `xxxLogic()` or `withXXX()` composable functions

**❌ NOT in regular `signal()` computed signals** - They treat thrown promises as errors.

```tsx
// ❌ WRONG: Don't use wait in regular signal()
const combined = signal(() => {
  // This will crash! Normal signals don't handle promise throwing
  return wait([user, posts]); // Throws promise, treated as error
});

// ✅ CORRECT: Use wait in signal.async()
const combined = signal.async(async () => {
  return wait([user, posts]); // Works correctly
});

// ✅ CORRECT: Use wait in rx() for UI
function MyComponent() {
  return rx(() => {
    const data = wait(user); // Works correctly - rx() catches thrown promises
    return <div>{data.name}</div>;
  });
}

// ✅ CORRECT: Use wait in blox scope
const UserProfile = blox(() => {
  const userData = wait(user); // Works correctly in blox

  return <div>{userData.name}</div>;
});

// ✅ CORRECT: Use wait in custom logic
function withUserData() {
  const userData = wait(user); // Works correctly in composable logic
  return userData;
}

// ✅ CORRECT: Manually handle loadables in regular signal()
const combined = signal(() => {
  const userLoadable = user();
  const postsLoadable = posts();

  if (userLoadable.status === "success" && postsLoadable.status === "success") {
    return { user: userLoadable.value, posts: postsLoadable.value };
  }
  return null;
});
```

```tsx
import { signal, wait } from "rxblox";

const user = signal.async(() => fetchUser());
const posts = signal.async(() => fetchPosts());
const comments = signal.async(() => fetchComments());
```

#### `wait()` / `wait.all()` - Wait for all to complete

```tsx
// In signal.async()
const combined = signal.async(async () => {
  // Wait for all async signals
  const [userData, postsData, commentsData] = wait([user, posts, comments]);

  return {
    user: userData,
    posts: postsData,
    comments: commentsData,
  };
});

// Or in rx() for UI rendering
function MyComponent() {
  return rx(() => {
    const [userData, postsData, commentsData] = wait([user, posts, comments]);
    return <div>{/* render combined data */}</div>;
  });
}
```

#### `wait.any()` - Wait for first success

```tsx
const fastest = signal.async(async () => {
  // Returns [value, key] from first successful async signal
  const [data, source] = wait.any({ user, posts, comments });

  console.log(`${source} loaded first:`, data);
  return data;
});
```

#### `wait.race()` - Wait for first to complete (success or error)

```tsx
const first = signal.async(async () => {
  // Returns [value, key] from first completed async signal
  const [data, source] = wait.race({ primary, fallback });

  return { data, source };
});
```

#### `wait.settled()` - Wait for all to settle

```tsx
const allResults = signal.async(async () => {
  // Returns array of PromiseSettledResult
  const results = wait.settled([user, posts, comments]);

  return results.map((r) => (r.status === "fulfilled" ? r.value : r.reason));
});
```

**Key Features:**

- 🔗 **Works with signals and promises** - Pass `Signal<Promise<T>>`, `Signal<Loadable<T>>`, or raw promises
- 🎯 **Type-safe** - Full TypeScript inference for results
- ⚡ **Promise caching** - Efficiently tracks promise states
- 🔄 **Automatic updates** - Results update when source signals change

### 10. Actions

Actions are stateful, callable functions that track their execution status. They're perfect for handling user interactions, API calls, and side effects with automatic state management.

```tsx
import { action } from "rxblox";

// Create an action
const saveUser = action(async (user: User) => {
  const response = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
  return response.json();
});

// Call it like a function
await saveUser({ name: "John", email: "john@example.com" });

// Check status reactively
console.log(saveUser.status); // "idle" | "loading" | "success" | "error"
console.log(saveUser.result); // The returned data
console.log(saveUser.calls); // Number of times called
```

#### Basic Actions

Actions track their state automatically:

```tsx
const UserProfile = blox<{ userId: number }>((props) => {
  const fetchUser = action(async (id: number) => {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  });

  // Fetch on mount
  blox.onMount(() => {
    fetchUser(props.userId());
  });

  return rx(() => {
    if (fetchUser.status === "loading") {
      return <div>Loading...</div>;
    }

    if (fetchUser.status === "error") {
      return <div>Error: {fetchUser.error?.message}</div>;
    }

    if (fetchUser.status === "success") {
      return <div>User: {fetchUser.result.name}</div>;
    }

    return <button onClick={() => fetchUser(props.userId())}>Load User</button>;
  });
});
```

#### Cancellable Actions

Use `action.cancellable()` for operations that can be cancelled:

```tsx
const searchUsers = action.cancellable(
  async (signal: AbortSignal, query: string) => {
    const response = await fetch(`/api/users/search?q=${query}`, { signal });
    return response.json();
  }
);

// Start search
searchUsers("john");

// Cancel if user types more
searchUsers.cancel();

// Check if cancelled
console.log(searchUsers.cancelled); // true

// Next search gets a fresh AbortSignal
searchUsers("jane");
```

#### Event Callbacks

Actions support lifecycle callbacks:

```tsx
const deleteUser = action(
  async (id: number) => {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
  },
  {
    on: {
      init: () => console.log("Action started"),
      loading: () => console.log("Request in progress"),
      success: () => {
        console.log("User deleted successfully");
        showNotification("User deleted");
      },
      error: (err) => {
        console.error("Delete failed:", err);
        showErrorNotification(err.message);
      },
      done: (error, result) => {
        console.log("Action completed", { error, result });
      },
      reset: () => console.log("Action reset"),
    },
  }
);

// Reset to idle state
deleteUser.reset();
```

#### Concurrent Call Handling

Actions automatically handle concurrent calls - only the latest call updates the action's state:

```tsx
const SearchResults = blox(() => {
  const search = action.cancellable(
    async (signal: AbortSignal, query: string) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (signal.aborted) throw new Error("Cancelled");
      return `Results for: ${query}`;
    }
  );

  const handleSearch = (query: string) => {
    search(query); // Previous search is automatically cancelled
  };

  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {rx(() => {
        if (search.status === "loading") return <div>Searching...</div>;
        if (search.status === "success") return <div>{search.result}</div>;
        return null;
      })}
    </div>
  );
});
```

**Key Features:**

- 📊 **Automatic state tracking** - `status`, `result`, `error`, `calls` are automatically managed
- 🚫 **Cancellation support** - Built-in AbortSignal integration with `action.cancellable()`
- 🔄 **Concurrent call handling** - Only the latest call updates the action state
- 🎯 **Event callbacks** - React to lifecycle events (`init`, `loading`, `success`, `error`, `done`, `reset`)
- 📡 **Reactive subscriptions** - Subscribe to action state changes with `action.on()`
- 🎨 **Type-safe** - Full TypeScript support with proper type inference
- 🔌 **Works anywhere** - Use in `blox` components, effects, or plain JavaScript

#### Subscribing to Actions

You can subscribe to action state changes using the `on()` method:

```tsx
const saveUser = action(async (user: User) => {
  return await api.save(user);
});

// Subscribe to state changes
const unsubscribe = saveUser.on((loadable) => {
  if (loadable?.status === "loading") {
    showSpinner();
  } else if (loadable?.status === "success") {
    hideSpinner();
    showNotification(`User ${loadable.value.name} saved!`);
  } else if (loadable?.status === "error") {
    hideSpinner();
    showError(loadable.error);
  }
});

// Call the action
await saveUser({ name: "John" });

// Unsubscribe when done
unsubscribe();
```

This is particularly useful for:

- Coordinating UI feedback (spinners, notifications)
- Triggering side effects in response to action state changes
- Integrating actions with effects or other reactive primitives

---

## Lifecycle & Cleanup

### Automatic Cleanup in `blox` Components

When a `blox` component unmounts, the following are automatically cleaned up:

- All `effect()` subscriptions created in the definition phase
- All `blox.onUnmount()` callbacks
- Signal subscriptions are NOT automatically cleaned up unless explicitly managed

**Important**: Signal subscriptions created with `.on()` must be manually unsubscribed:

```tsx
// ❌ Memory leak - subscription never cleaned up
const MyComponent = blox(() => {
  const count = signal(0);
  count.on((value) => console.log(value)); // Leaks!

  return <div />;
});

// ✅ Correct - manual cleanup
const MyComponent = blox(() => {
  const count = signal(0);
  const unsubscribe = count.on((value) => console.log(value));

  blox.onUnmount(() => unsubscribe());

  return <div />;
});

// ✅ Better - use effect() for automatic cleanup
const MyComponent = blox(() => {
  const count = signal(0);

  effect(() => {
    console.log(count()); // Auto-tracked and cleaned up
  });

  return <div />;
});
```

### Effect Cleanup

Effects return cleanup functions that run before the effect re-executes or when the component unmounts:

```tsx
effect(() => {
  const timer = setInterval(() => console.log("tick"), 1000);

  // Cleanup function - runs before re-execution or on unmount
  return () => clearInterval(timer);
});
```

**Effect Lifecycle:**

1. Effect runs immediately upon creation
2. When dependencies change, cleanup runs, then effect re-runs
3. On component unmount (in `blox`), cleanup runs and effect is disposed

### Signal Lifecycle

- **Creation**: Signals can be created anywhere (global, component, function scope)
- **Subscription**: Calling `.on()` creates a subscription that must be manually cleaned up
- **Garbage Collection**: Signals are garbage collected when no references remain and all subscriptions are cleared
- **Memory**: Each signal maintains a Set of subscribers - ensure subscriptions are cleaned up to avoid memory leaks

### Global Signals

Global signals (created outside components) persist for the application lifetime:

```tsx
// Global signal - lives for entire app lifetime
const globalCount = signal(0);

// Subscription cleanup is your responsibility
const unsubscribe = globalCount.on((value) => {
  console.log(value);
});

// Clean up when no longer needed
unsubscribe();
```

### Cleanup Checklist

- ✅ Effects in `blox` components clean up automatically
- ✅ `blox.onUnmount()` callbacks run automatically
- ⚠️ Manual `.on()` subscriptions need `blox.onUnmount()` cleanup
- ⚠️ Global signal subscriptions must be manually unsubscribed
- ⚠️ Resources (timers, listeners, connections) need explicit cleanup

## Performance & Memory Considerations

### Subscription Overhead

Each signal maintains subscriptions via a Set data structure:

- **Memory per signal**: Minimal overhead (Set + internal state)
- **Memory per subscription**: One reference per subscriber in the Set
- **Notification cost**: O(n) where n = number of subscribers

**Best practices:**

- Clean up subscriptions when no longer needed
- Use computed signals for derived values instead of multiple manual subscriptions
- Prefer `blox` components where cleanup is automatic

### Dependency Tracking

rxblox uses a dispatcher-based tracking system:

- **Computed signals**: Track dependencies automatically during execution
- **Effects**: Subscribe to all accessed signals
- **`rx()` expressions**: Re-execute only when tracked dependencies change

**Performance characteristics:**

- Dependency tracking is synchronous and lightweight
- Computed signals cache results until dependencies change
- Updates propagate synchronously through the dependency graph

### Update Batching

- Signal updates trigger immediate subscriber notifications
- React batches resulting state updates automatically (React 18+)
- Multiple signal changes in the same event handler result in a single React render cycle

### Memory Leaks Prevention

**Common pitfall:**

```tsx
// ❌ Subscription leak - never cleaned up
function SomeUtility() {
  const count = signal(0);
  count.on((value) => {
    // This subscription lives forever!
    apiCall(value);
  });
}
```

**Correct approach:**

```tsx
// ✅ Cleanup in blox component
const MyComponent = blox(() => {
  const count = signal(0);
  const sub = count.on((value) => apiCall(value));

  blox.onUnmount(() => sub());

  return <div />;
});

// ✅ Better - use effect() for automatic cleanup
const MyComponent = blox(() => {
  const count = signal(0);

  effect(() => {
    apiCall(count()); // Auto-tracked and cleaned up
  });

  return <div />;
});
```

### Large Lists & Virtualization

For lists with thousands of items:

- Use virtualization libraries (react-virtual, react-window)
- Individual list items can be `blox` components for fine-grained updates
- Signals work well with virtualized rendering

### Profiling

Use React DevTools Profiler:

- `blox` components appear as memoized components
- `rx()` updates won't show as full component renders
- Use `signal.on()` with `console.log` for debugging signal changes

---

---

## Patterns & Best Practices

This section covers practical patterns and best practices for building applications with rxblox, from common use cases to organizing and reusing signal logic.

### Common Patterns

#### Global State

Create a global store object with signals:

```tsx
// store.ts
export const userStore = {
  user: signal<User | null>(null),
  isLoggedIn: signal(() => userStore.user() !== null),

  login(user: User) {
    this.user.set(user);
  },

  logout() {
    this.user.set(null);
  },
};

// Component.tsx
const UserProfile = blox(() => {
  return rx(() => {
    const user = userStore.user();
    return user ? <div>Hello, {user.name}</div> : <div>Not logged in</div>;
  });
});
```

#### Form State

Track form fields with signals:

```tsx
const FormExample = blox(() => {
  const name = signal("");
  const email = signal("");
  const isValid = signal(() => name().length > 0 && email().includes("@"));

  const handleSubmit = () => {
    if (!isValid()) return;
    console.log({ name: name(), email: email() });
  };

  return rx(() => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <input value={name()} onChange={(e) => name.set(e.target.value)} />
      <input value={email()} onChange={(e) => email.set(e.target.value)} />
      <button disabled={!isValid()}>Submit</button>
    </form>
  ));
});
```

#### Async Data Loading

Use `signal.async()` for automatic loading state management:

```tsx
const UserList = blox(() => {
  // Async signal with automatic loading/success/error states
  const users = signal.async(async () => {
    const response = await fetch("/api/users");
    return response.json();
  });

  return rx(() => {
    const loadable = users();

    if (loadable.status === "loading") {
      return <div>Loading...</div>;
    }

    if (loadable.status === "error") {
      return <div>Error: {loadable.error.message}</div>;
    }

    // loadable.status === "success"
    return (
      <ul>
        {loadable.value.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    );
  });
});
```

**With dependencies:**

```tsx
const UserPosts = blox<{ userId: number }>((props) => {
  const posts = signal.async(async ({ track }) => {
    const { userId } = track({ userId: props.userId });

    const response = await fetch(`/api/users/${userId}/posts`);
    return response.json();
  });

  return rx(() => {
    const loadable = posts();

    if (loadable.loading) return <div>Loading posts...</div>;
    if (loadable.status === "error") return <div>Error loading posts</div>;

    return (
      <ul>
        {loadable.value.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    );
  });
});
```

#### Using React Refs

You can use React refs with `blox` components to access DOM elements or component instances.

**With `createRef`:**

Create refs in the definition phase:

```tsx
import { createRef } from "react";

const InputFocus = blox(() => {
  // Create ref in definition phase
  const inputRef = createRef<HTMLInputElement>();

  const handleFocus = () => {
    inputRef.current?.focus();
  };

  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onClick={handleFocus}>Focus Input</button>
    </div>
  );
});
```

**Forwarding Refs to `blox` Components:**

Use the second parameter to expose a ref handle:

```tsx
interface InputHandle {
  focus: () => void;
  clear: () => void;
}

const CustomInput = blox<{ placeholder: string }, InputHandle>((props, ref) => {
  const inputRef = createRef<HTMLInputElement>();
  const value = signal("");

  // Expose methods via ref
  ref({
    focus: () => inputRef.current?.focus(),
    clear: () => value.set(""),
  });

  return rx(() => (
    <input
      ref={inputRef}
      placeholder={props.placeholder}
      value={value()}
      onChange={(e) => value.set(e.target.value)}
    />
  ));
});

// Usage
function Parent() {
  const inputRef = useRef<InputHandle>(null);

  return (
    <div>
      <CustomInput ref={inputRef} placeholder="Enter text" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
      <button onClick={() => inputRef.current?.clear()}>Clear</button>
    </div>
  );
}
```

**Key Points:**

- ✅ `createRef()` works directly in the definition phase
- ✅ Use the second parameter to forward imperative handles to parent components
- ✅ Refs work normally in event handlers and `rx()` expressions

#### Optimistic Updates

Update UI immediately, revert on error:

```tsx
const TodoItem = blox<{ todo: Todo }>((props) => {
  const completed = signal(props.todo.completed);

  const toggle = async () => {
    completed.set(!completed()); // Optimistic

    try {
      await fetch(`/api/todos/${props.todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: completed() }),
      });
    } catch (error) {
      completed.set(!completed()); // Revert
      console.error("Failed:", error);
    }
  };

  return (
    <div>
      <input type="checkbox" checked={completed()} onChange={toggle} />
      {rx(() => (
        <span style={{ textDecoration: completed() ? "line-through" : "none" }}>
          {props.todo.title}
        </span>
      ))}
    </div>
  );
});
```

### Organizing Signals

Signals in rxblox can be created at different scopes depending on your needs. Understanding when to use global vs local signals, and how to create reusable signal factories, is key to building maintainable applications.

#### Global Signals (Singleton State)

Global signals are created **outside components** and shared across the entire application. Perfect for app-wide state that multiple components need to access.

**When to use:**

- Authentication state
- Theme/settings
- Shopping cart
- Real-time data (WebSocket messages)
- Application configuration

```tsx
// store/auth.ts - Global singleton
import { signal } from "rxblox";

export const authStore = {
  user: signal<User | null>(null),
  token: signal<string | null>(null),
  isAuthenticated: signal(() => authStore.user() !== null),

  login: (user: User, token: string) => {
    authStore.user.set(user);
    authStore.token.set(token);
    localStorage.setItem("token", token);
  },

  logout: () => {
    authStore.user.set(null);
    authStore.token.set(null);
    localStorage.removeItem("token");
  },
};

// Use in any component
const Header = blox(() => {
  return rx(() => {
    const user = authStore.user();
    return user ? <div>Welcome, {user.name}</div> : <div>Please log in</div>;
  });
});

const LoginButton = blox(() => {
  return (
    <button onClick={() => authStore.login(userData, token)}>Login</button>
  );
});
```

**Benefits:**

- ✅ Single source of truth
- ✅ Accessible anywhere (components, utilities, effects)
- ✅ No prop drilling
- ✅ Survives component unmounts
- ✅ Easy to test in isolation

#### Local Signals (Component State)

Local signals are created **inside `blox` components** and are scoped to that component instance. Each component instance gets its own signals.

**When to use:**

- UI-specific state (open/closed, active tab)
- Form inputs
- Component-local data loading
- Temporary state
- State that doesn't need to be shared

```tsx
// Local state - unique per component instance
const Counter = blox(() => {
  // Each Counter gets its own count signal
  const count = signal(0);
  const doubled = signal(() => count() * 2);

  const increment = () => count.set(count() + 1);

  return (
    <div>
      {rx(() => (
        <>
          <div>Count: {count()}</div>
          <div>Doubled: {doubled()}</div>
        </>
      ))}
      <button onClick={increment}>+</button>
    </div>
  );
});

// Using multiple instances - each has independent state
<div>
  <Counter /> {/* Has its own count */}
  <Counter /> {/* Has its own count */}
  <Counter /> {/* Has its own count */}
</div>;
```

**Benefits:**

- ✅ Encapsulated per instance
- ✅ No global pollution
- ✅ Automatically cleaned up on unmount
- ✅ Easy to reason about lifecycle
- ✅ Testable as unit

#### Signal Factories (Reusable Logic)

Signal factories are **functions that create and return signals with related logic**. They enable reusable patterns that can be instantiated globally or locally.

##### Pattern 1: Simple Factory (Universal)

```tsx
// signalFactories/counter.ts
export function createCounter(initialValue = 0) {
  const count = signal(initialValue);
  const doubled = signal(() => count() * 2);
  const isEven = signal(() => count() % 2 === 0);

  const increment = () => count.set(count() + 1);
  const decrement = () => count.set(count() - 1);
  const reset = () => count.set(initialValue);

  return { count, doubled, isEven, increment, decrement, reset };
}

// Use globally (singleton)
export const globalCounter = createCounter(0);

// Use locally (per component)
const CounterComponent = blox(() => {
  const counter = createCounter(10); // Local instance

  return (
    <div>
      {rx(counter.count)}
      <button onClick={counter.increment}>+</button>
    </div>
  );
});
```

##### Pattern 2: Async Data Factory

```tsx
// signalFactories/asyncData.ts
export function createAsyncData<T>(fetcher: () => Promise<T>) {
  const data = signal.async(fetcher);
  const refresh = () => data.reset(); // Triggers re-fetch

  return { data, refresh };
}

// Use globally
export const globalUsers = createAsyncData(() =>
  fetch("/api/users").then((r) => r.json())
);

// Use locally
const UserList = blox<{ filter: string }>((props) => {
  const users = createAsyncData(async () => {
    const response = await fetch(`/api/users?filter=${props.filter}`);
    return response.json();
  });

  return rx(() => {
    const loadable = users.data();
    if (loadable.loading) return <div>Loading...</div>;
    if (loadable.status === "error") return <div>Error!</div>;
    return <ul>{/* render users.data().value */}</ul>;
  });
});
```

##### Pattern 3: Form Field Factory

```tsx
// signalFactories/formField.ts
export function createFormField<T>(
  initialValue: T,
  validator?: (value: T) => string | null
) {
  const value = signal(initialValue);
  const error = signal<string | null>(null);
  const touched = signal(false);
  const isValid = signal(() => error() === null);

  const setValue = (newValue: T) => {
    value.set(newValue);
    if (validator) {
      error.set(validator(newValue));
    }
  };

  const setTouched = () => touched.set(true);
  const reset = () => {
    value.set(initialValue);
    error.set(null);
    touched.set(false);
  };

  return { value, error, touched, isValid, setValue, setTouched, reset };
}

// Use locally in form
const LoginForm = blox(() => {
  const email = createFormField("", (v) =>
    v.includes("@") ? null : "Invalid email"
  );
  const password = createFormField("", (v) =>
    v.length >= 6 ? null : "Too short"
  );
  const isFormValid = signal(() => email.isValid() && password.isValid());

  const handleSubmit = () => {
    if (!isFormValid()) return;
    console.log({ email: email.value(), password: password.value() });
  };

  return rx(() => (
    <form onSubmit={handleSubmit}>
      <input
        value={email.value()}
        onChange={(e) => email.setValue(e.target.value)}
        onBlur={() => email.setTouched()}
      />
      {email.touched() && email.error() && <span>{email.error()}</span>}

      <input
        type="password"
        value={password.value()}
        onChange={(e) => password.setValue(e.target.value)}
        onBlur={() => password.setTouched()}
      />
      {password.touched() && password.error() && (
        <span>{password.error()}</span>
      )}

      <button disabled={!isFormValid()}>Login</button>
    </form>
  ));
});
```

##### Pattern 4: Store Factory (Multiple Instances)

```tsx
// signalFactories/todoStore.ts
export function createTodoStore() {
  const todos = signal<Todo[]>([]);
  const filter = signal<"all" | "active" | "completed">("all");

  const filteredTodos = signal(() => {
    const all = todos();
    const f = filter();
    if (f === "active") return all.filter((t) => !t.completed);
    if (f === "completed") return all.filter((t) => t.completed);
    return all;
  });

  const add = (title: string) => {
    todos.set([...todos(), { id: Date.now(), title, completed: false }]);
  };

  const toggle = (id: number) => {
    todos.set(
      todos().map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const remove = (id: number) => {
    todos.set(todos().filter((t) => t.id !== id));
  };

  return { todos, filter, filteredTodos, add, toggle, remove };
}

// Use globally (shared across app)
export const globalTodos = createTodoStore();

// Use locally (per-component instance)
const TodoApp = blox(() => {
  const store = createTodoStore(); // Independent instance

  return <div>{/* Use store.todos, store.add, etc. */}</div>;
});
```

**Choosing Between Global and Local:**

| Use Case             | Pattern         | Why                                                  |
| -------------------- | --------------- | ---------------------------------------------------- |
| Authentication       | Global          | Needed everywhere, survives navigation               |
| Theme settings       | Global          | Shared across entire app                             |
| Shopping cart        | Global          | Persists across pages                                |
| Form input           | Local           | Component-specific, cleaned up on unmount            |
| Modal open/closed    | Local           | UI state specific to component                       |
| Dropdown active item | Local           | Temporary UI state                                   |
| Tab selection        | Local (usually) | Unless needs to sync across instances                |
| Data fetching        | **Both**        | Global for shared data, local for component-specific |

**Organizing Signal Code:**

Recommended structure:

```plaintext
src/
├── store/              # Global signals
│   ├── auth.ts         # authStore
│   ├── cart.ts         # cartStore
│   └── theme.ts        # themeStore
│
├── signalFactories/    # Reusable signal factories
│   ├── counter.ts      # createCounter()
│   ├── formField.ts    # createFormField()
│   └── asyncData.ts    # createAsyncData()
│
└── components/
    └── Counter.tsx     # Components with local signals
```

**Best practices:**

- ✅ Global signals in `store/` directory
- ✅ Signal factories in `signalFactories/` or `factories/`
- ✅ Local signals inside component definition
- ✅ Name global stores with `Store` suffix: `authStore`, `cartStore`
- ✅ Name factories with `create` prefix: `createCounter()`, `createFormField()`
- ✅ Export both factory and global instance if needed
- ❌ Don't create global signals inside components
- ❌ Don't pass local signals between components (use props or global instead)

### Composable Logic

One of the most powerful features of `blox` is the ability to extract and reuse reactive logic. Since signals, effects, and lifecycle hooks can be called anywhere (not just in React components), you can create composable logic functions.

#### Naming Conventions

**Universal Logic** (plain names or `xxxLogic` suffix)

- Can be called anywhere
- Only uses: `signal()`, `effect()`, `rx()`
- Example: `counterLogic()`, `formState()`, `timer()`

**Blox-only Logic** (`withXXX` prefix)

- Must be called inside `blox()` components
- Uses blox APIs: `blox.onMount()`, `blox.onUnmount()`, `blox.onRender()`, `blox.handle()`
- Example: `withWebSocket()`, `withCleanup()`, `withReactRouter()`

⚠️ **Never use `useXXX`** - Reserved for React hooks only!

#### Basic Example

```tsx
// Universal logic - can use anywhere
function counterLogic(initialValue = 0) {
  const count = signal(initialValue);
  const doubled = signal(() => count() * 2);

  const increment = () => count.set(count() + 1);
  const decrement = () => count.set(count() - 1);
  const reset = () => count.set(initialValue);

  return { count, doubled, increment, decrement, reset };
}

// Use in components
const Counter = blox(() => {
  const counter = counterLogic(0);

  return (
    <div>
      {rx(() => (
        <div>Count: {counter.count()}</div>
      ))}
      <button onClick={counter.increment}>+</button>
    </div>
  );
});
```

#### Blox-only Logic with Cleanup

Use `blox.onUnmount()` for cleanup in blox-only logic:

```tsx
// Blox-only logic - uses blox.onUnmount()
function withWebSocket(url: string) {
  const messages = signal<string[]>([]);
  const connected = signal(false);

  const ws = new WebSocket(url);
  ws.onopen = () => connected.set(true);
  ws.onclose = () => connected.set(false);
  ws.onmessage = (e) => messages.set((prev) => [...prev, e.data]);

  blox.onUnmount(() => ws.close()); // ✅ Cleanup on unmount

  return { messages, connected, send: (msg: string) => ws.send(msg) };
}

const Chat = blox<{ roomId: string }>((props) => {
  const ws = withWebSocket(`wss://example.com/${props.roomId}`);

  return rx(() => (
    <div>
      {ws.connected() ? "Connected" : "Disconnected"}
      <ul>
        {ws.messages().map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  ));
});
```

#### Complex State Logic

Extract business logic into reusable functions:

```tsx
// Universal logic - no blox APIs, can use anywhere
function authStateLogic() {
  const user = signal<User | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const isAuthenticated = signal(() => user() !== null);

  const login = async (email: string, password: string) => {
    loading.set(true);
    error.set(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Login failed");
      user.set(await res.json());
    } catch (err) {
      error.set(err instanceof Error ? err.message : "Login failed");
    } finally {
      loading.set(false);
    }
  };

  const logout = () => user.set(null);

  return { user, loading, error, isAuthenticated, login, logout };
}
```

#### Composing Multiple Functions

Combine smaller logic functions into larger ones:

```tsx
// Blox-only - uses blox.onUnmount()
function withTimer(interval = 1000) {
  const elapsed = signal(0);
  const timer = setInterval(() => elapsed.set((p) => p + interval), interval);
  blox.onUnmount(() => clearInterval(timer)); // ✅ Cleanup
  return { elapsed };
}

// Universal - can use anywhere
function timedCounterLogic() {
  const counter = counterLogic(0);

  effect(() => counter.increment()); // Auto-increment

  return counter;
}

// Blox-only - combines both
function withTimedCounter() {
  const counter = counterLogic(0);
  const timer = withTimer(1000);

  effect(() => counter.increment()); // Auto-increment every second

  return { ...counter, elapsed: timer.elapsed };
}
```

**Key Benefits:**

- ✅ **Reusability** - Write logic once, use in multiple components
- ✅ **Testability** - Logic functions can be tested independently
- ✅ **Separation of concerns** - Keep business logic separate from UI
- ✅ **No hooks rules** - Call these functions anywhere, in any order
- ✅ **Automatic cleanup** - `blox.onUnmount()` ensures resources are freed
- ✅ **Clear naming** - `withXXX` = blox-only, plain/`xxxLogic` = universal
- ✅ **Namespaced API** - All blox-specific APIs live under `blox.*`

---

## Comparison with Other Solutions

### Feature Matrix

| Feature                  | rxblox | React | Zustand | Jotai | Solid Signals |
| ------------------------ | ------ | ----- | ------- | ----- | ------------- |
| Fine-grained reactivity  | ✅     | ❌    | ❌      | ✅    | ✅            |
| Computed values          | ✅     | ❌    | ❌      | ✅    | ✅            |
| Auto dependency tracking | ✅     | ❌    | ❌      | ✅    | ✅            |
| No hooks rules           | ✅     | ❌    | ❌      | ❌    | ✅            |
| Works in React           | ✅     | ✅    | ✅      | ✅    | ❌            |
| Built-in DI              | ✅     | ❌    | ❌      | ❌    | ✅            |
| Zero boilerplate         | ✅     | ✅    | ❌      | ❌    | ✅            |

### Boilerplate Comparisons

Here's how rxblox compares to other popular state management solutions for a simple counter with increment functionality.

#### Redux Toolkit (~35 lines across 3 files)

**Redux Toolkit** reduces Redux boilerplate but still requires slice setup, store configuration, and causes component re-renders.

```tsx
// counterSlice.ts
import { createSlice } from "@reduxjs/toolkit";

const counterSlice = createSlice({
  name: "counter",
  initialState: { count: 0 },
  reducers: {
    increment: (state) => {
      state.count += 1;
    },
  },
});

export const { increment } = counterSlice.actions;
export default counterSlice.reducer;

// store.ts
import { configureStore } from "@reduxjs/toolkit";
import counterReducer from "./counterSlice";

export const store = configureStore({
  reducer: { counter: counterReducer },
});

// Component.tsx
import { useSelector, useDispatch } from "react-redux";
import { increment } from "./counterSlice";

function Counter() {
  const count = useSelector((state) => state.counter.count);
  const dispatch = useDispatch();
  console.log("Component rendered"); // Logs on every state change
  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => dispatch(increment())}>+</button>
    </div>
  );
}
```

**Issues:** Still requires slice creation and store setup, multiple files needed, component re-renders on every state change, hook-based (rules of hooks apply).

#### Zustand (~20 lines, 1 file)

**Zustand** is simpler than Redux but still requires store setup and causes full component re-renders.

```tsx
import create from "zustand";

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

function Counter() {
  const { count, increment } = useStore();
  console.log("Component rendered"); // Logs on every state change
  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

**Issues:** Store setup required, component re-renders on every state change, hook-based (rules of hooks apply).

#### Jotai (~25 lines, 1 file + Provider)

**Jotai** uses atoms but requires Provider wrapper and is subject to hooks rules.

```tsx
import { atom, useAtom, Provider } from "jotai";

const countAtom = atom(0);

function App() {
  return (
    <Provider>
      <Counter />
    </Provider>
  );
}

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  console.log("Component rendered"); // Logs on every state change
  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
    </div>
  );
}
```

**Issues:** Provider required, component re-renders on every state change, hook-based (rules of hooks apply).

#### rxblox (~12 lines, 1 file)

**rxblox** provides the simplest API with fine-grained reactivity - only the exact UI that depends on state updates.

```tsx
import { signal, rx } from "rxblox";

const count = signal(0);

function Counter() {
  console.log("Component rendered"); // Logs ONCE
  return (
    <div>
      <div>{rx(() => `Count: ${count()}`)}</div>
      <button onClick={() => count.set(count() + 1)}>+</button>
    </div>
  );
}
```

**Benefits:** Zero boilerplate, no store setup, no Provider, fine-grained updates (component doesn't re-render), no hooks rules.

#### Summary: Lines of Code

For a simple counter with increment functionality:

| Solution          | Lines of Code | Files Required                    |
| ----------------- | ------------- | --------------------------------- |
| **Redux Toolkit** | ~35 lines     | 3 files (slice, store, component) |
| **Zustand**       | ~20 lines     | 1 file                            |
| **Jotai**         | ~25 lines     | 1 file + Provider wrapper         |
| **rxblox**        | ~12 lines     | 1 file                            |

**rxblox wins on simplicity** with the least code, zero configuration, and fine-grained reactivity! 🎯

---

## API Reference

### `signal<T>(value, options?)`

Creates a reactive signal.

```tsx
// Static value
const count = signal(0);

// Computed value (auto-tracks dependencies)
const doubled = signal(() => count() * 2);

// Computed with explicit tracking
const result = signal(({ track }) => {
  const { condition, a, b } = track({ condition, a, b });
  return condition ? a : b;
});

// With custom equality
const user = signal(
  { id: 1, name: "John" },
  { equals: (a, b) => a.id === b.id }
);
```

**Methods:**

- `signal()` - Read value and track as dependency
- `signal.peek()` - Read value without tracking
- `signal.set(value | updater)` - Update value
- `signal.on(listener)` - Subscribe to changes (returns unsubscribe function)
- `signal.reset()` - Clear cache and recompute (for computed signals)

**Context Parameter (for computed signals):**

- `track(signals)` - Creates a proxy for explicit dependency tracking

### `signal.async<T>(fn)`

Creates an async signal that manages loading/success/error states automatically.

```tsx
const user = signal.async(async ({ track, abortSignal }) => {
  const tracked = track({ userId });

  const response = await fetch(`/api/users/${tracked.userId}`, {
    signal: abortSignal,
  });

  return response.json();
});

// Returns Loadable<T>
const loadable = user();
if (loadable.status === "success") {
  console.log(loadable.value);
}
```

**Context Parameter:**

- `track(signals)` - Track signal dependencies (works even after `await`)
- `abortSignal` - AbortSignal for request cancellation

**Returns:** `Signal<Loadable<T>>`

**Key Features:**

- Lazy evaluation (only starts when first accessed)
- Automatic re-fetch when dependencies change
- Previous requests automatically aborted
- Promise state caching

### `effect(fn)`

Creates a reactive effect that runs when dependencies change.

```tsx
const cleanup = effect(() => {
  console.log("Count:", count());

  // Optional cleanup
  return () => console.log("Cleanup");
});

// Manually run effect
cleanup.run();
```

**Returns:** Effect object with `run()` method

### `rx(expression)`

Creates a reactive expression that re-renders when dependencies change.

```tsx
{
  rx(() => <div>{count()}</div>);
}

// Can access multiple signals
{
  rx(() => (
    <div>
      {firstName()} {lastName()} - Count: {count()}
    </div>
  ));
}
```

**Returns:** ReactNode

### `blox<Props>(builder)`

Creates a reactive component.

```tsx
const MyComponent = blox<{ value: number }>((props) => {
  const local = signal(props.value);

  effect(() => {
    console.log("Props changed:", props.value);
  });

  return <div>{rx(local)}</div>;
});

// With imperative ref
interface CounterRef {
  reset: () => void;
}

const MyComponent = blox<Props, CounterRef>((props, ref) => {
  const count = signal(0);

  ref({
    reset: () => count.set(0),
  });

  return <div>{rx(count)}</div>;
});

const counterRef = useRef<CounterRef>();
<MyComponent ref={counterRef} />;
counterRef.current?.reset();
```

**Returns:** Memoized React component

### `provider<T>(name, initialValue, options?)`

Creates a provider for dependency injection of reactive signals.

**⚠️ This is NOT React Context!** Providers don't cause re-renders. Only `rx()` and `effect()` react to changes.

```tsx
const [withValue, ValueProvider] = provider("myValue", 0);

// In parent
<ValueProvider value={currentValue}>
  <Child />
</ValueProvider>;

// In child (inside blox component)
const Child = blox(() => {
  const value = withValue(); // Returns Signal<T> (read-only)

  // ❌ Wrong: Won't update
  return <div>{value()}</div>;

  // ✅ Correct: Use rx()
  return rx(() => <div>{value()}</div>);
});
```

**Returns:** `[withXXX, XXXProvider]` tuple:

- `withXXX()` - Function that returns the signal (must be called inside provider tree)
- `Provider` - React component with `{ value: T | Signal<T>; children: ReactNode }` props

**Options:**

- `equals?: (a: T, b: T) => boolean` - Custom equality function

**Signal Support:**

Providers accept both plain values and signals as the `value` prop:

```tsx
const [withTheme, ThemeProvider] = provider("theme", "light");

// ✅ With plain value
<ThemeProvider value="dark">
  <Child />
</ThemeProvider>;

// ✅ With signal - updates consumers when signal changes
const themeSignal = signal("dark");
<ThemeProvider value={themeSignal}>
  <Child />
</ThemeProvider>;

// Signal changes propagate to all consumers
themeSignal.set("light"); // All consumers update automatically

// ✅ With computed signal
const isDark = signal(false);
const theme = signal(() => (isDark() ? "dark" : "light"));
<ThemeProvider value={theme}>
  <Child />
</ThemeProvider>;
```

**When to use signal values:**

- ✅ Sharing global signals across the component tree
- ✅ Providing computed/derived values to children
- ✅ Coordinating state between parent and deeply nested children
- ✅ Creating reactive themes, settings, or configuration

The provider automatically:

- Uses `.peek()` to get the initial value (avoids creating dependency)
- Subscribes to signal changes
- Updates all consumers when the signal changes
- Cleans up subscriptions on unmount
- Lazily creates the internal provider signal only when accessed

### Lifecycle Hooks

Lifecycle methods available inside `blox()` components, namespaced under `blox.*`

#### `blox.onRender(callback)`

Execute code during React's render phase, enabling React hooks usage.

```tsx
const MyComponent = blox(() => {
  const count = signal(0);

  // Define variables to hold hook results
  let history: ReturnType<typeof useHistory> | undefined;
  let location: ReturnType<typeof useLocation> | undefined;

  // Call React hooks inside blox.onRender()
  blox.onRender(() => {
    history = useHistory();
    location = useLocation();

    useEffect(() => {
      // Note: No signal tracking in blox.onRender() context
      console.log("Count:", count());
    }, []);
  });

  // Use hook results in event handlers
  const handleNavigate = () => {
    history?.push("/home");
  };

  return (
    <div>
      {rx(() => (
        <div>{count()}</div>
      ))}
      <button onClick={handleNavigate}>Go Home</button>
    </div>
  );
});
```

**When to use:**

- Integrating with React Router or other hook-based libraries
- Using third-party custom hooks
- Accessing React context via `useContext`

**Important:** Signals accessed inside `blox.onRender()` are NOT tracked as dependencies - there is no tracking context in `blox.onRender()`.

#### `blox.onMount(callback)`

Execute code immediately after component mounts.

```tsx
const MyComponent = blox(() => {
  blox.onMount(() => {
    console.log("Component mounted");
  });

  return <div>Content</div>;
});
```

#### `blox.onUnmount(callback)`

Register cleanup callback that runs on component unmount.

```tsx
const MyComponent = blox(() => {
  blox.onUnmount(() => {
    console.log("Cleanup on unmount");
  });

  return <div>Content</div>;
});
```

### `blox.handle<T>(callback)`

Creates a handle to capture values from React hooks during the render phase.

This is useful in `blox` components where you need to use React hooks, but the component body only runs once. The callback runs on every render via `blox.onRender()`, and the returned value is accessible via `.current`.

**Important**: The captured value is only available inside `rx()` expressions or event handlers, not in the component definition phase (which runs only once).

```tsx
import { blox, signal, rx } from "rxblox";
import { useHistory, useLocation } from "react-router";

const MyComponent = blox(() => {
  const count = signal(0);

  // Capture React hooks
  const router = blox.handle(() => {
    const history = useHistory();
    const location = useLocation();
    return { history, location };
  });

  const handleNavigate = () => {
    // ✅ Available in event handlers
    router.current?.history.push("/home");
  };

  return (
    <div>
      {/* ✅ Available in rx() expressions */}
      {rx(() => (
        <div>Path: {router.current?.location.pathname}</div>
      ))}
      <button onClick={handleNavigate}>Go Home</button>
    </div>
  );
});
```

**Returns:** `Handle<T>` - An object with a `.current` property

**Type:**

```ts
type Handle<T> = {
  readonly current: T | undefined;
};
```

**Notes:**

- The `callback` runs on every component render
- The value is `undefined` during the definition phase
- Must use `rx()` to access the value in JSX
- Can access directly in event handlers

### `loadable(status, value, promise?)`

Creates a Loadable object representing the state of an async operation.

```tsx
import { loadable } from "rxblox";

// Loading state
const loading = loadable("loading", promise);

// Success state
const success = loadable("success", data);

// Error state
const error = loadable("error", errorObj);
```

**Type:**

```tsx
type Loadable<T> =
  | LoadingLoadable<T> // { status: "loading", value: undefined, error: undefined, loading: true, promise }
  | SuccessLoadable<T> // { status: "success", value: T, error: undefined, loading: false, promise }
  | ErrorLoadable<T>; // { status: "error", value: undefined, error: unknown, loading: false, promise }
```

### `isLoadable(value)`

Type guard to check if a value is a Loadable.

```tsx
import { isLoadable } from "rxblox";

if (isLoadable(value)) {
  // TypeScript knows value is Loadable<T>
  switch (value.status) {
    case "loading": // ...
    case "success":
      console.log(value.value);
      break;
    case "error":
      console.log(value.error);
      break;
  }
}
```

### `wait` / `wait.all`

Waits for all awaitables (signals or promises) to complete successfully.

**⚠️ Valid contexts: `rx()`, `blox()`, `signal.async()`, `xxxLogic()`/`withXXX()`. NOT in regular `signal()`.**

```tsx
import { wait } from "rxblox";

// ✅ In signal.async()
const combined = signal.async(async () => wait([signal1, signal2]));

// ✅ In rx()
function Component() {
  return rx(() => {
    const data = wait(asyncSignal);
    return <div>{data}</div>;
  });
}

// ✅ In blox()
const MyComponent = blox(() => {
  const data = wait(asyncSignal);
  return <div>{data}</div>;
});

// ✅ In custom logic
function withData() {
  return wait(asyncSignal);
}

// Single awaitable
const result = wait(asyncSignal);

// Array of awaitables
const [data1, data2, data3] = wait([signal1, signal2, promise]);
```

**Throws:**

- Throws promise if any awaitable is loading (for React Suspense)
- Throws error if any awaitable fails (for ErrorBoundary)

**Returns:** Unwrapped data when all awaitables are ready

### `wait.any(awaitables)`

Waits for the first awaitable to succeed. Returns `[value, key]` tuple.

**⚠️ Valid contexts: `rx()`, `blox()`, `signal.async()`, `xxxLogic()`/`withXXX()`. NOT in regular `signal()`.**

```tsx
const [data, source] = wait.any({
  primary: primarySignal,
  fallback: fallbackSignal,
});

console.log(`${source} succeeded first:`, data);
```

**Throws:**

- Throws promise if all awaitables are loading (for React Suspense)
- Throws error if all awaitables fail (for ErrorBoundary)

**Returns:** `[value, key]` tuple when first awaitable succeeds

### `wait.race(awaitables)`

Waits for the first awaitable to complete (success or error). Returns `[value, key]` tuple.

**⚠️ Valid contexts: `rx()`, `blox()`, `signal.async()`, `xxxLogic()`/`withXXX()`. NOT in regular `signal()`.**

```tsx
const [data, source] = wait.race({
  fast: fastSignal,
  slow: slowSignal,
});
```

**Throws:**

- Throws promise if all awaitables are loading (for React Suspense)
- Throws error if first completed awaitable fails (for ErrorBoundary)

**Returns:** `[value, key]` tuple from first completed awaitable

### `wait.settled(awaitables)`

Waits for all awaitables to settle. Returns array of `PromiseSettledResult`.

**⚠️ Valid contexts: `rx()`, `blox()`, `signal.async()`, `xxxLogic()`/`withXXX()`. NOT in regular `signal()`.**

```tsx
// Single awaitable
const result = wait.settled(asyncSignal);

// Array of awaitables
const results = wait.settled([signal1, signal2, promise]);

results.forEach((r) => {
  if (r.status === "fulfilled") {
    console.log("Success:", r.value);
  } else {
    console.log("Error:", r.reason);
  }
});
```

**Throws:**

- Throws promise if any awaitable is loading (for React Suspense)

**Returns:** Array of `PromiseSettledResult` when all awaitables have settled (does not throw errors)

**Awaitable Types:**

- `Signal<Promise<T>>`
- `Signal<Loadable<T>>`
- `Promise<T>` or `PromiseLike<T>`

### `action<TResult, TArgs>(fn, options?)`

Creates an action that tracks execution state.

```tsx
// Basic action
const saveUser = action(async (user: User) => {
  const response = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
  return response.json();
});

await saveUser({ name: "John" });
console.log(saveUser.status); // "success"
console.log(saveUser.result); // User object

// With callbacks
const deleteUser = action(
  async (id: number) => {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
  },
  {
    on: {
      success: () => console.log("Deleted"),
      error: (err) => console.error(err),
    },
  }
);
```

**Properties:**

- `action.status` - Current status: `"idle" | "loading" | "success" | "error"`
- `action.result` - Last successful result (undefined if no success yet)
- `action.error` - Last error (undefined if no error yet)
- `action.calls` - Number of times the action has been called
- `action.on(listener)` - Subscribe to action state changes (returns unsubscribe function)
- `action.reset()` - Reset to idle state

**Subscribing to action state changes:**

```tsx
const saveUser = action(async (user: User) => {
  const response = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
  return response.json();
});

// Subscribe to all state changes
const unsubscribe = saveUser.on((loadable) => {
  if (!loadable) {
    console.log("Action idle");
  } else if (loadable.status === "loading") {
    console.log("Saving user...");
  } else if (loadable.status === "success") {
    console.log("User saved:", loadable.value);
  } else if (loadable.status === "error") {
    console.error("Save failed:", loadable.error);
  }
});

// The subscriber is called for every state change
await saveUser({ name: "John" }); // Logs: "Saving user..." then "User saved: ..."

// Unsubscribe when done
unsubscribe();
```

The `on()` method receives a `Loadable<T>` object (or `undefined` for idle state) representing the current action state. This is useful for:

- Reacting to action state changes in effects or other signals
- Implementing custom loading indicators
- Logging or analytics
- Coordinating multiple actions

**Note:** The `on()` subscription provides the full `Loadable` state, while event callbacks in `options.on` provide unwrapped values.

### `action.cancellable<TResult, TArgs>(fn, options?)`

Creates a cancellable action with cancellation capabilities.

The function receives `AbortSignal` as its first parameter.

```tsx
const fetchUser = action.cancellable(
  async (signal: AbortSignal, userId: number) => {
    const response = await fetch(`/api/users/${userId}`, { signal });
    return response.json();
  }
);

const promise = fetchUser(123);

// Cancel the request
fetchUser.cancel();

// Check if cancelled
console.log(fetchUser.cancelled); // true

// Next call gets a fresh signal
await fetchUser(456);
```

**Additional Properties:**

- `action.cancel()` - Cancel the currently running action
- `action.cancelled` - Whether the action has been cancelled

**Options:**

```tsx
type ActionOptions<TResult> = {
  on?: {
    init?: () => void; // Called when action is invoked
    loading?: () => void; // Called when async action starts
    success?: (result: TResult) => void; // Called on success
    error?: (error: unknown) => void; // Called on error
    done?: (error: unknown | undefined, result: TResult | undefined) => void;
    reset?: () => void; // Called when reset() is called
  };
};
```

### `action.aborter()`

Creates an AbortController wrapper with reset capability.

Useful when you need manual control over AbortController lifecycle outside of `action.cancellable()`.

```tsx
import { action } from "rxblox";

const ac = action.aborter();

// Use the signal
fetch("/api/data", { signal: ac.signal });

// Abort
ac.abort();

// Reset to a fresh controller
ac.reset();
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui

# Build library
pnpm build

# Build in watch mode
pnpm dev
```

## License

MIT © 2024

## Contributing

Contributions are welcome! Please follow these guidelines to ensure quality and consistency.

### Before Submitting a PR

**Required:**

1. ✅ **Tests** - Write comprehensive tests for new features

   - Unit tests for new signal APIs
   - Integration tests for React component behavior
   - SSR compatibility tests if applicable

2. ✅ **TypeScript** - Maintain full type safety

   - All public APIs must be fully typed
   - No `any` types without explicit justification
   - Export types for public consumption

3. ✅ **Documentation** - Update README.md

   - Add examples for new features
   - Update API Reference section
   - Add JSDoc comments to public APIs

4. ✅ **Code Style** - Follow existing patterns

   - Run `pnpm lint` and fix all issues
   - Follow naming conventions (signals, withXXX for providers, etc.)
   - Keep functions small and focused

5. ✅ **React Compatibility** - Test across React versions
   - Verify behavior in Strict Mode
   - Test SSR if your change affects rendering
   - Verify no console warnings in development

### Development Workflow

```bash
# Install dependencies
pnpm install

# Run tests in watch mode
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui

# Build library
pnpm build

# Lint and type-check
pnpm lint
```

### Pull Request Checklist

- [ ] Tests added/updated and passing
- [ ] Types are correct and exported
- [ ] Documentation updated (README + JSDoc)
- [ ] No console warnings in development
- [ ] Strict Mode compatible
- [ ] SSR compatible (if applicable)
- [ ] Examples added for new features
- [ ] Backward compatible (or breaking change noted)

### Reporting Issues

When reporting bugs, please include:

- rxblox version
- React version
- Minimal reproduction (CodeSandbox or repo)
- Expected vs actual behavior
- Browser/environment details

### License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Made with ❤️ for the React community

## MIT © 2025

Made with ❤️ for the React community
