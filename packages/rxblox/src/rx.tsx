import {
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  type JSXElementConstructor,
  createElement,
  memo,
  useLayoutEffect,
  ReactElement,
  useState,
} from "react";
import { trackingDispatcher, trackingToken } from "./trackingDispatcher";
import { emitter } from "./emitter";
import { useRerender } from "./useRerender";
import { Signal } from "./types";
import { isSignal } from "./signal";
import { syncOnly } from "./utils/syncOnly";
import { getContextType, withDispatchers } from "./dispatcher";
import { isDiff } from "./isDiff";
import { Loadable, isLoadable } from "./loadable";
import { wait } from "./wait";
import { isPromiseLike } from "./isPromiseLike";

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

  /**
   * Create stable ref object containing:
   * - `result`: Cached expression result
   * - `subscribeToken`: Token that changes when dependencies change (triggers re-subscription)
   * - `dispatcher`: Tracks which signals are accessed during expression evaluation
   * - `subscribe()`: Sets up subscriptions to all tracked signals
   * - `getValue()`: Evaluates expression and detects dependency changes
   *
   * Using useState ensures this is created once and persists across renders.
   */
  const [ref] = useState(() => {
    const onCleanup = emitter();
    const dispatcher = trackingDispatcher();
    // Token that changes when dependencies change, triggering useLayoutEffect to re-subscribe
    const subscribeToken = { current: {} };

    const recompute = () => {
      // Skip if already rendering to prevent redundant re-renders in same cycle
      // This enables debouncing when multiple signals change synchronously
      if (rerender.rendering()) {
        return;
      }

      try {
        // Re-evaluate expression and check if dependencies changed
        const { value: nextValue, dependencyChanged } = ref.getValue();

        // Trigger re-render if:
        // 1. Dependencies changed (need to re-subscribe)
        // 2. This is the first evaluation (!ref.result)
        // 3. Value changed (result !== nextValue)
        if (
          dependencyChanged ||
          !ref.result ||
          ref.result.value !== nextValue
        ) {
          ref.result = { value: nextValue };
          rerender({});
        }
      } catch (ex) {
        // On error: cleanup subscriptions, clear dispatcher, and trigger immediate error re-render
        onCleanup.emitAndClear();
        dispatcher.clear();
        rerender.immediate({ error: ex });
      }
    };

    return {
      result: undefined as { value: unknown } | undefined,
      subscribeToken,
      dispatcher,
      subscribe() {
        // Clear previous subscriptions before setting up new ones
        // This prevents accumulating duplicate subscriptions across re-subscriptions
        onCleanup.emitAndClear();

        try {
          // Subscribe to all signals that were accessed during the most recent evaluation
          // Each signal will call recompute() when it changes
          for (const subscribable of dispatcher.subscribables) {
            onCleanup.on(subscribable.on(recompute));
          }
        } catch (ex) {
          // If subscription fails, clean up and trigger immediate error re-render
          // Errors should be handled immediately, not debounced
          onCleanup.emitAndClear();
          rerender.immediate({ error: ex });
          return;
        }

        // Return cleanup function that will be called by useLayoutEffect
        // when dependencies change or component unmounts
        return () => {
          // Cancel any pending debounced rerender to prevent updates after unmount
          rerender.cancel();
          onCleanup.emitAndClear();
        };
      },
      getValue() {
        // Take snapshot of current dependencies before clearing
        const prevSubscribables = new Set(dispatcher.subscribables);

        // Clear dispatcher to track new dependencies during evaluation
        dispatcher.clear();

        /**
         * Evaluate the expression with tracking enabled.
         *
         * syncOnly() ensures the expression is synchronous - it will throw if:
         * - The expression returns a Promise (async function)
         * - The expression returns any PromiseLike value
         *
         * This is critical because React components must render synchronously.
         * Use signal.async() or handle async operations in effects instead.
         */
        const value = syncOnly(
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

        // Compare old and new dependencies to detect changes
        let dependencyChanged = false;
        const nextSubscribables = new Set(dispatcher.subscribables);
        if (isDiff(prevSubscribables, nextSubscribables)) {
          dependencyChanged = true;
          // Update token to trigger useLayoutEffect re-subscription
          subscribeToken.current = {};
        }

        return { value, dependencyChanged };
      },
    };
  });

  // Re-throw errors caught during expression evaluation
  // This allows ErrorBoundary components to catch and handle them
  if (rerender.data?.error) {
    throw rerender.data.error;
  }

  // Initialize on first render: evaluate expression and track dependencies
  if (!ref.result) {
    const { value } = ref.getValue();
    ref.result = { value };
  }

  // Subscribe to all tracked signals
  // Re-runs when subscribeToken.current changes (i.e., when dependencies change)
  useLayoutEffect(() => {
    return ref.subscribe();
  }, [ref.subscribeToken.current]);

  const result = ref.result?.value;

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

export type AwaitableOrSignal = Signal<any> | PromiseLike<any> | Loadable<any>;

export type AwaitedSignalValue<T> = T extends Signal<infer TValue>
  ? TValue extends Loadable<any>
    ? Awaited<TValue["promise"]>
    : Awaited<TValue>
  : T extends Loadable<any>
  ? Awaited<T["promise"]>
  : Awaited<T>;

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
 * Creates a reactive expression with named async dependencies (object shape).
 *
 * This overload accepts an object/record of awaitables and provides named parameters
 * to the render function. This is especially useful for components with many dependencies.
 *
 * @param shape - Object mapping names to awaitables (signals, promises, loadables)
 * @param fn - Function that receives an object with unwrapped named values
 * @returns A ReactNode that renders the function result and updates when dependencies change
 *
 * @example Named dependencies for better readability
 * ```tsx
 * const user = signal.async(() => fetchUser());
 * const posts = signal.async(() => fetchPosts());
 * const settings = signal({ theme: 'dark' });
 *
 * {rx({ user, posts, settings }, ({ user, posts, settings }) => (
 *   <Dashboard
 *     user={user}
 *     posts={posts}
 *     theme={settings.theme}
 *   />
 * ))}
 * ```
 *
 * @example Mix sync and async with named parameters
 * ```tsx
 * {rx(
 *   {
 *     count: signal(0),
 *     asyncUser: signal.async(() => fetchUser()),
 *     directPromise: fetchSettings(),
 *     loadable: loadable("success", config)
 *   },
 *   ({ count, asyncUser, directPromise, loadable }) => (
 *     <div>All values are unwrapped and named!</div>
 *   )
 * )}
 * ```
 */
export function rx<const TShape extends Record<string, AwaitableOrSignal>>(
  shape: TShape,
  fn: (values: {
    [K in keyof TShape]: TShape[K] extends AwaitableOrSignal
      ? AwaitedSignalValue<TShape[K]>
      : never;
  }) => ReactNode
): ReactElement;

/**
 * Creates a reactive expression with explicit async dependencies (array).
 *
 * This overload allows you to specify which awaitables to track explicitly,
 * and receive their unwrapped values as function parameters. This provides:
 * - Better type inference
 * - Explicit dependency list (similar to React's dependency arrays)
 * - Automatic handling of async values (promises, loadables, async signals)
 * - Seamless integration with React Suspense and ErrorBoundary
 *
 * **Supported Awaitable Types:**
 * - `Signal<T>` - Regular reactive signals
 * - `Signal<Loadable<T>>` - Async signals (from `signal.async()`)
 * - `Signal<PromiseLike<T>>` - Signals containing promises
 * - `PromiseLike<T>` - Direct promises
 * - `Loadable<T>` - Direct loadable values
 * - `undefined | null | false` - Optional dependencies
 *
 * **Automatic Unwrapping:**
 * All async values are automatically unwrapped using the `wait()` API:
 * - Loading state → Throws promise (triggers React Suspense)
 * - Error state → Throws error (triggers ErrorBoundary)
 * - Success state → Returns unwrapped value `T`
 *
 * @param awaitables - Array of awaitables to track (signals, promises, loadables)
 * @param fn - Function that receives unwrapped values as arguments
 * @returns A ReactNode that renders the function result and updates when dependencies change
 *
 * @example Basic usage with signals
 * ```tsx
 * const count = signal(0);
 * const multiplier = signal(2);
 *
 * {rx([count, multiplier], (c, m) => (
 *   <div>{c} × {m} = {c * m}</div>
 * ))}
 * ```
 *
 * @example With async signals (automatic Suspense)
 * ```tsx
 * const user = signal.async(() => fetchUser(userId));
 * const posts = signal.async(() => fetchPosts(userId));
 *
 * // Automatically waits for both signals and unwraps values
 * // Suspends while loading, throws if error, renders when success
 * {rx([user, posts], (userData, postsData) => (
 *   <div>
 *     <h1>{userData.name}</h1>
 *     <PostList posts={postsData} />
 *   </div>
 * ))}
 * ```
 *
 * @example With direct promises
 * ```tsx
 * const userPromise = fetchUser(userId);
 * const postsPromise = fetchPosts(userId);
 *
 * // Directly pass promises - they will be automatically awaited
 * {rx([userPromise, postsPromise], (user, posts) => (
 *   <UserProfile user={user} posts={posts} />
 * ))}
 * ```
 *
 * @example With loadables
 * ```tsx
 * const userLoadable = loadable("success", userData);
 * const errorLoadable = loadable("error", new Error("Failed"));
 *
 * {rx([userLoadable], (user) => (
 *   <div>{user.name}</div>
 * ))}
 * ```
 *
 * @example Mixed sync and async
 * ```tsx
 * const syncCount = signal(0);
 * const asyncUser = signal.async(() => fetchUser());
 * const directPromise = fetchSettings();
 *
 * {rx([syncCount, asyncUser, directPromise], (count, user, settings) => (
 *   <Dashboard count={count} user={user} settings={settings} />
 * ))}
 * ```
 *
 * @example With optional dependencies
 * ```tsx
 * const maybeSignal = condition ? signal(5) : undefined;
 * {rx([count, maybeSignal], (c, value) => (
 *   <div>Count: {c}, Value: {value ?? 'N/A'}</div>
 * ))}
 * ```
 */
export function rx<const TAwaitables extends readonly AwaitableOrSignal[]>(
  signals: TAwaitables,
  fn: (
    ...values: {
      [K in keyof TAwaitables]: TAwaitables[K] extends AwaitableOrSignal
        ? AwaitedSignalValue<TAwaitables[K]>
        : never;
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
 * This function dispatches to different implementations based on argument patterns:
 * 1. Array as first arg → rx([signals], fn) - Explicit signal dependencies
 * 2. Single function arg → rx(() => ...) - Expression-based reactive rendering
 * 3. Two args → rx(component, props) - Auto-reactive component creation
 *
 * All overloads construct an expression function that is passed to the Reactive
 * component, which handles dependency tracking and re-rendering.
 */
export function rx(...args: any[]): ReactNode {
  // Validate context: nested rx() blocks and rx() in batch() are not allowed
  const contextType = getContextType();
  if (contextType === "rx") {
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

  if (contextType === "batch") {
    throw new Error(
      "Cannot create rx() blocks inside batch(). " +
        "batch() is for grouping signal updates, not creating reactive UI.\n\n" +
        "❌ Don't do this:\n" +
        "  batch(() => {\n" +
        "    const view = rx(() => <div>{count()}</div>);  // Wrong scope!\n" +
        "    count.set(1);\n" +
        "  })\n\n" +
        "✅ Instead, create rx() outside batch:\n" +
        "  const view = rx(() => <div>{count()}</div>);  // Create outside\n" +
        "  batch(() => {\n" +
        "    count.set(1);  // Just update signals inside\n" +
        "    count.set(2);\n" +
        "  });\n\n" +
        "See: https://github.com/linq2js/rxblox/blob/main/packages/rxblox/docs/context-and-scope.md"
    );
  }

  /**
   * Expression function that will be passed to the Reactive component.
   * The following logic determines which overload was called and constructs
   * the appropriate expression function.
   */
  let exp: () => ReactNode;

  /**
   * Unwraps an awaitable value into its resolved form.
   *
   * This helper handles multiple types of awaitable values and normalizes them
   * for use in reactive expressions. It integrates with React Suspense and ErrorBoundary
   * by throwing promises (loading) or errors (failed) when appropriate.
   *
   * **Behavior by type:**
   * - `undefined | null | false` → Returns `undefined`
   * - `Signal<T>` → Calls signal and returns value
   * - `Signal<Loadable<T>>` → Calls signal, then waits for loadable (throws promise/error if needed)
   * - `Signal<PromiseLike<T>>` → Calls signal, then waits for promise (throws promise/error if needed)
   * - `PromiseLike<T>` → Waits for promise using wait() (throws promise/error if needed)
   * - `Loadable<T>` → Waits for loadable using wait() (throws promise/error if needed)
   * - Other types → Returns as-is
   *
   * **Integration with React:**
   * - Loading state: Throws promise → Caught by React Suspense
   * - Error state: Throws error → Caught by ErrorBoundary
   * - Success state: Returns unwrapped value
   *
   * @param awaitable - Value to unwrap
   * @returns Unwrapped value, or throws promise/error for async states
   */
  const unwrapAwaitable = (awaitable: any) => {
    // Handle falsy values (undefined, null, false)
    if (!awaitable) {
      return undefined;
    }

    // Handle signals
    if (typeof awaitable === "function") {
      const value = (awaitable as Signal<any>)();

      // If signal value is loadable or promise, use wait() to unwrap
      // wait() will throw promise (Suspense) or error (ErrorBoundary) as needed
      if (isLoadable(value) || isPromiseLike(value)) {
        return wait(awaitable as Signal<any>);
      }

      return value;
    }

    // Handle direct promises and loadables
    // wait() will throw promise (Suspense) or error (ErrorBoundary) as needed
    if (isLoadable(awaitable) || isPromiseLike(awaitable)) {
      return wait(awaitable as any);
    }

    // Unknown type - return as-is
    return awaitable;
  };

  /**
   * Overload Dispatch Logic
   *
   * Determines which overload was called based on the arguments pattern
   * and constructs the appropriate expression function:
   *
   * 1. Object + function → rx({ key: awaitable }, (values) => ...)
   * 2. Array + function → rx([awaitables], (...values) => ...)
   * 3. Single function → rx(() => ...)
   * 4. Two args (not array) → rx(Component, props)
   */

  // Overload 1: rx({ shape }, fn)
  // Object shape with named dependencies
  if (
    args[0] &&
    !Array.isArray(args[0]) &&
    typeof args[0] === "object" &&
    typeof args[1] === "function"
  ) {
    const shape = args[0] as Record<string, any>;
    const fn = args[1] as (values: Record<string, any>) => ReactNode;

    // Build expression that unwraps each awaitable in the shape
    exp = () => {
      const unwrappedValues: Record<string, any> = {};

      for (const key in shape) {
        unwrappedValues[key] = unwrapAwaitable(shape[key]);
      }

      return fn(unwrappedValues);
    };
  }
  // Overload 2: rx([awaitables], fn)
  // Explicit dependency list - unwraps signals/promises/loadables and passes values to callback
  else if (Array.isArray(args[0])) {
    const awaitables = args[0] as readonly (
      | Signal<any>
      | PromiseLike<any>
      | Loadable<any>
      | undefined
      | null
      | false
    )[];
    const fn = args[1] as (...args: any[]) => ReactNode;

    // Build expression that unwraps each awaitable (or undefined for falsy values)
    exp = () => fn(...awaitables.map(unwrapAwaitable));
  }
  // Overload 3: rx(() => ...)
  // Expression-based - automatically tracks accessed signals
  else if (args.length === 1) {
    exp = args[0];
  }
  // Overload 4: rx(component, props)
  // Component-based - auto-unwraps signal props during render
  else {
    if (!args[1]) {
      throw new Error("Invalid arguments");
    }

    const componentType = args[0] as ComponentType<any>;
    const componentProps: ComponentProps<typeof componentType> = args[1];

    // Separate static props (primitives, objects) from dynamic props (signals)
    const staticProps: Record<string, any> = {};
    const dynamicProps: [string, Signal<any>][] = [];

    Object.entries(componentProps).forEach(([key, value]) => {
      if (isSignal(value)) {
        // Signals are stored separately and unwrapped on each render
        dynamicProps.push([key, value]);
      } else {
        // Static values are copied once
        staticProps[key] = value;
      }
    });

    // Build expression that merges static props with unwrapped dynamic props
    exp = () => {
      const finalProps = { ...staticProps };
      // Unwrap each signal prop by calling it
      dynamicProps.forEach(([key, signal]) => {
        finalProps[key] = signal();
      });
      return createElement(componentType, finalProps);
    };
  }

  /**
   * Create and return the Reactive component with the constructed expression.
   *
   * The Reactive component will:
   * - Execute the expression and track all signal dependencies
   * - Subscribe to tracked signals and re-render on changes
   * - Handle errors by re-throwing them for ErrorBoundary
   * - Manage subscription cleanup on unmount or dependency changes
   */
  return <Reactive exp={exp} />;
}
