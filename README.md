# RxBlox Monorepo

A monorepo containing the RxBlox state management library and demo application.

## Structure

- `packages/rxblox` - The main library package (publishable to NPM)
- `packages/rxblox-demo` - Demo application using the library
- `packages/rxblox-todo` - TodoMVC implementation showcasing best practices

## Getting Started

### Install Dependencies

```bash
pnpm install
```

### Development

```bash
# Run demo app
pnpm dev

# Run todo app with watch build (recommended for development)
pnpm dev:todo

# Build library
pnpm build

# Build library in watch mode
cd packages/rxblox
pnpm build:watch

# Run tests
pnpm test
```

#### Development Workflow

When developing the library and todo app simultaneously:

```bash
# Terminal 1: Watch build rxblox + run todo dev server
pnpm dev:todo
```

This command automatically:
- Rebuilds `rxblox` when you change library code
- Hot-reloads the todo app via Vite HMR
- Runs both processes in parallel

## Publishing

To publish the `rxblox` package:

```bash
cd packages/rxblox

# Dry run (check what would be published)
pnpm dry

# Version bump
pnpm version:minor  # or version:major

# Build and publish
pnpm build
npm publish
```

## Performance Best Practices

### 1. Optimizing Props with Custom Equality

When working with complex props in `blox` components, create signals with custom equality to prevent unnecessary re-renders.

#### Use `shallowEqual` for Object Props

```tsx
import { blox, rx, signal } from "rxblox";
import shallowEqual from "shallowequal";

interface Props {
  user: { id: number; name: string; email: string };
  config: { theme: string; locale: string };
}

export const UserCard = blox<Props>((props) => {
  // ✅ GOOD: Use shallowEqual to avoid re-renders when object identity changes
  // but contents are the same
  const user = signal(() => props.user, { equals: shallowEqual });
  const config = signal(() => props.config, { equals: shallowEqual });

  return rx(() => {
    // Now these only re-render when user/config contents actually change
    const currentUser = user();
    const currentConfig = config();
    
    return (
      <div className={`theme-${currentConfig.theme}`}>
        <h2>{currentUser.name}</h2>
        <p>{currentUser.email}</p>
      </div>
    );
  });
});
```

#### Use Deep Equality for Nested Objects

```tsx
import { blox, rx, signal } from "rxblox";
import { isEqual } from "lodash-es";

interface Props {
  data: {
    nested: {
      deeply: {
        value: number;
      };
    };
  };
}

export const DeepComponent = blox<Props>((props) => {
  // ✅ GOOD: Use deep equality for deeply nested structures
  const data = signal(() => props.data, { equals: isEqual });

  return rx(() => {
    // Only re-renders when deeply nested value actually changes
    return <div>{data().nested.deeply.value}</div>;
  });
});
```

#### Why This Matters

**Without custom equality:**
```tsx
// ❌ BAD: Re-renders every time parent re-renders (new object identity)
export const UserCard = blox<Props>((props) => {
  return rx(() => {
    // props.user is a new object on every parent render
    // Even if contents are identical, this rx() re-runs!
    return <div>{props.user.name}</div>;
  });
});
```

**With custom equality:**
```tsx
// ✅ GOOD: Only re-renders when contents change
export const UserCard = blox<Props>((props) => {
  const user = signal(() => props.user, { equals: shallowEqual });
  
  return rx(() => {
    // user() only changes when contents differ
    return <div>{user().name}</div>;
  });
});
```

#### Pattern: Derived Computations

```tsx
interface Props {
  items: Array<{ id: number; price: number; quantity: number }>;
}

export const ShoppingCart = blox<Props>((props) => {
  // Signal with shallow equality
  const items = signal(() => props.items, { equals: shallowEqual });
  
  // Computed signal that only recalculates when items change
  const total = signal(() => {
    return items().reduce((sum, item) => sum + item.price * item.quantity, 0);
  });
  
  const tax = signal(() => total() * 0.1);
  const grandTotal = signal(() => total() + tax());

  return rx(() => (
    <div>
      <div>Subtotal: ${total()}</div>
      <div>Tax: ${tax()}</div>
      <div>Total: ${grandTotal()}</div>
    </div>
  ));
});
```

### 2. Don't Overuse `rx()` Blocks

**Rule of Thumb:** If you need more than 3 `rx()` blocks in a single `blox` component, consider:
1. Splitting into smaller `blox` components
2. Using a single `rx()` block

#### ❌ BAD: Too Many `rx()` Blocks

```tsx
// Anti-pattern: Too granular, hard to maintain
export const UserProfile = blox<Props>((props) => {
  return (
    <div>
      {rx(() => <h1>{props.user.name}</h1>)}
      {rx(() => <p>{props.user.email}</p>)}
      {rx(() => <p>{props.user.bio}</p>)}
      {rx(() => <img src={props.user.avatar} />)}
      {rx(() => <span>{props.user.status}</span>)}
      {rx(() => <div>{props.user.location}</div>)}
    </div>
  );
});
```

