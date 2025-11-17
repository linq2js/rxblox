import {
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  type JSXElementConstructor,
  createElement,
  memo,
  useLayoutEffect,
  useMemo,
  ReactElement,
  useRef,
} from "react";
import { trackingDispatcher, trackingToken } from "./trackingDispatcher";
import { emitter } from "./emitter";
import { useRerender } from "./useRerender";
import { Signal } from "./types";
import { isSignal } from "./signal";
import { syncOnly } from "./utils/syncOnly";
import { getContextType, withDispatchers } from "./dispatcher";

/**
 * Reactive component that automatically re-renders when its signal dependencies change.
 *
 * This component:
 * - Executes the expression function and tracks which signals are accessed
 * - Subscribes to all accessed signals
 * - Re-renders automatically when any tracked signal changes
 * - Updates subscriptions when signal dependencies change
 * - Handles errors gracefully by re-throwing them for ErrorBoundary to catch
 *
 * The component is memoized to prevent unnecessary re-renders when props don't change.
 */
export const Reactive = memo((props: { exp: () => unknown }) => {
  // State used to trigger re-renders and track errors
  const rerender = useRerender<{
    error?: unknown;
  }>();
  const resultEvaluated = useRef(false);
  // Signal dispatcher is stable across renders - created once and reused
  // We use useMemo instead of useState to pass required parameters
  const dispatcher = useMemo(() => {
    return trackingDispatcher();
  }, []);

  // Re-throw errors so ErrorBoundary can catch them
  if (rerender.data?.error) {
    throw rerender.data.error;
  }

  /**
   * Subscribes to signal changes and sets up cleanup.
   * This effect:
   * 1. Creates an emitter to manage cleanup functions
   * 2. Subscribes to all currently tracked signals
   * 3. When any signal changes, triggers a re-render via rerender()
   * 4. Cleans up subscriptions when dependencies change or component unmounts
   *
   * Re-runs when:
   * - dispatcher changes (shouldn't happen)
   * - recomputeToken changes (when signal dependencies change)
   */
  useLayoutEffect(() => {
    const onCleanup = emitter();
    const recompute = () => {
      if (!rerender.rendering() || resultEvaluated.current) {
        rerender({});
      }
    };
    try {
      // Subscribe to all dependencies that were accessed during expression evaluation
      for (const subscribable of dispatcher.subscribables) {
        onCleanup.on(subscribable.on(recompute));
      }
    } catch (ex) {
      // If subscription fails, clean up and set error state
      // Errors should be handled immediately, not debounced
      onCleanup.emitAndClear(undefined);
      rerender.immediate({ error: ex });
      return;
    }

    // Cleanup function: unsubscribe from all signals when effect re-runs or component unmounts
    return () => {
      // Cancel any pending debounced rerender to prevent updates after unmount
      rerender.cancel();
      onCleanup.emitAndClear(undefined);
    };
  });

  resultEvaluated.current = false;

  /**
   * Computes the expression result and tracks signal dependencies.
   * This runs during render and:
   * 1. Saves the previous set of signals
   * 2. Clears the dispatcher to track new signals
   * 3. Executes the expression (which may access signals)
   * 4. Compares old and new signal sets
   * 5. Updates recomputeToken if signals changed (to trigger effect re-run)
   *
   * The result is memoized based on dispatcher, props.exp, and rerender.data
   * to avoid unnecessary recomputations.
   */
  const result = useMemo(() => {
    dispatcher.clear();
    return syncOnly(
      () =>
        withDispatchers([trackingToken(dispatcher)], props.exp, {
          contextType: "rx",
        }),
      {
        message:
          "rx() expression cannot return a promise. " +
          "React components must render synchronously. " +
          "If you need async data, use signal.async() or handle async operations in effects.",
        context: "rx()",
        mode: "error",
      }
    );
  }, [dispatcher, props.exp, rerender.data]);

  resultEvaluated.current = true;

  // Return the computed result, or null if result is null/undefined
  // Functions are not valid React children, so convert them to null
  // This prevents React warnings about invalid children
  if (typeof result === "function") {
    return null;
  }
  // Cast to ReactNode to satisfy TypeScript
  return (result ?? null) as unknown as ReactNode;
});
Reactive.displayName = "rx";

/**
 * Creates a reactive component with auto-reactive props.
 *
 * This overload automatically unwraps signal props when creating a component.
 * Any prop that is a signal will be automatically called (unwrapped) when rendering.
 * This is convenient for simple component creation with reactive props.
 *
 * @param componentType - Component type (string for HTML elements or component constructor)
 * @param componentProps - Props object where signal values are automatically unwrapped
 * @returns A ReactNode that re-renders when any signal props change
 *
 * @example
 * ```tsx
 * const title = signal("Hello");
 * const count = signal(42);
 *
 * // Auto-unwraps signal props
 * {rx("div", {
 *   title: title,           // Automatically becomes title()
 *   className: "box",       // Static props stay as-is
 *   children: count,        // Signal child also unwrapped
 * })}
 *
 * // Equivalent to:
 * {rx(() => <div title={title()} className="box">{count()}</div>)}
 *
 * // Works with custom components too
 * {rx(MyComponent, { value: count, label: "Count" })}
 * ```
 */
export function rx<
  TComponentType extends
    | keyof JSX.IntrinsicElements
    | JSXElementConstructor<any>
>(
  componentType: TComponentType,
  componentProps: {
    [key in ComponentProps<TComponentType>]:
      | Signal<ComponentProps<TComponentType>>
      | ComponentProps<TComponentType>;
  }
): ReactNode;

