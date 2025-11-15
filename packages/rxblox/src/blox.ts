import {
  FC,
  ForwardedRef,
  forwardRef,
  memo,
  PropsWithoutRef,
  ReactNode,
  RefObject,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Ref, MutableSignal } from "./types";
import { effectToken, localEffectDispatcher } from "./effectDispatcher";
import { signal } from "./signal";
import isEqual from "lodash/isEqual";
import { providerToken, useProviderResolver } from "./provider";
import { useRerender } from "./useRerender";
import { Emitter, emitter } from "./emitter";
import { useUnmount } from "./useUnmount";
import { getDispatcher, withDispatchers } from "./dispatcher";
import { EventDispatcher, eventToken } from "./eventDispatcher";
import once from "lodash/once";
import { trackingToken } from "./trackingDispatcher";
import { disposableToken } from "./disposableDispatcher";

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
export function blox<TProps extends Record<string, unknown>>(
  builder: (props: TProps) => ReactNode
): FC<PropsWithoutRef<TProps>>;
export function blox<TProps extends Record<string, unknown>, TRef>(
  builder: (props: TProps, ref: Ref<TRef>) => ReactNode
): FC<PropsWithoutRef<TProps> & { ref?: ForwardedRef<TRef | undefined> }>;
export function blox<
  TProps extends Record<string, unknown> & { ref?: RefObject<TRef> },
  TRef
>(builder: (props: TProps, ref: Ref<TRef>) => ReactNode) {
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
    props: PropsWithoutRef<TProps>,
    forwardedRef: ForwardedRef<TRef>
  ) => {
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
    const getSignal = useMemo(
      () =>
        signalRegistry<keyof PropsWithoutRef<TProps>>(
          eventDispatcher.emitters.unmount
        ),
      []
    );

    /**
     * Update prop signals when props change.
     *
     * This runs during render (before effects) and:
     * 1. Compares current props with previous props using deep equality
     * 2. If props changed, updates propsRef and sets each prop signal
     * 3. Each prop gets its own signal, allowing fine-grained tracking
     *
     * This ensures that when a prop is accessed through the proxy,
     * its corresponding signal is already updated and can be tracked.
     */
    if (!isEqual(propsRef.current, props)) {
      propsRef.current = props;
      Object.entries(props).forEach(([key, value]) => {
        getSignal(key as keyof PropsWithoutRef<TProps>, value).set(value);
      });
    }

    /**
     * Effect dispatcher that collects effects created during builder.
     *
     * Unlike the default dispatcher (which runs effects immediately),
     * this dispatcher collects effects and runs them in useLayoutEffect.
     * This allows effects to be properly tracked and cleaned up.
     *
     * Created once per component instance and reused across builders.
     */
    const [effectDispatcher] = useState(() => localEffectDispatcher());

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
            const propSignal = getSignal(
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
     * The builder function is executed within the effect dispatcher context,
     * which collects all effects created during builder. These effects are
     * then run in useLayoutEffect, allowing them to track signal dependencies.
     *
     * The result is stored in useState so it's only computed once per component
     * instance. Effects handle reactivity, not the builder result itself.
     */
    const [result] = useState(() => {
      // Apply the effect dispatcher to the builder function
      // This collects all effects created by the builder function
      return withDispatchers(
        [
          providerToken(providerResolver),
          effectToken(effectDispatcher),
          eventToken(eventDispatcher.emitters),
          disposableToken(eventDispatcher.emitters.unmount),
        ],
        () => {
          return builder(propsProxy as TProps, ref.set);
        }
      );
    });

    /**
     * Runs collected effects and sets up signal subscriptions.
     *
     * This effect:
     * 1. Runs all effects that were collected during builder
     * 2. Effects subscribe to signals they accessed (including prop signals)
     * 3. Returns a cleanup function that unsubscribes from all signals
     *
     * Re-runs when dispatcher changes (shouldn't happen) or when
     * the component unmounts (for cleanup).
     */
    useLayoutEffect(() => {
      // Run all collected effects, which will:
      // - Execute effect functions
      // - Track signals accessed during execution
      // - Subscribe to signal changes
      const cleanup = effectDispatcher.run();

      // Emit mount event after effects are set up
      eventDispatcher.emitMount();

      return () => {
        // Cancel any pending debounced rerender to prevent updates after unmount
        rerender.cancel();
        cleanup();
      };
    }, [effectDispatcher, rerender, eventDispatcher]);

    /**
     * Exposes the ref.current value via the forwarded ref.
     * Updates whenever ref.current changes.
     */
    useImperativeHandle(forwardedRef, ref.get, [ref.get()]);

    eventDispatcher.emitRender();

    return result as unknown as ReactNode;
  };

  return memo(forwardRef(Block));
}

/**
 * Creates a registry function that manages signals for a set of keys.
 *
 * The registry:
 * - Creates signals lazily when first accessed
 * - Caches signals in a Map for reuse
 * - Returns the same signal instance for the same key
 *
 * This is used by `blox` to create one signal per prop key,
 * allowing fine-grained tracking of individual prop changes.
 *
 * @returns A function that takes a key and initial value, and returns
 *          a signal for that key (creating it if it doesn't exist)
 *
 * @example
 * ```ts
 * const registry = signalRegistry<string>();
 * const nameSignal = registry('name', 'Alice'); // Creates signal
 * const ageSignal = registry('age', 25); // Creates signal
 * const nameSignal2 = registry('name', 'Bob'); // Returns same signal as nameSignal
 * ```
 */
export function signalRegistry<TKey>(onDispose?: Emitter) {
  const signals = new Map<TKey, MutableSignal<unknown>>();

  return (key: TKey, initialValue: unknown) => {
    if (!signals.has(key)) {
      signals.set(
        key,
        onDispose
          ? withDispatchers([disposableToken(onDispose)], () =>
              signal(initialValue)
            )
          : signal(initialValue)
      );
    }
    return signals.get(key)!;
  };
}
