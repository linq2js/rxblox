# Comparison with Other Signal Libraries

This document compares rxblox with other popular reactive state management libraries to help you understand the differences and make informed decisions.

## Quick Comparison Table

| Feature                | rxblox           | SolidJS           | Preact Signals | Jotai               | Zustand       | MobX               |
| ---------------------- | ---------------- | ----------------- | -------------- | ------------------- | ------------- | ------------------ |
| **Signals**            | ✅               | ✅                | ✅             | ✅ (atoms)          | ❌            | ✅ (observables)   |
| **Computed Signals**   | ✅               | ✅ (memos)        | ✅             | ✅ (derived)        | ❌            | ✅ (computed)      |
| **React Integration**  | ✅ `blox`, `rx`  | ✅ Built-in       | ✅ Hooks       | ✅ Hooks            | ✅ Hooks      | ✅ observer        |
| **Partial Re-renders** | ✅ `rx()` blocks | ✅ JSX            | ❌             | ❌                  | ❌            | ✅ with mobx-react |
| **Persistence**        | ✅ Built-in      | ❌ External       | ❌ External    | ✅ Built-in         | ✅ middleware | ❌ External        |
| **History Tracking**   | ✅ Built-in      | ❌ Manual         | ❌ Manual      | ❌ Manual           | ❌ Manual     | ❌ External        |
| **Signal Tagging**     | ✅ Built-in      | ❌                | ❌             | ❌                  | ❌            | ❌                 |
| **Async Actions**      | ✅ Built-in      | ✅ createResource | ❌             | ✅ atomWithSuspense | ❌            | ✅ flow            |
| **Loadable Pattern**   | ✅ Built-in      | ❌ Suspense       | ❌             | ✅ Suspense         | ❌            | ❌                 |
| **Effects**            | ✅               | ✅                | ✅             | ❌                  | ❌            | ✅ (autorun)       |
| **TypeScript**         | ✅ Full          | ✅ Full           | ✅ Full        | ✅ Full             | ✅ Full       | ✅ Full            |
| **Bundle Size**        | ~16KB            | ~7KB              | ~2KB           | ~3KB                | ~1KB          | ~16KB              |
| **Learning Curve**     | Medium           | Medium            | Low            | Low                 | Low           | High               |

## Detailed Comparisons

### vs. SolidJS Signals

**SolidJS** is a framework with its own compiler and reactive primitives.

#### Similarities

- Both use fine-grained reactivity
- Both have signals and computed values (memos)
- Both support effects
- Both have excellent TypeScript support

#### Key Differences

**1. Framework Integration**

```tsx
// SolidJS - Framework with compiler
import { createSignal, Show } from "solid-js";

function Counter() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count()}</button>;
}

// rxblox - React library
import { signal, blox, rx } from "rxblox";

const Counter = blox(() => {
  const count = signal(0);
  return rx(() => (
    <button onClick={() => count.set((c) => c + 1)}>{count()}</button>
  ));
});
```

**2. Partial Re-renders**

```tsx
// SolidJS - JSX is reactive by default
<div>
  <h1>Static</h1>
  <p>{count()}</p> {/* Only this updates */}
</div>

// rxblox - Use rx() for granular reactivity
<div>
  <h1>Static</h1>
  {rx(() => <p>{count()}</p>)} {/* Only this updates */}
</div>
```

**3. Persistence**

```tsx
// SolidJS - No built-in persistence
import { createSignal } from "solid-js";
import { createLocalStorage } from "@solid-primitives/storage";

const [count, setCount] = createLocalStorage("count", 0);

// rxblox - Built-in persistence with status tracking
import { signal, tag } from "rxblox";

const count = signal(0, {
  persist: createLocalStoragePersistor("count"),
});

// Access status reactively
if (count.persistInfo.status === "reading") {
  return <Spinner />;
}
```

**4. History & Debugging**

