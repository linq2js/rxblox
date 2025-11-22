import { memo, ReactNode, useCallback, useMemo, useRef } from "react";
import { SignalMap, ResolveValue, AnyFunc, Signal } from "../types";
import { RxOptions } from "./types";
import { shallowEquals } from "../utils/shallowEquals";
import { useSignals } from "./useSignals";
import { isSignal } from "../signal";

/**
 * Render function signature for overload 2 (with signals).
 * Receives both awaited (Suspense) and loadable (manual) proxies.
 */
export type RxRender<TAwaited, TLoadable> = (
  awaited: TAwaited,
  loadable: TLoadable
) => ReactNode;

const EMPTY_SIGNALS: SignalMap = {};
// Single signal render function - extracts value from { value: signal } wrapper
const SINGLE_SIGNAL_RENDER = (awaited: any) => awaited.value;

/**
 * rx - Reactive rendering for signals
 *
 * Three overloads:
 * 1. **Static or manual control**: `rx(() => ReactNode, { watch?: [...] })`
 *    - No signal tracking by default
 *    - Re-renders only when watch array changes
 *    - Use for static content or manual dependency management
 *
 * 2. **Single signal**: `rx(signal, { watch?: [...] })`
 *    - Automatically renders the awaited value of the signal
 *    - Equivalent to: `rx({ value: signal }, (awaited) => awaited.value)`
 *    - Convenient shorthand for displaying a single value
 *
 * 3. **Reactive with signals**: `rx(signals, (awaited, loadable) => ReactNode, { watch?: [...] })`
 *    - Automatic lazy signal tracking via proxies
 *    - Re-renders when accessed signals change
 *    - Provides both Suspense (awaited) and manual (loadable) access patterns
 *    - Watch array controls when render function reference changes
 *
 * @example Overload 1 - Static render
 * ```tsx
 * rx(() => <div>Static content</div>)
 * ```
 *
 * @example Overload 1 - Manual watch
 * ```tsx
 * rx(() => <div>User: {userId}</div>, { watch: [userId] })
 * ```
 *
 * @example Overload 2 - Single signal
 * ```tsx
 * const count = signal(42);
 * rx(count) // Renders: 42
 * ```
 *
 * @example Overload 3 - Reactive with Suspense
 * ```tsx
 * rx({ user, posts }, (awaited) => (
 *   <div>{awaited.user.name}</div>
 * ))
 * ```
 *
 * @example Overload 3 - Reactive with loadable
 * ```tsx
 * rx({ data }, (_, loadable) => {
 *   if (loadable.data.status === 'loading') return <Spinner />;
 *   return <div>{loadable.data.value}</div>;
 * })
 * ```
 */

// Overload 1: Static or manual control
export function rx(render: () => ReactNode, options?: RxOptions): ReactNode;

// Overload 2: Single signal - automatically renders awaited value
export function rx<T>(signal: Signal<T>, options?: RxOptions): ReactNode;

// Overload 3: Explicit signals with awaited + loadable access
export function rx<TSignals extends SignalMap>(
  signals: TSignals,
  render: RxRender<
    ResolveValue<TSignals, "awaited">,
    ResolveValue<TSignals, "loadable">
  >,
  options?: RxOptions
): ReactNode;

// Implementation - Parse arguments and delegate to component
export function rx(...args: any[]): ReactNode {
  let render: AnyFunc;
  let options: RxOptions | undefined;
  let signals: SignalMap | undefined;

  // Parse arguments to determine which overload was called
  // Check isSignal FIRST because signals are also functions
  if (isSignal(args[0])) {
    // Overload 2: rx(signal, options?)
    // Transform single signal into { value: signal } format
    signals = { value: args[0] };
    render = SINGLE_SIGNAL_RENDER;
    options = args[1];
  } else if (typeof args[0] === "function") {
    // Overload 1: rx(render, options?)
    [render, options] = args;
    // signals remains undefined
  } else {
    // Overload 3: rx(signals, render, options?)
    [signals, render, options] = args;
  }

  // Delegate to Rx component where hooks can be safely called
  return <Rx render={render} signals={signals} options={options} />;
}

