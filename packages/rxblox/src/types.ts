import { FC, ReactNode } from "react";

/**
 * Function type for explicit dependency tracking in async contexts.
 *
 * `TrackFunction` creates a lazy tracking proxy that enables fine-grained
 * dependency management by deferring signal subscription until properties
 * are accessed. This solves the problem of losing tracking context after
 * `await` statements in async functions.
 *
 * **Key characteristics:**
 * - Accepts an object where values are functions (signals or computed properties)
 * - Returns a proxy that tracks dependencies lazily
 * - Maintains tracking context across `await` boundaries
 * - Supports conditional tracking for performance optimization
 * - Fully type-safe with automatic inference
 *
 * @template TTrackable - Object type mapping property names to functions
 * @param signals - Object where each value is a function to track
 * @returns Proxy object that executes functions with tracking when accessed
 *
 * @example
 * ```ts
 * // In signal.async
 * const data = signal.async(async ({ track }) => {
 *   const tracked = track({ userId, filter });
 *
 *   await delay(100);
 *
 *   return fetchData(tracked.userId, tracked.filter);
 * });
 * ```
 *
 * @example
 * ```ts
 * // In effect with custom computed
 * effect(({ track }) => {
 *   const tracked = track({
 *     count: signal(5),
 *     doubled: () => count() * 2,
 *   });
 *
 *   console.log(tracked.doubled); // Tracks count
 * });
 * ```
 *
 * @see {@link TrackingDispatcher.track} for implementation details
 */
export type TrackFunction = <TTrackable extends Record<string, () => unknown>>(
  signals: TTrackable
) => {
  [k in keyof TTrackable]: TTrackable[k] extends () => infer T ? T : never;
};

/**
 * Type definitions for rxblox - a reactive state management library for React.
 *
 * This module contains all the core type definitions used throughout the library.
 */

/**
 * A signal represents a reactive value that can be read and optionally written to.
 *
 * Signals are the core reactive primitive in rxblox. They:
 * - Hold a value that can be read synchronously
 * - Notify listeners when the value changes
 * - Can be tracked as dependencies in computed signals and effects
 * - Support both read-only and mutable variants
 *
 * @template T - The type of value stored in the signal
 */
export type Signal<T> = {
  /**
   * Reads the current signal value.
   * If called within a computed signal or effect context, registers this signal
   * as a dependency for automatic re-computation.
   *
   * @returns The current signal value
   */
  (): T;

  /**
   * Reads the current signal value with tracking it as a dependency.
   * This getter is used for exposing API to read signal value only
   * @example
   * ```ts
   * const count = signal(0);
   * const value = signal.get();
   * const api = {
   *   getCount: count.get, // it better than assign count signal directly to the api object
   * }
   * ```
   */
  get(): T;

  /**
   * Reads the current signal value without tracking it as a dependency.
   * Useful when you want to read a signal without creating a reactive dependency.
   *
   * @returns The current signal value
   */
  peek(): T;
  /**
   * Subscribes to changes in the signal value.
   * The listener will be called whenever the signal value changes.
   *
   * @param listener - Function to call when the signal value changes
   * @returns An unsubscribe function to remove the listener
   */
  on(listener: (value: T) => void): VoidFunction;

  /**
   * Returns the current signal value as a JSON-serializable value.
   * @returns The current signal value as a JSON-serializable value
   */
  toJSON(): T;

  readonly displayName?: string;
};

/**
 * A listener function that receives a value when an event is emitted.
 *
 * Used by emitters and signals to notify subscribers of changes.
 *
 * @template T - The type of value that will be passed to the listener
 */
export type Listener<T> = (value: T) => void;

/**
 * A mutable signal extends Signal with the ability to set/update its value.
 */
export type MutableSignal<T> = Signal<T> & {
  /**
   * Sets the current signal value or updates it using a function.
   * @param value - The new value or a function that receives the previous value
   */
  set(value: T | ((prev: T) => T | void)): void;
  /**
   * Resets the current signal value to the initial value.
   */
  reset(): void;

  /**
   * Hydrates the signal value from storage.
   * Do nothing if no persistor is provided.
   * @see Persistor
   */
  hydrate(): void;

  /**
   * Casts the current signal to a readonly signal, preventing consumers from calling mutation methods
   * @returns A readonly signal that prevents consumers from calling mutation methods
   */
  readonly readonly: Signal<T>;
};

/**
 * Dispatcher for managing reactive effects.
 *
 * Effect dispatchers control when and how effects are executed. They can:
 * - Run effects immediately (default dispatcher)
 * - Collect effects for later execution (used by `blox` components)
 * - Provide cleanup functions to stop all effects
 *
 * This abstraction allows effects to work differently in different contexts,
 * enabling optimizations like batching effect execution in components.
 */
export type EffectDispatcher = {
  /**
   * Adds an effect to the dispatcher.
   * The behavior depends on the dispatcher implementation:
   * - Default dispatcher: Runs the effect immediately
   * - Collection dispatcher: Stores the effect for later execution
   *
   * @param effect - The effect to add
   * @returns A cleanup function that removes/stops the effect
   */
  add(effect: Effect): VoidFunction;
  /**
   * Runs all effects managed by this dispatcher.
   * For collection dispatchers, this executes all collected effects.
   * For default dispatcher, this is a no-op (effects already ran).
   *
   * @returns A cleanup function that stops all effects
   */
  run(): VoidFunction;
  /**
   * Clears all effects from the dispatcher.
   * Does not stop already-running effects - use `run()`'s return value for that.
   */
  clear(): void;
};