```tsx
// SolidJS - Manual implementation
import { createSignal, createMemo } from "solid-js";

const [count, setCount] = createSignal(0);
const [history, setHistory] = createSignal([]);
createEffect(() => {
  setHistory((prev) => [...prev, count()]);
});

// rxblox - Built-in history
import { signal } from "rxblox";

const count = signal(0);
const history = signal.history(() => count(), { debounce: 300 });

// Query API
history.latest();
history.between(startTime, endTime);
```

**When to choose:**

- **SolidJS**: Building a new app, want compiler optimizations, need SSR
- **rxblox**: Adding reactivity to React apps, need persistence/history, want fine control

---

### vs. Preact Signals

**Preact Signals** is a lightweight signal library for Preact and React.

#### Similarities

- Both integrate with React
- Both use signals for reactive state
- Both support computed signals
- Both have small footprints

#### Key Differences

**1. Partial Re-renders in React**

```tsx
// Preact Signals - Renders entire component
import { signal } from "@preact/signals-react";

function Counter() {
  const count = signal(0);
  return (
    <div>
      <h1>Static Header</h1> {/* Re-renders when count changes */}
      <p>{count.value}</p>
    </div>
  );
}

// rxblox - Granular updates with rx()
import { signal, blox, rx } from "rxblox";

const Counter = blox(() => {
  const count = signal(0);
  return (
    <div>
      <h1>Static Header</h1> {/* Never re-renders */}
      {rx(() => (
        <p>{count()}</p>
      ))} {/* Only this updates */}
    </div>
  );
});
```

**2. Feature Set**

```tsx
// Preact Signals - Basic features only
import { signal, computed, effect } from "@preact/signals-react";

const count = signal(0);
const doubled = computed(() => count.value * 2);
effect(() => console.log(count.value));

// rxblox - Rich feature set
import { signal, effect } from "rxblox";

const count = signal(0, {
  persist: myPersistor, // ✅ Persistence
  tags: [formTag], // ✅ Tagging
});

const history = signal.history(() => count()); // ✅ History
const doubled = signal(() => count() * 2); // ✅ Computed
effect(() => console.log(count())); // ✅ Effects
```

**3. API Design**

```tsx
// Preact Signals - .value property
count.value++;
console.log(count.value);

// rxblox - Function calls (more composable)
count.set((c) => c + 1);
console.log(count());

// Easier to pass around
const logValue = (getter: () => number) => console.log(getter());
logValue(count); // Works directly
```

**When to choose:**

- **Preact Signals**: Minimal bundle size is critical, simple use case
- **rxblox**: Need granular React updates, persistence, history, advanced features

---

### vs. Jotai

**Jotai** is an atom-based state management library for React.

#### Similarities

- Both work with React
- Both support derived state
- Both have persistence support
- Both have async support

#### Key Differences

**1. State Location**

```tsx
// Jotai - Global atoms
import { atom, useAtom } from "jotai";

const countAtom = atom(0); // Global

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

// rxblox - Flexible (global or local)
import { signal, blox, rx } from "rxblox";

// Global signal
const globalCount = signal(0);

// Local signal in component
const Counter = blox(() => {
  const localCount = signal(0); // Component-scoped
  return rx(() => (
    <button onClick={() => localCount.set((c) => c + 1)}>{localCount()}</button>
  ));
});
```

**2. Granular Updates**

```tsx
// Jotai - Entire component re-renders
function Counter() {
  const [count] = useAtom(countAtom);
  return (
    <div>
      <h1>Static</h1> {/* Re-renders */}
      <p>{count}</p>
    </div>
  );
}

// rxblox - Granular with rx()
const Counter = blox(() => {
  const count = signal(0);
  return (
    <div>
      <h1>Static</h1> {/* Never re-renders */}
      {rx(() => (
        <p>{count()}</p>
      ))} {/* Only this updates */}
    </div>
  );
});
```

**3. Derived State**

```tsx
// Jotai - Separate atom
const countAtom = atom(0);
const doubledAtom = atom((get) => get(countAtom) * 2);

function Component() {
  const [doubled] = useAtom(doubledAtom);
  return <div>{doubled}</div>;
}

// rxblox - Computed signal (collocated)
const Counter = blox(() => {
  const count = signal(0);
  const doubled = signal(() => count() * 2);

  return rx(() => <div>{doubled()}</div>);
});
```

