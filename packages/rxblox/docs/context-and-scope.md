# Context and Scope Reference

This document explains the context requirements and scope rules for all rxblox APIs.

## Table of Contents

- [Context Types](#context-types)
- [Scope Reference: What Can I Create/Use?](#scope-reference-what-can-i-createuse)
- [API Context Reference](#api-context-reference)
- [Context Hierarchy](#context-hierarchy)
- [Common Patterns](#common-patterns)
- [Anti-Patterns](#anti-patterns)

---

## Context Types

rxblox uses the following context types (scopes) internally:

| Context Type | Description                          | Created By          |
| ------------ | ------------------------------------ | ------------------- |
| `none`       | Global scope, outside any rxblox API | -                   |
| `blox`       | Inside a `blox()` component builder  | `blox()`            |
| `effect`     | Inside an `effect()` callback        | `effect()`          |
| `signal`     | Inside a computed signal function    | `signal(() => ...)` |
| `batch`      | Inside a `batch()` block             | `batch()`           |
| `rx`         | Inside an `rx()` expression          | `rx(() => ...)`     |

---

## Scope Reference: What Can I Create/Use?

### Global Scope (`none`)

**Restrictions:**

- ❌ **Cannot use** `blox.onMount()` / `blox.onUnmount()` / `blox.onRender()` - Need `blox` scope
- ❌ **Cannot create** `blox.ref()` / `blox.slot()` / `blox.hook()` - Need `blox` scope
- ❌ **Cannot use** `blox.fill()` - Need active slot inside `blox.slot()`
- ❌ **Cannot use** `withXXX()` (provider consumers) - Need `blox` scope

**Everything else is allowed** - Create signals, effects, providers, actions, etc.

---

### `blox` Scope

**Context:** Inside a `blox()` component builder or `blox.slot()` callback

**Restrictions:**

- ❌ **Cannot create** nested `blox()` components

**Everything else is allowed** - Full access to all rxblox APIs and lifecycle hooks

**Notes:**

- `blox.slot()` callbacks inherit the `blox` scope (not a new scope type)
- Best for component-local state and lifecycle management

---

### `effect` Scope

**Context:** Inside an `effect()` callback

**Restrictions:**

- ❌ **Cannot create** `blox()` components
- ❌ **Cannot create** `rx()` expressions
- ❌ **Cannot use** `blox.onMount()` / `blox.onUnmount()` / `blox.onRender()` - Need `blox` scope
- ❌ **Cannot create** `blox.ref()` / `blox.slot()` / `blox.hook()` - Need `blox` scope
- ❌ **Cannot use** `blox.fill()` - Need active slot
- ❌ **Cannot use** `withXXX()` - Need `blox` scope

**Can create signals and nested effects** (use nested effects with caution ⚠️)

**Notes:**

- Effects run immediately and re-run when dependencies change
- Use for side effects like logging, analytics, subscriptions
- Access `AbortSignal` and `onCleanup()` via function parameter

---

### `signal` Scope (Computed)

**Context:** Inside a computed signal function `signal(() => ...)`

**Restrictions:**

- ❌ **Cannot create anything** - Computed signals must be pure functions
- ❌ **Cannot update signals** - Read-only
- ❌ **Cannot use** any `blox` APIs
- ❌ **Cannot use** `withXXX()` - Need `blox` scope

**Can only read signals** (automatically tracked) and use pure JavaScript functions

**Notes:**

- Keep computed signals pure and side-effect free
- Use for deriving values from other signals
- Access `AbortSignal` via function parameter (in `signal.async()`)

---

### `batch` Scope

**Context:** Inside a `batch()` block

**Purpose:** Group multiple signal updates into a single notification

**Restrictions:**

- ❌ **Cannot create** `signal()` / `signal.async()` / computed signals
- ❌ **Cannot create** `effect()`
- ❌ **Cannot create** `blox()` components
- ❌ **Cannot create** `rx()` expressions
- ❌ **Cannot create** `provider()`
- ❌ **Cannot use** `blox` APIs (unless already in `blox` scope)
- ❌ **Cannot use** `withXXX()` (unless already in `blox` scope)

**Can only read/update signals and nest `batch()` blocks**

**Notes:**

- `batch()` is for grouping updates, not creating reactive primitives
- Prevents unnecessary re-computations and re-renders during bulk updates
- Can be nested - outer batch wins

---

### `rx` Scope

**Context:** Inside an `rx()` expression

**Purpose:** Fine-grained reactive rendering

**Restrictions:**

- ❌ **Cannot create anything** - `rx()` is read-only
- ❌ **Cannot nest** `rx()` blocks
- ❌ **Cannot use** `withXXX()` - Need `blox` scope

**Can only read signals** (automatically tracked) and render JSX/React elements

**Notes:**

- `rx()` is for reactive rendering only
- Keep reactive boundaries independent - no nesting

---

## API Context Reference

### Core APIs

| API                 | Required Context | Creates Context                   | Available APIs Inside          | Notes                                                  |
| ------------------- | ---------------- | --------------------------------- | ------------------------------ | ------------------------------------------------------ |
| `signal(value)`     | Any              | `signal` (if computed)            | All signal APIs                | Can be called anywhere                                 |
| `signal(() => ...)` | Any except `rx`  | `signal`                          | Read signals only              | Computed signal - cannot create signals/effects inside |
| `signal.async()`    | Any except `rx`  | `signal` + provides `AbortSignal` | Read signals via `track()`     | Async computed signal                                  |
| `effect()`          | Any except `rx`  | `effect` + provides `AbortSignal` | Read signals, `onCleanup()`    | Runs immediately, re-runs on dependencies              |
| `batch()`           | Any              | `batch`                           | All APIs                       | Groups updates into single notification                |
| `blox()`            | None             | `blox`                            | All blox APIs + component APIs | Component builder, runs once per instance              |
| `rx()`              | Any except `rx`  | `rx`                              | Read signals only              | **Cannot create signals, effects, or nested rx()**     |

### Blox-Specific APIs

| API                | Required Context     | Creates Context     | Available APIs Inside      | Notes                                                            |
| ------------------ | -------------------- | ------------------- | -------------------------- | ---------------------------------------------------------------- |
| `blox.onMount()`   | `blox`               | None                | All APIs (inherits `blox`) | Callback runs when component mounts                              |
| `blox.onUnmount()` | `blox`               | None                | All APIs (inherits `blox`) | Callback runs when component unmounts                            |
| `blox.onRender()`  | `blox`               | None                | React hooks + all APIs     | Callback runs on every render, can use React hooks               |
| `blox.ref()`       | `blox`               | None                | -                          | Creates a ref object, must be called during builder              |
| `blox.ready()`     | Any                  | None                | -                          | Checks if refs are ready, typically in `onMount()` or `effect()` |
| `blox.slot()`      | `blox`               | None (keeps `blox`) | All blox APIs              | Executes function, captures `fill()` calls                       |
| `blox.fill()`      | Inside `blox.slot()` | None                | -                          | Must be inside active slot                                       |
| `blox.hook()`      | `blox`               | None                | -                          | Captures React hooks during render phase                         |

### Provider APIs

| API          | Required Context | Creates Context           | Available APIs Inside | Notes                                                |
| ------------ | ---------------- | ------------------------- | --------------------- | ---------------------------------------------------- |
| `provider()` | Any except `rx`  | None                      | -                     | Creates provider/consumer pair, call at module level |
| `<Provider>` | None             | Provides value to subtree | Normal React          | React component                                      |
| `withXXX()`  | `blox`           | None                      | -                     | Hook to consume provider value, must be in blox      |

### Action APIs

| API                    | Required Context | Creates Context               | Available APIs Inside            | Notes                                |
| ---------------------- | ---------------- | ----------------------------- | -------------------------------- | ------------------------------------ |
| `action()`             | Any              | None (when called)            | Normal async code                | Creates action, tracks status/result |
| `action.cancellable()` | Any              | None (provides `AbortSignal`) | Normal async code + abort signal | Auto-cancellable action              |
| `action.aborter()`     | Any              | None                          | -                                | Creates standalone abort controller  |

---

## Context Hierarchy

### Valid Nesting

```
Global (none)
├─ blox()                    ✅ Can create anything except nested blox
│  ├─ signal()              ✅ Create local reactive state
│  ├─ effect()              ✅ Create side effects
│  ├─ blox.onMount()        ✅ Lifecycle hook
│  ├─ blox.ref()            ✅ Create refs
│  ├─ blox.slot()           ✅ Slot/fill pattern (keeps blox context)
│  │  ├─ blox.fill()        ✅ Fill the slot
│  │  ├─ signal()           ✅ Context is still blox
│  │  └─ blox.onMount()     ✅ Context is still blox
│  └─ rx()                  ✅ Fine-grained reactive UI
│     └─ signal()           ❌ Cannot create signals in rx()
│
├─ signal(() => ...)        ✅ Computed signal
│  ├─ signal()              ❌ Cannot create signals
│  ├─ effect()              ❌ Cannot create effects
│  └─ rx()                  ❌ Cannot create rx blocks
│
├─ effect()                 ✅ Reactive side effect
│  ├─ signal()              ✅ Can create signals
│  ├─ effect()              ⚠️  Can create nested effects (be careful)
│  └─ rx()                  ❌ Cannot create rx blocks
│
├─ rx()                     ✅ Reactive expression
│  ├─ signal()              ❌ Cannot create signals
│  ├─ effect()              ❌ Cannot create effects
│  └─ rx()                  ❌ Cannot nest rx blocks
│
└─ batch()                  ✅ Batch updates
   └─ (any valid code)      ✅ All APIs available
```

---

## Common Patterns

### Pattern 1: Global State

```tsx
// ✅ Module level - no context required
const count = signal(0);
const doubled = signal(() => count() * 2);

effect(() => {
  console.log("Count:", count());
});
```

### Pattern 2: Component-Local State

```tsx
// ✅ Inside blox component
const Counter = blox(() => {
  // blox context - can create signals, effects, etc.
  const count = signal(0);

  effect(() => {
    console.log("Local count:", count());
  });

  return (
    <button onClick={() => count.set((x) => x + 1)}>Count: {rx(count)}</button>
  );
});
```

### Pattern 3: Computed Signals

```tsx
// ✅ Module level
const firstName = signal("John");
const lastName = signal("Doe");

// Inside computed signal context
const fullName = signal(() => {
  // ✅ Can read signals
  return `${firstName()} ${lastName()}`;

  // ❌ Cannot create signals
  // const temp = signal(0); // Error!

  // ❌ Cannot create effects
  // effect(() => {}); // Error!
});
```

### Pattern 4: Reactive UI with rx()

```tsx
const App = () => (
  <div>
    {/* ✅ rx() for reactive content */}
    {rx(() => (
      <h1>Count: {count()}</h1>
    ))}

    {/* ❌ Cannot create signals in rx() */}
    {rx(() => {
      // const local = signal(0); // Error!
      return <div>{count()}</div>;
    })}

    {/* ❌ Cannot nest rx() blocks */}
    {rx(() => (
      <div>
        {/* {rx(() => <span>Nested</span>)} // Error! */}
        <span>Not nested</span>
      </div>
    ))}
  </div>
);
```

### Pattern 5: Slot/Fill Pattern

```tsx
const MyComponent = blox(() => {
  // blox context

  const [Content, data] = blox.slot(() => {
    // Still in blox context! (not a new context type)

    // ✅ Can use blox APIs
    const temp = signal(0);

    blox.onMount(() => {
      console.log("Mounted");
    });

    // ✅ Fill the slot
    blox.fill(<div>Content here</div>);

    return { someData: 123 };
  });

  return <div>{Content}</div>;
});
```

### Pattern 6: Provider Pattern

```tsx
// ✅ Module level - create provider
const [withTheme, ThemeProvider] = provider("theme", "light");

// ✅ Use in component tree
const App = () => (
  <ThemeProvider value="dark">
    <ThemedComponent />
  </ThemeProvider>
);

// ✅ Consume in blox component
const ThemedComponent = blox(() => {
  const theme = withTheme(); // Returns signal

  return rx(() => <div className={theme()}>Content</div>);
});
```

---

## Anti-Patterns

### ❌ Creating Signals in rx()

**Wrong:**

```tsx
{
  rx(() => {
    const local = signal(0); // Error! Cannot create signals in rx()
    return <div>{local()}</div>;
  });
}
```

**Right:**

```tsx
const MyComponent = blox(() => {
  const local = signal(0); // Create in blox scope

  return rx(() => <div>{local()}</div>);
});
```

### ❌ Nesting rx() Blocks

**Wrong:**

```tsx
{
  rx(() => (
    <div>
      {rx(() => (
        <span>Nested</span>
      ))}{" "}
      {/* Error! Cannot nest rx() */}
    </div>
  ));
}
```

**Right:**

```tsx
// Option 1: Single rx() block
{
  rx(() => (
    <div>
      <span>Not nested</span>
    </div>
  ));
}

// Option 2: Sibling rx() blocks
<div>
  {rx(() => (
    <span>Block 1</span>
  ))}
  {rx(() => (
    <span>Block 2</span>
  ))}
</div>;
```

### ❌ Creating Effects in Computed Signals

**Wrong:**

```tsx
const computed = signal(() => {
  effect(() => {
    // Error! Cannot create effects in computed signal
    console.log("side effect");
  });
  return count() * 2;
});
```

**Right:**

```tsx
// Create effect separately
effect(() => {
  const value = count() * 2;
  console.log("side effect", value);
});

const computed = signal(() => count() * 2);
```

### ❌ Using blox APIs Outside blox

**Wrong:**

```tsx
function RegularComponent() {
  blox.onMount(() => {
    // Error! Not in blox context
    console.log("mounted");
  });

  const ref = blox.ref(); // Error! Not in blox context

  return <div>Content</div>;
}
```

**Right:**

```tsx
const BloxComponent = blox(() => {
  blox.onMount(() => {
    // ✅ Inside blox context
    console.log("mounted");
  });

  const ref = blox.ref(); // ✅ Inside blox context

  return <div ref={ref}>Content</div>;
});
```

### ❌ Creating Providers in rx()

**Wrong:**

```tsx
{
  rx(() => {
    const [withValue, Provider] = provider("value", 0); // Error!
    return <div>Content</div>;
  });
}
```

**Right:**

```tsx
// Create at module level
const [withValue, ValueProvider] = provider("value", 0);

const App = () => (
  <ValueProvider value={0}>
    {rx(() => (
      <div>Content</div>
    ))}
  </ValueProvider>
);
```

---

## Quick Reference Tables

### Table 1: What Can I Create in Each Scope?

| API / Scope         | Global | blox | effect | signal | batch   | rx  |
| ------------------- | ------ | ---- | ------ | ------ | ------- | --- |
| `signal(value)`     | ✅     | ✅   | ✅     | ❌     | ❌      | ❌  |
| `signal(() => ...)` | ✅     | ✅   | ✅     | ❌     | ❌      | ❌  |
| `signal.async()`    | ✅     | ✅   | ✅     | ❌     | ❌      | ❌  |
| `effect()`          | ✅     | ✅   | ⚠️     | ❌     | ❌      | ❌  |
| `batch()`           | ✅     | ✅   | ✅     | ❌     | ✅ Nest | ❌  |
| `blox()`            | ✅     | ❌   | ❌     | ❌     | ❌      | ❌  |
| `rx()`              | ✅     | ✅   | ✅     | ❌     | ❌      | ❌  |
| `provider()`        | ✅     | ✅   | ✅     | ❌     | ❌      | ❌  |
| `action()`          | ✅     | ✅   | ✅     | ❌     | ❌      | ❌  |
| `blox.ref()`        | ❌     | ✅   | ❌     | ❌     | ❌      | ❌  |
| `blox.slot()`       | ❌     | ✅   | ❌     | ❌     | ❌      | ❌  |

### Table 2: What Can I Use in Each Scope?

| API / Action           | Global | blox | effect | signal | batch | rx  |
| ---------------------- | ------ | ---- | ------ | ------ | ----- | --- |
| Read signals           | ✅     | ✅   | ✅     | ✅     | ✅    | ✅  |
| Update signals         | ✅     | ✅   | ✅     | ❌     | ✅    | ❌  |
| `blox.onMount()`       | ❌     | ✅   | ❌     | ❌     | ❌    | ❌  |
| `blox.onUnmount()`     | ❌     | ✅   | ❌     | ❌     | ❌    | ❌  |
| `blox.onRender()`      | ❌     | ✅   | ❌     | ❌     | ❌    | ❌  |
| `blox.ready()`         | ✅     | ✅   | ✅     | ✅     | ✅    | ✅  |
| `blox.fill()`          | ❌     | ✅\* | ❌     | ❌     | ❌    | ❌  |
| `blox.hook()`          | ❌     | ✅   | ❌     | ❌     | ❌    | ❌  |
| `withXXX()` (provider) | ❌     | ✅   | ❌     | ❌     | ❌    | ❌  |
| `onCleanup()`          | ❌     | ❌   | ✅\*\* | ❌     | ❌    | ❌  |
| Call actions           | ✅     | ✅   | ✅     | ✅     | ✅    | ✅  |

**Legend:**

- ✅ = Allowed
- ❌ = Not allowed (will throw error or warning)
- ⚠️ = Allowed but use with caution (e.g., nested effects)
- \* = Only inside active `blox.slot()` callback
- \*\* = Available via function parameter

---

## Summary

### Key Rules

1. **`rx()` is read-only** - You can only read signals, not create new reactive primitives
2. **No nested `rx()`** - Each reactive boundary should be independent
3. **`blox.slot()` keeps context** - Inside a slot, you're still in blox context
4. **Computed signals are pure** - Cannot create signals or effects inside
5. **blox APIs need blox context** - `blox.onMount()`, `blox.ref()`, etc. only work in `blox()`
6. **Providers at module level** - Create providers globally, use them in components

### Mental Model

```
Global Scope (unrestricted)
└─ blox() (component definition - can create anything)
   └─ rx() (reactive UI - read-only, no creation)

effect() / signal() (reactive computation - restricted creation)

batch() (grouping - no restrictions)
```

For more details, see:

- [Core Concepts](./core-concepts.md)
- [API Reference](./api-reference.md)
- [Patterns & Best Practices](./patterns.md)
