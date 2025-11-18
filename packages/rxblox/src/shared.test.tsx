import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";
import { shared } from "./shared";
import { signal } from "./signal";
import { blox } from "./blox";

describe("shared", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("basic functionality", () => {
    it("should create and return instances", () => {
      const createUser = shared((id: number) => {
        return { id, name: `User ${id}` };
      });

      const user1 = createUser(1);
      expect(user1.id).toBe(1);
      expect(user1.name).toBe("User 1");
    });

    it("should share instances with same key", () => {
      const createUser = shared((id: number) => {
        return { id, name: `User ${id}` };
      });

      const user1 = createUser(1);
      const user2 = createUser(1);

      expect(user1).toBe(user2); // Same proxy
    });

    it("should create different instances for different keys", () => {
      const createUser = shared((id: number) => {
        return { id, name: `User ${id}` };
      });

      const user1 = createUser(1);
      const user2 = createUser(2);

      expect(user1).not.toBe(user2);
      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
    });

    it("should share signals across calls", () => {
      const createCounter = shared((id: string) => {
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
    it("should never GC global instances", () => {
      let callCount = 0;
      const createLogic = shared((id: number) => {
        callCount++;
        return { id, callCount };
      });

      // Create in global scope
      const logic1 = createLogic(1);
      expect(callCount).toBe(1);

      // Global instances persist (refs = Infinity)
      const logic2 = createLogic(1);
      expect(logic2.id).toBe(logic1.id);
      expect(callCount).toBe(1); // Same instance
    });
  });

  describe("proxy protection", () => {
    it("should allow normal access to non-deleted entries", () => {
      const createLogic = shared((id: number) => {
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
      const createLogic = shared((id: number) => {
        return { id, value: signal(0) };
      });

      const logic1 = createLogic(1);
      const logic2 = createLogic(1);

      // Same proxy reference
      expect(logic1).toBe(logic2);
    });

    it("should share the same underlying object", () => {
      const createLogic = shared((id: number) => {
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
      const createLogic = shared(
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
        const createLogic = shared(
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
        const createLogic = shared(
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
        const createLogic = shared(
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
        const createLogic = shared(
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
        const createLogic = shared(
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
      it("should use 'never' for global scope by default", () => {
        let callCount = 0;
        const createLogic = shared((id: number) => {
          callCount++;
          return { id, value: signal(id) };
        });

        // Create in global scope
        const logic1 = createLogic(1);
        expect(callCount).toBe(1);

        // Same instance (permanent)
        const logic2 = createLogic(1);
        expect(callCount).toBe(1);
        expect(logic1).toBe(logic2);
      });

      it("should use 'auto' for blox scope by default", async () => {
        let callCount = 0;
        const createLogic = shared((id: number) => {
          callCount++;
          return { id, value: signal(id) };
        });

        const Component = blox(() => {
          const logic = createLogic(1);
          return <div>{logic.value()}</div>;
        });

        const { unmount } = render(<Component />);
        expect(callCount).toBe(1);

        // Unmount should trigger GC (default auto in blox)
        act(() => {
          unmount();
        });
        await Promise.resolve(); // Wait for cleanup

        // New instance should be created
        createLogic(1);
        expect(callCount).toBe(2);
      });
    });
  });

  describe("error handling", () => {
    it("should throw error for async functions", () => {
      expect(() => {
        shared(async (id: number) => {
          return { id };
        });
      }).toThrow("shared() function must be synchronous");
    });

    it("should enforce object return type at runtime", () => {
      // TypeScript enforces this at compile time, but we can't
      // test runtime enforcement without casting
      const createLogic = shared((id: number) => {
        return { id, value: "test" };
      });

      const logic = createLogic(1);
      expect(typeof logic).toBe("object");
      expect(logic).not.toBeNull();
    });
  });
});
