import { getDispatcher } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";
import { isPromiseLike } from "./isPromiseLike";
import { loadable, Loadable } from "./loadable";
import { signal } from "./signal";
import { Signal } from "./types";

/**
 * An action is a callable function that tracks its execution state.
 *
 * Actions automatically manage loading/success/error states for both
 * synchronous and asynchronous operations.
 *
 * @template TArgs - The arguments tuple type
 * @template TResult - The return type (can be Promise)
 */
export type Action<TArgs extends readonly any[] = any[], TResult = void> = {
  (...args: TArgs): TResult;
  /** Current status of the action */
  readonly status: "idle" | "loading" | "success" | "error";
  /** The last successful result (undefined if no success yet) */
  readonly result: TResult | undefined;
  /** The last error (undefined if no error yet) */
  readonly error: Error | undefined;
  /** Number of times the action has been called */
  readonly calls: number;
  /**
   * Subscribe to action state changes.
   *
   * The callback receives a Loadable object representing the current state
   * (loading/success/error) whenever the action is called or completes.
   *
   * @param listener - Callback that receives the loadable state
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const saveUser = action(async (user: User) => {
   *   return await api.save(user);
   * });
   *
   * const unsubscribe = saveUser.on((loadable) => {
   *   if (loadable?.status === "loading") {
   *     console.log("Saving...");
   *   } else if (loadable?.status === "success") {
   *     console.log("Saved:", loadable.value);
   *   } else if (loadable?.status === "error") {
   *     console.error("Error:", loadable.error);
   *   }
   * });
   *
   * await saveUser({ name: "John" });
   * unsubscribe();
   * ```
   */
  on: Signal<Loadable<Awaited<TResult>> | undefined>["on"];
  /** Reset the action to idle state */
  reset(): void;
};

/**
 * Event callbacks for action lifecycle.
 *
 * @template TResult - The resolved result type (unwrapped from Promise)
 */
export type ActionEvents<TResult> = {
  /** Called when an error occurs */
  error?: (error: unknown) => void;
  /** Called when the action completes successfully */
  success?: (result: TResult) => void;
  /** Called when an async action starts loading */
  loading?: () => void;
  /** Called when the action is invoked (before execution) */
  init?: () => void;
  /** Called when the action completes (success or error) */
  done?: (error: unknown | undefined, result: TResult | undefined) => void;
  /** Called when reset() is called */
  reset?: () => void;
};

/**
 * Options for configuring an action.
 *
 * @template TResult - The resolved result type (unwrapped from Promise)
 */
export type ActionOptions<TResult> = {
  /** Event callbacks for action lifecycle */
  on?: ActionEvents<TResult>;
};

/**
 * Creates an action that tracks execution state and manages side effects.
 *
 * Actions are callable functions that automatically track their status
 * (idle, loading, success, error) and provide reactive state via signals.
 *
 * For async functions, actions track loading state and handle promise
 * resolution/rejection. For sync functions, they track success/error.
 *
 * @template TResult - The return type (can be Promise<T>)
 * @template TArgs - The arguments tuple type
 * @param fn - The function to wrap
 * @param options - Configuration options
 * @returns An action with reactive state tracking
 *
 * @example
 * ```ts
 * // Async action
 * const saveUser = action(async (user: User) => {
 *   const response = await fetch('/api/users', {
 *     method: 'POST',
 *     body: JSON.stringify(user),
 *   });
 *   return response.json();
 * });
 *
 * // Call the action
 * await saveUser({ name: 'John' });
 *
 * // Check status
 * console.log(saveUser.status); // "loading" | "success" | "error"
 * console.log(saveUser.result); // The returned user object
 * console.log(saveUser.calls); // Number of times called
 *
 * // With event callbacks
 * const deleteUser = action(
 *   async (id: number) => {
 *     await fetch(`/api/users/${id}`, { method: 'DELETE' });
 *   },
 *   {
 *     on: {
 *       success: () => console.log('User deleted'),
 *       error: (err) => console.error('Failed:', err),
 *     },
 *   }
 * );
 * ```
 */
export function action<TResult = void, TArgs extends readonly any[] = any[]>(
  fn: (...args: TArgs) => TResult,
  options: ActionOptions<Awaited<TResult>> = {}
): Action<TArgs, TResult> {
  let calls = 0;
  // Store the result as a loadable signal for reactive tracking
  const result = signal<Loadable<Awaited<TResult>> | undefined>(undefined);
  // Token to track if a new call invalidates previous async calls
  let token = {};

  const dispatch = (...args: TArgs) => {
    calls++;
    // Create new token for this call and make it the current token
    const myToken = {};
    token = myToken;

    try {
      // Call init callback before execution
      options.on?.init?.();

      // Execute the wrapped function
      const r = fn(...args);

      // Handle async results (promises)
      if (isPromiseLike<Awaited<TResult>>(r)) {
        result.set(loadable("loading", r));
        options.on?.loading?.();

        return new Promise<Awaited<TResult>>((resolve, reject) => {
          r.then(
            (data) => {
              // Only update state if this is still the current call
              if (token === myToken) {
                result.set(loadable("success", data));
                options.on?.success?.(data);
                options.on?.done?.(undefined, data);
              }
              // Always return data for this specific promise
              resolve(data);
            },
            (error) => {
              // Only update state if this is still the current call
              if (token === myToken) {
                result.set(loadable("error", error));
                options.on?.error?.(error);
                options.on?.done?.(error, undefined);
              }
              // Always throw error for this specific promise
              reject(error);
            }
          );
        });
      }

      // Handle sync results
      result.set(loadable("success", r as Awaited<TResult>));
      options.on?.success?.(r as Awaited<TResult>);
      options.on?.done?.(undefined, r as Awaited<TResult>);
      return r;
    } catch (error) {
      // Handle sync errors
      result.set(loadable("error", error));
      options.on?.error?.(error);
      options.on?.done?.(error, undefined);
      throw error;
    }
  };

  // Define reactive getters for action state
  Object.defineProperties(dispatch, {
    calls: {
      get: () => {
        return calls;
      },
    },
    status: {
      get: () => {
        const r = result();
        if (!r) return "idle";
        return r.status;
      },
    },
    result: {
      get: () => {
        return result()?.value;
      },
    },
    error: {
      get: () => {
        return result()?.error;
      },
    },
  });

  const cleanup = () => {
    calls = 0;
    token = {};
  };

  getDispatcher(disposableToken)?.add(cleanup);

  // Add reset method
  Object.assign(dispatch, {
    on: result.on,
    reset() {
      result.reset();
      cleanup();
      options.on?.reset?.();
    },
  });

  return dispatch as Action<TArgs, TResult>;
}
