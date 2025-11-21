import { useMemo, useState, useLayoutEffect } from "react";
import { Disposable, UseScopeOptions } from "./types";
import { shallowEquals } from "./utils/shallowEquals";
import { isSignal } from "./signal";

/**
 * useScope - Create component-scoped disposables
 *
 * Creates signals and other disposables that are automatically cleaned up
 * when the component unmounts. Optionally recreate when dependencies change.
 *
 * **Lifecycle:**
 * 1. Creates scope on mount (or when watch deps change)
 * 2. Calls onUpdate callback when scope or update deps change
 * 3. Calls onDispose callback + disposes all disposables on unmount
 *
 * **Disposal:**
 * - Only items in the `dispose` property are automatically disposed
 * - You can return non-disposable values (functions, plain objects) without them being disposed
 * - This allows you to expose helper functions or keep signals private
 * - `dispose` can be:
 *   - A single `VoidFunction` - invoked directly
 *   - A single `Disposable` - calls `dispose()` method
 *   - An array `(VoidFunction | Disposable)[]` - handles each item
 *
 * **Watch dependencies:**
 * - `watch`: Controls when scope is recreated (like useEffect deps)
 * - `onUpdate` tuple form: Second element controls when onUpdate runs
 *
 * @param create - Factory function that creates scope (can include `dispose` property)
 * @param options - Optional configuration
 * @returns The created scope
 *
 * @example Basic usage with array
 * ```tsx
 * const { count, doubled } = useScope(() => ({
 *   count: signal(0),
 *   doubled: signal({ count }, ({ deps }) => deps.count * 2),
 *   dispose: [count, doubled], // Array of disposables
 * }));
 * ```
 *
 * @example Single disposable
 * ```tsx
 * const { connection } = useScope(() => ({
 *   connection: createWebSocket(),
 *   dispose: createWebSocket(), // Single Disposable
 * }));
 * ```
 *
 * @example Single function
 * ```tsx
 * const { timer } = useScope(() => {
 *   const intervalId = setInterval(() => {}, 1000);
 *   return {
 *     timer: signal(0),
 *     dispose: () => clearInterval(intervalId), // Single cleanup function
 *   };
 * });
 * ```
 *
 * @example With helper functions (not disposed)
 * ```tsx
 * const { count, increment, reset } = useScope(() => {
 *   const count = signal(0);
 *   return {
 *     count,
 *     increment: () => count.set(count() + 1), // Helper - not disposed
 *     reset: () => count.set(0), // Helper - not disposed
 *     dispose: [count], // Only dispose count signal
 *   };
 * });
 * ```
 *
 * @example Service composition pattern
 * ```tsx
 * const createService3 = () => {
 *   const service1 = createService1();
 *   const service2 = createService2();
 *
 *   return {
 *     // Option 1: Array of disposables
 *     dispose: [service1, service2],
 *
 *     // Option 2: Custom dispose method
 *     // dispose() {
 *     //   service1.dispose();
 *     //   service2.dispose();
 *     // },
 *
 *     customMethod() {
 *       // Use service1 and service2
 *     },
 *   };
 * };
 *
 * // Global usage - no automatic disposal
 * const service3 = createService3();
 *
 * // Component usage - automatic disposal on unmount
 * const service3 = useScope(createService3);
 * ```
 *
 * @example With watch (recreate on prop change)
 * ```tsx
 * const { userData } = useScope(
 *   () => ({ userData: signal(fetchUser(userId)) }),
 *   { watch: [userId] } // Recreate when userId changes
 * );
 * ```
 *
 * @example With onUpdate (sync with props)
 * ```tsx
 * const { timer } = useScope(
 *   () => ({ timer: signal(0) }),
 *   {
 *     onUpdate: [(scope) => {
 *       scope.timer.set(propValue); // Sync with latest prop
 *     }, propValue], // Re-run when propValue changes
 *     watch: [] // Don't recreate scope
 *   }
 * );
 * ```
 *
 * @example With onDispose (custom cleanup)
 * ```tsx
 * const { connection } = useScope(
 *   () => ({ connection: createWebSocket() }),
 *   {
 *     onDispose: (scope) => {
 *       console.log('Closing connection');
 *       scope.connection.close();
 *     }
 *   }
 * );
 * ```
 */
