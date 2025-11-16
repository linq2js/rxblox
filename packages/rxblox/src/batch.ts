import { getDispatcher, withDispatchers } from "./dispatcher";
import { MutableSignal, Signal } from "./types";
import { batchToken, batchDispatcher } from "./batchDispatcher";

/**
 * Type utility to infer value types from an array of signals.
 * 
 * Extracts the inner value type from each signal in the array:
 * - `Signal<number>` → `number`
 * - `MutableSignal<string>` → `string`
 * - `[Signal<number>, Signal<string>]` → `[number, string]`
 * 
 * Used for type-safe batch operations with multiple signals.
 * 
 * @example
 * ```ts
 * const signals = [signal(1), signal("hello"), signal(true)] as const;
 * // InferSignalValues<typeof signals> = [number, string, boolean]
 * ```
 */
export type InferSignalValues<
  TSignals extends readonly (Signal<any> | MutableSignal<any>)[]
> = TSignals extends readonly [
  infer TFirst extends Signal<any> | MutableSignal<any>,
  ...infer TRest extends readonly (Signal<any> | MutableSignal<any>)[]
]
  ? TFirst extends Signal<infer TValue> | MutableSignal<infer TValue>
    ? [TValue, ...InferSignalValues<TRest>]
    : never
  : [];

/**
 * Batches updates to multiple signals via draft values.
 * 
 * This overload accepts an array of signals and provides draft values
 * as callback parameters. Each signal is updated via its `set()` method
 * with the draft value after the callback completes.
 * 
 * @param signals - Array of mutable signals to update
 * @param fn - Callback receiving draft values for each signal
 * 
 * @example
 * ```ts
 * const count = signal(0);
 * const name = signal("Alice");
 * 
 * batch([count, name], (c, n) => {
 *   c = 10;        // Update count draft
 *   n = "Bob";     // Update name draft
 * });
 * 
 * console.log(count()); // 10
 * console.log(name());  // "Bob"
 * ```
 */
export function batch<const TSignals extends readonly MutableSignal<any>[]>(
  signals: TSignals,
  fn: (...args: InferSignalValues<TSignals>) => void
): void;

/**
 * Batches multiple signal updates into a single operation.
 * 
 * Groups signal updates to prevent unnecessary recomputations:
 * - **Deferred Notifications**: Listeners are queued and notified after batch completes
 * - **Async Recomputation**: Computed signals mark as dirty and recompute in a microtask
 * - **Stale Values**: Accessing computed signals during batch returns last computed value
 * - **Nested Support**: Automatically tracks depth for nested batches
 * - **Deduplication**: Multiple updates to same signal only trigger one notification
 * 
 * @param fn - Function containing signal updates
 * @returns The return value of `fn`
 * 
 * @example
 * ```ts
 * const a = signal(1);
 * const b = signal(2);
 * const sum = signal(() => a() + b());
 * 
 * // Without batch: sum recomputes twice
 * a.set(10);
 * b.set(20);
 * 
 * // With batch: sum recomputes once
 * batch(() => {
 *   a.set(10);
 *   b.set(20);
 * });
 * ```
 * 
 * @example
 * ```ts
 * // Nested batches are supported
 * batch(() => {
 *   signal1.set(1);
 *   batch(() => {
 *     signal2.set(2);
 *   });
 * });
 * ```
 * 
 * @example
 * ```ts
 * // Returns value from function
 * const result = batch(() => {
 *   count.set(5);
 *   return count() * 2;
 * });
 * console.log(result); // 10
 * ```
 */
export function batch<T>(fn: () => T): T;

export function batch(...args: any[]): any {
  // Handle signal array overload: batch([sig1, sig2], (v1, v2) => {...})
  if (Array.isArray(args[0])) {
    const signals: MutableSignal<any>[] = args[0];
    const originalFn: (...args: any[]) => void = args[1];
    
    // Wrap in a standard batch to group all signal updates
    return batch(() => {
      // Use reduce to chain signal updates, passing draft values
      // This builds a function that calls set() on each signal with its draft
      signals.reduce((prevFn, signal) => {
        return (...accArgs: any[]) => {
          signal.set((draft: any) => {
            prevFn(draft, ...accArgs);
          });
        };
      }, originalFn)();
    });
  }

  // Handle standard overload: batch(() => {...})
  const fn = args[0];
  
  // If already in a batch, just execute the function
  // This enables nested batching - inner batches don't create new contexts
  if (getDispatcher(batchToken)) {
    return fn();
  }

  // Create a new batch context
  const dispatcher = batchDispatcher();
  return withDispatchers([batchToken(dispatcher)], () => {
    try {
      // Execute the function with batch context active
      return fn();
    } finally {
      // Always flush notifications, even if function throws
      dispatcher.flush();
    }
  });
}

