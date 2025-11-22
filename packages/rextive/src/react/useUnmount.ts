import { useLayoutEffect, useRef } from "react";

/**
 * Hook that executes a callback when the component unmounts.
 *
 * This hook provides a way to perform cleanup or side effects when a component
 * is removed from the component tree. Unlike `useEffect`'s cleanup function,
 * this hook ensures the callback runs only on actual unmount, not on re-renders
 * or effect re-runs.
 *
 * **Important**: The callback is deferred to the next microtask to ensure the
 * component is fully unmounted before execution. This is particularly important
 * in React StrictMode, where components may mount/unmount multiple times during
 * development.
 *
 * @param callback - Function to execute when the component unmounts. The callback
 *                   is stored in a ref, so it can be updated without causing
 *                   the effect to re-run.
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   useUnmount(() => {
 *     console.log('Component unmounted');
 *     // Perform cleanup: close connections, cancel timers, etc.
 *   });
 *
 *   return <div>Content</div>;
 * };
 * ```
 */
export function useUnmount(callback: VoidFunction) {
  /**
   * Ref to track whether the component is currently unmounting.
   * Used to ensure the callback only runs if the component is still
   * unmounted after the deferred execution.
   */
  const isUnmountRef = useRef(false);

  /**
   * Ref to store the callback function.
   * Using a ref allows the callback to be updated without causing
   * the effect to re-run, while always accessing the latest callback.
   */
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  /**
   * Reset unmount flag before effect runs.
   * This ensures that if the component re-mounts (e.g., in StrictMode),
   * the flag is reset to false.
   */
  isUnmountRef.current = false;

  /**
   * Effect that sets up the unmount detection.
   * Runs once on mount (empty dependency array) and returns a cleanup
   * function that will be called when the component unmounts.
   */
  useLayoutEffect(() => {
    // Reset flag when effect runs (component is mounting/re-mounting)
    isUnmountRef.current = false;

    /**
     * Cleanup function that runs when the component unmounts.
     * This is called by React when the component is removed from the tree.
     */
    return () => {
      // Mark that we're in the unmount phase
      isUnmountRef.current = true;

      /**
       * Defer callback execution to the next microtask.
       *
       * This ensures:
       * 1. The component is fully unmounted before the callback runs
       * 2. In React StrictMode, if the component re-mounts immediately,
       *    the flag will be reset to false, preventing the callback from running
       * 3. Any synchronous operations during unmount complete first
       *
       * The Promise.resolve().then() pattern schedules the callback to run
       * after the current synchronous execution completes, but before the
       * next event loop tick.
       */
      Promise.resolve().then(() => {
        // Double-check that we're still unmounting (component didn't re-mount)
        if (isUnmountRef.current) {
          // Execute the latest callback
          // Wrap in try-catch to handle errors gracefully
          try {
            callbackRef.current?.();
          } catch (error) {
            // Errors in unmount callbacks are logged but don't crash the app
            console.error("Error in useUnmount callback:", error);
          }
        }
      });
    };
  }, []);
}
