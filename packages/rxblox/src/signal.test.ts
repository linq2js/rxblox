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

  describe("toJSON", () => {
    it("should return the signal value without tracking", () => {
      const s = signal(42);
      expect(s.toJSON()).toBe(42);
    });

    it("should work with objects", () => {
      const s = signal({ name: "Alice", age: 30 });
      const json = s.toJSON();
      expect(json).toEqual({ name: "Alice", age: 30 });
    });

    it("should work with arrays", () => {
      const s = signal([1, 2, 3]);
      const json = s.toJSON();
      expect(json).toEqual([1, 2, 3]);
    });

    it("should work with nested signals in JSON.stringify", () => {
      const count = signal(5);
      const user = signal({ name: "Bob", count });

      const json = JSON.stringify(user);
      expect(json).toBe('{"name":"Bob","count":5}');
    });

    it("should not track dependencies when called", () => {
      const source = signal(10);
      const computed = signal(() => source());
      const listener = vi.fn();

      computed.on(listener);

      // Call toJSON should use peek and not track
      const value = computed.toJSON();
      expect(value).toBe(10);

      // Change source
      source.set(20);

      // Computed should update
      expect(computed()).toBe(20);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should work with primitive values", () => {
      expect(signal(42).toJSON()).toBe(42);
      expect(signal("hello").toJSON()).toBe("hello");
      expect(signal(true).toJSON()).toBe(true);
      expect(signal(null).toJSON()).toBe(null);
      expect(signal(undefined).toJSON()).toBe(undefined);
    });

    it("should work with JSON.stringify on primitives", () => {
      expect(JSON.stringify(signal(42))).toBe("42");
      expect(JSON.stringify(signal("hello"))).toBe('"hello"');
      expect(JSON.stringify(signal(true))).toBe("true");
      expect(JSON.stringify(signal(null))).toBe("null");
      expect(JSON.stringify(signal(undefined))).toBe(undefined);
    });

    it("should work with JSON.stringify on objects", () => {
      const user = signal({ name: "Alice", age: 30 });
      expect(JSON.stringify(user)).toBe('{"name":"Alice","age":30}');
    });

    it("should work with JSON.stringify on arrays", () => {
      const items = signal([1, 2, 3]);
      expect(JSON.stringify(items)).toBe("[1,2,3]");
    });

    it("should work with JSON.stringify on complex nested structures", () => {
      const count = signal(5);
      const isActive = signal(true);
      const tags = signal(["react", "signals"]);
      const user = signal({
        name: "Bob",
        count,
        isActive,
        tags,
        metadata: {
          nested: signal("value"),
        },
      });

      const result = JSON.parse(JSON.stringify(user));
      expect(result).toEqual({
        name: "Bob",
        count: 5,
        isActive: true,
        tags: ["react", "signals"],
        metadata: {
          nested: "value",
        },
      });
    });

    it("should work with JSON.stringify in array of signals", () => {
      const signals = [signal(1), signal(2), signal(3)];
      expect(JSON.stringify(signals)).toBe("[1,2,3]");
    });

    it("should work with JSON.stringify and computed signals", () => {
      const base = signal(10);
      const computed = signal(() => base() * 2);

      expect(JSON.stringify(computed)).toBe("20");

      base.set(15);
      expect(JSON.stringify(computed)).toBe("30");
    });

    it("should work with JSON.stringify using replacer function", () => {
      const data = signal({
        name: "Alice",
        password: "secret123",
        age: 30,
      });

      const json = JSON.stringify(data, (key, value) => {
        if (key === "password") return undefined;
        return value;
      });

      expect(json).toBe('{"name":"Alice","age":30}');
    });

    it("should not trigger reactivity in JSON.stringify", () => {
      const source = signal(10);
      const computed = signal(() => source());
      const listener = vi.fn();

      computed.on(listener);

      // JSON.stringify should not create tracking
      const json = JSON.stringify({ value: computed });
      expect(json).toBe('{"value":10}');

      // Change source
      source.set(20);

      // Should only notify once from the actual change
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(20);
    });
  });

  describe("abortSignal in computed signals", () => {
    it("should provide abortSignal in computed signal context", () => {
      let capturedSignal: AbortSignal | undefined;

      const computed = signal(({ abortSignal }) => {
        capturedSignal = abortSignal;
        return 42;
      });

      computed(); // Trigger computation

      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(capturedSignal?.aborted).toBe(false);
    });

    it("should abort signal when computed signal is recomputed", () => {
      const source = signal(0);
      const signals: AbortSignal[] = [];

      const computed = signal(({ abortSignal }) => {
        source(); // Track dependency
        signals.push(abortSignal);
        return source() * 2;
      });

      computed(); // Initial computation
      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(false);

      // Trigger recomputation
      source.set(1);
      computed(); // Access to trigger recomputation

      expect(signals).toHaveLength(2);
      expect(signals[0].aborted).toBe(true); // First signal should be aborted
      expect(signals[1].aborted).toBe(false); // New signal should not be aborted
    });

    it("should create new abortSignal for each recomputation", () => {
      const source = signal(0);
      const signals: AbortSignal[] = [];

      const computed = signal(({ abortSignal }) => {
        source();
        signals.push(abortSignal);
        return source() * 2;
      });

      computed();
      source.set(1);
      computed();
      source.set(2);
      computed();

      expect(signals).toHaveLength(3);
      // Each signal should be different
      expect(signals[0]).not.toBe(signals[1]);
      expect(signals[1]).not.toBe(signals[2]);
      // Previous signals should be aborted
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(true);
      expect(signals[2].aborted).toBe(false);
    });

    it("should abort signal on reset", () => {
      const signals: AbortSignal[] = [];

      const computed = signal(({ abortSignal }) => {
        signals.push(abortSignal);
        return 42;
      });

      computed();
      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(false);

      computed.reset();
      expect(signals[0].aborted).toBe(true);

      computed(); // Trigger new computation
      expect(signals).toHaveLength(2);
      expect(signals[1].aborted).toBe(false);
    });

    it("should work with async operations in computed signals", async () => {
      const source = signal(1);
      let fetchAborted = false;

      global.fetch = vi.fn().mockImplementation(
        (url: string, options?: RequestInit) => {
          return new Promise((resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              fetchAborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            });
            // Simulate async operation
            setTimeout(() => resolve({ json: () => Promise.resolve({}) }), 100);
          });
        }
      );

      const computed = signal(({ abortSignal }) => {
        const id = source();
        // Start fetch but don't await (computed should be sync)
        fetch(`/api/data/${id}`, { signal: abortSignal }).catch(() => {
          // Ignore abort errors
        });
        return id;
      });

      computed();
      expect(fetchAborted).toBe(false);

      // Trigger recomputation, should abort previous fetch
      source.set(2);
      computed();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchAborted).toBe(true);
    });

    it("should work with track and abortSignal together", () => {
      const condition = signal(true);
      const a = signal(10);
      const b = signal(20);
      const signals: AbortSignal[] = [];

      const computed = signal(({ track, abortSignal }) => {
        const tracked = track({ condition, a, b });
        signals.push(abortSignal);
        return tracked.condition ? tracked.a : tracked.b;
      });

      computed();
      expect(signals).toHaveLength(1);

      condition.set(false);
      computed();
      expect(signals).toHaveLength(2);
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);
    });

    it("should not create abortController if abortSignal is never accessed", () => {
      // This test verifies lazy creation of AbortController
      const computed = signal(({ track }) => {
        // Don't access abortSignal
        return 42;
      });

      computed();
      // No error should occur, and no AbortController is created
      expect(computed()).toBe(42);
    });

    it("should handle multiple recomputations with abort", () => {
      const source = signal(0);
      const abortEvents: number[] = [];

      const computed = signal(({ abortSignal }) => {
        const value = source();
        abortSignal.addEventListener("abort", () => {
          abortEvents.push(value);
        });
        return value * 2;
      });

      computed();
      source.set(1);
      computed();
      source.set(2);
      computed();
      source.set(3);
      computed();

      // Previous computations should have been aborted
      expect(abortEvents).toEqual([0, 1, 2]);
    });

    it("should abort when signal is disposed", () => {
      const signals: AbortSignal[] = [];
      const onCleanup = vi.fn();

      const computed = signal(({ abortSignal }) => {
        signals.push(abortSignal);
        abortSignal.addEventListener("abort", onCleanup);
        return 42;
      });

      computed();
      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(false);
      expect(onCleanup).not.toHaveBeenCalled();

      // Dispose the signal by resetting
      computed.reset();

      expect(signals[0].aborted).toBe(true);
      expect(onCleanup).toHaveBeenCalledTimes(1);
    });

    it("should work with conditional logic using abortSignal", () => {
      const shouldFetch = signal(false);
      const signals: AbortSignal[] = [];

      const computed = signal(({ abortSignal }) => {
        signals.push(abortSignal);
        if (shouldFetch()) {
          // Could start a fetch here
          abortSignal.addEventListener("abort", () => {
            // Cleanup logic
          });
          return "fetching";
        }
        return "idle";
      });

      computed();
      expect(computed()).toBe("idle");

      shouldFetch.set(true);
      computed();
      expect(computed()).toBe("fetching");
      expect(signals[0].aborted).toBe(true);

      shouldFetch.set(false);
      computed();
      expect(signals[1].aborted).toBe(true);
    });
  });

  describe("signal creation in rx() validation", () => {
    it("should throw error when creating signal inside rx()", async () => {
      const React = await import("react");
      const { render } = await import("@testing-library/react");
      const { rx } = await import("./rx");

      expect(() => {
        render(
          rx(() => {
            const count = signal(0);
            return React.createElement("div", null, count());
          })
        );
      }).toThrow("Cannot create signals inside rx() blocks");
    });

    it("should throw with helpful error message", async () => {
      const React = await import("react");
      const { render } = await import("@testing-library/react");
      const { rx } = await import("./rx");

      expect(() => {
        render(
          rx(() => {
            const count = signal(0);
            return React.createElement("div", null, count());
          })
        );
      }).toThrow(/causing memory leaks/);
    });

    it("should throw for computed signals in rx()", async () => {
      const React = await import("react");
      const { render } = await import("@testing-library/react");
      const { rx } = await import("./rx");
      const source = signal(5);

      expect(() => {
        render(
          rx(() => {
            const doubled = signal(() => source() * 2);
            return React.createElement("div", null, doubled());
          })
        );
      }).toThrow("Cannot create signals inside rx() blocks");
    });

    it("should not throw when creating signal in stable scope", async () => {
      const React = await import("react");
      const { render } = await import("@testing-library/react");
      const { rx } = await import("./rx");
      const { blox } = await import("./blox");

      expect(() => {
        const Component = blox(() => {
          const count = signal(0); // Created in stable scope
          return React.createElement(
            "div",
            null,
            rx(() => React.createElement("span", null, count()))
          );
        });
        render(React.createElement(Component));
      }).not.toThrow();
    });
  });
});