**4. Tagging & History**

```tsx
// Jotai - Not built-in
// Need custom implementation

// rxblox - Built-in
const formTag = tag<string>();
const name = signal("", { tags: [formTag] });
const email = signal("", { tags: [formTag] });

// Reset all form fields
formTag.forEach((s) => s.reset());

// Track history
const history = signal.history(() => name());
```

**When to choose:**

- **Jotai**: Prefer global atom pattern, use Suspense heavily, simpler mental model
- **rxblox**: Need granular updates, local state, tagging, history tracking

---

### vs. Zustand

**Zustand** is a simple state management library using a store pattern.

#### Similarities

- Both work with React
- Both support persistence
- Both have simple APIs
- Both have small bundles

#### Key Differences

**1. Reactivity Model**

```tsx
// Zustand - Store-based, no signals
import create from "zustand";

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

function Counter() {
  const count = useStore((state) => state.count);
  const increment = useStore((state) => state.increment);
  return <button onClick={increment}>{count}</button>;
}

// rxblox - Signal-based reactivity
import { signal, blox, rx } from "rxblox";

const count = signal(0);

const Counter = blox(() => {
  return rx(() => (
    <button onClick={() => count.set((c) => c + 1)}>{count()}</button>
  ));
});
```

**2. Granular Updates**

```tsx
// Zustand - Component re-renders
function Component() {
  const { user, count } = useStore();
  return (
    <div>
      <h1>{user.name}</h1> {/* Re-renders when count changes */}
      <p>{count}</p>
    </div>
  );
}

// rxblox - Surgical updates
const Component = blox(() => {
  return (
    <div>
      {rx(() => (
        <h1>{user().name}</h1>
      ))}{" "}
      {/* Independent */}
      {rx(() => (
        <p>{count()}</p>
      ))} {/* Independent */}
    </div>
  );
});
```

**3. Computed Values**

```tsx
// Zustand - Manual implementation
const useStore = create((set, get) => ({
  count: 0,
  doubled: () => get().count * 2, // Not cached!
}));

// rxblox - Built-in computed signals
const count = signal(0);
const doubled = signal(() => count() * 2); // Cached automatically
```

**4. Effects**

```tsx
// Zustand - No built-in effects
// Use React's useEffect

// rxblox - Built-in reactive effects
effect(() => {
  console.log("Count changed:", count());
});
```

**When to choose:**

- **Zustand**: Simple store pattern, familiar Redux-like API, minimal reactivity needs
- **rxblox**: Need fine-grained reactivity, computed values, effects, advanced features

---

### vs. MobX

**MobX** is a mature reactive state management library using observables.

#### Similarities

- Both support fine-grained reactivity
- Both have computed values
- Both have effects (reactions)
- Both support partial re-renders

#### Key Differences

**1. API Complexity**

```tsx
// MobX - Class-based with decorators
import { makeObservable, observable, computed, action } from "mobx";
import { observer } from "mobx-react-lite";

class CounterStore {
  count = 0;

  constructor() {
    makeObservable(this, {
      count: observable,
      doubled: computed,
      increment: action,
    });
  }

  get doubled() {
    return this.count * 2;
  }

  increment() {
    this.count++;
  }
}

const Counter = observer(() => {
  return <div>{store.count}</div>;
});

// rxblox - Function-based, simpler
import { signal, blox, rx } from "rxblox";

const count = signal(0);
const doubled = signal(() => count() * 2);

const Counter = blox(() => {
  return rx(() => <div>{count()}</div>);
});
```

**2. Granular Control**

```tsx
// MobX - observer() makes entire component reactive
const Counter = observer(() => {
  return (
    <div>
      <h1>{store.title}</h1> {/* Tracks store.title */}
      <p>{store.count}</p> {/* Tracks store.count */}
    </div>
  );
});

// rxblox - Explicit rx() blocks for fine control
const Counter = blox(() => {
  return (
    <div>
      {rx(() => (
        <h1>{title()}</h1>
      ))}{" "}
      {/* Independent tracking */}
      {rx(() => (
        <p>{count()}</p>
      ))} {/* Independent tracking */}
    </div>
  );
});
```

