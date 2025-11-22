import { Emitter, emitter } from "./utils/emitter";
import { guardDisposed } from "./utils/guardDisposed";
import {
  Signal,
  MutableSignal,
  ComputedSignal,
  SignalContext,
  ComputedSignalContext,
  SignalMap,
  SignalOptions,
  ResolveValue,
  HydrateStatus,
} from "./types";
import { createSignalAccessProxy } from "./utils/createSignalAccessProxy";
import { scheduleNotification } from "./batch";

export const SIGNAL_TYPE = Symbol("SIGNAL_TYPE");
export const DISPOSED_MESSAGE = "Signal is disposed";

export type SignalExports = {
  /**
   * Create mutable signal with no initial value
   * get() returns T | undefined, but set() requires T
   * @returns MutableSignal<T, undefined>
   */
  <TValue = unknown>(): MutableSignal<TValue, undefined>;

  /**
   * Create mutable signal with initial value and options (non-function value)
   * @param valueOrCompute - Initial value or compute function
   * @param options - Signal options
   * @returns MutableSignal<T>
   */
  <TValue>(
    valueOrCompute: TValue | ((context: SignalContext) => TValue),
    options?: SignalOptions<TValue>
  ): MutableSignal<TValue>;

  /**
   * Create computed signal from dependencies
   * @param dependencies - Map of signals to depend on
   * @param compute - Compute function that receives dependency values
   * @returns ComputedSignal<T>
   */
  <TValue, TDependencies extends SignalMap>(
    dependencies: TDependencies,
    compute: (context: ComputedSignalContext<NoInfer<TDependencies>>) => TValue
  ): ComputedSignal<TValue>;

  /**
   * Create computed signal from dependencies with options
   * @param dependencies - Map of signals to depend on
   * @param compute - Compute function that receives dependency values
   * @param options - Signal options
   * @returns ComputedSignal<T>
   */
  <TValue, TDependencies extends SignalMap>(
    dependencies: TDependencies,
    compute: (context: ComputedSignalContext<NoInfer<TDependencies>>) => TValue,
    options: SignalOptions<TValue>
  ): ComputedSignal<TValue>;

  /**
   * Type guard to check if value is a signal
   */
  is: typeof isSignal;
};

export const signal = Object.assign(
  ((...args: any[]) => {
    // overload: signal() - no arguments, creates MutableSignal<undefined>
    if (args.length === 0) {
      return createMutableSignal({}, () => undefined, undefined, {
        value: undefined,
      });
    }
    // overload: signal(deps, fn, options?) - creates ComputedSignal
    if (typeof args[1] === "function") {
      return createComputedSignal(args[0], args[1], args[2]);
    }
    // overload: signal(value, options?) - creates MutableSignal
    const isLazy = typeof args[0] === "function";
    return createMutableSignal(
      {},
      isLazy ? args[0] : () => args[0],
      args[1],
      isLazy ? undefined : { value: args[0] }
    );
  }) as SignalExports,
  {
    is: isSignal,
  }
);

export class FallbackError extends Error {
  readonly originalError: unknown;
  readonly fallbackError: unknown;
  readonly signalName?: string;

  constructor(error: unknown, fallbackError: unknown, signalName?: string) {
    super(
      `Signal computation failed with: ${error}\nFallback also failed with: ${fallbackError}`
    );
    this.name = "FallbackError";
    this.originalError = error;
    this.fallbackError = fallbackError;
    this.signalName = signalName;
  }
}

