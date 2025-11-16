# Batch Updates

The `batch()` function allows you to group multiple signal updates into a single operation, preventing unnecessary recomputations and re-renders.

## Table of Contents

- [Why Batching?](#why-batching)
- [Basic Usage](#basic-usage)
- [How It Works](#how-it-works)
- [Nested Batches](#nested-batches)
- [Handling Inconsistent State](#handling-inconsistent-state)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

---

## Why Batching?

Without batching, multiple signal updates trigger separate notifications and recomputations:

```tsx
// ❌ Without batching - 3 separate recomputations
const a = signal(1);
const b = signal(2);
const sum = signal(() => a() + b());

a.set(10);  // sum recomputes → 12
b.set(20);  // sum recomputes → 30
a.set(15);  // sum recomputes → 35
```

With batching, all updates are grouped:

```tsx
// ✅ With batching - 1 recomputation after all updates
batch(() => {
  a.set(10);
  b.set(20);
  a.set(15);
});
// sum recomputes once → 35
```

**Benefits:**
- ✅ Fewer recomputations
- ✅ Fewer React re-renders
- ✅ Better performance
- ✅ Consistent state (no intermediate values)

---

## Basic Usage

### Import

```tsx
import { batch, signal } from "rxblox";
```

### Simple Batching

```tsx
const count = signal(0);
const name = signal("Alice");

// Update multiple signals at once
batch(() => {
  count.set(10);
  name.set("Bob");
});
```

### With Computed Signals

```tsx
const firstName = signal("John");
const lastName = signal("Doe");
const fullName = signal(() => `${firstName()} ${lastName()}`);

// fullName recomputes only once
batch(() => {
  firstName.set("Jane");
  lastName.set("Smith");
});

console.log(fullName()); // "Jane Smith"
```

### In React Components

```tsx
const Counter = blox(() => {
  const count = signal(0);
  const doubled = signal(() => count() * 2);

  const incrementBoth = () => {
    batch(() => {
      count.set(count() + 1);
      count.set(count() + 1);
    });
    // Component re-renders once, not twice
  };

  return (
    <div>
      {rx(() => (
        <>
          <div>Count: {count()}</div>
          <div>Doubled: {doubled()}</div>
          <button onClick={incrementBoth}>Increment Twice</button>
        </>
      ))}
    </div>
  );
});
```

---

## How It Works

### 1. **Deferred Notifications**

During a batch, signal changes are queued instead of notifying immediately:

```tsx
const count = signal(0);
count.on((value) => console.log("Count:", value));

batch(() => {
  count.set(1);  // Queued, not notified yet
  count.set(2);  // Queued, not notified yet
  count.set(3);  // Queued, not notified yet
});

// After batch ends:
// Logs: "Count: 1"
// Logs: "Count: 2"
// Logs: "Count: 3"
```

### 2. **Async Recomputation**

Computed signals mark themselves as dirty during batch and recompute asynchronously:

```tsx
const a = signal(1);
const b = signal(2);
const sum = signal(() => {
  console.log("Computing sum");
  return a() + b();
});

sum(); // Logs: "Computing sum"

batch(() => {
  a.set(10);
  b.set(20);
  // sum() here returns stale value (3)
  // No recomputation yet
});

// After microtask:
// Logs: "Computing sum"
sum(); // 30
```

### 3. **Stale Value During Batch**

When a computed signal is accessed during a batch, it returns the last computed (stale) value:

```tsx
const a = signal(1);
const doubled = signal(() => a() * 2);

batch(() => {
  a.set(5);
  console.log(doubled()); // Logs: 2 (stale value)
});

console.log(doubled()); // Logs: 10 (recomputed)
```

---

## Nested Batches

Batches can be nested. The outermost batch controls when notifications are flushed:

```tsx
const count = signal(0);
count.on((value) => console.log("Count:", value));

batch(() => {
  count.set(1);

  batch(() => {
    count.set(2);

    batch(() => {
      count.set(3);
    });
  });

  // Still inside outer batch, no notifications yet
});

// Now all notifications fire
// Logs: "Count: 1"
// Logs: "Count: 2"
// Logs: "Count: 3"
```

**Depth Tracking:**

rxblox automatically tracks batch depth to handle nested batches correctly. You don't need to manage this manually.

```tsx
// Example: Nested batch from function calls
function updateUserName(name: string) {
  batch(() => {
    firstName.set(name.split(" ")[0]);
    lastName.set(name.split(" ")[1] || "");
  });
}

function updateUser(name: string, age: number) {
  batch(() => {
    updateUserName(name); // Nested batch
    userAge.set(age);
  });
}

updateUser("Jane Smith", 30);
// All updates batched together
```

---

## Handling Inconsistent State

### The Problem

When updating multiple related signals, computed signals might see inconsistent intermediate states:

```tsx
const keys = signal(["a", "b", "c"]);
const values = signal({ a: 1, b: 2, c: 3 });

const mapped = signal(() => {
  const k = keys();
  const v = values();
  return k.map((key) => v[key]); // Might fail if keys/values are inconsistent
});

// ❌ Without batch - ERROR!
keys.set(["a", "b"]); // Remove 'c'
// mapped recomputes NOW, sees keys without 'c' but values still has 'c'
// Returns [1, 2, undefined]

values.set({ a: 10, b: 20 }); // Remove 'c'
// mapped recomputes again
// Returns [10, 20]
```

### The Solution

Use `batch()` to ensure all updates happen atomically:

```tsx
// ✅ With batch - Consistent!
batch(() => {
  keys.set(["a", "b"]);     // Queued
  values.set({ a: 10, b: 20 }); // Queued
  // mapped() returns stale value [1, 2, 3] if accessed here
});

// After batch, mapped recomputes once with consistent state
console.log(mapped()); // [10, 20] ✅
```

### Alternative: Combined State

For tightly coupled state, consider combining into a single signal:

```tsx
// ✅ Even better - single source of truth
const state = signal({
  keys: ["a", "b", "c"],
  values: { a: 1, b: 2, c: 3 },
});

const mapped = signal(() => {
  const { keys, values } = state();
  return keys.map((key) => values[key]);
});

// Single atomic update, no batch needed
state.set((draft) => {
  draft.keys = ["a", "b"];
  draft.values = { a: 10, b: 20 };
});
```

---

## Best Practices

### 1. **Batch Related Updates**

Always batch updates to related signals:

```tsx
// ✅ Good
batch(() => {
  userFirstName.set("Jane");
  userLastName.set("Smith");
  userEmail.set("jane@example.com");
});

// ❌ Bad - 3 separate notifications
userFirstName.set("Jane");
userLastName.set("Smith");
userEmail.set("jane@example.com");
```

### 2. **Use for Performance-Critical Paths**

Batch updates in loops and event handlers:

```tsx
// ✅ Good - batch in loop
function resetForm(fields: string[]) {
  batch(() => {
    fields.forEach((field) => {
      formState.set((state) => {
        state[field] = "";
      });
    });
  });
}

// ✅ Good - batch in event handler
const handleSubmit = () => {
  batch(() => {
    setLoading(true);
    setError(null);
    setData(null);
  });
};
```

### 3. **Don't Over-Batch**

Batching has a small overhead. Don't batch single updates:

```tsx
// ❌ Unnecessary
batch(() => {
  count.set(count() + 1);
});

// ✅ Good
count.set(count() + 1);
```

### 4. **Combine State When Possible**

For tightly coupled state, prefer a single signal with structured data:

```tsx
// ✅ Better - single signal
const user = signal({
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
});

user.set((draft) => {
  draft.firstName = "Jane";
  draft.lastName = "Smith";
  draft.email = "jane@example.com";
});

// ❌ Worse - multiple signals requiring batch
const firstName = signal("John");
const lastName = signal("Doe");
const email = signal("john@example.com");

batch(() => {
  firstName.set("Jane");
  lastName.set("Smith");
  email.set("jane@example.com");
});
```

### 5. **Be Careful with Async Operations**

Operations inside async callbacks are **not** part of the batch:

```tsx
batch(() => {
  count.set(1);

  Promise.resolve().then(() => {
    count.set(2); // ❌ NOT batched!
  });
});

setTimeout(() => {
  count.set(3); // ❌ NOT batched!
}, 0);
```

To batch async updates, create a new batch:

```tsx
batch(() => {
  count.set(1);
});

Promise.resolve().then(() => {
  batch(() => {
    count.set(2); // ✅ Batched
  });
});
```

---

## API Reference

### `batch(fn: () => T): T`

Groups multiple signal updates into a single operation.

**Parameters:**
- `fn`: A function containing signal updates. Can be synchronous or return a value.

**Returns:**
- The return value of `fn`.

**Example:**

```tsx
const result = batch(() => {
  signal1.set(value1);
  signal2.set(value2);
  return "done";
});

console.log(result); // "done"
```

**Behavior:**

1. **Deferred Notifications**: Signal listeners are queued and notified after the batch completes.
2. **Async Recomputation**: Computed signals mark themselves as dirty and recompute asynchronously (in a microtask).
3. **Stale Values**: Accessing a computed signal during batch returns the last computed value.
4. **Nested Support**: Nested batches are supported. Notifications flush when the outermost batch completes.
5. **Error Handling**: If `fn` throws, notifications are still flushed (in a microtask).

**When to Use:**

- Updating multiple related signals
- Performance-critical updates (loops, event handlers)
- Preventing inconsistent intermediate states
- Reducing React re-renders

**When NOT to Use:**

- Single signal updates (unnecessary overhead)
- When you want immediate notifications
- Async operations (they run outside the batch)

---

## Comparison with Other Libraries

| Feature | rxblox | Preact Signals | SolidJS | MobX |
|---------|--------|----------------|---------|------|
| **Deferred Notifications** | ✅ | ✅ | ✅ | ✅ (transactions) |
| **Async Recomputation** | ✅ | ❌ (sync) | ❌ (sync) | ❌ (sync) |
| **Stale Values During Batch** | ✅ | ✅ | ✅ | ✅ |
| **Nested Batches** | ✅ | ✅ | ✅ | ✅ |
| **Depth Tracking** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto |

rxblox's unique **async recomputation** approach ensures computed signals never see inconsistent state, even if accessed during a batch.

---

## See Also

- [Signals](./api-reference.md#signals) - Core signal API
- [Computed Signals](./api-reference.md#computed-signals) - Derived state
- [Effects](./api-reference.md#effects) - Side effects
- [Performance Best Practices](../README.md#performance-best-practices) - Optimization tips

