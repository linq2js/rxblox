// Main entry point for rxblox

import { onEvent } from "./eventDispatcher";
import { hook } from "./hook";
import { asyncSignal, type AsyncSignalContext } from "./asyncSignal";
import { signal as createSignal } from "./signal";
import { blox as createBlox } from "./blox";
import { action as createAction } from "./action";
import { cancellableAction, aborter } from "./cancellableAction";
import { snapshot } from "./snapshot";
import { history } from "./history";
import { ref as createRef, ready as readyMultiple } from "./ref";
import { slot, fill } from "./slot";

export const blox = Object.assign(createBlox, {
  hook,
  onEvent,
  on: onEvent, // Alias for onEvent
  slot,
  fill,
});

export const ref = Object.assign(createRef, {
  ready: readyMultiple,
});

export const signal = Object.assign(createSignal, {
  async: asyncSignal,
  snapshot,
  history,
});

export const action = Object.assign(createAction, {
  cancellable: cancellableAction,
  aborter,
});

export type { AsyncSignalContext };
export type { BloxRef } from "./ref";
export type { Action, ActionOptions, ActionEvents } from "./action";
export type { CancellableAction } from "./cancellableAction";
export type { HistoryEntry, HistoryOptions, HistoryQuery } from "./history";
export { disposable } from "./disposableDispatcher";
export { FallbackError } from "./signal";
export { selector } from "./selector";
export * from "./types";
export { effect } from "./effect";
export { rx } from "./rx";
export { onEvent } from "./eventDispatcher";
export { provider } from "./provider";
export { useTracked } from "./useTracked";
export type { Tracked } from "./useTracked";
export { useSignals } from "./useSignals";
export type { UseSignalsResult, UseSignalsOptions } from "./useSignals";
export { useAction } from "./useAction";
export * from "./loadable";
export { wait, TimeoutError, type Awaitable } from "./wait";
export { diff } from "./diff";
export type { Persistor, PersistStatus, PersistInfo } from "./types";
export { type Emitter, emitter } from "./emitter";
export { tag } from "./tag";
export type { Tag } from "./tag";
export { batch } from "./batch";
export type { InferSignalValues } from "./batch";
export type { SlotOptions, SlotMode } from "./slot";
export { pool } from "./pool";
export type { PoolFunction, PoolOptions } from "./pool";
export { defer } from "./defer";

// Dispatcher system
export { getContextType, withContextType } from "./dispatcher";
export type { ContextType } from "./dispatcher";

// Development utilities
export { devLog, devWarn, devError, devOnly, devAssert } from "./utils/dev";
export { syncOnly } from "./utils/syncOnly";
export type { SyncOnlyOptions } from "./utils/syncOnly";
export { shallowEquals } from "./utils/shallowEquals";
export {
  objectKeyedCollection,
  type ObjectKeyedCollection,
} from "./utils/objectKeyedCollection";

// Proxy utilities
export { createProxy } from "./utils/proxy/createProxy";
export type { ProxyOptions, AnyFunc } from "./utils/proxy/createProxy";