**3. Built-in Features**

```tsx
// MobX - External libraries needed
import { observable } from "mobx";
import { makePersistable } from "mobx-persist-store"; // External

class Store {
  @observable count = 0;
}
makePersistable(store, { name: "count", properties: ["count"] });

// rxblox - Built-in
const count = signal(0, {
  persist: createLocalStoragePersistor("count"),
});

// Built-in history
const history = signal.history(() => count());

// Built-in tagging
const formTag = tag<string>();
const name = signal("", { tags: [formTag] });
```

**4. TypeScript**

```tsx
// MobX - More ceremony
import { makeObservable, observable, computed } from "mobx";

class Store {
  count: number = 0;

  constructor() {
    makeObservable(this, {
      count: observable,
      doubled: computed,
    });
  }

  get doubled(): number {
    return this.count * 2;
  }
}

// rxblox - Inference works naturally
const count = signal(0);
const doubled = signal(() => count() * 2); // Type inferred
```

**When to choose:**

- **MobX**: Large existing codebase, prefer OOP patterns, need mature ecosystem
- **rxblox**: Prefer functional style, want modern API, need built-in features

---

## Feature Highlights: What Makes rxblox Unique

### 1. Granular React Updates with `rx()`

rxblox is the only signal library that gives you **explicit control** over React update boundaries:

```tsx
const App = blox(() => {
  const count = signal(0);
  const name = signal("Alice");

  return (
    <div>
      <h1>Static Header</h1>

      {/* Only updates when count changes */}
      {rx(() => (
        <p>Count: {count()}</p>
      ))}

      {/* Only updates when name changes */}
      {rx(() => (
        <p>Name: {name()}</p>
      ))}

      <button onClick={() => count.set((c) => c + 1)}>
        Increment {/* Static */}
      </button>
    </div>
  );
});
```

### 2. Built-in Persistence with Status Tracking

Only rxblox provides **first-class persistence** with reactive status:

```tsx
const user = signal(null, {
  persist: createServerPersistor("/api/user"),
});

// Reactive status tracking
rx(() => {
  const { status, error } = user.persistInfo;

  if (status === "reading") return <Spinner />;
  if (status === "read-failed") return <Error error={error} />;

  return <UserProfile user={user()} />;
});
```

### 3. History Tracking

Built-in time-travel debugging:

```tsx
const count = signal(0);
const history = signal.history(() => count(), { debounce: 300 });

// Rich query API
history.latest();
history.oldest();
history.between(startTime, endTime);
history.values(); // [0, 1, 2, 3]

// Undo/redo
const undo = () => {
  const prev = history.at(-2);
  if (prev) count.set(prev.value);
};
```

### 4. Signal Tagging

Unique to rxblox - group and batch-operate on signals:

```tsx
const formTag = tag<string>();
const name = signal("", { tags: [formTag] });
const email = signal("", { tags: [formTag] });
const phone = signal("", { tags: [formTag] });

// Reset entire form
const resetForm = () => {
  formTag.forEach((signal) => signal.reset());
};

// Validate all fields
const isValid = formTag.signals().every((s) => s.peek() !== "");
```

### 5. Loadable Pattern

Ergonomic async state management:

```tsx
const user = signal.async(async ({ track }) => {
  const { userId } = track({ userId });
  return await fetchUser(userId);
});

rx(() => {
  const loadable = user();

  if (loadable.loading) return <Spinner />;
  if (loadable.error) return <Error error={loadable.error} />;

  return <UserProfile user={loadable.value} />;
});
```

---

## Bundle Size Comparison

Minified + Gzipped:

