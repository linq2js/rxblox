import { describe, it, expect } from "vitest";
import { objectKeyedCollection } from "./objectKeyedCollection";
import { shallowEquals } from "./shallowEquals";

describe("objectKeyedCollection", () => {
  describe("basic operations", () => {
    it("should set and get values", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");

      expect(collection.get(1)).toBe("one");
      expect(collection.get(2)).toBe("two");
    });

    it("should return undefined for non-existent keys", () => {
      const collection = objectKeyedCollection<number, string>();

      expect(collection.get(1)).toBeUndefined();
    });

    it("should update existing values", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      expect(collection.get(1)).toBe("one");

      collection.set(1, "ONE");
      expect(collection.get(1)).toBe("ONE");
      expect(collection.size()).toBe(1);
    });

    it("should delete values", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      expect(collection.has(1)).toBe(true);

      const deleted = collection.delete(1);
      expect(deleted).toBe(true);
      expect(collection.has(1)).toBe(false);
      expect(collection.get(1)).toBeUndefined();
    });

    it("should return false when deleting non-existent key", () => {
      const collection = objectKeyedCollection<number, string>();

      const deleted = collection.delete(1);
      expect(deleted).toBe(false);
    });

    it("should check if key exists with has()", () => {
      const collection = objectKeyedCollection<number, string>();

      expect(collection.has(1)).toBe(false);

      collection.set(1, "one");
      expect(collection.has(1)).toBe(true);

      collection.delete(1);
      expect(collection.has(1)).toBe(false);
    });

    it("should clear all entries", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      expect(collection.size()).toBe(3);

      collection.clear();

      expect(collection.size()).toBe(0);
      expect(collection.has(1)).toBe(false);
      expect(collection.has(2)).toBe(false);
      expect(collection.has(3)).toBe(false);
    });

    it("should report correct size", () => {
      const collection = objectKeyedCollection<number, string>();

      expect(collection.size()).toBe(0);

      collection.set(1, "one");
      expect(collection.size()).toBe(1);

      collection.set(2, "two");
      expect(collection.size()).toBe(2);

      collection.delete(1);
      expect(collection.size()).toBe(1);

      collection.clear();
      expect(collection.size()).toBe(0);
    });
  });

  describe("custom equality", () => {
    it("should use custom equality function", () => {
      const collection = objectKeyedCollection<{ id: number }, string>(
        shallowEquals
      );

      collection.set({ id: 1 }, "one");
      collection.set({ id: 2 }, "two");

      // Different object reference but same content
      expect(collection.get({ id: 1 })).toBe("one");
      expect(collection.get({ id: 2 })).toBe("two");
    });

    it("should update using custom equality", () => {
      const collection = objectKeyedCollection<{ id: number }, string>(
        shallowEquals
      );

      collection.set({ id: 1 }, "one");
      expect(collection.size()).toBe(1);

      // Update with different object reference but same content
      collection.set({ id: 1 }, "ONE");
      expect(collection.size()).toBe(1);
      expect(collection.get({ id: 1 })).toBe("ONE");
    });

    it("should delete using custom equality", () => {
      const collection = objectKeyedCollection<{ id: number }, string>(
        shallowEquals
      );

      collection.set({ id: 1 }, "one");
      expect(collection.has({ id: 1 })).toBe(true);

      // Delete with different object reference but same content
      const deleted = collection.delete({ id: 1 });
      expect(deleted).toBe(true);
      expect(collection.has({ id: 1 })).toBe(false);
    });

    it("should work with deep equality for nested objects", () => {
      const deepEquals = (a: any, b: any): boolean => {
        if (a === b) return true;
        if (typeof a !== "object" || typeof b !== "object") return false;
        if (a === null || b === null) return false;

        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
          if (!keysB.includes(key)) return false;
          if (!deepEquals(a[key], b[key])) return false;
        }

        return true;
      };

      const collection = objectKeyedCollection<
        { user: { id: number; name: string } },
        string
      >(deepEquals);

      collection.set({ user: { id: 1, name: "Alice" } }, "value1");

      // Different object reference but same nested content
      expect(collection.get({ user: { id: 1, name: "Alice" } })).toBe("value1");
    });
  });

  describe("LRU ordering", () => {
    it("should maintain insertion order", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      expect(collection.keys()).toEqual([1, 2, 3]);
      expect(collection.values()).toEqual(["one", "two", "three"]);
    });

    it("should move accessed entries to the end", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      // Access entry 1 - should move to end
      collection.get(1);

      expect(collection.keys()).toEqual([2, 3, 1]);
      expect(collection.values()).toEqual(["two", "three", "one"]);
    });

    it("should move updated entries to the end", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      // Update entry 1 - should move to end
      collection.set(1, "ONE");

      expect(collection.keys()).toEqual([2, 3, 1]);
      expect(collection.values()).toEqual(["two", "three", "ONE"]);
    });

    it("should not move entries when checking with has()", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      // Check with has() - should NOT move
      collection.has(1);

      expect(collection.keys()).toEqual([1, 2, 3]);
    });
  });

  describe("iteration methods", () => {
    it("should return correct entries()", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      expect(collection.entries()).toEqual([
        [1, "one"],
        [2, "two"],
        [3, "three"],
      ]);
    });

    it("should return correct keys()", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      expect(collection.keys()).toEqual([1, 2, 3]);
    });

    it("should return correct values()", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      expect(collection.values()).toEqual(["one", "two", "three"]);
    });

    it("should iterate with forEach()", () => {
      const collection = objectKeyedCollection<number, string>();

      collection.set(1, "one");
      collection.set(2, "two");
      collection.set(3, "three");

      const collected: Array<[string, number, number]> = [];
      collection.forEach((value, key, index) => {
        collected.push([value, key, index]);
      });

      expect(collected).toEqual([
        ["one", 1, 0],
        ["two", 2, 1],
        ["three", 3, 2],
      ]);
    });

    it("should return empty arrays for empty collection", () => {
      const collection = objectKeyedCollection<number, string>();

      expect(collection.entries()).toEqual([]);
      expect(collection.keys()).toEqual([]);
      expect(collection.values()).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle null values", () => {
      const collection = objectKeyedCollection<number, null>();

      collection.set(1, null);
      expect(collection.get(1)).toBeNull();
      expect(collection.has(1)).toBe(true);
    });

    it("should handle undefined values", () => {
      const collection = objectKeyedCollection<number, undefined>();

      collection.set(1, undefined);
      expect(collection.get(1)).toBeUndefined();
      expect(collection.has(1)).toBe(true); // Key exists even with undefined value
    });

    it("should handle object keys", () => {
      const collection = objectKeyedCollection<{ id: number }, string>(
        shallowEquals
      );

      const key1 = { id: 1 };
      const key2 = { id: 2 };

      collection.set(key1, "one");
      collection.set(key2, "two");

      expect(collection.get({ id: 1 })).toBe("one");
      expect(collection.get({ id: 2 })).toBe("two");
    });

    it("should handle complex object values", () => {
      const collection = objectKeyedCollection<
        number,
        { name: string; age: number }
      >();

      collection.set(1, { name: "Alice", age: 30 });
      collection.set(2, { name: "Bob", age: 25 });

      expect(collection.get(1)).toEqual({ name: "Alice", age: 30 });
      expect(collection.get(2)).toEqual({ name: "Bob", age: 25 });
    });
  });
});
