/**
 * Immer integration for rextive
 *
 * This module provides utilities for working with Immer in rextive signals.
 * Requires `immer` as a peer dependency.
 *
 * @example
 * ```ts
 * import { signal } from 'rextive';
 * import { produce } from 'rextive/immer';
 *
 * const state = signal({ count: 0, todos: [] });
 *
 * state.set(produce(draft => {
 *   draft.count++;
 *   draft.todos.push({ id: 1, text: 'Learn Immer' });
 * }));
 * ```
 */

export { produce } from "./produce";
