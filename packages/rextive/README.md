# Rextive

Small, fast and scalable reactive state management. Framework-agnostic core with React integration.

```bash
npm install rextive
```

## Works with Vanilla JavaScript

```html
<h1 id="counterText">Count: 0</h1>
<button id="increment">+1</button>
<button id="decrement">-1</button>
```

```js
import { signal } from "rextive";

const h1 = document.getElementById("counterText");
const increment = document.getElementById("increment");
const decrement = document.getElementById("decrement");

// Create reactive state
const count = signal(0);

// Create reactive effect (runs immediately with lazy: false)
signal(
  { count }, // dependencies
  ({ deps }) => {
    h1.textContent = `Count: ${deps.count}`;
  },
  { lazy: false } // options
);

// Wire up events
increment.onclick = () => count.set((x) => x + 1);
decrement.onclick = () => count.set((x) => x - 1);
```

## Works with React

```tsx
import { signal, rx } from "rextive/react";

const count = signal(0);
const doubled = signal({ count }, ({ deps }) => deps.count * 2);

function Counter() {
  return (
    <div>
      <h1>{rx(count)}</h1>
      <h2>{rx(doubled)}</h2>
      <button onClick={() => count.set((x) => x + 1)}>+1</button>
    </div>
  );
}
```

## That's it!

- ✅ Framework-agnostic - works with vanilla JS, React, or any framework
- ✅ Simple API - just `signal` for state management
- ✅ Powerful - handles state, effects, queries
- ✅ TypeScript - full type safety
- ✅ Lightweight - minimal dependencies

---

## Examples

### Vanilla JavaScript

#### Counter with DOM

```html
<!DOCTYPE html>
<html>
  <body>
    <h1 id="count">0</h1>
    <button id="increment">Increment</button>
    <button id="decrement">Decrement</button>
    <button id="reset">Reset</button>
    <script type="module">
      import { signal } from "rextive";

      const countElement = document.getElementById("count");
      const incrementBtn = document.getElementById("increment");
      const decrementBtn = document.getElementById("decrement");
      const resetBtn = document.getElementById("reset");

      // Reactive state
      const count = signal(0);

      // Reactive effect - updates DOM when count changes
      signal(
        { count },
        ({ deps }) => {
          countElement.textContent = deps.count;
        },
        { lazy: false }
      );

      // Event handlers
      incrementBtn.onclick = () => count.set((x) => x + 1);
      decrementBtn.onclick = () => count.set((x) => x - 1);
      resetBtn.onclick = () => count.reset();
    </script>
  </body>
</html>
```

#### Derived state

```js
import { signal } from "rextive";

const firstName = signal("John");
const lastName = signal("Doe");

// Derived signal
const fullName = signal(
  { firstName, lastName },
  ({ deps }) => `${deps.firstName} ${deps.lastName}`
);

// Effect to update DOM
signal(
  { fullName },
  ({ deps }) => {
    document.getElementById("name").textContent = deps.fullName;
  },
  { lazy: false }
);

// Subscribe to changes
const unsubscribe = fullName.on(() => {
  console.log("Name changed:", fullName());
});
```

#### Async data fetching

```js
import { signal } from "rextive";

const userId = signal(1);

// Async signal
const user = signal({ userId }, async ({ deps, abortSignal }) => {
  const res = await fetch(`/api/users/${deps.userId}`, {
    signal: abortSignal,
  });
  return res.json();
});

// Handle loading states
signal(
  { user },
  ({ deps }) => {
    const userValue = deps.user;
    const statusEl = document.getElementById("status");

    if (userValue && typeof userValue === "object" && "loading" in userValue) {
      statusEl.textContent = userValue.loading ? "Loading..." : "Loaded";
    }
  },
  { lazy: false }
);

// Subscribe to user data
user.on(() => {
  const userData = user();
  if (userData && !userData.loading) {
    document.getElementById("userName").textContent = userData.name;
  }
});

// Trigger fetch
userId.set(2); // Automatically cancels previous fetch
```

### React Examples

#### Basic usage

