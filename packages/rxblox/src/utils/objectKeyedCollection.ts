/**
 * A collection that uses custom equality for object keys.
 *
 * Unlike JavaScript's Map which uses reference equality, this collection
 * allows custom equality functions (e.g., shallow equality, deep equality)
 * for comparing keys.
 *
 * Implements LRU (Least Recently Used) ordering - accessed entries are
 * moved to the end of the collection.
 */
export type ObjectKeyedCollection<K, V> = {
  /**
   * Get a value by key. Moves the entry to the end (most recently used).
   * @returns The value if found, undefined otherwise
   */
  get(key: K): V | undefined;

  /**
   * Set or update a value by key.
   * If the key exists, updates the value and moves it to the end.
   * If the key doesn't exist, adds a new entry at the end.
   */
  set(key: K, value: V): void;

  /**
   * Delete an entry by key.
   * @returns true if the entry was found and deleted, false otherwise
   */
  delete(key: K): boolean;

  /**
   * Check if a key exists in the collection.
   * Does NOT move the entry (non-mutating check).
   */
  has(key: K): boolean;

  /**
   * Remove all entries from the collection.
   */
  clear(): void;

  /**
   * Get the number of entries in the collection.
   */
  size(): number;

  /**
   * Get an array of all [key, value] pairs.
   * Ordered from oldest (first) to newest (last).
   */
  entries(): Array<[K, V]>;

  /**
   * Get an array of all keys.
   * Ordered from oldest (first) to newest (last).
   */
  keys(): K[];

  /**
   * Get an array of all values.
   * Ordered from oldest (first) to newest (last).
   */
  values(): V[];

  /**
   * Iterate over all entries in the collection.
   * Ordered from oldest (first) to newest (last).
   */
  forEach(callback: (value: V, key: K, index: number) => void): void;
};

/**
 * Internal entry structure for the collection.
 */
type Entry<K, V> = {
  key: K;
  value: V;
};

/**
 * Creates a new object-keyed collection with custom equality.
 *
 * @param equals - Custom equality function for comparing keys (default: Object.is)
 * @returns A new collection instance
 *
 * @example Basic usage with shallow equality
 * ```ts
 * import { shallowEquals } from "rxblox";
 *
 * const collection = createObjectKeyedCollection<
 *   { id: number },
 *   string
 * >(shallowEquals);
 *
 * collection.set({ id: 1 }, "Alice");
 * collection.set({ id: 2 }, "Bob");
 *
 * console.log(collection.get({ id: 1 })); // "Alice"
 * console.log(collection.size()); // 2
 * ```
 *
 * @example LRU behavior
 * ```ts
 * const collection = createObjectKeyedCollection<number, string>();
 *
 * collection.set(1, "first");
 * collection.set(2, "second");
 * collection.set(3, "third");
 *
 * // Access "first" - moves it to the end
 * collection.get(1);
 *
 * // Now order is: [2, 3, 1]
 * console.log(collection.keys()); // [2, 3, 1]
 * ```
 */
export function objectKeyedCollection<K, V>(
  equals: (a: K, b: K) => boolean = Object.is
): ObjectKeyedCollection<K, V> {
  const entries: Array<Entry<K, V>> = [];

  return {
    get(key: K): V | undefined {
      const index = entries.findIndex((entry) => equals(entry.key, key));
      if (index === -1) return undefined;

      // Move to end (LRU - most recently used)
      const [entry] = entries.splice(index, 1);
      entries.push(entry);

      return entry.value;
    },

    set(key: K, value: V): void {
      const index = entries.findIndex((entry) => equals(entry.key, key));

      if (index !== -1) {
        // Update existing entry and move to end
        const [entry] = entries.splice(index, 1);
        entry.value = value;
        entries.push(entry);
      } else {
        // Add new entry at end
        entries.push({ key, value });
      }
    },

    delete(key: K): boolean {
      const index = entries.findIndex((entry) => equals(entry.key, key));
      if (index === -1) return false;

      entries.splice(index, 1);
      return true;
    },

    has(key: K): boolean {
      return entries.findIndex((entry) => equals(entry.key, key)) !== -1;
    },

    clear(): void {
      entries.length = 0;
    },

    size(): number {
      return entries.length;
    },

    entries(): Array<[K, V]> {
      return entries.map((entry) => [entry.key, entry.value]);
    },

    keys(): K[] {
      return entries.map((entry) => entry.key);
    },

    values(): V[] {
      return entries.map((entry) => entry.value);
    },

    forEach(callback: (value: V, key: K, index: number) => void): void {
      entries.forEach((entry, index) => {
        callback(entry.value, entry.key, index);
      });
    },
  };
}
