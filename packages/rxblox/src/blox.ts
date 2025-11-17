import {
  createElement,
  FC,
  ForwardedRef,
  forwardRef,
  memo,
  PropsWithoutRef,
  ReactNode,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Ref, MutableSignal } from "./types";
import { signal } from "./signal";
import { providerToken, useProviderResolver } from "./provider";
import { useRerender } from "./useRerender";
import { emitter } from "./emitter";
import { useUnmount } from "./useUnmount";
import { getDispatcher, withDispatchers } from "./dispatcher";
import { EventDispatcher, eventToken } from "./eventDispatcher";
import once from "lodash/once";
import { trackingToken } from "./trackingDispatcher";
import { disposableToken } from "./disposableDispatcher";
import { syncOnly } from "./utils/syncOnly";

/**
 * Creates a reactive component that tracks props as signals and manages effects.
 *
 * The `blox` function creates a React component that:
 * - Converts each prop into a separate signal for fine-grained reactivity
 * - Provides a ref object for imperative access to component state
 * - Collects and manages effects created during builder
 * - Automatically tracks prop access through a proxy
 * - Re-runs effects when tracked props change
 *
 * Unlike `rx`, which creates reactive expressions, `blox` creates full components
 * with their own lifecycle and effect management. Each prop becomes a signal,
 * allowing effects to track individual prop changes rather than the entire props object.
 *
 * @param builder - Function that receives props (as a proxy) and a ref object.
 *                The function can create effects that will be automatically managed.
 * @returns A memoized React component with forwardRef support
 *
 * @example
 * ```tsx
 * // Simple component without ref
 * const Counter = blox<{ count: number }>((props) => {
 *   effect(() => {
 *     console.log('Count changed:', props.count);
 *   });
 *   return <div>{props.count}</div>;
 * });
 *
 * // Component with handle for imperative access
 * const Timer = blox<{}, { start: () => void; stop: () => void }>((_props, handle) => {
 *   let interval: number | undefined;
 *
 *   handle({
 *     start: () => {
 *       interval = setInterval(() => console.log('tick'), 1000);
 *     },
 *     stop: () => {
 *       if (interval) clearInterval(interval);
 *     }
 *   });
 *
 *   return <div>Timer</div>;
 * });
 *
 * // Using with ref
 * const timerRef = createRef<{ start: () => void; stop: () => void }>();
 * <Timer ref={timerRef} />
 * timerRef.current?.start();
 * ```
 */
