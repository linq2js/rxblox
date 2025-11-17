# API Reference

Complete API documentation for all rxblox functions and utilities.

## Table of Contents

- [signal](#signalt)
- [signal.async](#signalasynct)
- [signal.snapshot](#signalsnapshott)
- [signal.history](#signalhistoryt)
- [Signal Persistence](#signal-persistence)
- [Signal Tagging](#signal-tagging)
- [diff](#difft)
- [batch](#batch)
- [effect](#effect)
- [rx](#rx)
- [blox](#blox)
- [blox.onRender](#bloxonrender)
- [blox.onMount](#bloxonmount)
- [blox.onUnmount](#bloxonunmount)
- [blox.handle](#bloxhandlet)
- [blox.slot](#bloxslot)
- [blox.fill](#bloxfill)
- [provider](#providert)
- [loadable](#loadable)
- [isLoadable](#isloadable)
- [wait / wait.all](#wait--waitall)
- [wait.any](#waitany)
- [wait.race](#waitrace)
- [wait.settled](#waitsettled)
- [action](#action)
- [action.cancellable](#actioncancellable)
- [action.aborter](#actionaborter)
- [useAction](#useactiont)
- [useSignals](#usesignalst)
- [useTracked](#usetrackedt)

---

## `signal<T>(value, options?)`

Creates a reactive signal.

```tsx
// Static value
const count = signal(0);

// Computed value (auto-tracks dependencies)
const doubled = signal(() => count() * 2);

// Computed with explicit tracking (lazy - only tracks accessed properties)
const result = signal(({ track }) => {
  const tracked = track({ condition, a, b });
  return tracked.condition ? tracked.a : tracked.b;
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
- `signal.hydrate()` - Reload value from storage (only for persisted signals)

**Context Parameter (for computed signals):**

- `track(signals)` - Creates a proxy for explicit dependency tracking

---

## `signal.async<T>(fn)`

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

---

## `signal.snapshot<T>(input)`

Deep traverses an object or array and extracts all signal values, returning a plain JavaScript value.

This is useful for:
- **API submission** - Prepare reactive state for POST/PUT requests
- **Logging** - Capture current state for debugging
- **Serialization** - Convert reactive state to JSON
- **Testing** - Get snapshot of state for assertions

```tsx
import { signal } from "rxblox";

const todos = signal([
  { id: 1, text: signal("Buy milk"), completed: signal(false) },
  { id: 2, text: signal("Walk dog"), completed: signal(true) },
]);
const filter = signal("all");

// Extract all signal values
const data = signal.snapshot({ todos, filter });
// {
//   todos: [
//     { id: 1, text: "Buy milk", completed: false },
//     { id: 2, text: "Walk dog", completed: true }
//   ],
//   filter: "all"
// }

// Use for API submission
await fetch("/api/todos", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

**Returns:** `T` - A plain JavaScript value with all signals replaced by their current values

**Key Features:**

- ✅ **Deep traversal** - Handles nested objects and arrays
- ✅ **Mixed values** - Preserves plain values, only extracts signals
- ✅ **Non-reactive** - Uses `signal.peek()` internally (no tracking)
- ✅ **Type-safe** - Preserves input structure types
- ✅ **Circular-safe** - Handles circular references gracefully

**Examples:**

```tsx
// Nested structures
const user = {
  name: signal("John"),
  profile: {
    email: signal("john@example.com"),
    settings: {
      theme: signal("dark"),
    },
  },
};

const data = signal.snapshot(user);
// { name: "John", profile: { email: "john@...", settings: { theme: "dark" } } }

// Arrays with signals
const items = [signal(1), signal(2), signal(3)];
const arr = signal.snapshot(items);
// [1, 2, 3]

// Signal containing complex structure
const appState = signal({
  users: [{ id: 1, active: signal(true) }],
  config: { debug: signal(false) },
});

const state = signal.snapshot(appState);
// { users: [{ id: 1, active: true }], config: { debug: false } }

// Mixed plain and reactive values
const form = {
  id: 123, // plain value
  name: signal("Product"),
  price: 99.99, // plain value
  tags: [signal("new"), "featured", signal("sale")], // mixed
};

const formData = signal.snapshot(form);
// { id: 123, name: "Product", price: 99.99, tags: ["new", "featured", "sale"] }
```

**Real-World Use Cases:**

```tsx
// Form submission
const UserForm = blox(() => {
  const name = signal("");
  const email = signal("");
  const notifications = signal({ email: true, push: false });

  const handleSubmit = async () => {
    const data = signal.snapshot({ name, email, notifications });

    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  return rx(() => (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  ));
});

// Logging for debugging
const logState = () => {
  const state = signal.snapshot(appState);
  console.log("Current state:", state);
};
```

**Important Notes:**

- `signal.snapshot()` does **not** track dependencies - it uses `signal.peek()` internally
- Preserves `Date`, `RegExp`, and other special objects
- Returns a plain JavaScript value (not a wrapper object)
- For primitives, returns the unwrapped value directly

---

## `effect(fn)`

Creates a reactive effect that **runs immediately** and re-runs when dependencies change.

**Consistent Behavior:**
- ✅ Global effects (outside blox): Run immediately
- ✅ Effects inside blox: Also run immediately
- No delayed execution, predictable behavior

**When to use:**
- Side effects (logging, analytics, localStorage sync)
- External system synchronization (WebSocket, subscriptions)  
- Multi-signal coordination

```tsx
const count = signal(0);

// Effect runs immediately and on signal changes
effect(() => {
  console.log("Count:", count());
  // Logs: "Count: 0" (immediately)
  
  // Optional cleanup
  return () => console.log("Cleanup");
});

count.set(1); // Logs: "Count: 1"
```

**Inside blox components:**

```tsx
const MyComponent = blox(() => {
  const count = signal(0);
  
  // Runs immediately during component creation
  effect(() => {
    console.log("Effect runs now:", count());
    return () => console.log("Cleanup on unmount or re-run");
  });
  
  return <div>{count()}</div>;
});
```

**If you need effects to run on mount instead:**

```tsx
const MyComponent = blox(() => {
  const count = signal(0);
  
  blox.onMount(() => {
    // Effect created here runs on mount and cleans up on unmount
    effect(() => {
      console.log("Runs on mount:", count());
    });
  });
  
  return <div>{count()}</div>;
});
```

**Returns:** Effect object with `run()` method

---

## `rx(expression)`

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

**Important: Avoid Nested `rx()` Blocks**

`rx()` will throw an error if called inside another `rx()` block. Nesting is inefficient and unnecessary:

```tsx
// ❌ BAD - Nested rx() blocks
{rx(() => (
  <div>
    {rx(() => <span>Nested</span>)}  // Throws error!
  </div>
))}

// ✅ GOOD - Consolidate into single rx()
{rx(() => (
  <div>
    <span>Not nested</span>
  </div>
))}

// ✅ GOOD - Move independent rx() to stable scope
const block = rx(() => <span>Independent</span>);
return <div>{block}</div>;
```

**Why?** Nested `rx()` blocks:
- Create unnecessary tracking overhead
- Recreate inner subscriptions on every outer re-run
- Provide no benefit over consolidation or stable scope

See [Best Practices](#best-practices) for more details.

---

## `blox<Props>(builder)`

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

---

## `blox.onRender(callback)`

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

---

## `blox.onMount(callback)`

Execute code immediately after component mounts.

```tsx
const MyComponent = blox(() => {
  blox.onMount(() => {
    console.log("Component mounted");
  });

  return <div>Content</div>;
});
```

---

## `blox.onUnmount(callback)`

Register cleanup callback that runs on component unmount.

```tsx
const MyComponent = blox(() => {
  blox.onUnmount(() => {
    console.log("Cleanup on unmount");
  });

  return <div>Content</div>;
});
```

---

## `blox.handle<T>(callback)`

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

---

## `blox.slot()`

Creates a slot with logic and dynamic content filling.

**Must be called inside a `blox` component.**

A slot allows you to:
1. Run logic and computations once during component initialization
2. Conditionally fill the slot with content using `blox.fill()`
3. Return a result value from the logic
4. Render the filled content in your component

**Signature:**

```ts
function slot<T>(fn: () => T): [ReactNode, T];
function slot<T>(fn: () => T, options: SlotOptions): [ReactNode, T];
```

**Parameters:**
- `fn: () => T` - Function containing logic that may call `blox.fill()`
- `options?: SlotOptions` - Optional configuration:
  - `mode?: "replace" | "once" | "append"` - How to handle multiple fills (default: `"replace"`)

**Returns:**

`[slotComponent, result]` tuple where:
- `slotComponent`: ReactNode to render (the filled content)
- `result`: Return value from the function

**Modes:**

| Mode | Behavior |
|------|----------|
| `"replace"` | Latest `fill()` wins (default) |
| `"once"` | Throws error if `fill()` called multiple times |
| `"append"` | Collects all fills into an array |

**Example: Basic Usage**

```tsx
const MyComponent = blox<{ items: Item[] }>((props) => {
  // Create slot with logic
  const [ItemList, count] = blox.slot(() => {
    const filtered = props.items.filter(item => item.active);
    
    if (filtered.length === 0) {
      blox.fill(<p>No active items</p>);
    } else {
      blox.fill(
        <ul>
          {filtered.map(item => <li key={item.id}>{item.name}</li>)}
        </ul>
      );
    }
    
    return filtered.length;
  });

  return (
    <div>
      <h2>Active Items: {count}</h2>
      {ItemList}
    </div>
  );
});
```

**Example: With Modes**

```tsx
// Strict mode - throw on multiple fills
const [Content, data] = blox.slot(() => {
  const result = compute();
  blox.fill(<div>{result}</div>);
  // blox.fill(<div>Another</div>); // ❌ Error!
  return result;
}, { mode: "once" });

// Append mode - collect all fills
const [Items, count] = blox.slot(() => {
  items.forEach(item => {
    blox.fill(<Item key={item.id} {...item} />);
  });
  return items.length;
}, { mode: "append" });
```

**Example: Reactive Content with `rx()`**

```tsx
const [TodoList, total] = blox.slot(() => {
  const todos = signal([{ id: 1, text: "Buy milk" }]);
  
  // Fill with reactive content
  blox.fill(rx(() => {
    const items = todos();
    return (
      <ul>
        {items.map(todo => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    );
  }));
  
  return todos().length;
});

// The TodoList updates reactively when todos signal changes
```

**Key Features:**

- ✅ Logic runs once at component initialization
- ✅ Content is static once filled (use `rx()` for reactivity)
- ✅ Multiple slots per component
- ✅ Type-safe return values
- ✅ Conditional rendering without JSX ternaries

**When to Use:**

- Encapsulate complex logic with associated UI
- Compute derived values while rendering content
- Conditional layouts with logic separation
- Multiple fill patterns (replace/once/append)

---

## `blox.fill()`

Fills the current active slot with content.

**Must be called inside a `blox.slot()` callback.**

**Signature:**

```ts
function fill(content: ReactNode): void;
```

**Parameters:**
- `content: ReactNode` - React node to render in the slot

**Behavior:**

The behavior depends on the slot's mode:
- `replace` (default): Latest fill wins, replaces previous content
- `once`: Throws error if called multiple times
- `append`: Collects all fills into an array

**Example: Conditional Fills**

```tsx
const [Slot, value] = blox.slot(() => {
  const result = compute();
  
  if (result > 10) {
    blox.fill(<HighValue value={result} />);
  } else {
    blox.fill(<LowValue value={result} />);
  }
  
  return result;
});
```

**Example: Dynamic Reactive Content**

```tsx
const [DynamicContent, count] = blox.slot(() => {
  const items = signal(['apple', 'banana']);
  
  blox.fill(rx(() => {
    // This updates reactively when items() changes
    return (
      <ul>
        {items().map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }));
  
  return items().length;
});
```

**Example: Append Mode**

```tsx
const [ItemList, total] = blox.slot(() => {
  items.forEach(item => {
    blox.fill(<li key={item.id}>{item.name}</li>);
  });
  return items.length;
}, { mode: "append" });
// Renders all items
```

**Notes:**

- Must be called within a `blox.slot()` callback
- Can be called with `ReactNode`, including `rx()` expressions
- Multiple calls behavior determined by slot mode
- Content is filled once (use `rx()` for reactive updates)

---

## `provider<T>(name, initialValue, options?)`

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

---

## `loadable(status, value, promise?)`

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

---

## `isLoadable(value)`

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

---

## `wait` / `wait.all`

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

---

## `wait.any(awaitables)`

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

---

## `wait.race(awaitables)`

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

---

## `wait.settled(awaitables)`

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

---

## `action<TResult, TArgs>(fn, options?)`

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

---

## `action.cancellable<TResult, TArgs>(fn, options?)`

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

---

## `action.aborter()`

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

---

## `useAction<T>(actionOrFn, options?)`

React hook that makes actions reactive in components and custom hooks.

This hook provides two modes of operation:

**Mode 1: Reactive Global Action**
- Pass an existing Action object (e.g., from module scope)
- The hook subscribes to the action and triggers re-renders on state changes
- Useful for sharing actions across multiple components

**Mode 2: Local Action Creation**
- Pass an action function with optional options
- The hook creates a cancellable action automatically
- The action is scoped to the component instance
- Useful for component-specific async operations

### Parameters

- `actionOrFn`: Either an existing `Action` object or a function `(abortSignal, ...args) => result`
- `options?`: Optional `ActionOptions<T>` for callbacks (`on: { init, loading, success, error, done, reset }`)

### Returns

`Action<TArgs, TResult>` - The action object with reactive subscription

### Key Features

- ✅ **Automatic reactivity** - Component re-renders when action state changes
- ✅ **Two modes** - Use global actions or create local ones
- ✅ **Microtask debouncing** - Batches multiple state changes into one render
- ✅ **TypeScript support** - Full type inference for parameters and results
- ✅ **No auto-cancellation** - Actions continue running after component unmounts (especially important for global actions)

### Examples

**Example 1: Using Global Action**

```tsx
import { cancellableAction, useAction } from "rxblox";

// store.ts - Global action
export const fetchUser = cancellableAction(async (signal, id: number) => {
  const response = await fetch(`/api/users/${id}`, { signal });
  return response.json();
});

// Component.tsx - Make it reactive
const UserProfile = ({ userId }: { userId: number }) => {
  const fetchUserAction = useAction(fetchUser);
  
  return (
    <div>
      <button onClick={() => fetchUserAction(userId)}>
        Load User
      </button>
      
      {fetchUserAction.status === 'loading' && <div>Loading...</div>}
      
      {fetchUserAction.error && (
        <div>Error: {fetchUserAction.error.message}</div>
      )}
      
      {fetchUserAction.result && (
        <div>
          <h2>{fetchUserAction.result.name}</h2>
          <p>{fetchUserAction.result.email}</p>
        </div>
      )}
    </div>
  );
};
```

**Example 2: Creating Local Action**

```tsx
import { useAction } from "rxblox";

const SearchComponent = () => {
  // Create local action scoped to this component
  const searchAction = useAction(
    async (signal, query: string) => {
      const response = await fetch(`/api/search?q=${query}`, { signal });
      return response.json();
    },
    {
      on: {
        success: (results) => console.log('Found:', results.length),
        error: (error) => console.error('Search failed:', error)
      }
    }
  );

  return (
    <div>
      <input 
        onChange={(e) => searchAction(e.target.value)}
        placeholder="Search..."
      />
      
      {searchAction.status === 'loading' && <div>Searching...</div>}
      
      {searchAction.result?.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
};
```

**Example 3: With Loading States**

```tsx
const UploadComponent = () => {
  const uploadAction = useAction(async (signal, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      signal
    });
    
    return response.json();
  });

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => uploadAction(e.target.files[0])}
        disabled={uploadAction.status === 'loading'}
      />
      
      {uploadAction.status === 'loading' && <progress />}
      {uploadAction.status === 'error' && <div>Upload failed!</div>}
      {uploadAction.result && <div>Uploaded: {uploadAction.result.url}</div>}
    </div>
  );
};
```

**Example 4: Shared Global Action Across Components**

```tsx
// store.ts
export const deleteUser = cancellableAction(async (signal, id: number) => {
  await fetch(`/api/users/${id}`, { 
    method: 'DELETE',
    signal 
  });
});

// UserList.tsx
const UserList = () => {
  const deleteAction = useAction(deleteUser);
  
  return (
    <div>
      {users.map(user => (
        <button onClick={() => deleteAction(user.id)}>
          Delete {user.name}
        </button>
      ))}
      
      {deleteAction.status === 'loading' && <div>Deleting...</div>}
    </div>
  );
};

// UserDetail.tsx - Same action, different component
const UserDetail = ({ userId }) => {
  const deleteAction = useAction(deleteUser);
  
  return (
    <div>
      <button onClick={() => deleteAction(userId)}>Delete</button>
      {deleteAction.status === 'loading' && <span>Deleting...</span>}
    </div>
  );
};

// Both components see the same action state!
```

**Action Properties:**

- `action.status` - Current status: `"idle"` | `"loading"` | `"success"` | `"error"`
- `action.result` - Last successful result (`undefined` if not succeeded yet)
- `action.error` - Last error (`undefined` if no error yet)
- `action.calls` - Number of times the action has been called
- `action.on(listener)` - Subscribe to state changes
- `action.reset()` - Reset to idle state
- `action.cancel()` - Cancel running action (for cancellable actions only)
- `action.cancelled` - Whether action was cancelled (for cancellable actions only)

---

## Signal Persistence

Signals can automatically persist their values to storage (localStorage, IndexedDB, server, etc.) and hydrate on initialization.

### Creating a Persisted Signal

```tsx
import { signal } from "rxblox";
import type { Persistor } from "rxblox";

// Define a persistor for localStorage
const createLocalStoragePersistor = <T>(key: string): Persistor<T> => ({
  get: () => {
    const item = localStorage.getItem(key);
    return item ? { value: JSON.parse(item) } : null;
  },
  set: (value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  on: (callback: VoidFunction) => {
    const handler = (e: StorageEvent) => {
      if (e.key === key) callback();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
});

// Create a persisted signal
const count = signal(0, {
  persist: createLocalStoragePersistor("count"),
});

// Signal automatically:
// - Hydrates from storage on initialization
// - Persists to storage on every set()
// - Re-hydrates when storage changes externally (e.g., other tabs)
```

### Persistor Interface

```ts
interface Persistor<T> {
  /**
   * Retrieves the persisted value.
   * Can be sync or async.
   * Return null if no value exists in storage.
   */
  get(): { value: T } | null | Promise<{ value: T } | null>;

  /**
   * Persists the value to storage.
   * Can be sync or async.
   * Throw an error if persistence fails.
   */
  set(value: T): void | Promise<void>;

  /**
   * Optional: Subscribe to external storage changes.
   * Called when storage changes outside this signal (e.g., other tabs).
   * Return an unsubscribe function.
   */
  on?(callback: VoidFunction): VoidFunction;
}
```

### Persistence Status

Persisted signals have a `persistInfo` property that tracks persistence status:

```tsx
const count = signal(0, { persist: myPersistor });

// Access persistence status (reactive!)
rx(() => {
  const { status, error, promise } = count.persistInfo;
  
  if (status === "reading") return <Spinner />;
  if (status === "read-failed") return <Error error={error} />;
  if (status === "writing") return <SavingIndicator />;
  
  return <div>{count()}</div>;
});
```

**PersistStatus Values:**

- `"idle"` - No persistence configured
- `"reading"` - Loading from storage
- `"read-failed"` - Failed to load from storage
- `"writing"` - Saving to storage
- `"write-failed"` - Failed to save to storage
- `"synced"` - Successfully synchronized with storage

**PersistInfo Type:**

```ts
type PersistInfo = {
  status: PersistStatus;
  error?: unknown;           // Error from last failed operation
  promise?: Promise<unknown>; // Current async operation (if any)
};
```

### Manual Hydration with `signal.hydrate()`

Persisted signals expose a `hydrate()` method to manually reload from storage:

```tsx
const user = signal(null, { persist: userPersistor });

// Reload from storage
user.hydrate();

// Use cases:
// 1. Retry after error
if (user.persistInfo.status === "read-failed") {
  user.hydrate(); // Retry loading
}

// 2. Manual refresh
button.onClick(() => {
  user.hydrate(); // Refresh from storage
});

// 3. Clear dirty flag and reload
user.set(localChanges);
// ... user makes more changes ...
user.hydrate(); // Discard local changes, reload from storage
```

**Key Features:**

- ✅ Clears the "dirty" flag (allows hydrated value to overwrite local changes)
- ✅ Triggers loading status (`"reading"`)
- ✅ Works with both sync and async persistors
- ✅ Handles errors gracefully
- ✅ Safe to call multiple times (race conditions handled)

### Advanced Features

#### Zero-Flicker Hydration

Synchronous persistors apply values **immediately** (no loading state):

```tsx
const persistor: Persistor<number> = {
  get: () => {
    const item = localStorage.getItem("count");
    return item ? { value: JSON.parse(item) } : null;
  },
  set: (value) => localStorage.setItem("count", JSON.stringify(value)),
};

const count = signal(0, { persist: persistor });

// count() is already hydrated (no flicker!)
console.log(count()); // Value from localStorage
console.log(count.persistInfo.status); // "synced" (not "reading")
```

#### Dirty Tracking

If you modify a signal before async hydration completes, the signal becomes "dirty" and hydration won't overwrite your changes:

```tsx
const persistor: Persistor<number> = {
  get: async () => {
    await delay(100);
    return { value: 42 };
  },
  set: vi.fn(),
};

const count = signal(0, { persist: persistor });

// Modify before hydration completes
count.set(100);

// Wait for hydration
await delay(150);

// Value NOT overwritten (dirty flag protected it)
console.log(count()); // 100 (not 42)
```

Use `signal.hydrate()` to explicitly reload and clear the dirty flag:

```tsx
count.hydrate(); // Clears dirty flag and reloads
await delay(10);
console.log(count()); // 42 (from storage)
```

#### External Changes (Cross-Tab Sync)

Use `persistor.on` to sync when storage changes externally:

```tsx
const persistor: Persistor<number> = {
  get: () => {
    const item = localStorage.getItem("count");
    return item ? { value: JSON.parse(item) } : null;
  },
  set: (value) => {
    localStorage.setItem("count", JSON.stringify(value));
  },
  on: (callback) => {
    const handler = (e: StorageEvent) => {
      if (e.key === "count") callback();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
};

const count = signal(0, { persist: persistor });

// Now count auto-updates when localStorage changes in other tabs!
```

#### Race Condition Handling

Multiple concurrent operations are handled safely:

```tsx
// Scenario: Multiple writes in rapid succession
count.set(1);
count.set(2);
count.set(3);

// All writes are triggered, but status reflects the LATEST operation
// Stale promises don't overwrite newer status
```

### Examples

**LocalStorage Persistence:**

```tsx
const createLocalStoragePersistor = <T>(key: string): Persistor<T> => ({
  get: () => {
    try {
      const item = localStorage.getItem(key);
      return item ? { value: JSON.parse(item) } : null;
    } catch {
      return null;
    }
  },
  set: (value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  on: (callback) => {
    const handler = (e: StorageEvent) => {
      if (e.key === key) callback();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
});

// Usage
const theme = signal("light", {
  persist: createLocalStoragePersistor("theme"),
});
```

**IndexedDB Persistence:**

```tsx
const createIndexedDBPersistor = <T>(
  dbName: string,
  storeName: string,
  key: string
): Persistor<T> => ({
  get: async () => {
    const db = await openDB(dbName, 1);
    const tx = db.transaction(storeName, "readonly");
    const value = await tx.objectStore(storeName).get(key);
    return value ? { value } : null;
  },
  set: async (value: T) => {
    const db = await openDB(dbName, 1);
    const tx = db.transaction(storeName, "readwrite");
    await tx.objectStore(storeName).put(value, key);
  },
});

// Usage
const userData = signal({ name: "", email: "" }, {
  persist: createIndexedDBPersistor("myApp", "users", "currentUser"),
});
```

**Server Persistence:**

```tsx
const createServerPersistor = <T>(url: string): Persistor<T> => ({
  get: async () => {
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to load");
    const value = await response.json();
    return { value };
  },
  set: async (value: T) => {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error("Failed to save");
  },
});

// Usage
const settings = signal({ theme: "light", locale: "en" }, {
  persist: createServerPersistor("/api/settings"),
});
```

**UI with Loading States:**

```tsx
const user = signal(null, {
  persist: createServerPersistor("/api/user"),
});

export const UserProfile = blox(() => {
  return rx(() => {
    const info = user.persistInfo;
    
    // Show loading spinner
    if (info.status === "reading") {
      return <Spinner />;
    }
    
    // Show error with retry button
    if (info.status === "read-failed") {
      return (
        <div>
          <p>Failed to load user: {String(info.error)}</p>
          <button onClick={() => user.hydrate()}>Retry</button>
        </div>
      );
    }
    
    // Show saving indicator
    const currentUser = user();
    return (
      <div>
        <h1>{currentUser?.name}</h1>
        {info.status === "writing" && <span>Saving...</span>}
        {info.status === "write-failed" && (
          <span>Failed to save: {String(info.error)}</span>
        )}
      </div>
    );
  });
});
```

---

## Signal Tagging

Tags allow you to group signals together and perform batch operations on them. This is useful for:
- Resetting form fields
- Disposing resources
- Debugging and logging
- Batch updates

### Creating and Using Tags

```tsx
import { tag, signal } from "rxblox";

// Create a tag for grouping signals
const formTag = tag<string>();

// Create signals with tags
const name = signal("", { tags: [formTag] });
const email = signal("", { tags: [formTag] });
const phone = signal("", { tags: [formTag] });

// Reset all form fields at once
const resetForm = () => {
  formTag.forEach(signal => signal.reset());
};
```

### Tag API

```ts
// Create a tag
function tag<T>(): Tag<T>;

// Tag instance methods
type Tag<T> = {
  forEach(fn: (signal: MutableSignal<T>) => void): void;
  signals(): MutableSignal<T>[];
  has(signal: MutableSignal<T>): boolean;
  delete(signal: MutableSignal<T>): boolean;
  clear(): void;
  readonly size: number;
};

// Static methods for multi-tag operations
namespace tag {
  function forEach<T extends readonly Tag<any>[]>(
    tags: T,
    fn: (signal: MutableSignal<UnionOfTagTypes<T>>) => void
  ): void;

  function signals<T extends readonly Tag<any>[]>(
    tags: T
  ): MutableSignal<UnionOfTagTypes<T>>[];
}
```

### Instance Methods

#### `tag.forEach(fn)`

Iterates over all signals in the tag.

```tsx
const counterTag = tag<number>();
const count1 = signal(0, { tags: [counterTag] });
const count2 = signal(0, { tags: [counterTag] });

// Increment all counters
counterTag.forEach(signal => {
  signal.set(prev => prev + 1);
});
```

#### `tag.signals()`

Returns all signals in the tag as an array.

```tsx
const formTag = tag<string>();
const fields = formTag.signals();
console.log(`Form has ${fields.length} fields`);
```

#### `tag.has(signal)`

Checks if a signal belongs to the tag.

```tsx
const myTag = tag<string>();
const s1 = signal("a", { tags: [myTag] });

if (myTag.has(s1)) {
  console.log("Signal is in tag");
}
```

#### `tag.delete(signal)`

Removes a signal from the tag.

```tsx
myTag.delete(s1);
console.log(myTag.has(s1)); // false
```

#### `tag.clear()`

Removes all signals from the tag.

```tsx
myTag.clear();
console.log(myTag.size); // 0
```

#### `tag.size`

Returns the number of signals in the tag.

```tsx
console.log(`Tag has ${myTag.size} signals`);
```

### Multi-Tag Operations

#### `tag.forEach([tags], fn)`

Static method to iterate over signals from multiple tags.

The callback receives signals typed as a union of all tag types.

```tsx
const stringTag = tag<string>();
const numberTag = tag<number>();

signal("hello", { tags: [stringTag] });
signal(42, { tags: [numberTag] });

// Iterate over both tags
tag.forEach([stringTag, numberTag], (signal) => {
  // signal type: MutableSignal<string | number>
  console.log(signal.peek());
});
```

**Deduplication:** If a signal belongs to multiple tags, it appears only once in the iteration.

```tsx
const tag1 = tag<string>();
const tag2 = tag<string>();

const shared = signal("shared", { tags: [tag1, tag2] });
signal("only1", { tags: [tag1] });
signal("only2", { tags: [tag2] });

const count = { value: 0 };
tag.forEach([tag1, tag2], () => {
  count.value++;
});

console.log(count.value); // 3 (not 4 - shared counted once)
```

#### `tag.signals([tags])`

Static method to get all signals from multiple tags as an array.

```tsx
const allSignals = tag.signals([stringTag, numberTag]);
// allSignals: MutableSignal<string | number>[]
```

### Multiple Tags per Signal

Signals can belong to multiple tags simultaneously.

```tsx
const requiredTag = tag<string>();
const validatedTag = tag<string>();

const name = signal("", { tags: [requiredTag, validatedTag] });
const email = signal("", { tags: [requiredTag, validatedTag] });
const bio = signal("", { tags: [validatedTag] }); // Optional field

// Validate only required fields
const hasEmptyRequired = requiredTag
  .signals()
  .some(s => s.peek() === "");
```

### Automatic Cleanup

Signals are automatically removed from tags when disposed via `disposableToken`.

```tsx
import { disposable, tag, signal } from "rxblox";

const resourceTag = tag<Connection>();

disposable(() => {
  const conn1 = signal(connection1, { tags: [resourceTag] });
  const conn2 = signal(connection2, { tags: [resourceTag] });

  console.log(resourceTag.size); // 2

  // When disposable scope ends, signals are removed from tags
});

console.log(resourceTag.size); // 0
```

### Examples

**Form Reset:**

```tsx
const formTag = tag<string | boolean>();
const name = signal("", { tags: [formTag] });
const email = signal("", { tags: [formTag] });
const agreed = signal(false, { tags: [formTag] });

const resetForm = () => {
  formTag.forEach(signal => signal.reset());
};
```

**Batch Updates:**

```tsx
const counterTag = tag<number>();
const count1 = signal(0, { tags: [counterTag] });
const count2 = signal(0, { tags: [counterTag] });
const count3 = signal(0, { tags: [counterTag] });

const incrementAll = () => {
  counterTag.forEach(s => s.set(prev => prev + 1));
};
```

**Resource Disposal:**

```tsx
const resourceTag = tag<Connection>();
const connections = [conn1, conn2, conn3].map(conn =>
  signal(conn, { tags: [resourceTag] })
);

onCleanup(() => {
  resourceTag.forEach(s => s.peek()?.close());
  resourceTag.clear();
});
```

**Debugging:**

```tsx
const debugTag = tag<unknown>();
const count = signal(0, { tags: [debugTag] });
const name = signal("Alice", { tags: [debugTag] });
const active = signal(true, { tags: [debugTag] });

effect(() => {
  console.group("Debug Signals");
  debugTag.forEach((signal, index) => {
    console.log(`Signal ${index}:`, signal.peek());
  });
  console.groupEnd();
});
```

**Conditional Operations:**

```tsx
const numberTag = tag<number>();
const a = signal(5, { tags: [numberTag] });
const b = signal(10, { tags: [numberTag] });
const c = signal(15, { tags: [numberTag] });

// Reset only values > 10
numberTag.forEach(s => {
  if (s.peek() > 10) {
    s.reset();
  }
});
```

**Form Validation with Multiple Tags:**

```tsx
const requiredTag = tag<string>();
const emailTag = tag<string>();

const name = signal("", { tags: [requiredTag] });
const email = signal("", { tags: [requiredTag, emailTag] });
const phone = signal(""); // Optional, no tags

const validateRequired = () => {
  return requiredTag.signals().every(s => s.peek() !== "");
};

const validateEmails = () => {
  return emailTag.signals().every(s => {
    const value = s.peek();
    return value.includes("@");
  });
};

const isFormValid = () => {
  return validateRequired() && validateEmails();
};
```

---

## `diff<T>(current, previous)`

Compares two JavaScript values and returns only the changed properties.

This utility works with **any** JavaScript values (not signal-specific). Useful for:
- **Change tracking** - Detect what changed between states
- **Optimized API calls** - Send only modified fields with PATCH requests
- **Dirty checking** - Detect if form data was modified
- **Undo/redo** - Track state changes over time

```tsx
import { diff } from "rxblox";

const before = { count: 0, name: "John", age: 30 };
const after = { count: 5, name: "John", age: 30 };

const delta = diff(after, before);
// { count: 5 }  (only changed properties)
```

**Returns:** `Partial<T> | undefined` - Object with only changed properties, or `undefined` if no changes

**Key Features:**

- ✅ **Deep comparison** - Handles nested objects and arrays
- ✅ **Optimized** - Returns only what changed
- ✅ **Flexible** - Works with any JavaScript values
- ✅ **Array detection** - Returns entire array if any element changes

**Examples:**

```tsx
// Nested object changes
const before = {
  user: { name: "John", age: 30 },
  count: 5,
};
const after = {
  user: { name: "Jane", age: 30 },
  count: 5,
};

const delta = diff(after, before);
// { user: { name: "Jane" } }  (only nested changes)

// Detect new properties
const delta2 = diff(
  { count: 0, name: "John" },
  { count: 0 }
);
// { name: "John" }

// Detect deleted properties
const delta3 = diff(
  { count: 0 },
  { count: 0, name: "John" }
);
// { name: undefined }

// No changes returns undefined
const delta4 = diff(
  { count: 0, name: "John" },
  { count: 0, name: "John" }
);
// undefined
```

**Real-World Use Cases:**

```tsx
// 1. Form change tracking with signals
const FormWithChanges = blox(() => {
  const name = signal("John");
  const email = signal("john@example.com");
  const age = signal(30);

  const initial = signal.snapshot({ name, email, age });

  const handleSubmit = async () => {
    const current = signal.snapshot({ name, email, age });
    const changes = diff(current, initial);

    if (!changes) {
      alert("No changes to save");
      return;
    }

    // Send only changed fields
    await fetch("/api/users/123", {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  };

  return rx(() => (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  ));
});

// 2. Optimistic updates with rollback
const saveSettings = async (settings: any) => {
  const before = signal.snapshot(settings);

  try {
    settings.theme.set("dark");
    const after = signal.snapshot(settings);
    const changes = diff(after, before);

    // Send only changes to API
    await api.updateSettings(changes);
  } catch (error) {
    // Rollback on error
    Object.assign(settings, before);
  }
};

// 3. Dirty check indicator
const FormWithDirtyCheck = blox(() => {
  const name = signal("John");
  const email = signal("john@example.com");

  const initial = signal.snapshot({ name, email });

  const isDirty = signal(() => {
    const current = signal.snapshot({ name, email });
    return diff(current, initial) !== undefined;
  });

  const changes = signal(() => {
    const current = signal.snapshot({ name, email });
    return diff(current, initial);
  });

  return rx(() => (
    <div>
      <input value={name()} onChange={(e) => name.set(e.target.value)} />
      <input value={email()} onChange={(e) => email.set(e.target.value)} />
      {isDirty() && (
        <div>
          <p>Unsaved changes: {JSON.stringify(changes())}</p>
          <button>Save Changes</button>
        </div>
      )}
    </div>
  ));
});

// 4. Change history tracking
const changeHistory: any[] = [];

const trackChange = () => {
  const current = signal.snapshot(appState);
  const previous = changeHistory[changeHistory.length - 1];

  if (previous) {
    const delta = diff(current, previous);
    if (delta) {
      changeHistory.push({ timestamp: Date.now(), changes: delta });
    }
  } else {
    changeHistory.push(current);
  }
};
```

**Important Notes:**

- `diff()` is **not signal-specific** - it works with any JavaScript values
- Use with `signal.snapshot()` to compare reactive state
- Arrays: Returns entire array if any element changed (not individual element diffs)
- Returns `undefined` if values are identical
- Handles `Date`, `RegExp`, and other special objects by reference

---

## `batch(fn)`

Groups multiple signal updates into a single operation, preventing unnecessary recomputations and re-renders.

**Parameters:**
- `fn: () => T` - Function containing signal updates

**Returns:** `T` - The return value of `fn`

```tsx
import { batch, signal } from "rxblox";

const a = signal(1);
const b = signal(2);
const sum = signal(() => a() + b());

// Without batch: sum recomputes twice
a.set(10);  // sum recomputes → 12
b.set(20);  // sum recomputes → 30

// With batch: sum recomputes once
batch(() => {
  a.set(10);
  b.set(20);
}); // sum recomputes once → 30
```

**Key Features:**

1. **Deferred Notifications** - Signal listeners are queued and notified after batch completes
2. **Async Recomputation** - Computed signals mark as dirty and recompute in a microtask
3. **Stale Values During Batch** - Accessing computed signals during batch returns last computed value
4. **Nested Batch Support** - Automatically tracks batch depth for nested batches
5. **Error Handling** - Notifications flush even if `fn` throws an error
6. **Tracking Disabled** - Signal tracking is automatically disabled during batches to prevent creating dependencies on stale computed values

**Tracking Disabled During Batch:**

Signal tracking is automatically disabled inside `batch()` to prevent effects and computed signals from creating dependencies on intermediate states:

```tsx
const a = signal(1);
const b = signal(2);
const sum = signal(() => a() + b());

effect(() => {
  batch(() => {
    a.set(10);
    b.set(20);
    
    // ❌ This would be problematic if tracking were enabled:
    // - sum() might return stale value
    // - Creating an effect here would track intermediate state
    // - Could lead to race conditions and inconsistent updates
    
    const value = sum(); // Access is fine, but tracking is disabled
    console.log(value);
  });
});
```

**Why?** During a batch, computed signals may be marked as dirty but haven't recomputed yet. If tracking were enabled, you could accidentally create dependencies on stale or intermediate states.

**Preventing Inconsistent State:**

```tsx
// Problem: Multiple related signals
const keys = signal(["a", "b", "c"]);
const values = signal({ a: 1, b: 2, c: 3 });

const mapped = signal(() => {
  const k = keys();
  const v = values();
  return k.map((key) => v[key]);
});

// ❌ Without batch - inconsistent intermediate state
keys.set(["a", "b"]);        // mapped recomputes, sees mismatched keys/values
values.set({ a: 10, b: 20 }); // mapped recomputes again

// ✅ With batch - consistent state
batch(() => {
  keys.set(["a", "b"]);
  values.set({ a: 10, b: 20 });
}); // mapped recomputes once with consistent state
```

**Nested Batches:**

```tsx
const count = signal(0);

batch(() => {
  count.set(1);
  
  batch(() => {
    count.set(2);
    
    batch(() => {
      count.set(3);
    });
  });
  
  // Still inside outer batch
});

// All notifications fire after outermost batch completes
```

**With React Components:**

```tsx
const Counter = blox(() => {
  const count = signal(0);
  const doubled = signal(() => count() * 2);

  const incrementTwice = () => {
    batch(() => {
      count.set(count() + 1);
      count.set(count() + 1);
    });
    // Component re-renders once, not twice
  };

  return rx(() => (
    <div>
      <div>Count: {count()}</div>
      <div>Doubled: {doubled()}</div>
      <button onClick={incrementTwice}>+2</button>
    </div>
  ));
});
```

**Best Practices:**

✅ **Do:**
- Batch related signal updates
- Use in performance-critical paths (loops, event handlers)
- Batch to prevent inconsistent intermediate states

❌ **Don't:**
- Batch single signal updates (unnecessary overhead)
- Expect async operations to be batched (they run outside the batch)
- Over-batch everything

**Alternative: Combined State**

For tightly coupled state, consider a single signal instead:

```tsx
// Instead of batching separate signals
const keys = signal([...]);
const values = signal({...});

batch(() => {
  keys.set([...]);
  values.set({...});
});

// Better: Single signal with structured data
const state = signal({ keys: [...], values: {...} });

state.set((draft) => {
  draft.keys = [...];
  draft.values = {...};
}); // Atomic update, no batch needed
```

**See Also:**
- [Batching Guide](./batching.md) - Comprehensive batching documentation
- [Performance Best Practices](../README.md#performance-best-practices)

---

## `signal.history<T>(getValue, options?)`

Tracks the history of a signal's values over time, recording each change with timestamp and sequential index.

This utility automatically records snapshots of tracked values whenever they change, with optional debouncing and custom filtering. Useful for:
- **Undo/redo** - Navigate through past states
- **Time-travel debugging** - Review state changes over time
- **Audit logs** - Track when and how values changed
- **Form history** - Track user input changes
- **Performance analysis** - See when and how often values change

```tsx
import { signal } from "rxblox";

const count = signal(0);
const history = signal.history(() => count(), { debounce: 300 });

count.set(1);
count.set(2);
count.set(3);

// After 300ms debounce
console.log(history());
// [
//   { value: 0, timestamp: 1234567890000, index: 0 },
//   { value: 3, timestamp: 1234567893000, index: 1 }
// ]
```

**Parameters:**
- `getValue: () => T` - Function that returns the value to track (typically reads signals)
- `options?: HistoryOptions<T>` - Configuration options

**Returns:** `Signal<Array<HistoryEntry<T>>> & HistoryQuery<T>` - A signal containing array of history entries with query utilities

**`HistoryEntry<T>` Type:**
```ts
type HistoryEntry<T> = {
  value: T;        // The captured value
  timestamp: number; // Unix timestamp (ms) when recorded
  index: number;    // Sequential index (0-based)
};
```

**Options:**

```ts
type HistoryOptions<T> = {
  // Debounce time in ms before recording (default: 0)
  debounce?: number;

  // Maximum entries to keep (default: Infinity)
  maxLength?: number;

  // Custom filter to decide if entry should be recorded
  shouldRecord?: (
    prev: HistoryEntry<T> | undefined,
    next: HistoryEntry<T>
  ) => boolean;
};
```

### Query Utilities

The history signal includes built-in query methods for easy data access:

```tsx
const history = signal.history(() => count());

// Access methods
history.latest();           // Get most recent entry
history.oldest();           // Get first entry
history.at(index);          // Get entry at index (negative = from end)
history.slice(start, end);  // Get range of entries
history.count();            // Total number of entries
history.values();           // Extract just values (no metadata)
history.clear();            // Clear all history

// Filtering
history.filter(entry => entry.value > 10);           // Custom filter
history.find(entry => entry.value === targetValue);  // Find first match

// Time-based queries
history.between(startTime, endTime);  // Entries between timestamps
history.since(timestamp);              // Entries after timestamp
history.before(timestamp);             // Entries before timestamp
```

**Query API:**

```ts
type HistoryQuery<T> = {
  clear(): void;
  latest(): HistoryEntry<T> | undefined;
  oldest(): HistoryEntry<T> | undefined;
  at(index: number): HistoryEntry<T> | undefined;
  slice(start?: number, end?: number): HistoryEntry<T>[];
  filter(predicate: (entry: HistoryEntry<T>) => boolean): HistoryEntry<T>[];
  find(predicate: (entry: HistoryEntry<T>) => boolean): HistoryEntry<T> | undefined;
  between(startTime: number, endTime: number): HistoryEntry<T>[];
  since(timestamp: number): HistoryEntry<T>[];
  before(timestamp: number): HistoryEntry<T>[];
  values(): T[];
  count(): number;
};
```

### Examples

**Basic usage - track counter:**

```tsx
const count = signal(0);
const history = signal.history(() => count());

count.set(1);
count.set(2);

// Access history
history()[0]; // { value: 0, timestamp: ..., index: 0 }
history().at(-1); // Latest entry
history.latest(); // Latest entry (convenience method)

// Get all values
history.values(); // [0, 1, 2]
```

**Form tracking with debounce:**

```tsx
const formData = {
  name: signal("John"),
  email: signal("john@example.com"),
};

const history = signal.history(
  () => signal.snapshot({ name: formData.name, email: formData.email }),
  { debounce: 500, maxLength: 50 }
);

// User types rapidly - only last value recorded after 500ms
formData.name.set("Jane");
// ... more typing ...

// Access form history
history().forEach(entry => {
  console.log(`${new Date(entry.timestamp).toISOString()}: ${JSON.stringify(entry.value)}`);
});
```

**Undo/redo functionality:**

```tsx
const appState = signal({ count: 0, text: "Hello" });
const history = signal.history(() => appState(), { maxLength: 50 });

let currentIndex = 0;

const undo = () => {
  const entries = history();
  if (currentIndex > 0) {
    currentIndex--;
    appState.set(entries[currentIndex].value);
  }
};

const redo = () => {
  const entries = history();
  if (currentIndex < entries.length - 1) {
    currentIndex++;
    appState.set(entries[currentIndex].value);
  }
};

// Make changes
appState.set({ count: 1, text: "World" });
appState.set({ count: 2, text: "Foo" });

// Go back
undo(); // Restore { count: 1, text: "World" }
undo(); // Restore { count: 0, text: "Hello" }

// Go forward
redo(); // Restore { count: 1, text: "World" }
```

**Custom filtering - only record significant changes:**

```tsx
const position = signal({ x: 0, y: 0 });

const history = signal.history(
  () => position(),
  {
    debounce: 100,
    shouldRecord: (prev, next) => {
      if (!prev) return true; // Always record first

      // Only record if moved more than 10 units
      const dx = next.value.x - prev.value.x;
      const dy = next.value.y - prev.value.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance > 10;
    },
  }
);

// Small movements ignored
position.set({ x: 1, y: 1 });
position.set({ x: 2, y: 2 });

// Large movement recorded
position.set({ x: 20, y: 20 });
```

**Audit log with timestamps:**

```tsx
const userActions = signal<string | null>(null);

const auditLog = signal.history(
  () => userActions(),
  {
    shouldRecord: (prev, next) => {
      // Skip null values
      return next.value !== null;
    },
  }
);

userActions.set("User logged in");
userActions.set("User updated profile");
userActions.set("User logged out");

// Generate audit report
const report = auditLog.values().map((action, i) => ({
  action,
  time: new Date(auditLog()[i].timestamp).toISOString(),
  sequence: auditLog()[i].index,
}));

console.table(report);
// ┌─────────┬────────────────────────┬──────────────────────────┬──────────┐
// │ (index) │        action          │           time           │ sequence │
// ├─────────┼────────────────────────┼──────────────────────────┼──────────┤
// │    0    │ 'User logged in'       │ '2024-01-01T10:00:00Z'   │    0     │
// │    1    │ 'User updated profile' │ '2024-01-01T10:05:00Z'   │    1     │
// │    2    │ 'User logged out'      │ '2024-01-01T10:15:00Z'   │    2     │
// └─────────┴────────────────────────┴──────────────────────────┴──────────┘
```

**Performance monitoring:**

```tsx
const renderCount = signal(0);

const perfHistory = signal.history(() => renderCount(), { debounce: 1000 });

// In component
useEffect(() => {
  renderCount.set(prev => prev + 1);
});

// Analyze render frequency
const analyzePerformance = () => {
  const entries = perfHistory();
  if (entries.length < 2) return;

  const intervals = [];
  for (let i = 1; i < entries.length; i++) {
    intervals.push(entries[i].timestamp - entries[i - 1].timestamp);
  }

  const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
  console.log(`Average time between renders: ${avgInterval}ms`);
  console.log(`Renders per second: ${1000 / avgInterval}`);
};
```

**Time-based queries:**

```tsx
const events = signal<string>("");
const eventHistory = signal.history(() => events());

// Track events
events.set("User clicked button");
events.set("API request started");
events.set("API request completed");

// Query by time
const now = Date.now();
const lastMinute = eventHistory.since(now - 60000);
const oldEvents = eventHistory.before(now - 3600000);
const recentEvents = eventHistory.between(now - 300000, now);

// Use with filter
const errorEvents = eventHistory.filter(entry => 
  entry.value.includes("error")
);

// Find specific event
const firstError = eventHistory.find(entry => 
  entry.value.includes("error")
);
```

**Integration with UI components:**

```tsx
const FormWithHistory = blox(() => {
  const name = signal("");
  const email = signal("");

  const formHistory = signal.history(
    () => signal.snapshot({ name, email }),
    { debounce: 1000, maxLength: 20 }
  );

  const canUndo = signal(() => formHistory.count() > 1);

  const undo = () => {
    const entries = formHistory();
    if (entries.length > 1) {
      const previous = entries[entries.length - 2];
      name.set(previous.value.name);
      email.set(previous.value.email);
    }
  };

  return (
    <div>
      {rx(() => (
        <>
          <input 
            value={name()} 
            onChange={(e) => name.set(e.target.value)} 
          />
          <input 
            value={email()} 
            onChange={(e) => email.set(e.target.value)} 
          />
          
          <button onClick={undo} disabled={!canUndo()}>
            Undo
          </button>
          
          <div>History: {formHistory.count()} entries</div>
          
          <details>
            <summary>View History</summary>
            <ul>
              {formHistory().map((entry, i) => (
                <li key={i}>
                  {new Date(entry.timestamp).toLocaleTimeString()}: 
                  {JSON.stringify(entry.value)}
                </li>
              ))}
            </ul>
          </details>
        </>
      ))}
    </div>
  );
});
```

**Important Notes:**

- Always applies debouncing (default 0ms means next tick)
- Uses `snapshot(getValue(), false)` internally to enable reactive tracking
- Automatically tracks all signal dependencies in `getValue()`
- `maxLength` removes oldest entries when exceeded
- `shouldRecord` receives `undefined` for `prev` on first entry
- Indices are sequential and persist even when old entries are removed
- Returns a signal, so you can reactively render history in UI
- Query methods access the current history state
- Call `history()` to get the array, or use query methods like `history.latest()`

---

## `useSignals<T>(values, options?)`

React hook that creates signals from an object of values **without automatic reactivity**.

Provides maximum flexibility by giving you full control over when and how reactivity happens.

```tsx
const Component = () => {
  // Create signals from values
  const signals = useSignals({ 
    count: 0, 
    name: "Alice" 
  });

  // Manual updates (no automatic re-render)
  const increment = () => signals.count.set(c => c + 1);

  // Use with rx() for partial rendering
  return (
    <div>
      <div>{rx(() => signals.count())}</div>
      <button onClick={increment}>Increment</button>
    </div>
  );
};
```

**Parameters:**

- `values` - Object of values to convert to signals
- `options.equals?` - Custom equality function (applied to all signals)
- `options.autoSync?` - Auto-sync signal values on re-render (default: `false`)

**Returns:** `UseSignalsResult<T>` - Proxy object where each property is a `MutableSignal`

**Key Features:**

- ✅ **No Automatic Reactivity**: Full manual control
- ✅ **Lazy Creation**: Signals created only when first accessed
- ✅ **Automatic Cleanup**: All signals disposed on unmount
- ✅ **Type-Safe**: Full TypeScript support with mapped types

**With autoSync:**

```tsx
const Component = ({ initialCount }: { initialCount: number }) => {
  // Sync signal when prop changes
  const signals = useSignals(
    { count: initialCount },
    { autoSync: true }
  );

  return <div>{rx(() => signals.count())}</div>;
};
```

**With useTracked for conditional tracking:**

```tsx
const Component = () => {
  const signals = useSignals({ count: 0, name: "Alice", age: 30 });
  const [showDetails, setShowDetails] = useState(false);

  const tracked = useTracked({
    count: () => signals.count(),
    name: () => signals.name(),
    age: () => signals.age(),
  });

  if (!showDetails) {
    // Only tracks 'count'
    return <div>{tracked.count}</div>;
  }

  // Tracks all three when details shown
  return (
    <div>
      <div>{tracked.count}</div>
      <div>{tracked.name} - {tracked.age}</div>
    </div>
  );
};
```

**Custom equality:**

```tsx
const signals = useSignals(
  { user: { id: 1, name: "Alice" } },
  { 
    equals: (a, b) => a.id === b.id  // Compare by id
  }
);
```

**When to Use:**

- Fine-grained control over reactivity
- Combining manual and reactive updates
- Using signals with `rx()` for partial rendering
- Conditional tracking with `useTracked()`

**When NOT to Use:**

- Want automatic reactivity everywhere → use `blox`
- Need simple local state → use `useState`
- Want component-wide reactivity → use `rx()`

---

## `useTracked<T>(gettersOrSignals)`

React hook for lazy signal tracking with conditional dependencies.

Creates a reactive proxy that enables **conditional tracking** in React components and custom hooks. Unlike `rx()` or `blox` which track all accessed signals, `useTracked` only tracks signals when they're actually accessed through the proxy.

```tsx
const Component = () => {
  const tracked = useTracked({
    count: () => count(),
    name: () => name()
  });

  // Only tracks 'count' - 'name' never accessed
  return <div>{tracked.count}</div>;
};
```

**Parameters:**

- `gettersOrSignals` - Object mapping keys to getter functions
  - Each value must be a function that returns the desired value
  - For signals: `{ count: () => count() }`
  - For computed: `{ double: () => count() * 2 }`

**Returns:** `Tracked<T>` - Reactive proxy where each key returns the computed value

**Key Features:**

- ✅ **Lazy Tracking**: Only tracks signals when accessed
- ✅ **Conditional Dependencies**: Different code paths track different signals
- ✅ **Works Anywhere**: React components, custom hooks, event handlers
- ✅ **Type-Safe**: Full TypeScript support with return type inference

**Conditional tracking:**

```tsx
const Profile = () => {
  const [showDetails, setShowDetails] = useState(false);
  
  const tracked = useTracked({
    name: () => user().name,
    email: () => user().email,
    phone: () => user().phone
  });

  // Only tracks 'name' initially
  if (!showDetails) {
    return <div>{tracked.name}</div>;
  }

  // Tracks all three when details shown
  return (
    <div>
      <div>{tracked.name}</div>
      <div>{tracked.email}</div>
      <div>{tracked.phone}</div>
    </div>
  );
};
```

**In event handlers (no tracking):**

```tsx
const tracked = useTracked({ count: () => count() });

const handleClick = () => {
  // Access outside render - no tracking
  console.log('Current:', tracked.count);
  count.set(tracked.count + 1);
};
```

**In custom hooks:**

```tsx
function useUserData() {
  const tracked = useTracked({
    user: () => currentUser(),
    isAdmin: () => currentUser().role === 'admin'
  });

  useEffect(() => {
    if (tracked.isAdmin) {
      loadAdminPanel();
    }
  }, [tracked.isAdmin]); // Reactive dependency!

  return tracked.user;
}
```

**How It Works:**

1. Creates a proxy that wraps your getters/signals
2. During render: tracks which signals are accessed
3. After render: subscribes to those specific signals
4. On signal change: triggers component re-render
5. Next render: clears old subscriptions, tracks new ones

**Important Notes:**

- Tracking only works during the **render phase**
- Event handlers and effects access values **without** tracking
- This prevents memory leaks from long-lived callbacks
- Use `rx()` or manual subscriptions if you need tracking outside render

**When to Use:**

- Conditional signal access (if/else, switch, early returns)
- Dynamic dependencies based on state
- Event handlers that need reactive values
- Custom hooks with reactive logic

**When NOT to Use:**

- Simple signal display → use `rx()`
- Component-level reactivity → use `blox`
- Async operations → use `signal.async()` with `track()`

---

[Back to Main Documentation](../README.md)

