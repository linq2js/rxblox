# Rextive

Small, fast and scalable state management for React. Simple API, powerful features.

```bash
npm install rextive
```

## First create a signal

```tsx
import { signal } from "rextive";

const count = signal(0);
const doubled = signal({ count }, ({ deps }) => deps.count * 2);
```

## Then bind your components

```tsx
import { rx } from "rextive";

function Counter() {
  return rx({ count, doubled }, (awaited) => (
    <div>
      <h1>{awaited.count}</h1>
      <h2>{awaited.doubled}</h2>
      <button onClick={() => count.set(count() + 1)}>+1</button>
    </div>
  ));
}
```

## That's it!

- ✅ Simple API - just `signal` and `rx`
- ✅ Powerful - handles sync, async, effects, queries
- ✅ TypeScript - full type safety
- ✅ Zero dependencies - lightweight

---

## Examples

### Basic usage

```tsx
import { signal, rx } from "rextive";

const name = signal("Alice");
const greeting = signal({ name }, ({ deps }) => `Hello, ${deps.name}!`);

function App() {
  return rx({ greeting }, (awaited) => (
    <div>
      <h1>{awaited.greeting}</h1>
      <input value={name()} onChange={(e) => name.set(e.target.value)} />
    </div>
  ));
}
```

### Component-scoped signals

```tsx
import { signal, rx, useScope } from "rextive";

function Counter() {
  const { count } = useScope(() => ({
    count: signal(0),
  }));

  return (
    <div>
      {rx({ count }, (awaited) => (
        <div>Count: {awaited.count}</div>
      ))}
      <button onClick={() => count.set(count() + 1)}>+</button>
    </div>
  );
}
```

### Async with Suspense

```tsx
import { Suspense } from "react";
import { signal, rx } from "rextive";

const userId = signal(1);
const user = signal({ userId }, async ({ deps }) => {
  const res = await fetch(`/api/users/${deps.userId}`);
  return res.json();
});

function Profile() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {rx({ user }, (awaited) => (
        <div>{awaited.user.name}</div>
      ))}
    </Suspense>
  );
}
```

### Conditional rendering with cascading promises

```tsx
import { Suspense } from "react";
import { signal, rx, useAwaited } from "rextive";

const cloudValue = signal(async () => fetchCloudValue());
const localValue = signal("default");

// Using rx()
function ConditionalComponent() {
  return (
    <Suspense fallback={<div>Loading cloud value...</div>}>
      {rx({ cloudValue, localValue }, (awaited) => {
        // If cloudValue is a promise, this will throw and wait
        // Once resolved, the check happens
        if (!awaited.cloudValue) {
          return <Comp1 />;
        }

        return <Other value={awaited.cloudValue} />;
      })}
    </Suspense>
  );
}

// Using useAwaited
function ConditionalComponentWithHook() {
  const awaited = useAwaited({ cloudValue, localValue });

  return (
    <Suspense fallback={<div>Loading cloud value...</div>}>
      {(() => {
        // If cloudValue is a promise, this will throw and wait
        // Once resolved, the check happens
        if (!awaited.cloudValue) {
          return <Comp1 />;
        }

        return <Other value={awaited.cloudValue} />;
      })()}
    </Suspense>
  );
}
```

### Manual loading states

```tsx
import { signal, rx, useScope } from "rextive";

function SaveButton() {
  const { mutation } = useScope(() => ({
    mutation: signal(async () => saveData()),
  }));

  return rx({ mutation }, (_awaited, loadable) => {
    const save = loadable.mutation;

    if (save.status === "loading") {
      return <button disabled>Saving...</button>;
    }

    if (save.status === "error") {
      return (
        <button onClick={() => mutation.set(async () => saveData())}>
          Retry
        </button>
      );
    }

    return (
      <button onClick={() => mutation.set(async () => saveData())}>Save</button>
    );
  });
}
```

### Signals as effects (with explicit triggers)

```tsx
import { signal } from "rextive";

// Create a trigger signal
const refreshTrigger = signal(0);

// Effect signal that runs when trigger changes
const effectResult = signal({ refreshTrigger }, async ({ deps }) => {
  console.log("Effect running...");
  // This runs whenever refreshTrigger changes
  return await doSomething();
});

// Trigger the effect
refreshTrigger.set(refreshTrigger() + 1);

// Subscribe to effect results
effectResult.on(() => {
  console.log("Effect completed:", effectResult());
});
```

