// Re-export all types
export type {
  Listener,
  Subscribable,
  Observable,
  Disposable,
  Signal,
  SignalMap,
  SignalContext,
  RxOptions,
  SignalOptions,
  ResolveValue,
  UseScopeOptions,
  LoadableStatus,
  LoadableType,
  LoadingLoadable,
  SuccessLoadable,
  ErrorLoadable,
  Loadable,
} from "./types";

// Re-export persist types
export type {
  PersistorStatus,
  PersistSignalsOptions,
  PersistSignalsResult,
} from "./persistSignals";

// Re-export LOADABLE_TYPE constant
export { LOADABLE_TYPE } from "./types";

// Export implementations
export { rx } from "./rx";
export { useScope } from "./useScope";
export { useSignals } from "./useSignals";

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

// Utilities
export { emitter } from "./utils/emitter";
export type { Emitter } from "./utils/emitter";
export { useUnmount } from "./useUnmount";
export { useRerender } from "./useRerender";
export type { RerenderOptions, RerenderFunction } from "./useRerender";
export {
  loadable,
  isLoadable,
  getLoadable,
  setLoadable,
} from "./utils/loadable";
export { isPromiseLike } from "./utils/isPromiseLike";
export { createProxy } from "./utils/createProxy";
export type { ProxyOptions } from "./utils/createProxy";
export { shallowEquals } from "./utils/shallowEquals";
export { devLog, devWarn, devError, devOnly, devAssert } from "./utils/dev";
export { wait, type Awaitable } from "./wait";
