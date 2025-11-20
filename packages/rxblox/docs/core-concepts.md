# Core Concepts

This guide covers the fundamental building blocks of rxblox: signals, computed values, effects, reactive expressions, reactive components, providers, async signals, loadables, wait utilities, and actions.

## Table of Contents

- [1. Signals - Reactive State Primitives](#1-signals---reactive-state-primitives)
  - [Error Handling in Signals](#error-handling-in-signals)
- [2. Computed Signals - Derived State](#2-computed-signals---derived-state)
- [3. Effects - Side Effects with Auto-Tracking](#3-effects---side-effects-with-auto-tracking)
- [4. Reactive Expressions - rx()](#4-reactive-expressions---rx)
- [5. Reactive Components - blox()](#5-reactive-components---blox)
- [6. Providers - Dependency Injection](#6-providers---dependency-injection)
- [7. Async Signals - signal.async()](#7-async-signals---signalasync)
- [8. Loadable States](#8-loadable-states)
- [9. Wait Utilities](#9-wait-utilities)
- [10. Actions](#10-actions)

---

## 1. Signals - Reactive State Primitives

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

**⚠️ Important: Signals Cannot Hold Promises**

Signals cannot store Promise values directly. This would cause reactivity issues and memory leaks.

```tsx
// ❌ Don't do this
const data = signal(fetch('/api/data')); // Error: Promise not allowed!
const result = signal(async () => { ... }); // Error: Returns Promise!

// ✅ Use signal.async() for async operations
const data = signal.async(async () => {
  const response = await fetch('/api/data');
  return response.json();
});

// ✅ Or manage loading states manually with loadable
const data = signal(loadable('loading'));
fetch('/api/data')
  .then(res => res.json())
  .then(result => data.set(loadable('success', result)))
  .catch(error => data.set(loadable('error', undefined, error)));
```

See [Async Signals](#7-async-signals---signalasync) and [Loadable States](#9-loadable-states) for async handling.

### Error Handling in Signals

Signals automatically catch and store errors during computation:

```tsx
const count = signal(() => {
  if (someInvalidState()) {
    throw new Error("Invalid state");
  }
  return 42;
});

// Reading throws the cached error
try {
  count(); // Throws: "Invalid state"
} catch (error) {
  console.error(error);
}
```

**Error inspection without throwing:**

```tsx
// Check if signal has error
if (count.hasError()) {
  // Get error without throwing
  const error = count.getError();
  console.error("Signal failed:", error);
  
  // Clear error and retry
  count.clearError(); // Triggers recomputation
}
```

**Error propagation:**

Errors flow through the dependency graph:

```tsx
const a = signal(() => {
  throw new Error("A failed");
});

const b = signal(() => a() * 2); // Depends on 'a'
const c = signal(() => b() + 1);  // Depends on 'b'

// All throw the same error
a(); // Throws: "A failed"
b(); // Throws: "A failed"
c(); // Throws: "A failed"
```

**Graceful error handling with fallback:**

```tsx
const data = signal(
  () => {
    const result = riskyOperation();
    if (!result) throw new Error("Failed");
    return result;
  },
  {
    fallback: (error) => {
      console.warn("Using fallback:", error);
      return defaultValue;
    }
  }
);

// Returns fallback value instead of throwing
console.log(data()); // defaultValue
```

**When both computation and fallback fail:**

```tsx
import { FallbackError } from "rxblox";

const problematic = signal(
  () => {
    throw new Error("Primary failed");
  },
  {
    fallback: (error) => {
      throw new Error("Fallback failed");
    }
  }
);

try {
  problematic();
} catch (error) {
  if (error instanceof FallbackError) {
    // Contains both errors + context
    console.error("Original:", error.originalError);
    console.error("Fallback:", error.fallbackError);
    console.error("Context:", error.context);
  }
}
```

**Error recovery in UI:**

```tsx
const UserProfile = blox(() => {
  const user = signal.async(() => fetchUser());
  
  return rx(() => {
    if (user().status === "error") {
      return (
        <div>
          <p>Failed to load user</p>
          <button onClick={() => user.reset()}>Retry</button>
        </div>
      );
    }
    
    return <div>{user().value.name}</div>;
  });
});
```

**Best Practices:**

✅ **Do:**
- Use `fallback` for expected errors with safe defaults
- Use `hasError()` / `getError()` for error inspection
- Use `clearError()` or `reset()` to retry failed operations
- Handle `FallbackError` when both computation and fallback can fail

❌ **Don't:**
- Ignore errors (they propagate to dependent signals)
- Use `try/catch` around signal reads in reactive contexts (breaks reactivity)
- Forget that errors are cached (thrown on every read until cleared)

See [API Reference - Error Handling](./api-reference.md#error-handling) for complete documentation.

## 2. Computed Signals - Derived State

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

### Explicit Dependency Tracking with `track()`

For conditional dependencies or more control, use the `track()` function:

```tsx
const condition = signal(true);
const a = signal(10);
const b = signal(20);

// Only tracks the signals you actually access
const result = signal(({ track }) => {
  const tracked = track({ condition, a, b });

  // Only tracks 'condition' + one of 'a' or 'b' (whichever is accessed)
  return tracked.condition ? tracked.a : tracked.b;
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

## 3. Effects - Side Effects with Auto-Tracking

Effects **run immediately** when created and re-run when their signal dependencies change. They automatically track which signals they access.

**Key Behavior:**
- ✅ Runs immediately (on creation)
- ✅ Consistent behavior inside and outside `blox` components
- ✅ Automatic cleanup on component unmount

```tsx
import { signal, effect } from "rxblox";

const count = signal(0);

// Effect runs immediately
effect(() => {
  console.log("Count is:", count());
  // Logs: "Count is: 0" (immediately)

  // Optional: return cleanup function
  return () => {
    console.log("Effect cleanup");
  };
});

count.set(5); // Logs: "Count is: 5"
```

**Inside blox components:**

```tsx
const MyComponent = blox(() => {
  // Effect runs immediately during component creation
  effect(() => {
    console.log("Effect runs now!");
  });
  
  return <div>Content</div>;
});
```

**If you need effects to run on mount:**

```tsx
const MyComponent = blox(() => {
  blox.on({
    mount: () => {
      // Effect created here runs on mount
      effect(() => {
        console.log("Runs on mount");
      });
    }
  });
  
  return <div>Content</div>;
});
```

## 4. Reactive Expressions - `rx()`

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

## 5. Reactive Components - `blox()`

`blox()` creates reactive components where props become signals and effects are automatically managed.

### Structure of a `blox` Component

A `blox` component has two distinct parts with different execution behavior:

```tsx
const Counter = blox<Props>((props, expose) => {
  // 🔵 DEFINITION PHASE: Runs once per mount (twice in Strict Mode)
  // - Create signals
  // - Set up effects
  // - Define event handlers
  // - Register cleanup with blox.on({ unmount })
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

### Complete Example

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

### Why `blox` vs Traditional React?

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
const Counter = blox(
  (props: { label: string; onCountChange: (n: number) => void }) => {
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

### Using React Hooks with `blox`

Since `blox` components only run their definition phase **once**, you can't use React hooks directly in the definition phase. Use the `blox.hook()` utility to capture hook results:

```tsx
import { blox, signal, rx } from "rxblox";
import { useHistory, useEffect, useState } from "react";

const Counter = blox<Props>((props) => {
  // 🔵 Definition phase - runs ONCE
  const count = signal(0);

  // ✅ CORRECT: Use blox.hook() to capture React hooks
  const router = blox.hook(() => {
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

- **Use `blox.hook()`** - The recommended way to capture React hook results
- **Access via `.current`** - Hook results available in `rx()` expressions and event handlers
- **Undefined in definition phase** - `blox.hook().current` is `undefined` during the definition phase
- **Runs on every render** - The callback passed to `blox.hook()` executes during React's render phase

**Alternative: Manual pattern with `blox.on({ render })`:**

If you prefer more control, you can manually use `blox.on({ render })`:

```tsx
const MyComponent = blox(() => {
  // Define variable in blox scope
  let someHookResult: SomeType | undefined;

  blox.on({
    render: () => {
      // Assign hook result to outer variable
      someHookResult = useSomeHook();
    }
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

## 6. Providers - Dependency Injection

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

### Passing Signals to Providers

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

## 7. Async Signals - `signal.async()`

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

### Dependency Tracking in Async Signals

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

### The `track()` Method - Lazy Tracking for Async Contexts

The `track()` method provides **lazy, fine-grained dependency tracking** that works seamlessly in async contexts. It's available in:

- `signal.async(async ({ track }) => ...)` - Async signal contexts
- `effect(({ track }) => ...)` - Effect contexts

**How it works:**

1. Pass an object where values are **functions** (signals or computed properties)
2. `track()` returns a **lazy proxy** that doesn't track anything yet
3. When you access a property, the proxy executes the function with the dispatcher context
4. This ensures tracking happens at **access time**, maintaining the tracking context even after `await`

#### Basic Usage

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

#### Tracking Props in `blox` Components

A powerful use case is tracking `blox` component props in async contexts:

```tsx
const UserProfile = blox((props: { userId: number; status: string }) => {
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

#### Custom Computed Properties

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

#### Conditional Tracking (Lazy Benefits)

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

#### Best Practices for `track()`

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

#### Tracking in Regular Effects

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

#### Why Use `track()` Over Implicit Tracking?

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

## 8. Loadable States

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

### Creating Loadables

```tsx
import { loadable } from "rxblox";

// Loading state
const loading = loadable("loading", promise);

// Success state
const success = loadable("success", data);

// Error state
const error = loadable("error", errorObj);
```

### Type Guard

```tsx
import { isLoadable } from "rxblox";

if (isLoadable(value)) {
  // TypeScript knows value is Loadable<T>
  if (value.status === "success") {
    console.log(value.value);
  }
}
```

### React Suspense Integration

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

## 9. Wait Utilities

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

### `wait()` / `wait.all()` - Wait for all to complete

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

### `wait.any()` - Wait for first success

```tsx
const fastest = signal.async(async () => {
  // Returns [value, key] from first successful async signal
  const [data, source] = wait.any({ user, posts, comments });

  console.log(`${source} loaded first:`, data);
  return data;
});
```

### `wait.race()` - Wait for first to complete (success or error)

```tsx
const first = signal.async(async () => {
  // Returns [value, key] from first completed async signal
  const [data, source] = wait.race({ primary, fallback });

  return { data, source };
});
```

### `wait.settled()` - Wait for all to settle

```tsx
const allResults = signal.async(async () => {
  // Returns array of PromiseSettledResult
  const results = wait.settled([user, posts, comments]);

  return results.map((r) => (r.status === "fulfilled" ? r.value : r.reason));
});
```

### `wait.timeout()` - Wait with timeout

```tsx
import { wait, TimeoutError } from "rxblox";

// ⚠️ CRITICAL: Use cached signals/loadables only!
const user = signal.async(() => fetchUser());

// Wait up to 5 seconds
const Component = blox(() => {
  return rx(() => {
    try {
      const userData = wait.timeout(user, 5000);
      return <div>{userData.name}</div>;
    } catch (error) {
      if (error instanceof TimeoutError) {
        return <div>Request timed out!</div>;
      }
      throw error;
    }
  });
});

// With custom error message
const userData = wait.timeout(user, 3000, "User fetch took too long");

// Array of awaitables
const [u, p] = wait.timeout([user, posts], 5000);

// Record of awaitables
const { userData, postsData } = wait.timeout(
  { userData: user, postsData: posts },
  5000
);
```

### `wait.fallback()` - Error handling with fallback

```tsx
import { wait } from "rxblox";

// ⚠️ CRITICAL: Use cached signals/loadables only!
const data = signal.async(() => fetchData());

const Component = blox(() => {
  return rx(() => {
    const [result, error] = wait.fallback(
      () => data(),
      { default: "No data available" }
    );
    
    if (error) {
      console.warn("Failed to load:", error);
    }
    
    return <div>{JSON.stringify(result)}</div>;
  });
});

// With fallback function
const [result, error] = wait.fallback(
  () => riskyOperation(),
  () => {
    console.warn("Using fallback");
    return getDefaultValue();
  }
);
```

### `wait.until()` - Wait for condition

```tsx
import { wait } from "rxblox";

// ⚠️ CRITICAL: Use cached signals only!
const count = signal(0);
const user = signal.async(() => fetchUser());

// Wait until count > 5
const Component = blox(() => {
  return rx(() => {
    const value = wait.until(count, (n) => n > 5);
    return <div>Count reached: {value}</div>;
  });
});

// Wait until user is admin
const adminUser = wait.until(user, (u) => u.role === "admin");

// Array with predicate
const [c, n] = wait.until(
  [count, name],
  (c, n) => c > 0 && n.length > 0
);

// Record with predicate
const { userData, postsData } = wait.until(
  { userData: user, postsData: posts },
  ({ userData, postsData }) => {
    return userData.role === "admin" && postsData.length > 0;
  }
);
```

### `wait.never()` - Permanent Suspense

```tsx
import { wait } from "rxblox";

// Suspend forever
const Component = blox(() => {
  return rx(() => {
    if (featureDisabled) {
      wait.never(); // Never resolves
    }
    return <div>Feature enabled</div>;
  });
});
```

**Key Features:**

- 🔗 **Works with signals and promises** - Pass `Signal<Promise<T>>`, `Signal<Loadable<T>>`, or raw promises
- 🎯 **Type-safe** - Full TypeScript inference for results
- ⚡ **Promise caching** - Efficiently tracks promise states
- 🔄 **Automatic updates** - Results update when source signals change
- ⏱️ **Timeout support** - `wait.timeout()` for time-limited operations
- 🛡️ **Error recovery** - `wait.fallback()` for graceful error handling
- 🎨 **Conditional waiting** - `wait.until()` for predicate-based waiting

## 10. Actions

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

### Basic Actions

Actions track their state automatically:

```tsx
const UserProfile = blox((props: { userId: number }) => {
  const fetchUser = action(async (id: number) => {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  });

  // Fetch on mount
  blox.on({
    mount: () => {
      fetchUser(props.userId());
    }
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

### Cancellable Actions

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

### Event Callbacks

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

### Concurrent Call Handling

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

### Subscribing to Actions

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

[Back to Main Documentation](../README.md)

