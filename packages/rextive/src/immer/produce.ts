import { produce as produceImmer } from "immer";

/**
 * Creates a produce function that uses Immer to update a signal immutably.
 * This allows you to write "mutating" update logic that is actually immutable.
 *
 * Requires `immer` to be installed as a peer dependency.
 *
 * @param updater - Function that receives a draft of the signal's value and mutates it
 * @returns A reducer function compatible with signal.set()
 *
 * @example Basic usage
 * ```ts
 * import { signal } from 'rextive';
 * import { produce } from 'rextive/immer';
 *
 * const state = signal({ count: 0, user: { name: 'John' } });
 *
 * // Update using produce
 * state.set(produce(draft => {
 *   draft.count++;
 *   draft.user.name = 'Jane';
 * }));
 * ```
 *
 * @example With arrays
 * ```ts
 * const todos = signal([
 *   { id: 1, text: 'Learn React', done: false },
 *   { id: 2, text: 'Learn Immer', done: false }
 * ]);
 *
 * // Toggle first todo
 * todos.set(produce(draft => {
 *   draft[0].done = !draft[0].done;
 * }));
 *
 * // Add new todo
 * todos.set(produce(draft => {
 *   draft.push({ id: 3, text: 'Build app', done: false });
 * }));
 * ```
 *
 * @example Nested updates
 * ```ts
 * const app = signal({
 *   user: { name: 'John', settings: { theme: 'dark' } },
 *   posts: []
 * });
 *
 * app.set(produce(draft => {
 *   draft.user.settings.theme = 'light';
 *   draft.posts.push({ id: 1, title: 'Hello' });
 * }));
 * ```
 */
export function produce<T>(updater: (draft: T) => void): (prev: T) => T {
  return (prev: T): T => {
    return produceImmer(prev, updater);
  };
}