/**
 * Creates a reactive expression with explicit signal dependencies.
 *
 * This overload allows you to specify which signals to track explicitly,
 * and receive their unwrapped values as function parameters. This provides:
 * - Better type inference
 * - Explicit dependency list (similar to React's dependency arrays)
 * - Potential performance optimization (only tracks listed signals)
 *
 * @param signals - Array of signals to track. Can include undefined/null/false for conditional signals.
 * @param fn - Function that receives unwrapped signal values as arguments
 * @returns A ReactNode that renders the function result and updates when signals change
 *
 * @example
 * ```tsx
 * const count = signal(0);
 * const multiplier = signal(2);
 *
 * // Explicit dependencies - count and multiplier
 * {rx([count, multiplier], (c, m) => (
 *   <div>{c} × {m} = {c * m}</div>
 * ))}
 *
 * // With optional signals
 * const maybeSignal = condition ? signal(5) : undefined;
 * {rx([count, maybeSignal], (c, value) => (
 *   <div>Count: {c}, Value: {value ?? 'N/A'}</div>
 * ))}
 * ```
 */
export function rx<
  const TSignals extends readonly (Signal<any> | undefined | null | false)[]
>(
  signals: TSignals,
  fn: (
    ...values: {
      [K in keyof TSignals]: TSignals[K] extends Signal<infer T>
        ? // Signal type - check if it's required or optional
          // Check if there's anything besides Signal<T> in the union
          // If Exclude leaves nothing (never), signal is required → return T
          // If Exclude leaves something (undefined/null/false), signal is optional → return T | undefined
          [Exclude<TSignals[K], Signal<T>>] extends [never]
          ? T
          : T | undefined
        : // Non-signal values (undefined, null, false) become undefined at runtime
          undefined;
    }
  ) => ReactNode
): ReactElement;

/**
 * Creates a reactive expression that automatically updates when its signal dependencies change.
 *
 * This is the original and most flexible overload. It executes the expression function
 * and automatically tracks all signals accessed during execution. The component will
 * re-render whenever any tracked signal changes.
 *
 * @param exp - Expression function that may access signals. The result will be rendered.
 * @returns A ReactNode that renders the expression result and updates reactively
 *
 * @example
 * ```tsx
 * const count = signal(0);
 * const name = signal("Alice");
 *
 * // Reactive expression that updates when count or name changes
 * {rx(() => (
 *   <div>
 *     <h1>Hello, {name()}!</h1>
 *     <p>Count: {count()}</p>
 *   </div>
 * ))}
 *
 * // With conditional logic
 * {rx(() => {
 *   const c = count();
 *   if (c > 10) return <div>High: {c}</div>;
 *   return <div>Low: {c}</div>;
 * })}
 * ```
 */
export function rx(exp: () => unknown): ReactNode;
/**
 * Implementation of rx() with multiple overloads.
 *
 * This function dispatches to different implementations based on the arguments:
 * 1. rx([signals], fn) - Explicit signal dependencies with callback
 * 2. rx(component, props) - Auto-reactive component creation
 * 3. rx(() => ...) - Original expression-based reactive rendering
 *
 * All overloads ultimately create a Reactive component that tracks signal
 * dependencies and re-renders when they change.
 */
export function rx(...args: any[]): ReactNode {
  // Check for nested rx() blocks - this is an anti-pattern
  if (getContextType() === "rx") {
    throw new Error(
      "Nested rx() blocks detected. This is inefficient and unnecessary.\n\n" +
        "❌ Don't do this:\n" +
        "  rx(() => <div>{rx(() => <span>nested</span>)}</div>)\n\n" +
        "✅ Instead, consolidate into a single rx() block:\n" +
        "  rx(() => <div><span>not nested</span></div>)\n\n" +
        "✅ Or move independent rx() blocks to stable scope:\n" +
        "  const block = rx(() => <span>independent</span>);\n" +
        "  return <div>{block}</div>;\n\n" +
        "See: https://github.com/linq2js/rxblox#best-practices"
    );
  }

  let exp: () => ReactNode;

  // Overload 1: rx([signals], fn)
  // Unwraps an array of signals and passes their values to the callback
  if (Array.isArray(args[0])) {
    const maybeSignals = args[0] as readonly (
      | Signal<any>
      | undefined
      | null
      | false
    )[];
    const fn = args[1] as (...args: any[]) => ReactNode;

    // Create expression that unwraps each signal (or returns undefined for non-signals)
    exp = () =>
      fn(
        ...maybeSignals.map((s) => (typeof s === "function" ? s() : undefined))
      );
  }
  // Overload 3: rx(() => ...)
  // Simple expression function - the original and most flexible overload
  else if (args.length === 1) {
    exp = args[0];
  }
  // Overload 2: rx(component, props)
  // Auto-reactive component with signal props automatically unwrapped
  else {
    if (!args[1]) {
      throw new Error("Invalid arguments");
    }

    const componentType = args[0] as ComponentType<any>;
    const componentProps: ComponentProps<typeof componentType> = args[1];

    // Separate props into static (non-signal) and dynamic (signal) props
    const staticProps: Record<string, any> = {};
    const dynamicProps: [string, Signal<any>][] = [];

    Object.entries(componentProps).forEach(([key, value]) => {
      if (isSignal(value)) {
        // Store signal props separately for unwrapping during render
        dynamicProps.push([key, value]);
      } else {
        // Static props can be copied directly
        staticProps[key] = value;
      }
    });

    // Create expression that unwraps dynamic props and merges with static props
    exp = () => {
      const finalProps = { ...staticProps };
      // Unwrap each signal prop by calling it
      dynamicProps.forEach(([key, signal]) => {
        finalProps[key] = signal();
      });
      return createElement(componentType, finalProps);
    };
  }

  // All overloads create a Reactive component with the constructed expression
  return <Reactive exp={exp} />;
}