**Problems:**
- Hard to read and maintain
- Creates many subscriptions
- Minimal performance benefit
- Over-optimization

#### ✅ GOOD: Single `rx()` Block

```tsx
// Better: Single rx() block for related content
export const UserProfile = blox<Props>((props) => {
  const user = signal(() => props.user, { equals: shallowEqual });

  return rx(() => {
    const currentUser = user();
    
    return (
      <div>
        <h1>{currentUser.name}</h1>
        <p>{currentUser.email}</p>
        <p>{currentUser.bio}</p>
        <img src={currentUser.avatar} />
        <span>{currentUser.status}</span>
        <div>{currentUser.location}</div>
      </div>
    );
  });
});
```

**Benefits:**
- Cleaner, more readable code
- Easier to maintain
- Good enough performance for most cases
- All related data updates together

#### ✅ GOOD: Split Into Smaller Components

```tsx
// Best: Split into logical components
export const UserProfile = blox<Props>((props) => {
  return (
    <div>
      <UserHeader user={props.user} />
      <UserBio user={props.user} />
      <UserStatus user={props.user} />
    </div>
  );
});

const UserHeader = blox<{ user: User }>((props) => {
  const user = signal(() => props.user, { equals: shallowEqual });
  
  return rx(() => {
    const { name, avatar } = user();
    return (
      <div>
        <img src={avatar} />
        <h1>{name}</h1>
      </div>
    );
  });
});

const UserBio = blox<{ user: User }>((props) => {
  const user = signal(() => props.user, { equals: shallowEqual });
  
  return rx(() => (
    <p>{user().bio}</p>
  ));
});

const UserStatus = blox<{ user: User }>((props) => {
  const user = signal(() => props.user, { equals: shallowEqual });
  
  return rx(() => (
    <span>{user().status}</span>
  ));
});
```

**Benefits:**
- Clear separation of concerns
- Each component optimizes independently
- Easier to test and reuse
- Better code organization

#### When Multiple `rx()` Blocks ARE Appropriate

Use 2-3 `rx()` blocks when they have **truly independent** update patterns:

```tsx
export const Dashboard = blox(() => {
  const user = signal(getCurrentUser());
  const notifications = signal(getNotifications());
  const messages = signal(getMessages());

  return (
    <div>
      {/* Updates only when user changes */}
      {rx(() => (
        <header>Welcome, {user().name}</header>
      ))}
      
      {/* Updates only when notifications change */}
      {rx(() => (
        <aside>
          <h3>Notifications ({notifications().length})</h3>
          {notifications().map(n => <div key={n.id}>{n.text}</div>)}
        </aside>
      ))}
      
      {/* Updates only when messages change */}
      {rx(() => (
        <main>
          <h3>Messages ({messages().length})</h3>
          {messages().map(m => <div key={m.id}>{m.text}</div>)}
        </main>
      ))}
    </div>
  );
});
```

This is fine because:
- ✅ Each section updates independently
- ✅ Clear performance benefit (e.g., new message doesn't re-render notifications)
- ✅ Still maintainable

### Summary

**DO:**
- ✅ Use `shallowEqual` for object/array props
- ✅ Use `isEqual` (deep) for deeply nested structures
- ✅ Create signals with custom equality for expensive computations
- ✅ Use 1-3 `rx()` blocks per component
- ✅ Split large components into smaller `blox` components

**DON'T:**
- ❌ Create signals without equality checking for complex props
- ❌ Use more than 3 `rx()` blocks in one component
- ❌ Over-optimize with too many tiny `rx()` blocks
- ❌ Create `rx()` blocks for static content

### 3. Batch Related Updates

Use `batch()` to group multiple signal updates, preventing unnecessary recomputations:

```tsx
import { batch, signal } from "rxblox";

const firstName = signal("John");
const lastName = signal("Doe");
const fullName = signal(() => `${firstName()} ${lastName()}`);

// ❌ Without batch: fullName recomputes twice
firstName.set("Jane");
lastName.set("Smith");

// ✅ With batch: fullName recomputes once
batch(() => {
  firstName.set("Jane");
  lastName.set("Smith");
});
```

**When to use `batch()`:**
- ✅ Updating multiple related signals
- ✅ Performance-critical paths (loops, event handlers)
- ✅ Preventing inconsistent intermediate states

For more details, see the [Batching Guide](./packages/rxblox/docs/batching.md).

For more examples, see the TodoMVC implementation in `packages/rxblox-todo`.

## Documentation

- [API Reference](./packages/rxblox/docs/api-reference.md) - Complete API documentation
- [Batching Guide](./packages/rxblox/docs/batching.md) - How to batch updates efficiently
- [Patterns & Best Practices](./packages/rxblox/docs/patterns.md) - Common patterns and tips
- [vs. Other Libraries](./packages/rxblox/docs/comparisons.md) - Feature comparison with other state libraries