```tsx
import { signal, rx } from "rextive/react";

const name = signal("Alice");
const greeting = signal({ name }, ({ deps }) => `Hello, ${deps.name}!`);

function App() {
  return (
    <div>
      <h1>{rx(greeting)}</h1>
      {rx({ name }, (value) => (
        <input value={value.name} onChange={(e) => name.set(e.target.value)} />
      ))}
    </div>
  );
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
      <div>Count: {rx(count)}</div>
      <button onClick={() => count.set((x) => x + 1)}>+</button>
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
      {rx({ user }, (value) => (
        <div>{value.user.name}</div>
      ))}
    </Suspense>
  );
}
```

### Conditional rendering with cascading promises

```tsx
import { Suspense } from "react";
import { signal, rx, useSignals } from "rextive";

const cloudValue = signal(async () => fetchCloudValue());
const localValue = signal("default");

// Using rx()
function ConditionalComponent() {
  return (
    <Suspense fallback={<div>Loading cloud value...</div>}>
      {rx({ cloudValue, localValue }, (value) => {
        // If cloudValue is a promise, this will throw and wait
        // Once resolved, the check happens
        if (!value.cloudValue) {
          return <Comp1 />;
        }

        return <Other value={value.localValue} />;
      })}
    </Suspense>
  );
}

// Using useSignals
function ConditionalComponentWithHook() {
  const [value] = useSignals({ cloudValue, localValue });

  return (
    <Suspense fallback={<div>Loading cloud value...</div>}>
      {(() => {
        // If cloudValue is a promise, this will throw and wait
        // Once resolved, the check happens
        if (!value.cloudValue) {
          return <Comp1 />;
        }

        return <Other value={value.cloudValue} />;
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
refreshTrigger.set((x) => x + 1);

// Subscribe to effect results
effectResult.on(() => {
  console.log("Effect completed:", effectResult());
});
```

### Decoupled modules with trigger signals

```tsx
import { signal } from "rextive";

// Shared trigger signal - no initial value needed
const uploadType = signal<"document" | "image">();

// Document module - loads on demand, reacts independently
const handleUploadDocument = signal({ uploadType }, async ({ deps }) => {
  if (deps.uploadType === "document") {
    // Only runs when uploadType is "document"
    const result = await uploadDocumentService();
    return result;
  }
});

// Image module - loads on demand, reacts independently
const handleUploadImage = signal({ uploadType }, async ({ deps }) => {
  if (deps.uploadType === "image") {
    // Only runs when uploadType is "image"
    const result = await uploadImageService();
    return result;
  }
});

// Trigger from anywhere - modules react independently
uploadType.set("document"); // Only document module handles this
uploadType.set("image"); // Only image module handles this
```

**Benefits over centralized handlers:**

- ✅ Modules load on demand (code splitting friendly)
- ✅ No tight coupling between trigger and handlers
- ✅ Easy to add/remove handlers without changing trigger code
- ✅ Each module independently decides how to react

### React Query-like patterns

#### Queries (with abort signal)

```tsx
import { signal, useScope } from "rextive";

type TodoQueryVariables = { userId: number; status?: string };

function createTodoListQuery() {
  // Signal with no initial value - get() returns T | undefined, but set() requires T
  const payload = signal<TodoQueryVariables>();

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

  return rx({ result }, (value) => (
    <div>
      {value.result?.map((todo) => (
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
      {rx({ results }, (value) => (
        <div>
          {value.results?.map((item) => (
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
        pollTrigger.set((x) => x + 1);
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
      {rx({ data }, (value) => (
        <div>{JSON.stringify(value.data)}</div>
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

  return rx({ form, errors, isValid }, (value) => (
    <form>
      <input
        value={value.form.name}
        onChange={(e) => form.set({ ...form(), name: e.target.value })}
      />
      {value.errors.name && <span>{value.errors.name}</span>}

      <input
        value={value.form.email}
        onChange={(e) => form.set({ ...form(), email: e.target.value })}
      />
      {value.errors.email && <span>{value.errors.email}</span>}

      <textarea
        value={value.form.message}
        onChange={(e) => form.set({ ...form(), message: e.target.value })}
      />
      {value.errors.message && <span>{value.errors.message}</span>}

      <button disabled={!value.isValid}>Submit</button>
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

  return rx({ user }, (value) => <div>{value.user.name}</div>);
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

  return rx({ timer }, (value) => <div>{value.timer}</div>);
}
```

### Lazy tracking - only subscribe to what you use

