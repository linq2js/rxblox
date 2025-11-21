/**
 * Function type for use with proxies.
 */
export type AnyFunc = (...args: any[]) => any;

/**
 * Listener type for emitters
 */
export type Listener<T> = (value: T) => void;

/**
 * Subscribable interface for reactive values
 */
export type Subscribable = {
  on(listener: VoidFunction): VoidFunction;
};

/**
 * Observable interface combining Subscribable with a getter
 */
export type Observable<T> = Subscribable & {
  (): T;
};

/**
 * Disposable interface for cleanup
 */
export type Disposable = {
  dispose(): void;
};

/**
 * Signal type combining Observable, Subscribable, Disposable with setters
 */
export type Signal<T> = Subscribable &
  Disposable &
  Observable<T> & {
    readonly displayName?: string;

    get(): T;
    /**
     * set the signal value
     * @param value - the new value or a function that receives the previous value and returns the new value
     */
    set(value: T | ((prev: T) => T | void)): void;

    /**
     * Returns a setter function that captures the current state.
     * The returned function will only set the value if the state hasn't changed
     * since the setter was created (checked via reference equality).
     *
     * @returns A function that takes a value and returns true if set succeeded, false if cancelled
     */
    setIfUnchanged(): (value: T | ((prev: T) => T | void)) => boolean;

    /**
     * Reset the signal to its initial value
     */
    reset(): void;
  };

/**
 * Map of signal names to signal instances
 */
export type SignalMap = Record<string, Signal<any>>;

/**
 * Context provided to signal computation functions
 */
export type SignalContext<TDependencies extends SignalMap = {}> = {
  abortSignal: AbortSignal;
  deps: ResolveValue<TDependencies, "value">;
};

/**
 * Options for rx component
 */
export type RxOptions = {
  /**
   * Control when to re-render / re-create render function
   *
   * For `rx(render, options)`:
   * - Default (no watch): Never re-renders (static content)
   * - `watch: [deps]`: Re-renders when deps change
   *
   * For `rx(signals, render, options)`:
   * - Always re-renders when signals change
   * - `watch` memoizes the render function (like React useCallback deps)
   *
   * @example Overload 1: Manual control
   * ```tsx
   * // Static (never re-renders)
   * rx(() => <div>Static content</div>)
   *
   * // Re-render when deps change
   * rx(() => <div>{externalValue}</div>, { watch: [externalValue] })
   * ```
   *
   * @example Overload 2: Explicit signals
   * ```tsx
   * // Re-renders when user/posts change
   * // Render function memoized by watch
   * rx({ user, posts }, (awaited) => <div>{awaited.user.name}</div>, {
   *   watch: [formatFn] // Re-create render only when formatFn changes
   * })
   * ```
   */
  watch?: unknown[];
};

/**
 * Options for signal creation
 */
export type SignalOptions<T> = {
  equals?: (a: any, b: any) => boolean;
  name?: string;
  fallback?: (error: unknown) => T;
};

export type ResolveValueType = "awaited" | "loadable" | "value";

/**
 * Resolve signal values based on access type
 */
export type ResolveValue<
  TMap extends SignalMap,
  TType extends ResolveValueType
> = {
  readonly [K in keyof TMap]: TMap[K] extends () => infer T
    ? TType extends "awaited"
      ? Awaited<T>
      : TType extends "loadable"
      ? Loadable<Awaited<T>>
      : TType extends "value"
      ? T
      : never
    : never;
};

/**
 * Options for useScope hook
 */
export type UseScopeOptions<TScope> = {
  /**
   * Called when the component mounts/updates
   * Use this to sync disposables with latest props/state
   * @param scope - The scoped disposable objects
   */
  onUpdate?:
    | ((scope: TScope) => void)
    | [(scope: TScope) => void, ...unknown[]];

  /**
   * Called before component unmounts
   * Use this for cleanup before disposables are automatically disposed
   * @param scope - The scoped disposable objects
   */
  onDispose?: (scope: TScope) => void;

  /**
   * Watch these values - recreates scope when they change
   * Similar to React useEffect deps array
   *
   * @example
   * ```tsx
   * useScope(() => ({ timer: signal(0) }), {
   *   watch: [userId] // Recreate when userId changes
   * })
   * ```
   */
  watch?: unknown[];
};

