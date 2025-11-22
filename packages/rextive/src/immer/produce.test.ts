import { describe, it, expect } from "vitest";
import { signal } from "../signal";
import { produce } from "./produce";

describe("produce", () => {
  describe("basic mutations", () => {
    it("should mutate object properties", () => {
      const state = signal({ count: 0, name: "John" });

      state.set(
        produce((draft) => {
          draft.count = 1;
          draft.name = "Jane";
        })
      );

      expect(state()).toEqual({ count: 1, name: "Jane" });
    });

    it("should mutate nested objects", () => {
      const state = signal({
        user: { name: "John", settings: { theme: "dark" } },
      });

      state.set(
        produce((draft) => {
          draft.user.settings.theme = "light";
        })
      );

      expect(state()).toEqual({
        user: { name: "John", settings: { theme: "light" } },
      });
    });

    it("should maintain immutability", () => {
      const initial = { count: 0 };
      const state = signal(initial);

      state.set(
        produce((draft) => {
          draft.count = 1;
        })
      );

      // Original should be unchanged
      expect(initial.count).toBe(0);
      // Signal should have new value
      expect(state().count).toBe(1);
      // Should be different reference
      expect(state()).not.toBe(initial);
    });
  });

  describe("array mutations", () => {
    it("should push to array", () => {
      const todos = signal([{ id: 1, text: "Learn React", done: false }]);

      todos.set(
        produce((draft) => {
          draft.push({ id: 2, text: "Learn Immer", done: false });
        })
      );

      expect(todos()).toHaveLength(2);
      expect(todos()[1].text).toBe("Learn Immer");
    });

    it("should mutate array item", () => {
      const todos = signal([
        { id: 1, text: "Task 1", done: false },
        { id: 2, text: "Task 2", done: false },
      ]);

      todos.set(
        produce((draft) => {
          draft[0].done = true;
        })
      );

      expect(todos()[0].done).toBe(true);
      expect(todos()[1].done).toBe(false);
    });

    it("should filter array", () => {
      const numbers = signal([1, 2, 3, 4, 5]);

      numbers.set(
        produce((draft) => {
          // Remove odd numbers
          for (let i = draft.length - 1; i >= 0; i--) {
            if (draft[i] % 2 !== 0) {
              draft.splice(i, 1);
            }
          }
        })
      );

      expect(numbers()).toEqual([2, 4]);
    });

    it("should maintain immutability for arrays", () => {
      const initial = [1, 2, 3];
      const state = signal(initial);

      state.set(
        produce((draft) => {
          draft.push(4);
        })
      );

      // Original should be unchanged
      expect(initial).toEqual([1, 2, 3]);
      // Signal should have new value
      expect(state()).toEqual([1, 2, 3, 4]);
      // Should be different reference
      expect(state()).not.toBe(initial);
    });
  });

  describe("complex mutations", () => {
    it("should handle multiple nested mutations", () => {
      const app = signal({
        user: { name: "John", age: 30 },
        posts: [{ id: 1, title: "Post 1" }],
        settings: { theme: "dark", notifications: true },
      });

      app.set(
        produce((draft) => {
          draft.user.age = 31;
          draft.posts.push({ id: 2, title: "Post 2" });
          draft.settings.theme = "light";
        })
      );

      const result = app();
      expect(result.user.age).toBe(31);
      expect(result.posts).toHaveLength(2);
      expect(result.settings.theme).toBe("light");
    });

    it("should work with Map", () => {
      const state = signal(new Map([["key1", "value1"]]));

      state.set(
        produce((draft) => {
          draft.set("key2", "value2");
        })
      );

      expect(state().get("key2")).toBe("value2");
    });

    it("should work with Set", () => {
      const state = signal(new Set([1, 2, 3]));

      state.set(
        produce((draft) => {
          draft.add(4);
          draft.delete(1);
        })
      );

      expect(state().has(1)).toBe(false);
      expect(state().has(4)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty mutations", () => {
      const state = signal({ count: 0 });
      const initial = state();

      state.set(produce(() => {}));

      // Should be the same reference since nothing changed
      expect(state()).toBe(initial);
    });

    it("should handle undefined", () => {
      const state = signal<{ value?: number }>({ value: 1 });

      state.set(
        produce((draft) => {
          delete draft.value;
        })
      );

      expect(state().value).toBeUndefined();
    });

    it("should handle null", () => {
      const state = signal<{ value: string | null }>({ value: "test" });

      state.set(
        produce((draft) => {
          draft.value = null;
        })
      );

      expect(state().value).toBeNull();
    });
  });

  describe("signal integration", () => {
    it("should trigger signal listeners", () => {
      const state = signal({ count: 0 });
      let callCount = 0;

      state.on(() => {
        callCount++;
      });

      state.set(
        produce((draft) => {
          draft.count = 1;
        })
      );

      expect(callCount).toBe(1);
    });

    it("should not trigger listeners if no change", () => {
      const state = signal({ count: 0 });
      let callCount = 0;

      state.on(() => {
        callCount++;
      });

      state.set(produce(() => {}));

      expect(callCount).toBe(0);
    });

    it("should work with computed signals", () => {
      const base = signal({ count: 0 });
      const doubled = signal({ base }, ({ deps }) => deps.base.count * 2);

      base.set(
        produce((draft) => {
          draft.count = 5;
        })
      );

      expect(doubled()).toBe(10);
    });
  });
});