```tsx
import { signal, rx } from "rextive";

const user = signal(async () => fetchUser());
const posts = signal(async () => fetchPosts());
const comments = signal(async () => fetchComments());

function Profile({ showPosts }: { showPosts: boolean }) {
  return rx({ user, posts, comments }, (value) => {
    // Only user is accessed - only user is subscribed
    <div>{value.user.name}</div>;

    // Conditionally access posts - only subscribed if accessed
    {
      showPosts && (
        <div>
          {value.posts.map((post) => (
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

### Batching updates

```tsx
import { signal } from "rextive";

const count = signal(0);
const name = signal("Alice");
const age = signal(25);

// Without batch: 3 separate notifications
count.set(1);
name.set("Bob");
age.set(30);

// With batch: Single notification after all updates
signal.batch(() => {
  count.set(1);
  name.set("Bob");
  age.set(30);
});

// Useful for derived signals
const user = signal({ count, name, age }, ({ deps }) => ({
  id: deps.count,
  name: deps.name,
  age: deps.age,
}));

// user recomputes once instead of 3 times
signal.batch(() => {
  count.set(2);
  name.set("Charlie");
  age.set(35);
});
```

### Batch with form updates

```tsx
import { signal, rx } from "rextive";

function UserForm() {
  const form = signal({
    firstName: "",
    lastName: "",
    email: "",
  });

  const fullName = signal({ form }, ({ deps }) =>
    `${deps.form.firstName} ${deps.form.lastName}`.trim()
  );

  const handleReset = () => {
    // Single update instead of 3
    signal.batch(() => {
      form.set((f) => ({ ...f, firstName: "" }));
      form.set((f) => ({ ...f, lastName: "" }));
      form.set((f) => ({ ...f, email: "" }));
    });
  };

  return (
    <div>
      <div>Full Name: {rx(fullName)}</div>
      <button onClick={handleReset}>Reset</button>
    </div>
  );
}
```

### Persistence with localStorage

```tsx
import { signal } from "rextive";

// Simple persistence with debouncing
const { signals } = signal.persist(
  { count: signal(0), name: signal("") },
  {
    load: () => {
      const stored = localStorage.getItem("app-state");
      return stored ? JSON.parse(stored) : {};
    },
    save: (values) => {
      localStorage.setItem("app-state", JSON.stringify(values));
    },
  }
);

// Signals are automatically loaded and saved
signals.count.set(42); // Automatically persisted
```

### Persistence with control

```tsx
import { signal } from "rextive";
import { debounce } from "lodash-es";

const { signals, pause, resume, status } = signal.persist(
  { todos: signal([]), filter: signal("all") },
  {
    load: () => JSON.parse(localStorage.getItem("todos") || "{}"),
    save: debounce((values) => {
      localStorage.setItem("todos", JSON.stringify(values));
    }, 300),
    onError: (error, type) => {
      console.error(`${type} failed:`, error);
    },
  }
);

// Pause during bulk operations
pause();
signals.todos.set([...newTodos]);
signals.filter.set("active");
resume(); // Saves latest state immediately

// Check status
console.log(status()); // 'idle' | 'loading' | 'watching' | 'paused'
```

### Conditional persistence

```tsx
import { signal } from "rextive";

const { signals, start, cancel } = signal.persist(
  { userSettings: signal({}), theme: signal("light") },
  {
    autoStart: false, // Don't start automatically
    load: async () => {
      const res = await fetch("/api/user-settings");
      return res.json();
    },
    save: (values) => {
      fetch("/api/user-settings", {
        method: "POST",
        body: JSON.stringify(values),
      });
    },
  }
);

// Start persistence only when user is logged in
if (isLoggedIn) {
  start();
}

// Stop persistence on logout
function logout() {
  cancel();
  // ... logout logic
}
```

---

## API

### signal

```tsx
// Create a signal
const count = signal(0);

// Create a signal with no initial value (undefined)
const user = signal<User>(); // Signal<User | undefined>

// Read value
count(); // 0
user(); // undefined

// Update value
count.set(1);
user.set({ name: "Alice" });

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

### signal.batch

```tsx
// Batch multiple signal updates
signal.batch(() => {
  count.set(1);
  name.set("Alice");
  age.set(25);
});

// Returns the function result
const result = signal.batch(() => {
  count.set(5);
  return count(); // 5
});

// Nested batches are supported
signal.batch(() => {
  count.set(1);
  signal.batch(() => {
    name.set("Bob");
  }); // No notifications yet
}); // Single notification after outer batch

// ❌ Cannot use async functions
signal.batch(async () => {
  await someAsyncOp(); // Error!
});
```

