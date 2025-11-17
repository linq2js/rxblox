/**
 * Unified dispatcher system for rxblox.
 *
 * This module provides a type-safe dispatcher system where dispatchers are
 * identified by `DispatcherToken<T>` objects that create entries with values.
 *
 * The system uses symbols internally for identity but provides a typed API
 * through dispatcher tokens and entries.
 */

/**
 * Special symbol used to indicate a dispatcher should be removed/disabled.
 * Used internally when `token()` is called without arguments.
 */
const REMOVE_DISPATCHER = Symbol("removeDispatcher");

/**
 * All possible context types in rxblox.
 * Each context type represents a different execution scope.
 */
export type ContextType =
  | "blox"
  | "effect"
  | "slot"
  | "signal"
  | "batch"
  | "rx";

/**
 * Options for withDispatchers function.
 */
export interface WithDispatchersOptions {
  /**
   * The type of context/scope being created.
   * Can be retrieved via getContextType().
   */
  contextType?: ContextType;
  // Future options can be added here
}

/**
 * Internal structure for storing dispatcher state and metadata.
 */
interface DispatcherContext {
  /** Map of dispatcher tokens to their values */
  dispatchers: Record<symbol, unknown>;
  /** The type of context/scope */
  contextType?: ContextType;
}

/**
 * Global registry of current dispatcher context.
 * Contains both dispatchers and metadata about the current scope.
 */
let current: DispatcherContext | undefined;

/**
 * A dispatcher token identifies a specific kind of dispatcher and can create entries.
 *
 * It's both:
 * - A callable function that creates entries: `token(value)`
 * - An object with a `key` property for the internal symbol
 *
 * @template T - The type of value this dispatcher holds
 */
export type DispatcherToken<T> = {
  /** Internal symbol key used to identify this dispatcher token */
  key: symbol;
  /** Creates an entry with a value for this dispatcher token */
  (value: T | undefined): DispatcherEntry<T>;
  // disable dispatcher of this token
  (): DispatcherEntry<T>;

  /**
   * Shortcut for withDispatchers([token(dispatcher)], fn, options)
   * Executes a function with this dispatcher active.
   *
   * @param dispatcher - The dispatcher instance to use
   * @param fn - The function to execute with the dispatcher
   * @param options - Optional configuration (e.g., contextType)
   * @returns The return value of the function
   */
  with<R>(dispatcher: T, fn: () => R, options?: WithDispatchersOptions): R;

  /**
   * Shortcut for withDispatchers([token()], fn, options)
   * Executes a function with this dispatcher removed/disabled.
   *
   * @param fn - The function to execute without the dispatcher
   * @param options - Optional configuration (e.g., contextType)
   * @returns The return value of the function
   */
  without<R>(fn: () => R, options?: WithDispatchersOptions): R;
};

/**
 * An entry associates a dispatcher token's key with a value.
 *
 * Entries are created by calling a dispatcher token as a function and
 * are passed to `withDispatchers()` to set dispatcher values.
 *
 * @template T - The type of value in this entry
 */
export type DispatcherEntry<T> = {
  /** Symbol key identifying the dispatcher token */
  key: symbol;
  /**
   * The value for this dispatcher:
   * - T: Set to this value
   * - undefined: Skip (keep existing from parent)
   * - REMOVE_DISPATCHER symbol: Remove/disable this dispatcher
   */
  value: T | typeof REMOVE_DISPATCHER | undefined;
};

