import { useEffect, useRef } from "react";
import { Action, ActionOptions, isAction } from "./action";
import { cancellableAction } from "./cancellableAction";
import { useRerender } from "./useRerender";

/**
 * React hook that makes actions reactive in components.
 *
 * This hook provides two modes of operation:
 *
 * **Mode 1: Reactive Global Action**
 * - Pass an existing Action object (e.g., from module scope)
 * - The hook subscribes to the action and triggers re-renders on state changes
 * - Useful for sharing actions across multiple components
 *
 * **Mode 2: Local Action Creation**
 * - Pass an action function with optional options
 * - The hook creates a cancellable action automatically
 * - The action is scoped to the component instance
 * - Useful for component-specific async operations
 *
 * @param action - Existing Action object to make reactive
 * @returns The same Action object with reactive subscription
 *
 * @example
 * **Using Global Action**
 * ```tsx
 * // store.ts - Global action
 * export const fetchUser = cancellableAction(async (signal, id: number) => {
 *   const response = await fetch(`/api/users/${id}`, { signal });
 *   return response.json();
 * });
 *
 * // Component.tsx - Make it reactive
 * const UserProfile = () => {
 *   const fetchUserAction = useAction(fetchUser);
 *
 *   return (
 *     <div>
 *       {fetchUserAction.status === 'loading' && <div>Loading...</div>}
 *       {fetchUserAction.error && <div>Error: {fetchUserAction.error.message}</div>}
 *       {fetchUserAction.result && <div>User: {fetchUserAction.result.name}</div>}
 *       <button onClick={() => fetchUserAction(1)}>Load User</button>
 *     </div>
 *   );
 * };
 * ```
 */
export function useAction<TAction extends Action>(action: TAction): TAction;

/**
 * React hook that creates a local cancellable action and makes it reactive.
 *
 * @param fn - Action function that receives AbortSignal and arguments
 * @param options - Optional action configuration (callbacks, etc.)
 * @returns A new cancellable Action object
 *
 * @example
 * **Creating Local Action**
 * ```tsx
 * const SearchComponent = () => {
 *   // Create local action scoped to this component
 *   const searchAction = useAction(
 *     async (signal, query: string) => {
 *       const response = await fetch(`/api/search?q=${query}`, { signal });
 *       return response.json();
 *     },
 *     {
 *       on: {
 *         success: (results) => console.log('Found:', results.length),
 *         error: (error) => console.error('Search failed:', error)
 *       }
 *     }
 *   );
 *
 *   return (
 *     <div>
 *       <input onChange={(e) => searchAction.run(e.target.value)} />
 *       {searchAction.loading && <div>Searching...</div>}
 *       {searchAction.data?.map(item => <div key={item.id}>{item.name}</div>)}
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * **With Loading States**
 * ```tsx
 * const UploadComponent = () => {
 *   const uploadAction = useAction(async (signal, file: File) => {
 *     const formData = new FormData();
 *     formData.append('file', file);
 *
 *     const response = await fetch('/api/upload', {
 *       method: 'POST',
 *       body: formData,
 *       signal
 *     });
 *
 *     return response.json();
 *   });
 *
 *   return (
 *     <div>
 *       <input
 *         type="file"
 *         onChange={(e) => uploadAction.run(e.target.files[0])}
 *         disabled={uploadAction.loading}
 *       />
 *       {uploadAction.loading && <progress />}
 *       {uploadAction.error && <div>Upload failed!</div>}
 *       {uploadAction.data && <div>Uploaded: {uploadAction.data.url}</div>}
 *     </div>
 *   );
 * };
 * ```
 */
export function useAction<TArgs extends any[], TResult>(
  fn: (abortSignal: AbortSignal, ...args: TArgs) => TResult,
  options?: ActionOptions<TResult>
): Action<TArgs, TResult>;

export function useAction(actionOrFn: any, options?: ActionOptions<any>) {
  /**
   * Store the action function for local action creation.
   * Updated on every render to always use the latest function.
   */
  const actionFnRef = useRef<(...args: any[]) => any>();

  /**
   * Store the Action object (either provided or created).
   * Persists across renders to maintain action state.
   */
  const actionRef = useRef<Action<any[], any>>();

  /**
   * Store current options in ref to access latest values in callbacks
   * without recreating the action.
   */
  const optionsRef = useRef<ActionOptions<any>>();
  optionsRef.current = options;

  /**
   * Rerender function with microtask debouncing.
   *
   * Microtask debouncing ensures:
   * - Multiple synchronous action state changes batch into one render
   * - UI stays responsive during rapid action updates
   * - Prevents excessive re-renders from action events
   */
  const rerender = useRerender<void>({ debounce: "microtask" });

  // Determine if input is an existing Action or a function to wrap
  if (isAction(actionOrFn)) {
    /**
     * Mode 1: Using existing Action (Global Action)
     *
     * When input is already an Action object:
     * - Store it in actionRef
     * - Clear actionFnRef (not needed for existing actions)
     * - Component will subscribe to this action's events
     */
    if (actionRef.current !== actionOrFn) {
      actionRef.current = actionOrFn;
      actionFnRef.current = undefined;
    }
  } else {
    /**
     * Mode 2: Creating local Action from function
     *
     * When input is a function:
     * - Store the function in actionFnRef
     * - Create a new cancellable action if not already created
     * - Wrap the function to forward events to the provided options
     */
    actionFnRef.current = actionOrFn;

    // Create action once on first render
    if (!actionRef.current) {
      actionRef.current = cancellableAction(
        (signal, ...restArgs: any[]) => {
          // Call the latest action function (from ref)
          return actionFnRef.current?.(signal, ...restArgs);
        },
        {
          on: {
            /**
             * Forward all action events to the options callbacks.
             *
             * Using optionsRef ensures we always call the latest callbacks
             * without recreating the action when options change.
             */
            init: () => {
              optionsRef.current?.on?.init?.();
            },
            loading: () => {
              optionsRef.current?.on?.loading?.();
            },
            success: (result) => {
              optionsRef.current?.on?.success?.(result);
            },
            error: (error) => {
              optionsRef.current?.on?.error?.(error);
            },
            done: (error, result) => {
              optionsRef.current?.on?.done?.(error, result);
            },
            reset: () => {
              optionsRef.current?.on?.reset?.();
            },
          },
        }
      );
    }
  }

  /**
   * Subscribe to action state changes and trigger re-renders.
   *
   * This effect:
   * 1. Subscribes to the action when it's available
   * 2. Triggers a (debounced) re-render on any action state change
   * 3. Unsubscribes on cleanup or when action changes
   *
   * The subscription ensures the component re-renders when:
   * - action.loading changes
   * - action.data updates
   * - action.error is set
   * - action.reset() is called
   */
  useEffect(() => {
    if (actionRef.current) {
      return actionRef.current.on(() => {
        rerender();
      });
    }
  }, [actionRef.current, rerender]);

  return actionRef.current;
}