export function blox<TProps extends object>(
  builder: (props: PropsWithoutRef<TProps>) => ReactNode
): FC<PropsWithoutRef<TProps>>;
export function blox<TProps extends object, TRef>(
  builder: (props: PropsWithoutRef<TProps>, ref: Ref<TRef>) => ReactNode
): FC<PropsWithoutRef<TProps> & { ref?: ForwardedRef<TRef | undefined> }>;
export function blox<TProps extends object, TRef>(
  builder: (props: PropsWithoutRef<TProps>, ref: Ref<TRef>) => ReactNode
): FC<PropsWithoutRef<TProps> & { ref?: ForwardedRef<TRef | undefined> }> {
  /**
   * Internal component that manages reactive props and effects.
   *
   * This component:
   * - Maintains a ref object for imperative access
   * - Converts each prop into a separate signal
   * - Provides a proxy for props that tracks signal dependencies
   * - Collects effects during render and runs them in useLayoutEffect
   * - Re-runs effects when tracked props change
   */
  const Block = (
    props: PropsWithoutRef<TProps> & {
      forwardedRef: ForwardedRef<TRef>;
    }
  ) => {
    // Destructure to separate forwardedRef from user props
    const { forwardedRef, ...userProps } = props;

    const providerResolver = useProviderResolver();
    const [eventDispatcher] = useState(() => {
      const emitters: EventDispatcher = {
        unmount: emitter(),
        mount: emitter(),
        render: emitter(),
      };
      return {
        emitters,
        emitRender: emitters.render.emit,
        emitMount: once(() => emitters.mount.emitAndClear()),
        emitUnmount: once(() => emitters.unmount.emitAndClear()),
      };
    });

    useUnmount(eventDispatcher.emitUnmount);

    /**
     * State used to trigger re-renders when ref.current changes.
     * The state value itself is not used, only the setter to trigger updates.
     */
    const rerender = useRerender();

    /**
     * Ref object that provides imperative access to component state.
     *
     * The ref:
     * - Has a `current` property that can be set/get
     * - Automatically triggers a re-render when `current` is set to a new value
     * - Is exposed via forwardedRef using useImperativeHandle
     *
     * Created once per component instance and reused across renders.
     */
    const [ref] = useState(() => {
      let value: TRef;

      return {
        get() {
          return value;
        },
        set(v: TRef) {
          if (value !== v) {
            value = v;
            if (!rerender.rendering()) {
              rerender();
            }
          }
        },
      };
    });

    /**
     * Ref to store the current props for comparison and proxy access.
     * Used to detect prop changes and provide current prop values to the proxy.
     */
    const propsRef = useRef<PropsWithoutRef<TProps>>();

    /**
     * Signal registry that creates and caches signals for each prop key.
     *
     * This allows each prop to be tracked independently as a signal.
     * Signals are created lazily when first accessed and reused for subsequent accesses.
     *
     * Created once per component instance and reused across renders.
     */
    const signalRegistry = useMemo(() => {
      const signals = new Map<
        keyof PropsWithoutRef<TProps>,
        MutableSignal<unknown>
      >();

      return {
        tryGet: (key: keyof PropsWithoutRef<TProps>) => {
          return signals.get(key);
        },
        get: (key: keyof PropsWithoutRef<TProps>, initialValue: unknown) => {
          if (!signals.has(key)) {
            // Temporarily clear context to allow signal creation
            // Prop signals are created once per component instance, not on every render
            // Clear context type to prevent rx() validation errors
            signals.set(
              key,
              trackingToken.without(() => signal(initialValue), {
                contextType: undefined,
              })
            );
          }
          return signals.get(key)!;
        },
      };
    }, []);

    /**
     * Update propsRef immediately during render.
     * Signal updates happen in useLayoutEffect to avoid "Cannot update during render" warnings.
     */
    propsRef.current = userProps as PropsWithoutRef<TProps>;

    useLayoutEffect(() => {
      Object.entries(userProps).forEach(([key, value]) => {
        const signal = signalRegistry.tryGet(
          key as keyof PropsWithoutRef<TProps>
        );

        if (signal && signal.peek() !== value) {
          signal.set(value);
        }
      });
    });

    /**
     * Proxy object that wraps props to track signal dependencies.
     *
     * When props are accessed (e.g., `props.count`), the proxy:
     * 1. Gets or creates a signal for that prop key
     * 2. Adds the signal to the current signal dispatcher (for tracking)
     * 3. Returns the current prop value from propsRef
     *
     * This allows effects and reactive expressions (like `rx`) to automatically
     * track which props they depend on, and re-run when those props change.
     *
     * The proxy target is an empty object to avoid React's strict equality checks
     * that would fail when props change but the proxy target remains the same.
     *
     * Created once per component instance and reused across builders.
     */
    const [propsProxy] = useState(
      () =>
        new Proxy({} as PropsWithoutRef<TProps>, {
          /**
           * Intercepts property access on the props object.
           * When a prop is accessed, it tracks the corresponding signal
           * and returns the current prop value.
           */
          get(_target, prop) {
            // Get or create a signal for this prop key
            const propSignal = signalRegistry.get(
              prop as keyof PropsWithoutRef<TProps>,
              propsRef.current?.[prop as keyof PropsWithoutRef<TProps>]
            );

            // Add the signal to the current dispatcher for tracking
            // This allows effects and rx() expressions to track this prop
            getDispatcher(trackingToken)?.add(propSignal);

            // Return the current prop value
            return propsRef.current?.[prop as keyof PropsWithoutRef<TProps>];
          },
          /**
           * Returns the keys of the current props object.
           * Used by Object.keys() and similar operations.
           */
          ownKeys(_target) {
            return Object.keys(propsRef.current ?? {});
          },
          /**
           * Returns property descriptors for the current props object.
           * Used by Object.getOwnPropertyDescriptor() and similar operations.
           *
           * Returns undefined if the property doesn't exist, otherwise returns
           * a descriptor with configurable: true to match the proxy target behavior.
           */
          getOwnPropertyDescriptor(_target, prop) {
            const descriptor = Object.getOwnPropertyDescriptor(
              propsRef.current ?? {},
              prop
            );
            if (descriptor) {
              // Ensure the descriptor is configurable to match proxy target behavior
              return {
                ...descriptor,
                configurable: true,
              };
            }
            return undefined;
          },
        })
    );

    /**
     * Builder result computed once and stored in state.
     *
     * The builder function is executed with disposable and event dispatcher contexts,
     * which allows effects created during builder to run immediately (consistent with
     * global effects) while still tracking cleanup via the disposable context.
     *
     * The result is stored in useState so it's only computed once per component
     * instance. Effects run immediately and handle reactivity automatically.
     */
    const [result] = useState(() => {
      // Apply dispatchers to the builder function
      // This provides context for effects, events, providers, blox APIs, etc.
      return syncOnly(
        () =>
          withDispatchers(
            [
              providerToken(providerResolver),
              eventToken(eventDispatcher.emitters),
              disposableToken(eventDispatcher.emitters.unmount),
              // no tracking when builder is called
              trackingToken(),
            ],
            () => {
              return builder(propsProxy as PropsWithoutRef<TProps>, ref.set);
            },
            { contextType: "blox" }
          ),
        {
          message:
            "blox() builder function cannot return a promise. " +
            "React components must render synchronously. " +
            "If you need async data, use signal.async() or handle async operations in effects.",
          context: "blox()",
          mode: "error",
        }
      );
    });

    /**
     * Emits mount event and sets up unmount cleanup.
     *
     * Effects now run immediately during builder execution (consistent with
     * global effects). This useLayoutEffect only handles:
     * 1. Emitting the mount event
     * 2. Cancelling pending rerenders on unmount
     */
    useLayoutEffect(() => {
      // Emit mount event
      eventDispatcher.emitMount();

      return () => {
        // Cancel any pending debounced rerender to prevent updates after unmount
        rerender.cancel();
      };
    }, [rerender, eventDispatcher]);

    /**
     * Exposes the ref.current value via the forwarded ref.
     * Updates whenever ref.current changes.
     */
    useImperativeHandle(props.forwardedRef, ref.get, [ref.get()]);

    eventDispatcher.emitRender();

    return result as unknown as ReactNode;
  };

  /**
   * HMR (Hot Module Replacement) detection wrapper.
   *
   * This component detects when the builder function changes during development
   * (e.g., when you save the file with code changes) and forces React to remount
   * the Block component by changing its key.
   *
   * How it works:
   * 1. Store the builder function reference in a ref
   * 2. On each render, compare current builder with stored reference
   * 3. If different (HMR occurred), increment version counter
   * 4. Pass version as key to Block component
   * 5. React sees new key → unmounts old Block → mounts new Block
   * 6. New Block runs the updated builder function with new code
   *
   * Why this matters:
   * - Without this, code changes wouldn't be reflected until manual refresh
   * - Signal values are preserved (stored in signal registry outside component)
   * - Effects are re-collected with updated code
   * - Provides instant feedback during development
   *
   * Example:
   * ```tsx
   * const Counter = blox(() => {
   *   const count = signal(5);
   *   // You edit this line to add new feature:
   *   const doubled = signal(() => count() * 2);
   *   return <div>{count()} × 2 = {doubled()}</div>;
   * });
   *
   * // Save file → HMR detects change → Block remounts with new code
   * // count is still 5 (preserved), but doubled signal now exists
   * ```
   */
  const HMR = (
    props: PropsWithoutRef<TProps>,
    forwardedRef: ForwardedRef<TRef>
  ) => {
    // Track how many times builder has changed (HMR counter)
    const version = useRef(0);

    // Store previous builder reference to detect changes
    const builderRef = useRef(builder);

    // Check if builder function changed (indicates HMR occurred)
    if (builderRef.current !== builder) {
      builderRef.current = builder;
      version.current++; // Increment to force remount via key change
    }

    // Render Block with version as key - changing key forces React to remount
    return createElement(Block, {
      ...props,
      forwardedRef,
      key: version.current,
    });
  };

  return memo(forwardRef(HMR)) as any;
}