### React Query-like patterns

#### Queries (with abort signal)

```tsx
import { signal, useScope } from "rextive";

type TodoQueryVariables = { userId: number; status?: string };

function createTodoListQuery() {
  const payload = signal<TodoQueryVariables | null>(null);

  const result = signal({ payload }, async ({ deps, abortSignal }) => {
    if (!deps.payload) {
      return []; // Return empty array instead of null
    }

    // Auto-cancel with abortSignal when payload changes
    const res = await fetch("/todo/list", {
      method: "POST",
      body: JSON.stringify(deps.payload),
      signal: abortSignal, // Automatically cancels previous request
    });

    return res.json();
  });

  return {
    payload,
    result,
  };
}

// Global scope
const globalTodoListQuery = createTodoListQuery();
globalTodoListQuery.payload.set({ userId: 1, status: "active" });

// Component scope
function TodoList() {
  const { payload, result } = useScope(createTodoListQuery);

  // Trigger query
  payload.set({ userId: 1 });

  return rx({ result }, (awaited) => (
    <div>
      {awaited.result?.map((todo) => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  ));
}
```

#### Mutations (without abort signal)

```tsx
import { signal, rx, useScope } from "rextive";

type CreateTodoPayload = { title: string; userId: number };

function createTodoMutation() {
  const payload = signal<CreateTodoPayload | null>(null);

  const result = signal({ payload }, async ({ deps }) => {
    if (!deps.payload) {
      return null;
    }

    // Mutations should NOT use abortSignal - we want them to complete
    const res = await fetch("/todo/create", {
      method: "POST",
      body: JSON.stringify(deps.payload),
      // No abortSignal here - mutations should complete
    });

    return res.json();
  });

  return {
    payload,
    result,
  };
}

function CreateTodoForm() {
  const { payload, result } = useScope(createTodoMutation);

  return rx({ result }, (_awaited, loadable) => {
    const mutation = loadable.result;

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          payload.set({
            title: formData.get("title") as string,
            userId: 1,
          });
        }}
      >
        <input name="title" />
        <button disabled={mutation.status === "loading"}>
          {mutation.status === "loading" ? "Creating..." : "Create"}
        </button>
        {mutation.status === "error" && (
          <div>Error: {String(mutation.error)}</div>
        )}
        {mutation.status === "success" && (
          <div>Created: {mutation.value.title}</div>
        )}
      </form>
    );
  });
}
```

### Debounced search

```tsx
import { signal, rx, useScope } from "rextive";

function SearchBox() {
  const { searchTerm, results } = useScope(() => {
    const searchTerm = signal("");

    // Debounced search - only runs when searchTerm changes
    const results = signal({ searchTerm }, async ({ deps, abortSignal }) => {
      if (!deps.searchTerm) return [];

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Check if cancelled
      if (abortSignal?.aborted) return [];

      const res = await fetch(`/api/search?q=${deps.searchTerm}`, {
        signal: abortSignal,
      });
      return res.json();
    });

    return { searchTerm, results };
  });

  return (
    <div>
      <input
        value={searchTerm()}
        onChange={(e) => searchTerm.set(e.target.value)}
      />
      {rx({ results }, (awaited) => (
        <div>
          {awaited.results?.map((item) => (
            <div key={item.id}>{item.name}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Polling

```tsx
import { signal, rx, useScope } from "rextive";

