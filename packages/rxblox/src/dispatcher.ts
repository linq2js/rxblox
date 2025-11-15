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
 * Global registry of current dispatchers.
 * Maps symbol keys to their corresponding dispatcher instances.
 */
let current: Record<symbol, unknown> | undefined;

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
  /** The value for this dispatcher, or undefined to skip setting it */
  value: T | undefined;
};

/**
 * Creates a new dispatcher token with the given name.
 *
 * A dispatcher token can be used to:
 * 1. Create entries: `token(value)` returns `{ key, value }`
 * 2. Retrieve values: `getDispatcher(token)` returns the current value
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
 * // Create an entry
 * const entry = myToken(myDispatcherInstance);
 *
 * // Use in withDispatchers
 * withDispatchers([entry], () => {
 *   // Inside here, getDispatcher(myToken) returns myDispatcherInstance
 * });
 * ```
 */
export function dispatcherToken<T>(name: string): DispatcherToken<T> {
  const key = Symbol(name);

  return Object.assign(
    (value: T | undefined): DispatcherEntry<T> => ({ key, value }),
    {
      key,
    }
  );
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
  return current?.[token.key] as T | undefined;
}

/**
 * Executes a function with dispatchers applied to the current context.
 *
 * This function:
 * 1. Merges the provided dispatcher entries with any existing dispatchers
 * 2. Executes the function with the merged dispatcher context
 * 3. Restores the previous dispatcher state
 *
 * **Entry behavior**:
 * - Entries with `undefined` values are skipped (won't set or override)
 * - Multiple entries can be provided as an array
 * - Inner `withDispatchers` calls override outer ones for the same dispatcher tokens
 * - Previous dispatcher values are preserved if not overridden
 *
 * @template T - The return type of the function
 * @param dispatchers - A single entry or array of entries to apply
 * @param fn - The function to execute within the dispatcher context
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
 *   }
 * );
 * ```
 *
 * @example
 * ```ts
 * // Single entry
 * withDispatchers(trackingToken(dispatcher), () => {
 *   // Use dispatcher here
 * });
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
  fn: () => T
): T {
  const prev = current;

  // Normalize to array and reduce to build new dispatcher context
  current = (Array.isArray(dispatchers) ? dispatchers : [dispatchers]).reduce(
    (accumulated, entry) => {
      // Skip entries with undefined values
      if (typeof entry.value === "undefined") {
        return accumulated;
      }
      // Merge entry into accumulated dispatchers
      return {
        ...accumulated,
        [entry.key]: entry.value,
      };
    },
    prev // Start with previous dispatcher context (enables nesting)
  );

  try {
    return fn();
  } finally {
    // Always restore previous dispatcher state
    current = prev;
  }
}
