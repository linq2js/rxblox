import { describe, it, expect } from "vitest";
import { tag } from "./tag";
import { signal } from "./signal";

describe("tag", () => {
  describe("Basic tag operations", () => {
    it("should create an empty tag", () => {
      const myTag = tag<number>();
      expect(myTag.size).toBe(0);
      expect(myTag.signals()).toEqual([]);
    });

    it("should add signals to tag via options", () => {
      const myTag = tag<number>();
      const count = signal(0, { tags: [myTag] });

      expect(myTag.size).toBe(1);
      expect(myTag.has(count)).toBe(true);
      expect(myTag.signals()).toContain(count);
    });

    it("should add multiple signals to the same tag", () => {
      const myTag = tag<number>();
      const a = signal(1, { tags: [myTag] });
      const b = signal(2, { tags: [myTag] });
      const c = signal(3, { tags: [myTag] });

      expect(myTag.size).toBe(3);
      expect(myTag.signals()).toEqual([a, b, c]);
    });

    it("should support signals belonging to multiple tags", () => {
      const tag1 = tag<number>();
      const tag2 = tag<number>();
      const count = signal(0, { tags: [tag1, tag2] });

      expect(tag1.has(count)).toBe(true);
      expect(tag2.has(count)).toBe(true);
      expect(tag1.size).toBe(1);
      expect(tag2.size).toBe(1);
    });
  });

  describe("has()", () => {
    it("should return true for signals in the tag", () => {
      const myTag = tag<number>();
      const count = signal(0, { tags: [myTag] });

      expect(myTag.has(count)).toBe(true);
    });

    it("should return false for signals not in the tag", () => {
      const myTag = tag<number>();
      const count = signal(0);

      expect(myTag.has(count)).toBe(false);
    });
  });

  describe("delete()", () => {
    it("should remove a signal from the tag", () => {
      const myTag = tag<number>();
      const count = signal(0, { tags: [myTag] });

      expect(myTag.size).toBe(1);
      const removed = myTag.delete(count);

      expect(removed).toBe(true);
      expect(myTag.size).toBe(0);
      expect(myTag.has(count)).toBe(false);
    });

    it("should return false when deleting non-existent signal", () => {
      const myTag = tag<number>();
      const count = signal(0);

      const removed = myTag.delete(count);
      expect(removed).toBe(false);
    });

    it("should not affect other tags when deleting", () => {
      const tag1 = tag<number>();
      const tag2 = tag<number>();
      const count = signal(0, { tags: [tag1, tag2] });

      tag1.delete(count);

      expect(tag1.has(count)).toBe(false);
      expect(tag2.has(count)).toBe(true);
    });
  });

  describe("clear()", () => {
    it("should remove all signals from the tag", () => {
      const myTag = tag<number>();
      signal(1, { tags: [myTag] });
      signal(2, { tags: [myTag] });
      signal(3, { tags: [myTag] });

      expect(myTag.size).toBe(3);
      myTag.clear();

      expect(myTag.size).toBe(0);
      expect(myTag.signals()).toEqual([]);
    });

    it("should handle clearing an empty tag", () => {
      const myTag = tag<number>();

      expect(() => myTag.clear()).not.toThrow();
      expect(myTag.size).toBe(0);
    });
  });

  describe("forEach()", () => {
    it("should iterate over all signals in the tag", () => {
      const myTag = tag<number>();
      const a = signal(1, { tags: [myTag] });
      const b = signal(2, { tags: [myTag] });
      const c = signal(3, { tags: [myTag] });

      const visited: (typeof a)[] = [];
      myTag.forEach((sig) => visited.push(sig));

      expect(visited).toEqual([a, b, c]);
    });

    it("should handle empty tag", () => {
      const myTag = tag<number>();
      const visited: any[] = [];

      myTag.forEach((sig) => visited.push(sig));

      expect(visited).toEqual([]);
    });

    it("should allow signal operations during iteration", () => {
      const myTag = tag<number>();
      const a = signal(1, { tags: [myTag] });
      const b = signal(2, { tags: [myTag] });

      const values: number[] = [];
      myTag.forEach((sig) => {
        values.push(sig());
        sig.set((v) => v * 2);
      });

      expect(values).toEqual([1, 2]);
      expect(a()).toBe(2);
      expect(b()).toBe(4);
    });
  });

  describe("signals()", () => {
    it("should return array of all signals", () => {
      const myTag = tag<number>();
      const a = signal(1, { tags: [myTag] });
      const b = signal(2, { tags: [myTag] });

      const result = myTag.signals();

      expect(result).toEqual([a, b]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array for empty tag", () => {
      const myTag = tag<number>();

      expect(myTag.signals()).toEqual([]);
    });

    it("should return a new array each time", () => {
      const myTag = tag<number>();
      signal(1, { tags: [myTag] });

      const arr1 = myTag.signals();
      const arr2 = myTag.signals();

      expect(arr1).toEqual(arr2);
      expect(arr1).not.toBe(arr2); // Different array instances
    });
  });

  describe("Auto-removal on dispose", () => {
    it("should remove signal from tag when disposed", () => {
      const myTag = tag<number>();
      const count = signal(0, { tags: [myTag] });

      expect(myTag.size).toBe(1);
      count.dispose();

      expect(myTag.size).toBe(0);
      expect(myTag.has(count)).toBe(false);
    });

    it("should remove from all tags when disposed", () => {
      const tag1 = tag<number>();
      const tag2 = tag<number>();
      const count = signal(0, { tags: [tag1, tag2] });

      expect(tag1.size).toBe(1);
      expect(tag2.size).toBe(1);

      count.dispose();

      expect(tag1.size).toBe(0);
      expect(tag2.size).toBe(0);
    });
  });

  describe("_add() internal method", () => {
    it("should throw error for non-signal values", () => {
      const myTag = tag<number>();

      expect(() => {
        (myTag as any)._add({ value: 42 });
      }).toThrow("Only signals created by rextive can be tagged");
    });

    it("should add signal successfully", () => {
      const myTag = tag<number>();
      const count = signal(0);

      (myTag as any)._add(count);

      expect(myTag.has(count)).toBe(true);
      expect(myTag.size).toBe(1);
    });
  });

  describe("_remove() internal method", () => {
    it("should remove signal from tag", () => {
      const myTag = tag<number>();
      const count = signal(0, { tags: [myTag] });

      expect(myTag.size).toBe(1);
      (myTag as any)._remove(count);

      expect(myTag.size).toBe(0);
    });

    it("should handle removing non-existent signal", () => {
      const myTag = tag<number>();
      const count = signal(0);

      expect(() => {
        (myTag as any)._remove(count);
      }).not.toThrow();
    });
  });

  describe("Multi-tag operations", () => {
    describe("tag.forEach()", () => {
      it("should iterate over signals from multiple tags", () => {
        const tag1 = tag<number>();
        const tag2 = tag<number>();

        const a = signal(1, { tags: [tag1] });
        const b = signal(2, { tags: [tag2] });
        const c = signal(3, { tags: [tag1] });

        const visited: any[] = [];
        tag.forEach([tag1, tag2], (sig) => visited.push(sig));

        expect(visited).toContain(a);
        expect(visited).toContain(b);
        expect(visited).toContain(c);
        expect(visited.length).toBe(3);
      });

      it("should deduplicate signals in multiple tags", () => {
        const tag1 = tag<number>();
        const tag2 = tag<number>();

        const shared = signal(1, { tags: [tag1, tag2] });
        const a = signal(2, { tags: [tag1] });
        const b = signal(3, { tags: [tag2] });

        const visited: any[] = [];
        tag.forEach([tag1, tag2], (sig) => visited.push(sig));

        // shared should appear only once
        expect(visited.filter((s) => s === shared).length).toBe(1);
        expect(visited.length).toBe(3);
      });

      it("should handle empty tags array", () => {
        const visited: any[] = [];
        tag.forEach([], (sig) => visited.push(sig));

        expect(visited).toEqual([]);
      });

      it("should handle tags with no signals", () => {
        const tag1 = tag<number>();
        const tag2 = tag<number>();

        const visited: any[] = [];
        tag.forEach([tag1, tag2], (sig) => visited.push(sig));

        expect(visited).toEqual([]);
      });
    });

    describe("tag.signals()", () => {
      it("should return signals from multiple tags", () => {
        const tag1 = tag<number>();
        const tag2 = tag<number>();

        const a = signal(1, { tags: [tag1] });
        const b = signal(2, { tags: [tag2] });

        const result = tag.signals([tag1, tag2]);

        expect(result).toContain(a);
        expect(result).toContain(b);
        expect(result.length).toBe(2);
      });

      it("should deduplicate signals in multiple tags", () => {
        const tag1 = tag<number>();
        const tag2 = tag<number>();

        const shared = signal(1, { tags: [tag1, tag2] });
        const a = signal(2, { tags: [tag1] });

        const result = tag.signals([tag1, tag2]);

        expect(result.filter((s) => s === shared).length).toBe(1);
        expect(result.length).toBe(2);
      });

      it("should return empty array for empty tags", () => {
        const tag1 = tag<number>();
        const tag2 = tag<number>();

        const result = tag.signals([tag1, tag2]);

        expect(result).toEqual([]);
      });

      it("should return empty array for empty tags array", () => {
        const result = tag.signals([]);

        expect(result).toEqual([]);
      });
    });
  });

  describe("Practical use cases", () => {
    it("should support form field grouping and reset", () => {
      const formTag = tag<string>();

      const name = signal("", { tags: [formTag] });
      const email = signal("", { tags: [formTag] });
      const phone = signal("", { tags: [formTag] });

      // Set values
      name.set("Alice");
      email.set("alice@example.com");
      phone.set("555-1234");

      expect(name()).toBe("Alice");
      expect(email()).toBe("alice@example.com");
      expect(phone()).toBe("555-1234");

      // Reset all form fields
      formTag.forEach((sig) => sig.reset());

      expect(name()).toBe("");
      expect(email()).toBe("");
      expect(phone()).toBe("");
    });

    it("should support resource cleanup via tag", () => {
      const resourceTag = tag<any>();

      const resource1 = signal({ id: 1 }, { tags: [resourceTag] });
      const resource2 = signal({ id: 2 }, { tags: [resourceTag] });
      const resource3 = signal({ id: 3 }, { tags: [resourceTag] });

      expect(resourceTag.size).toBe(3);

      // Dispose all resources
      resourceTag.forEach((sig) => sig.dispose());

      // All should be auto-removed from tag after disposal
      expect(resourceTag.size).toBe(0);
    });

    it("should support debugging and logging", () => {
      const debugTag = tag<number>();

      const counter1 = signal(0, { tags: [debugTag], name: "counter1" });
      const counter2 = signal(0, { tags: [debugTag], name: "counter2" });

      const names: string[] = [];
      const values: number[] = [];

      debugTag.forEach((sig) => {
        names.push(sig.displayName || "unnamed");
        values.push(sig());
      });

      expect(names).toEqual(["counter1", "counter2"]);
      expect(values).toEqual([0, 0]);
    });
  });
});
