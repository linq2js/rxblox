import { useLayoutEffect, useState } from "react";
import { isDev } from "../utils/dev";

/**
 * Lifecycle hook options
 * Provides fine-grained control over component lifecycle phases
 */
export type UseLifecycleOptions = {
  /**
   * Called during component initialization (before first render)
   * Runs during useState initialization - only once
   * Use for: One-time setup that doesn't depend on React lifecycle
   */
  init?: VoidFunction;

  /**
   * Called after component renders and paints
   * Runs once after first paint (useLayoutEffect)
   * Use for: DOM measurements, subscriptions, etc.
   */
  mount?: VoidFunction;

  /**
   * Called on every render (including first render)
   * Runs during render phase, before paint
   * Use for: Tracking renders, updating refs, etc.
   */
  render?: VoidFunction;

  /**
   * Called synchronously during React cleanup phase
   * ⚠️ In StrictMode (development), may run multiple times:
   * - During mount/unmount/remount cycles
   * - During final unmount
   *
   * Use for: Standard React cleanup (safe to run multiple times)
   * - Canceling subscriptions
   * - Clearing timers
   * - Removing event listeners
   */
  cleanup?: VoidFunction;

  /**
   * Called ONLY on true unmount (StrictMode-aware)
   * Deferred to microtask + guarded by phase check
   *
   * **Guarantees:**
   * - In StrictMode: Only runs on FINAL unmount, not remounts
   * - In production: Always runs on unmount
   * - Errors: Protected with try-catch, won't crash app
   *
   * **Limitation:**
   * If component throws during render before useLayoutEffect runs,
   * dispose will NOT be called (React discards the component instance).
   * Use Error Boundaries to catch errors and ensure proper cleanup.
   *
   * **Use for:** Final cleanup that MUST run exactly once
   * - Persisting state to storage
   * - Sending analytics events
   * - Critical cleanup that shouldn't duplicate
   *
   * @example
   * ```tsx
   * useLifecycle({
   *   mount: () => {
   *     subscription.subscribe();
   *   },
   *   dispose: () => {
   *     subscription.unsubscribe();
   *   }
   * });
   * ```
   */
  dispose?: VoidFunction;
};

const EMPTY_OPTIONS: UseLifecycleOptions = {};

/**
 * Hook for managing component lifecycle with fine-grained control
 *
 * Provides callbacks for all major lifecycle phases:
 * 1. `init` - Before first render (useState initialization)
 * 2. `mount` - After first paint (useLayoutEffect)
 * 3. `render` - Every render (render phase)
 * 4. `cleanup` - Every cleanup (may run 2-3x in StrictMode)
 * 5. `dispose` - Final unmount only (runs exactly once)
 *
 * **Important:** If component throws during render before mounting,
 * only `init` will have run. Use Error Boundaries for proper error handling.
 *
 * @param options - Lifecycle callbacks
 *
 * @example Basic usage
 * ```tsx
 * useLifecycle({
 *   init: () => console.log('Initializing...'),
 *   mount: () => console.log('Mounted!'),
 *   render: () => console.log('Rendering...'),
 *   cleanup: () => subscription.unsubscribe(),
 *   dispose: () => analytics.track('closed'),
 * });
 * ```
 *
 * @example Service pattern
 * ```tsx
 * useLifecycle({
 *   mount: () => {
 *     const sub = service.subscribe(data => setState(data));
 *   },
 *   dispose: () => {
 *     service.cleanup();
 *   }
 * });
 * ```
 */
export function useLifecycle(options: UseLifecycleOptions) {
  // Create stable ref object using useState (created once, never recreated)
  // Run init callback during initialization (before first render)
  const [ref] = useState(() => {
    let currentOptions = options;
    options.init?.();
    let phase: "render" | "cleanup" | "mount" | "disposed" = "render";
    let shouldDisposeIfThereIsErrorInRender = false;

    const dispose = () => {
      if (phase === "disposed") return;
      phase = "disposed";
      currentOptions.dispose?.();
      currentOptions = EMPTY_OPTIONS as UseLifecycleOptions;
    };

    return {
      onRender(nextOptions: UseLifecycleOptions) {
        currentOptions = nextOptions;
        shouldDisposeIfThereIsErrorInRender = true;
        phase = "render";
        Promise.resolve().then(() => {
          if (shouldDisposeIfThereIsErrorInRender) {
            dispose();
          }
        });
        currentOptions.render?.();
      },
      onMount() {
        phase = "mount";
        shouldDisposeIfThereIsErrorInRender = false;
        currentOptions.mount?.();

        return () => {
          phase = "cleanup";
          currentOptions.cleanup?.();

          if (currentOptions.dispose) {
            if (isDev()) {
              /**
               * Defer dispose callback to microtask for StrictMode safety
               *
               * Why deferred execution?
               * 1. **StrictMode guard**: Component may remount immediately in development.
               *    By deferring to microtask, we can check if phase changed back to
               *    "mount", indicating a remount. This prevents dispose from running during
               *    remount cycles.
               *
               * 2. **Full unmount guarantee**: Ensures component is completely removed from
               *    React tree before dispose runs. Synchronous execution could run while
               *    React is still cleaning up sibling components.
               *
               * 3. **Timing consistency**: All synchronous cleanup operations (cleanup callback,
               *    other effects) complete before dispose runs.
               *
               * Microtask (Promise.resolve().then):
               * - Runs after current synchronous execution
               * - Runs before next render
               * - Faster than setTimeout (macrotask)
               */
              Promise.resolve().then(() => {
                // Verify still unmounted (phase wasn't reset to "mount")
                if (phase === "cleanup") {
                  try {
                    dispose();
                  } catch (error) {
                    console.error("Error in dispose callback:", error);
                  }
                }
              });
            } else {
              // Production: call dispose synchronously
              dispose();
            }
          }
        };
      },
    };
  });

  ref.onRender(options);

  useLayoutEffect(() => {
    return ref.onMount();
  }, []); // Empty deps: mount once, cleanup on unmount
}
