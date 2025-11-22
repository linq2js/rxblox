# rxasync Technical Design Document

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Lifecycle Phases](#lifecycle-phases)
5. [Reactivity System](#reactivity-system)
6. [Implementation Details](#implementation-details)
7. [Type System](#type-system)
8. [Performance Considerations](#performance-considerations)
9. [Edge Cases & Solutions](#edge-cases--solutions)
10. [Testing Strategy](#testing-strategy)

---

## Overview

### What is rxasync?

`rxasync` is a React component library that enables:
- **Async component initialization** with natural async/await syntax
- **Fine-grained reactivity** where only parts that change re-render
- **Safe conditional hooks** without violating React's Rules of Hooks
- **Composable logic** similar to custom hooks but more powerful
- **Unified state API** for both local and global state management

### Design Goals

1. **Developer Experience**: Natural async/await, minimal boilerplate
2. **Performance**: Fine-grained updates, no unnecessary re-renders
3. **Type Safety**: Full TypeScript inference, zero `any` types
4. **Compatibility**: Works with existing React hooks and components
5. **Simplicity**: Clear mental model, predictable behavior

### Key Innovation

The core innovation is separating component lifecycle into two phases:
- **Setup Phase** (runs once): Async initialization, state creation, hook collection
- **Render Phase** (runs many times): Sub-component renders with collected hooks

This separation enables:
- Async operations without Suspense complexity
- Conditional hook collection that remains consistent across renders
- Fine-grained reactivity tracking

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│ rx() Factory Function                                    │
│  - Creates wrapper React component                      │
│  - Manages lifecycle phases                             │
│  - Provides RxContext                                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Setup Phase (Once)                                       │
│  - Execute async render function                        │
│  - Collect state() calls → Create signals              │
│  - Collect hook() calls → Store for later              │
│  - Collect use() calls → Execute logic                 │
│  - Register onCleanup() callbacks                      │
│  - Return ReactNode                                     │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Render Phase (Many)                                      │
│  - Render sub-component with collected hooks           │
│  - Execute all hooks in same order                      │
│  - Track dependencies in part() sections                │
│  - Re-render when tracked signals change                │
└─────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Cleanup Phase (Once)                                     │
│  - Execute all onCleanup() callbacks                    │
│  - Unsubscribe from all signals                         │
│  - Clean up resources                                   │
└─────────────────────────────────────────────────────────┘
```

### Component Structure

```typescript
// User code
const Counter = rx((props, ctx) => {
  const [count, setCount] = ctx.state(0);
  return <div>{ctx.part(count)}</div>;
});

// Generated structure
<RxWrapper props={...}>           // Wrapper component (manages phases)
  <LoadingFallback />              // During setup phase
  <ErrorFallback error={...} />    // If setup throws
  <RxSubComponent                  // After setup complete
    hooks={collected}
    states={signals}
    result={reactNode}
  >
    <TrackedPart                   // For each ctx.part()
      fn={getter}
      signals={tracked}
    />
  </RxSubComponent>
</RxWrapper>
```

---

## Core Concepts

### 1. RxContext API

The `RxContext` is the interface provided to component render functions and logic:

```typescript
interface RxContext {
  state<T>(init: T): [get: () => T, set: (v: T | (prev: T) => T) => void];
  state<Store, Key>(store: Store<T>, key: Key): [get, set];
  hook<T>(fn: () => T): { current: T | undefined };
  part(fn: () => ReactNode): ReactNode;
  on(options: { cleanup?: VoidFunction | VoidFunction[] }): void;
  use<Logic>(logic: Logic, ...params): ReturnType<Logic>;
}
```

#### state()

Creates reactive state using signals internally.

**Local State:**
```typescript
const [count, setCount] = ctx.state(0);
```

**Global Store:**
```typescript
const appStore = store({ count: 0 });
const [count, setCount] = ctx.state(appStore, 'count');
```

**Implementation:**
- Creates a signal internally
- Returns getter/setter tuple
- Tracks dependencies when getter is called during part() or hook()

#### hook()

Wraps React hooks with reactivity tracking.

```typescript
const result = ctx.hook(() => {
  const value = getCount(); // Tracks count
  useEffect(() => {
    console.log(value);
  }, [value]);
  return value;
});
```

**Key Features:**
- Can be used conditionally (collected once during setup)
- Re-executes when tracked dependencies change
- Returns `{ current: T | undefined }`

#### part()

Creates fine-grained reactive sections.

```typescript
<div>{ctx.part(() => getCount())}</div>
// Or shorthand
<div>{ctx.part(getCount)}</div>
```

**Key Features:**
- Only this section re-renders on tracked state changes
- Automatically tracks signal dependencies
- Returns ReactNode

#### on()

Lifecycle and event management (currently cleanup only).

```typescript
const ws = await openWebSocket();
const db = await openDatabase();

// Single cleanup
ctx.on({ cleanup: () => ws.close() });

// Multiple cleanups
ctx.on({ 
  cleanup: [
    () => ws.close(),
    () => db.close()
  ]
});
```

**Key Features:**
- Flexible API for lifecycle hooks
- Supports single or array of cleanup functions
- Called once on component unmount
- Matches setup phase lifecycle
- Extensible for future lifecycle events

#### use()

Composes reusable logic.

```typescript
const counter = ctx.use(useCounter, 0);
```

**Key Features:**
- Logic can call other logic recursively
- Full type inference
- Can be async if awaited in setup

### 2. Store System

Global reactive stores for shared state.

```typescript
const appStore = store({ count: 0, theme: 'dark' });

// In component
const [count, setCount] = ctx.state(appStore, 'count');
```

**Implementation:**
- Each store property is a signal
- Components subscribe to specific properties
- Type-safe property access

---

## Lifecycle Phases

### Phase 1: Setup (Once)

**Trigger:** Component mounts

**Actions:**
1. Create component state container
2. Create RxContext instance
3. Execute render function (may be async)
4. Collect all API calls:
   - `state()` → Create signals
   - `hook()` → Store hook functions
   - `use()` → Execute logic
   - `on({ cleanup })` → Register callbacks
5. If async, render loading UI while awaiting
6. Store returned ReactNode
7. Transition to render phase

**Error Handling:**
- If render throws, render error UI or bubble to ErrorBoundary
- Cleanup any partially created resources

**Example:**
```typescript
const App = rx(async (props, ctx) => {
  // Setup phase starts
  const data = await fetchData();                      // May be async
  const [get, set] = ctx.state(data);                  // Collected
  ctx.on({ cleanup: () => cleanup() });                // Registered
  const result = ctx.use(someLogic, arg);              // Executed
  
  return <div>...</div>;                                // Returned
  // Setup phase ends, transition to render phase
});
```

### Phase 2: Render (Many)

**Trigger:** Initial setup complete, or tracked state changes

**Actions:**
1. Render sub-component with collected hooks
2. Execute all hooks in same order every time
3. Render result ReactNode with part() sections
4. Track dependencies in each part()
5. Subscribe to tracked signals

**Re-render Triggers:**
- Tracked signal changes (via part() or hook())
- Not triggered by non-tracked state changes

**Example:**
```typescript
// Setup phase
const App = rx(async (props, ctx) => {
  const data = await fetchData();
  const [get, set] = ctx.state(data);
  
  ctx.on({ cleanup: () => cleanup() });
  
  return <div>...</div>;
});

// After setup, sub-component renders:
function RxSubComponent({ hooks, result }) {
  // Execute all collected hooks (same order every time)
  hooks.forEach(hook => {
    hook.result = hook.fn();
  });
  
  // Render result with tracked parts
  return result;
}
```

### Phase 3: Cleanup (Once)

**Trigger:** Component unmounts

**Actions:**
1. Execute all registered cleanup callbacks (from `on({ cleanup })`)
2. Unsubscribe from all signals
3. Clear component state
4. Release resources

**Example:**
```typescript
// On unmount:
componentState.cleanupCallbacks.forEach(cb => cb());
componentState.states.forEach(signal => signal.unsubscribe());
```

---

## Reactivity System

### Signal Implementation

Signals are the core primitive for reactivity.

```typescript
interface Signal<T> {
  (): T;                                    // Read value
  set(value: T | ((prev: T) => T)): void;  // Write value
  subscribe(listener: () => void): () => void; // Subscribe
}

function createSignal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const subscribers = new Set<() => void>();
  
  const signal = () => {
    // Track if in reactive context
    if (currentTracker) {
      currentTracker.track(signal);
    }
    return value;
  };
  
  signal.set = (newValue) => {
    const resolved = typeof newValue === 'function' 
      ? newValue(value) 
      : newValue;
    
    if (Object.is(resolved, value)) return;
    
    value = resolved;
    
    // Notify subscribers
    subscribers.forEach(fn => fn());
  };
  
  signal.subscribe = (listener) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };
  
  return signal;
}
```

### Dependency Tracking

Dependency tracking uses a global stack for reactive contexts.

```typescript
let currentTracker: DependencyTracker | null = null;

interface DependencyTracker {
  dependencies: Set<Signal<any>>;
  track(signal: Signal<any>): void;
}

function track<T>(fn: () => T): [T, Set<Signal<any>>] {
  const tracker: DependencyTracker = {
    dependencies: new Set(),
    track(signal) {
      this.dependencies.add(signal);
    }
  };
  
  const prevTracker = currentTracker;
  currentTracker = tracker;
  
  try {
    const result = fn();
    return [result, tracker.dependencies];
  } finally {
    currentTracker = prevTracker;
  }
}
```

### part() Implementation

```typescript
function createPart(fn: (() => any) | (() => ReactNode)): ReactNode {
  const [, forceUpdate] = useState({});
  const depsRef = useRef<Set<Signal<any>>>(new Set());
  const unsubscribesRef = useRef<(() => void)[]>([]);
  
  // Cleanup old subscriptions
  useEffect(() => {
    return () => {
      unsubscribesRef.current.forEach(unsub => unsub());
    };
  }, []);
  
  // Track and subscribe
  const [result, newDeps] = track(() => {
    return typeof fn === 'function' && fn.length === 0 
      ? fn() 
      : fn;
  });
  
  // Update subscriptions if dependencies changed
  if (!setsEqual(depsRef.current, newDeps)) {
    // Unsubscribe from old
    unsubscribesRef.current.forEach(unsub => unsub());
    
    // Subscribe to new
    unsubscribesRef.current = Array.from(newDeps).map(signal =>
      signal.subscribe(() => forceUpdate({}))
    );
    
    depsRef.current = newDeps;
  }
  
  return result;
}
```

### hook() Implementation

```typescript
interface HookCollector {
  fn: () => any;
  dependencies: Set<Signal<any>>;
  result: any;
}

function createHook<T>(fn: () => T): HookCollector {
  return {
    fn,
    dependencies: new Set(),
    result: undefined
  };
}

// During render phase
function executeHook(hook: HookCollector) {
  // Unsubscribe from old dependencies
  hook.unsubscribes?.forEach(unsub => unsub());
  
  // Track new dependencies
  const [result, deps] = track(() => hook.fn());
  
  hook.result = result;
  hook.dependencies = deps;
  
  // Subscribe to new dependencies
  hook.unsubscribes = Array.from(deps).map(signal =>
    signal.subscribe(() => {
      // Re-execute hook on dependency change
      executeHook(hook);
      // Trigger sub-component re-render
      forceUpdate();
    })
  );
}
```

---

## Implementation Details

### rx() Factory Function

```typescript
export function rx<TProps>(
  render: (props: TProps, ctx: RxContext) => ReactNode | Promise<ReactNode>,
  options?: RxOptions
): React.ComponentType<TProps> {
  return (props: TProps) => {
    const [state, setState] = useState<ComponentState>({
      status: 'pending',
      hooks: [],
      states: [],
      cleanupCallbacks: [],
    });
    
    // Setup phase
    useEffect(() => {
      let cancelled = false;
      
      const context = createRxContext(state);
      
      const setupPromise = Promise.resolve(
        render(props, context)
      ).then(
        (result) => {
          if (!cancelled) {
            setState(prev => ({
              ...prev,
              status: 'ready',
              result
            }));
          }
        },
        (error) => {
          if (!cancelled) {
            setState(prev => ({
              ...prev,
              status: 'error',
              error
            }));
          }
        }
      );
      
      return () => {
        cancelled = true;
        // Cleanup
        state.cleanupCallbacks.forEach(cb => cb());
        state.states.forEach(signal => /* unsubscribe all */);
      };
    }, []);
    
    // Render based on status
    if (state.status === 'pending') {
      return options?.loading ?? null;
    }
    
    if (state.status === 'error') {
      if (options?.error) {
        return options.error(state.error!);
      }
      throw state.error;
    }
    
    return <SubComponent state={state} />;
  };
}
```

### SubComponent

```typescript
function SubComponent({ state }: { state: ComponentState }) {
  // Execute all collected hooks in same order
  state.hooks.forEach(hook => {
    executeHook(hook);
  });
  
  // Render result
  return <>{state.result}</>;
}
```

### createRxContext

```typescript
function createRxContext(state: ComponentState): RxContext {
  return {
    state<T>(initOrStore: T | Store<any>, key?: string) {
      if (isStore(initOrStore)) {
        return createStoreBinding(initOrStore, key!);
      }
      
      const signal = createSignal(initOrStore);
      state.states.push(signal);
      
      return [
        () => signal(),
        (value) => signal.set(value)
      ];
    },
    
    hook<T>(fn: () => T) {
      const collector: HookCollector = {
        fn,
        dependencies: new Set(),
        result: undefined
      };
      state.hooks.push(collector);
      return collector; // Returns { current: T | undefined }
    },
    
    part(fn) {
      return createPart(fn);
    },
    
    on(options) {
      if (options.cleanup) {
        const cleanups = Array.isArray(options.cleanup) 
          ? options.cleanup 
          : [options.cleanup];
        state.cleanupCallbacks.push(...cleanups);
      }
    },
    
    use(logic, ...params) {
      return logic(this, ...params);
    }
  };
}
```

### Store Implementation

```typescript
interface StoreInternal<T> {
  signals: Map<keyof T, Signal<any>>;
}

export function store<T extends Record<string, any>>(
  initialState: T
): Store<T> {
  const signals = new Map<keyof T, Signal<any>>();
  
  // Create signal for each property
  for (const key in initialState) {
    signals.set(key, createSignal(initialState[key]));
  }
  
  return {
    __brand: 'Store',
    __data: initialState,
    __internal: { signals }
  } as Store<T>;
}

function createStoreBinding<T, K extends keyof T>(
  store: Store<T>,
  key: K
): [get: () => T[K], set: (value: T[K] | ((prev: T[K]) => T[K])) => void] {
  const signal = store.__internal.signals.get(key)!;
  
  return [
    () => signal(),
    (value) => signal.set(value)
  ];
}
```

---

## Type System

### Type Inference

rxasync provides complete type inference without manual annotations.

#### Automatic Props Inference

```typescript
// Props automatically inferred
const Counter = rx((props: { initial: number }, ctx) => {
  //                    ^^^^^^^^^^^^^^^^^^^^^ Inferred from here
  const [count, setCount] = ctx.state(props.initial);
  return <div>{ctx.part(count)}</div>;
});

// Usage
<Counter initial={0} /> // ✅
<Counter initial="0" /> // ❌ Type error
```

#### State Type Inference

```typescript
const [count, setCount] = ctx.state(0);
//     ^^^^^              number (inferred)

const [user, setUser] = ctx.state({ name: 'John', age: 30 });
//     ^^^^               { name: string; age: number } (inferred)

setCount(123);        // ✅
setCount('hello');    // ❌ Type error
```

#### Store Type Inference

```typescript
const appStore = store({ count: 0, theme: 'dark' as const });

const [count, setCount] = ctx.state(appStore, 'count');
//     ^^^^^              number (inferred from store)

const [theme, setTheme] = ctx.state(appStore, 'theme');
//     ^^^^^              'dark' (literal type preserved)

ctx.state(appStore, 'invalid'); // ❌ Type error: 'invalid' not in store
```

#### Logic Type Inference

```typescript
const useCounter = (ctx: RxContext, initial: number) => {
  const [count, setCount] = ctx.state(initial);
  return { count, increment: () => setCount(c => c + 1) };
};

const counter = ctx.use(useCounter, 0);
//    ^^^^^^^   { count: () => number; increment: () => void } (inferred)

counter.count();      // ✅ number
counter.increment();  // ✅ void
counter.invalid;      // ❌ Type error
```

### Advanced Types

#### Conditional Hook Typing

```typescript
const result = condition && ctx.hook(() => 'value');
//    ^^^^^^   false | { current: string | undefined }

// Usage requires type guard
if (result) {
  console.log(result.current); // string | undefined
}
```

#### Logic Composition Types

```typescript
type Logic<TParams extends any[], TReturn> = (
  context: RxContext,
  ...params: TParams
) => TReturn;

// Async logic
type AsyncLogic<TParams extends any[], TReturn> = (
  context: RxContext,
  ...params: TParams
) => Promise<TReturn>;

// Usage
const fetchUser = async (ctx: RxContext, id: string): Promise<User> => {
  return await fetch(`/api/users/${id}`).then(r => r.json());
};

const user = await ctx.use(fetchUser, '123');
//    ^^^^  User (inferred)
```

---

## Performance Considerations

### Optimization Strategies

#### 1. Fine-Grained Updates

Only `part()` sections re-render on state changes, not the entire component.

```typescript
const App = rx((props, ctx) => {
  const [count, setCount] = ctx.state(0);
  const [name, setName] = ctx.state('John');
  
  return (
    <div>
      <h1>{ctx.part(count)}</h1>        {/* Only re-renders on count change */}
      <p>{ctx.part(name)}</p>           {/* Only re-renders on name change */}
      <Footer />                        {/* Never re-renders */}
    </div>
  );
});
```

**Performance Impact:**
- ✅ Reduces reconciliation work
- ✅ Prevents unnecessary child re-renders
- ✅ Scales well with component complexity

#### 2. Batched Updates

Multiple state changes are batched automatically.

```typescript
const increment10 = () => {
  for (let i = 0; i < 10; i++) {
    setCount(c => c + 1);  // All batched into single update
  }
};
```

**Implementation:**
```typescript
let updateQueue: Set<() => void> = new Set();
let isPending = false;

function scheduleUpdate(callback: () => void) {
  updateQueue.add(callback);
  
  if (!isPending) {
    isPending = true;
    queueMicrotask(() => {
      isPending = false;
      const queue = updateQueue;
      updateQueue = new Set();
      queue.forEach(cb => cb());
    });
  }
}
```

#### 3. Subscription Management

Efficient subscription/unsubscription to prevent memory leaks.

```typescript
// Automatically manage subscriptions
const part = ctx.part(() => getValue());
// Subscribes on mount
// Unsubscribes on unmount or when dependencies change
```

#### 4. Hook Re-execution

Hooks only re-execute when tracked dependencies change.

```typescript
const result = ctx.hook(() => {
  const count = getCount();  // Tracks count
  const name = getName();    // Tracks name
  return useMemo(() => `${name}: ${count}`, [name, count]);
});
// Only re-executes when count or name change
```

### Performance Benchmarks (Planned)

| Scenario | rxasync | React + useState | Solid.js |
|----------|---------|------------------|----------|
| Initial render | ~TBD | ~TBD | ~TBD |
| Update 1 of 10 parts | ~TBD | ~TBD | ~TBD |
| Update all parts | ~TBD | ~TBD | ~TBD |
| Memory usage | ~TBD | ~TBD | ~TBD |

---

## Edge Cases & Solutions

### 1. Rapid State Updates

**Problem:** Multiple rapid updates cause multiple re-renders.

**Solution:** Automatic batching.

```typescript
// All updates batched
for (let i = 0; i < 1000; i++) {
  setCount(i);
}
// Only 1 re-render
```

### 2. Async Race Conditions

**Problem:** Component unmounts while async operation pending.

**Solution:** Cancellation flag.

```typescript
useEffect(() => {
  let cancelled = false;
  
  Promise.resolve(render(props, ctx)).then(result => {
    if (!cancelled) {
      setState({ status: 'ready', result });
    }
  });
  
  return () => { cancelled = true; };
}, []);
```

### 3. Circular Dependencies

**Problem:** Signal A depends on signal B which depends on signal A.

**Solution:** Detection and error.

```typescript
const depthStack: Signal<any>[] = [];

function detectCircular(signal: Signal<any>) {
  if (depthStack.includes(signal)) {
    throw new Error('Circular dependency detected');
  }
  depthStack.push(signal);
  try {
    // ... compute value ...
  } finally {
    depthStack.pop();
  }
}
```

### 4. Memory Leaks

**Problem:** Subscriptions not cleaned up.

**Solution:** Automatic cleanup on unmount.

```typescript
useEffect(() => {
  // Setup subscriptions
  return () => {
    // Cleanup all subscriptions
    state.cleanupCallbacks.forEach(cb => cb());
  };
}, []);
```

### 5. Hook Order Changes

**Problem:** Conditional hooks could change order.

**Solution:** Collect hooks once during setup, execute in same order always.

```typescript
// Setup phase (once)
const hooks = [];
if (condition) {
  hooks.push(hookFn1);
}
hooks.push(hookFn2);

// Render phase (many times)
hooks.forEach(fn => fn()); // Always same order
```

### 6. Store Property Type Widening

**Problem:** Literal types become primitives.

**Solution:** Use `as const`.

```typescript
// ❌ Type is string
const store1 = store({ theme: 'dark' });

// ✅ Type is 'dark'
const store2 = store({ theme: 'dark' as const });
```

### 7. Part with Side Effects

**Problem:** `part()` function runs multiple times during tracking.

**Solution:** Document that `part()` should be pure.

```typescript
// ❌ Bad: Side effects in part
ctx.part(() => {
  console.log('Called');  // Will log multiple times
  return getCount();
});

// ✅ Good: Pure function
ctx.part(getCount);
```

---

## Testing Strategy

### Unit Tests

#### 1. Signal Tests

```typescript
it('should create and update signal', () => {
  const signal = createSignal(0);
  expect(signal()).toBe(0);
  signal.set(5);
  expect(signal()).toBe(5);
});

it('should notify subscribers', () => {
  const signal = createSignal(0);
  const listener = jest.fn();
  signal.subscribe(listener);
  signal.set(1);
  expect(listener).toHaveBeenCalledTimes(1);
});
```

#### 2. Tracking Tests

```typescript
it('should track dependencies', () => {
  const signal1 = createSignal(1);
  const signal2 = createSignal(2);
  
  const [result, deps] = track(() => signal1() + signal2());
  
  expect(result).toBe(3);
  expect(deps.size).toBe(2);
  expect(deps.has(signal1)).toBe(true);
});
```

#### 3. Store Tests

```typescript
it('should create store with signals', () => {
  const s = store({ count: 0, name: 'John' });
  const [getCount, setCount] = createStoreBinding(s, 'count');
  
  expect(getCount()).toBe(0);
  setCount(5);
  expect(getCount()).toBe(5);
});
```

### Integration Tests

#### 1. Component Rendering

```typescript
it('should render component', async () => {
  const Counter = rx((props, ctx) => {
    const [count, setCount] = ctx.state(0);
    return <div>{ctx.part(count)}</div>;
  });
  
  const { getByText } = render(<Counter />);
  await waitFor(() => expect(getByText('0')).toBeInTheDocument());
});
```

#### 2. State Updates

```typescript
it('should update on state change', async () => {
  const Counter = rx((props, ctx) => {
    const [count, setCount] = ctx.state(0);
    return (
      <div>
        {ctx.part(count)}
        <button onClick={() => setCount(c => c + 1)}>+</button>
      </div>
    );
  });
  
  const { getByText } = render(<Counter />);
  await waitFor(() => expect(getByText('0')).toBeInTheDocument());
  
  fireEvent.click(getByText('+'));
  await waitFor(() => expect(getByText('1')).toBeInTheDocument());
});
```

#### 3. Async Components

```typescript
it('should handle async setup', async () => {
  const AsyncComp = rx(async (props, ctx) => {
    await delay(100);
    return <div>Ready</div>;
  }, {
    loading: <div>Loading</div>
  });
  
  const { getByText } = render(<AsyncComp />);
  expect(getByText('Loading')).toBeInTheDocument();
  
  await waitFor(() => expect(getByText('Ready')).toBeInTheDocument());
});
```

#### 4. Logic Composition

```typescript
it('should compose logic', async () => {
  const useCounter = (ctx: RxContext, init: number) => {
    const [count, setCount] = ctx.state(init);
    return { count, increment: () => setCount(c => c + 1) };
  };
  
  const App = rx((props, ctx) => {
    const counter = ctx.use(useCounter, 0);
    return (
      <button onClick={counter.increment}>
        {ctx.part(counter.count)}
      </button>
    );
  });
  
  const { getByText } = render(<App />);
  await waitFor(() => expect(getByText('0')).toBeInTheDocument());
  
  fireEvent.click(getByText('0'));
  await waitFor(() => expect(getByText('1')).toBeInTheDocument());
});
```

### Performance Tests

```typescript
it('should only re-render changed parts', async () => {
  let part1Renders = 0;
  let part2Renders = 0;
  
  const App = rx((props, ctx) => {
    const [count1, setCount1] = ctx.state(0);
    const [count2, setCount2] = ctx.state(0);
    
    return (
      <div>
        {ctx.part(() => { part1Renders++; return count1(); })}
        {ctx.part(() => { part2Renders++; return count2(); })}
        <button onClick={() => setCount1(c => c + 1)}>+1</button>
      </div>
    );
  });
  
  const { getByText } = render(<App />);
  await waitFor(() => getByText('0'));
  
  part1Renders = 0;
  part2Renders = 0;
  
  fireEvent.click(getByText('+1'));
  
  await waitFor(() => {
    expect(part1Renders).toBe(1); // Only part1 re-rendered
    expect(part2Renders).toBe(0); // part2 not re-rendered
  });
});
```

---

## Future Enhancements

### 1. **Extended Lifecycle Hooks**

Extend `on()` API for more lifecycle events:
```typescript
ctx.on({
  cleanup: () => cleanup(),
  mount: () => console.log('Mounted'),        // Future
  update: () => console.log('Updated'),        // Future
  beforeRender: () => console.log('Rendering') // Future
});
```

### 2. **Devtools Integration**

Browser extension for:
- Component tree visualization
- State inspection
- Time-travel debugging
- Performance profiling

### 3. **SSR/RSC Support**

Server-side rendering and React Server Components:
- Serialize setup phase results
- Hydrate on client
- Stream async components

### 4. **Persistence**

Automatic state persistence:
```typescript
const [count, setCount] = ctx.state(0, { persist: 'localStorage' });
```

### 5. **Middleware**

Logic middleware for cross-cutting concerns:
```typescript
const logger = (ctx: RxContext) => (logic, ...args) => {
  console.log('Before:', logic.name);
  const result = logic(ctx, ...args);
  console.log('After:', logic.name);
  return result;
};
```

### 6. **Computed Values**

Built-in computed signals:
```typescript
const doubled = ctx.computed(() => count() * 2);
```

---

## Conclusion

rxasync provides a powerful, type-safe, and performant way to build React components with:
- Natural async/await syntax
- Fine-grained reactivity
- Safe conditional hooks
- Composable logic patterns
- Unified state management

The architecture is designed for simplicity, performance, and developer experience, while maintaining full compatibility with the React ecosystem.

