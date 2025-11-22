import type { Store } from "./types";

/**
 * Creates a global reactive store.
 *
 * Stores are shared across all components that bind to them using ctx.state().
 * Any component that accesses a store property will automatically re-render
 * when that property changes.
 *
 * @template T Store shape (object with properties)
 * @param initialState Initial state values
 * @returns Store instance
 *
 * @example
 * ```tsx
 * const appStore = store({
 *   theme: 'dark' as const,
 *   userCount: 0,
 *   settings: { notifications: true }
 * });
 *
 * // In component
 * const [theme, setTheme] = ctx.state(appStore, 'theme');
 * const [count, setCount] = ctx.state(appStore, 'userCount');
 * ```
 *
 * @example Multiple components sharing state
 * ```tsx
 * const appStore = store({ count: 0 });
 *
 * // Component A
 * const Display = rx((_, ctx) => {
 *   const [count] = ctx.state(appStore, 'count');
 *   return <h1>{ctx.part(count)}</h1>;
 * });
 *
 * // Component B
 * const Controls = rx((_, ctx) => {
 *   const [count, setCount] = ctx.state(appStore, 'count');
 *   return <button onClick={() => setCount(c => c + 1)}>+</button>;
 * });
 * ```
 */
export function store<T extends Record<string, any>>(
  initialState: T
): Store<T> {
  // Implementation will be added in runtime/
  throw new Error("store() implementation not yet complete");
}

