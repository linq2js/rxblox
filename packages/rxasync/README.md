# rxasync

Reactive async components for React with fine-grained reactivity and composable logic.

## Features

- 🔄 **Reactive State**: Fine-grained reactivity with signals - only parts that change re-render
- ⚡ **Async Setup**: Natural async/await in component initialization
- 🧩 **Composable Logic**: Reusable logic like custom hooks, but more powerful
- 🎯 **Type Safe**: Full TypeScript support with complete type inference
- 🪝 **Safe Conditional Hooks**: Use React hooks in conditions safely
- 🌐 **Global State**: Built-in store with unified API (no provider needed)
- 🧹 **Cleanup**: Explicit lifecycle management with `on({ cleanup })`

## Installation

```bash
npm install rxasync
```

```bash
pnpm add rxasync
```

```bash
yarn add rxasync
```

## Quick Start

```tsx
import { rx } from 'rxasync';

export const Counter = rx((props, ctx) => {
  const [count, setCount] = ctx.state(0);
  
  return (
    <div>
      <h1>{ctx.part(count)}</h1>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
});
```

## Documentation

See the [docs](./docs) folder for comprehensive documentation:

- [Technical Design](./docs/technical-design.md) - Complete technical specification
- [API Reference](./docs/api-reference.md) - API documentation (coming soon)
- [Examples](./examples) - Usage examples (coming soon)

## Core Concepts

### Async Initialization

```tsx
const UserProfile = rx(async ({ userId }, ctx) => {
  const user = await fetchUser(userId);
  const [getUser, setUser] = ctx.state(user);
  
  return <h1>{ctx.part(() => getUser().name)}</h1>;
}, {
  loading: <div>Loading...</div>,
  error: (err) => <div>Error: {err.message}</div>
});
```

### Fine-Grained Reactivity

```tsx
const App = rx((props, ctx) => {
  const [count, setCount] = ctx.state(0);
  const [name, setName] = ctx.state('John');
  
  return (
    <div>
      {/* Only this part re-renders when count changes */}
      <p>Count: {ctx.part(count)}</p>
      
      {/* Only this part re-renders when name changes */}
      <p>Name: {ctx.part(name)}</p>
      
      {/* This never re-renders */}
      <p>Static content</p>
    </div>
  );
});
```

### Composable Logic

```tsx
import { type RxContext } from 'rxasync';

const useCounter = (ctx: RxContext, init: number) => {
  const [count, setCount] = ctx.state(init);
  return {
    count,
    increment: () => setCount(c => c + 1),
    decrement: () => setCount(c => c - 1)
  };
};

const App = rx((props, ctx) => {
  const counter = ctx.use(useCounter, 0);
  
  return (
    <div>
      <h1>{ctx.part(counter.count)}</h1>
      <button onClick={counter.increment}>+</button>
      <button onClick={counter.decrement}>-</button>
    </div>
  );
});
```

### Global Store

```tsx
import { rx, store } from 'rxasync';

const appStore = store({ 
  theme: 'dark' as const,
  count: 0 
});

const App = rx((props, ctx) => {
  const [theme, setTheme] = ctx.state(appStore, 'theme');
  const [count, setCount] = ctx.state(appStore, 'count');
  
  return (
    <div className={ctx.part(theme)}>
      <h1>{ctx.part(count)}</h1>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
        Toggle Theme
      </button>
    </div>
  );
});
```

### Cleanup Management

```tsx
const App = rx(async (props, ctx) => {
  const ws = await openWebSocket();
  const db = await openDatabase();
  
  // Single cleanup
  ctx.on({ cleanup: () => ws.close() });
  
  // Multiple cleanups
  ctx.on({ cleanup: [
    () => ws.close(),
    () => db.close()
  ]});
  
  return <div>...</div>;
});
```

## Comparison

| Feature | rxasync | React + Hooks | Solid.js |
|---------|---------|---------------|----------|
| Async init | ✅ Native | ❌ useEffect | ❌ Resources |
| Fine-grained | ✅ Yes | ❌ No | ✅ Yes |
| Conditional hooks | ✅ Safe | ❌ Unsafe | N/A |
| Composable logic | ✅ `ctx.use()` | ⚠️ Custom hooks | ⚠️ Primitives |
| Global state | ✅ Built-in | ❌ External | ✅ Built-in |
| Learning curve | ✅ Low | ✅ Low | ⚠️ Medium |

## License

MIT

## Contributing

Contributions welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

