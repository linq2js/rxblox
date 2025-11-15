# React-Compatible Hooks

**For developers not familiar with `blox` or who prefer traditional React patterns**

If you're new to rxblox or prefer working within React's standard component model, rxblox provides a set of hooks that bring reactive programming to your components **without** requiring you to learn `blox`. These hooks work seamlessly with regular React components and custom hooks while leveraging rxblox's powerful reactive model.

## Overview

While `blox` offers maximum flexibility by transforming components into fully reactive units, these React-compatible hooks provide a **more familiar experience** at the cost of some flexibility:

| Hook | Purpose | Use When |
|------|---------|----------|
| `rx()` | Reactive expressions in JSX | You want automatic updates for specific parts of your UI |
| `useTracked()` | Conditional signal tracking | You need reactive values with conditional dependencies |
| `useSignals()` | Signal creation without auto-reactivity | You want manual control over signals with `rx()` integration |
| `useAction()` | Reactive async actions | You need to manage async operations with loading/error states |

**Trade-off:** These hooks work within React's re-render cycle, which is less flexible than `blox`'s fine-grained reactivity, but they're easier to understand and integrate with existing React code.

---

## Why Use These Hooks?

### ✅ **You Should Use These Hooks When:**
- You're new to rxblox and want a gentler learning curve
- You prefer React's mental model (props, state, re-renders)
- You need to integrate with existing React codebases
- You want to use reactive features in custom hooks
- You're prototyping and want quick results

### ⚠️ **Consider `blox` Instead When:**
- You need maximum performance with large component trees
- You want complete control over reactivity boundaries
- You're building a new app from scratch
- You're comfortable with fine-grained reactivity concepts

---

## 1. `rx()` - Reactive Expressions

**The simplest way to add reactivity to your components.**

`rx()` creates reactive "islands" in your JSX that automatically update when their signal dependencies change, without re-rendering the entire component.

### Basic Usage

```tsx
import { signal, rx } from 'rxblox';

const count = signal(0);
const name = signal("Alice");

function Counter() {
  return (
    <div>
      {/* Only this part updates when count changes */}
      <h1>{rx(() => count())}</h1>
      
      {/* Only this part updates when name changes */}
      <p>Hello, {rx(() => name())}!</p>
      
      <button onClick={() => count.set(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}
```

### With Complex Expressions

```tsx
const todos = signal([
  { id: 1, text: "Learn rxblox", done: false },
  { id: 2, text: "Build app", done: false }
]);

function TodoList() {
  return (
    <div>
      {rx(() => (
        <>
          <p>Total: {todos().length}</p>
          <p>Completed: {todos().filter(t => t.done).length}</p>
          <ul>
            {todos().map(todo => (
              <li key={todo.id}>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => {
                    todos.set(list => 
                      list.map(t => 
                        t.id === todo.id 
                          ? { ...t, done: !t.done }
                          : t
                      )
                    );
                  }}
                />
                {todo.text}
              </li>
            ))}
          </ul>
        </>
      ))}
    </div>
  );
}
```

### Auto-Reactive Props

```tsx
const title = signal("Dashboard");
const isActive = signal(true);

// Signal props are automatically unwrapped
{rx("div", {
  className: isActive,  // Becomes className={isActive()}
  title: title,         // Becomes title={title()}
  children: "Content"
})}
```

### Explicit Dependencies

```tsx
const count = signal(0);
const multiplier = signal(2);

// Receive unwrapped values as parameters
{rx([count, multiplier], (c, m) => (
  <div>{c} × {m} = {c * m}</div>
))}
```

---

## 2. `useTracked()` - Conditional Reactive Tracking

**For when you need reactive values with conditional dependencies.**

Unlike `rx()` which creates reactive JSX, `useTracked()` gives you reactive **values** that you can use anywhere in your component - conditionally in render, in event handlers, or in effects.

### Basic Usage

```tsx
import { signal, useTracked } from 'rxblox';

const user = signal({ name: "Alice", email: "alice@example.com" });

function Profile() {
  const tracked = useTracked({
    name: () => user().name,
    email: () => user().email,
  });

  // Component only re-renders when accessed signals change
  return (
    <div>
      <h1>{tracked.name}</h1>
      <p>{tracked.email}</p>
    </div>
  );
}
```

### Conditional Dependencies

**The killer feature:** Only tracks signals that are actually accessed.

```tsx
function ConditionalProfile() {
  const [showDetails, setShowDetails] = useState(false);
  
  const tracked = useTracked({
    name: () => user().name,
    email: () => user().email,
    phone: () => user().phone,
    address: () => user().address,
  });

  if (!showDetails) {
    // Only tracks 'name' - other signals ignored
    return (
      <div>
        <h1>{tracked.name}</h1>
        <button onClick={() => setShowDetails(true)}>
          Show Details
        </button>
      </div>
    );
  }

  // Now tracks all four signals
  return (
    <div>
      <h1>{tracked.name}</h1>
      <p>Email: {tracked.email}</p>
      <p>Phone: {tracked.phone}</p>
      <p>Address: {tracked.address}</p>
    </div>
  );
}
```