function LiveData() {
  const { data, startPolling, stopPolling } = useScope(() => {
    const pollTrigger = signal(0);
    let intervalId: number | null = null;

    const data = signal({ pollTrigger }, async ({ deps, abortSignal }) => {
      const res = await fetch("/api/live-data", { signal: abortSignal });
      return res.json();
    });

    const startPolling = () => {
      intervalId = setInterval(() => {
        pollTrigger.set(pollTrigger() + 1);
      }, 5000);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    return { data, startPolling, stopPolling };
  });

  return (
    <div>
      <button onClick={startPolling}>Start</button>
      <button onClick={stopPolling}>Stop</button>
      {rx({ data }, (awaited) => (
        <div>{JSON.stringify(awaited.data)}</div>
      ))}
    </div>
  );
}
```

### Form state management

```tsx
import { signal, rx, useScope } from "rextive";

function ContactForm() {
  const { form, errors, isValid } = useScope(() => {
    const form = signal({
      name: "",
      email: "",
      message: "",
    });

    const errors = signal({ form }, ({ deps }) => {
      const errs: Record<string, string> = {};
      if (!deps.form.name) errs.name = "Name is required";
      if (!deps.form.email.includes("@")) errs.email = "Invalid email";
      if (!deps.form.message) errs.message = "Message is required";
      return errs;
    });

    const isValid = signal({ errors }, ({ deps }) => {
      return Object.keys(deps.errors).length === 0;
    });

    return { form, errors, isValid };
  });

  return rx({ form, errors, isValid }, (awaited) => (
    <form>
      <input
        value={awaited.form.name}
        onChange={(e) => form.set({ ...form(), name: e.target.value })}
      />
      {awaited.errors.name && <span>{awaited.errors.name}</span>}

      <input
        value={awaited.form.email}
        onChange={(e) => form.set({ ...form(), email: e.target.value })}
      />
      {awaited.errors.email && <span>{awaited.errors.email}</span>}

      <textarea
        value={awaited.form.message}
        onChange={(e) => form.set({ ...form(), message: e.target.value })}
      />
      {awaited.errors.message && <span>{awaited.errors.message}</span>}

      <button disabled={!awaited.isValid}>Submit</button>
    </form>
  ));
}
```

### Scope recreation

```tsx
import { signal, rx, useScope } from "rextive";

function UserProfile({ userId }: { userId: number }) {
  const { user } = useScope(
    () => ({
      user: signal({ userId }, async ({ deps }) => fetchUser(deps.userId)),
    }),
    { watch: [userId] } // Recreate when userId changes
  );

  return rx({ user }, (awaited) => <div>{awaited.user.name}</div>);
}
```

### Scope updates

```tsx
import { signal, rx, useScope } from "rextive";

function Timer({ initialValue }: { initialValue: number }) {
  const { timer } = useScope(
    () => ({
      timer: signal(0),
    }),
    {
      onUpdate: [
        (scope) => {
          scope.timer.set(initialValue);
        },
        initialValue,
      ],
    }
  );

  return rx({ timer }, (awaited) => <div>{awaited.timer}</div>);
}
```

### Lazy tracking - only subscribe to what you use

```tsx
import { signal, rx } from "rextive";

const user = signal(async () => fetchUser());
const posts = signal(async () => fetchPosts());
const comments = signal(async () => fetchComments());

function Profile({ showPosts }: { showPosts: boolean }) {
  return rx({ user, posts, comments }, (awaited) => {
    // Only user is accessed - only user is subscribed
    <div>{awaited.user.name}</div>;

    // Conditionally access posts - only subscribed if accessed
    {
      showPosts && (
        <div>
          {awaited.posts.map((post) => (
            <div key={post.id}>{post.title}</div>
          ))}
        </div>
      );
    }

    // comments never accessed - never subscribed
  });
}
```

**Other libraries require selecting all states upfront:**

```tsx
// Zustand - must select all upfront
const { user, posts, comments } = useStore((state) => ({
  user: state.user,
  posts: state.posts,
  comments: state.comments, // Selected even if not used
}));

// Jotai - must use all atoms upfront
const user = useAtom(userAtom);
const posts = useAtom(postsAtom); // Subscribed even if not used
const comments = useAtom(commentsAtom); // Subscribed even if not used

// Rextive - only subscribes to what you access
rx({ user, posts, comments }, (awaited) => {
  // Only awaited.user accessed = only user subscribed
  return <div>{awaited.user.name}</div>;
});
```

---

## API

### signal

```tsx
// Create a signal
const count = signal(0);

// Read value
count(); // 0

// Update value
count.set(1);

// Derived signal
const doubled = signal({ count }, ({ deps }) => deps.count * 2);

// Async signal
const data = signal(async () => fetchData());

// Async with dependencies and abort signal
const result = signal({ query }, async ({ deps, abortSignal }) => {
  return fetch(`/api?q=${deps.query}`, { signal: abortSignal });
});

// Subscribe to changes
const unsubscribe = count.on(() => {
  console.log("changed");
});

// Cleanup
count.dispose();
```

### rx

```tsx
// Static rendering
rx(() => <div>Static</div>);

// With watch dependencies
rx(() => <div>{value}</div>, { watch: [value] });

// With signals (always reactive)
rx({ user, posts }, (awaited, loadable) => (
  <div>
    <div>{awaited.user.name}</div>
    {loadable.posts.status === "loading" && <Spinner />}
  </div>
));
```

### useScope

```tsx
const { count, doubled } = useScope(
  () => ({
    count: signal(0),
    doubled: signal({ count }, ({ deps }) => deps.count * 2),
  }),
  {
    watch: [userId], // Recreate when userId changes
    onUpdate: [
      (scope) => {
        scope.count.set(propValue);
      },
      propValue, // Re-run when propValue changes
    ],
    onDispose: (scope) => {
      console.log("cleaning up");
    },
  }
);
```

### useAwaited

```tsx
import { Suspense } from "react";

const user = signal(async () => fetchUser());
const posts = signal(async () => fetchPosts());

function Component() {
  const awaited = useAwaited({ user, posts });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div>{awaited.user.name}</div>
      <div>{awaited.posts.length} posts</div>
    </Suspense>
  );
}
```

### useLoadable

```tsx
const data = signal(async () => fetchData());