export function useScope<TScope>(
  create: () => {
    dispose?: VoidFunction | Disposable | (VoidFunction | Disposable)[];
  } & TScope,
  options?: UseScopeOptions<TScope>
): TScope {
  const { watch, onUpdate, onDispose } = options || {};

  // Persistent ref object that survives re-renders
  // Stores options in a stable reference to avoid dependency array issues
  // This pattern allows us to update options without recreating the ref
  const [ref] = useState(() => {
    return {
      watch, // Dependencies that trigger scope recreation
      onUpdate: undefined as ((scope: TScope) => void) | undefined, // Update callback
      onUpdateDeps: [] as unknown[], // Dependencies for onUpdate callback
      onDispose: undefined as ((scope: TScope) => void) | undefined, // Dispose callback
    };
  });

  const onUpdateDeps = Array.isArray(onUpdate) ? onUpdate.slice(1) : [];
  // Update ref with latest options on each render
  // This allows options to change without recreating the ref
  Object.assign(ref, {
    watch,
    // Handle onUpdate in two forms:
    // 1. Function: onUpdate = (scope) => { ... }
    // 2. Tuple: onUpdate = [(scope) => { ... }, dep1, dep2, ...]
    onUpdate: typeof onUpdate === "function" ? onUpdate : onUpdate?.[0],
    // Extract watch dependencies from tuple form (everything after first element)
    // Maintain reference stability: reuse same array if shallowly equal
    // This ensures React's dependency comparison (Object.is) works correctly
    // Same reference = no re-render, different reference = re-render
    onUpdateDeps: shallowEquals(ref.onUpdateDeps, onUpdateDeps)
      ? ref.onUpdateDeps // Reuse same array reference if values are equal
      : onUpdateDeps, // Use new array if values differ
    onDispose,
  });

  // Recreate scope when watch dependencies change
  // Similar to useEffect dependency array - scope is recreated when deps change
  // Empty array (or undefined) means scope is created once and never recreated
  const scope = useMemo(create, ref.watch || []);

  // Cleanup effect: dispose all disposables when scope changes or component unmounts
  // Runs synchronously after render (useLayoutEffect) to ensure cleanup happens before next render
  useLayoutEffect(() => {
    return () => {
      // Call custom dispose callback first (if provided)
      // This allows user to do custom cleanup before automatic disposal
      ref.onDispose?.(scope);

      // Helper function to dispose a single item
      const disposeItem = (item: any) => {
        if (!item) return;

        // Check if it's a Signal (has SIGNAL_TYPE symbol and dispose method)
        if (isSignal(item)) {
          item.dispose();
          return;
        }

        // Check if it's a Disposable object (has dispose method)
        if (
          typeof item === "object" &&
          "dispose" in item &&
          typeof item.dispose === "function"
        ) {
          item.dispose();
          return;
        }

        // Otherwise, if it's a function, invoke it directly
        if (typeof item === "function") {
          item();
        }
      };

      // First, handle explicit dispose property if it exists
      const dispose = scope.dispose;
      if (dispose) {
        // Handle array case
        if (Array.isArray(dispose)) {
          for (const item of dispose) {
            disposeItem(item);
          }
          return;
        }

        // Handle single Disposable object or VoidFunction
        disposeItem(dispose);
      }

      // Then, iterate over all properties of the scope and dispose any disposables
      // This handles cases where properties are signals or have dispose methods
      // Note: Only disposes direct properties, not nested objects
      for (const key in scope as any) {
        if (key === "dispose") continue; // Already handled above

        const value = (scope as any)[key];
        if (isSignal(value)) {
          // Signal has dispose method
          value.dispose();
        } else if (
          value &&
          typeof value === "object" &&
          "dispose" in value &&
          typeof value.dispose === "function"
        ) {
          // Object with dispose method
          value.dispose();
        }
        // Functions and other values are not automatically disposed
      }
    };
  }, [scope]); // Re-run cleanup when scope reference changes

  // Update effect: call onUpdate callback when scope or update dependencies change
  // Using useLayoutEffect (not useMemo) because this is a side effect, not memoization
  // Runs synchronously after render to ensure updates happen before paint
  useLayoutEffect(() => {
    ref.onUpdate?.(scope);
    // if onUpdateDeps is empty, use an empty object to trigger re-render
  }, [!ref.onUpdateDeps?.length ? {} : ref.onUpdateDeps, scope]);

  return scope;
}
