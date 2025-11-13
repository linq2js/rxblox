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
  // - Register cleanup with on.unmount()
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

Since `blox` components only run their definition phase **once**, you can't use React hooks directly in the definition phase. Use the `handle()` utility to capture hook results:

```tsx
import { blox, handle, signal, rx } from "rxblox";
import { useHistory, useEffect, useState } from "react";

const Counter = blox<Props>((props) => {
  // 🔵 Definition phase - runs ONCE
  const count = signal(0);

  // ✅ CORRECT: Use handle() to capture React hooks
  const router = handle(() => {
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

- **Use `handle()`** - The recommended way to capture React hook results
- **Access via `.current`** - Hook results available in `rx()` expressions and event handlers
- **Undefined in builder phase** - `handle().current` is `undefined` during the definition phase
- **Runs on every render** - The callback passed to `handle()` executes during React's render phase

**Alternative: Manual pattern with `on.render()`:**

If you prefer more control, you can manually use `on.render()`:

```tsx
const MyComponent = blox(() => {
  // Define variable in blox scope
  let someHookResult: SomeType | undefined;

  on.render(() => {
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

  return (
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
  );
});
```

### Async Data Loading

Handle loading states with signals:

```tsx
const UserList = blox(() => {
  const users = signal<User[]>([]);
  const loading = signal(true);
  const error = signal<Error | null>(null);

  effect(() => {
    loading.set(true);
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => users.set(data))
      .catch((err) => error.set(err))
      .finally(() => loading.set(false));
  });

  return rx(() => {
    if (loading()) return <div>Loading...</div>;
    if (error()) return <div>Error: {error()!.message}</div>;
    return (
      <ul>
        {users().map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    );
  });
});
```

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
- Uses blox APIs: `blox.onMount()`, `blox.onUnmount()`, `blox.capture()`
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

  blox.onUnmount(() => ws.close()); // Cleanup

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
  blox.onUnmount(() => clearInterval(timer));
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

---

## Comparison with Other Solutions

### Feature Matrix

| Feature                  | rxblox | React useState | Zustand | Jotai | Solid Signals |
| ------------------------ | ------ | -------------- | ------- | ----- | ------------- |
| Fine-grained reactivity  | ✅     | ❌             | ❌      | ✅    | ✅            |
| Computed values          | ✅     | ❌             | ❌      | ✅    | ✅            |
| Auto dependency tracking | ✅     | ❌             | ❌      | ✅    | ✅            |
| No hooks rules           | ✅     | ❌             | ❌      | ❌    | ✅            |
| Works in React           | ✅     | ✅             | ✅      | ✅    | ❌            |
| Built-in DI              | ✅     | ❌             | ❌      | ❌    | ✅            |
| Zero boilerplate         | ✅     | ✅             | ❌      | ❌    | ✅            |

### Boilerplate Comparisons

#### vs Redux (90% less code)

**Redux** requires extensive boilerplate with actions, reducers, and selectors.

```tsx
// ❌ Redux - Lots of boilerplate (~60 lines across 4 files)
// actions.ts
const INCREMENT = "INCREMENT";
export const increment = () => ({ type: INCREMENT });

// reducer.ts
const initialState = { count: 0 };
export const counterReducer = (state = initialState, action) => {
  switch (action.type) {
    case INCREMENT:
      return { ...state, count: state.count + 1 };
    default:
      return state;
  }
};

// store.ts
import { createStore } from "redux";
const store = createStore(counterReducer);

// Component.tsx
import { useSelector, useDispatch } from "react-redux";
function Counter() {
  const count = useSelector((state) => state.count);
  const dispatch = useDispatch();
  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => dispatch(increment())}>+</button>
    </div>
  );
}
```

```tsx
// ✅ rxblox - Minimal boilerplate (~12 lines, 1 file)
import { signal, rx } from "rxblox";

const count = signal(0);

function Counter() {
  return (
    <div>
      <div>{rx(() => `Count: ${count()}`)}</div>
      <button onClick={() => count.set(count() + 1)}>+</button>
    </div>
  );
}
```

#### vs Zustand (50% less code)

**Zustand** is simpler than Redux but still requires store setup and causes full component re-renders.

```tsx
// ❌ Zustand - Store setup required, component re-renders
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

```tsx
// ✅ rxblox - No store setup, fine-grained updates
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

#### vs Jotai (50% less code)

**Jotai** uses atoms but requires Provider wrapper and is subject to hooks rules.

```tsx
// ❌ Jotai - Provider + hooks required, component re-renders
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

```tsx
// ✅ rxblox - No Provider, no hooks rules, fine-grained updates
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

#### Summary: Lines of Code

For a simple counter with computed value:

| Solution    | Lines of Code | Boilerplate Files                            |
| ----------- | ------------- | -------------------------------------------- |
| **Redux**   | ~60 lines     | 4 files (actions, reducer, store, component) |
| **Zustand** | ~20 lines     | 1 file                                       |
| **Jotai**   | ~25 lines     | 1 file + Provider                            |
| **rxblox**  | ~12 lines     | 1 file                                       |

**rxblox wins on simplicity** with the least code and zero configuration! 🎯

---

## API Reference

### `signal<T>(value, options?)`

Creates a reactive signal.

```tsx
// Static value
const count = signal(0);

// Computed value (auto-tracks dependencies)
const doubled = signal(() => count() * 2);

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

### `on` - Lifecycle Events

Namespace for lifecycle event hooks in `blox` components.

#### `on.render(callback)`

Execute code during React's render phase, enabling React hooks usage.

```tsx
const MyComponent = blox(() => {
  const count = signal(0);

  // Define variables to hold hook results
  let history: ReturnType<typeof useHistory> | undefined;
  let location: ReturnType<typeof useLocation> | undefined;

  // Call React hooks inside on.render()
  on.render(() => {
    history = useHistory();
    location = useLocation();

    useEffect(() => {
      // Note: No signal tracking in on.render() context
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

**Important:** Signals accessed inside `on.render()` are NOT tracked as dependencies - there is no tracking context in `on.render()`.

#### `on.mount(callback)`

Execute code immediately after component mounts.

```tsx
const MyComponent = blox(() => {
  on.mount(() => {
    console.log("Component mounted");
  });

  return <div>Content</div>;
});
```

#### `on.unmount(callback)`

Register cleanup callback that runs on component unmount.

```tsx
const MyComponent = blox(() => {
  on.unmount(() => {
    console.log("Cleanup on unmount");
  });

  return <div>Content</div>;
});
```

### `handle<T>(callback)`

Creates a handle to capture values from React hooks during the render phase.

This is useful in `blox` components where you need to use React hooks, but the component body only runs once. The callback runs on every render via `on.render()`, and the returned value is accessible via `.current`.

**Important**: The captured value is only available inside `rx()` expressions or event handlers, not in the component builder phase (which runs only once).

```tsx
import { blox, handle, signal, rx } from "rxblox";
import { useHistory, useLocation } from "react-router";

const MyComponent = blox(() => {
  const count = signal(0);

  // Capture React hooks
  const router = handle(() => {
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
