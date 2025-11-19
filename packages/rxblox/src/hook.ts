import { onEvent } from "./eventDispatcher";
import { getContextType } from "./dispatcher";

/**
 * Creates a ref to capture values from React hooks during the render phase.
 *
 * This is useful in `blox` components where you need to use React hooks but the component
 * body only runs once. The callback runs on every render via `onEvent({ render })`, and the returned
 * value is accessible via `.current`.
 *
 * **Must be called inside a `blox` component.** Exported as `blox.hook()`.
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   const count = signal(0);
 *
 *   // Capture React hooks
 *   const router = blox.hook(() => {
 *     const history = useHistory();
 *     const location = useLocation();
 *     return { history, location };
 *   });
 *
 *   const handleNavigate = () => {
 *     router.current?.history.push("/home");
 *   };
 *
 *   return (
 *     <div>
 *       {rx(() => <div>{count()}</div>)}
 *       <button onClick={handleNavigate}>Navigate</button>
 *     </div>
 *   );
 * });
 * ```
 *
 * @template T - The type of value returned by the callback
 * @param callback - Function that runs on every render and returns a value to capture
 * @returns A ref with a `.current` property containing the captured value
 */
export function hook<T>(callback: () => T): Hook<T> {
  // Check if we're inside a blox component
  const contextType = getContextType();
  if (contextType !== "blox") {
    throw new Error(
      "blox.hook() must be called inside a blox component. " +
        "It relies on onEvent({ render }) which is only available in blox components."
    );
  }

  let current: T | undefined;

  onEvent({
    render: () => {
      current = callback();
    },
  });

  return {
    get current() {
      return current;
    },
  };
}

export type Hook<T> = {
  get current(): T | undefined;
};
