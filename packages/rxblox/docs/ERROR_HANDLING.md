# Error Handling in rxblox

This document provides a comprehensive guide to error handling in rxblox signals.

## Table of Contents

- [Overview](#overview)
- [Error Propagation](#error-propagation)
- [Error Inspection APIs](#error-inspection-apis)
- [Fallback Option](#fallback-option)
- [FallbackError](#fallbackerror)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

rxblox signals automatically catch and store errors that occur during computation. When a signal has an error, it throws the error when read, ensuring that errors are visible and propagate through the dependency graph.

**Key features:**

- ✅ **Automatic error capture** - Errors during computation are caught and stored
- ✅ **Error caching** - Errors are cached and thrown on every read until cleared
- ✅ **Error propagation** - Errors flow through the dependency graph
- ✅ **Error inspection** - Check for errors without throwing
- ✅ **Graceful fallbacks** - Handle errors with fallback values
- ✅ **Context-rich errors** - `FallbackError` includes context and both errors

## Error Propagation

Errors automatically propagate through the dependency graph:

```tsx
import { signal } from "rxblox";

const a = signal(() => {
  throw new Error("A failed");
});

const b = signal(() => a() * 2); // Depends on 'a'
const c = signal(() => b() + 1);  // Depends on 'b'

// All throw the same error
a(); // Throws: "A failed"
b(); // Throws: "A failed"  (propagated from 'a')
c(); // Throws: "A failed"  (propagated from 'b')
```

**Why error propagation?**

- Ensures errors are visible throughout the system
- Prevents silent failures in derived computations
- Makes debugging easier by preserving error origin

## Error Inspection APIs

rxblox provides three methods for inspecting errors without throwing:

### `signal.hasError()`

Check if a signal has a cached error:

```tsx
const data = signal(() => riskyOperation());

if (data.hasError()) {
  console.log("Signal has an error");
}
```

### `signal.getError()`

Get the cached error without throwing:

```tsx
const data = signal(() => riskyOperation());

if (data.hasError()) {
  const error = data.getError();
  console.error("Error details:", error);
}
```

### `signal.clearError()`

Clear the cached error and trigger recomputation:

```tsx
const data = signal(() => riskyOperation());

if (data.hasError()) {
  console.log("Retrying...");
  data.clearError(); // Clears error and recomputes
}
```

**Type signatures:**

```ts
interface Signal<T> {
  hasError(): boolean;
  getError(): unknown;
  clearError(): void;
}
```

## Fallback Option

Use the `fallback` option to gracefully handle errors with a default value:

```tsx
import { signal } from "rxblox";

const data = signal(
  () => {
    const result = riskyOperation();
    if (!result) throw new Error("Operation failed");
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
const value = data(); // defaultValue
```

**Key features:**

- Called when the primary computation throws
- Can return sync or async values
- Receives the original error as parameter
- If fallback also throws, see [FallbackError](#fallbackerror)

**Async fallback:**

```tsx
const user = signal(
  async () => {
    const response = await fetch("/api/user");
    if (!response.ok) throw new Error("Fetch failed");
    return response.json();
  },
  {
    fallback: async (error) => {
      console.warn("Using cached user:", error);
      return await getCachedUser();
    }
  }
);
```

## FallbackError

When both the computation AND the fallback fail, rxblox throws a `FallbackError` containing both errors and context:

```tsx
import { signal, FallbackError } from "rxblox";

const problematic = signal(
  () => {
    throw new Error("Primary failed");
  },
  {
    fallback: (error) => {
      throw new Error("Fallback also failed");
    }
  }
);

try {
  problematic();
} catch (error) {
  if (error instanceof FallbackError) {
    console.error("Original error:", error.originalError);
    // Error: "Primary failed"
    
    console.error("Fallback error:", error.fallbackError);
    // Error: "Fallback also failed"
    
    console.error("Context:", error.context);
    // { signalName: "problematic" }
    
    console.error("Combined message:", error.message);
    // "Signal computation and fallback both failed: Primary failed; 
    //  Fallback also failed: Fallback also failed"
  }
}
```

**FallbackError properties:**

```ts
class FallbackError extends Error {
  originalError: unknown;       // Error from primary computation
  fallbackError: unknown;        // Error from fallback handler
  context: { signalName?: string }; // Context (e.g., signal name)
  message: string;               // Combined error message
  name: "FallbackError";
}
```

## Best Practices

### ✅ DO

**Use `fallback` for expected errors:**

```tsx
const config = signal(
  () => {
    const raw = localStorage.getItem("config");
    if (!raw) throw new Error("No config");
    return JSON.parse(raw);
  },
  {
    fallback: () => defaultConfig // Safe fallback
  }
);
```

**Use error inspection for conditional UI:**

```tsx
const UserProfile = blox(() => {
  const user = signal.async(() => fetchUser());
  
  return rx(() => {
    const userLoadable = user();
    
    if (userLoadable.status === "error") {
      return (
        <div>
          <p>Failed to load user</p>
          <button onClick={() => user.reset()}>Retry</button>
        </div>
      );
    }
    
    return <div>{userLoadable.value.name}</div>;
  });
});
```

**Clear errors to retry:**

```tsx
const retry = () => {
  if (data.hasError()) {
    data.clearError(); // Triggers recomputation
  }
};
```

**Handle FallbackError for critical operations:**

```tsx
try {
  const result = criticalSignal();
} catch (error) {
  if (error instanceof FallbackError) {
    // Both primary and fallback failed - handle gracefully
    logToSentry({
      original: error.originalError,
      fallback: error.fallbackError,
      context: error.context
    });
  }
}
```

### ❌ DON'T

**Don't ignore errors silently:**

```tsx
// ❌ BAD: Errors propagate to dependents
const ignored = signal(() => {
  try {
    return riskyOperation();
  } catch {
    return null; // Silent failure
  }
});

// ✅ GOOD: Use fallback or let errors propagate
const handled = signal(
  () => riskyOperation(),
  { fallback: () => null }
);
```

**Don't use try/catch in reactive contexts:**

```tsx
// ❌ BAD: Breaks reactivity
const Component = blox(() => {
  try {
    const data = failingSignal();
    return <div>{data}</div>;
  } catch {
    return <div>Error</div>;
  }
});

// ✅ GOOD: Use error inspection or fallback
const Component = blox(() => {
  return rx(() => {
    if (failingSignal.hasError()) {
      return <div>Error</div>;
    }
    return <div>{failingSignal()}</div>;
  });
});
```

**Don't forget errors are cached:**

```tsx
// ❌ BAD: Error thrown on every read
const data = signal(() => riskyOperation());

for (let i = 0; i < 10; i++) {
  try {
    data(); // Throws cached error every time
  } catch {}
}

// ✅ GOOD: Check once or clear error
if (data.hasError()) {
  console.error("Error:", data.getError());
  data.clearError(); // Retry
}
```

## Examples

### Error recovery in forms

```tsx
const FormWithErrorRecovery = blox(() => {
  const formData = signal({
    name: "",
    email: ""
  });
  
  const validation = signal(
    () => {
      const data = formData();
      if (!data.name) throw new Error("Name required");
      if (!data.email.includes("@")) throw new Error("Invalid email");
      return { valid: true };
    },
    {
      fallback: (error) => ({
        valid: false,
        error: error.message
      })
    }
  );
  
  return rx(() => {
    const result = validation();
    
    return (
      <form>
        <input 
          value={formData().name}
          onChange={(e) => formData.set(d => ({ ...d, name: e.target.value }))}
        />
        <input 
          value={formData().email}
          onChange={(e) => formData.set(d => ({ ...d, email: e.target.value }))}
        />
        
        {!result.valid && <div className="error">{result.error}</div>}
        
        <button type="submit" disabled={!result.valid}>
          Submit
        </button>
      </form>
    );
  });
});
```

### API error handling with retry

```tsx
const DataFetcher = blox(() => {
  const data = signal.async(() => fetchData());
  
  return rx(() => {
    const loadable = data();
    
    // Handle different states
    if (loadable.status === "loading") {
      return <div>Loading...</div>;
    }
    
    if (loadable.status === "error") {
      return (
        <div>
          <p>Error: {loadable.error.message}</p>
          <button onClick={() => data.reset()}>
            Retry
          </button>
        </div>
      );
    }
    
    return <div>Data: {JSON.stringify(loadable.value)}</div>;
  });
});
```

### Cascading errors with inspection

```tsx
const CascadingErrors = blox(() => {
  const a = signal(() => {
    if (Math.random() > 0.5) throw new Error("A failed");
    return 10;
  });
  
  const b = signal(() => a() * 2);
  const c = signal(() => b() + 1);
  
  return rx(() => {
    // Check each level
    if (a.hasError()) {
      return <div>A failed: {a.getError().message}</div>;
    }
    
    if (b.hasError()) {
      return <div>B failed: {b.getError().message}</div>;
    }
    
    if (c.hasError()) {
      return <div>C failed: {c.getError().message}</div>;
    }
    
    return <div>Result: {c()}</div>;
  });
});
```

### Multi-level fallbacks

```tsx
const primaryData = signal.async(() => fetchPrimarySource());

const secondaryData = signal(
  () => {
    const primary = primaryData();
    if (primary.status === "error") {
      throw primary.error;
    }
    return primary.value;
  },
  {
    fallback: async (error) => {
      console.warn("Primary failed, trying secondary:", error);
      return await fetchSecondarySource();
    }
  }
);

const tertiaryData = signal(
  () => {
    return secondaryData();
  },
  {
    fallback: (error) => {
      console.warn("Secondary failed, using cache:", error);
      return getCachedData();
    }
  }
);

// Now tertiaryData has 3 layers of fallback:
// 1. Primary source
// 2. Secondary source (if primary fails)
// 3. Cached data (if both fail)
```

---

## Related Documentation

- [API Reference - Error Handling](./api-reference.md#error-handling)
- [Core Concepts - Signals](./core-concepts.md#error-handling-in-signals)
- [Wait Utilities - wait.fallback](./api-reference.md#waitfallback)
- [FallbackError API](./api-reference.md#fallbackerror)
- [TimeoutError API](./api-reference.md#timeouterror)

---

[Back to Main Documentation](./README.md)