/**
 * Creates a new dispatcher token with the given name.
 *
 * A dispatcher token can be used to:
 * 1. Create entries: `token(value)` returns `{ key, value }`
 * 2. Retrieve values: `getDispatcher(token)` returns the current value
 * 3. Disable dispatcher: `token()` returns `{ key, value: null }` (removes from context)
 * 4. Shortcut methods: `token.with(dispatcher, fn)` and `token.without(fn)`
 *
 * @template T - The type of value this dispatcher will hold
 * @param name - Human-readable name for the dispatcher (used for the symbol)
 * @returns A dispatcher token that can create entries and retrieve values
 *
 * @example
 * ```ts
 * // Define a dispatcher token
 * const myToken = dispatcherToken<MyDispatcher>("myDispatcher");
 *
 * // Create an entry with a value
 * const entry = myToken(myDispatcherInstance);
 *
 * // Use in withDispatchers
 * withDispatchers([entry], () => {
 *   // Inside here, getDispatcher(myToken) returns myDispatcherInstance
 * });
 * ```
 *
 * @example
 * ```ts
 * // Shortcut: token.with() for single dispatcher
 * const result = myToken.with(myDispatcherInstance, () => {
 *   // Inside here, getDispatcher(myToken) returns myDispatcherInstance
 *   return someValue;
 * });
 * ```
 *
 * @example
 * ```ts
 * // Shortcut: token.without() to disable a dispatcher
 * trackingToken.without(() => {
 *   // Inside here, getDispatcher(trackingToken) returns undefined
 *   // Signal tracking is disabled
 * });
 * ```
 *
 * @example
 * ```ts
 * // Disable/remove a dispatcher
 * withDispatchers([trackingToken()], () => {
 *   // Inside here, getDispatcher(trackingToken) returns undefined
 *   // Signal tracking is disabled
 * });
 * ```
 *
 * @example
 * ```ts
 * // Keep existing dispatcher (skip)
 * withDispatchers([trackingToken(undefined)], () => {
 *   // Keeps parent context's tracking dispatcher
 * });
 * ```
 */
export function dispatcherToken<T>(name: string): DispatcherToken<T> {
  const key = Symbol(name);

  function createEntry(value?: T): DispatcherEntry<T> {
    // overload: token() disables/removes dispatcher of this token
    if (!arguments.length) {
      return { key, value: REMOVE_DISPATCHER as any };
    }

    return {
      key,
      value,
    };
  }

  return Object.assign(createEntry, {
    key,
    with<R>(dispatcher: T, fn: () => R, options?: WithDispatchersOptions): R {
      return withDispatchers([createEntry(dispatcher)], fn, options);
    },
    without<R>(fn: () => R, options?: WithDispatchersOptions): R {
      return withDispatchers([createEntry()], fn, options);
    },
  });
}

/**
 * Gets the current value of a dispatcher by its token.
 *
 * Returns the dispatcher value that was set by the most recent `withDispatchers()` call
 * for this dispatcher token, or `undefined` if no value is currently set.
 *
 * @template T - The type of the dispatcher value
 * @param token - The dispatcher token to retrieve
 * @returns The current dispatcher value, or undefined if not set
 *
 * @example
 * ```ts
 * const trackingToken = dispatcherToken<SignalDispatcher>("trackingDispatcher");
 *
 * const dispatcher = getDispatcher(trackingToken);
 * if (dispatcher) {
 *   dispatcher.add(someSignal);
 * }
 * ```
 */
export function getDispatcher<T>(token: DispatcherToken<T>): T | undefined {
  return current?.dispatchers[token.key] as T | undefined;
}

/**
 * Gets the current context type (scope type).
 *
 * Returns the contextType that was set by the most recent `withDispatchers()` call,
 * or `undefined` if no context type is set.
 *
 * @returns The current context type, or undefined
 *
 * @example
 * ```ts
 * function someAPI() {
 *   const contextType = getContextType();
 *   if (contextType !== "blox") {
 *     throw new Error("This API must be called inside a blox component");
 *   }
 * }
 * ```
 */
export function getContextType(): ContextType | undefined {
  return current?.contextType;
}

/**
 * Executes a function with a different context type while preserving all dispatchers.
 *
 * This is useful for internal operations that need to bypass context validation
 * (e.g., creating prop signals inside blox, creating provider signals internally)
 * without affecting the dispatcher state.
 *
 * @template T - The return type of the function
 * @param contextType - The context type to set (or undefined to clear)
 * @param fn - The function to execute with the new context type
 * @returns The return value of the function
 *
 * @example
 * ```ts
 * // Create a signal with "signal" context to bypass "rx" validation
 * const propSignal = withContextType("signal", () => signal(initialValue));
 * ```
 */
