import type { ReactNode } from "react";

/**
 * Context provided to async component render function and logic functions.
 * Contains all APIs for state management, reactivity, hooks, and composition.
 */
export interface RxContext {
  /**
   * Creates local reactive state (overload 1)
   * @param initialValue Initial state value
   * @returns Tuple of [getter, setter]
   */
  state<T>(
    initialValue: T
  ): [get: () => T, set: (value: T | ((prev: T) => T)) => void];

  /**
   * Binds to global store property (overload 2)
   * @param store Store instance
   * @param key Property key to bind
   * @returns Tuple of [getter, setter]
   */
  state<TStore, TKey extends keyof TStore>(
    store: Store<TStore>,
    key: TKey
  ): [
    get: () => TStore[TKey],
    set: (
      value: TStore[TKey] | ((prev: TStore[TKey]) => TStore[TKey])
    ) => void
  ];

  /**
   * Wraps React hooks with reactivity tracking.
   * The hook re-executes when any tracked state changes.
   * Can be used conditionally (safe from Rules of Hooks violations).
   *
   * @param renderHook Function that calls React hooks
   * @returns Ref object with return value (undefined if conditional hook not executed)
   */
  hook<T>(renderHook: () => T): { current: T | undefined };

  /**
   * Creates a fine-grained reactive part of the component.
   * Only this part re-renders when tracked state changes.
   *
   * @param renderPart Function that returns ReactNode, or getter function
   * @returns ReactNode to render
   */
  part(renderPart: (() => ReactNode) | (() => any)): ReactNode;

  /**
   * Lifecycle and event management.
   * Currently supports cleanup registration.
   * Extensible for future lifecycle hooks.
   *
   * @param options Lifecycle options
   * @param options.cleanup Cleanup function(s) to execute on unmount
   */
  on(options: { cleanup?: VoidFunction | VoidFunction[] }): void;

  /**
   * Composes reusable logic (similar to custom hooks but more powerful).
   * Logic can call other logic recursively.
   *
   * @param logic Logic function to execute
   * @param params Parameters to pass to logic
   * @returns Return value from logic
   */
  use<TLogic extends Logic<any[], any>>(
    logic: TLogic,
    ...params: Parameters<TLogic> extends [RxContext, ...infer P] ? P : never
  ): ReturnType<TLogic>;
}

/**
 * Void function type for callbacks
 */
export type VoidFunction = () => void;

/**
 * Options for rx() factory function
 */
export interface RxOptions {
  /**
   * Component to render while async setup is pending.
   * If omitted, renders null during loading.
   */
  loading?: ReactNode;

  /**
   * Function that renders error UI when async setup throws.
   * If omitted, error bubbles to nearest React ErrorBoundary.
   */
  error?: (error: Error) => ReactNode;
}

/**
 * Reusable logic function signature.
 * Similar to custom hooks but receives RxContext explicitly.
 *
 * @template TParams Parameter types (excluding context)
 * @template TReturn Return type
 */
export type Logic<TParams extends any[], TReturn> = (
  context: RxContext,
  ...params: TParams
) => TReturn;

/**
 * Global store type.
 * Stores are shared across all components that bind to them.
 */
export interface Store<T extends Record<string, any>> {
  /** Internal store implementation */
  readonly __brand: "Store";
  readonly __data: T;
}

/**
 * Internal signal type for reactivity tracking
 */
export interface Signal<T> {
  (): T;
  set(value: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

/**
 * Internal types for tracking
 */
export interface TrackedDependency {
  signal: Signal<any>;
  unsubscribe: () => void;
}

/**
 * Internal context state during component lifecycle
 */
export interface ComponentState {
  status: "pending" | "ready" | "error";
  error?: Error;
  result?: ReactNode;
  hooks: HookCollector[];
  states: Signal<any>[];
  cleanupCallbacks: VoidFunction[];
  setupPromise?: Promise<void>;
}

/**
 * Hook collector for safe conditional hooks
 */
export interface HookCollector {
  fn: () => any;
  tracked: TrackedDependency[];
  result: any;
}