function createContext(
  deps: SignalMap,
  onCleanup: Emitter,
  onDepChange: VoidFunction
): ComputedSignalContext<SignalMap> & {
  trackedDeps: Set<Signal<any>>;
  abortController: AbortController;
  dispose: VoidFunction;
} {
  let abortController: AbortController | undefined;
  let trackedDeps: Set<Signal<any>> | undefined;
  let depsProxy: any;

  const getTrackedDeps = () => {
    if (!trackedDeps) {
      trackedDeps = new Set();
    }
    return trackedDeps;
  };

  const getAbortController = () => {
    if (!abortController) {
      abortController = new AbortController();
    }
    return abortController;
  };

  const contextCleanup = (fn: VoidFunction) => {
    onCleanup.on(fn);
  };

  const internalCleanup = () => {
    abortController?.abort();
    abortController = undefined;
    trackedDeps?.clear();
    trackedDeps = undefined;
    depsProxy = undefined;
  };

  return {
    get abortController() {
      return getAbortController();
    },
    get trackedDeps() {
      return getTrackedDeps();
    },
    get abortSignal() {
      return getAbortController().signal;
    },
    cleanup: contextCleanup,
    // Proxy for dependency access with auto-tracking
    get deps() {
      if (!depsProxy) {
        depsProxy = createSignalAccessProxy<
          "value",
          SignalMap,
          ResolveValue<SignalMap, "value">
        >({
          type: "value",
          getSignals: () => deps,
          onSignalAccess: (depSignal) => {
            // Auto-subscribe to dependency if not already tracked
            if (!getTrackedDeps().has(depSignal)) {
              getTrackedDeps().add(depSignal); // Mark as tracked
              // Subscribe to dep changes and store unsubscribe function in onCleanup
              onCleanup.on(depSignal.on(onDepChange));
            }
          },
        });
      }
      return depsProxy;
    },
    dispose: internalCleanup,
  };
}

/**
 * Create a mutable signal (no dependencies)
 * Has: set(), setIfUnchanged(), hydrate()
 * No: pause(), resume()
 */
function createMutableSignal(
  deps: SignalMap, // Always empty {} for mutable signals
  fn: (context: SignalContext) => any,
  options: SignalOptions<any> = {},
  initialValue: { value: any } | undefined
): MutableSignal<any> {
  const {
    equals = Object.is,
    name,
    fallback,
    onChange: onChangeCallbacks,
    onError: onErrorCallbacks,
    tags,
    lazy = true,
  } = options;

  const onChange = emitter<void>();
  const onChangeValue = emitter<any>();
  if (onChangeCallbacks) {
    onChangeValue.on(onChangeCallbacks);
  }

  const onErrorValue = emitter<unknown>();
  if (onErrorCallbacks) {
    onErrorValue.on(onErrorCallbacks);
  }

  const onCleanup = emitter<void>();

  let current: { value: any; error?: unknown } | undefined = initialValue;
  let disposed = false;
  let context: ReturnType<typeof createContext> | undefined;
  let instanceRef: MutableSignal<any> | undefined;
  let hasBeenModified = false; // Track if signal has been modified (for hydrate)

  const isDisposed = () => disposed;

  const dispose = () => {
    if (disposed) return;
    context?.dispose();
    disposed = true;
    context = undefined;

    if (tags && tags.length > 0 && instanceRef) {
      tags.forEach((tag) => (tag as any)._remove(instanceRef));
    }

    onChange.clear();
    onCleanup.emitAndClear();
  };

  const recompute = () => {
    if (disposed) {
      throw new Error("Cannot recompute disposed signal");
    }

    onCleanup.emitAndClear();
    context?.dispose();

    context = createContext(deps, onCleanup, recompute);

    try {
      const result = fn(context);

      const hadError = current?.error;
      const changed = hadError || !equals(current?.value, result);

      if (changed) {
        current = { value: result };
      }

      if (changed) {
        scheduleNotification(() => {
          onChangeValue.emit(result);
          onChange.emit();
        });
      }
    } catch (error) {
      onErrorValue.emit(error);

      if (fallback) {
        try {
          const fallbackValue = fallback(error);
          const changed =
            current?.error || !equals(current?.value, fallbackValue);

          if (changed) {
            current = { value: fallbackValue };
            scheduleNotification(() => {
              onChangeValue.emit(fallbackValue);
              onChange.emit();
            });
          }
        } catch (fallbackError) {
          current = {
            error: new FallbackError(error, fallbackError, name),
            value: undefined,
          };
          // Don't throw - just store error state
        }
      } else {
        current = { error, value: undefined };
        // Don't throw - just store error state
      }
    }
  };

  const get = () => {
    if (!current && !disposed) {
      recompute();
    }

    if (current?.error) {
      throw current.error;
    }

    return current!.value;
  };

  const reset = guardDisposed(
    isDisposed,
    "Cannot reset disposed signal",
    () => {
      const prevValue = current?.value;
      current = initialValue;
      hasBeenModified = false; // Clear modified flag on reset

      // Recompute to get new value
      recompute();

      // Notify only if value actually changed or there's an error
      if (!current || current.error || !equals(prevValue, current.value)) {
        scheduleNotification(() => onChange.emit());
      }
    }
  );

  const set = guardDisposed(
    isDisposed,
    "Cannot set value on disposed signal",
    (value: any) => {
      const next = typeof value === "function" ? value(get()) : value;

      if (equals(current?.value, next)) return;
      hasBeenModified = true; // Mark as modified
      current = { value: next };
      scheduleNotification(() => {
        onChangeValue.emit(next);
        onChange.emit();
      });
    }
  );

  const on = (listener: VoidFunction) => {
    if (!current && Object.keys(deps).length > 0) {
      get();
    }
    return onChange.on(listener);
  };

  // Hydrate for mutable signals - skip if already modified
  const hydrate = (value: any): HydrateStatus => {
    if (hasBeenModified) {
      // Already modified (via set), skip hydration
      return "skipped";
    }
    // Not modified yet, apply hydration
    set(value);
    hasBeenModified = false; // Reset flag - hydration doesn't count as user modification
    return "success";
  };

  const instance = Object.assign(get, {
    [SIGNAL_TYPE]: true,
    displayName: name,
    get,
    on,
    dispose,
    set,
    reset,
    toJSON: get,
    hydrate,
  });

  instanceRef = instance as unknown as MutableSignal<any>;

  if (tags && tags.length > 0) {
    tags.forEach((tag) => (tag as any)._add(instanceRef!));
  }

  if (!lazy) {
    instance.get();
  }

  return instance as unknown as MutableSignal<any>;
}

