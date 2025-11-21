/**
 * Performs a shallow equality comparison between two values.
 *
 * - Primitives are compared with Object.is
 * - Arrays are compared element by element (shallow)
 * - Objects are compared key by key (shallow)
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if values are shallowly equal
 *
 * @example
 * ```ts
 * shallowEquals(1, 1) // true
 * shallowEquals({ a: 1 }, { a: 1 }) // true
 * shallowEquals({ a: 1, b: 2 }, { a: 1 }) // false (different keys)
 * shallowEquals([1, 2], [1, 2]) // true
 * shallowEquals([1, { x: 1 }], [1, { x: 1 }]) // false (nested objects not deeply compared)
 * ```
 */
export function shallowEquals(a: any, b: any): boolean {
  // Same reference or both primitives equal
  if (Object.is(a, b)) {
    return true;
  }

  // If either is null/undefined or not an object, they're not equal
  if (
    a == null ||
    b == null ||
    typeof a !== "object" ||
    typeof b !== "object"
  ) {
    return false;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  // One is array, other is not
  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  // Handle objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is(a[key], b[key])
    ) {
      return false;
    }
  }

  return true;
}