function Component() {
  const loadable = useLoadable({ data });

  if (loadable.data.status === "loading") return <Spinner />;
  if (loadable.data.status === "error")
    return <Error error={loadable.data.error} />;
  return <div>{loadable.data.value}</div>;
}
```

---

## Comparison

### vs. React useState

```tsx
// React
const [count, setCount] = useState(0);
const doubled = useMemo(() => count * 2, [count]);

// Rextive
const count = signal(0);
const doubled = signal({ count }, ({ deps }) => deps.count * 2);
```

**Benefits:** Unified sync/async API, component scoping, works outside components

### vs. Zustand

```tsx
// Zustand - must select all states upfront
const { user, posts, comments } = useStore((state) => ({
  user: state.user,
  posts: state.posts,
  comments: state.comments, // Selected even if not used
}));

// Rextive - only subscribes to what you access
rx({ user, posts, comments }, (awaited) => {
  // Only awaited.user accessed = only user subscribed
  return <div>{awaited.user.name}</div>;
});
```

**Benefits:** Lazy tracking (only subscribes to accessed signals), simpler API, async support, component scoping

### vs. React Query

```tsx
// React Query
const { data } = useQuery({
  queryKey: ["todos", userId],
  queryFn: () => fetchTodos(userId),
});

// Rextive
const userId = signal(1);
const todos = signal({ userId }, async ({ deps, abortSignal }) => {
  return fetch(`/todos/${deps.userId}`, { signal: abortSignal });
});
```

**Benefits:** No provider needed, works globally or component-scoped, same abort signal support

### vs. Jotai

```tsx
// Jotai - must use all atoms upfront
const user = useAtom(userAtom);
const posts = useAtom(postsAtom); // Subscribed even if not used
const comments = useAtom(commentsAtom); // Subscribed even if not used

// Rextive - only subscribes to what you access
rx({ user, posts, comments }, (awaited) => {
  // Only awaited.user accessed = only user subscribed
  return <div>{awaited.user.name}</div>;
});
```

**Benefits:** Lazy tracking (only subscribes to accessed signals), unified sync/async API, component scoping

### vs. Redux Toolkit

```tsx
// Redux Toolkit
const counterSlice = createSlice({
  name: "counter",
  initialState: { value: 0 },
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
  },
});

// Rextive
const count = signal(0);
// count.set(count() + 1)
```

**Benefits:** Much simpler, no actions/reducers, direct updates

---

## Why Rextive?

- 🚀 **Simple** - Two concepts: `signal` + `rx`
- 💪 **Powerful** - Handles state, effects, queries, forms, polling
- ⚡ **Fast** - Only subscribes to what you use
- 🔄 **Async** - Built-in Suspense support, abort signals
- 🧹 **Clean** - Automatic cleanup with `useScope`
- 📦 **Small** - Zero dependencies

---

## License

MIT © linq2js
