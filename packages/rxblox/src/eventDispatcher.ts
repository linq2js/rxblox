import { dispatcherToken, getDispatcher, getContextType } from "./dispatcher";
import { emitter, Emitter } from "./emitter";

/**
 * Event dispatcher that manages lifecycle event emitters for blox components.
 *
 * Provides emitters for:
 * - `unmount`: Called when component unmounts
 * - `mount`: Called when component mounts
 * - `render`: Called on each render
 */
export type EventDispatcher = Record<"unmount" | "mount" | "render", Emitter>;

/**
 * Dispatcher token for event management.
 *
 * Use this to:
 * - Create entries: `eventToken(dispatcher)`
 * - Retrieve dispatcher: `getDispatcher(eventToken)`
 */
export const eventToken = dispatcherToken<EventDispatcher>("eventDispatcher");

/**
 * Register lifecycle event handlers for blox components.
 *
 * This function allows you to register multiple event handlers at once,
 * providing a convenient way to handle component lifecycle events.
 *
 * Exported as `blox.onEvent()` and `blox.on()`.
 *
 * @param events - Object mapping event names to callback(s)
 * @returns Cleanup function to unregister all event handlers
 *
 * **Supported Events:**
 * - `mount`: Called when component mounts
 * - `unmount`: Called when component unmounts
 * - `render`: Called on each render
 *
 * **Must be called inside a blox component.**
 *
 * @example Register single callbacks
 * ```tsx
 * const MyComponent = blox(() => {
 *   blox.on({
 *     mount: () => console.log('Mounted!'),
 *     unmount: () => console.log('Unmounted!'),
 *     render: () => console.log('Rendered!')
 *   });
 *
 *   return <div>Content</div>;
 * });
 * ```
 *
 * @example Register multiple callbacks per event
 * ```tsx
 * const MyComponent = blox(() => {
 *   blox.on({
 *     mount: [
 *       () => console.log('Mount handler 1'),
 *       () => console.log('Mount handler 2')
 *     ],
 *     unmount: () => console.log('Cleanup')
 *   });
 *
 *   return <div>Content</div>;
 * });
 * ```
 *
 * @example Partial events (only register what you need)
 * ```tsx
 * const MyComponent = blox(() => {
 *   // Only register unmount handler
 *   blox.on({
 *     unmount: () => cleanup()
 *   });
 *
 *   return <div>Content</div>;
 * });
 * ```
 *
 * @example Manual cleanup (if needed)
 * ```tsx
 * const MyComponent = blox(() => {
 *   const cleanup = blox.on({
 *     mount: () => console.log('Mounted')
 *   });
 *
 *   // Manually unregister handlers if needed
 *   // (usually not necessary as cleanup happens automatically)
 *   // cleanup();
 *
 *   return <div>Content</div>;
 * });
 * ```
 *
 * @example Using standalone function
 * ```tsx
 * import { onEvent } from 'rxblox';
 *
 * const MyComponent = blox(() => {
 *   onEvent({
 *     mount: () => console.log('Mounted')
 *   });
 *
 *   return <div>Content</div>;
 * });
 * ```
 */
export function onEvent(
  events: Partial<Record<keyof EventDispatcher, VoidFunction | VoidFunction[]>>
): VoidFunction {
  const contextType = getContextType();

  if (contextType !== "blox") {
    throw new Error(
      `onEvent() must be called inside a blox component.\n\n` +
        `Current context: ${contextType || "none"}\n\n` +
        `❌ Don't do this:\n` +
        `  function MyComponent() {\n` +
        `    onEvent({ mount: () => console.log('mount') });  // Wrong context!\n` +
        `    return <div>Content</div>;\n` +
        `  }\n\n` +
        `✅ Instead, use blox():\n` +
        `  const MyComponent = blox(() => {\n` +
        `    onEvent({ mount: () => console.log('mount') });  // Correct!\n` +
        `    return <div>Content</div>;\n` +
        `  });\n\n` +
        `See: https://github.com/linq2js/rxblox#api-reference`
    );
  }

  const dispatcher = getDispatcher(eventToken);
  const onCleanup = emitter<void>();

  if (!dispatcher) {
    throw new Error(
      `Event dispatcher not found. This is an internal error - context type was "${contextType}" but no dispatcher was available.`
    );
  }

  // Register each event handler
  for (const eventName in events) {
    const callbacks = events[eventName as keyof EventDispatcher];

    if (!callbacks) {
      continue;
    }

    const emitter = dispatcher[eventName as keyof EventDispatcher];

    // Handle both single callback and array of callbacks
    if (Array.isArray(callbacks)) {
      callbacks.forEach((callback) => {
        onCleanup.on(emitter.on(callback));
      });
    } else {
      onCleanup.on(emitter.on(callbacks));
    }
  }

  return onCleanup.emitAndClear;
}

/**
 * Register a mount event handler for blox components.
 *
 * Convenience wrapper around `onEvent({ mount: ... })`.
 *
 * @param callbacks - One or more callbacks to run when component mounts
 * @returns Cleanup function to unregister the handler(s)
 */
export function onMount(...callbacks: VoidFunction[]): VoidFunction {
  return onEvent({ mount: callbacks.length === 1 ? callbacks[0] : callbacks });
}

/**
 * Register an unmount event handler for blox components.
 *
 * Convenience wrapper around `onEvent({ unmount: ... })`.
 *
 * @param callbacks - One or more callbacks to run when component unmounts
 * @returns Cleanup function to unregister the handler(s)
 */
export function onUnmount(...callbacks: VoidFunction[]): VoidFunction {
  return onEvent({
    unmount: callbacks.length === 1 ? callbacks[0] : callbacks,
  });
}

/**
 * Register a render event handler for blox components.
 *
 * Convenience wrapper around `onEvent({ render: ... })`.
 *
 * @param callbacks - One or more callbacks to run on each render
 * @returns Cleanup function to unregister the handler(s)
 */
export function onRender(...callbacks: VoidFunction[]): VoidFunction {
  return onEvent({ render: callbacks.length === 1 ? callbacks[0] : callbacks });
}
