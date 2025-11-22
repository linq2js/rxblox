import { describe, it, expect, vi } from "vitest";
import { batch, isBatching } from "./batch";
import { signal } from "./signal";

describe("batch", () => {
  it("should execute function and return result", () => {
    const result = batch(() => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it("should batch multiple signal updates into single notification", () => {
    const count = signal(0);
    const name = signal("Alice");
    const listener = vi.fn();

    count.on(listener);
    name.on(listener);

    // Without batch: 2 notifications
    count.set(1);
    name.set("Bob");
    expect(listener).toHaveBeenCalledTimes(2);

    listener.mockClear();

    // With batch: 1 notification each (fired after batch completes)
    batch(() => {
      count.set(2);
      name.set("Charlie");
    });
    expect(listener).toHaveBeenCalledTimes(2); // Still 2, but batched
  });

  it("should defer notifications until batch completes", () => {
    const count = signal(0);
    const listener = vi.fn();
    let callOrder: string[] = [];

    count.on(() => {
      callOrder.push("listener");
      listener();
    });

    batch(() => {
      callOrder.push("before set");
      count.set(1);
      callOrder.push("after set");
    });
    callOrder.push("after batch");

    expect(callOrder).toEqual([
      "before set",
      "after set",
      "listener",
      "after batch",
    ]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("should support nested batches", () => {
    const count = signal(0);
    const name = signal("Alice");
    const listener = vi.fn();

    count.on(listener);
    name.on(listener);

    batch(() => {
      count.set(1);
      batch(() => {
        name.set("Bob");
      });
    });

    // All notifications fire after outermost batch completes
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("should handle errors and still flush notifications", () => {
    const count = signal(0);
    const listener = vi.fn();

    count.on(listener);

    expect(() => {
      batch(() => {
        count.set(1);
        throw new Error("test error");
      });
    }).toThrow("test error");

    // Notification should still fire despite error
    expect(listener).toHaveBeenCalledOnce();
  });

  it("should throw error for async functions", () => {
    expect(() => {
      batch(async () => {
        return 42;
      });
    }).toThrow(/does not support async functions/);
  });

  it("should throw error for functions returning promises", () => {
    expect(() => {
      batch(() => {
        return Promise.resolve(42);
      });
    }).toThrow(/does not support async functions/);
  });

  it("should deduplicate notifications from same signal", () => {
    const count = signal(0);
    const listener = vi.fn();

    count.on(listener);

    batch(() => {
      count.set(1);
      count.set(2);
      count.set(3);
    });

    // Only 3 notifications (one per actual change)
    expect(listener).toHaveBeenCalledTimes(3);
    expect(count()).toBe(3);
  });

  it("should update derived signals correctly", () => {
    const a = signal(1);
    const b = signal(2);
    const sum = signal({ a, b }, ({ deps }) => deps.a + deps.b);
    const listener = vi.fn();

    sum.on(listener);

    batch(() => {
      a.set(10);
      b.set(20);
    });

    // Sum should update once with both new values
    expect(sum()).toBe(30);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("should allow reading signal values during batch", () => {
    const count = signal(0);

    const result = batch(() => {
      count.set(5);
      return count(); // Should return updated value
    });

    expect(result).toBe(5);
    expect(count()).toBe(5);
  });

  describe("isBatching", () => {
    it("should return false when not batching", () => {
      expect(isBatching()).toBe(false);
    });

    it("should return true inside batch", () => {
      batch(() => {
        expect(isBatching()).toBe(true);
      });
    });

    it("should return true inside nested batch", () => {
      batch(() => {
        batch(() => {
          expect(isBatching()).toBe(true);
        });
        expect(isBatching()).toBe(true);
      });
    });

    it("should return false after batch completes", () => {
      batch(() => {
        expect(isBatching()).toBe(true);
      });
      expect(isBatching()).toBe(false);
    });
  });
});

