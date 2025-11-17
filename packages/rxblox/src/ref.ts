import { getContextType } from "./dispatcher";

/**
 * A reactive ref for DOM elements with a `ready()` helper.
 *
 * @template T - The type of DOM element
 */
export interface BloxRef<T> {
  /**
   * The current DOM element reference, or `null` if not yet mounted.
   */
  readonly current: T | null;

  /**
   * Executes a callback when the ref is ready (not null or undefined).
   *
   * Provides automatic null/undefined checking and type narrowing.
   * **Must be called inside `blox.onMount()` or `effect()`** where the ref is already set.
   *
   * @param callback - Function to execute when the element is ready.
   *                   Receives the non-nullable element as argument.
   *
   * @example
   * ```tsx
   * const inputRef = blox.ref<HTMLInputElement>();
   *
   * blox.onMount(() => {
   *   inputRef.ready((input) => {
   *     // Type: HTMLInputElement (not null/undefined)
   *     input.focus();
   *   });
   * });
   *
   * return <input ref={inputRef} />;
   * ```
   *
   * @example
   * ```tsx
   * // With cleanup
   * const videoRef = blox.ref<HTMLVideoElement>();
   *
   * blox.onMount(() => {
   *   videoRef.ready((video) => {
   *     video.play();
   *
   *     blox.onUnmount(() => {
   *       video.pause();
   *     });
   *   });
   * });
   * ```
   */
  ready(callback: (element: Exclude<T, null | undefined>) => void): void;
}

/**
 * Creates a reactive ref for DOM elements.
 *
 * Returns a ref object with a `ready()` method for type-safe element access.
 *
 * **Must be called inside a `blox` component.** Exported as `blox.ref()`.
 *
 * @template T - The type of DOM element
 * @returns A BloxRef object with `.current` and `.ready()` method
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   const inputRef = blox.ref<HTMLInputElement>();
 *
 *   blox.onMount(() => {
 *     inputRef.ready((input) => {
 *       input.focus(); // Type-safe, no null checking needed
 *     });
 *   });
 *
 *   return <input ref={inputRef} />;
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Multiple refs with blox.ready()
 * const MyComponent = blox(() => {
 *   const inputRef = blox.ref<HTMLInputElement>();
 *   const buttonRef = blox.ref<HTMLButtonElement>();
 *
 *   blox.onMount(() => {
 *     blox.ready([inputRef, buttonRef], (input, button) => {
 *       input.focus();
 *       button.disabled = false;
 *     });
 *   });
 *
 *   return (
 *     <>
 *       <input ref={inputRef} />
 *       <button ref={buttonRef}>Click</button>
 *     </>
 *   );
 * });
 * ```
 */
export function ref<T>(): BloxRef<T> {
  // Check if we're inside a blox component
  const contextType = getContextType();
  if (contextType !== "blox") {
    throw new Error(
      "blox.ref() must be called inside a blox component. " +
        "It relies on blox.onRender() which is only available in blox components."
    );
  }

  // Create a plain ref object (no hooks needed)
  const bloxRef: any = {
    current: null as T | null,
    ready(callback: (element: Exclude<T, null | undefined>) => void): void {
      // Simply check if ref is ready and call callback
      // No lifecycle registration - caller should use effect() or blox.onMount()
      if (bloxRef.current != null) {
        callback(bloxRef.current as Exclude<T, null | undefined>);
      }
    },
  };

  return bloxRef as BloxRef<T>;
}

/**
 * Extract element types from an array of BloxRef objects.
 *
 * @template T - Tuple of BloxRef types
 */
type ExtractRefTypes<T extends readonly BloxRef<any>[]> = {
  [K in keyof T]: T[K] extends BloxRef<infer E>
    ? Exclude<E, null | undefined>
    : never;
};

/**
 * Executes a callback when all refs are ready (not null or undefined).
 *
 * Provides automatic null/undefined checking and type narrowing for multiple refs.
 * **Must be called inside `blox.onMount()` or `effect()`** where refs are already set.
 *
 * Exported as `blox.ready()`.
 *
 * @template T - Tuple of BloxRef types
 * @param refs - Array of BloxRef objects to wait for
 * @param callback - Function to execute when all elements are ready.
 *                   Receives all non-nullable elements as arguments.
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   const inputRef = blox.ref<HTMLInputElement>();
 *   const buttonRef = blox.ref<HTMLButtonElement>();
 *   const divRef = blox.ref<HTMLDivElement>();
 *
 *   blox.onMount(() => {
 *     blox.ready([inputRef, buttonRef, divRef], (input, button, div) => {
 *       // All types are non-nullable
 *       input.focus();
 *       button.disabled = false;
 *       div.style.opacity = "1";
 *     });
 *   });
 *
 *   return (
 *     <>
 *       <input ref={inputRef} />
 *       <button ref={buttonRef}>Click</button>
 *       <div ref={divRef}>Content</div>
 *     </>
 *   );
 * });
 * ```
 *
 * @example
 * ```tsx
 * // With cleanup
 * blox.onMount(() => {
 *   blox.ready([ref1, ref2], (el1, el2) => {
 *     el1.addEventListener("click", handler);
 *
 *     blox.onUnmount(() => {
 *       el1.removeEventListener("click", handler);
 *     });
 *   });
 * });
 * ```
 */
export function ready<const T extends readonly BloxRef<any>[]>(
  refs: T,
  callback: (...elements: ExtractRefTypes<T>) => void
): void {
  // Simply check if all refs are ready and call callback
  // No lifecycle registration - caller should use effect() or blox.onMount()
  const allReady = refs.every((ref) => ref.current != null);
  if (allReady) {
    const elements = refs.map((ref) => ref.current) as ExtractRefTypes<T>;
    callback(...elements);
  }
}
