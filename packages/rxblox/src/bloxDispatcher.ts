import { dispatcherToken } from "./dispatcher";

/**
 * Blox context dispatcher.
 * 
 * This dispatcher marks code as running inside a blox component.
 * Used to validate that certain APIs (like blox.slot, blox.hook, etc.)
 * are only called within blox components.
 */
export interface BloxDispatcher {
  /**
   * Marker to indicate we're in a blox component context.
   * The actual value doesn't matter, just the presence of the dispatcher.
   */
  readonly isBlox: true;
}

/**
 * Token for accessing the blox dispatcher.
 * Used to check if code is running inside a blox component.
 * 
 * @example
 * ```ts
 * const bloxContext = getDispatcher(bloxToken);
 * if (!bloxContext) {
 *   throw new Error("Must be called inside a blox component");
 * }
 * ```
 */
export const bloxToken = dispatcherToken<BloxDispatcher>("blox");

/**
 * Create a blox dispatcher instance.
 * This is a simple marker object.
 */
export function bloxDispatcher(): BloxDispatcher {
  return {
    isBlox: true,
  };
}

