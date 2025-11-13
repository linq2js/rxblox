import { action, Action, ActionOptions } from "./action";
import { getDispatcher } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";

export type AborterOptions = {
  /** Whether to automatically reset the AbortController after each `abort` call */
  autoReset?: boolean;
};

/**
 * Creates an AbortController wrapper with reset capability.
 *
 * Useful for creating cancellable actions that can be reset
 * to a fresh AbortController instance.
 *
 * @returns An object with abort control methods
 *
 * @example
 * ```ts
 * const ac = aborter();
 *
 * // Get the signal to pass to fetch
 * fetch('/api/data', { signal: ac.signal });
 *
 * // Abort the request
 * ac.abort();
 *
 * // Create a new controller for next request
 * ac.reset();
 * ```
 */
export function aborter(options: AborterOptions = {}) {
  let controller = new AbortController();

  return {
    get signal() {
      return controller.signal;
    },
    /**
     * Abort the current request and optionally reset the AbortController
     */
    abort() {
      controller.abort();
      if (options.autoReset) {
        controller = new AbortController();
      }
    },
    /**
     * Whether the current request has been aborted
     */
    get aborted() {
      return controller.signal.aborted;
    },
    /**
     * Reset the AbortController to a fresh instance
     */
    reset() {
      // Abort the old controller before creating a new one
      controller.abort();
      controller = new AbortController();
    },
  };
}

/**
 * A cancellable action extends Action with cancellation capabilities.
 *
 * The action can be cancelled mid-execution using the `cancel()` method,
 * and provides a `cancelled` property to check if it's been cancelled.
 */
export type CancellableAction<
  TArgs extends readonly any[] = any[],
  TResult = void
> = Action<TArgs, TResult> & {
  /** Cancel the currently running action */
  cancel(): void;
  /** Whether the action has been cancelled */
  readonly cancelled: boolean;
};

/**
 * Creates a cancellable action that can be cancelled mid-execution.
 *
 * Cancellable actions receive an `AbortSignal` as their first parameter,
 * which can be used with fetch() or other cancellable APIs. Each new call
 * automatically creates a fresh AbortSignal.
 *
 * The action exposes `cancel()` to manually cancel the running operation
 * and `cancelled` to check cancellation status.
 *
 * @template TResult - The return type (can be Promise<T>)
 * @template TArgs - The arguments tuple type (excluding AbortSignal)
 * @param fn - The function to wrap (receives AbortSignal as first param)
 * @param options - Configuration options
 * @returns A cancellable action with cancellation capabilities
 *
 * @example
 * ```ts
 * const fetchUser = action.cancellable(
 *   async (signal: AbortSignal, userId: number) => {
 *     const response = await fetch(`/api/users/${userId}`, { signal });
 *     return response.json();
 *   }
 * );
 *
 * // Start the action
 * const promise = fetchUser(123);
 *
 * // Cancel it mid-flight
 * fetchUser.cancel();
 *
 * // Check if cancelled
 * console.log(fetchUser.cancelled); // true
 *
 * // Next call gets a fresh AbortSignal
 * await fetchUser(456); // Works normally
 * ```
 *
 * @example
 * ```ts
 * // With event callbacks
 * const uploadFile = action.cancellable(
 *   async (signal: AbortSignal, file: File) => {
 *     const formData = new FormData();
 *     formData.append('file', file);
 *     const response = await fetch('/api/upload', {
 *       method: 'POST',
 *       body: formData,
 *       signal,
 *     });
 *     return response.json();
 *   },
 *   {
 *     on: {
 *       loading: () => console.log('Uploading...'),
 *       success: () => console.log('Upload complete'),
 *       error: (err) => {
 *         if (err.name === 'AbortError') {
 *           console.log('Upload cancelled');
 *         } else {
 *           console.error('Upload failed:', err);
 *         }
 *       },
 *     },
 *   }
 * );
 *
 * const promise = uploadFile(myFile);
 *
 * // User clicks cancel button
 * uploadFile.cancel(); // Cancels the upload
 * ```
 */
export function cancellableAction<
  TResult = void,
  TArgs extends readonly any[] = any[]
>(
  fn: (abortSignal: AbortSignal, ...args: TArgs) => TResult,
  options: ActionOptions<Awaited<TResult>> = {}
): CancellableAction<TArgs, TResult> {
  // Create an aborter that can be reset for each new call
  const ac = aborter();

  // Wrap the function with action()
  const a = action(
    (...args: TArgs) => {
      const abortSignal = ac.signal;
      return fn(abortSignal, ...args);
    },
    {
      ...options,
      on: {
        ...options.on,
        init: () => {
          // Reset to a fresh AbortController on each call
          ac.reset();
          options.on?.init?.();
        },
      },
    }
  );

  // Add reactive getter for cancelled status
  Object.defineProperties(a, {
    cancelled: {
      get: () => {
        return ac.aborted;
      },
    },
  });

  // Add cancel method
  Object.assign(a, {
    cancel: () => {
      ac.abort();
    },
  });

  getDispatcher(disposableToken)?.add(() => {
    ac.abort();
  });

  return a as CancellableAction<TArgs, TResult>;
}
