import { Disposable } from "./types";

/**
 * Error thrown when one or more services fail to dispose.
 * Contains all errors that occurred during disposal.
 */
export class DisposalAggregateError extends Error {
  constructor(public errors: Error[], message: string) {
    super(message);
    this.name = "DisposalAggregateError";
  }
}

/**
 * Property merge strategy for combining disposables.
 * - "overwrite": Later services overwrite earlier ones (default)
 * - "error": Throw error if properties conflict
 */
export type PropertyMergeStrategy = "overwrite" | "error";

/**
 * Options for combining disposables.
 */
export type CombineDisposablesOptions = {
  /**
   * Merge strategy for conflicting properties (default: "overwrite")
   * - "overwrite": Later services overwrite earlier ones
   * - "error": Throw error if properties conflict
   */
  merge?: PropertyMergeStrategy;

  /**
   * Called before disposing all services
   */
  onBefore?: VoidFunction;

  /**
   * Called after disposing all services (even if errors occurred)
   */
  onAfter?: VoidFunction;
};

/**
 * Combines multiple disposable services into one.
 *
 * Features:
 * - Merges all service properties (excluding dispose)
 * - Creates unified dispose() that calls all disposals in reverse order (LIFO)
 * - Handles disposal errors gracefully - collects all errors and throws DisposeAggregateError
 * - Supports lifecycle callbacks (onBefore, onAfter)
 * - Two merge strategies: "overwrite" (default) or "error"
 *
 * @param disposables - Array of disposable services to combine
 * @param options - Combination options
 * @returns Combined service with unified dispose() method
 *
 * @example Basic usage
 * ```ts
 * const logger = { log: () => {}, dispose: () => {} }
 * const db = { query: () => {}, dispose: () => {} }
 *
 * const services = disposable([logger, db])
 * services.log()    // ✅ Works
 * services.query()  // ✅ Works
 * services.dispose() // Calls db.dispose(), then logger.dispose()
 * ```
 *
 * @example With merge strategy "error"
 * ```ts
 * const s1 = { save: () => 1, dispose: () => {} }
 * const s2 = { save: () => 2, dispose: () => {} }
 *
 * disposable([s1, s2], { merge: "error" })
 * // ❌ Throws: Property conflict: 'save' exists in multiple services
 * ```
 *
 * @example With lifecycle callbacks
 * ```ts
 * const services = disposable([logger, db], {
 *   onBefore: () => console.log('Cleaning up...'),
 *   onAfter: () => console.log('Done!'),
 * })
 * ```
 */
export function disposable<T extends Record<string, any>[]>(
  disposables: T,
  options?: CombineDisposablesOptions
): Disposable & UnionToIntersection<T[number]> {
  const { merge = "overwrite", onBefore, onAfter } = options || {};

  // Track disposal state
  let disposed = false;

  // Create combined service
  const combined: any = {};
  const seenProperties = new Set<string>();

  // Merge all properties (except dispose)
  for (const service of disposables) {
    if (!service || typeof service !== "object") continue;

    for (const [key, value] of Object.entries(service)) {
      if (key === "dispose") continue; // Skip dispose, we'll create our own

      // Check for conflicts if merge strategy is "error"
      if (merge === "error" && seenProperties.has(key)) {
        throw new Error(
          `Property conflict: '${key}' exists in multiple services. ` +
            `Use merge strategy "overwrite" or ensure unique property names.`
        );
      }

      seenProperties.add(key);
      combined[key] = value;
    }
  }

  // Create unified dispose method
  combined.dispose = () => {
    if (disposed) {
      console.warn("disposable: Already disposed, ignoring");
      return;
    }

    disposed = true;

    // Call onBefore
    onBefore?.();

    const errors: Error[] = [];

    // Dispose in REVERSE order (LIFO - like cleanup stacks)
    for (let i = disposables.length - 1; i >= 0; i--) {
      const service = disposables[i];

      if (!service || typeof service !== "object") continue;

      // Check if service has dispose method
      if (typeof service.dispose === "function") {
        try {
          service.dispose();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const wrappedError = new Error(
            `Failed to dispose service at index ${i}: ${message}`
          );
          // Attach original error for debugging
          (wrappedError as any).cause = error;
          errors.push(wrappedError);
        }
      }
    }

    // Call onAfter (even if errors occurred)
    onAfter?.();

    // Throw if any errors occurred
    if (errors.length > 0) {
      throw new DisposalAggregateError(
        errors,
        `Failed to dispose ${errors.length} service(s)`
      );
    }
  };

  return combined;
}

/**
 * Type helper to convert union to intersection
 * @internal
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