### signal.persist

```tsx
// Persist multiple signals with centralized load/save
const { signals, pause, resume, status, start, cancel } = signal.persist(
  { count: signal(0), name: signal("") },
  {
    load: () => JSON.parse(localStorage.getItem("state") || "{}"),
    save: (values) => localStorage.setItem("state", JSON.stringify(values)),
    onError: (error, type) => console.error(`${type} failed:`, error),
    autoStart: true, // default: true - start immediately
  }
);

// Check status: 'idle' | 'loading' | 'watching' | 'paused'
console.log(status());

// Control persistence
pause(); // Pause saving
resume(); // Resume and save latest state
cancel(); // Stop all persistence
start(); // Restart persistence
```

### signal.tag

```tsx
import { signal } from "rextive";

// Create a tag for a group of related signals (e.g. form fields)
const formTag = signal.tag<string>();

const name = signal("", { tags: [formTag] });
const email = signal("", { tags: [formTag] });

// Reset all tagged signals at once
const resetForm = () => {
  formTag.forEach((s) => s.reset());
};

// You can also work with multiple tags at once
const aTag = signal.tag<number>();
const bTag = signal.tag<string>();

signal.tag.forEach([aTag, bTag] as const, (s) => {
  // s is Signal<number | string>
  s.reset();
});
```

### wait

```tsx
import { signal, wait } from "rextive";

const user = signal(async () => fetchUser());
const posts = signal(async () => fetchPosts());

// Synchronous (Suspense-style) - throws promises/errors, returns values
// Use this form inside rx() / effects / hooks (no await)
const [u, p] = wait([user, posts] as const);

// Async with onResolve (returns Promise)
await wait([user, posts] as const, (u, p) => {
  console.log(u.name, p.length);
});

// Async with onResolve + onError (returns Promise)
await wait(
  [user, posts] as const,
  (u, p) => ({ userName: u.name, postCount: p.length }),
  (error) => ({ userName: "Guest", postCount: 0 })
);

// Convenience helpers
// Suspense-style (no callbacks, no await):
// const [fastest, key] = wait.any({ user, posts }); // first success
// const [first, source] = wait.race({ user, posts }); // first settle
// const settled = wait.settled([user, posts]); // all results as PromiseSettledResult[]

// Promise-style (with callbacks)
await wait.any({ user, posts }, ([val, key]) => {
  console.log("first success from", key, val);
});

await wait.race({ user, posts }, ([val, key]) => {
  console.log("first completion from", key, val);
});

const settled = await wait.settled([user, posts]); // all results as PromiseSettledResult[]

// Timeout & delay (Promise-based)
const result = await wait.timeout(user, 5000, "User fetch timed out");
await wait.delay(1000); // simple sleep
```

### rx

```tsx
// Static rendering
rx(() => <div>Static</div>);

// With watch dependencies
rx(() => <div>{value}</div>, { watch: [value] });

// Single signal - convenient shorthand
const count = signal(42);
rx(count); // Renders: 42

// With signals (always reactive)
rx({ user, posts }, (value, loadable) => (
  <div>
    <div>{value.user.name}</div>
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

### useSignals

```tsx
import { Suspense } from "react";

const user = signal(async () => fetchUser());
const posts = signal(async () => fetchPosts());

// Using value (Suspense pattern)
function Component() {
  const [value] = useSignals({ user, posts });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div>{value.user.name}</div>
      <div>{value.posts.length} posts</div>
    </Suspense>
  );
}

// Using loadable (manual loading states)
function ComponentWithLoadable() {
  const [, loadable] = useSignals({ user, posts });

  if (loadable.user.status === "loading") return <Spinner />;
  if (loadable.user.status === "error")
    return <Error error={loadable.user.error} />;
  return <div>{loadable.user.value.name}</div>;
}

// Using both
function ComponentWithBoth() {
  const [value, loadable] = useSignals({ user, posts });

  return (
    <div>
      {loadable.user.status === "loading" ? (
        <Spinner />
      ) : (
        <div>{value.user.name}</div>
      )}
    </div>
  );
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
// count.set(x => x + 1)
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