### In Event Handlers

```tsx
function TodoEditor() {
  const todos = signal([]);
  const tracked = useTracked({
    todos: () => todos(),
    count: () => todos().length,
  });

  const handleSave = () => {
    // Access reactive values in event handlers
    console.log(`Saving ${tracked.count} todos`);
    saveToAPI(tracked.todos);
  };

  return (
    <div>
      <div>Total: {tracked.count}</div>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

### In Custom Hooks

```tsx
function useAuth() {
  const currentUser = signal(null);
  
  const tracked = useTracked({
    user: () => currentUser(),
    isLoggedIn: () => currentUser() !== null,
    isAdmin: () => currentUser()?.role === 'admin',
  });

  useEffect(() => {
    if (tracked.isAdmin) {
      loadAdminPanel();
    }
  }, [tracked.isAdmin]); // Reactive dependency!

  return tracked;
}

function Dashboard() {
  const auth = useAuth();
  
  return (
    <div>
      {auth.isLoggedIn ? (
        <p>Welcome, {auth.user.name}!</p>
      ) : (
        <p>Please log in</p>
      )}
    </div>
  );
}
```

---

## 3. `useSignals()` - Manual Signal Control

**For maximum control over when reactivity happens.**

`useSignals()` creates signals that **don't cause re-renders by default**. You control reactivity by combining them with `rx()`, `useTracked()`, or manual re-renders.

### Basic Usage

```tsx
import { useSignals, rx } from 'rxblox';

