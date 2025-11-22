/**
 * rxasync - Reactive async components for React
 *
 * This library provides a powerful component model that combines:
 * - Async/await for component initialization
 * - Fine-grained reactivity (only parts that need to re-render do)
 * - Safe conditional hooks (no Rules of Hooks violations)
 * - Composable logic (like custom hooks but better)
 * - Unified API for local and global state
 *
 * @example Basic usage
 * ```tsx
 * import { rx } from 'rxasync';
 *
 * export const Counter = rx((props, ctx) => {
 *   const [count, setCount] = ctx.state(0);
 *
 *   return (
 *     <div>
 *       <h1>{ctx.part(count)}</h1>
 *       <button onClick={() => setCount(c => c + 1)}>+</button>
 *     </div>
 *   );
 * });
 * ```
 *
 * @example Async initialization
 * ```tsx
 * export const UserProfile = rx(async ({ userId }, ctx) => {
 *   const user = await fetchUser(userId);
 *   const [getUser, setUser] = ctx.state(user);
 *
 *   return <h1>{ctx.part(() => getUser().name)}</h1>;
 * }, {
 *   loading: <div>Loading...</div>,
 *   error: (err) => <div>Error: {err.message}</div>
 * });
 * ```
 *
 * @example Composable logic
 * ```tsx
 * const useCounter = (ctx: RxContext, init: number) => {
 *   const [count, setCount] = ctx.state(init);
 *   return {
 *     count,
 *     increment: () => setCount(c => c + 1)
 *   };
 * };
 *
 * export const App = rx((props, ctx) => {
 *   const counter = ctx.use(useCounter, 0);
 *   return <button onClick={counter.increment}>{ctx.part(counter.count)}</button>;
 * });
 * ```
 *
 * @example Global store
 * ```tsx
 * import { rx, store } from 'rxasync';
 *
 * const appStore = store({ count: 0, theme: 'dark' });
 *
 * export const App = rx((props, ctx) => {
 *   const [count, setCount] = ctx.state(appStore, 'count');
 *   return <button onClick={() => setCount(c => c + 1)}>{ctx.part(count)}</button>;
 * });
 * ```
 *
 * @example Cleanup
 * ```tsx
 * export const WebSocketApp = rx(async (props, ctx) => {
 *   const ws = await openWebSocket();
 *   
 *   // Single cleanup
 *   ctx.on({ cleanup: () => ws.close() });
 *   
 *   // Multiple cleanups
 *   ctx.on({ cleanup: [
 *     () => ws.close(),
 *     () => console.log('Cleaned up')
 *   ]});
 *   
 *   return <div>Connected</div>;
 * });
 * ```
 */

// Export main factory function
export { rx } from "./rx";

// Export store creation
export { store } from "./store";

// Export all types
export type { RxContext, RxOptions, Logic, Store } from "./types";

