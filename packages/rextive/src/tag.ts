import type { Signal } from "./types";
import { isSignal } from "./signal";

/**
 * A tag for grouping signals together.
 *
 * Tags allow you to perform batch operations on multiple signals,
 * such as resetting form fields or disposing resources.
 *
 * @template T - The type of values held by signals in this tag
 */
export type Tag<T> = {
  /**
   * Iterates over all signals in this tag.
   *
   * @param fn - Function to call for each signal
   */
  forEach(fn: (signal: Signal<T>) => void): void;

  /**
   * Returns all signals in this tag as an array.
   *
   * @returns Array of signals
   */
  signals(): Signal<T>[];

  /**
   * Checks if a signal is in this tag.
   *
   * @param signal - Signal to check
   * @returns True if signal is in tag
   */
  has(signal: Signal<T>): boolean;

  /**
   * Removes a signal from this tag.
   *
   * @param signal - Signal to remove
   * @returns True if signal was in tag and removed
   */
  delete(signal: Signal<T>): boolean;

  /**
   * Removes all signals from this tag.
   */
  clear(): void;

  /**
   * Number of signals in this tag.
   */
  readonly size: number;

  /**
   * Internal method to add a signal to this tag.
   * Called automatically by signal() when tags option is provided.
   *
   * @internal
   */
  _add(signal: Signal<T>): void;

  /**
   * Internal method to remove a signal from this tag.
   * Called automatically when signal is disposed.
   *
   * @internal
   */
  _remove(signal: Signal<T>): void;
};

/**
 * Type helper to extract the union of value types from an array of tags.
 *
 * @internal
 */
export type UnionOfTagTypes<T extends readonly Tag<any>[]> =
  T extends readonly [Tag<infer U>, ...infer Rest]
    ? U | UnionOfTagTypes<Rest extends readonly Tag<any>[] ? Rest : never>
    : never;

/**
 * Creates a tag for grouping signals together.
 *
 * Tags enable batch operations on multiple signals, such as:
 * - Resetting groups of signals
 * - Disposing resources
 * - Debugging and logging
 *
 * @template T - The type of values held by signals in this tag
 * @returns A new tag instance
 */
export function tag<T>(): Tag<T> {
  const signals = new Set<Signal<T>>();

  return {
    forEach(fn: (signal: Signal<T>) => void): void {
      signals.forEach(fn);
    },

    signals(): Signal<T>[] {
      return Array.from(signals);
    },

    has(signal: Signal<T>): boolean {
      return signals.has(signal);
    },

    delete(signal: Signal<T>): boolean {
      return signals.delete(signal);
    },

    clear(): void {
      signals.clear();
    },

    get size(): number {
      return signals.size;
    },

    _add(signal: Signal<T>): void {
      if (!isSignal(signal)) {
        throw new Error("Only signals created by rextive can be tagged");
      }
      signals.add(signal);
    },

    _remove(signal: Signal<T>): void {
      signals.delete(signal);
    },
  };
}

/**
 * Static namespace for multi-tag operations.
 */
export namespace tag {
  /**
   * Iterates over all signals from multiple tags.
   *
   * The callback receives signals typed as a union of all tag types.
   *
   * @param tags - Array of tags to iterate over
   * @param fn - Function to call for each signal
   */
  export function forEach<const T extends readonly Tag<any>[]>(
    tags: T,
    fn: (signal: Signal<UnionOfTagTypes<T>>) => void
  ): void {
    const seen = new Set<Signal<any>>();

    for (const t of tags) {
      t.forEach((signal) => {
        if (!seen.has(signal)) {
          seen.add(signal);
          fn(signal as Signal<UnionOfTagTypes<T>>);
        }
      });
    }
  }

  /**
   * Returns all signals from multiple tags as an array.
   *
   * Signals are de-duplicated (if a signal belongs to multiple tags,
   * it appears only once in the result).
   *
   * @param tags - Array of tags
   * @returns Array of signals from all tags
   */
  export function signals<T extends readonly Tag<any>[]>(
    tags: T
  ): Signal<UnionOfTagTypes<T>>[] {
    const result: Signal<UnionOfTagTypes<T>>[] = [];
    const seen = new Set<Signal<any>>();

    for (const t of tags) {
      t.forEach((signal) => {
        if (!seen.has(signal)) {
          seen.add(signal);
          result.push(signal as Signal<UnionOfTagTypes<T>>);
        }
      });
    }

    return result;
  }
}
