# rxblox Architecture

> Fine-grained reactive state management for React

## Table of Contents

- [Overview](#overview)
- [Core Principles](#core-principles)
- [Architecture Design](#architecture-design)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Performance Strategy](#performance-strategy)
- [Design Decisions](#design-decisions)
- [Extension Points](#extension-points)

---

## Overview

rxblox is a fine-grained reactive state management library that minimizes React re-renders by tracking dependencies at the expression level rather than the component level. It achieves this through a sophisticated signal-based reactivity system inspired by SolidJS and Preact Signals, adapted for React's lifecycle.

### Key Characteristics

- **Fine-grained Reactivity**: Only re-render the specific UI expressions that depend on changed state
- **Automatic Dependency Tracking**: No manual dependency arrays - the system tracks what you use
- **React-Native Integration**: Works within React's lifecycle and reconciliation
- **Zero Props Drilling**: Provider system without Context re-render overhead
- **Type-Safe**: Full TypeScript support with excellent inference

---

## Core Principles

### 1. **Reactive Primitives Over Component State**

Traditional React:

```tsx
const [count, setCount] = useState(0); // Component re-renders on change
```

rxblox:

```tsx
const count = signal(0); // Only dependent expressions re-render
```

### 2. **Definition Phase vs Render Phase**

Components have a **definition phase** (runs once) and a **render phase** (runs on updates):

```tsx
const Counter = blox(() => {
  // DEFINITION PHASE - runs once
  const count = signal(0);

  // RENDER PHASE - runs on reactive updates
  return rx(() => <div>{count()}</div>);
});
```

### 3. **Explicit Reactivity Boundaries**

Reactivity is opt-in via `rx()` expressions:

```tsx
<div>
  Static content
  {rx(() => signal())} {/* Only this updates */}
  More static content
</div>
```

---

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (React Components, User Code)                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   rxblox Public API                          │
│  signal() | blox() | rx() | effect() | provider() | action()│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Core Reactivity Layer                     │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Signals    │  │  Dispatcher  │  │   Emitters   │      │
│  │  (State)     │  │  (Tracking)  │  │  (Events)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    React Integration Layer                   │
│  useRerender() | useLayoutEffect() | forwardRef() | Suspense │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                        React Core                            │
│           (Reconciliation, DOM Updates)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Signal System

**File**: `src/signal.ts`

Signals are the fundamental reactive primitive.

#### Structure

```typescript
type Signal<T> = {
  (): T; // Read value and track dependency
  peek(): T; // Read value without tracking
  on(listener: Listener): Unsubscribe;
};

type MutableSignal<T> = Signal<T> & {
  set(value: T | ((prev: T) => T | void)): void;
  readonly: Signal<T>; // Read-only version
};
```

#### Key Features

1. **Dependency Tracking**: When called inside a tracked context (dispatcher), automatically registers as a dependency
2. **Change Detection**: Uses custom equality function (default: `Object.is`)
3. **Immutable Updates**: Supports immer-style mutations via function updaters
4. **Computed Signals**: Derived state that auto-updates when dependencies change

#### Implementation Strategy

```typescript
function signal<T>(initialValue: T): MutableSignal<T> {
  let current = { value: initialValue };
  const listeners = new Set<Listener>();

  const get = () => {
    // Register with current dispatcher for tracking
    getDispatcher(trackingToken)?.add(get);
    return current.value;
  };

  const set = (value) => {
    const nextValue = /* handle function updaters with immer */;
    if (!equals(current.value, nextValue)) {
      current.value = nextValue;
      listeners.forEach(listener => listener()); // Notify
    }
  };

  return Object.assign(get, { set, peek, on, readonly });
}
```

---

### 2. Dispatcher System

**File**: `src/dispatcher.ts`, `src/trackingDispatcher.ts`

The dispatcher is the core dependency tracking mechanism.

#### Context-Based Tracking

Uses a global stack to track which signals are accessed:

```typescript
const dispatcherStack: Map<symbol, any>[] = [];

function withDispatchers(dispatchers: Map, callback) {
  dispatcherStack.push(dispatchers);
  try {
    return callback();
  } finally {
    dispatcherStack.pop();
  }
}

function getDispatcher(token: symbol) {
  return dispatcherStack[dispatcherStack.length - 1]?.get(token);
}
```

#### Signal Dispatcher

Tracks which signals are accessed during execution:

```typescript
class SignalDispatcher {
  private signals = new Set<Signal>();

  add(signal: Signal) {
    this.signals.add(signal);
  }

  subscribe(onUpdate: () => void, onCleanup: Emitter) {
    const unsubscribes = Array.from(this.signals).map((sig) =>
      sig.on(onUpdate)
    );
    onCleanup.on(() => unsubscribes.forEach((fn) => fn()));
  }
}
```

---

### 3. blox Components

**File**: `src/blox.ts`

blox is the reactive component wrapper that manages the definition/render lifecycle.

#### Architecture

```typescript
function blox<TProps, TRef>(
  render: (props: TProps, ref: Ref<TRef>) => ReactNode
) {
  return React.memo(
    React.forwardRef<TRef, TProps>((propsFromReact, refFromReact) => {
      // ============ DEFINITION PHASE ============
      const [renderResult] = useState(() => {
        const dispatchers = new Map();
        const emitters = createEmitters(); // mount, unmount, render
        const rerender = useRerender();

        // Track signals accessed during render
        dispatchers.set(trackingToken, trackingDispatcher(rerender));
        dispatchers.set(effectToken, effectDispatcher(emitters));
        dispatchers.set(eventToken, eventDispatcher(emitters));

        // Create reactive props proxy
        const propsProxy = new Proxy(
          {},
          {
            get(_, prop) {
              // Convert prop access to signal access
              return getDispatcher(trackingToken)?.track(
                () => propsFromReact[prop]
              );
            },
          }
        );

        // Execute user's render function with tracking
        const result = withDispatchers(dispatchers, () =>
          render(propsProxy, refCallback)
        );

        return { result, emitters, dispatchers };
      });

      // ============ RENDER PHASE ============
      useLayoutEffect(() => {
        renderResult.emitters.render.emit();
      });

      useLayoutEffect(() => {
        renderResult.emitters.mount.emitAndClear();
        return () => renderResult.emitters.unmount.emitAndClear();
      }, []);

      return renderResult.result;
    })
  );
}
```

#### Key Design Decisions

1. **useState for Definition Phase**: Ensures render function runs exactly once
2. **Proxy for Props**: Converts prop access to reactive signal subscriptions
3. **Emitter System**: Manages lifecycle events (mount, unmount, render)
4. **Dispatcher Stack**: Provides context for effects and event handlers

---

### 4. rx() Reactive Expressions

**File**: `src/rx.tsx`

`rx()` creates fine-grained reactive boundaries within JSX.

#### Implementation

```typescript
function rx<T>(expression: () => T): T {
  const [, forceUpdate] = useState({});
  const dispatcher = useMemo(() => trackingDispatcher(() => forceUpdate({})));

  const [result, setResult] = useState(() =>
    withDispatchers(new Map([[trackingToken, dispatcher]]), expression)
  );

  useLayoutEffect(() => {
    const cleanup = emitter();
    dispatcher.subscribe(() => {
      const newResult = withDispatchers(
        new Map([[trackingToken, dispatcher]]),
        expression
      );
      setResult(newResult);
    }, cleanup);

    return () => cleanup.emit();
  }, [dispatcher]);

  return result;
}
```

#### Strategy

1. **Per-Expression Tracking**: Each `rx()` has its own dispatcher
2. **Subscription Management**: Automatically subscribes to accessed signals
3. **Efficient Updates**: Only this expression re-executes when dependencies change
4. **Shorthand**: `rx(signal)` directly subscribes to a single signal

---

### 5. Effect System

**File**: `src/effect.ts`, `src/effectDispatcher.ts`

Effects are side-effect runners that auto-track dependencies.

#### Effect Dispatcher

```typescript
class EffectDispatcher {
  private effects: Array<() => void | (() => void)> = [];

  add(effect: () => void | (() => void)) {
    this.effects.push(effect);
  }

  run(emitters: Emitters) {
    const cleanups: (() => void)[] = [];

    this.effects.forEach((effectFn) => {
      const cleanup = emitter();
      const dispatcher = trackingDispatcher(() => {
        // Re-run effect on signal changes
        cleanup.emit();
        runEffect();
      }, cleanup);

      const runEffect = () => {
        const result = withDispatchers(
          new Map([[trackingToken, dispatcher]]),
          effectFn
        );
        if (typeof result === "function") {
          cleanup.on(result);
        }
      };

      emitters.mount.on(runEffect);
      emitters.unmount.on(() => cleanup.emit());
    });
  }
}
```

#### Lifecycle

```
┌──────────────┐
│ Mount        │ → Run effect
└──────────────┘
       ↓
┌──────────────┐
│ Signal       │ → Cleanup → Re-run effect
│ changes      │
└──────────────┘
       ↓
┌──────────────┐
│ Unmount      │ → Cleanup (final)
└──────────────┘
```

---

### 6. Provider System

**File**: `src/provider.tsx`

Providers enable dependency injection without React Context re-render overhead.

#### Architecture

```typescript
type ProviderDef<T> = {
  name: string;
  initialValue: T;
  equals?: (a: T, b: T) => boolean;
};

function provider<T>(name: string, initialValue: T) {
  const providerDef: ProviderDef<T> = { name, initialValue };

  // Higher-order function to inject value
  function withValue(Component, getValue: () => T) {
    return (props) => (
      <Provider providerDef={providerDef} value={getValue()}>
        <Component {...props} />
      </Provider>
    );
  }

  return [withValue, Provider];
}
```

#### Provider Instance Management

```typescript
class ProviderInstance<T> {
  private signal: MutableSignal<T>;

  constructor(initialValue: T) {
    this.signal = signal(initialValue);
  }

  resolve() {
    return this.signal.readonly; // Read-only signal
  }

  setValue(value: T) {
    this.signal.set(value);
  }
}
```

#### Strategy

1. **Signal-Based**: Provider values are signals internally
2. **No Context Re-renders**: Changes propagate through signal subscriptions
3. **Tree Traversal**: Searches up component tree via React Context (but doesn't trigger re-renders)
4. **Lazy Creation**: Provider instances created on-demand

---

### 7. Action System

**File**: `src/action.ts`, `src/cancellableAction.ts`

Actions manage async operations with state tracking.

#### Loadable State

```typescript
type Loadable<T> = {
  status: "idle" | "loading" | "success" | "error";
  value?: T;
  error?: Error;
  promise?: Promise<T>;
  loading: boolean;
};
```

#### Action Implementation

```typescript
function action<TArgs, TResult>(fn: (...args: TArgs[]) => Promise<TResult>) {
  const result = signal<Loadable<TResult>>({
    status: "idle",
    loading: false,
  });

  const dispatch = async (...args: TArgs[]) => {
    const promise = fn(...args);

    result.set({
      status: "loading",
      loading: true,
      promise,
    });

    try {
      const value = await promise;
      result.set({
        status: "success",
        loading: false,
        value,
      });
      return value;
    } catch (error) {
      result.set({
        status: "error",
        loading: false,
        error,
      });
      throw error;
    }
  };

  return Object.assign(dispatch, { result: result.readonly });
}
```

#### Cancellable Actions

```typescript
function cancellableAction<TArgs, TResult>(
  fn: (signal: AbortSignal, ...args: TArgs[]) => Promise<TResult>
) {
  let currentController: AbortController | null = null;

  const dispatch = async (...args: TArgs[]) => {
    // Cancel previous call
    currentController?.abort();
    currentController = new AbortController();

    return fn(currentController.signal, ...args);
  };

  return Object.assign(dispatch, {
    result,
    cancel: () => currentController?.abort(),
    cancelled: () => currentController?.signal.aborted ?? false,
  });
}
```

---

## Data Flow

### Read Flow (Signal → UI)

```
1. User Code: signal()
   ↓
2. Signal tracks current dispatcher
   ↓
3. Dispatcher registers dependency
   ↓
4. Signal returns current value
   ↓
5. Value rendered to UI
```

### Write Flow (Update → UI)

```
1. User Code: signal.set(newValue)
   ↓
2. Signal compares values (equals)
   ↓
3. If changed: Notify all listeners
   ↓
4. Listeners trigger re-render/re-run
   ↓
5. UI updates (only dependent parts)
```

### Effect Flow

```
1. effect(() => { ... }) called during definition phase
   ↓
2. Effect registered in EffectDispatcher
   ↓
3. On mount: Effect runs with signal tracking
   ↓
4. Signals accessed are subscribed
   ↓
5. On signal change: Cleanup + re-run effect
   ↓
6. On unmount: Final cleanup
```

---

## Performance Strategy

### 1. Minimizing Re-renders

**Strategy**: Only re-render what changed

- **blox components**: Don't re-render the entire component, only `rx()` expressions
- **rx() boundaries**: Each boundary independently subscribes to signals
- **Computed signals**: Memoize results, only recompute when dependencies change

### 2. Efficient Dependency Tracking

**Strategy**: Automatic and precise tracking

- **Global dispatcher stack**: Thread-safe dependency tracking
- **Per-expression dispatchers**: Fine-grained subscriptions
- **Set-based storage**: O(1) dependency lookup

### 3. Subscription Management

**Strategy**: Automatic cleanup to prevent memory leaks

- **Emitter system**: Centralized cleanup coordination
- **Disposable pattern**: Resources auto-cleanup on unmount
- **WeakMap for caches**: Garbage collection friendly

### 4. Bundle Size

**Strategy**: Tree-shakeable and minimal dependencies

- **Direct imports**: `lodash/once` instead of full lodash
- **Terser optimization**: Aggressive minification for UMD builds
- **ES modules**: Modern bundlers can tree-shake unused code

**Current Size**: 48.32 kB (17.21 kB gzipped) for UMD

---

## Design Decisions

### 1. Why Not Use React Context for Providers?

**Problem**: Context causes re-renders of all consumers when value changes.

**Solution**: Use Context only for tree traversal, not value propagation. Values are signals that update subscribers directly.

### 2. Why `useState` for Definition Phase?

**Problem**: `useMemo` can be cleared by React during memory pressure.

**Solution**: `useState` guarantees the definition phase runs exactly once and is never cleared.

### 3. Why Proxy for Props?

**Problem**: Need to track which props are accessed without manual dependencies.

**Solution**: Proxy intercepts property access and registers them as signal subscriptions.

### 4. Why Immer for Mutations?

**Problem**: Need immutable updates for change detection, but mutations are ergonomic.

**Solution**: Immer provides mutation-style API with structural sharing and deep immutability.

**Alternative Considered**: Custom shallow copy (smaller bundle) - rejected because tests require deep immutability for nested objects.

### 5. Why Separate `rx()` and `blox()`?

**Problem**: Need different granularities of reactivity.

**Solution**:

- `blox()`: Component-level reactive container
- `rx()`: Expression-level reactive boundary

This gives developers fine control over update granularity.

### 6. Why `signal.peek()` Exists?

**Problem**: Sometimes need to read without subscribing (e.g., in event handlers).

**Solution**: `peek()` reads value without tracking, useful for one-off reads.

---

## Extension Points

### 1. Custom Equality Functions

```typescript
const sig = signal(obj, { equals: deepEqual });
```

Allows custom change detection logic.

### 2. Async Signal Transforms

```typescript
const derived = signal.async(async () => {
  const value = await fetchData();
  return transform(value);
});
```

Built-in async data loading with Suspense integration.

### 3. Wait Utilities

```typescript
const result = wait(asyncSignal); // Throws promise
const all = wait.all([sig1, sig2]); // Wait for all
const any = wait.any([sig1, sig2]); // Wait for any
```

Coordinate multiple async operations.

### 4. Custom Dispatchers

The dispatcher system is extensible - new tokens can be added for custom tracking contexts.

### 5. Middleware Pattern (Future)

```typescript
// Potential future API
const sig = signal(0, {
  middleware: [logger, devtools, persistence],
});
```

---

## Testing Strategy

### Unit Tests

- Each module tested in isolation
- Mock React hooks when needed
- Test edge cases (unmount timing, Strict Mode, cleanup)

### Integration Tests

- Test component lifecycle integration
- Verify no memory leaks
- Test Suspense integration
- Validate React Strict Mode behavior

### Performance Tests

- Benchmark against other libraries (Jotai, Zustand, Redux)
- Measure render counts
- Profile memory usage

---

## Future Improvements

### 1. Batching

Batch multiple signal updates into single re-render:

```typescript
batch(() => {
  signal1.set(1);
  signal2.set(2);
  signal3.set(3);
}); // Single update
```

### 2. Time-Travel Debugging

Track signal history for DevTools:

```typescript
const history = useSignalHistory(signal);
history.undo();
history.redo();
```

### 3. Persistence

Auto-persist signals to localStorage:

```typescript
const sig = signal(0, { persist: "counter-key" });
```

### 4. Computed with Dependencies

More explicit computed signals:

```typescript
const fullName = computed(
  [firstName, lastName],
  (first, last) => `${first} ${last}`
);
```

### 5. Selector Optimization

Memoized selectors for derived state:

```typescript
const selector = createSelector([signal1, signal2], (a, b) =>
  expensiveComputation(a, b)
);
```

---

## Comparison with Other Libraries

| Feature           | rxblox              | Jotai           | Zustand        | MobX             |
| ----------------- | ------------------- | --------------- | -------------- | ---------------- |
| Reactivity        | Signal-based        | Atom-level      | Selector-based | Observable-based |
| Granularity       | Expression-level    | Atom-level      | Store-level    | Observable-level |
| Bundle Size       | 17.21 kB gzipped    | ~3 kB gzipped   | ~3 kB gzipped  | ~95 kB gzipped   |
| Re-renders        | Minimal (rx() only) | Component-level | Selector-based | Observer-level   |
| Async             | Built-in            | Suspense-based  | Manual         | Built-in         |
| TypeScript        | Excellent           | Good            | Good           | Good             |
| DevTools          | Coming              | Available       | Built-in       | Extensive        |
| Middleware        | Planned             | Limited         | Extensive      | Extensive        |
| React Integration | Native              | Native          | Native         | Separate package |
| Decorators        | No                  | No              | No             | Optional         |
| Learning Curve    | Medium              | Low             | Low            | High             |
| Setup Required    | Minimal             | Provider        | Store creation | Configuration    |

---

## Contributing

When contributing to rxblox architecture:

1. **Maintain fine-grained reactivity**: Changes should preserve expression-level updates
2. **Test thoroughly**: Add tests for new features, edge cases, and Strict Mode
3. **Document design decisions**: Update this document for significant changes
4. **Consider bundle size**: Prefer small dependencies or custom implementations
5. **Preserve TypeScript types**: Maintain excellent type inference

---

## References

- [React Documentation](https://react.dev)
- [SolidJS Reactivity](https://www.solidjs.com/tutorial/introduction_signals)
- [Preact Signals](https://preactjs.com/guide/v10/signals/)
- [Immer Immutability](https://immerjs.github.io/immer/)

---

**Last Updated**: November 14, 2025  
**Version**: 1.12.0
