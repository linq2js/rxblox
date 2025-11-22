# Migration Guide: Core/React Separation

## Overview

Rextive now separates core reactive primitives from React-specific code. This allows you to use the core signal system in any JavaScript environment, with or without React.

## New Structure

### Core Package (`rextive`)

Contains framework-agnostic reactive primitives:

```ts
import {
  signal,        // Create reactive signals
  batch,         // Batch multiple updates
  wait,          // Coordinate async operations
  emitter,       // Event emitter utility
  loadable,      // Async state representation
  isSignal,      // Type guard
  // ... and more utilities
} from 'rextive';
```

### React Package (`rextive/react`)

Contains React hooks and components:

```tsx
import {
  rx,            // Reactive JSX rendering
  useScope,      // Component-scoped signals
  useSignals,    // Signal tracking hook
  useRerender,   // Manual rerender control
  useUnmount,    // Unmount lifecycle
} from 'rextive/react';
```

## Migration Steps

### Before (Old Import Style)

```tsx
import {
  signal,
  rx,
  useScope,
  useSignals,
  wait,
  batch,
} from 'rextive';
```

### After (New Import Style)

```tsx
// Core imports (no React)
import { signal, wait, batch } from 'rextive';

// React imports
import { rx, useScope, useSignals } from 'rextive/react';
```

## Type Imports

### Core Types

```ts
import type {
  Signal,
  SignalMap,
  SignalOptions,
  SignalContext,
  Loadable,
  Awaitable,
  // ... other core types
} from 'rextive';
```

### React Types

```tsx
import type {
  RxOptions,
  UseScopeOptions,
  RerenderOptions,
  RerenderFunction,
} from 'rextive/react';
```

## Benefits

1. **Framework Agnostic**: Use core signals in Node.js, Vue, Svelte, or vanilla JS
2. **Smaller Bundle**: Core-only usage doesn't include React dependencies
3. **Better Tree-Shaking**: Unused React hooks won't be bundled
4. **Clearer API**: Obvious distinction between core and React-specific features

## Examples

### Core-Only Usage (No React)

```ts
import { signal, batch } from 'rextive';

const count = signal(0);
const doubled = signal({ count }, ({ deps }) => deps.count * 2);

// Listen to changes
count.on(() => {
  console.log('Count:', count(), 'Doubled:', doubled());
});

// Batch updates
batch(() => {
  count.set(5);
  // Multiple signal updates are batched into one notification
});
```

### React Usage

```tsx
import { signal } from 'rextive';
import { rx, useScope } from 'rextive/react';

// Global signal (created once)
const globalCount = signal(0);

function Counter() {
  // Component-scoped signal (auto-cleanup on unmount)
  const { localCount } = useScope(() => ({
    localCount: signal(0),
  }));

  return (
    <>
      {/* Reactive rendering with global signal */}
      {rx({ globalCount }, (awaited) => (
        <div>Global: {awaited.globalCount}</div>
      ))}

      {/* Reactive rendering with local signal */}
      {rx({ localCount }, (awaited) => (
        <div>Local: {awaited.localCount}</div>
      ))}
    </>
  );
}
```

### Node.js/Backend Usage

```ts
import { signal, wait, emitter } from 'rextive';

// Use signals for reactive state management in Node.js
const cache = signal<Record<string, any>>({});
const events = emitter<string>();

// React to cache changes
cache.on(() => {
  console.log('Cache updated:', Object.keys(cache()).length, 'items');
  events.emit('cache:updated');
});

// Async coordination with wait
async function fetchMultiple(ids: string[]) {
  const promises = ids.map(id => fetch(`/api/${id}`));
  return wait(promises);
}
```

## No Breaking Changes for React Users

If you're only using React features, you can continue using the current import style until you're ready to migrate. Both import styles are supported:

```tsx
// Old style (still works, but includes everything)
import { signal, rx, useScope } from 'rextive';

// New style (recommended, better tree-shaking)
import { signal } from 'rextive';
import { rx, useScope } from 'rextive/react';
```

## TypeScript Support

TypeScript will automatically pick up the correct types from both entry points:

- `rextive` → `dist/index.d.ts`
- `rextive/react` → `dist/react/index.d.ts`

No additional configuration needed!