/**
 * Create a computed signal (with dependencies)
 * Has: pause(), resume(), paused(), hydrate()
 * No: set(), setIfUnchanged()
 */
function createComputedSignal(
  deps: SignalMap,
  fn: (context: ComputedSignalContext<SignalMap>) => any,
  options: SignalOptions<any> = {}
): ComputedSignal<any> {
  // Similar to createSignal but without set/setIfUnchanged
  // and with pause/resume functionality

  const {
    equals = Object.is,
    name,
    fallback,
    onChange: onChangeCallbacks,
    onError: onErrorCallbacks,
    tags,
    lazy = true,
  } = options;

  const onChange = emitter<void>();
  const onChangeValue = emitter<any>();
  if (onChangeCallbacks) {
    onChangeValue.on(onChangeCallbacks);
  }

  const onErrorValue = emitter<unknown>();
  if (onErrorCallbacks) {
    onErrorValue.on(onErrorCallbacks);
  }

  const onCleanup = emitter<void>();

  let current: { value: any; error?: unknown } | undefined = undefined;
  let disposed = false;
  let context: ReturnType<typeof createContext> | undefined;
  let instanceRef: ComputedSignal<any> | undefined;
  let isPaused = false;
  let hasComputed = false; // Track if signal has been computed (for hydrate)

  const isDisposed = () => disposed;

  const dispose = () => {
    if (disposed) return;
    context?.dispose();
    disposed = true;
    context = undefined;

    if (tags && tags.length > 0 && instanceRef) {
      tags.forEach((tag) => (tag as any)._remove(instanceRef));
    }

    onChange.clear();
    onCleanup.emitAndClear();
  };

  const recompute = () => {
    if (disposed) {
      throw new Error("Cannot recompute disposed signal");
    }

    onCleanup.emitAndClear();
    context?.dispose();

    context = createContext(deps, onCleanup, () => {
      if (!isPaused) {
        recompute();
      }
    });

    try {
      const result = fn(context);
      hasComputed = true;

      const hadError = current?.error;
      const changed = hadError || !equals(current?.value, result);

      if (changed) {
        current = { value: result };
      }

      if (changed) {
        scheduleNotification(() => {
          onChangeValue.emit(result);
          onChange.emit();
        });
      }
    } catch (error) {
      onErrorValue.emit(error);

      const hadValue = current && !current.error;

      if (fallback) {
        try {
          const fallbackValue = fallback(error);
          const changed =
            current?.error || !equals(current?.value, fallbackValue);

          if (changed) {
            current = { value: fallbackValue };
            scheduleNotification(() => {
              onChangeValue.emit(fallbackValue);
              onChange.emit();
            });
          }
        } catch (fallbackError) {
          current = {
            error: new FallbackError(error, fallbackError, name),
            value: undefined,
          };
          // Notify about error state change
          if (hadValue) {
            scheduleNotification(() => onChange.emit());
          }
        }
      } else {
        current = { error, value: undefined };
        // Notify about error state change
        if (hadValue) {
          scheduleNotification(() => onChange.emit());
        }
      }
    }
  };

  const get = () => {
    if (!current && !disposed) {
      recompute();
    }

    if (current?.error) {
      throw current.error;
    }

    return current!.value;
  };

  const reset = guardDisposed(
    isDisposed,
    "Cannot reset disposed signal",
    () => {
      current = undefined;
      hasComputed = false;
      recompute();

      // Always notify on reset (value changed, error state changed, or recomputed)
      scheduleNotification(() => onChange.emit());
    }
  );

  const on = (listener: VoidFunction) => {
    if (!current && Object.keys(deps).length > 0) {
      get();
    }
    return onChange.on(listener);
  };

  // Pause/Resume/Paused for computed signals
  const pause = () => {
    isPaused = true;
  };

  const resume = () => {
    if (!isPaused) return;
    isPaused = false;
    // Recompute with latest dependencies
    recompute();
    scheduleNotification(() => onChange.emit());
  };

  const paused = () => isPaused;

  // Hydrate for computed signals - skip if already computed
  const hydrate = (value: any): HydrateStatus => {
    if (hasComputed) {
      // Already computed, skip hydration
      return "skipped" as const;
    }
    // Set value without computing
    current = { value };
    hasComputed = true;
    return "success" as const;
  };

  const instance = Object.assign(get, {
    [SIGNAL_TYPE]: true,
    displayName: name,
    get,
    on,
    dispose,
    reset,
    toJSON: get,
    pause,
    resume,
    paused,
    hydrate,
  });

  instanceRef = instance as unknown as ComputedSignal<any>;

  if (tags && tags.length > 0) {
    tags.forEach((tag) => (tag as any)._add(instanceRef!));
  }

  if (!lazy) {
    try {
      instance.get();
    } catch {
      // Ignore errors during eager computation
    }
  }

  return instance as unknown as ComputedSignal<any>;
}

