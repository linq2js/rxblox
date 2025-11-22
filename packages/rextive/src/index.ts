/**
 * Rextive - Core reactive state management library
 *
 * This module exports the core primitives for reactive state management
 * without React dependencies. For React hooks and components, use 'rextive/react'.
 *
 * @example Core usage (no React)
 * ```ts
 * import { signal, batch, wait } from 'rextive';
 *
 * const count = signal(0);
 * const doubled = signal({ count }, ({ deps }) => deps.count * 2);
 *
 * count.on(() => console.log('Count changed:', count()));
 * count.set(5);
 * ```
 *
 * @example React usage
 * ```tsx
 * import { signal } from 'rextive';
 * import { rx, useScope } from 'rextive/react';
 *
 * const count = signal(0);
 *
 * function Counter() {
 *   return rx({ count }, (awaited) => <div>{awaited.count}</div>);
 * }
 * ```
 */

// Re-export core types only (no React types)
export type {
  Listener,
  Subscribable,
  Observable,
  Disposable,
  Signal,
  SignalMap,
  SignalContext,
  SignalOptions,
  ResolveValue,
  LoadableStatus,
  LoadableType,
  LoadingLoadable,
  SuccessLoadable,
  ErrorLoadable,
  Loadable,
  AnyFunc,
  HydrateStatus,
} from "./types";

// Re-export persist types
export type {
  PersistorStatus,
  PersistSignalsOptions,
  PersistSignalsResult,
} from "./persistSignals";

// Re-export LOADABLE_TYPE constant
export { LOADABLE_TYPE } from "./types";

// Import signal and utilities, combine them, then export
import { signal as signalBase, isSignal } from "./signal";
import { persistSignals as persistSignalsImpl } from "./persistSignals";
import { batch as batchImpl } from "./batch";
import { tag as tagImpl } from "./tag";

// Augment signal with utility methods
export const signal = Object.assign(signalBase, {
  persist: persistSignalsImpl,
  batch: batchImpl,
  tag: tagImpl,
});

export { isSignal };

// Core utilities (no React)
export { emitter } from "./utils/emitter";
export type { Emitter } from "./utils/emitter";
export {
  loadable,
  isLoadable,
  getLoadable,
  setLoadable,
  toLoadable,
} from "./utils/loadable";
export { isPromiseLike } from "./utils/isPromiseLike";
export { createProxy } from "./utils/createProxy";
export type { ProxyOptions } from "./utils/createProxy";
export { shallowEquals } from "./utils/shallowEquals";
export { devLog, devWarn, devError, devOnly, devAssert } from "./utils/dev";
export { wait, type Awaitable } from "./wait";

// Disposable utilities
export { disposable, DisposalAggregateError } from "./disposable";
export type {
  PropertyMergeStrategy,
  CombineDisposablesOptions,
} from "./disposable";