/**
 * Represents a reactive effect that can be stopped.
 *
 * Effects are created by the `effect()` function and automatically re-run
 * when their signal dependencies change. They can return cleanup functions
 * that run before the next execution or when the effect is stopped.
 */
export type Effect = {
  /**
   * Runs the effect.
   *
   * Executes the effect function, tracks signal dependencies, and subscribes
   * to changes. Returns a cleanup function that stops the effect and runs
   * any registered cleanup functions.
   *
   * @returns A cleanup function that stops the effect
   */
  run(): VoidFunction;
};

/**
 * Ref type for component refs in `blox` components.
 *
 * Refs provide imperative access to component state and methods.
 * They work like React's refs but integrate with `blox`'s reactive system.
 *
 * @template T - The type of value stored in the ref
 */
export type Ref<T> = {
  /**
   * Sets the current value of the ref.
   * @param value - The value to set
   */
  (value: T): void;
};

/**
 * Persistor interface for signal storage.
 *
 * Persistors provide a minimal I/O interface for reading and writing signal values
 * to persistent storage. They throw errors on failure, and the signal handles
 * error tracking and status management.
 *
 * @template T - The type of value being persisted
 */
export interface Persistor<T = any> {
  /**
   * Retrieves the persisted value from storage.
   *
   * This method is optional because some persistors may only handle writes
   * (e.g., when the signal value is hydrated from another source).
   *
   * @returns Object with `value` property if found, `null` if no value stored, or a Promise resolving to either
   * @throws Error if read operation fails
   */
  get?(): { value: T } | null | Promise<{ value: T } | null>;

  /**
   * Saves a value to persistent storage.
   *
   * This method is optional because some persistors may only handle reads
   * (e.g., when the signal value is saved to another source).
   *
   * @param value - The value to persist
   * @throws Error if write operation fails
   */
  set?(value: T): void | Promise<void>;

  /**
   * Optional: Subscribe to external storage changes (e.g., from other tabs).
   *
   * @param callback - Function to call when storage changes externally
   * @returns Unsubscribe function
   */
  on?(callback: VoidFunction): VoidFunction;
}

/**
 * Status of persistence operations for a signal.
 */
export type PersistStatus =
  | "idle" // No persist operation yet
  | "reading" // Currently loading from storage
  | "read-failed" // Failed to load (get() threw)
  | "writing" // Currently saving to storage
  | "write-failed" // Failed to save (set() threw)
  | "synced"; // Value is up-to-date with storage

/**
 * Persistence information tracked by a signal.
 */
export type PersistInfo = {
  /** Current persistence status */
  status: PersistStatus;
  /** Last error from read or write operation (present when status is *-failed) */
  error?: unknown;

  /** Promise that resolves when the current persistence operation completes */
  promise?: Promise<unknown>;
};

/**
 * Function type for the `rx()` function that creates reactive expressions.
 *
 * `rx()` wraps an expression function and returns a React component that
 * automatically re-renders when signal dependencies change.
 */
export type RxFunction = (exp: () => unknown) => ReactNode;

/**
 * Function type for the `blox()` function that creates reactive components.
 *
 * `blox()` creates a React component that treats props as signals and
 * manages effects automatically.
 *
 * @template TProps - The props type for the component
 * @template TRef - The ref type for imperative access (optional)
 */
export type BloxFunction = <TProps extends object = {}, TRef = unknown>(
  render: (props: Readonly<TProps>, ref: Ref<TRef>) => ReactNode
) => FC<TProps>;

/**
 * Function type for creating a signal.
 *
 * This is the type signature of the `signal()` function.
 */
export type SignalFactory = <T>(value: T | (() => T)) => MutableSignal<T>;

/**
 * Function type for creating an effect.
 *
 * This is the type signature of the `effect()` function.
 */
export type EffectFactory = (fn: () => void | VoidFunction) => Effect;

export type Subscribable<T = unknown> = {
  on(listener: (value: T) => void): VoidFunction;
};

/**
 * Dispatcher for tracking dependencies during expression evaluation.
 *
 * Tracking dispatchers are used internally to track which subscribables (signals, etc.)
 * are accessed during the execution of computed signals, effects, or reactive expressions.
 * This enables automatic dependency tracking and reactive updates.
 *
 * The dispatcher uses a minimal `Subscribable` interface, requiring only an `on()` method
 * for subscription, making it flexible and decoupled from the full Signal API.
 */
export type TrackingDispatcher = {
  /**
   * Adds a subscribable to the dispatcher's tracking set.
   * Called automatically when a subscribable is accessed within a tracking context.
   *
   * @param subscribable - The subscribable to track (signals, computed values, etc.)
   * @returns True if added, false if already tracked
   */
  add(subscribable: Subscribable): boolean;

  /**
   * Gets all subscribables that have been tracked.
   * Returns a readonly array to prevent external modification.
   *
   * @returns A readonly array of all tracked subscribables
   */
  get subscribables(): readonly Subscribable[];

  /**
   * Clears all tracked subscribables from the dispatcher.
   * Used to reset the dispatcher before tracking a new set of dependencies.
   */
  clear(): void;

  /**
   * Creates a proxy for explicit dependency tracking.
   * Enables lazy tracking with full type safety.
   */
  track: TrackFunction;
};