| Library            | Size  | Features                                                                     |
| ------------------ | ----- | ---------------------------------------------------------------------------- |
| **Zustand**        | ~1KB  | Store, no signals, no computed                                               |
| **Preact Signals** | ~2KB  | Signals, computed, effects                                                   |
| **Jotai**          | ~3KB  | Atoms, derived, persistence                                                  |
| **SolidJS**        | ~7KB  | Full framework (compiler required)                                           |
| **rxblox**         | ~16KB | Signals, computed, effects, persistence, history, tagging, actions, loadable |
| **MobX**           | ~16KB | Observables, computed, reactions                                             |

**Note:** rxblox's larger size reflects its comprehensive feature set. If you only need basic signals, other libraries may be lighter. If you need persistence + history + tagging, adding separate libraries would exceed rxblox's size.

---

## Migration Guides

### From Preact Signals

```tsx
// Before (Preact Signals)
import { signal, computed, effect } from "@preact/signals-react";

const count = signal(0);
const doubled = computed(() => count.value * 2);

function Counter() {
  return <div>{count.value}</div>;
}

// After (rxblox)
import { signal, blox, rx } from "rxblox";

const count = signal(0);
const doubled = signal(() => count() * 2);

const Counter = blox(() => {
  return rx(() => <div>{count()}</div>);
});
```

**Key changes:**

- `signal.value` → `signal()`
- `computed()` → `signal(() => ...)`
- Wrap component in `blox()` and reactive parts in `rx()`

### From Jotai

```tsx
// Before (Jotai)
import { atom, useAtom } from "jotai";

const countAtom = atom(0);
const doubledAtom = atom((get) => get(countAtom) * 2);

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

// After (rxblox)
import { signal, blox, rx } from "rxblox";

const count = signal(0);
const doubled = signal(() => count() * 2);

const Counter = blox(() => {
  return rx(() => (
    <button onClick={() => count.set((c) => c + 1)}>{count()}</button>
  ));
});
```

**Key changes:**

- `atom()` → `signal()`
- `useAtom()` → Direct signal access in `blox()`
- Wrap reactive JSX in `rx()`

### From Zustand

```tsx
// Before (Zustand)
import create from "zustand";

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

function Counter() {
  const count = useStore((state) => state.count);
  const increment = useStore((state) => state.increment);
  return <button onClick={increment}>{count}</button>;
}

// After (rxblox)
import { signal, blox, rx } from "rxblox";

const count = signal(0);
const increment = () => count.set((c) => c + 1);

const Counter = blox(() => {
  return rx(() => <button onClick={increment}>{count()}</button>);
});
```

**Key changes:**

- Store → Individual signals
- `useStore()` → Direct signal access in `blox()`
- Wrap reactive JSX in `rx()`

---

## Conclusion

**Choose rxblox if you:**

- ✅ Want fine-grained React updates without a compiler
- ✅ Need built-in persistence with status tracking
- ✅ Want history tracking and time-travel debugging
- ✅ Need to group signals (tagging)
- ✅ Prefer functional programming over OOP
- ✅ Want comprehensive features in one library

**Choose other libraries if you:**

- **Preact Signals**: Need minimal bundle size, basic signals only
- **SolidJS**: Building new app, want framework + compiler
- **Jotai**: Prefer atom/global state pattern, heavy Suspense usage
- **Zustand**: Want simple store pattern, minimal reactivity
- **MobX**: Have large OOP codebase, need mature ecosystem

---

## Performance Considerations

All modern signal libraries have excellent performance. Here are some notes:

### rxblox

- **Strength**: Granular `rx()` blocks prevent unnecessary React renders
- **Consideration**: Explicit `rx()` blocks add slight verbosity
- **Best for**: Complex UIs with many independent reactive sections

### Preact Signals

- **Strength**: Smallest bundle size
- **Consideration**: No granular control in React (whole component re-renders)
- **Best for**: Simple apps, small bundle size critical

### SolidJS

- **Strength**: Compiler optimizations, finest-grained updates
- **Consideration**: Requires build step, not just a library
- **Best for**: New projects, maximum performance

### Jotai/Zustand

- **Strength**: Simple mental model
- **Consideration**: No built-in granular updates
- **Best for**: Apps where component-level re-renders are acceptable

In practice, all these libraries perform well for most applications. Choose based on features and API preferences rather than micro-benchmarks.
