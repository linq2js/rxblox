# rxblox Documentation

Complete documentation for rxblox - Fine-grained reactive state management for React.

[![npm version](https://img.shields.io/npm/v/rxblox.svg)](https://www.npmjs.com/package/rxblox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📚 Documentation Index

### Getting Started

Start here if you're new to rxblox:

1. **[Installation & Quick Start](../README.md#installation)** - Get up and running in minutes
2. **[Why rxblox?](../README.md#why-rxblox)** - Understanding the motivation and benefits
3. **[The Dependency Array Problem](../README.md#-the-dependency-array-problem)** - See how rxblox solves React's biggest pain point
4. **[React-Compatible Hooks](./react-compatible-hooks.md)** - Use rxblox with familiar React patterns
   - `rx()` - Reactive expressions in JSX
   - `useTracked()` - Conditional signal tracking
   - `useSignals()` - Manual signal control
   - `useAction()` - Reactive async operations

### Core Documentation

Master the fundamentals of rxblox:

- **[Core Concepts](./core-concepts.md)** - Essential building blocks
  - Signals - Reactive state primitives
  - Computed Signals - Derived state with automatic tracking
  - Effects - Side effects with auto-tracking
  - Reactive Expressions (`rx()`) - Fine-grained UI updates
  - Reactive Components (`blox()`) - Components that run once
  - Providers - Dependency injection
  - Async Signals - Built-in async state management
  - Loadable States - Type-safe async operation states
  - Wait Utilities - Coordinate multiple async operations
  - Actions - Stateful, trackable functions

- **[API Reference](./api-reference.md)** - Complete API documentation
  - `signal()` - Create reactive state
  - `signal.async()` - Manage async operations
  - `signal.snapshot()` - Extract signal values
  - `signal.history()` - Track value changes over time
  - `diff()` - Compare values and detect changes
  - `effect()` - Run side effects reactively
  - `rx()` - Create reactive UI expressions
  - `blox()` - Create reactive components
  - `provider()` - Dependency injection
  - `wait()` / `wait.all()` / `wait.any()` / `wait.race()` / `wait.settled()` - Coordinate async operations
  - `action()` / `action.cancellable()` - Trackable actions
  - `loadable()` / `isLoadable()` - Loadable state utilities

- **[Lifecycle & Cleanup](./lifecycle-cleanup.md)** - Memory management and cleanup
  - Automatic cleanup in `blox` components
  - Effect cleanup and lifecycle
  - Signal lifecycle and garbage collection
  - Global signals management
  - Cleanup checklist

- **[Performance & Memory](./performance.md)** - Optimization guide
  - Subscription overhead
  - Dependency tracking characteristics
  - Update batching
  - Memory leak prevention
  - Large lists & virtualization
  - Profiling tips

- **[Signal Persistence](./PERSISTENCE.md)** - Automatic state persistence
  - Persistor interface and architecture
  - Zero-flicker synchronous hydration
  - Race condition handling
  - Cross-tab synchronization
  - Reactive persistence status tracking
  - localStorage, sessionStorage, IndexedDB examples

### Practical Guides

Learn patterns and best practices:

- **[Patterns & Best Practices](./patterns.md)** - Real-world patterns
  - Common Patterns
    - Global state management
    - Form state handling
    - Async data loading
    - React refs usage
    - Optimistic updates
  - Organizing Signals
    - Global signals (singleton state)
    - Local signals (component state)
    - Signal factories (reusable logic)
  - Composable Logic
    - Naming conventions
    - Universal vs blox-only logic
    - Complex state logic
    - Composing multiple functions

- **[Comparisons](./comparisons.md)** - vs. other solutions
  - Feature comparison matrix
  - Boilerplate comparisons
    - Redux Toolkit (~35 lines)
    - Zustand (~20 lines)
    - Jotai (~25 lines)
    - **rxblox (~12 lines)** ✨
  - Why choose rxblox

### Advanced Topics

Deep dives for advanced users:

- **[Architecture](./ARCHITECTURE.md)** - Internal design
  - Architecture overview
  - Core abstractions
  - Dispatcher system
  - Signal implementation
  - Effect system
  - Async signals
  - React integration (`blox()` and `rx()`)
  - Provider implementation
  - Design decisions and rationale

### Contributing

Help make rxblox better:

- **[Contributing Guide](./contributing.md)** - Contribution guidelines
  - Before submitting a PR
  - Development workflow
  - Pull request checklist
  - Reporting issues
  - Code style and conventions

---

## 🎯 Quick Navigation

### By Use Case

**I want to...**

- **Learn the basics** → Start with [Core Concepts](./core-concepts.md)
- **Use familiar React patterns** → Try [React-Compatible Hooks](./react-compatible-hooks.md)
- **See all APIs** → Go to [API Reference](./api-reference.md)
- **Persist state to storage** → Read [Signal Persistence](./PERSISTENCE.md)
- **Solve a specific problem** → Check [Patterns & Best Practices](./patterns.md)
- **Compare with other libraries** → Read [Comparisons](./comparisons.md)
- **Optimize performance** → Review [Performance & Memory](./performance.md)
- **Avoid memory leaks** → Study [Lifecycle & Cleanup](./lifecycle-cleanup.md)
- **Understand internals** → Explore [Architecture](./ARCHITECTURE.md)
- **Contribute** → Follow [Contributing Guide](./contributing.md)

### By Experience Level

**Beginner** (New to rxblox)
1. [Why rxblox?](../README.md#why-rxblox)
2. [Quick Start](../README.md#quick-start)
3. Choose your path:
   - **Prefer React patterns?** → [React-Compatible Hooks](./react-compatible-hooks.md)
   - **Want fine-grained control?** → [Core Concepts](./core-concepts.md) - Read sections 1-5
4. [Common Patterns](./patterns.md#common-patterns)

**Intermediate** (Building apps)
1. [Organizing Signals](./patterns.md#organizing-signals)
2. [Async Signals](./core-concepts.md#7-async-signals---signalasync)
3. [Lifecycle & Cleanup](./lifecycle-cleanup.md)
4. [API Reference](./api-reference.md) - Full reference

**Advanced** (Optimizing & scaling)
1. [Performance & Memory](./performance.md)
2. [Architecture](./ARCHITECTURE.md)
3. [Composable Logic](./patterns.md#composable-logic)

---

## 📖 Documentation Format

Each documentation file follows a consistent structure:

- **Clear headings** - Easy navigation with table of contents
- **Code examples** - Real-world, runnable examples
- **Type definitions** - Full TypeScript support
- **Best practices** - ✅ DO and ❌ DON'T examples
- **Important notes** - ⚠️ Caveats and gotchas

---

## 🔗 External Links

- **[GitHub Repository](https://github.com/linq2js/rxblox)** - Source code and issues
- **[npm Package](https://www.npmjs.com/package/rxblox)** - Install and package info
- **[License (MIT)](https://opensource.org/licenses/MIT)** - Open source license

---

## 💡 Get Help

- **Questions?** Open a [GitHub Discussion](https://github.com/linq2js/rxblox/discussions)
- **Found a bug?** Report an [Issue](https://github.com/linq2js/rxblox/issues)
- **Want to contribute?** Read the [Contributing Guide](./contributing.md)

---

## 📝 Documentation TOC (Detailed)

<details>
<summary><strong>Core Concepts</strong> (Click to expand)</summary>

1. Signals - Reactive State Primitives
2. Computed Signals - Derived State
   - Explicit Dependency Tracking with `track()`
3. Effects - Side Effects with Auto-Tracking
4. Reactive Expressions - `rx()`
5. Reactive Components - `blox()`
   - Structure of a `blox` Component
   - Complete Example
   - Why `blox` vs Traditional React?
   - Using React Hooks with `blox`
6. Providers - Dependency Injection
   - Passing Signals to Providers
7. Async Signals - `signal.async()`
   - Dependency Tracking in Async Signals
   - The `track()` Method - Lazy Tracking for Async Contexts
8. Loadable States
   - Creating Loadables
   - Type Guard
   - React Suspense Integration
9. Wait Utilities
   - `wait()` / `wait.all()` - Wait for all to complete
   - `wait.any()` - Wait for first success
   - `wait.race()` - Wait for first to complete
   - `wait.settled()` - Wait for all to settle
10. Actions
    - Basic Actions
    - Cancellable Actions
    - Event Callbacks
    - Concurrent Call Handling
    - Subscribing to Actions

</details>

<details>
<summary><strong>API Reference</strong> (Click to expand)</summary>

- `signal<T>(value, options?)`
- `signal.async<T>(fn)`
- `signal.snapshot<T>(input)`
- `signal.history<T>(getValue, options?)`
- `diff<T>(current, previous)`
- `effect(fn)`
- `rx(expression)`
- `blox<Props>(builder)`
- `blox.onRender(callback)`
- `blox.onMount(callback)`
- `blox.onUnmount(callback)`
- `blox.handle<T>(callback)`
- `provider<T>(name, initialValue, options?)`
- `loadable(status, value, promise?)`
- `isLoadable(value)`
- `wait` / `wait.all`
- `wait.any(awaitables)`
- `wait.race(awaitables)`
- `wait.settled(awaitables)`
- `action<TResult, TArgs>(fn, options?)`
- `action.cancellable<TResult, TArgs>(fn, options?)`
- `action.aborter()`

</details>

<details>
<summary><strong>Patterns & Best Practices</strong> (Click to expand)</summary>

**Common Patterns:**
- Global State
- Form State
- Async Data Loading
- Using React Refs
- Optimistic Updates

**Organizing Signals:**
- Global Signals (Singleton State)
- Local Signals (Component State)
- Signal Factories (Reusable Logic)
  - Pattern 1: Simple Factory
  - Pattern 2: Async Data Factory
  - Pattern 3: Form Field Factory
  - Pattern 4: Store Factory

**Composable Logic:**
- Naming Conventions
- Basic Example
- Blox-only Logic with Cleanup
- Complex State Logic
- Composing Multiple Functions

</details>

---

Made with ❤️ for the React community

**[Back to npm package](../README.md)** | **[View on GitHub](https://github.com/linq2js/rxblox)**

