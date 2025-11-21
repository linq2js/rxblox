import { describe, it, expect } from "vitest";
import { shallowEquals } from "./shallowEquals";

describe("shallowEquals", () => {
  describe("primitives", () => {
    it("should return true for same primitives", () => {
      expect(shallowEquals(1, 1)).toBe(true);
      expect(shallowEquals("test", "test")).toBe(true);
      expect(shallowEquals(true, true)).toBe(true);
      expect(shallowEquals(null, null)).toBe(true);
      expect(shallowEquals(undefined, undefined)).toBe(true);
    });

    it("should return false for different primitives", () => {
      expect(shallowEquals(1, 2)).toBe(false);
      expect(shallowEquals("test", "other")).toBe(false);
      expect(shallowEquals(true, false)).toBe(false);
      expect(shallowEquals(null, undefined)).toBe(false);
    });

    it("should handle NaN correctly", () => {
      expect(shallowEquals(NaN, NaN)).toBe(true);
    });

    it("should handle +0 and -0 correctly", () => {
      // Object.is treats +0 and -0 as different
      expect(shallowEquals(0, -0)).toBe(false);
      expect(shallowEquals(-0, 0)).toBe(false);
      expect(shallowEquals(0, 0)).toBe(true);
      expect(shallowEquals(-0, -0)).toBe(true);
    });
  });

  describe("objects", () => {
    it("should return true for same object reference", () => {
      const obj = { a: 1 };
      expect(shallowEquals(obj, obj)).toBe(true);
    });

    it("should return true for shallowly equal objects", () => {
      expect(shallowEquals({ a: 1 }, { a: 1 })).toBe(true);
      expect(shallowEquals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(shallowEquals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });

    it("should return false for objects with different values", () => {
      expect(shallowEquals({ a: 1 }, { a: 2 })).toBe(false);
      expect(shallowEquals({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    });

    it("should return false for objects with different keys", () => {
      expect(shallowEquals({ a: 1 }, { b: 1 })).toBe(false);
      expect(shallowEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(shallowEquals({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    });

    it("should not deeply compare nested objects", () => {
      expect(shallowEquals({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false);
      expect(shallowEquals({ a: [1, 2] }, { a: [1, 2] })).toBe(false);
    });

    it("should handle nested objects with same reference", () => {
      const nested = { x: 1 };
      expect(shallowEquals({ a: nested }, { a: nested })).toBe(true);
    });

    it("should return false for null/undefined vs object", () => {
      expect(shallowEquals({}, null)).toBe(false);
      expect(shallowEquals(null, {})).toBe(false);
      expect(shallowEquals({}, undefined)).toBe(false);
      expect(shallowEquals(undefined, {})).toBe(false);
    });
  });

  describe("arrays", () => {
    it("should return true for same array reference", () => {
      const arr = [1, 2, 3];
      expect(shallowEquals(arr, arr)).toBe(true);
    });

    it("should return true for shallowly equal arrays", () => {
      expect(shallowEquals([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(shallowEquals(["a", "b"], ["a", "b"])).toBe(true);
      expect(shallowEquals([], [])).toBe(true);
    });

    it("should return false for arrays with different values", () => {
      expect(shallowEquals([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(shallowEquals(["a", "b"], ["a", "c"])).toBe(false);
    });

    it("should return false for arrays with different lengths", () => {
      expect(shallowEquals([1, 2], [1, 2, 3])).toBe(false);
      expect(shallowEquals([1, 2, 3], [1, 2])).toBe(false);
      expect(shallowEquals([], [1])).toBe(false);
    });

    it("should not deeply compare nested arrays", () => {
      expect(shallowEquals([[1, 2]], [[1, 2]])).toBe(false);
      expect(shallowEquals([{ x: 1 }], [{ x: 1 }])).toBe(false);
    });

    it("should handle nested arrays with same reference", () => {
      const nested = [1, 2];
      expect(shallowEquals([nested], [nested])).toBe(true);
    });

    it("should return false for array vs object", () => {
      expect(shallowEquals([1, 2], { 0: 1, 1: 2 })).toBe(false);
      expect(shallowEquals({ 0: 1, 1: 2 }, [1, 2])).toBe(false);
    });

    it("should return false for null/undefined vs array", () => {
      expect(shallowEquals([], null)).toBe(false);
      expect(shallowEquals(null, [])).toBe(false);
      expect(shallowEquals([], undefined)).toBe(false);
      expect(shallowEquals(undefined, [])).toBe(false);
    });
  });

  describe("mixed types", () => {
    it("should return false for different types", () => {
      expect(shallowEquals(1, "1")).toBe(false);
      expect(shallowEquals(true, 1)).toBe(false);
      expect(shallowEquals({}, [])).toBe(false);
      expect(shallowEquals([], {})).toBe(false);
      expect(shallowEquals(0, false)).toBe(false);
      expect(shallowEquals("", false)).toBe(false);
    });

    it("should handle primitive vs object wrapper", () => {
      expect(shallowEquals(1, Object(1))).toBe(false);
      expect(shallowEquals("test", Object("test"))).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty objects", () => {
      expect(shallowEquals({}, {})).toBe(true);
    });

    it("should handle empty arrays", () => {
      expect(shallowEquals([], [])).toBe(true);
    });

    it("should handle objects with undefined values", () => {
      expect(shallowEquals({ a: undefined }, { a: undefined })).toBe(true);
      expect(shallowEquals({ a: undefined }, { b: undefined })).toBe(false);
    });

    it("should handle objects with null values", () => {
      expect(shallowEquals({ a: null }, { a: null })).toBe(true);
      expect(shallowEquals({ a: null }, { a: undefined })).toBe(false);
    });

    it("should handle Date objects", () => {
      const date = new Date();
      expect(shallowEquals(date, date)).toBe(true);
      // Different Date instances are treated as objects and compared shallowly
      // They have the same properties, so they are equal
      expect(shallowEquals(new Date(2020, 0, 1), new Date(2020, 0, 1))).toBe(
        true
      );
    });

    it("should handle RegExp objects", () => {
      const regex = /test/;
      expect(shallowEquals(regex, regex)).toBe(true);
      // Different RegExp instances are treated as objects and compared shallowly
      // They have the same properties, so they are equal
      expect(shallowEquals(/test/, /test/)).toBe(true);
    });
  });
});

