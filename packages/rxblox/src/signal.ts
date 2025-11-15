import { produce } from "immer";
import type { Listener, MutableSignal, Signal, TrackFunction } from "./types";
import { trackingDispatcher, trackingToken } from "./trackingDispatcher";
import { emitter } from "./emitter";
import { getDispatcher, withDispatchers } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";

/**
 * Context provided to computed signal functions.
 *
 * This context enables explicit dependency tracking via the `track()` function,
 * which creates a lazy tracking proxy that only subscribes to signals when
 * their properties are accessed.
 *
 * @example
 * ```ts
 * const result = signal(({ track }) => {
 *   const tracked = track({ condition, a, b });
 *   // Only 'condition' + one of 'a' or 'b' will be tracked
 *   return tracked.condition ? tracked.a : tracked.b;
 * });
 * ```
 */
export type ComputedSignalContext = {
  /**
   * Creates a lazy tracking proxy for explicit dependency management.
   *
   * The proxy enables fine-grained, conditional dependency tracking by only
   * subscribing to signals when their properties are accessed. This is useful
   * for conditional logic where you don't want to track all signals.
   *
   * @param signals - Record mapping property names to functions (signals or computed)
   * @returns A proxy that tracks dependencies lazily when properties are accessed
   *
   * @example
   * ```ts
   * const result = signal(({ track }) => {
   *   const tracked = track({
   *     condition,
   *     value1: a,
   *     value2: b,
   *     computed: () => c() * 2,
   *   });
   *
   *   // Only tracks 'condition' + one of the values
   *   return tracked.condition ? tracked.value1 : tracked.value2;
   * });
   * ```
   */
  track: TrackFunction;
};

/**
 * Options for configuring a signal's behavior.
 */
export type SignalOptions<T> = {
  /**
   * Custom equality function to determine if the signal value has changed.
   * Defaults to Object.is for reference equality.
   */
  equals?: (a: NoInfer<T>, b: NoInfer<T>) => boolean;
};

/**
 * Creates a reactive signal that holds a value and notifies listeners when it changes.
 *
 * A signal can be:
 * - Read by calling it as a function: `const val = mySignal()`
 * - Peeked (read without tracking): `const val = mySignal.peek()`
 * - Set with a new value: `mySignal.set(newValue)`
 * - Set with an updater function: `mySignal.set(prev => prev + 1)`
 * - Listened to for changes: `mySignal.on(newValue => console.log(newValue))`
 *
 * Signals can be created with:
 * - A static value: `signal(42)`
 * - A computed value (function): `signal(() => otherSignal() * 2)`
 * - A computed value with explicit tracking: `signal(({ track }) => { ... })`
 *
 * **Dependency Tracking for Computed Signals:**
 *
 * Computed signals support two ways to track dependencies:
 * 1. **Implicit tracking** - Call signals directly (e.g., `otherSignal()`)
 * 2. **Explicit tracking** - Use `track()` proxy for lazy/conditional tracking
 *
 * The `track()` function creates a proxy that only tracks signals you actually access,
 * making it perfect for conditional dependencies.
 *
 * @param value - The initial value or a function that computes the value
 * @param options - Configuration options for the signal
 * @returns A mutable signal that can be read, set, and subscribed to
 *
 * @example
 * ```ts
 * // Simple signal with a value
 * const count = signal(0);
 * count.set(1); // Updates to 1
 *
 * // Computed signal with implicit tracking
 * const doubled = signal(() => count() * 2);
 * count.set(2); // doubled() automatically becomes 4
 *
 * // Computed signal with explicit tracking
 * const result = signal(({ track }) => {
 *   const { condition, a, b } = track({ condition, a, b });
 *   return condition ? a : b; // Only tracks condition + one of a/b
 * });
 *
 * // With custom equality
 * const obj = signal({ id: 1 }, {
 *   equals: (a, b) => a.id === b.id
 * });
 * ```
 */
