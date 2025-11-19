# Patterns & Best Practices

This guide covers practical patterns and best practices for building applications with rxblox, from common use cases to organizing and reusing signal logic.

## Table of Contents

- [Common Patterns](#common-patterns)
  - [Global State](#global-state)
  - [Form State](#form-state)
  - [Async Data Loading](#async-data-loading)
  - [Using React Refs](#using-react-refs)
  - [Optimistic Updates](#optimistic-updates)
- [Organizing Signals](#organizing-signals)
  - [Global Signals (Singleton State)](#global-signals-singleton-state)
  - [Local Signals (Component State)](#local-signals-component-state)
  - [Flexible Reactivity with useSignals](#flexible-reactivity-with-usesignals)
  - [Signal Factories (Reusable Logic)](#signal-factories-reusable-logic)
- [Composable Logic](#composable-logic)

---

## Common Patterns

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
const UserPosts = blox((props: { userId: number }) => {
  const posts = signal.async(async ({ track }) => {
    const tracked = track({ userId: props.userId });

    const response = await fetch(`/api/users/${tracked.userId}/posts`);
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

### Using React Refs

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

const CustomInput = blox((props: { placeholder: string }, ref: Ref<InputHandle>) => {
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

### Optimistic Updates

Update UI immediately, revert on error:

```tsx
const TodoItem = blox((props: { todo: Todo }) => {
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
      {/* Wrap checkbox in rx() to make checked state reactive */}
      {rx(() => (
        <input type="checkbox" checked={completed()} onChange={toggle} />
      ))}
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

## Organizing Signals

Signals in rxblox can be created at different scopes depending on your needs. Understanding when to use global vs local signals, and how to create reusable signal factories, is key to building maintainable applications.

### Global Signals (Singleton State)

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

### Local Signals (Component State)

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

### Flexible Reactivity with `useSignals`

`useSignals` provides maximum flexibility by creating signals **without automatic reactivity**. This gives you full control over when and how reactivity happens.

**When to use:**

- Fine-grained control over reactivity
- Combining manual and reactive updates
- Using signals with `rx()` for partial rendering
- Conditional tracking with `useTracked()`
- Performance optimization (avoid unnecessary re-renders)

#### Pattern 1: Manual Control with Partial Rendering

```tsx
const DataTable = () => {
  // Create signals without automatic reactivity
  const signals = useSignals({
    data: [],
    loading: false,
    filter: ""
  });

  const loadData = async () => {
    signals.loading.set(true);
    const result = await fetchData();
    signals.data.set(result);
    signals.loading.set(false);
  };

  const handleFilterChange = (e) => {
    // Manual update - no re-render
    signals.filter.set(e.target.value);
  };

  // Use rx() for partial rendering - only these parts re-render
  return (
    <div>
      <input 
        onChange={handleFilterChange}
        placeholder="Filter..."
      />
      
      {rx(() => 
        signals.loading() ? (
          <div>Loading...</div>
        ) : (
          <div>
            {signals.data()
              .filter(item => 
                item.name.includes(signals.filter())
              )
              .map(item => (
                <div key={item.id}>{item.name}</div>
              ))
            }
          </div>
        )
      )}
    </div>
  );
};
```

#### Pattern 2: Conditional Tracking with `useTracked`

```tsx
const UserDashboard = () => {
  // Create signals
  const signals = useSignals({
    user: null,
    posts: [],
    comments: [],
    notifications: []
  });
  
  const [activeTab, setActiveTab] = useState('posts');

  // Only track what's actually displayed
  const tracked = useTracked({
    user: () => signals.user(),
    posts: () => signals.posts(),
    comments: () => signals.comments(),
    notifications: () => signals.notifications()
  });

  // Only the accessed signals trigger re-renders
  return (
    <div>
      <h1>{tracked.user?.name}</h1>
      
      {activeTab === 'posts' && (
        // Only tracks 'posts'
        <div>{tracked.posts.length} posts</div>
      )}
      
      {activeTab === 'comments' && (
        // Only tracks 'comments'
        <div>{tracked.comments.length} comments</div>
      )}
      
      {activeTab === 'notifications' && (
        // Only tracks 'notifications'
        <div>{tracked.notifications.length} notifications</div>
      )}
    </div>
  );
};
```

#### Pattern 3: Auto-Sync with Props

```tsx
const SyncedComponent = ({ userId, theme }: Props) => {
  // Auto-sync signals when props change
  const signals = useSignals(
    { userId, theme },
    { autoSync: true }
  );

  // Signals automatically update when props change
  return rx(() => (
    <div className={signals.theme()}>
      User ID: {signals.userId()}
    </div>
  ));
};
```

#### Pattern 4: Combining with Custom Hooks

```tsx
function useFilteredData(initialData: Data[]) {
  const signals = useSignals({
    data: initialData,
    filter: "",
    sortBy: "name"
  });

  const tracked = useTracked({
    filteredData: () => {
      const data = signals.data();
      const filter = signals.filter();
      const sortBy = signals.sortBy();
      
      return data
        .filter(item => item.name.includes(filter))
        .sort((a, b) => a[sortBy].localeCompare(b[sortBy]));
    }
  });

  return {
    signals,
    filteredData: tracked.filteredData,
    setFilter: (filter: string) => signals.filter.set(filter),
    setSortBy: (sortBy: string) => signals.sortBy.set(sortBy)
  };
}

// Usage
const DataList = () => {
  const { filteredData, setFilter, setSortBy } = useFilteredData(data);
  
  return (
    <div>
      <input onChange={(e) => setFilter(e.target.value)} />
      <select onChange={(e) => setSortBy(e.target.value)}>
        <option value="name">Name</option>
        <option value="date">Date</option>
      </select>
      <div>{filteredData.map(item => ...)}</div>
    </div>
  );
};
```

**Benefits:**

- ✅ Maximum flexibility
- ✅ Fine-grained control over re-renders
- ✅ Combine manual and reactive updates
- ✅ Works with both `rx()` and `useTracked()`
- ✅ Automatic cleanup on unmount

**Comparison:**

| Feature | `blox` + `signal` | `useSignals` + `rx()` | `useSignals` + `useTracked()` |
|---------|-------------------|----------------------|------------------------------|
| Reactivity | Automatic | Partial (rx only) | Conditional |
| Re-renders | Component-wide | Localized | On-demand |
| Control | Low | Medium | High |
| Use Case | Simple UIs | Performance-critical | Complex conditional logic |

### Signal Factories (Reusable Logic)

Signal factories are **functions that create and return signals with related logic**. They enable reusable patterns that can be instantiated globally or locally.

#### Pattern 1: Simple Factory (Universal)

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

#### Pattern 2: Async Data Factory

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
const UserList = blox((props: { filter: string }) => {
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

#### Pattern 3: Form Field Factory

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

#### Pattern 4: Store Factory (Multiple Instances)

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

**Organizing Code:**

Recommended structure:

```plaintext
src/
├── stores/             # Global state stores
│   ├── auth.ts         # authStore
│   ├── cart.ts         # cartStore
│   └── theme.ts        # themeStore
│
├── factories/          # Reusable store factories
│   ├── counter.ts      # createCounterStore()
│   ├── formField.ts    # createFormFieldStore()
│   └── asyncData.ts    # createAsyncDataStore()
│
├── utils/              # Component utilities
│   ├── withWebSocket.ts
│   ├── withAutoSave.ts
│   └── withTimer.ts
│
└── components/
    └── Counter.tsx     # Components with local state
```

**Best practices:**

- ✅ Global stores in `stores/` directory
- ✅ Store factories in `factories/` directory
- ✅ Component utilities in `utils/` with `with` prefix
- ✅ Local signals inside component definition
- ✅ Name global stores with `Store` suffix: `authStore`, `cartStore`
- ✅ Name factories with `create` prefix: `createCounterStore()`, `createFormFieldStore()`
- ✅ Name component utilities with `with` prefix: `withWebSocket()`, `withAutoSave()`
- ✅ Export both factory and global instance if needed
- ❌ Don't create global stores inside components
- ❌ Don't pass local signals between components (use props or global instead)
- ❌ Don't use `useXXX` prefix (reserved for React hooks)

---

## Composable Logic

One of the most powerful features of `blox` is the ability to extract and reuse reactive logic. Since signals, effects, and lifecycle hooks can be called anywhere (not just in React components), you can create composable logic functions.

### Naming Conventions

**Global State** (`xxxStore` suffix)

- Created outside components, shared across the app
- Only uses: `signal()`, `effect()`, actions
- Example: `authStore`, `cartStore`, `todoStore`
- Factory functions: `createAuthStore()`, `createTodoStore()`

**Component Utilities** (`withXXX` prefix)

- Called inside `blox()` components only
- Uses blox APIs: `blox.onMount()`, `blox.onUnmount()`, `blox.onRender()`, `blox.hook()`
- Example: `withWebSocket()`, `withAutoSave()`, `withKeyboardShortcuts()`

⚠️ **Never use `useXXX`** - Reserved for React hooks only!

### Basic Example

```tsx
// Store factory - can create global or local instances
function createCounterStore(initialValue = 0) {
  const count = signal(initialValue);
  const doubled = signal(() => count() * 2);

  const increment = () => count.set(count() + 1);
  const decrement = () => count.set(count() - 1);
  const reset = () => count.set(initialValue);

  return { count, doubled, increment, decrement, reset };
}

// Global store - shared across app
export const counterStore = createCounterStore(0);

// Or use locally in component
const Counter = blox(() => {
  const counter = createCounterStore(0);

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

### Component Utilities with Cleanup

Use `blox.onUnmount()` for cleanup in component utilities:

```tsx
// Component utility - uses blox.onUnmount()
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

const Chat = blox((props: { roomId: string }) => {
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

### Complex Store Logic

Extract business logic into reusable store factories:

```tsx
// Store factory - creates auth state management
function createAuthStore() {
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

// Create global auth store
export const authStore = createAuthStore();
```

### Composing Stores and Utilities

Combine store factories and component utilities:

```tsx
// Component utility - uses blox.onUnmount()
function withTimer(interval = 1000) {
  const elapsed = signal(0);
  const timer = setInterval(() => elapsed.set((p) => p + interval), interval);
  blox.onUnmount(() => clearInterval(timer)); // ✅ Cleanup
  return { elapsed };
}

// Store factory - can use anywhere
function createTimedCounterStore() {
  const counter = createCounterStore(0);

  effect(() => {
    // Auto-increment every second
    counter.increment();
  });

  return counter;
}

// Component utility - combines store + utility
function withTimedCounter() {
  const counter = createCounterStore(0);
  const timer = withTimer(1000);

  effect(() => counter.increment()); // Auto-increment every second

  return { ...counter, elapsed: timer.elapsed };
}
```

**Key Benefits:**

- ✅ **Reusability** - Write once, use in multiple components
- ✅ **Testability** - Stores and utilities can be tested independently
- ✅ **Separation of concerns** - Keep state logic separate from UI
- ✅ **No hooks rules** - Call these functions anywhere, in any order
- ✅ **Automatic cleanup** - `blox.onUnmount()` in utilities ensures resources are freed
- ✅ **Clear naming** - `withXXX` = component utilities, `xxxStore` = state containers
- ✅ **Namespaced API** - All blox-specific APIs live under `blox.*`

---

[Back to Main Documentation](../README.md)