function Counter() {
  const signals = useSignals({ 
    count: 0, 
    step: 1 
  });

  const increment = () => {
    signals.count.set(c => c + signals.step());
  };

  return (
    <div>
      {/* Use rx() to make it reactive */}
      <h1>{rx(() => signals.count())}</h1>
      
      <button onClick={increment}>
        Add {rx(() => signals.step())}
      </button>
      
      <input
        type="number"
        onChange={(e) => signals.step.set(Number(e.target.value))}
      />
    </div>
  );
}
```

### With `useTracked()`

```tsx
function SearchComponent() {
  const signals = useSignals({
    query: "",
    results: [],
    loading: false,
  });

  const tracked = useTracked({
    query: () => signals.query(),
    results: () => signals.results(),
    loading: () => signals.loading(),
  });

  const handleSearch = async () => {
    signals.loading.set(true);
    const data = await fetchResults(signals.query());
    signals.results.set(data);
    signals.loading.set(false);
  };

  return (
    <div>
      <input
        value={tracked.query}
        onChange={(e) => signals.query.set(e.target.value)}
      />
      
      {tracked.loading ? (
        <div>Searching...</div>
      ) : (
        <ul>
          {tracked.results.map(r => <li key={r.id}>{r.title}</li>)}
        </ul>
      )}
    </div>
  );
}
```

### Auto-Sync with Props

```tsx
function Counter({ initialCount }: { initialCount: number }) {
  // Signal syncs with prop changes
  const signals = useSignals(
    { count: initialCount },
    { autoSync: true }
  );

  return (
    <div>
      <div>{rx(() => signals.count())}</div>
      <button onClick={() => signals.count.set(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}
```

### Custom Equality

```tsx
const signals = useSignals(
  { user: { id: 1, name: "Alice" } },
  { 
    // Only update if user id changes
    equals: (a, b) => a?.id === b?.id 
  }
);
```

---

## 4. `useAction()` - Reactive Async Operations

**For managing async operations with loading and error states.**

`useAction()` makes async actions reactive, automatically tracking their state (idle, loading, success, error) and triggering re-renders when state changes.

### Basic Usage

```tsx
import { useAction } from 'rxblox';

function UserProfile({ userId }: { userId: number }) {
  const fetchUser = useAction(
    async (signal, id: number) => {
      const response = await fetch(`/api/users/${id}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    }
  );

  useEffect(() => {
    fetchUser.run(userId);
  }, [userId]);

  return (
    <div>
      {fetchUser.loading && <div>Loading...</div>}
      {fetchUser.error && <div>Error: {fetchUser.error.message}</div>}
      {fetchUser.data && (
        <div>
          <h1>{fetchUser.data.name}</h1>
          <p>{fetchUser.data.email}</p>
        </div>
      )}
    </div>
  );
}
```

### With Callbacks

```tsx
function UploadComponent() {
  const upload = useAction(
    async (signal, file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal,
      });

      return response.json();
    },
    {
      on: {
        success: (result) => {
          console.log('Upload successful:', result.url);
          showNotification('File uploaded!');
        },
        error: (error) => {
          console.error('Upload failed:', error);
          showNotification('Upload failed!');
        },
      }
    }
  );

  return (
    <div>
      <input
        type="file"
        onChange={(e) => upload.run(e.target.files[0])}
        disabled={upload.loading}
      />
      
      {upload.loading && <progress />}
      {upload.error && <div className="error">Upload failed!</div>}
      {upload.data && <div>Uploaded: {upload.data.url}</div>}
    </div>
  );
}
```

### Global Actions

```tsx
// store.ts - Create action once
import { cancellableAction } from 'rxblox';

export const fetchUser = cancellableAction(
  async (signal, id: number) => {
    const response = await fetch(`/api/users/${id}`, { signal });
    return response.json();
  }
);

// Component.tsx - Make it reactive
function UserProfile({ userId }: { userId: number }) {
  const fetchUserAction = useAction(fetchUser);

  useEffect(() => {
    fetchUserAction.run(userId);
  }, [userId]);

  return (
    <div>
      {fetchUserAction.loading && <div>Loading...</div>}
      {fetchUserAction.data && <div>{fetchUserAction.data.name}</div>}
    </div>
  );
}

// AnotherComponent.tsx - Reuse same action
function UserCard({ userId }: { userId: number }) {
  const fetchUserAction = useAction(fetchUser);
  
  // Same action, shared state across components!
  return (
    <div>
      {fetchUserAction.loading ? '...' : fetchUserAction.data?.name}
    </div>
  );
}
```

### Form Submission

```tsx
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useAction(
    async (signal, credentials: { email: string; password: string }) => {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        signal,
      });

      if (!response.ok) throw new Error('Login failed');
      return response.json();
    },
    {
      on: {
        success: (user) => {
          console.log('Logged in:', user);
          navigateToDashboard();
        },
      }
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.run({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={login.loading}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={login.loading}
      />
      <button type="submit" disabled={login.loading}>
        {login.loading ? 'Logging in...' : 'Login'}
      </button>
      {login.error && <div className="error">{login.error.message}</div>}
    </form>
  );
}
```

---

## Combining Hooks

These hooks work great together! Here's a real-world example:

```tsx
import { useSignals, useTracked, useAction, rx } from 'rxblox';

function TodoApp() {
  // Create signals for local state
  const signals = useSignals({
    filter: 'all',
    newTodo: '',
  });

  // Create reactive action for fetching
  const fetchTodos = useAction(
    async (signal) => {
      const response = await fetch('/api/todos', { signal });
      return response.json();
    }
  );

  // Create reactive action for adding
  const addTodo = useAction(
    async (signal, text: string) => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal,
      });
      return response.json();
    },
    {
      on: {
        success: () => {
          signals.newTodo.set('');
          fetchTodos.run();
        },
      }
    }
  );

  // Track computed values
  const tracked = useTracked({
    filter: () => signals.filter(),
    todos: () => fetchTodos.data || [],
    filteredTodos: () => {
      const todos = fetchTodos.data || [];
      const filter = signals.filter();
      
      if (filter === 'active') return todos.filter(t => !t.done);
      if (filter === 'completed') return todos.filter(t => t.done);
      return todos;
    },
  });

  useEffect(() => {
    fetchTodos.run();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = signals.newTodo();
    if (text.trim()) {
      addTodo.run(text);
    }
  };

  return (
    <div>
      <h1>Todo App</h1>

      {/* Form with manual signal control */}
      <form onSubmit={handleSubmit}>
        <input
          value={rx(() => signals.newTodo())}
          onChange={(e) => signals.newTodo.set(e.target.value)}
          disabled={addTodo.loading}
        />
        <button type="submit" disabled={addTodo.loading}>
          {addTodo.loading ? 'Adding...' : 'Add'}
        </button>
      </form>

      {/* Filter buttons with reactive state */}
      <div>
        {['all', 'active', 'completed'].map(filter => (
          <button
            key={filter}
            onClick={() => signals.filter.set(filter)}
            disabled={rx(() => signals.filter() === filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Loading and error states */}
      {fetchTodos.loading && <div>Loading todos...</div>}
      {fetchTodos.error && <div>Error: {fetchTodos.error.message}</div>}

      {/* Reactive filtered list */}
      {rx(() => (
        <ul>
          {tracked.filteredTodos.map(todo => (
            <li key={todo.id}>
              {todo.text}
            </li>
          ))}
        </ul>
      ))}

      {/* Reactive count */}
      <div>
        {rx(() => `Showing ${tracked.filteredTodos.length} of ${tracked.todos.length} todos`)}
      </div>
    </div>
  );
}
```

---

## Comparison: Hooks vs. `blox`

| Aspect | React-Compatible Hooks | `blox` |
|--------|------------------------|--------|
| **Learning Curve** | Easy - uses familiar React patterns | Steeper - new mental model |
| **Integration** | Works with any React component | Requires wrapping components |
| **Re-render Control** | Uses React's re-render cycle | Fine-grained, bypasses React |
| **Performance** | Good - some full component re-renders | Excellent - surgical updates |
| **Custom Hooks** | ✅ Works perfectly | ⚠️ Limited support |
| **Third-party Hooks** | ✅ Full compatibility | ⚠️ May not work |
| **Flexibility** | Less flexible - React constraints | Maximum flexibility |
| **Debugging** | Standard React DevTools | Requires understanding reactivity |
| **Use Case** | Gradual adoption, prototypes, integrating with existing code | New apps, performance-critical UIs |

---

## Best Practices

### 1. Start Simple with `rx()`
Begin by wrapping just the parts of your UI that need reactivity:

```tsx
// ❌ Don't wrap everything immediately
function Component() {
  return rx(() => <div>...</div>);
}

// ✅ Wrap only reactive parts
function Component() {
  return (
    <div>
      <StaticHeader />
      {rx(() => <DynamicContent />)}
      <StaticFooter />
    </div>
  );
}
```

### 2. Use `useTracked()` for Conditional Logic
When you have conditional rendering, use `useTracked()` to avoid tracking unused signals:

```tsx
// ✅ Tracks only what's rendered
const tracked = useTracked({
  count: () => count(),
  details: () => details(),
});

return showDetails ? tracked.details : tracked.count;
```

### 3. Combine `useSignals()` with `rx()`
Create signals with `useSignals()`, display with `rx()`:

```tsx
const signals = useSignals({ count: 0 });

return (
  <div>
    {rx(() => signals.count())}
    <button onClick={() => signals.count.set(c => c + 1)}>+</button>
  </div>
);
```

### 4. Use `useAction()` for All Async Operations
Don't manage loading states manually:

```tsx
// ❌ Manual state management
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [data, setData] = useState(null);

// ✅ Use useAction
const action = useAction(async (signal) => {
  return await fetchData();
});
```

### 5. Leverage Global Actions
Create actions once, use them everywhere:

```tsx
// store.ts
export const fetchUsers = cancellableAction(...);

// Multiple components
function ComponentA() {
  const action = useAction(fetchUsers); // Same instance!
}

function ComponentB() {
  const action = useAction(fetchUsers); // Same state!
}
```

---

## Migration Path

### From `useState` to Signals

```tsx
// Before
const [count, setCount] = useState(0);
return <div>{count}</div>;

// After
const signals = useSignals({ count: 0 });
return <div>{rx(() => signals.count())}</div>;
```

### From `useEffect` to `useTracked`

```tsx
// Before
const [filteredData, setFilteredData] = useState([]);
useEffect(() => {
  setFilteredData(data.filter(item => item.active));
}, [data]);

// After
const tracked = useTracked({
  filteredData: () => data().filter(item => item.active)
});
return <div>{tracked.filteredData.length}</div>;
```

### From Manual Async to `useAction`

```tsx
// Before
const [loading, setLoading] = useState(false);
const fetchData = async () => {
  setLoading(true);
  try {
    const result = await api.get('/data');
    setData(result);
  } catch (error) {
    setError(error);
  } finally {
    setLoading(false);
  }
};

// After
const fetchData = useAction(async (signal) => {
  return await api.get('/data', { signal });
});
```

---

## When to Graduate to `blox`

Consider moving to `blox` when:

1. **Performance bottlenecks** - Component re-renders become noticeable
2. **Complex state management** - You have deeply nested reactive state
3. **Fine-grained updates** - You need surgical DOM updates
4. **You're comfortable** - You understand reactivity and want more control

But remember: **these hooks are powerful enough for most applications!** Don't feel pressured to use `blox` if these hooks work well for you.

---

## Summary

These React-compatible hooks provide a **gentle introduction** to reactive programming while maintaining React's familiar patterns:

- 🎯 **`rx()`** - Reactive UI expressions
- 🎯 **`useTracked()`** - Conditional reactive tracking  
- 🎯 **`useSignals()`** - Manual signal control
- 🎯 **`useAction()`** - Async operations with state

They offer **80% of the benefits** of full reactivity with **20% of the learning curve**, making them perfect for:
- Teams new to reactive programming
- Gradual migration from traditional React
- Integration with existing codebases
- Rapid prototyping

Start with these hooks, and when you're ready for maximum flexibility, explore `blox`!

---

## See Also

- [Core Concepts](./core-concepts.md) - Understanding signals and reactivity
- [API Reference](./api-reference.md) - Complete API documentation  
- [Patterns](./patterns.md) - Common usage patterns
- [Performance](./performance.md) - Optimization tips

