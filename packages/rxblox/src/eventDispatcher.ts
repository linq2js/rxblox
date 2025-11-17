import { dispatcherToken, getDispatcher, getContextType } from "./dispatcher";
import { Emitter } from "./emitter";

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
 * Internal helper to register callbacks for a specific event type.
 *
 * @param type - The event type (unmount, mount, or render)
 * @param callbacks - Callbacks to register for this event
 * @throws {Error} If called outside a blox or slot context
 */
function onEvent(type: keyof EventDispatcher, callbacks: VoidFunction[]) {
  const contextType = getContextType();

  if (contextType !== "blox" && contextType !== "slot") {
    throw new Error(
      `blox.on${type.charAt(0).toUpperCase() + type.slice(1)}() must be called inside a blox component or blox.slot() callback.\n\n` +
      `Current context: ${contextType || "none"}\n\n` +
      `❌ Don't do this:\n` +
      `  function MyComponent() {\n` +
      `    blox.on${type.charAt(0).toUpperCase() + type.slice(1)}(() => console.log('${type}'));  // Wrong context!\n` +
      `    return <div>Content</div>;\n` +
      `  }\n\n` +
      `✅ Instead, use blox():\n` +
      `  const MyComponent = blox(() => {\n` +
      `    blox.on${type.charAt(0).toUpperCase() + type.slice(1)}(() => console.log('${type}'));  // Correct!\n` +
      `    return <div>Content</div>;\n` +
      `  });\n\n` +
      `See: https://github.com/linq2js/rxblox#api-reference`
    );
  }

  const dispatcher = getDispatcher(eventToken);

  if (!dispatcher) {
    throw new Error(
      `Event dispatcher not found. This is an internal error - context type was "${contextType}" but no dispatcher was available.`
    );
  }

  callbacks.forEach((callback) => dispatcher[type].on(callback));
}

/**
 * Registers callbacks to run when the component unmounts.
 *
 * Must be called inside a `blox` component or `blox.slot()` callback.
 * Exported as `blox.onUnmount()`.
 *
 * @param callbacks - Functions to call on component unmount
 * @throws {Error} If called outside a blox or slot context
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   blox.onUnmount(() => console.log("Unmounting"));
 *   return <div>Content</div>;
 * });
 * ```
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   const [slot] = blox.slot(() => {
 *     blox.onUnmount(() => console.log("Cleanup"));
 *     return "some logic";
 *   });
 *   return <div>{slot}</div>;
 * });
 * ```
 */
export function onUnmount(...callbacks: VoidFunction[]) {
  onEvent("unmount", callbacks);
}

/**
 * Registers callbacks to run when the component mounts.
 *
 * Must be called inside a `blox` component or `blox.slot()` callback.
 * Exported as `blox.onMount()`.
 *
 * @param callbacks - Functions to call on component mount
 * @throws {Error} If called outside a blox or slot context
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   blox.onMount(() => console.log("Mounted"));
 *   return <div>Content</div>;
 * });
 * ```
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   const [slot] = blox.slot(() => {
 *     blox.onMount(() => console.log("Slot mounted"));
 *     return "some logic";
 *   });
 *   return <div>{slot}</div>;
 * });
 * ```
 */
export function onMount(...callbacks: VoidFunction[]) {
  onEvent("mount", callbacks);
}

/**
 * Registers callbacks to run on each render.
 *
 * Must be called inside a `blox` component or `blox.slot()` callback during the definition phase.
 * The callback executes during React's render phase, enabling React hooks usage.
 * Exported as `blox.onRender()`.
 *
 * @param callbacks - Functions to call on each render
 * @throws {Error} If called outside a blox or slot context
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   blox.onRender(() => {
 *     const history = useHistory();
 *     // Note: no return value
 *   });
 *   return <div>Content</div>;
 * });
 * ```
 *
 * @example
 * ```tsx
 * const MyComponent = blox(() => {
 *   const [slot] = blox.slot(() => {
 *     blox.onRender(() => console.log("Slot rendering"));
 *     return "some logic";
 *   });
 *   return <div>{slot}</div>;
 * });
 * ```
 */
export function onRender(...callbacks: VoidFunction[]) {
  onEvent("render", callbacks);
}