export function withContextType<T>(
  contextType: ContextType | undefined,
  fn: () => T
): T {
  const prev = current;

  // Keep all dispatchers, only change contextType
  current = {
    dispatchers: prev?.dispatchers ?? {},
    contextType,
  };

  try {
    return fn();
  } finally {
    // Always restore previous state
    current = prev;
  }
}

/**
 * Executes a function with dispatchers applied to the current context.
 *
 * This function:
 * 1. Merges the provided dispatcher entries with any existing dispatchers
 * 2. Sets metadata (like contextType) for the scope
 * 3. Executes the function with the merged dispatcher context
 * 4. Restores the previous dispatcher state
 *
 * **Entry value behavior**:
 * - `token(value)`: Sets the dispatcher to `value`
 * - `token(undefined)`: Skips (keeps existing dispatcher from parent context)
 * - `token()`: Explicitly removes/disables this dispatcher (sets to `null` then removes)
 *
 * **Entry behavior**:
 * - Multiple entries can be provided as an array
 * - Inner `withDispatchers` calls override outer ones for the same dispatcher tokens
 * - Previous dispatcher values are preserved if not overridden
 *
 * **Options behavior**:
 * - `contextType`: Sets the scope type (e.g., "blox", "effect", "slot")
 * - Inner `withDispatchers` calls override the outer contextType
 *
 * @template T - The return type of the function
 * @param dispatchers - A single entry or array of entries to apply
 * @param fn - The function to execute within the dispatcher context
 * @param options - Optional settings for the dispatcher context
 * @returns The return value of the function
 *
 * @example
 * ```ts
 * import { trackingToken, effectToken } from "./dispatchers";
 *
 * const result = withDispatchers(
 *   [
 *     trackingToken(myTrackingDispatcher),
 *     effectToken(myEffectDispatcher),
 *   ],
 *   () => {
 *     // Function body - dispatchers are active here
 *     // getDispatcher(trackingToken) returns myTrackingDispatcher
 *     return someComputation();
 *   },
 *   { contextType: "blox" }
 * );
 * ```
 *
 * @example
 * ```ts
 * // Single entry with contextType
 * withDispatchers(
 *   trackingToken(dispatcher),
 *   () => {
 *     // getContextType() returns "effect"
 *   },
 *   { contextType: "effect" }
 * );
 *
 * // Skip undefined values
 * withDispatchers(
 *   [
 *     trackingToken(dispatcher),
 *     providerToken(undefined), // This entry is skipped
 *   ],
 *   () => { }
 * );
 * ```
 */
export function withDispatchers<T>(
  dispatchers: DispatcherEntry<unknown>[] | DispatcherEntry<unknown>,
  fn: () => T,
  options?: WithDispatchersOptions
): T {
  const prev = current;

  // Normalize to array and reduce to build new dispatcher map
  const newDispatchers = (
    Array.isArray(dispatchers) ? dispatchers : [dispatchers]
  ).reduce(
    (accumulated, entry) => {
      // Skip entries with undefined values (keeps existing value)
      if (typeof entry.value === "undefined") {
        return accumulated;
      }

      // REMOVE_DISPATCHER symbol means explicitly remove/disable this dispatcher
      if (entry.value === REMOVE_DISPATCHER) {
        const { [entry.key]: removed, ...rest } = accumulated;
        return rest;
      }

      // Merge entry into accumulated dispatchers
      return {
        ...accumulated,
        [entry.key]: entry.value,
      };
    },
    prev?.dispatchers ?? {} // Start with previous dispatchers (enables nesting)
  );

  // Build new context with dispatchers and metadata
  // Check if contextType is explicitly provided (even if undefined) vs not provided at all
  const hasContextType = options !== undefined && "contextType" in options;
  current = {
    dispatchers: newDispatchers,
    contextType: hasContextType ? options.contextType : prev?.contextType,
  };

  try {
    return fn();
  } finally {
    // Always restore previous dispatcher state
    current = prev;
  }
}