/**
 * Internal symbol used to identify loadable objects at runtime.
 * This allows for reliable type checking without relying on duck typing.
 */
export const LOADABLE_TYPE = Symbol("LOADABLE_TYPE");

/**
 * Represents the status of an async operation.
 */
export type LoadableStatus = "loading" | "success" | "error";

/**
 * @deprecated Use LoadableStatus instead
 */
export type LoadableType = LoadableStatus;

/**
 * Represents an in-progress async operation.
 *
 * @property status - Always "loading"
 * @property promise - The underlying promise being awaited
 * @property data - Always undefined (no data yet)
 * @property error - Always undefined (no error yet)
 * @property loading - Always true
 *
 * @example
 * ```typescript
 * const loadingState: LoadingLoadable = {
 *   [LOADABLE_TYPE]: true,
 *   status: "loading",
 *   promise: fetchUser(1),
 *   value: undefined,
 *   error: undefined,
 *   loading: true,
 * };
 * ```
 */
export type LoadingLoadable<TValue> = {
  [LOADABLE_TYPE]: true;
  status: "loading";
  promise: PromiseLike<TValue>;
  value: undefined;
  error: undefined;
  loading: true;
};

/**
 * Represents a successfully completed async operation.
 *
 * @template TValue - The type of the successful result
 * @property status - Always "success"
 * @property promise - The resolved promise
 * @property value - The successful result data
 * @property error - Always undefined (no error)
 * @property loading - Always false
 *
 * @example
 * ```typescript
 * const successState: SuccessLoadable<User> = {
 *   [LOADABLE_TYPE]: true,
 *   status: "success",
 *   promise: Promise.resolve(user),
 *   value: { id: 1, name: "Alice" },
 *   error: undefined,
 *   loading: false,
 * };
 * ```
 */
export type SuccessLoadable<TValue> = {
  [LOADABLE_TYPE]: true;
  status: "success";
  promise: PromiseLike<TValue>;
  value: TValue;
  error: undefined;
  loading: false;
};

/**
 * Represents a failed async operation.
 *
 * @property status - Always "error"
 * @property promise - The rejected promise
 * @property value - Always undefined (no data)
 * @property error - The error that occurred
 * @property loading - Always false
 *
 * @example
 * ```typescript
 * const errorState: ErrorLoadable = {
 *   [LOADABLE_TYPE]: true,
 *   status: "error",
 *   promise: Promise.reject(new Error("Failed")),
 *   value: undefined,
 *   error: new Error("Failed"),
 *   loading: false,
 * };
 * ```
 */
export type ErrorLoadable<TValue> = {
  [LOADABLE_TYPE]: true;
  status: "error";
  promise: PromiseLike<TValue>;
  value: undefined;
  error: unknown;
  loading: false;
};

/**
 * A discriminated union representing all possible states of an async operation.
 *
 * A Loadable encapsulates the three states of async data:
 * - `LoadingLoadable`: Operation in progress
 * - `SuccessLoadable<T>`: Operation completed successfully with data
 * - `ErrorLoadable`: Operation failed with error
 *
 * Each loadable maintains a reference to the underlying promise, allowing
 * integration with React Suspense and other promise-based systems.
 *
 * @template T - The type of data when operation succeeds
 *
 * @example
 * ```typescript
 * // Type-safe pattern matching
 * function renderLoadable<T>(loadable: Loadable<T>) {
 *   switch (loadable.status) {
 *     case "loading":
 *       return <Spinner />;
 *     case "success":
 *       return <div>{loadable.value}</div>; // TypeScript knows data exists
 *     case "error":
 *       return <Error error={loadable.error} />; // TypeScript knows error exists
 *   }
 * }
 * ```
 */
export type Loadable<T> =
  | LoadingLoadable<T>
  | SuccessLoadable<T>
  | ErrorLoadable<T>;
