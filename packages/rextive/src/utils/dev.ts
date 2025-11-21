/**
 * Development-only utilities.
 * 
 * These use the __DEV__ flag which should be defined by the consuming application's bundler.
 * 
 * **For consuming applications:**
 * Add this to your Vite config:
 * ```ts
 * export default defineConfig({
 *   define: {
 *     __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
 *   },
 * });
 * ```
 * 
 * In production builds with __DEV__ = false, all code inside `if (__DEV__)` blocks
 * is completely removed via dead code elimination.
 * 
 * If __DEV__ is not defined, these utilities fall back to checking process.env.NODE_ENV.
 */

/**
 * Global __DEV__ flag.
 * Should be defined by the consuming application's bundler.
 * If not defined, we fall back to runtime checks.
 */
declare const __DEV__: boolean | undefined;

/**
 * Runtime check for development mode.
 * Used as a fallback when __DEV__ is not defined by the consumer.
 */
function isDev(): boolean {
  // If __DEV__ is defined by the consumer's bundler, use it
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }
  
  // Fallback: check process.env.NODE_ENV at runtime
  // This won't be tree-shaken but ensures dev utilities work
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    // If process is not available (browser without polyfill), assume production
    return false;
  }
}

/**
 * Log a message only in development.
 * If __DEV__ is defined by the consumer's bundler and is false, this is removed.
 * 
 * @param message - Message to log
 * @param args - Additional arguments
 * 
 * @example
 * ```ts
 * devLog("Signal created:", signal);
 * // Production (with __DEV__ defined): removed entirely
 * // Development: console.log("Signal created:", signal)
 * ```
 */
export function devLog(message: string, ...args: any[]): void {
  if (isDev()) {
    console.log(`[rextive] ${message}`, ...args);
  }
}

/**
 * Log a warning only in development.
 * If __DEV__ is defined by the consumer's bundler and is false, this is removed.
 * 
 * @param message - Warning message
 * @param args - Additional arguments
 * 
 * @example
 * ```ts
 * devWarn("Deprecated API used");
 * // Production (with __DEV__ defined): removed entirely
 * // Development: console.warn("[rextive] Deprecated API used")
 * ```
 */
export function devWarn(message: string, ...args: any[]): void {
  if (isDev()) {
    console.warn(`[rextive] ${message}`, ...args);
  }
}

/**
 * Log an error only in development.
 * If __DEV__ is defined by the consumer's bundler and is false, this is removed.
 * 
 * @param message - Error message
 * @param args - Additional arguments
 * 
 * @example
 * ```ts
 * devError("Invalid configuration:", config);
 * // Production (with __DEV__ defined): removed entirely
 * // Development: console.error("[rextive] Invalid configuration:", config)
 * ```
 */
export function devError(message: string, ...args: any[]): void {
  if (isDev()) {
    console.error(`[rextive] ${message}`, ...args);
  }
}

/**
 * Execute code only in development.
 * If __DEV__ is defined by the consumer's bundler and is false, this is removed.
 * 
 * @param fn - Function to execute
 * 
 * @example
 * ```ts
 * devOnly(() => {
 *   validateSignalGraph();
 *   checkMemoryLeaks();
 * });
 * // Production (with __DEV__ defined): removed entirely
 * // Development: executes the function
 * ```
 */
export function devOnly(fn: () => void): void {
  if (isDev()) {
    fn();
  }
}

/**
 * Assert a condition only in development.
 * If __DEV__ is defined by the consumer's bundler and is false, this is removed.
 * 
 * @param condition - Condition to assert
 * @param message - Error message if assertion fails
 * 
 * @example
 * ```ts
 * devAssert(signal !== undefined, "Signal cannot be undefined");
 * // Production (with __DEV__ defined): removed entirely
 * // Development: throws if condition is false
 * ```
 */
export function devAssert(condition: boolean, message: string): void {
  if (isDev()) {
    if (!condition) {
      throw new Error(`[rextive] Assertion failed: ${message}`);
    }
  }
}

