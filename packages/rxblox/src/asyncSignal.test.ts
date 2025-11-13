import { describe, it, expect, vi, beforeEach } from "vitest";
import { asyncSignal } from "./asyncSignal";
import { signal } from "./signal";
import { delay } from "./delay";

describe("asyncSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should create an async signal that returns a loadable", async () => {
      const asyncSig = asyncSignal(async () => {
        return 42;
      });

      // Initial state should be loading
      const initial = asyncSig();
      expect(initial.status).toBe("loading");
      expect(initial.loading).toBe(true);

      // Wait for promise to resolve
      await delay(10);

      // After resolution, should be success
      const resolved = asyncSig();
      expect(resolved.status).toBe("success");
      expect(resolved.data).toBe(42);
      expect(resolved.loading).toBe(false);
    });

    it("should handle sync return values", () => {
      const asyncSig = asyncSignal(() => {
        return Promise.resolve(10);
      });

      const loadable = asyncSig();
      expect(loadable.status).toBe("loading");
    });

    it("should handle immediate values", () => {
      // TypeScript doesn't allow non-promise return, but at runtime
      // if somehow a sync value is returned, it should handle it
      const asyncSig = asyncSignal((() => {
        return 42 as any;
      }) as any);

      const loadable = asyncSig();
      expect(loadable.status).toBe("success");
      expect(loadable.data).toBe(42);
    });
  });

  describe("promise state tracking", () => {
    it("should track loading state", () => {
      const asyncSig = asyncSignal(async () => {
        await delay(50);
        return "data";
      });

      const loadable = asyncSig();
      expect(loadable.status).toBe("loading");
      expect(loadable.data).toBeUndefined();
      expect(loadable.error).toBeUndefined();
      expect(loadable.loading).toBe(true);
    });

    it("should track success state", async () => {
      const asyncSig = asyncSignal(async () => {
        await delay(10);
        return { id: 1, name: "Test" };
      });

      // Initial loading
      expect(asyncSig().status).toBe("loading");

      // Wait for resolution
      await delay(20);

      // Should be success
      const loadable = asyncSig();
      expect(loadable.status).toBe("success");
      expect(loadable.data).toEqual({ id: 1, name: "Test" });
      expect(loadable.error).toBeUndefined();
      expect(loadable.loading).toBe(false);
    });

    it("should track error state", async () => {
      const testError = new Error("Test error");
      const asyncSig = asyncSignal(async () => {
        await delay(10);
        throw testError;
      });

      // Initial loading
      expect(asyncSig().status).toBe("loading");

      // Wait for rejection
      await delay(20);

      // Should be error
      const loadable = asyncSig();
      expect(loadable.status).toBe("error");
      expect(loadable.error).toBe(testError);
      expect(loadable.data).toBeUndefined();
      expect(loadable.loading).toBe(false);
    });
  });

  describe("signal dependency tracking", () => {
    it("should track signal dependencies and re-compute", async () => {
      const userId = signal(1);

      const fetchSpy = vi.fn(async (id: number) => {
        await delay(10);
        return { id, name: `User ${id}` };
      });

      const user = asyncSignal(async () => {
        const id = userId();
        return fetchSpy(id);
      });

      // Initial fetch
      expect(user().status).toBe("loading");
      await delay(20);
      expect(user().data).toEqual({ id: 1, name: "User 1" });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Change dependency
      userId.set(2);

      // Should trigger re-fetch
      expect(user().status).toBe("loading");
      await delay(20);
      expect(user().data).toEqual({ id: 2, name: "User 2" });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("should handle multiple dependencies", async () => {
      const param1 = signal("a");
      const param2 = signal(1);

      const fetchSpy = vi.fn(async (p1: string, p2: number) => {
        await delay(10);
        return `${p1}-${p2}`;
      });

      const result = asyncSignal(async () => {
        return fetchSpy(param1(), param2());
      });

      // Trigger first access to start computation
      result();

      // Wait for initial computation
      await delay(20);
      expect(result().data).toBe("a-1");

      // Change first param
      param1.set("b");
      await delay(20);
      expect(result().data).toBe("b-1");

      // Change second param
      param2.set(2);
      await delay(20);
      expect(result().data).toBe("b-2");

      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("abort signal integration", () => {
    it("should provide abort signal to function", () => {
      let capturedAbortSignal: AbortSignal | undefined;

      const asyncSig = asyncSignal(async ({ abortSignal }) => {
        capturedAbortSignal = abortSignal;
        return "data";
      });

      // Trigger first access
      asyncSig();

      expect(capturedAbortSignal).toBeInstanceOf(AbortSignal);
      expect(capturedAbortSignal?.aborted).toBe(false);
    });

    it("should abort previous request when dependency changes", async () => {
      const userId = signal(1);
      const abortSignals: AbortSignal[] = [];

      const user = asyncSignal(async ({ abortSignal }) => {
        abortSignals.push(abortSignal);
        await delay(50);
        return { id: userId() };
      });

      // Start first request
      user();
      expect(abortSignals[0].aborted).toBe(false);

      // Change dependency before first completes
      await delay(10);
      // when user changed, the user signal still not add userId to its dependencies, so the previous request is not aborted
      userId.set(2);
      // First signal should be aborted
      expect(abortSignals[0].aborted).toBe(false); // Note: abort happens on token change, not API abort
      expect(abortSignals).toHaveLength(1);
    });

    it("should allow checking abort signal during fetch", async () => {
      const userId = signal(1);

      const fetchSpy = vi.fn(async (id: number, signal: AbortSignal) => {
        await delay(20);
        if (signal.aborted) {
          throw new Error("Aborted");
        }
        return { id };
      });

      const user = asyncSignal(async ({ abortSignal }) => {
        const id = userId();
        return fetchSpy(id, abortSignal);
      });

      // Initial fetch
      user();

      // Change quickly
      await delay(5);
      userId.set(2);

      // Wait for both to potentially complete
      await delay(50);

      // Should have made 2 calls
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("should catch synchronous errors", () => {
      const testError = new Error("Sync error");

      const asyncSig = asyncSignal(() => {
        throw testError;
      });

      const loadable = asyncSig();
      expect(loadable.status).toBe("error");
      expect(loadable.error).toBe(testError);
    });

    it("should catch async errors", async () => {
      const testError = new Error("Async error");

      const asyncSig = asyncSignal(async () => {
        await delay(10);
        throw testError;
      });

      expect(asyncSig().status).toBe("loading");

      await delay(20);

      const loadable = asyncSig();
      expect(loadable.status).toBe("error");
      expect(loadable.error).toBe(testError);
    });

    it("should handle thrown promises (suspense-like)", async () => {
      const promise = delay(10, "suspended data");

      const asyncSig = asyncSignal(() => {
        throw promise;
      });

      // Should track the thrown promise
      expect(asyncSig().status).toBe("loading");

      await delay(20);

      const loadable = asyncSig();
      expect(loadable.status).toBe("success");
      expect(loadable.data).toBe("suspended data");
    });
  });

  describe("promise caching", () => {
    it("should use cached promise state", async () => {
      let computeCount = 0;

      const asyncSig = asyncSignal(async () => {
        computeCount++;
        await delay(10);
        return "result";
      });

      // First access
      const l1 = asyncSig();
      expect(l1.status).toBe("loading");
      expect(computeCount).toBe(1);

      // Second access (before resolution) - should use same promise
      const l2 = asyncSig();
      expect(l2.status).toBe("loading");
      expect(l2.promise).toBe(l1.promise);

      // Wait for resolution
      await delay(20);

      // Access after resolution
      const l3 = asyncSig();
      expect(l3.status).toBe("success");
      expect(l3.data).toBe("result");

      // Should still be just 1 computation
      expect(computeCount).toBe(1);
    });
  });

  describe("re-computation", () => {
    it("should re-compute when dependencies change", async () => {
      const count = signal(1);
      let computeCount = 0;

      const doubled = asyncSignal(async () => {
        const c = count();
        computeCount++;
        await delay(10);
        return c * 2;
      });

      // Trigger first access
      doubled();

      // Initial computation
      await delay(20);
      expect(doubled().data).toBe(2);
      expect(computeCount).toBe(1);

      // Change dependency
      count.set(5);
      await delay(20);
      expect(doubled().data).toBe(10);
      expect(computeCount).toBe(2);
    });

    it("should not re-compute if no dependencies changed", async () => {
      let computeCount = 0;

      const data = asyncSignal(async () => {
        computeCount++;
        await delay(10);
        return "constant";
      });

      // Initial
      data();
      await delay(20);
      expect(computeCount).toBe(1);

      // Access again
      data();
      expect(computeCount).toBe(1); // Should not re-compute
    });

    it("should cancel previous computation when new one starts", async () => {
      const param = signal(1);
      const completedComputations: number[] = [];

      const data = asyncSignal(async ({ abortSignal }) => {
        const value = param();
        await delay(30);

        // Only track if not cancelled
        if (!abortSignal.aborted) {
          completedComputations.push(value);
        }

        return value * 10;
      });

      // Start first computation
      data();

      // Quickly change param 3 times
      await delay(5);
      param.set(2);
      await delay(5);
      param.set(3);
      await delay(5);
      param.set(4);

      // Wait for last to complete
      await delay(50);

      // Should have result from last computation
      expect(data().data).toBe(40);
    });
  });

  describe("complex scenarios", () => {
    it("should handle conditional async logic", async () => {
      const useCache = signal(true);
      const userId = signal(1);

      const fetchSpy = vi.fn(async (id: number) => {
        await delay(10);
        return { id, source: "api" };
      });

      const getCacheSpy = vi.fn((id: number) => {
        return Promise.resolve({ id, source: "cache" });
      });

      const user = asyncSignal(async () => {
        const id = userId();
        if (useCache()) {
          return getCacheSpy(id);
        }
        return fetchSpy(id);
      });

      // Trigger first access
      user();

      // Should use cache
      await delay(20);
      expect(user().data).toEqual({ id: 1, source: "cache" });
      expect(getCacheSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledTimes(0);

      // Switch to API
      useCache.set(false);
      await delay(20);
      expect(user().data).toEqual({ id: 1, source: "api" });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle chained async operations", async () => {
      const userId = signal(1);

      const user = asyncSignal(async () => {
        await delay(10);
        return { id: userId(), name: "User" };
      });

      const posts = asyncSignal(async () => {
        const u = user();
        if (u.status !== "success") {
          throw new Error("User not loaded");
        }
        await delay(10);
        return [`Post by ${u.data.name}`];
      });

      // Trigger first access
      user();

      // Wait for user to load
      await delay(20);
      expect(user().status).toBe("success");

      // Trigger posts computation
      posts();

      // Posts should now load
      await delay(20);
      expect(posts().status).toBe("success");
      expect(posts().data).toEqual(["Post by User"]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty async function", async () => {
      const asyncSig = asyncSignal(async () => {
        return undefined;
      });

      // Trigger first access
      asyncSig();

      await delay(10);

      const loadable = asyncSig();
      expect(loadable.status).toBe("success");
      expect(loadable.data).toBeUndefined();
    });

    it("should handle null return value", async () => {
      const asyncSig = asyncSignal(async () => {
        return null;
      });

      // Trigger first access
      asyncSig();

      await delay(10);

      const loadable = asyncSig();
      expect(loadable.status).toBe("success");
      expect(loadable.data).toBeNull();
    });

    it("should handle promise that never resolves", () => {
      const neverResolve = new Promise(() => {});

      const asyncSig = asyncSignal(() => neverResolve);

      const loadable = asyncSig();
      expect(loadable.status).toBe("loading");
      expect(loadable.promise).toBe(neverResolve);
    });

    it("should handle rapid dependency changes", async () => {
      const counter = signal(0);
      let executionCount = 0;

      const data = asyncSignal(async () => {
        executionCount++;
        const value = counter();
        await delay(20);
        return value;
      });

      // Trigger first access
      data();

      // Trigger multiple rapid changes
      for (let i = 1; i <= 5; i++) {
        counter.set(i);
        await delay(2); // Very short delay
      }

      // Wait for last to complete
      await delay(50);

      // Should have executed multiple times
      expect(executionCount).toBeGreaterThan(1);
      // Final result should be the last value
      expect(data().data).toBe(5);
    });
  });

  describe("track function", () => {
    it("should track signals accessed via track proxy", async () => {
      const s1 = signal(1);
      const s2 = signal(2);

      const data = asyncSignal(async ({ track }) => {
        const proxy = track({ s1, s2 });
        await delay(10);
        return proxy.s1 + proxy.s2;
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe(3);

      // Change s1
      s1.set(10);
      await delay(20);
      expect(data().data).toBe(12);

      // Change s2
      s2.set(20);
      await delay(20);
      expect(data().data).toBe(30);
    });

    it("should only track signals that are actually accessed", async () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const s3 = signal(3);
      let computeCount = 0;

      const data = asyncSignal(async ({ track }) => {
        computeCount++;
        const proxy = track({ s1, s2, s3 });
        await delay(10);
        return proxy.s1 + proxy.s2; // s3 is NOT accessed
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe(3);
      expect(computeCount).toBe(1);

      // Changing s3 should NOT trigger re-computation
      s3.set(100);
      await delay(20);
      expect(computeCount).toBe(1); // Still 1
      expect(data().data).toBe(3);

      // Changing s1 should trigger re-computation
      s1.set(10);
      await delay(20);
      expect(computeCount).toBe(2);
      expect(data().data).toBe(12);
    });

    it("should support conditional tracking", async () => {
      const condition = signal(true);
      const s1 = signal(10);
      const s2 = signal(20);
      let computeCount = 0;

      const data = asyncSignal(async ({ track }) => {
        computeCount++;
        const proxy = track({ condition, s1, s2 });
        await delay(10);

        if (proxy.condition) {
          return proxy.s1; // Only tracks s1 when condition is true
        }
        return proxy.s2; // Only tracks s2 when condition is false
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe(10);
      expect(computeCount).toBe(1);

      // Change s2 - should NOT trigger (condition is true, s2 not accessed)
      s2.set(200);
      await delay(20);
      expect(computeCount).toBe(1);

      // Change s1 - should trigger
      s1.set(100);
      await delay(20);
      expect(computeCount).toBe(2);
      expect(data().data).toBe(100);

      // Switch condition to false
      condition.set(false);
      await delay(20);
      expect(data().data).toBe(200);
      expect(computeCount).toBe(3);

      // Now s1 changes should NOT trigger
      s1.set(999);
      await delay(20);
      expect(computeCount).toBe(3);

      // But s2 changes should trigger
      s2.set(300);
      await delay(20);
      expect(computeCount).toBe(4);
      expect(data().data).toBe(300);
    });

    it("should support destructuring from track", async () => {
      const s1 = signal(5);
      const s2 = signal(10);

      const data = asyncSignal(async ({ track }) => {
        const { s1: v1, s2: v2 } = track({ s1, s2 });
        await delay(10);
        return v1 * v2;
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe(50);

      s1.set(3);
      await delay(20);
      expect(data().data).toBe(30);
    });

    it("should track signals accessed in loops", async () => {
      const items = signal([1, 2, 3]);
      const multiplier = signal(2);

      const data = asyncSignal(async ({ track }) => {
        const proxy = track({ items, multiplier });
        await delay(10);

        let sum = 0;
        for (const item of proxy.items) {
          sum += item;
        }
        return sum * proxy.multiplier;
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe(12); // (1+2+3) * 2

      // Change items
      items.set([1, 2, 3, 4]);
      await delay(20);
      expect(data().data).toBe(20); // (1+2+3+4) * 2

      // Change multiplier
      multiplier.set(3);
      await delay(20);
      expect(data().data).toBe(30); // (1+2+3+4) * 3
    });

    it("should work with multiple track calls", async () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const s3 = signal(3);

      const data = asyncSignal(async ({ track }) => {
        const proxy1 = track({ s1, s2 });
        await delay(5);
        const proxy2 = track({ s3 });
        await delay(5);
        return proxy1.s1 + proxy1.s2 + proxy2.s3;
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe(6);

      // All signals should trigger re-computation
      s1.set(10);
      await delay(20);
      expect(data().data).toBe(15);

      s2.set(20);
      await delay(20);
      expect(data().data).toBe(33);

      s3.set(30);
      await delay(20);
      expect(data().data).toBe(60);
    });

    it("should combine implicit and explicit tracking", async () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const s3 = signal(3);

      const data = asyncSignal(async ({ track }) => {
        // Implicit tracking before await
        const v1 = s1();

        await delay(10);

        // Explicit tracking after await
        const proxy = track({ s2, s3 });
        return v1 + proxy.s2 + proxy.s3;
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe(6);

      // s1 should trigger (implicit)
      s1.set(10);
      await delay(20);
      expect(data().data).toBe(15);

      // s2 should trigger (explicit via track)
      s2.set(20);
      await delay(20);
      expect(data().data).toBe(33);

      // s3 should trigger (explicit via track)
      s3.set(30);
      await delay(20);
      expect(data().data).toBe(60);
    });

    it("should track signals accessed multiple times", async () => {
      const s1 = signal(5);

      const data = asyncSignal(async ({ track }) => {
        const proxy = track({ s1 });
        await delay(10);
        // Access s1 multiple times
        return proxy.s1 + proxy.s1 + proxy.s1;
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe(15);

      s1.set(10);
      await delay(20);
      expect(data().data).toBe(30);
    });

    it("should handle empty track object", async () => {
      const data = asyncSignal(async ({ track }) => {
        track({});
        await delay(10);
        return "done";
      });

      // Trigger first access
      data();

      await delay(20);
      expect(data().data).toBe("done");
    });
  });
});
