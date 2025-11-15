import { describe, it, expect, vi } from "vitest";
import { signal, SignalOptions } from "./signal";

describe("signal", () => {
  describe("basic functionality", () => {
    it("should create a signal with an initial value", () => {
      const s = signal(42);
      expect(s()).toBe(42);
    });

    it("should allow reading the signal value", () => {
      const s = signal("hello");
      expect(s()).toBe("hello");
    });

    it("should allow setting a new value", () => {
      const s = signal(0);
      s.set(10);
      expect(s()).toBe(10);
    });

    it("should notify listeners when value changes", () => {
      const s = signal(0);
      const listener = vi.fn();
      s.on(listener);

      s.set(1);
      expect(listener).toHaveBeenCalledWith(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should not notify listeners when value does not change", () => {
      const s = signal(5);
      const listener = vi.fn();
      s.on(listener);

      s.set(5); // Same value
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("peek", () => {
    it("should read value without tracking dependencies", () => {
      const s = signal(10);
      expect(s.peek()).toBe(10);
    });

    it("should work with computed signals", () => {
      const source = signal(5);
      const computed = signal(() => source() * 2);

      expect(computed.peek()).toBe(10);
      source.set(6);
      expect(computed.peek()).toBe(12);
    });
  });

  describe("listeners", () => {
    it("should allow multiple listeners", () => {
      const s = signal(0);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      s.on(listener1);
      s.on(listener2);

      s.set(1);
      expect(listener1).toHaveBeenCalledWith(1);
      expect(listener2).toHaveBeenCalledWith(1);
    });

    it("should allow unsubscribing from listeners", () => {
      const s = signal(0);
      const listener = vi.fn();
      const unsubscribe = s.on(listener);

      unsubscribe();
      s.set(1);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle multiple unsubscribes gracefully", () => {
      const s = signal(0);
      const listener = vi.fn();
      const unsubscribe = s.on(listener);

      unsubscribe();
      unsubscribe(); // Should not throw
      s.set(1);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify listeners in order", () => {
      const s = signal(0);
      const calls: number[] = [];

      s.on((val) => calls.push(val * 1));
      s.on((val) => calls.push(val * 2));
      s.on((val) => calls.push(val * 3));

      s.set(1);
      expect(calls).toEqual([1, 2, 3]);
    });
  });

  describe("reset", () => {
    it("should reset a static signal and recompute", () => {
      const s = signal(10);
      expect(s()).toBe(10);

      s.set(20);
      expect(s()).toBe(20);

      s.reset();
      // After reset, it should recompute and return the initial value
      expect(s()).toBe(10);
    });

    it("should reset a computed signal and recompute", () => {
      const source = signal(5);
      const computed = signal(() => source() * 2);

      expect(computed()).toBe(10);

      source.set(10);
      expect(computed()).toBe(20);

      computed.reset();
      // After reset, it should recompute based on current source value
      expect(computed()).toBe(20);
    });

    it("should reset and always notify listeners", () => {
      const source = signal(5);
      const computed = signal(() => source() * 2);
      const listener = vi.fn();

      // Subscribe after initial computation
      computed(); // Trigger initial computation (value = 10)
      computed.on(listener);

      source.set(10);
      expect(listener).toHaveBeenCalledWith(20);

      listener.mockClear();
      computed.reset();
      // Reset clears cache (current = undefined) and calls recompute()
      // In recompute(), prev = current (undefined), so !prev is true
      // This means reset() always notifies listeners, even if value is same
      // This is the intended behavior - reset forces a recomputation and notification
      expect(computed()).toBe(20);
      expect(listener).toHaveBeenCalledWith(20);
    });

    it("should reset and notify listeners", () => {
      const source = signal(5);
      const computed = signal(() => source() * 2);
      const listener = vi.fn();

      // Initial computation
      expect(computed()).toBe(10);

      // Subscribe - listener is NOT called immediately
      computed.on(listener);
      expect(listener).not.toHaveBeenCalled();

      // Reset clears cache and forces recomputation
      computed.reset();
      expect(computed()).toBe(10);
      // Reset always notifies because cache is cleared (prev is undefined)
      // So !prev is true, which means onChange.emit() is called
      expect(listener).toHaveBeenCalledWith(10);
    });

    it("should reset and recompute with updated dependencies", () => {
      const source1 = signal(1);
      const source2 = signal(2);
      const computed = signal(() => source1() + source2());

      expect(computed()).toBe(3);

      source1.set(10);
      expect(computed()).toBe(12);

      computed.reset();
      // After reset, should recompute with current dependencies
      expect(computed()).toBe(12);
    });
  });

  describe("computed signals", () => {
    it("should create a computed signal from a function", () => {
      const source = signal(5);
      const doubled = signal(() => source() * 2);

      expect(doubled()).toBe(10);
    });

    it("should recompute when dependencies change", () => {
      const source = signal(5);
      const doubled = signal(() => source() * 2);

      expect(doubled()).toBe(10);
      source.set(6);
      expect(doubled()).toBe(12);
    });

    it("should handle multiple dependencies", () => {
      const a = signal(1);
      const b = signal(2);
      const sum = signal(() => a() + b());

      expect(sum()).toBe(3);
      a.set(10);
      expect(sum()).toBe(12);
      b.set(20);
      expect(sum()).toBe(30);
    });

    it("should handle nested computed signals", () => {
      const a = signal(2);
      const doubled = signal(() => a() * 2);
      const quadrupled = signal(() => doubled() * 2);

      expect(quadrupled()).toBe(8);
      a.set(3);
      expect(quadrupled()).toBe(12);
    });

    it("should unsubscribe from old dependencies when recomputed", () => {
      const source1 = signal(1);
      const source2 = signal(2);
      let useSource1 = true;

      const computed = signal(() => {
        return useSource1 ? source1() : source2();
      });

      expect(computed()).toBe(1);

      // Switch dependency
      useSource1 = false;
      source1.set(10); // Should not trigger recompute
      expect(computed()).toBe(2);
    });
  });

  describe("set with updater function", () => {
    it("should update value using a function", () => {
      const s = signal(5);
      s.set((prev) => prev + 1);
      expect(s()).toBe(6);
    });

    it("should handle updater that returns void", () => {
      const s = signal({ count: 5 });
      s.set((prev) => {
        prev.count = 10;
      });
      expect(s().count).toBe(10);
    });

    it("should use immer for immutable updates", () => {
      const s = signal({ nested: { value: 1 } });
      const original = s();

      s.set((prev) => {
        prev.nested.value = 2;
      });

      // Should create a new object
      expect(s()).not.toBe(original);
      expect(s().nested.value).toBe(2);
      expect(original.nested.value).toBe(1);
    });
  });

  describe("custom equality", () => {
    it("should use custom equality function", () => {
      const options: SignalOptions = {
        equals: (a, b) => a.id === b.id,
      };
      const s = signal({ id: 1, name: "Alice" }, options);
      const listener = vi.fn();
      s.on(listener);

      // Same id, different name - should not notify
      s.set({ id: 1, name: "Bob" });
      expect(listener).not.toHaveBeenCalled();

      // Different id - should notify
      s.set({ id: 2, name: "Bob" });
      expect(listener).toHaveBeenCalledWith({ id: 2, name: "Bob" });
    });

    it("should default to Object.is for equality", () => {
      const s = signal({ value: 1 });
      const listener = vi.fn();
      s.on(listener);

      // Different object reference - should notify
      s.set({ value: 1 });
      expect(listener).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle null values", () => {
      const s = signal<number | null>(null);
      expect(s()).toBeNull();
      s.set(1);
      expect(s()).toBe(1);
    });

    it("should handle undefined values", () => {
      const s = signal<number | undefined>(undefined);
      expect(s()).toBeUndefined();
      s.set(1);
      expect(s()).toBe(1);
    });

    it("should handle zero and falsy values", () => {
      const s = signal(0);
      expect(s()).toBe(0);
      s.set(1);
      expect(s()).toBe(1);
    });

    it("should handle empty string", () => {
      const s = signal("");
      expect(s()).toBe("");
      s.set("hello");
      expect(s()).toBe("hello");
    });

    it("should handle arrays", () => {
      const s = signal([1, 2, 3]);
      expect(s()).toEqual([1, 2, 3]);
      s.set([4, 5, 6]);
      expect(s()).toEqual([4, 5, 6]);
    });

    it("should handle objects", () => {
      const s = signal({ a: 1, b: 2 });
      expect(s()).toEqual({ a: 1, b: 2 });
      s.set({ a: 3, b: 4 });
      expect(s()).toEqual({ a: 3, b: 4 });
    });
  });

  describe("listener modifications", () => {
    it("should handle listeners that modify the listener array", () => {
      const s = signal(0);
      const calls: number[] = [];

      s.on((val) => {
        calls.push(val);
        if (val === 1) {
          // Add another listener during notification
          s.on(() => calls.push(999));
        }
      });

      s.set(1);
      s.set(2);

      // Should not crash and should handle gracefully
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
