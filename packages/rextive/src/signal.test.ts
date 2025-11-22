import { describe, it, expect, vi } from "vitest";
import { signal, isSignal, FallbackError } from "./signal";

describe("signal", () => {
  describe("basic signal creation", () => {
    it("should create a signal with initial value", () => {
      const count = signal(42);
      expect(count()).toBe(42);
    });

    it("should create a signal with lazy value function", () => {
      const fn = vi.fn(() => 42);
      const count = signal(fn);
      expect(fn).not.toHaveBeenCalled();
      expect(count()).toBe(42);
      expect(fn).toHaveBeenCalledOnce();
    });

    it("should only compute once for lazy signals", () => {
      const fn = vi.fn(() => 42);
      const count = signal(fn);
      count();
      count();
      count();
      expect(fn).toHaveBeenCalledOnce();
    });

    it("should create signal with dependencies", () => {
      const a = signal(10);
      const b = signal(20);
      const sum = signal({ a, b }, ({ deps }) => deps.a + deps.b);
      expect(sum()).toBe(30);
    });

    it("should create signal with no arguments (undefined)", () => {
      const s = signal();
      expect(s()).toBe(undefined);
    });

    it("should create typed signal with no arguments", () => {
      const user = signal<{ name: string }>();
      // Initial value is undefined
      expect(user()).toBe(undefined);

      // set() only accepts T, not undefined
      user.set({ name: "Alice" });
      expect(user()).toEqual({ name: "Alice" });

      // To allow setting undefined, use signal<T | undefined>()
      const nullable = signal<{ name: string } | undefined>();
      nullable.set({ name: "Bob" });
      expect(nullable()).toEqual({ name: "Bob" });
      nullable.set(undefined);
      expect(nullable()).toBe(undefined);
    });

    it("should differentiate between optional value types", () => {
      // signal<T>() - get() returns T | undefined, set() only accepts T
      const value = signal<string>();
      expect(value()).toBe(undefined);

      value.set("hello");
      expect(value()).toBe("hello");

      // Cannot do: value.set(undefined) - Type error!
      // Must use signal<string | undefined>() if you need to set undefined

      // signal<T | undefined>() - get() returns T | undefined, set() accepts T | undefined
      const optional = signal<string | undefined>();
      optional.set("world");
      expect(optional()).toBe("world");
      optional.set(undefined);
      expect(optional()).toBe(undefined);
    });
  });

  describe("signal reactivity", () => {
    it("should recompute when dependency changes", () => {
      const count = signal(1);
      const doubled = signal({ count }, ({ deps }) => deps.count * 2);

      expect(doubled()).toBe(2);
      count.set(5);
      expect(doubled()).toBe(10);
    });

    it("should notify listeners when value changes", () => {
      const count = signal(1);
      const listener = vi.fn();

      count.on(listener);
      count.set(2);

      expect(listener).toHaveBeenCalledOnce();
    });

    it("should not notify listeners if value unchanged (using equals)", () => {
      const count = signal(1);
      const listener = vi.fn();

      count.on(listener);
      count.set(1); // Same value

      expect(listener).not.toHaveBeenCalled();
    });

    it("should notify listeners when derived value changes", () => {
      const count = signal(1);
      const doubled = signal({ count }, ({ deps }) => deps.count * 2);
      const listener = vi.fn();

      doubled.on(listener);
      count.set(2);

      expect(listener).toHaveBeenCalledOnce();
    });

    it("should not notify if derived value unchanged", () => {
      const count = signal(1);
      const isEven = signal({ count }, ({ deps }) => deps.count % 2 === 0);
      const listener = vi.fn();

      isEven.on(listener);
      expect(isEven()).toBe(false);

      // Change count but isEven result stays same
      count.set(3);
      expect(isEven()).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle multiple dependencies", () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      const sum = signal({ a, b, c }, ({ deps }) => deps.a + deps.b + deps.c);

      expect(sum()).toBe(6);

      a.set(10);
      expect(sum()).toBe(15);

      b.set(20);
      expect(sum()).toBe(33);
    });

    it("should avoid duplicate subscriptions to same dependency", () => {
      const count = signal(1);
      const compute = vi.fn(({ deps }: any) => {
        // Access count multiple times
        return deps.count + deps.count + deps.count;
      });
      const tripled = signal({ count }, compute);

      expect(tripled()).toBe(3);
      expect(compute).toHaveBeenCalledOnce();

      compute.mockClear();
      count.set(2);
      expect(tripled()).toBe(6);
      // Should only recompute once, not three times
      expect(compute).toHaveBeenCalledOnce();
    });
  });

  describe("signal.set", () => {
    it("should set new value", () => {
      const count = signal(1);
      count.set(2);
      expect(count()).toBe(2);
    });

    it("should support reducer function", () => {
      const user = signal({ name: "Alice", age: 25 });
      user.set((prev) => ({
        ...prev,
        age: 26,
      }));
      expect(user()).toEqual({ name: "Alice", age: 26 });
    });

    it("should only notify if value changed", () => {
      const count = signal(1);
      const listener = vi.fn();
      count.on(listener);

      count.set(1);
      expect(listener).not.toHaveBeenCalled();

      count.set(2);
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe("custom equals function", () => {
    it("should use custom equals for change detection", () => {
      const shallowEquals = (a: any, b: any) => {
        if (a === b) return true;
        if (typeof a !== "object" || typeof b !== "object") return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every((key) => a[key] === b[key]);
      };

      const user = signal({ name: "Alice" }, { equals: shallowEquals });
      const listener = vi.fn();
      user.on(listener);

      // Set same content but different object
      user.set({ name: "Alice" });
      expect(listener).not.toHaveBeenCalled();

      // Set different content
      user.set({ name: "Bob" });
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe("error handling", () => {
    it("should throw error from computation", () => {
      const failing = signal(() => {
        throw new Error("Computation failed");
      });

      expect(() => failing()).toThrow("Computation failed");
    });

    it("should cache error and rethrow on subsequent access", () => {
      let callCount = 0;
      const failing = signal(() => {
        callCount++;
        throw new Error("Computation failed");
      });

      expect(() => failing()).toThrow("Computation failed");
      expect(() => failing()).toThrow("Computation failed");
      // Should only compute once
      expect(callCount).toBe(1);
    });

    it("should propagate errors through derived signals", () => {
      const failing = signal<number>(() => {
        throw new Error("Source failed");
      });
      const derived = signal({ failing }, ({ deps }) => deps.failing * 2);

      expect(() => derived()).toThrow("Source failed");
    });

    it("should use fallback when computation fails", () => {
      const failing = signal(
        () => {
          throw new Error("Computation failed");
        },
        {
          fallback: () => 42,
        }
      );

      expect(failing()).toBe(42);
    });

    it("should pass error to fallback function", () => {
      let capturedError: unknown;
      const fallbackFn = vi.fn((error: unknown) => {
        capturedError = error;
        return "recovered";
      });
      const failing = signal(
        () => {
          throw new Error("Test error");
        },
        {
          fallback: fallbackFn,
        }
      );

      failing();
      expect(fallbackFn).toHaveBeenCalledOnce();
      expect(capturedError).toBeInstanceOf(Error);
      expect((capturedError as Error).message).toBe("Test error");
    });

    it("should throw FallbackError if fallback also fails", () => {
      const failing = signal(
        () => {
          throw new Error("Original error");
        },
        {
          fallback: () => {
            throw new Error("Fallback error");
          },
          name: "testSignal",
        }
      );

      expect(() => failing()).toThrow("Fallback error");
    });

    it("should allow recovery when dependency error is fixed", () => {
      const source = signal(1);
      const mayFail = signal({ source }, ({ deps }) => {
        if (deps.source < 0) throw new Error("Negative value");
        return deps.source * 2;
      });

      expect(mayFail()).toBe(2);

      source.set(-1);
      expect(() => mayFail()).toThrow("Negative value");

      source.set(5);
      expect(mayFail()).toBe(10); // Recovered
    });
  });

  describe("signal.reset", () => {
    it("should reset to initial value", () => {
      const count = signal(10);
      count.set(20);
      expect(count()).toBe(20);

      count.reset();
      expect(count()).toBe(10);
    });

    it("should reset lazy signal", () => {
      const computeInitial = vi.fn(() => 42);
      const count = signal(computeInitial);

      expect(count()).toBe(42);
      expect(computeInitial).toHaveBeenCalledOnce();

      count.set(100);
      expect(count()).toBe(100);

      computeInitial.mockClear();
      count.reset();

      // Should recompute from lazy function
      expect(count()).toBe(42);
      expect(computeInitial).toHaveBeenCalledOnce();
    });

    it("should notify listeners on reset", () => {
      const count = signal(10);
      const listener = vi.fn();
      count.on(listener);

      count.set(20);
      expect(listener).toHaveBeenCalledOnce();

      listener.mockClear();
      count.reset();
      expect(listener).toHaveBeenCalledOnce();
    });

    it("should not notify listeners if reset value equals current", () => {
      const count = signal(10);
      const listener = vi.fn();
      count.on(listener);

      // Value is already at initial value
      count.reset();
      expect(listener).not.toHaveBeenCalled();
    });

    it("should reset computed signal to recompute", () => {
      const source = signal(5);
      const doubled = signal({ source }, ({ deps }) => deps.source * 2);

      expect(doubled()).toBe(10);

      // Change source
      source.set(10);
      expect(doubled()).toBe(20);

      // Reset should recompute from current deps
      doubled.reset();
      expect(doubled()).toBe(20); // Still 10 * 2 because source is 10
    });

    it("should reset signal after error", () => {
      const shouldFail = signal(false);
      const mayFail = signal({ shouldFail }, ({ deps }) => {
        if (deps.shouldFail) throw new Error("Failed");
        return "success";
      });

      expect(mayFail()).toBe("success");

      shouldFail.set(true);
      expect(() => mayFail()).toThrow("Failed");

      // Reset should recompute - still fails because shouldFail is true
      mayFail.reset();
      expect(() => mayFail()).toThrow("Failed");

      // Fix the source and reset again
      shouldFail.set(false);
      mayFail.reset();
      expect(mayFail()).toBe("success");
    });

    it("should notify listeners when reset results in error", () => {
      const shouldFail = signal(false);
      const mayFail = signal({ shouldFail }, ({ deps }) => {
        if (deps.shouldFail) throw new Error("Failed");
        return "success";
      });

      const listener = vi.fn();
      mayFail.on(listener);

      expect(mayFail()).toBe("success");

      // Change to error state
      shouldFail.set(true);
      expect(() => mayFail()).toThrow("Failed");
      expect(listener).toHaveBeenCalledOnce();

      listener.mockClear();

      // Reset while still in error state - should notify
      mayFail.reset();
      expect(() => mayFail()).toThrow("Failed");
      expect(listener).toHaveBeenCalledOnce(); // Notified about error state
    });

    it("should trigger recompute in dependent signals when value changes", () => {
      const count = signal(5);
      const doubled = signal({ count }, ({ deps }) => deps.count * 2);
      const compute = vi.fn(({ deps }: any) => deps.doubled * 2);
      const quadrupled = signal({ doubled }, compute);

      expect(quadrupled()).toBe(20); // 5 * 2 * 2
      expect(compute).toHaveBeenCalledOnce();

      count.set(10);
      expect(quadrupled()).toBe(40); // 10 * 2 * 2

      compute.mockClear();

      // Reset count back to 5
      count.reset();

      // This should trigger recompute in doubled (10 → 5)
      // And then in quadrupled (40 → 20)
      expect(quadrupled()).toBe(20);
      expect(compute).toHaveBeenCalled();
    });

    it("should work with custom equals", () => {
      const shallowEquals = (a: any, b: any) => {
        if (a === b) return true;
        if (typeof a !== "object" || typeof b !== "object") return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every((key) => a[key] === b[key]);
      };

      const user = signal(
        { name: "Alice", age: 25 },
        { equals: shallowEquals }
      );
      const listener = vi.fn();
      user.on(listener);

      user.set({ name: "Bob", age: 30 });
      expect(listener).toHaveBeenCalledOnce();

      listener.mockClear();
      user.reset();

      // Should notify because value changed
      expect(listener).toHaveBeenCalledOnce();
      expect(user()).toEqual({ name: "Alice", age: 25 });
    });

    it("should handle multiple resets", () => {
      const count = signal(1);

      count.set(2);
      expect(count()).toBe(2);

      count.reset();
      expect(count()).toBe(1);

      count.set(5);
      expect(count()).toBe(5);

      count.reset();
      expect(count()).toBe(1);

      count.reset();
      expect(count()).toBe(1);
    });

    it("should reset signal with undefined initial value", () => {
      const value = signal<number | undefined>(undefined);

      value.set(42);
      expect(value()).toBe(42);

      value.reset();
      expect(value()).toBe(undefined);
    });

    it("should reset signal with null initial value", () => {
      const value = signal<string | null>(null);

      value.set("test");
      expect(value()).toBe("test");

      value.reset();
      expect(value()).toBe(null);
    });
  });

  describe("disposal", () => {
    it("should stop recomputing after disposal", () => {
      const count = signal(1);
      const compute = vi.fn(({ deps }: any) => deps.count * 2);
      const doubled = signal({ count }, compute);

      doubled(); // Initial compute
      expect(compute).toHaveBeenCalledOnce();

      doubled.dispose();

      count.set(2);
      // Should not recompute
      expect(compute).toHaveBeenCalledOnce();
    });

    it("should clear all listeners on disposal", () => {
      const count = signal(1);
      const listener = vi.fn();

      count.on(listener);

      count.set(2); // Trigger listener before disposal
      expect(listener).toHaveBeenCalledOnce();

      listener.mockClear();
      count.dispose();

      // After disposal, set throws so listeners can't be called anyway
      expect(() => count.set(3)).toThrow("Cannot set value on disposed signal");
      expect(listener).not.toHaveBeenCalled();
    });

    it("should throw when setting after disposal", () => {
      const count = signal(1);
      count.dispose();

      expect(() => count.set(2)).toThrow("Cannot set value on disposed signal");
    });

    it("should return last known value after disposal", () => {
      const count = signal(42);
      expect(count()).toBe(42);

      count.dispose();
      expect(count()).toBe(42); // Still readable
    });

    it("should throw last error after disposal", () => {
      const failing = signal(() => {
        throw new Error("Test error");
      });

      expect(() => failing()).toThrow("Test error");
      failing.dispose();
      expect(() => failing()).toThrow("Test error"); // Error persists
    });

    it("should unsubscribe from dependencies on disposal", () => {
      const count = signal(1);
      const doubled = signal({ count }, ({ deps }) => deps.count * 2);
      const listener = vi.fn();

      doubled.on(listener);
      doubled(); // Trigger initial computation
      doubled.dispose();

      count.set(2);
      // doubled should not be notified
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("AbortController integration", () => {
    it("should provide abortSignal in context", () => {
      let capturedSignal: AbortSignal | undefined;
      const sig = signal(({ abortSignal }) => {
        capturedSignal = abortSignal;
        return 42;
      });

      sig();
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(capturedSignal?.aborted).toBe(false);
    });

    it("should abort signal on recompute", () => {
      const count = signal(1);
      let firstSignal: AbortSignal | undefined;

      const derived = signal({ count }, ({ deps, abortSignal }) => {
        if (!firstSignal) firstSignal = abortSignal;
        return deps.count * 2;
      });

      derived();
      expect(firstSignal?.aborted).toBe(false);

      count.set(2); // Triggers recompute
      expect(firstSignal?.aborted).toBe(true);
    });

    it("should abort signal on disposal", () => {
      let capturedSignal: AbortSignal | undefined;
      const sig = signal(({ abortSignal }) => {
        capturedSignal = abortSignal;
        return 42;
      });

      sig();
      expect(capturedSignal?.aborted).toBe(false);

      sig.dispose();
      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe("isSignal type guard", () => {
    it("should return true for signals", () => {
      const count = signal(1);
      expect(isSignal(count)).toBe(true);
    });

    it("should return false for non-signals", () => {
      expect(isSignal(42)).toBe(false);
      expect(isSignal("string")).toBe(false);
      expect(isSignal({})).toBe(false);
      expect(isSignal(null)).toBe(false);
      expect(isSignal(undefined)).toBe(false);
      expect(isSignal(() => 42)).toBe(false);
    });
  });

  describe("signal name", () => {
    it("should store signal name in displayName", () => {
      const count = signal(42, { name: "counter" });
      expect(count.displayName).toBe("counter");
    });

    it("should include name in FallbackError", () => {
      const failing = signal(
        () => {
          throw new Error("Original");
        },
        {
          name: "mySignal",
          fallback: () => {
            throw new Error("Fallback");
          },
        }
      );

      try {
        failing();
      } catch (error) {
        if (error instanceof FallbackError) {
          expect(error.signalName).toBe("mySignal");
        }
      }
    });
  });

  describe("complex scenarios", () => {
    it("should handle diamond dependency graph", () => {
      const a = signal(1);
      const b = signal({ a }, ({ deps }) => deps.a * 2);
      const c = signal({ a }, ({ deps }) => deps.a * 3);
      const d = signal({ b, c }, ({ deps }) => deps.b + deps.c);

      expect(d()).toBe(5); // 2 + 3

      a.set(2);
      expect(d()).toBe(10); // 4 + 6
    });

    it("should handle conditional dependencies", () => {
      const flag = signal(true);
      const a = signal(10);
      const b = signal(20);
      const compute = vi.fn(({ deps }: any) => {
        return deps.flag ? deps.a : deps.b;
      });
      const conditional = signal({ flag, a, b }, compute);

      // Add listener to trigger subscription to dependencies
      const listener = vi.fn();
      conditional.on(listener);

      expect(conditional()).toBe(10);
      expect(compute).toHaveBeenCalledOnce();

      compute.mockClear();
      a.set(15);
      expect(conditional()).toBe(15);
      expect(compute).toHaveBeenCalledOnce();

      // Changing b will only trigger recompute if deps.b was accessed during computation
      // Since flag=true, deps.b is never accessed, so no subscription is created
      compute.mockClear();
      b.set(25);
      expect(conditional()).toBe(15);
      // Should NOT recompute because deps.b was never accessed
      expect(compute).not.toHaveBeenCalled();
    });

    it("should handle deep dependency chains", () => {
      const a = signal(1);
      const b = signal({ a }, ({ deps }) => deps.a * 2);
      const c = signal({ b }, ({ deps }) => deps.b * 2);
      const d = signal({ c }, ({ deps }) => deps.c * 2);
      const e = signal({ d }, ({ deps }) => deps.d * 2);

      expect(e()).toBe(16); // 1 * 2 * 2 * 2 * 2

      a.set(2);
      expect(e()).toBe(32);
    });

    it("should handle signal reading itself (memoization)", () => {
      let computeCount = 0;
      const fib = signal<number>(5);

      // Note: This doesn't create infinite loop because we're
      // not creating a reactive dependency on itself
      const result = signal(() => {
        computeCount++;
        const n = fib();
        if (n <= 1) return n;
        // This is just reading, not creating reactive dependency
        return n * 2;
      });

      expect(result()).toBe(10);
      expect(computeCount).toBe(1);

      // Reading again should not recompute
      expect(result()).toBe(10);
      expect(computeCount).toBe(1);
    });
  });

  describe("listener cleanup", () => {
    it("should support unsubscribe from listener", () => {
      const count = signal(1);
      const listener = vi.fn();

      const unsubscribe = count.on(listener);
      count.set(2);
      expect(listener).toHaveBeenCalledOnce();

      listener.mockClear();
      unsubscribe();
      count.set(3);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle multiple listeners", () => {
      const count = signal(1);
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      count.on(listener1);
      count.on(listener2);
      const unsub3 = count.on(listener3);

      count.set(2);
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
      expect(listener3).toHaveBeenCalledOnce();

      listener1.mockClear();
      listener2.mockClear();
      listener3.mockClear();

      unsub3();
      count.set(3);
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
      expect(listener3).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle null and undefined values", () => {
      const nullSig = signal(null);
      const undefinedSig = signal(undefined);

      expect(nullSig()).toBe(null);
      expect(undefinedSig()).toBe(undefined);
    });

    it("should handle setting same value multiple times", () => {
      const count = signal(1);
      const listener = vi.fn();
      count.on(listener);

      count.set(1);
      count.set(1);
      count.set(1);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle rapid updates", () => {
      const count = signal(0);
      const listener = vi.fn();
      count.on(listener);

      for (let i = 1; i <= 100; i++) {
        count.set(i);
      }

      expect(count()).toBe(100);
      expect(listener).toHaveBeenCalledTimes(100);
    });

    it("should handle empty dependencies object", () => {
      const sig = signal({}, () => 42);
      expect(sig()).toBe(42);
    });

    it("should not recompute if no dependencies accessed", () => {
      const a = signal(1);
      const compute = vi.fn(() => 42);
      const independent = signal({ a }, compute);

      independent();
      expect(compute).toHaveBeenCalledOnce();

      compute.mockClear();
      a.set(2);
      // Should not recompute because deps.a was never accessed
      expect(compute).not.toHaveBeenCalled();
    });
  });

  describe("lazy option", () => {
    it("should be lazy by default - not compute until accessed", () => {
      const compute = vi.fn(() => 42);
      const s = signal(compute);
      expect(compute).not.toHaveBeenCalled();
      s();
      expect(compute).toHaveBeenCalledOnce();
    });

    it("should compute immediately with lazy: false", () => {
      const compute = vi.fn(() => 42);
      const s = signal(compute, { lazy: false });
      expect(compute).toHaveBeenCalledOnce();
      // Second access uses cached value
      s();
      expect(compute).toHaveBeenCalledOnce();
    });

    it("should execute derived signal immediately with lazy: false", () => {
      const a = signal(10);
      const compute = vi.fn(({ deps }: any) => deps.a * 2);
      const doubled = signal({ a }, compute, { lazy: false });
      expect(compute).toHaveBeenCalledOnce();
      expect(doubled()).toBe(20);
    });

    it("should re-execute immediately when dependency changes with lazy: false", () => {
      const a = signal(10);
      const compute = vi.fn(({ deps }: any) => deps.a * 2);
      const doubled = signal({ a }, compute, { lazy: false });
      expect(compute).toHaveBeenCalledOnce();

      a.set(20);
      expect(compute).toHaveBeenCalledTimes(2);
      expect(doubled()).toBe(40);
    });

    it("should work for side effects with lazy: false", () => {
      const count = signal(0);
      const sideEffectLog: number[] = [];

      signal(
        { count },
        ({ deps }) => {
          sideEffectLog.push(deps.count);
          return deps.count;
        },
        { lazy: false }
      );

      expect(sideEffectLog).toEqual([0]);

      count.set(1);
      expect(sideEffectLog).toEqual([0, 1]);

      count.set(2);
      expect(sideEffectLog).toEqual([0, 1, 2]);
    });

    it("should execute async signal immediately with lazy: false", () => {
      const compute = vi.fn(async () => "result");
      const s = signal(compute, { lazy: false });
      expect(compute).toHaveBeenCalledOnce();
      // Returns promise on access
      expect(s()).toBeInstanceOf(Promise);
    });

    it("should respect lazy: true explicitly", () => {
      const compute = vi.fn(() => 42);
      const s = signal(compute, { lazy: true });
      expect(compute).not.toHaveBeenCalled();
      s();
      expect(compute).toHaveBeenCalledOnce();
    });

    it("should work with DOM side effects (README example)", () => {
      // Simulate DOM
      const mockElement = { textContent: "" };

      const count = signal(0);

      // Effect signal with lazy: false
      signal(
        { count },
        ({ deps }) => {
          mockElement.textContent = `Count: ${deps.count}`;
        },
        { lazy: false }
      );

      expect(mockElement.textContent).toBe("Count: 0");

      count.set(5);
      expect(mockElement.textContent).toBe("Count: 5");

      count.set(10);
      expect(mockElement.textContent).toBe("Count: 10");
    });

    it("should work with multiple dependencies and lazy: false", () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      const compute = vi.fn(({ deps }: any) => deps.a + deps.b + deps.c);
      const sum = signal({ a, b, c }, compute, { lazy: false });

      expect(compute).toHaveBeenCalledOnce();
      expect(sum()).toBe(6);

      a.set(10);
      expect(compute).toHaveBeenCalledTimes(2);
      expect(sum()).toBe(15);
    });

    it("should not execute after disposal even with lazy: false", () => {
      const count = signal(0);
      const compute = vi.fn(({ deps }: any) => deps.count * 2);
      const doubled = signal({ count }, compute, { lazy: false });

      expect(compute).toHaveBeenCalledOnce();

      doubled.dispose();

      count.set(10);
      // Should not recompute after disposal
      expect(compute).toHaveBeenCalledOnce();
    });
  });

  describe("toJSON", () => {
    it("should serialize signal value with JSON.stringify", () => {
      const count = signal(42);
      expect(JSON.stringify(count)).toBe("42");
    });

    it("should serialize object signal", () => {
      const user = signal({ name: "Alice", age: 30 });
      expect(JSON.stringify(user)).toBe('{"name":"Alice","age":30}');
    });

    it("should serialize signal in object", () => {
      const count = signal(42);
      const name = signal("Bob");
      const obj = { count, name, other: "value" };
      expect(JSON.stringify(obj)).toBe(
        '{"count":42,"name":"Bob","other":"value"}'
      );
    });

    it("should serialize array of signals", () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      expect(JSON.stringify([a, b, c])).toBe("[1,2,3]");
    });

    it("should serialize derived signal", () => {
      const a = signal(10);
      const b = signal(20);
      const sum = signal({ a, b }, ({ deps }) => deps.a + deps.b);
      expect(JSON.stringify(sum)).toBe("30");
    });

    it("should serialize async signal", async () => {
      const data = signal(async () => "resolved");
      // Async signals return a Promise until resolved
      const promise = data();
      expect(promise).toBeInstanceOf(Promise);
      // Promise serializes to empty object
      expect(JSON.stringify(data)).toBe("{}");

      // After awaiting, signal still returns Promise
      await promise;
      expect(JSON.stringify(data)).toBe("{}");
    });

    it("should serialize undefined signal", () => {
      const empty = signal();
      expect(JSON.stringify(empty)).toBe(undefined);
      expect(JSON.stringify({ value: empty })).toBe("{}");
    });

    it("should serialize null signal", () => {
      const nullable = signal<string | null>(null);
      expect(JSON.stringify(nullable)).toBe("null");
    });

    it("should serialize updated signal value", () => {
      const count = signal(1);
      expect(JSON.stringify(count)).toBe("1");
      count.set(2);
      expect(JSON.stringify(count)).toBe("2");
      count.set(3);
      expect(JSON.stringify(count)).toBe("3");
    });

    it("should call toJSON explicitly", () => {
      const count = signal(42);
      expect(count.toJSON()).toBe(42);
    });

    it("should serialize nested signals", () => {
      const inner = signal(100);
      const outer = signal({ value: inner, text: "test" });
      // Nested signals are also serialized via their toJSON method
      const result = JSON.parse(JSON.stringify(outer));
      expect(result).toEqual({
        value: 100, // inner signal's toJSON is called automatically
        text: "test",
      });
    });
  });

  describe("hydrate", () => {
    it("should hydrate mutable signal and return success", () => {
      const count = signal(0);
      const status = count.hydrate(42);

      expect(status).toBe("success");
      expect(count()).toBe(42);
    });

    it("should hydrate computed signal before computation and return success", () => {
      const a = signal(10);
      const computed = signal({ a }, ({ deps }) => deps.a * 2);

      // Hydrate before accessing (before computation)
      const status = computed.hydrate(100);

      expect(status).toBe("success");
      expect(computed()).toBe(100);
    });

    it("should skip hydration if computed signal already computed", () => {
      const a = signal(10);
      const computed = signal({ a }, ({ deps }) => deps.a * 2);

      // Access first (trigger computation)
      expect(computed()).toBe(20);

      // Try to hydrate after computation
      const status = computed.hydrate(100);

      expect(status).toBe("skipped");
      expect(computed()).toBe(20); // Still the computed value
    });

    it("should skip hydration on mutable signals after modification", () => {
      const count = signal(0);

      // First hydration succeeds
      expect(count.hydrate(10)).toBe("success");
      expect(count()).toBe(10);

      // User modifies the signal
      count.set(15);
      expect(count()).toBe(15);

      // Second hydration is skipped (signal is dirty)
      expect(count.hydrate(20)).toBe("skipped");
      expect(count()).toBe(15); // Value unchanged
    });

    it("should allow multiple hydrations before modification", () => {
      const count = signal(0);

      // Multiple hydrations before any set() call
      expect(count.hydrate(10)).toBe("success");
      expect(count()).toBe(10);

      expect(count.hydrate(20)).toBe("success");
      expect(count()).toBe(20);
    });

    it("should notify listeners when mutable signal is hydrated", () => {
      const count = signal(0);
      const listener = vi.fn();

      count.on(listener);
      count.hydrate(42);

      expect(listener).toHaveBeenCalledOnce();
    });

    it("should not notify listeners when hydration is skipped", () => {
      const count = signal(0);
      const listener = vi.fn();

      count.set(10); // Mark as modified
      count.on(listener);
      count.hydrate(42); // Will be skipped

      expect(listener).not.toHaveBeenCalled();
      expect(count()).toBe(10);
    });

    it("should not notify if hydrated value equals current value", () => {
      const count = signal(42);
      const listener = vi.fn();

      count.on(listener);
      count.hydrate(42); // Same value

      expect(listener).not.toHaveBeenCalled();
    });

    it("should allow hydration after reset", () => {
      const count = signal(0);

      // Modify signal
      count.set(10);
      expect(count()).toBe(10);

      // Hydration is skipped
      expect(count.hydrate(20)).toBe("skipped");
      expect(count()).toBe(10);

      // Reset clears modified flag
      count.reset();
      expect(count()).toBe(0);

      // Now hydration works again
      expect(count.hydrate(30)).toBe("success");
      expect(count()).toBe(30);
    });
  });
});