/**
 * Internal component that handles hook calls for both overloads.
 *
 * This component is necessary because:
 * 1. Hooks cannot be called conditionally in rx() function
 * 2. Both overloads need memoization but in different ways
 * 3. Moving logic to a component ensures hooks are always called in same order
 *
 * Control flow:
 * - If signals provided (overload 2): renders <RxWithSignals> with lazy tracking
 * - If no signals (overload 1): returns memoized result directly
 */
const Rx = (props: {
  render: AnyFunc;
  signals: SignalMap | undefined;
  options: RxOptions | undefined;
}) => {
  const { render, signals, options } = props;

  // Track which overload is being used (signals provided or not)
  // Using ref to avoid re-renders when checking this flag
  const hasSignalsRef = useRef(false);
  hasSignalsRef.current = signals !== undefined;

  // Store render function in ref to keep it stable across re-renders
  // while allowing the latest version to be called
  const renderRef = useRef(render);
  renderRef.current = render;

  // Memoize render function for overload 2 (with signals)
  // Dependencies: watch array controls when render function ref changes
  // Used by: <RxWithSignals> component
  const memoizedRender = useCallback<RxRender<any, any>>(
    (awaited, loadable) => renderRef.current?.(awaited, loadable) ?? null,
    options?.watch || []
  );

  // Memoize result for overload 1 (no signals)
  // Dependencies: watch array controls when to re-render
  // Returns: null if signals present (unused), otherwise render result
  const memoizedResult = useMemo(
    () => (hasSignalsRef.current ? null : renderRef.current?.() ?? null),
    options?.watch || []
  );

  // Branch based on overload (determined by presence of signals)
  if (hasSignalsRef.current) {
    // Overload 2: Use RxWithSignals for lazy signal tracking
    return (
      <RxWithSignals
        render={memoizedRender}
        signals={signals ?? EMPTY_SIGNALS}
      />
    );
  }

  // Overload 1: Return memoized result directly (no signal tracking)
  return memoizedResult;
};

/**
 * Memoized component for overload 2 (reactive signal tracking).
 *
 * Responsibilities:
 * 1. Creates lazy tracking proxies via useSignals hook
 * 2. Provides both awaited (Suspense) and loadable (manual) proxies
 * 3. Only re-renders when:
 *    - render function reference changes (via watch deps)
 *    - signals object reference changes (shallow comparison)
 *    - accessed signals change (via useSignals subscriptions)
 *
 * Performance optimization:
 * - memo() prevents re-renders when parent re-renders
 * - Custom comparison checks render ref and signals object
 * - Lazy tracking via proxies: only subscribes to accessed signals
 *
 * @example
 * ```tsx
 * // Only subscribes to user signal (not posts)
 * <RxWithSignals
 *   signals={{ user, posts }}
 *   render={(awaited) => <div>{awaited.user.name}</div>}
 * />
 * ```
 */
const RxWithSignals = memo(
  (props: { render: RxRender<any, any>; signals: SignalMap }) => {
    // Get awaited and loadable proxies
    // useSignals handles:
    // - Lazy subscription (only when signals accessed)
    // - Automatic cleanup on unmount
    // - Re-rendering when tracked signals change
    const [awaited, loadable] = useSignals(props.signals);

    // Call render with both proxy types
    // awaited: throws promises for Suspense
    // loadable: returns { status, value?, error?, promise? }
    return props.render(awaited, loadable);
  },
  // Custom comparison to prevent unnecessary re-renders
  (prev, next) => {
    return (
      // Same render function reference (stable via useCallback)
      prev.render === next.render &&
      // Same signals object (shallow comparison of signal references)
      shallowEquals(prev.signals, next.signals)
    );
  }
);
