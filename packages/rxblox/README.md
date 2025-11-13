# 🎯 rxblox

**Fine-grained reactive state management for React.**  
Signals, computed values, and reactive components with zero boilerplate.

[![npm version](https://img.shields.io/npm/v/rxblox.svg)](https://www.npmjs.com/package/rxblox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why rxblox?

Traditional React state management re-renders entire component trees when state changes. **rxblox** provides **fine-grained reactivity** - only the exact UI elements that depend on changed state will update.

**The Problem:**

```tsx
// ❌ Traditional React - entire component re-renders
function Counter() {
  const [count, setCount] = useState(0);
  console.log("Component rendered"); // Logs on EVERY state change
  return <div>{count}</div>;
}
```

**The Solution:**

```tsx
// ✅ rxblox - only the reactive expression updates
import { signal, rx } from "rxblox";

const count = signal(0);

function Counter() {
  console.log("Component rendered"); // Logs ONCE
  return <div>{rx(() => count())}</div>; // Only this updates
}
```

### Key Benefits

- 🎯 **Fine-grained reactivity** - Update only what changed, not entire components
- 🚀 **Zero boilerplate** - No actions, reducers, or store setup
- 🔄 **Computed values** - Automatic dependency tracking and memoization
- ⚡ **Better performance** - Efficient updates with minimal overhead
- 🎨 **Reactive components** - Build components that automatically track dependencies
- 🔌 **Dependency injection** - Provider pattern without Context re-render overhead
- 🧹 **Automatic cleanup** - No memory leaks, subscriptions cleaned up automatically
- 📦 **TypeScript first** - Full type safety out of the box
- 🪶 **Lightweight** - Minimal bundle size
- 🎪 **No hooks rules** - Call signals anywhere (conditionally, in loops, etc.)
- 🔀 **Async signals** - First-class support for async operations with automatic state management
- 📊 **Loadable states** - Built-in loading/success/error state handling

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
      {rx(() => (
        <h1>Count: {count()}</h1>
      ))}

      <button onClick={() => count.set(count() + 1)}>Increment</button>
    </div>
  );
}
```

---

## Table of Contents

- [Why rxblox?](#why-rxblox)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Signals](#1-signals---reactive-state-primitives)
  - [Computed Signals](#2-computed-signals---derived-state)
  - [Effects](#3-effects---side-effects-with-auto-tracking)
  - [Reactive Expressions](#4-reactive-expressions---rx)
  - [Reactive Components](#5-reactive-components---blox)
  - [Providers](#6-providers---dependency-injection)
  - [Async Signals](#7-async-signals---asyncsignal)
  - [Loadable States](#8-loadable-states)
  - [Wait Utilities](#9-wait-utilities)
  - [Actions](#10-actions)
- [Patterns & Best Practices](#patterns--best-practices)
- [Composable Logic](#composable-logic-with-blox)
- [Comparisons](#comparison-with-other-solutions)
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
  // Parent component renders once
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

### 5. Reactive Components - `blox()`

`blox()` creates reactive components where props become signals and effects are automatically managed.

#### Structure of a `blox` Component

A `blox` component has two distinct parts with different execution behavior:

```tsx
const Counter = blox<Props>((props, ref) => {
  // 🔵 DEFINITION PHASE: Runs ONCE on mount
  // - Create signals
  // - Set up effects
  // - Define event handlers
  // - Register cleanup with blox.onUnmount()
  const count = signal(0);

  effect(() => {
    console.log("Count:", count());
  });

  // 🟢 SHAPE PHASE: Returns static JSX that NEVER re-renders
  // - Only rx() expressions update
  // - Event handlers work normally
  // - No re-execution of this JSX
  return (
    <div>
      {rx(() => count())} {/* Only this updates */}
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

  // Static JSX - never re-renders
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
- **Shape is static** - The returned JSX structure never re-renders
- **Props are signals** - `props.label` tracks the prop as a dependency when accessed
- **Only `rx()` updates** - Reactive expressions re-execute when dependencies change
- **Effects auto-cleanup** - Effects created inside are automatically cleaned up on unmount
- **Local signals persist** - Signals keep their state across prop changes

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
- **Undefined in builder phase** - `blox.handle().current` is `undefined` during the definition phase
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

Providers inject values down the component tree without causing re-renders like React Context.

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

### 7. Async Signals - `signal.async()`

Async signals (`signal.async()`) manage asynchronous operations with automatic loading/success/error state tracking.

```tsx
import { signal } from "rxblox";

const userId = signal(1);

// Create an async signal that fetches user data
const user = signal.async(async ({ track, abortSignal }) => {
  // Use track() to access signals after await
  const proxy = track({ userId });

  const response = await fetch(`/api/users/${proxy.userId}`, {
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
    return <div>User: {loadable.data.name}</div>;
  });
}

// Changing userId automatically triggers re-fetch (previous request aborted)
userId.set(2);
```

**Key Features:**

- 📊 **Loadable return type** - Returns `Loadable<T>` with `status`, `data`, `error`, `promise`
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
  const proxy = track({ userId, filter });

  // Can await before accessing signals!
  await delay(10);

  return fetchData(proxy.userId, proxy.filter);
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

### 8. Loadable States

Loadable is a discriminated union type representing the state of an asynchronous operation.

```tsx
type Loadable<T> =
  | {
      status: "loading";
      data: undefined;
      error: undefined;
      loading: true;
      promise: Promise<T>;
    }
  | {
      status: "success";
      data: T;
      error: undefined;
      loading: false;
      promise: Promise<T>;
    }
  | {
      status: "error";
      data: undefined;
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
    console.log(value.data);
  }
}
```

#### React Suspense Integration

Async signals automatically work with React Suspense:

```tsx
import { Suspense } from "react";

const user = signal.async(async () => {
  const response = await fetch("/api/user");
  return response.json();
});

function UserProfile() {
  return rx(() => {
    const loadable = user();

    // Automatically throws promise for Suspense if loading
    // Automatically throws error for ErrorBoundary if error
    // Just use the data when status is "success"
    return <div>User: {loadable.data.name}</div>;
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

### 9. Wait Utilities

The `wait` utilities help coordinate multiple asynchronous operations (signals or promises).

```tsx
import { signal, wait } from "rxblox";

const user = signal.async(() => fetchUser());
const posts = signal.async(() => fetchPosts());
const comments = signal.async(() => fetchComments());
```

#### `wait()` / `wait.all()` - Wait for all to complete

```tsx
const combined = signal(() => {
  // Wait for all async signals
  const [userData, postsData, commentsData] = wait([user, posts, comments]);

  return {
    user: userData,
    posts: postsData,
    comments: commentsData,
  };
});
```

#### `wait.any()` - Wait for first success

```tsx
const fastest = signal(() => {
  // Returns [value, key] from first successful async signal
  const [data, source] = wait.any({ user, posts, comments });

  console.log(`${source} loaded first:`, data);
  return data;
});
```

#### `wait.race()` - Wait for first to complete (success or error)

```tsx
const first = signal(() => {
  // Returns [value, key] from first completed async signal
  const [data, source] = wait.race({ primary, fallback });

  return { data, source };
});
```

#### `wait.settled()` - Wait for all to settle

```tsx
const allResults = signal(() => {
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
- 🎨 **Type-safe** - Full TypeScript support with proper type inference
- 🔌 **Works anywhere** - Use in `blox` components, effects, or plain JavaScript

---

## Patterns & Best Practices

### Global State

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

### Form State

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

### Async Data Loading

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
        {loadable.data.map((user) => (
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
        {loadable.data.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    );
  });
});
```

### Using React Refs

You can use React refs with `blox` components to access DOM elements or component instances.

#### With `createRef`

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

#### With `useRef` via `blox.handle()`

Use `blox.handle()` to capture refs from React hooks:

```tsx
import { useRef } from "react";

const VideoPlayer = blox(() => {
  // Capture useRef via blox.handle()
  const videoRef = blox.handle(() => useRef<HTMLVideoElement>(null));

  const handlePlay = () => {
    videoRef.current?.current?.play();
  };

  const handlePause = () => {
    videoRef.current?.current?.pause();
  };

  return rx(() => (
    <div>
      <video ref={videoRef.current?.current} src="/video.mp4" />
      <button onClick={handlePlay}>Play</button>
      <button onClick={handlePause}>Pause</button>
    </div>
  ));
});
```

#### Forwarding Refs to `blox` Components

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
  ref.current = {
    focus: () => inputRef.current?.focus(),
    clear: () => value.set(""),
  };

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
- ✅ `useRef()` must be captured via `blox.handle()`
- ✅ Access `useRef` values via `videoRef.current?.current` (handle.current → ref.current)
- ✅ Use the second parameter to forward imperative handles to parent components
- ✅ Refs work normally in event handlers and `rx()` expressions

### Optimistic Updates

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

---

## Composable Logic with `blox`

One of the most powerful features of `blox` is the ability to extract and reuse reactive logic. Since signals, effects, and lifecycle hooks can be called anywhere (not just in React components), you can create composable logic functions.

### Naming Conventions

**Universal Logic** (plain names or `xxxLogic` suffix)

- Can be called anywhere
- Only uses: `signal()`, `effect()`, `rx()`
- Example: `counterLogic()`, `formState()`, `timer()`

**Blox-only Logic** (`withXXX` prefix)

- Must be called inside `blox()` components
- Uses blox APIs: `blox.onMount()`, `blox.onUnmount()`, `blox.onRender()`, `blox.handle()`
- Example: `withWebSocket()`, `withCleanup()`, `withReactRouter()`

⚠️ **Never use `useXXX`** - Reserved for React hooks only!

### Basic Example

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

### Blox-only Logic with Cleanup

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

### Complex State Logic

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

### Composing Multiple Functions

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
  const proxy = track({ userId });

  const response = await fetch(`/api/users/${proxy.userId}`, {
    signal: abortSignal,
  });

  return response.json();
});

// Returns Loadable<T>
const loadable = user();
if (loadable.status === "success") {
  console.log(loadable.data);
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

  return <div>{rx(() => local())}</div>;
});

// With imperative ref
interface CounterRef {
  reset: () => void;
}

const MyComponent = blox<Props, CounterRef>((props, ref) => {
  const count = signal(0);

  ref.current = {
    reset: () => count.set(0),
  };

  return <div>{rx(() => count())}</div>;
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
- `Provider` - React component with `{ value: T; children: ReactNode }` props

**Options:**

- `equals?: (a: T, b: T) => boolean` - Custom equality function

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

**Important**: The captured value is only available inside `rx()` expressions or event handlers, not in the component builder phase (which runs only once).

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
- The value is `undefined` during the builder phase
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
  | LoadingLoadable<T> // { status: "loading", data: undefined, error: undefined, loading: true, promise }
  | SuccessLoadable<T> // { status: "success", data: T, error: undefined, loading: false, promise }
  | ErrorLoadable<T>; // { status: "error", data: undefined, error: unknown, loading: false, promise }
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
      console.log(value.data);
      break;
    case "error":
      console.log(value.error);
      break;
  }
}
```

### `wait` / `wait.all`

Waits for all awaitables (signals or promises) to complete successfully.

```tsx
import { wait } from "rxblox";

// Single awaitable
const result = wait(asyncSignal);

// Array of awaitables
const [data1, data2, data3] = wait([signal1, signal2, promise]);
```

**Throws:** If any awaitable fails

### `wait.any(awaitables)`

Waits for the first awaitable to succeed. Returns `[value, key]` tuple.

```tsx
const [data, source] = wait.any({
  primary: primarySignal,
  fallback: fallbackSignal,
});

console.log(`${source} succeeded first:`, data);
```

**Throws:** If all awaitables fail

### `wait.race(awaitables)`

Waits for the first awaitable to complete (success or error). Returns `[value, key]` tuple.

```tsx
const [data, source] = wait.race({
  fast: fastSignal,
  slow: slowSignal,
});
```

### `wait.settled(awaitables)`

Waits for all awaitables to settle. Returns array of `PromiseSettledResult`.

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
- `action.reset()` - Reset to idle state

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

Contributions are welcome! Please feel free to submit a Pull Request.

### Guidelines

1. Write tests for new features
2. Maintain TypeScript type safety
3. Follow existing code style
4. Update documentation as needed

---

Made with ❤️ for the React community
