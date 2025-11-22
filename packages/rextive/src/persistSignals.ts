import { Signal, SignalMap, MutableSignal } from "./types";
import { emitter } from "./utils/emitter";
import { isPromiseLike } from "./utils/isPromiseLike";

export type PersistedValues<TSignals extends SignalMap> = Partial<{
  [K in keyof TSignals]: TSignals[K] extends Signal<infer T> ? T | null : never;
}>;

export type PersistorStatus =
  | "idle" // Not started yet, or cancelled
  | "loading" // Currently loading initial data
  | "watching" // Actively saving changes
  | "paused"; // Temporarily not saving (but subscribed)

export type PersistSignalsOptions<TSignals extends SignalMap> = {
  // Load persisted values
  // Returns partial map of signal values (only loaded signals included)
  load?: () => PersistedValues<TSignals> | Promise<PersistedValues<TSignals>>;

  // Save current values
  // Called whenever any signal changes (calling site handles debouncing)
  save?: (values: {
    [K in keyof TSignals]: TSignals[K] extends Signal<infer T> ? T : never;
  }) => void;

  // Error handling - fires for both load and save errors
  // Use `type` to determine which operation failed
  onError?: (error: unknown, type: "load" | "save") => void;

  // Behavior options
  autoStart?: boolean; // default: true - start persistence immediately
};

export type PersistSignalsResult<TSignals extends SignalMap> = {
  // The signals themselves (same reference)
  signals: TSignals;

  // Control functions
  start: () => void; // Start persistence (load + subscribe to signals)
  cancel: () => void; // Stop all persistence (unsubscribe from signals)
  pause: () => void; // Temporarily stop saving (stores latest state)
  resume: () => void; // Resume saving (saves latest state if paused)

  // Status - single state machine
  status: () => PersistorStatus;
};

/**
 * Persist multiple signals with centralized load/save operations.
 *
 * @example
 * ```ts
 * const { signals, pause, resume } = persistSignals(
 *   { count: signal(0), name: signal("") },
 *   {
 *     load: () => JSON.parse(localStorage.getItem("state") || "{}"),
 *     save: (values) => localStorage.setItem("state", JSON.stringify(values))
 *   }
 * );
 * ```
 */
export function persistSignals<TSignals extends SignalMap>(
  signals: TSignals,
  options: PersistSignalsOptions<TSignals> = {}
): PersistSignalsResult<TSignals> {
  const { load, save, onError, autoStart = true } = options;

  let currentStatus: PersistorStatus = "idle";
  const onCleanup = emitter<void>();
  let pausedValues: Record<keyof TSignals, any> | null = null;

  // Get current values of all signals
  const getCurrentValues = (): Record<keyof TSignals, any> => {
    const values: Record<keyof TSignals, any> = {} as any;
    for (const key in signals) {
      values[key] = (signals[key] as Signal<any>).get();
    }
    return values;
  };

  // Save current values
  const saveValues = () => {
    if (!save || currentStatus !== "watching") return;

    try {
      const values = getCurrentValues();
      save(values);
    } catch (error) {
      if (onError) {
        onError(error, "save");
      }
    }
  };

  // Subscribe to all signals
  const subscribe = () => {
    if (!save) return;

    // Unsubscribe from previous subscriptions
    unsubscribe();

    // Subscribe to each signal
    for (const key in signals) {
      const signal = signals[key] as Signal<any>;
      const unsub = signal.on(() => {
        if (currentStatus === "watching") {
          saveValues();
        } else if (currentStatus === "paused") {
          // Store latest values while paused
          pausedValues = getCurrentValues();
        }
      });

      // Register cleanup - emitter will call this function when we emit
      onCleanup.on(unsub);
    }
  };

  // Unsubscribe from all signals
  const unsubscribe = () => {
    onCleanup.emitAndClear();
  };

  // Apply loaded values to signals
  const applyLoadedValues = (loaded: PersistedValues<TSignals>) => {
    for (const key in loaded) {
      if (key in signals) {
        const signal = signals[key] as MutableSignal<any>;
        signal.hydrate(loaded[key]);
      }
    }
  };

  // Start persistence
  const start = () => {
    if (currentStatus !== "idle") {
      return; // Already started
    }

    if (!load) {
      // No load function - go straight to watching
      currentStatus = "watching";
      subscribe();
      return;
    }

    try {
      const result = load();

      // Check if result is a promise
      if (isPromiseLike(result)) {
        // Async load - set to loading and wait
        currentStatus = "loading";

        result
          .then((loaded) => {
            if (currentStatus === "loading") {
              applyLoadedValues(loaded);
              currentStatus = "watching";
              subscribe();
            }
          })
          .catch((error) => {
            // Load failed, still transition to watching
            if (currentStatus === "loading") {
              if (onError) {
                onError(error, "load");
              }
              currentStatus = "watching";
              subscribe();
            }
          });
      } else {
        // Sync load - apply immediately and go to watching
        applyLoadedValues(result);
        currentStatus = "watching";
        subscribe();
      }
    } catch (error) {
      // Load threw synchronously
      if (onError) {
        onError(error, "load");
      }
      currentStatus = "watching";
      subscribe();
    }
  };

  // Cancel persistence
  const cancel = () => {
    if (currentStatus === "idle") {
      return; // Already idle
    }

    unsubscribe();
    pausedValues = null;
    currentStatus = "idle";
  };

  // Pause saving
  const pause = () => {
    if (currentStatus !== "watching") {
      return; // Can only pause from watching state
    }

    pausedValues = getCurrentValues();
    currentStatus = "paused";
  };

  // Resume saving
  const resume = () => {
    if (currentStatus !== "paused") {
      return; // Can only resume from paused state
    }

    currentStatus = "watching";

    // Save the paused values if any
    if (pausedValues && save) {
      try {
        save(pausedValues);
      } catch (error) {
        if (onError) {
          onError(error, "save");
        }
      }
    }

    pausedValues = null;
  };

  // Get current status
  const status = (): PersistorStatus => currentStatus;

  // Auto-start if enabled
  if (autoStart) {
    start();
  }

  return {
    signals,
    start,
    cancel,
    pause,
    resume,
    status,
  };
}
