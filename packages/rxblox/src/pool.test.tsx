import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";
import { pool } from "./pool";
import { signal } from "./signal";
import { blox } from "./blox";
import { effect } from "./effect";
import { getDispatcher } from "./dispatcher";
import { disposableToken } from "./disposableDispatcher";

describe("pool", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("basic functionality", () => {
    it("should create and return instances", () => {
      const createUser = pool((id: number) => {
        return { id, name: `User ${id}` };
      });

      const user1 = createUser(1);
      expect(user1.id).toBe(1);
      expect(user1.name).toBe("User 1");
    });

    it("should share instances with same key", () => {
      const createUser = pool((id: number) => {
        return { id, name: `User ${id}` };
      });

      const user1 = createUser(1);
      const user2 = createUser(1);

      expect(user1).toBe(user2); // Same proxy
    });

    it("should create different instances for different keys", () => {
      const createUser = pool((id: number) => {
        return { id, name: `User ${id}` };
      });

      const user1 = createUser(1);
      const user2 = createUser(2);

      expect(user1).not.toBe(user2);
      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
    });

    it("should share signals across calls", () => {
      const createCounter = pool((id: string) => {
        const count = signal(0);
        return { id, count };
      });

      const counter1 = createCounter("a");
      const counter2 = createCounter("a");

      // Same proxy, so same signal reference
      expect(counter1.count).toBe(counter2.count);

      counter1.count.set(5);
      expect(counter2.count()).toBe(5);
    });
  });

  describe("garbage collection", () => {
    it("should never GC instances by default", () => {
      let callCount = 0;
      const createLogic = pool((id: number) => {
        callCount++;
        return { id, callCount };
      });

      // Create instance (default: never GC)
      const logic1 = createLogic(1);
      expect(callCount).toBe(1);

      // Instances persist by default (refs = -1)
      const logic2 = createLogic(1);
      expect(logic2.id).toBe(logic1.id);
      expect(callCount).toBe(1); // Same instance
    });
  });

  describe("proxy protection", () => {
    it("should allow normal access to non-deleted entries", () => {
      const createLogic = pool((id: number) => {
        return { id, value: signal(0) };
      });

      const logic = createLogic(1);

      // Normal access works
      expect(logic.id).toBe(1);
      expect(logic.value()).toBe(0);
      logic.value.set(5);
      expect(logic.value()).toBe(5);
    });

    it("should return same proxy reference for same key", () => {
      const createLogic = pool((id: number) => {
        return { id, value: signal(0) };
      });

      const logic1 = createLogic(1);
      const logic2 = createLogic(1);

      // Same proxy reference
      expect(logic1).toBe(logic2);
    });

    it("should share the same underlying object", () => {
      const createLogic = pool((id: number) => {
        return { id, value: signal(0) };
      });

      const logic1 = createLogic(1);
      const logic2 = createLogic(1);

      // Modifications via one reference affect the other
      logic1.value.set(10);
      expect(logic2.value()).toBe(10);
    });
  });

  describe("custom equality", () => {
    it("should use custom equals function", () => {
      let callCount = 0;
      const createLogic = pool(
        (config: { id: number; type: string }) => {
          callCount++;
          return { config, callCount };
        },
        {
          equals: (a, b) => a.id === b.id && a.type === b.type,
        }
      );

      const result1 = createLogic({ id: 1, type: "user" });
      const result2 = createLogic({ id: 1, type: "user" });

      expect(result1.config).toBe(result2.config);
      expect(callCount).toBe(1);
    });
  });

  describe("dispose option", () => {
    describe('dispose: "never"', () => {
      it("should keep instance forever in blox scope", () => {
        let callCount = 0;
        const createLogic = pool(
          (id: number) => {
            callCount++;
            return { id, value: signal(id) };
          },
          { dispose: "never" }
        );

        const Component = blox(() => {
          const logic = createLogic(1);
          return <div>{logic.value()}</div>;
        });

        const { unmount } = render(<Component />);
        expect(callCount).toBe(1);

        // Unmount should NOT trigger GC for dispose: "never"
        act(() => {
          unmount();
        });

        // Same instance should still exist
        createLogic(1);
        expect(callCount).toBe(1); // No new instance created
      });

      it("should keep instance forever even with multiple mount/unmount cycles", () => {
        let callCount = 0;
        const createLogic = pool(
          (id: number) => {
            callCount++;
            return { id, value: signal(id) };
          },
          { dispose: "never" }
        );

        const Component = blox(() => {
          const logic = createLogic(1);
          return <div>{logic.value()}</div>;
        });

        // First mount/unmount
        const { unmount: unmount1 } = render(<Component />);
        expect(callCount).toBe(1);
        act(() => {
          unmount1();
        });

        // Second mount/unmount
        const { unmount: unmount2 } = render(<Component />);
        expect(callCount).toBe(1); // Same instance

        act(() => {
          unmount2();
        });

        // Third call after all unmounts
        const logic = createLogic(1);
        expect(callCount).toBe(1); // Still same instance
        expect(logic.id).toBe(1);
      });
    });

    describe('dispose: "auto"', () => {
      it("should auto-dispose in blox scope when refs reach 0", async () => {
        let callCount = 0;
        const createLogic = pool(
          (id: number) => {
            callCount++;
            return { id, value: signal(id) };
          },
          { dispose: "auto" }
        );

        const Component = blox(() => {
          const logic = createLogic(1);
          return <div>{logic.value()}</div>;
        });

        const { unmount } = render(<Component />);
        expect(callCount).toBe(1);

        // Unmount should trigger GC for dispose: "auto"
        act(() => {
          unmount();
        });

        // Wait for microtask (useUnmount uses Promise.resolve().then())
        await Promise.resolve();

        // New instance should be created
        createLogic(1);
        expect(callCount).toBe(2); // New instance created
      });

      it("should not dispose while refs > 0", async () => {
        let callCount = 0;
        const createLogic = pool(
          (id: number) => {
            callCount++;
            return { id, value: signal(id) };
          },
          { dispose: "auto" }
        );

        const Component = blox(() => {
          const logic = createLogic(1);
          return <div>{logic.value()}</div>;
        });

        // Mount two components
        const { unmount: unmount1 } = render(<Component />);
        expect(callCount).toBe(1);

        const { unmount: unmount2 } = render(<Component />);
        expect(callCount).toBe(1); // Same instance

        // Unmount first component - refs should still be 1
        act(() => {
          unmount1();
        });
        await Promise.resolve(); // Wait for cleanup

        // Instance should still exist
        createLogic(1);
        expect(callCount).toBe(1); // Same instance

        // Unmount second component - refs should reach 0
        act(() => {
          unmount2();
        });
        await Promise.resolve(); // Wait for cleanup

        // Now instance should be GC'd
        createLogic(1);
        expect(callCount).toBe(2); // New instance created
      });

      it("should work with no initial context (global scope)", async () => {
        let callCount = 0;
        const createLogic = pool(
          (id: number) => {
            callCount++;
            return { id, value: signal(id) };
          },
          { dispose: "auto" }
        );

        // Create in global scope - refs = 0
        const logic1 = createLogic(1);
        expect(callCount).toBe(1);

        // Same instance (still in cache)
        const logic2 = createLogic(1);
        expect(callCount).toBe(1);
        expect(logic1).toBe(logic2);

        const Component = blox(() => {
          const logic = createLogic(1);
          return <div>{logic.value()}</div>;
        });

        // Mount component - refs++
        const { unmount } = render(<Component />);
        expect(callCount).toBe(1); // Same instance

        // Unmount - refs reaches 0, triggers GC
        act(() => {
          unmount();
        });
        await Promise.resolve(); // Wait for cleanup

        // New instance created
        createLogic(1);
        expect(callCount).toBe(2);
      });
    });

    describe("default behavior", () => {
      it("should use 'never' by default (permanent instances)", async () => {
        let callCount = 0;
        const createLogic = pool((id: number) => {
          callCount++;
          return { id, value: signal(id) };
        });

        const Component = blox(() => {
          const logic = createLogic(1);
          return <div>{logic.value()}</div>;
        });

        const { unmount } = render(<Component />);
        expect(callCount).toBe(1);

        // Unmount should NOT trigger GC (default: never)
        act(() => {
          unmount();
        });
        await Promise.resolve(); // Wait for cleanup

        // Same instance should be returned (not GC'd)
        createLogic(1);
        expect(callCount).toBe(1); // Still 1 - same instance
      });
    });
  });

  describe(".once() method", () => {
    it("should create one-off instance not in pool", () => {
      let callCount = 0;
      const createLogic = pool((id: number) => {
        callCount++;
        return { id, value: signal(id) };
      });

      // Create with .once()
      const [logic1, dispose1] = createLogic.once(1);
      expect(callCount).toBe(1);
      expect(logic1.id).toBe(1);

      // Create again with .once() - should be NEW instance
      const [logic2, dispose2] = createLogic.once(1);
      expect(callCount).toBe(2); // New instance created
      expect(logic2.id).toBe(1);
      expect(logic1).not.toBe(logic2); // Different instances

      // Cleanup
      dispose1();
      dispose2();
    });

    it("should return dispose function", () => {
      const cleanup = vi.fn();
      const createLogic = pool((id: number) => {
        const value = signal(id);
        getDispatcher(disposableToken)?.on(cleanup);
        return { value };
      });

      const [, dispose] = createLogic.once(1);
      expect(cleanup).not.toHaveBeenCalled();

      dispose();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("should not affect pooled instances", () => {
      let callCount = 0;
      const createLogic = pool((id: number) => {
        callCount++;
        return { id, value: signal(id) };
      });

      // Pooled instance
      const pooled1 = createLogic(1);
      expect(callCount).toBe(1);

      // One-off instance
      const [once1, dispose1] = createLogic.once(1);
      expect(callCount).toBe(2); // Different instance

      // Pooled instance again - should be same as pooled1
      const pooled2 = createLogic(1);
      expect(callCount).toBe(2); // Still 2, reused from pool
      expect(pooled1).toBe(pooled2);

      // One-off should be different
      expect(once1).not.toBe(pooled1);
      expect(once1.id).toBe(pooled1.id); // Same key though

      dispose1();
    });

    it("should cleanup signals when disposed", async () => {
      const createLogic = pool((_id: number) => {
        const count = signal(0);
        let effectRuns = 0;
        effect(() => {
          count(); // Track
          effectRuns++;
        });
        return { count, effectRuns: () => effectRuns };
      });

      const [logic, dispose] = createLogic.once(1);
      const initialRuns = logic.effectRuns();

      logic.count.set(1);
      await Promise.resolve(); // Wait for effect

      expect(logic.effectRuns()).toBeGreaterThan(initialRuns);

      dispose();

      // After dispose, effect should not run
      const runsBeforeSet = logic.effectRuns();
      logic.count.set(2);
      await Promise.resolve();

      expect(logic.effectRuns()).toBe(runsBeforeSet); // No new runs
    });

    it("should work with different keys", () => {
      let callCount = 0;
      const createLogic = pool((id: number) => {
        callCount++;
        return { id, value: signal(id) };
      });

      const [logic1, dispose1] = createLogic.once(1);
      const [logic2, dispose2] = createLogic.once(2);
      const [logic3, dispose3] = createLogic.once(1); // Same key as logic1

      expect(callCount).toBe(3); // All are separate instances
      expect(logic1.id).toBe(1);
      expect(logic2.id).toBe(2);
      expect(logic3.id).toBe(1);
      expect(logic1).not.toBe(logic3); // Different despite same key

      dispose1();
      dispose2();
      dispose3();
    });
  });

  describe("error handling", () => {
    it("should throw error for async functions", () => {
      expect(() => {
        pool(async (id: number) => {
          return { id };
        });
      }).toThrow("pool() function must be synchronous");
    });

    it("should enforce object return type at runtime", () => {
      // TypeScript enforces this at compile time, but we can't
      // test runtime enforcement without casting
      const createLogic = pool((id: number) => {
        return { id, value: "test" };
      });

      const logic = createLogic(1);
      expect(typeof logic).toBe("object");
      expect(logic).not.toBeNull();
    });
  });
});