export function signal<T>(
  value: T | ((context: ComputedSignalContext) => T),
  options: SignalOptions<T> = {}
): MutableSignal<T> {
  // Cache for the current computed value (for computed signals)
  let current: { value: T } | undefined;
  const onCleanup = emitter<void>();

  /**
   * Computes the signal's value. For computed signals, this:
   * 1. Unsubscribes from previous dependencies
   * 2. Creates a new signal dispatcher to track current dependencies
   * 3. Executes the computation function
   * 4. Subscribes to all signals accessed during computation
   * 5. Caches the result
   */
  const compute = () => {
    // Clean up previous subscriptions
    onCleanup.emit();
    onCleanup.clear();

    if (typeof value === "function") {
      // This is a computed signal - track dependencies
      const dispatcher = trackingDispatcher(recompute, onCleanup);
      const context: ComputedSignalContext = {
        track: dispatcher.track,
      };
      // Execute the computation function and track which signals it accesses
      // The dispatcher tracks implicit accesses (signal calls)
      // The track() proxy tracks explicit accesses (proxy property access)
      current = {
        value: withDispatchers([trackingToken(dispatcher)], () =>
          (value as (context: ComputedSignalContext) => T)(context)
        ),
      };
    } else {
      // Static value - just cache it
      current = { value };
    }
    return current.value;
  };

  const recompute = () => {
    const prev = current;
    const nextValue = compute();
    if (!prev || !equals(prev.value, nextValue)) {
      current = { value: nextValue };
      onChange.emit(nextValue);
    }
  };

  /**
   * Gets the current signal value. If accessed within a computed signal context,
   * registers this signal as a dependency.
   */
  const get = () => {
    try {
      // Compute if not already cached
      if (!current) {
        return compute();
      }
      return current.value;
    } finally {
      // If we're inside a computed signal, register this signal as a dependency
      getDispatcher(trackingToken)?.add(s);
    }
  };

  const onChange = emitter<T>();
  // Equality function (defaults to Object.is for reference equality)
  const { equals = Object.is } = options;

  // Create the signal object by assigning methods to the get function
  let s: MutableSignal<T> = Object.assign(get, {
    readonly: undefined as unknown as Signal<T>,
    get: () => get(),
    /**
     * Sets the signal to a new value or updates it using a function.
     * Uses immer's produce for immutable updates when a function is provided.
     * Only notifies listeners if the value actually changed (according to equals).
     *
     * @param value - The new value or a function that receives the previous value
     */
    set(value: T | ((prev: T) => T | void)): void {
      const prevValue = get();
      // If value is a function, use produce to create an immutable update
      const nextValue =
        typeof value === "function"
          ? (produce(prevValue, value as (draft: T) => T | void) as T)
          : (value as T);

      // Only update and notify if the value actually changed
      if (!equals(prevValue, nextValue)) {
        current = { value: nextValue };
        // Notify all listeners (use slice() to avoid issues if listeners modify the array)
        onChange.emit(nextValue);
      }
    },
    /**
     * Reads the signal value without tracking it as a dependency.
     * Useful when you want to read a signal inside a computed signal
     * without creating a dependency on it.
     *
     * @returns The current signal value
     */
    peek() {
      if (!current) {
        return compute();
      }
      return current.value;
    },
    /**
     * Subscribes to changes in the signal value.
     * The listener will be called whenever the signal value changes.
     *
     * @param listener - Function to call when the signal value changes
     * @returns An unsubscribe function to remove the listener
     */
    on(listener: Listener<T>): VoidFunction {
      return onChange.add(listener);
    },

    reset() {
      current = undefined;
      recompute();
    },
  });

  Object.assign(s, { readonly: s });

  getDispatcher(disposableToken)?.add(() => {
    onCleanup.emitAndClear();
  });

  return s;
}

export function isSignal<T>(value: any): value is Signal<T> {
  return typeof value === "function" && "peek" in value && "on" in value;
}

export function isMutableSignal<T>(value: any): value is MutableSignal<T> {
  return isSignal(value) && "set" in value && "reset" in value;
}
