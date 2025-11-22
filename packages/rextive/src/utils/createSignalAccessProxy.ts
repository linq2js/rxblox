import { createProxy } from "./createProxy";
import { isSignal } from "../signal";
import { ResolveValueType, Signal, SignalMap } from "../types";
import { isPromiseLike } from "./isPromiseLike";
import { getLoadable, toLoadable } from "./loadable";

export type SignalAccessProxyOptions<
  TSignals extends SignalMap,
  TType extends ResolveValueType
> = {
  type?: TType;

  /**
   * Function that returns the current signals object.
   * Called on every property access to get the latest signals.
   */
  getSignals: () => TSignals;

  /**
   * Called when a signal is accessed via the proxy
   * Use this to track subscriptions, setup listeners, etc.
   */
  onSignalAccess: (signal: Signal<any>) => void;

  /**
   * Transforms the signal value before returning
   * Default: returns signal() directly
   */
  getValue?: (signal: Signal<any>) => any;

  /**
   * Optional condition for when to track signals (lazy tracking)
   * If provided, onSignalAccess is only called when this returns true
   * If omitted, onSignalAccess is always called
   */
  shouldTrack?: () => boolean;

  isReading?: () => boolean;

  onFinally?: VoidFunction;

  propValueCache?: Map<string, { value: any; error: any }>;
};

/**
 * Helper type to resolve signal map types
 */
type ResolveValue<
  TMap extends SignalMap,
  TType extends "awaited" | "loadable" | "value"
> = {
  readonly [K in keyof TMap]: TMap[K] extends () => infer T
    ? TType extends "awaited"
      ? Awaited<T>
      : TType extends "loadable"
      ? import("../types").Loadable<Awaited<T>>
      : TType extends "value"
      ? T
      : never
    : never;
};

/**
 * Creates a proxy for accessing signals with configurable tracking and value transformation.
 *
 * This utility extracts the common pattern of:
 * 1. Creating a proxy over a signals object
 * 2. Tracking signal access (lazy or immediate)
 * 3. Transforming signal values before returning
 *
 * The return type is inferred from the `getValue` transformation function, allowing
 * proper type resolution for "value", "awaited", and "loadable" access patterns.
 *
 * @example Usage in signal.ts (deps proxy)
 * ```ts
 * deps: createSignalAccessProxy({
 *   getSignals: () => deps,
 *   onSignalAccess: (depSignal) => {
 *     if (!trackedDeps.has(depSignal)) {
 *       trackedDeps.add(depSignal);
 *       onCleanup.on(depSignal.on(onDepChange));
 *     }
 *   },
 *   getValue: (signal) => signal(), // simple value access
 * })
 * ```
 *
 * @example Usage in useSignals.ts (signals proxy with lazy tracking)
 * ```ts
 * proxy = createSignalAccessProxy<TSignals, ResolveValue<TSignals, "awaited">>({
 *   getSignals: () => ref.signals,
 *   onSignalAccess: (signal) => {
 *     ref.trackedSignals.add(signal);
 *   },
 *   getValue: (signal) => {
 *     const value = signal();
 *     // Transform based on type (value/awaited/loadable)
 *     return transformValue(value, type);
 *   },
 *   shouldTrack: () => rerender.rendering(), // lazy tracking
 * })
 * ```
 */
export function createSignalAccessProxy<
  TType extends ResolveValueType,
  TSignals extends SignalMap,
  TResolved extends Record<string, any> = ResolveValue<TSignals, TType>
>(options: SignalAccessProxyOptions<TSignals, TType>): TResolved {
  const { getSignals, onSignalAccess, getValue, shouldTrack, type, onFinally } =
    options;

  const getPropValue = (prop: string) => {
    const signals = getSignals();
    const signal = signals[prop as keyof TSignals];
    if (!isSignal(signal)) {
      return undefined;
    }

    // Lazy tracking: only call onSignalAccess if shouldTrack returns true
    if (!shouldTrack || shouldTrack()) {
      onSignalAccess(signal);
    }

    // Get and optionally transform the value
    if (getValue) {
      return getValue(signal);
    }

    const value = signal();

    if (type === "awaited") {
      if (isPromiseLike(value)) {
        const l = getLoadable(value);
        if (l.status === "loading") {
          throw l.promise;
        }
        if (l.status === "error") {
          throw l.error;
        }
        return l.value;
      }
      return value;
    }

    if (type === "loadable") {
      const l = toLoadable(value);
      if (l.status === "loading" && onFinally) {
        l.promise.then(onFinally, onFinally);
      }
      return l;
    }

    // Default: return signal value directly
    return value;
  };

  return createProxy({
    get: getSignals,
    traps: {
      get(_target, prop: string) {
        if (options.isReading?.()) {
          return getPropValue(prop);
        }

        try {
          if (options.propValueCache) {
            const existing = options.propValueCache.get(prop);
            if (existing) {
              if (existing.error) {
                throw existing.error;
              }
              return existing.value;
            }
          }

          const value = getPropValue(prop);

          options.propValueCache?.set(prop, { value, error: undefined });

          return value;
        } catch (error) {
          options.propValueCache?.set(prop, { value: undefined, error });
          throw error;
        }
      },
    },
  }) as unknown as TResolved;
}
