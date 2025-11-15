# 🎯 rxblox

**Stop fighting React. Start building.**

Fine-grained reactive state management that actually makes sense. No boilerplate. No dependency arrays. No re-render hell.

[![npm version](https://img.shields.io/npm/v/rxblox.svg)](https://www.npmjs.com/package/rxblox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```bash
npm install rxblox
```

---

## The Problem You Know Too Well

**Every state change re-runs your entire component.**

```tsx
// 😫 Traditional React
function Counter() {
  const [count, setCount] = useState(0);

  // 🔄 This ENTIRE function re-executes on every click
  console.log("Component re-rendered!");

  // All this code runs again and again and again...
  const expensiveValue = computeSomething(); // Unnecessary!

  return (
    <div>
      <h1>{count}</h1>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <HeavyChart data={expensiveValue} />
    </div>
  );
}
```

**Result?** You reach for optimization tools:

```tsx
// Now you need this...
const expensiveValue = useMemo(() => computeSomething(), []);
const memoizedChild = useMemo(
  () => <HeavyChart data={expensiveValue} />,
  [expensiveValue]
);
const handleClick = useCallback(() => setCount((c) => c + 1), []);
```

**Three lines of logic become nine lines of optimization.**

And we haven't even mentioned dependency arrays yet...

---

## The rxblox Way

**What if only the actual values that changed updated?**

```tsx
// ✨ rxblox - Zero optimization needed
import { signal, blox, rx } from "rxblox";

const count = signal(0);

const Counter = blox(() => {
  // ✅ Definition phase runs ONCE (not on every render)
  console.log("Blox created!");

  // No useMemo needed - this runs once
  const expensiveValue = computeSomething();

  // No useCallback needed - functions are stable
  const increment = () => count.set((x) => x + 1);

  return (
    <div>
      {/* ONLY this <h1> updates when count changes */}
      <h1>{rx(count)}</h1>

      <button onClick={increment}>+1</button>

      {/* 
        Static child - expensiveValue never changes.
        If HeavyChart needs reactive props, wrap in rx():
        {rx(() => <HeavyChart data={someSignal()} />)}
      */}
      <HeavyChart data={expensiveValue} />
    </div>
  );
});
```

**That's it.**

- ✅ Definition phase runs **once** (not on every state change)
- ✅ Only `{rx(count)}` updates when count changes
- ✅ No `useMemo`, no `useCallback`, no `memo()`
- ✅ No optimization needed

### The Real Kicker: Dependency Arrays

Fine-grained updates are nice. But the **real** pain? Data fetching.

**Traditional React:**

```tsx
// 😫 The dependency array nightmare
const [userId, setUserId] = useState(1);
const [filters, setFilters] = useState({});

// Step 1: Wrap in useCallback
const fetchData = useCallback(async () => {
  const res = await fetch(
    `/api/data?user=${userId}&filters=${JSON.stringify(filters)}`
  );
  return res.json();
}, [userId, filters]); // ⚠️ Forget one? Stale closure bug.

// Step 2: Add useEffect
useEffect(() => {
  fetchData();
}, [fetchData]); // 🔥 If this is wrong? Infinite loop.

// Step 3: Fix the infinite loop by adding more arrays...
// Step 4-10: Debug why it's still broken...
```

**Three dependencies. Two arrays. One nightmare.**

**rxblox:**

```tsx
// ✨ No arrays. No useCallback. No bugs.
const userId = signal(1);
const filters = signal({ status: "active" });

const data = signal.async(async ({ track }) => {
  const tracked = track({ userId, filters });

  const res = await fetch(
    `/api/data?user=${tracked.id}&filters=${JSON.stringify(tracked.filters)}`
  );
  return res.json();
});

// That's it. Change anything? Auto re-fetches. Previous request? Auto-canceled.
userId.set(2); // Just works. 🎉
```

**Zero arrays. Zero bugs. Zero frustration.**

---

## Why Developers Love It

### 🎯 Fine-Grained Updates

Only the exact UI that depends on state updates. Everything else? Untouched.

```tsx
const count = signal(0);
const name = signal("Alice");

const App = blox(() => {
  return (
    <div>
      {/* Only updates when count changes */}
      <h1>{rx(count)}</h1>

      {/* Only updates when name changes */}
      <p>{rx(name)}</p>

      {/* Never re-renders */}
      <ExpensiveChart data={staticData} />
    </div>
  );
});
```

No `React.memo`. No `useMemo`. No optimization needed.

### 🚀 Less Code, More Features

**Before rxblox (Redux Toolkit):**

```tsx
// 35+ lines across 3 files 😰
// counterSlice.ts
const counterSlice = createSlice({
  name: "counter",
  initialState: { count: 0 },
  reducers: {
    increment: (state) => {
      state.count += 1;
    },
  },
});

// store.ts
const store = configureStore({
  reducer: { counter: counterReducer },
});

// Component.tsx
function Counter() {
  const count = useSelector((state) => state.counter.count);
  const dispatch = useDispatch();
  return <button onClick={() => dispatch(increment())}>{count}</button>;
}
```

**After rxblox:**

```tsx
// 6 lines. One file. Done. ✨
const count = signal(0);

function Counter() {
  return <button onClick={() => count.set((x) => x + 1)}>{rx(count)}</button>;
}
```

**6 lines vs 35.** Which would you rather maintain?

### ⚡ Built for TypeScript

Full type inference. No manual types needed.

```tsx
const user = signal({ name: "Alice", age: 30 });

const greeting = signal(() => {
  const u = user(); // Type: { name: string; age: number }
  return `Hello, ${u.name}!`; // ✅ Fully typed
});
```

### 🔄 Async Made Simple

Loading states, error handling, auto-cancellation—all built-in.

```tsx
const userId = signal(1);

const user = signal.async(async ({ track, abortSignal }) => {
  const id = track({ userId }).userId;

  const res = await fetch(`/api/users/${id}`, { signal: abortSignal });
  return res.json();
});

// In your component
{
  rx(() => {
    const u = user();

    if (u.status === "loading") return <Spinner />;
    if (u.status === "error") return <Error error={u.error} />;

    return <Profile user={u.value} />; // Type-safe!
  });
}
```

Loading? Error? Success? All handled. Previous requests? Auto-canceled.

---

## Real-World Example

Here's a real search component:

```tsx
import { signal, blox, rx, action } from "rxblox";

// Component
const SearchBox = blox(() => {
  // State
  const query = signal("");

  // Action with auto state tracking
  const search = action.cancellable(async (abortSignal, q: string) => {
    const res = await fetch(`/api/search?q=${q}`, { signal: abortSignal });
    return res.json();
  });

  const handleSearch = async (e) => {
    const q = e.target.value;
    query.set(q);

    if (q.length < 2) return;

    search(q); // Previous search auto-canceled
  };

  return (
    <div>
      {/* rx() wraps the entire input to make it reactive */}
      {rx(() => (
        <input value={query()} onChange={handleSearch} />
      ))}

      {rx(() => {
        if (search.status === "loading") return <Spinner />;

        return (
          <ul>
            {search.result.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
});
```

**Features you get for free:**

- ✅ Debounced search (only latest request completes)
- ✅ Auto-cancellation of previous requests
- ✅ Loading state tracking
- ✅ No memory leaks
- ✅ No dependency arrays
- ✅ Type-safe throughout

---

## What You Get

| Feature                  | Traditional React      | rxblox              |
| ------------------------ | ---------------------- | ------------------- |
| **Dependency arrays**    | ❌ Manual, error-prone | ✅ Automatic        |
| **Component re-renders** | ❌ Full component      | ✅ Only affected UI |
| **useCallback needed**   | ❌ Yes, everywhere     | ✅ Never            |
| **useMemo needed**       | ❌ For performance     | ✅ Built-in         |
| **Optimization**         | ❌ Manual memo()       | ✅ Automatic        |
| **Async state**          | ❌ Build yourself      | ✅ Built-in         |
| **Code amount**          | ❌ 3x more             | ✅ 3x less          |

---

## Quick Start

### Installation

```bash
npm install rxblox
# or
pnpm add rxblox
# or
yarn add rxblox
```

### Your First Component

```tsx
import { signal, blox, rx } from "rxblox";

// 1. Create a signal (global or local)
const count = signal(0);

// 2. Use it in a component
const Counter = blox(() => {
  // This runs ONCE on mount

  const increment = () => count.set(count() + 1);
  const decrement = () => count.set(count() - 1);

  return (
    <div>
      <button onClick={decrement}>-</button>
      {/* Only THIS updates when count changes */}
      <span>{rx(count)}</span>
      <button onClick={increment}>+</button>
    </div>
  );
});
```

**That's it!** You just built a counter with fine-grained reactivity.

### Form Example

```tsx
const name = signal("");
const email = signal("");

const MyForm = blox(() => {
  const isValid = signal(() => name().length > 0 && email().includes("@"));

  const handleSubmit = () => {
    console.log({ name: name(), email: email() });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Wrap inputs in rx() to make them reactive */}
      {rx(() => (
        <input value={name()} onChange={(e) => name.set(e.target.value)} />
      ))}
      {rx(() => (
        <input value={email()} onChange={(e) => email.set(e.target.value)} />
      ))}
      {rx(() => (
        <button disabled={!isValid()}>Submit</button>
      ))}
    </form>
  );
});
```

**No** `useState`. **No** re-renders. **No** complexity.

---

## Learn More

📚 **[Full Documentation](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/README.md)** - Complete guide with examples

### Essential Guides

- **[Core Concepts](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/core-concepts.md)** - Master the fundamentals in 10 minutes
- **[API Reference](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/api-reference.md)** - Every function, every option
- **[Patterns & Best Practices](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/patterns.md)** - Real-world patterns that work
- **[Comparisons](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/comparisons.md)** - See how we stack up

### Deep Dives

- **[Lifecycle & Cleanup](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/lifecycle-cleanup.md)** - Avoid memory leaks
- **[Performance Guide](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/performance.md)** - Make it blazing fast
- **[Architecture](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/ARCHITECTURE.md)** - How it works internally

---

## FAQ

**Q: Do I need to learn a new mental model?**  
A: If you've used signals in Solid.js or Preact, you already know it. If not, it's simpler than React hooks.

**Q: Can I use it with existing React code?**  
A: Yes! Drop it in anywhere. Use `signal()` for state, `rx()` for reactive UI. Mix with regular React components.

**Q: What about TypeScript?**  
A: First-class support. Full type inference. No manual types needed.

**Q: Is it production ready?**  
A: Yes. Used in production apps. Well-tested. MIT licensed.

**Q: What's the bundle size?**  
A: Lightweight. Smaller than most state management libraries.

**Q: Do I need to rewrite my app?**  
A: No. Start with one component. Gradually adopt where it helps.

---

## Contributing

Found a bug? Want a feature? PRs welcome!

**[Contributing Guide](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/contributing.md)** - How to help

---

## License

MIT © 2025

**Go build something amazing.** 🚀

---

<div align="center">

Made with ❤️ for developers who want to **code**, not **configure**

[⭐ Star on GitHub](https://github.com/linq2js/rxblox) • [📦 View on npm](https://www.npmjs.com/package/rxblox) • [📖 Read the Docs](https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/README.md)

</div>
