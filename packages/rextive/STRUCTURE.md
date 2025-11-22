# Package Structure

## Overview

Rextive is organized into two main entry points:

1. **`rextive`** - Core reactive primitives (framework-agnostic)
2. **`rextive/react`** - React-specific hooks and components

## Directory Structure

```
packages/rextive/
├── src/
│   ├── index.ts                    # Core exports
│   ├── signal.ts                   # Signal implementation
│   ├── batch.ts                    # Batching utilities
│   ├── wait.ts                     # Async coordination
│   ├── persistSignals.ts           # Signal persistence
│   ├── tag.ts                      # Signal grouping
│   ├── types.ts                    # Core types
│   ├── utils/                      # Core utilities
│   │   ├── emitter.ts
│   │   ├── loadable.ts
│   │   ├── createProxy.ts
│   │   └── ...
│   └── react/                      # React-specific code
│       ├── index.ts                # React exports
│       ├── types.ts                # React types
│       ├── rx.tsx                  # Reactive rendering
│       ├── useScope.ts             # Scoped signals hook
│       ├── useSignals.ts           # Signal tracking hook
│       ├── useRerender.ts          # Rerender control
│       └── useUnmount.ts           # Unmount lifecycle
├── dist/
│   ├── rextive.js                  # Core bundle
│   ├── rextive.umd.js              # Core UMD bundle
│   ├── index.d.ts                  # Core types
│   └── react/
│       ├── index.js                # React bundle
│       └── index.d.ts              # React types
└── package.json
```

## Entry Points

### `rextive` (Core)

**File:** `src/index.ts`  
**Dist:** `dist/index.{js,d.ts}`

Framework-agnostic reactive primitives:

```ts
import {
  signal,        // Create reactive signals
  batch,         // Batch multiple updates
  wait,          // Coordinate async operations
  emitter,       // Event emitter utility
  loadable,      // Async state representation
  isSignal,      // Type guard
  // ... more utilities
} from 'rextive';
```

**Use Cases:**
- Node.js applications
- Vue/Svelte/Angular integration
- Vanilla JavaScript projects
- Shared business logic
- Testing without React

### `rextive/react` (React Integration)

**File:** `src/react/index.ts`  
**Dist:** `dist/react/index.{js,d.ts}`

React hooks and components:

```tsx
import {
  rx,            // Reactive JSX rendering
  useScope,      // Component-scoped signals
  useSignals,    // Signal tracking hook
  useRerender,   // Manual rerender control
  useUnmount,    // Unmount lifecycle
} from 'rextive/react';
```

**Features:**
- Automatic component re-rendering
- Signal lifecycle management
- Suspense integration
- Error boundary support

## Type Organization

### Core Types (`src/types.ts`)

Framework-agnostic types:

```ts
export type Signal<T>
export type SignalMap
export type SignalContext
export type SignalOptions<T>
export type Loadable<T>
export type Awaitable<T>
// ... more core types
```

### React Types (`src/react/types.ts`)

React-specific types:

```ts
export type RxOptions
export type UseScopeOptions<T>
export type RerenderOptions
export type RerenderFunction<T>
```

## Build Configuration

### `package.json` Exports

```json
{
  "exports": {
    ".": {
      "import": "./dist/rextive.js",
      "require": "./dist/rextive.umd.js",
      "types": "./dist/index.d.ts"
    },
    "./react": {
      "import": "./dist/react/index.js",
      "require": "./dist/react/index.js",
      "types": "./dist/react/index.d.ts"
    }
  }
}
```

### TypeScript Configuration

TypeScript automatically resolves types for both entry points:

- `import { signal } from 'rextive'` → `dist/index.d.ts`
- `import { rx } from 'rextive/react'` → `dist/react/index.d.ts`

## Testing Structure

### Core Tests

Located in `src/`:
- `signal.test.ts`
- `batch.test.ts`
- `wait.test.ts`
- `persistSignals.test.ts`
- `utils/*.test.ts`

### React Tests

Located in `src/react/`:
- `rx.test.tsx`
- `useScope.test.tsx`
- `useSignals.test.tsx`
- `useRerender.test.tsx`
- `useUnmount.test.tsx`

### Type Check Files

Compile-time type validation:
- Core: `signal.type.check.ts`, `wait.type.check.ts`, `utils/loadable.type.check.ts`
- React: `react/rx.type.check.tsx`

## Migration Guide

See [MIGRATION_CORE_REACT.md](./MIGRATION_CORE_REACT.md) for detailed migration instructions.

### Quick Migration

**Before:**
```tsx
import { signal, rx, useScope } from 'rextive';
```

**After:**
```tsx
import { signal } from 'rextive';
import { rx, useScope } from 'rextive/react';
```

## Benefits of This Structure

1. **Framework Agnostic**: Core signals work in any JavaScript environment
2. **Better Tree-Shaking**: Core-only usage doesn't bundle React
3. **Smaller Bundle Size**: Only import what you need
4. **Clear Separation**: Obvious distinction between core and React APIs
5. **Easier Testing**: Test core logic without React dependencies
6. **Future-Proof**: Easy to add integrations for other frameworks (Vue, Svelte, etc.)