/**
 * Type guard that checks whether a value is a Signal.
 *
 * @param value - The value to check.
 * @param type - Optional signal type to check for ("mutable" or "computed")
 * @returns true if `value` is a Signal of the specified type.
 *
 * @example
 * ```ts
 * const count = signal(0);
 * const doubled = signal({ count }, ({ deps }) => deps.count * 2);
 *
 * if (isSignal(count)) {
 *   console.log(count()); // Safe to call as signal
 * }
 *
 * if (isSignal(count, "mutable")) {
 *   count.set(5); // Safe to call set
 * }
 *
 * if (isSignal(doubled, "computed")) {
 *   doubled.pause(); // Safe to call pause
 * }
 * ```
 */
export function isSignal<T = any>(value: unknown): value is Signal<T>;
export function isSignal<T = any>(
  value: unknown,
  type: "mutable"
): value is MutableSignal<T>;
export function isSignal<T = any>(
  value: unknown,
  type: "computed"
): value is ComputedSignal<T>;
export function isSignal<T = any>(
  value: unknown,
  type?: "mutable" | "computed"
): value is Signal<T> | MutableSignal<T> | ComputedSignal<T> {
  const isAnySignal =
    typeof value === "function" &&
    value !== null &&
    (value as any)[SIGNAL_TYPE] === true;

  if (!isAnySignal) {
    return false;
  }

  if (!type) {
    return true;
  }

  // Check if it's a mutable signal (has set method)
  if (type === "mutable") {
    return "set" in (value as any);
  }

  // Check if it's a computed signal (has pause method, no set method)
  if (type === "computed") {
    return "pause" in (value as any) && !("set" in (value as any));
  }

  return false;
}
