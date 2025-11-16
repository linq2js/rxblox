// Main entry point for rxblox

import { onMount, onUnmount, onRender } from "./eventDispatcher";
import { handle, type Handle } from "./handle";
import { asyncSignal, type AsyncSignalContext } from "./asyncSignal";
import { signal as createSignal } from "./signal";
import { blox as createBlox } from "./blox";
import { action as createAction } from "./action";
import { cancellableAction, aborter } from "./cancellableAction";
import { snapshot } from "./snapshot";
import { history } from "./history";
import { createRef } from "./ref";

export const blox = Object.assign(createBlox, {
  handle,
  onMount,
  onUnmount,
  onRender,
  ref: createRef,
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

export type { Handle, AsyncSignalContext };
export type { Action, ActionOptions, ActionEvents } from "./action";
export type { CancellableAction } from "./cancellableAction";
export type { HistoryEntry, HistoryOptions, HistoryQuery } from "./history";
export { disposable } from "./disposableDispatcher";
export * from "./types";
export { effect } from "./effect";
export { rx } from "./rx";
export { provider } from "./provider";
export { useTracked } from "./useTracked";
export type { Tracked } from "./useTracked";
export { useSignals } from "./useSignals";
export type { UseSignalsResult, UseSignalsOptions } from "./useSignals";
export { useAction } from "./useAction";
export * from "./loadable";
export { wait, type Awaitable } from "./wait";
export { diff } from "./diff";
export type { Persistor, PersistStatus, PersistInfo } from "./types";
export { type Emitter, emitter } from "./emitter";
export { tag } from "./tag";
export type { Tag } from "./tag";
export { batch } from "./batch";
export type { InferSignalValues } from "./batch";
