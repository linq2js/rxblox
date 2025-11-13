import {
  createContext,
  PropsWithChildren,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MutableSignal, Signal } from "./types";
import { signal } from "./signal";
import { dispatcherToken, getDispatcher } from "./dispatcher";

/**
 * Dispatcher token for provider resolution.
 *
 * Use this to:
 * - Create entries: `providerToken(resolver)`
 * - Retrieve resolver: `getDispatcher(providerToken)`
 */
export const providerToken =
  dispatcherToken<ProviderResolver>("providerResolver");

/**
 * Resolver function that looks up a provider instance by its provider definition.
 * Used to traverse the provider tree to find the correct provider instance.
 */
type ProviderResolver = {
  resolve<T>(def: ProviderDef<T>): ProviderInstance<T>;
};

/**
 * Internal instance that holds the signal and state for a provider.
 * Created per provider instance in the component tree.
 */
type ProviderInstance<T> = {
  getSignal(): Signal<T>;
  setValue(value: T): void;
};

/**
 * React context that provides the provider resolver function.
 * Allows components to look up providers from parent components.
 */
export const providerResolverContext = createContext<
  ProviderResolver | undefined
>(undefined);

export function useProviderResolver(): ProviderResolver | undefined {
  return useContext(providerResolverContext);
}

/**
 * Container component that provides a value through the provider system.
 * Creates a signal for the provided value and makes it available to child components.
 *
 * **Important**: This component does NOT cause child components to re-render when
 * the value changes. Only `rx()` expressions or `effect()` callbacks that consume
 * the provider signal will react to changes. This is different from React Context,
 * where all consuming components re-render automatically.
 */
function ProviderContainer<T>(
  props: PropsWithChildren<{ value: T; providerDef: ProviderDef<T> }>
) {
  const parentResolver = useContext(providerResolverContext);
  const providerDefRef = useRef(props.providerDef);
  providerDefRef.current = props.providerDef;
  const [providerInstance] = useState(() => {
    let currentSignal: MutableSignal<T> | undefined;
    let currentValue = props.value;

    return {
      getSignal() {
        if (!currentSignal) {
          const initialValue =
            typeof currentValue === "function"
              ? () => currentValue
              : currentValue;
          currentSignal = signal(initialValue, {
            equals: providerDefRef.current.equals,
          });
        }
        return currentSignal;
      },
      setValue(value: T) {
        if (typeof value === "function") {
          currentValue = (() => value) as unknown as T;
        } else {
          currentValue = value;
        }
        currentSignal?.set(currentValue);
      },
    };
  });
  const parentResolverRef = useRef(parentResolver);
  parentResolverRef.current = parentResolver;

  const resolveProvider = useMemo<ProviderResolver>(
    () => ({
      resolve(def: ProviderDef<any>) {
        if (def === providerDefRef.current) {
          return providerInstance as unknown as ProviderInstance<any>;
        }

        if (!parentResolverRef.current) {
          throw new Error(`Provider ${def.name} not found`);
        }

        return parentResolverRef.current.resolve(def);
      },
    }),
    [providerInstance]
  );

  useLayoutEffect(() => {
    providerInstance.setValue(props.value);
  }, [providerInstance, props.value]);

  return (
    <providerResolverContext.Provider
      value={resolveProvider}
      children={props.children}
    />
  );
}

export type ProviderDef<T> = {
  initialValue: T;
  name?: string;
  equals?: (a: any, b: any) => boolean;
};

export type ProviderOptions<T> = {
  equals?: (a: T, b: T) => boolean;
};

/**
 * Creates a provider for sharing reactive state across components.
 *
 * Providers work similarly to React Context for passing values down the component tree,
 * but with a key difference: providers return signals, and only reactive expressions
 * (`rx`) or effects (`effect`) that consume the signal will be reactive.
 *
 * **Important**: Child components themselves will NOT automatically re-render when
 * the provider value changes. Only `rx()` expressions or `effect()` callbacks that
 * explicitly access the provider signal will react to changes.
 *
 * @param name - Unique identifier for the provider
 * @param initialValue - Default value for the provider (cannot be a function)
 * @param options - Configuration options including custom equality function
 * @returns A tuple `[withXXX, XXXProvider]` where:
 *   - `withXXX` is a function that returns the provider signal (throws if called outside provider context)
 *   - `XXXProvider` is a React component that accepts `{ value: T; children: ReactNode }` props
 *
 * @example
 * ```tsx
 * // Create a provider for theme
 * const [withTheme, ThemeProvider] = provider("theme", "light" as "light" | "dark");
 *
 * // Provider component supplies the value
 * const App = blox<{ theme: "light" | "dark" }>((props) => {
 *   return (
 *     <ThemeProvider value={props.theme}>
 *       <ChildComponent />
 *     </ThemeProvider>
 *   );
 * });
 *
 * // ❌ WRONG: Component won't re-render when theme changes
 * const ChildComponent = blox(() => {
 *   const theme = withTheme();
 *   return <div>Theme: {theme()}</div>; // Static, won't update!
 * });
 *
 * // ✅ CORRECT: Use rx() to make it reactive
 * const ChildComponent = blox(() => {
 *   const theme = withTheme();
 *   return <div>{rx(() => `Theme: ${theme()}`)}</div>; // Updates!
 * });
 *
 * // ✅ CORRECT: Use effect() for side effects
 * const ChildComponent = blox(() => {
 *   const theme = withTheme();
 *   effect(() => {
 *     console.log("Theme changed:", theme()); // Runs when theme changes
 *   });
 *   return <div>Check console</div>;
 * });
 * ```
 *
 * @note Functions are not supported as provider values due to type constraints
 */
export function provider<T>(
  name: string,
  initialValue: T,
  options: ProviderOptions<T> = {}
) {
  const providerDef: ProviderDef<T> = {
    initialValue,
    name,
    equals: options.equals,
  };

  /**
   * Accesses the provider's signal within a component (named `withXXX` by convention).
   *
   * Must be called inside a `blox` component within the provider's tree.
   * Returns a **read-only signal** - use `signal()` to get the value.
   *
   * **⚠️ Critical: The component itself will NOT re-render when the value changes!**
   * Only `rx()` expressions or `effect()` callbacks that access the signal will react.
   *
   * @returns A read-only Signal<T> (without .set() or .reset())
   * @throws Error if called outside the provider's component tree
   *
   * @example
   * ```tsx
   * const theme = withTheme();
   *
   * // ❌ Won't update: theme() called outside rx()
   * return <div>{theme()}</div>;
   *
   * // ✅ Will update: theme() called inside rx()
   * return <div>{rx(() => theme())}</div>;
   * ```
   */
  const withValue = () => {
    const currentResolver = getDispatcher(providerToken);

    if (!currentResolver) {
      throw new Error(`Provider ${name} not found`);
    }

    return currentResolver.resolve<T>(providerDef).getSignal();
  };

  /**
   * React component that renders a provider container supplying a value to its children.
   *
   * @param props.value - The value to provide to child components
   * @param props.children - React children that will have access to the provider
   */
  const Provider = (props: PropsWithChildren<{ value: T }>) => {
    return (
      <ProviderContainer
        value={props.value}
        providerDef={providerDef}
        children={props.children}
      />
    );
  };

  return [withValue, Provider] as const;
}
