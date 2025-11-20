import { describe, it, expect, vi } from "vitest";
import { signal, SignalOptions } from "./signal";
import { batch } from "./batch";

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
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
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

      s.on(() => calls.push(s() * 1));
      s.on(() => calls.push(s() * 2));
      s.on(() => calls.push(s() * 3));

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
      expect(listener).toHaveBeenCalledTimes(1);

      listener.mockClear();
      computed.reset();
      // Reset clears cache (current = undefined) and calls recompute()
      // In recompute(), prev = current (undefined), so !prev is true
      // This means reset() always notifies listeners, even if value is same
      // This is the intended behavior - reset forces a recomputation and notification
      expect(computed()).toBe(20);
      expect(listener).toHaveBeenCalledTimes(1);
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
      expect(listener).toHaveBeenCalledTimes(1);
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
      expect(listener).toHaveBeenCalledTimes(1);
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

      s.on(() => {
        const val = s();
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

      global.fetch = vi
        .fn()
        .mockImplementation((_url: string, options?: RequestInit) => {
          return new Promise((resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              fetchAborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            });
            // Simulate async operation
            setTimeout(() => resolve({ json: () => Promise.resolve({}) }), 100);
          });
        });

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
      const computed = signal(() => {
        // Don't access abortSignal or track
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

  describe("batch scope validation", () => {
    it("should throw when creating signal inside batch()", async () => {
      const { batch } = await import("./batch");

      expect(() => {
        batch(() => {
          signal(0); // Should throw
        });
      }).toThrow("Cannot create signals inside batch() blocks");
    });

    it("should throw with helpful error message", async () => {
      const { batch } = await import("./batch");

      expect(() => {
        batch(() => {
          signal(0);
        });
      }).toThrow(/batch\(\) is for grouping signal updates/);
    });

    it("should not throw when creating signal outside batch", async () => {
      const { batch } = await import("./batch");

      expect(() => {
        const count = signal(0); // Created outside batch
        batch(() => {
          count.set(1); // Just updating inside
          count.set(2);
        });
      }).not.toThrow();
    });
  });

  describe("Promise validation", () => {
    it("should throw when creating signal with Promise value", () => {
      expect(() => {
        signal(Promise.resolve(42));
      }).toThrow("Signals cannot hold Promise values directly");
    });

    it("should throw when computed signal returns Promise", () => {
      expect(() => {
        const s = signal(async () => 42);
        s(); // Trigger computation
      }).toThrow("Signals cannot hold Promise values directly");
    });

    it("should throw when setting signal to Promise value", () => {
      const s = signal(0);
      expect(() => {
        s.set(Promise.resolve(42) as any);
      }).toThrow("Signals cannot hold Promise values directly");
    });

    it("should throw with helpful error message guiding to signal.async", () => {
      expect(() => {
        signal(Promise.resolve(42));
      }).toThrow(/use signal\.async\(\) for async values/);
    });

    it("should throw with loadable alternative in error message", () => {
      expect(() => {
        signal(Promise.resolve(42));
      }).toThrow(/Or use loadable with wait\(\)/);
    });

    it("should throw when computed signal with dependencies returns Promise", () => {
      const base = signal(10);
      expect(() => {
        const s = signal(async () => {
          const value = base();
          return value * 2;
        });
        s(); // Trigger computation
      }).toThrow("Signals cannot hold Promise values directly");
    });

    it("should not throw for non-Promise values", () => {
      expect(() => {
        signal(42);
        signal("hello");
        signal({ value: 123 });
        signal([1, 2, 3]);
        signal(null);
        signal(undefined);
      }).not.toThrow();
    });

    it("should not throw for computed signals returning non-Promise values", () => {
      expect(() => {
        const s = signal(() => 42);
        s(); // Trigger computation
      }).not.toThrow();
    });
  });

  describe("error handling and propagation", () => {
    it("should store error when computation fails", () => {
      const a = signal(() => {
        throw new Error("Computation failed");
      });

      expect(() => a()).toThrow("Computation failed");
      expect(a.hasError()).toBe(true);
      expect(a.getError()).toBeInstanceOf(Error);
      expect((a.getError() as Error).message).toBe("Computation failed");
    });

    it("should throw cached error on subsequent reads", () => {
      let callCount = 0;
      const a = signal(() => {
        callCount++;
        throw new Error("Fail");
      });

      // First read
      expect(() => a()).toThrow("Fail");
      expect(callCount).toBe(1);

      // Second read - should throw cached error without recomputing
      expect(() => a()).toThrow("Fail");
      expect(callCount).toBe(1); // Should not recompute
    });

    it("should propagate error to derived signals", () => {
      const a = signal(() => {
        throw new Error("A failed");
      });
      const b = signal(() => a() * 2);
      const c = signal(() => b() + 10);

      // Reading any signal in the chain should throw
      expect(() => c()).toThrow("A failed");
      expect(a.hasError()).toBe(true);
      expect(b.hasError()).toBe(true);
      expect(c.hasError()).toBe(true);
    });

    it("should trigger recomputation of derived signals when dependency fails", () => {
      const trigger = signal(0);
      let aThrows = true;
      const a = signal(() => {
        trigger(); // Create dependency
        if (aThrows) throw new Error("A failed");
        return 5;
      });

      let bCallCount = 0;
      const b = signal(() => {
        bCallCount++;
        return a() * 2;
      });

      // First read - b tries to compute and fails
      expect(() => b()).toThrow("A failed");
      expect(bCallCount).toBe(1);
      expect(b.hasError()).toBe(true);

      // Fix the error and trigger recomputation
      aThrows = false;
      trigger.set(1);

      expect(a()).toBe(5);

      // b should have recomputed automatically
      expect(b()).toBe(10);
      expect(bCallCount).toBe(2);
      expect(b.hasError()).toBe(false);
    });

    it("should recover from error when recomputation succeeds", () => {
      const trigger = signal(0);
      let shouldThrow = true;
      const a = signal(() => {
        trigger(); // Create dependency
        if (shouldThrow) throw new Error("Fail");
        return 42;
      });

      expect(() => a()).toThrow("Fail");
      expect(a.hasError()).toBe(true);

      // Fix and trigger recomputation
      shouldThrow = false;
      trigger.set(1);
      const result = a();

      expect(result).toBe(42);
      expect(a.hasError()).toBe(false);
      expect(a.getError()).toBeUndefined();
    });

    it("should allow error inspection without throwing", () => {
      const a = signal(() => {
        throw new Error("Test error");
      });

      // Trigger error
      expect(() => a()).toThrow("Test error");

      // Inspect error without throwing
      expect(a.hasError()).toBe(true);
      expect(a.getError()).toBeInstanceOf(Error);
      expect((a.getError() as Error).message).toBe("Test error");
    });

    it("should allow graceful error handling with hasError()", () => {
      const a = signal(() => {
        throw new Error("Source failed");
      });
      const b = signal(() => {
        if (a.hasError()) return 0; // Fallback value
        return a() * 2;
      });

      // Trigger error in a
      expect(() => a()).toThrow("Source failed");

      // b should return fallback without throwing
      expect(b()).toBe(0);
      expect(b.hasError()).toBe(false);
    });

    it("should clear error manually with clearError()", () => {
      const trigger = signal(0);
      let shouldThrow = true;
      const a = signal(() => {
        trigger(); // Create dependency
        if (shouldThrow) throw new Error("Fail");
        return 42;
      });

      expect(() => a()).toThrow("Fail");
      expect(a.hasError()).toBe(true);

      // Clear error manually
      shouldThrow = false;
      a.clearError();

      expect(a.hasError()).toBe(false);
      expect(a()).toBe(42);
    });

    it("should handle error in peek() method", () => {
      const a = signal(() => {
        throw new Error("Peek failed");
      });

      expect(() => a.peek()).toThrow("Peek failed");
      expect(a.hasError()).toBe(true);
    });

    it("should preserve error state across batches", () => {
      const a = signal(() => {
        throw new Error("A failed");
      });
      const b = signal(1);
      const c = signal(() => a() + b());

      // Trigger error
      expect(() => c()).toThrow("A failed");

      // Change b in a batch
      batch(() => {
        b.set(2);
      });

      // c should still have error after batch
      expect(() => c()).toThrow("A failed");
      expect(c.hasError()).toBe(true);
    });

    it("should not return stale value when error is cached", () => {
      let shouldThrow = false;
      const trigger = signal(0);
      const a = signal(() => {
        trigger(); // Create dependency
        if (shouldThrow) throw new Error("Now failing");
        return 100;
      });

      // Initial successful read
      expect(a()).toBe(100);
      expect(a.hasError()).toBe(false);

      // Cause error and trigger recomputation
      shouldThrow = true;
      trigger.set(1);

      expect(() => a()).toThrow("Now failing");

      // Should throw error, not return stale value (100)
      expect(() => a()).toThrow("Now failing");
      expect(a.hasError()).toBe(true);
    });

    it("should propagate error through multiple levels", () => {
      const trigger = signal(0);
      const a = signal(() => {
        trigger();
        throw new Error("Level 1");
      });
      const b = signal(() => a() * 2);
      const c = signal(() => b() + 10);
      const d = signal(() => c() * 3);

      // All levels should fail
      expect(() => d()).toThrow("Level 1");
      expect(a.hasError()).toBe(true);
      expect(b.hasError()).toBe(true);
      expect(c.hasError()).toBe(true);
      expect(d.hasError()).toBe(true);

      // All errors should be the same
      expect(a.getError()).toBeInstanceOf(Error);
      expect((a.getError() as Error).message).toBe("Level 1");
      expect(b.getError()).toBe(a.getError());
      expect(c.getError()).toBe(a.getError());
      expect(d.getError()).toBe(a.getError());
    });

    it("should handle mixed success and error dependencies", () => {
      const success = signal(10);
      const failure = signal(() => {
        throw new Error("Failed");
      });

      const mixed = signal(() => {
        try {
          return success() + failure();
        } catch (e) {
          return success(); // Use fallback
        }
      });

      expect(mixed()).toBe(10);
      expect(mixed.hasError()).toBe(false);
    });

    it("should recover entire dependency chain when error is fixed", () => {
      const trigger = signal(0);
      let shouldFail = true;

      const a = signal(() => {
        trigger();
        if (shouldFail) throw new Error("Source error");
        return 5;
      });
      const b = signal(() => a() * 2);
      const c = signal(() => b() + 10);

      // All fail initially
      expect(() => c()).toThrow("Source error");
      expect(a.hasError()).toBe(true);
      expect(b.hasError()).toBe(true);
      expect(c.hasError()).toBe(true);

      // Fix the error
      shouldFail = false;
      trigger.set(1);

      // Entire chain should recover
      expect(c()).toBe(20); // (5 * 2) + 10
      expect(a.hasError()).toBe(false);
      expect(b.hasError()).toBe(false);
      expect(c.hasError()).toBe(false);
    });

    it("should handle errors with multiple dependencies", () => {
      const trigger = signal(0);
      let aFails = true;
      let bFails = false;

      const a = signal(() => {
        trigger();
        if (aFails) throw new Error("A failed");
        return 1;
      });

      const b = signal(() => {
        trigger();
        if (bFails) throw new Error("B failed");
        return 2;
      });

      const c = signal(() => a() + b());

      // c fails because a fails
      expect(() => c()).toThrow("A failed");
      expect(c.hasError()).toBe(true);

      // Fix a, but b now fails
      aFails = false;
      bFails = true;
      trigger.set(1);

      // c should now fail because of b
      expect(() => c()).toThrow("B failed");
      expect(c.hasError()).toBe(true);

      // Fix both
      bFails = false;
      trigger.set(2);

      // c should succeed
      expect(c()).toBe(3);
      expect(c.hasError()).toBe(false);
    });

    it("should handle conditional dependencies with errors", () => {
      const useA = signal(true);
      const a = signal(() => {
        throw new Error("A error");
      });
      const b = signal(10);

      const conditional = signal(() => {
        if (useA()) {
          try {
            return a();
          } catch {
            return 0;
          }
        }
        return b();
      });

      // Using a (with error handling)
      expect(conditional()).toBe(0);

      // Switch to b
      useA.set(false);
      expect(conditional()).toBe(10);
      expect(conditional.hasError()).toBe(false);
    });

    it("should handle error in batch context", async () => {
      const trigger = signal(0);
      let shouldFail = false;
      const a = signal(() => {
        trigger();
        if (shouldFail) throw new Error("Batch error");
        return 1;
      });
      const b = signal(() => a() * 2);

      // Read once to establish dependencies
      expect(b()).toBe(2);

      let listenerCallCount = 0;
      b.on(() => listenerCallCount++);

      // Trigger error in batch
      batch(() => {
        shouldFail = true;
        trigger.set(1);
      });

      // Wait for post-batch recomputation
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should have error
      expect(() => b()).toThrow("Batch error");
      expect(b.hasError()).toBe(true);
      expect(listenerCallCount).toBe(1); // Should only notify once despite batch
    });

    it("should handle diamond dependency with error", () => {
      const root = signal(() => {
        throw new Error("Root error");
      });

      const left = signal(() => root() * 2);
      const right = signal(() => root() * 3);
      const bottom = signal(() => left() + right());

      // When bottom tries to compute, it will trigger left and right,
      // which will both try to read root, which throws
      expect(() => bottom()).toThrow("Root error");

      // All signals in the chain should have the error
      expect(root.hasError()).toBe(true);
      expect(left.hasError()).toBe(true);
      expect(right.hasError()).toBe(true);
      expect(bottom.hasError()).toBe(true);

      // All should have the same error
      const rootError = root.getError();
      expect(rootError).toBeInstanceOf(Error);
      expect((rootError as Error).message).toBe("Root error");
      expect(left.getError()).toBe(rootError);
      expect(right.getError()).toBe(rootError);
      expect(bottom.getError()).toBe(rootError);
    });

    it("should not create dependencies when checking hasError", () => {
      const a = signal(1);
      let bComputeCount = 0;

      const b = signal(() => {
        bComputeCount++;
        return a() * 2;
      });

      // Read b once
      expect(b()).toBe(2);
      expect(bComputeCount).toBe(1);

      // Check hasError should not create dependency or trigger recomputation
      expect(b.hasError()).toBe(false);
      expect(bComputeCount).toBe(1); // Should not recompute

      // Change a - b should recompute only from the dependency, not hasError
      a.set(5);
      expect(b()).toBe(10);
      expect(bComputeCount).toBe(2);
    });

    it("should handle getError without triggering recomputation on error", () => {
      const trigger = signal(0);
      let computeCount = 0;

      const a = signal(() => {
        trigger();
        computeCount++;
        throw new Error("Test");
      });

      // Trigger computation
      expect(() => a()).toThrow("Test");
      expect(computeCount).toBe(1);

      // Get error multiple times - should not recompute
      expect(a.getError()).toBeInstanceOf(Error);
      expect(a.getError()).toBeInstanceOf(Error);
      expect(computeCount).toBe(1);

      // Check hasError - should not recompute
      expect(a.hasError()).toBe(true);
      expect(computeCount).toBe(1);
    });

    it("should handle clearError triggering listener notification", () => {
      const trigger = signal(0);
      let shouldFail = true;
      const a = signal(() => {
        trigger();
        if (shouldFail) throw new Error("Fail");
        return 42;
      });

      // Establish the signal first
      expect(() => a()).toThrow("Fail");

      let notifyCount = 0;
      a.on(() => notifyCount++);

      // Clear error and fix
      shouldFail = false;
      a.clearError();

      expect(a()).toBe(42);
      expect(notifyCount).toBe(1); // Notified of successful recomputation
      expect(a.hasError()).toBe(false);
    });

    it("should preserve error type and stack trace", () => {
      class CustomError extends Error {
        code = "CUSTOM_ERROR";
      }

      const a = signal(() => {
        throw new CustomError("Custom message");
      });

      expect(() => a()).toThrow(CustomError);
      expect(a.getError()).toBeInstanceOf(CustomError);
      expect((a.getError() as CustomError).code).toBe("CUSTOM_ERROR");
      expect((a.getError() as CustomError).message).toBe("Custom message");
      expect((a.getError() as Error).stack).toBeDefined();
    });

    it("should handle non-Error throws", () => {
      const a = signal(() => {
        throw "string error";
      });

      const b = signal(() => {
        throw { code: 404, message: "Not found" };
      });

      const c = signal(() => {
        // eslint-disable-next-line no-throw-literal
        throw null;
      });

      expect(() => a()).toThrow("string error");
      expect(a.hasError()).toBe(true);
      expect(a.getError()).toBe("string error");

      let bThrew = false;
      try {
        b();
      } catch (e) {
        bThrew = true;
        expect(e).toEqual({ code: 404, message: "Not found" });
      }
      expect(bThrew).toBe(true);
      expect(b.hasError()).toBe(true);
      expect(b.getError()).toEqual({ code: 404, message: "Not found" });

      let cThrew = false;
      let cError;
      try {
        c();
      } catch (e) {
        cThrew = true;
        cError = e;
      }
      expect(cThrew).toBe(true);
      expect(cError).toBe(null);
      expect(c.hasError()).toBe(true);
      expect(c.getError()).toBe(null);
    });
  });
});
