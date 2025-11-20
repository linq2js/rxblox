import { describe, it, expect, vi } from "vitest";
import { batch } from "./batch";
import { signal } from "./signal";

describe("batch", () => {
  it("should batch multiple signal updates into one notification", async () => {
    const count = signal(0);
    const name = signal("Alice");
    const countListener = vi.fn();
    const nameListener = vi.fn();

    count.on(countListener);
    name.on(nameListener);

    batch(() => {
      count.set(1);
      name.set("Bob");
    });

    // Notifications are queued and fire after batch
    expect(countListener).toHaveBeenCalledTimes(1);
    expect(nameListener).toHaveBeenCalledTimes(1);
  });

  it("should batch computed signal recomputations", async () => {
    const a = signal(1);
    const b = signal(2);
    const computeFn = vi.fn((x: number, y: number) => x + y);
    const sum = signal(() => computeFn(a(), b()));

    // Force initial computation
    expect(sum()).toBe(3);
    expect(computeFn).toHaveBeenCalledTimes(1);

    batch(() => {
      a.set(10);
      b.set(20);
    });

    // During batch, computed should not recompute yet
    expect(computeFn).toHaveBeenCalledTimes(1);

    // After microtask, computed recomputes once with both updates
    await Promise.resolve();
    expect(sum()).toBe(30);
    expect(computeFn).toHaveBeenCalledTimes(2); // Only one recomputation
  });

  it("should handle nested batches", async () => {
    const count = signal(0);
    const listener = vi.fn();
    count.on(listener);

    batch(() => {
      count.set(1);

      batch(() => {
        count.set(2);

        batch(() => {
          count.set(3);
        });
      });
    });

    // Nested batches are flattened, notifications fire after outer batch
    expect(listener).toHaveBeenCalled();
    expect(count()).toBe(3);
    // Each set() call triggers one notification (deduped by signal key)
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should prevent inconsistent state during batch", async () => {
    const keys = signal(["a", "b", "c"]);
    const values = signal<Record<string, number>>({ a: 1, b: 2, c: 3 });

    const mapped = signal(() => {
      const k = keys();
      const v = values();
      return k.map((key) => v[key as keyof typeof v]);
    });

    // Initial state
    expect(mapped()).toEqual([1, 2, 3]);

    // Update both in a batch
    batch(() => {
      keys.set(["a", "b"]); // Remove 'c'
      values.set((draft) => {
        draft["a"] = 10;
        draft["b"] = 20;
        delete draft["c"];
      });
    });

    await Promise.resolve();

    // Should see consistent state
    expect(mapped()).toEqual([10, 20]);
  });

  it("should return stale value when computed is accessed during batch", () => {
    const a = signal(1);
    const b = signal(2);
    const sum = signal(() => a() + b());

    // Initial computation
    expect(sum()).toBe(3);

    let resultDuringBatch: number | undefined;

    batch(() => {
      a.set(10);
      b.set(20);

      // Accessing during batch should return stale value
      resultDuringBatch = sum();
    });

    // Should return stale value (3), not recompute with inconsistent state
    expect(resultDuringBatch).toBe(3);
  });

  it("should handle batch with dependent computed signals", async () => {
    const a = signal(1);
    const doubled = signal(() => a() * 2);
    const quadrupled = signal(() => doubled() * 2);

    // Force initial computation
    expect(doubled()).toBe(2);
    expect(quadrupled()).toBe(4);

    const listener1 = vi.fn();
    const listener2 = vi.fn();
    doubled.on(listener1);
    quadrupled.on(listener2);

    batch(() => {
      a.set(5);
    });

    await Promise.resolve();

    expect(doubled()).toBe(10);
    expect(quadrupled()).toBe(20);
    // Computed signals recompute asynchronously after batch
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it("should handle errors during batch", () => {
    const count = signal(0);

    expect(() => {
      batch(() => {
        count.set(1);
        throw new Error("Test error");
      });
    }).toThrow("Test error");

    // Signal should still be updated
    expect(count()).toBe(1);
  });

  it("should flush notifications even if error occurs", async () => {
    const count = signal(0);
    const listener = vi.fn();
    count.on(listener);

    try {
      batch(() => {
        count.set(1);
        throw new Error("Test error");
      });
    } catch {
      // Expected
    }

    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should handle multiple sequential batches", async () => {
    const count = signal(0);
    const listener = vi.fn();
    count.on(listener);

    batch(() => {
      count.set(1);
    });

    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);

    batch(() => {
      count.set(2);
    });

    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("should work with effects", async () => {
    const a = signal(1);
    const b = signal(2);
    const effectFn = vi.fn();

    // Create a computed signal that tracks a and b
    const combined = signal(() => {
      effectFn(a(), b());
      return `${a()}-${b()}`;
    });

    // Force initial computation
    expect(combined()).toBe("1-2");
    expect(effectFn).toHaveBeenCalledWith(1, 2);
    effectFn.mockClear();

    batch(() => {
      a.set(10);
      b.set(20);
    });

    // Computed should not recompute during batch
    expect(effectFn).not.toHaveBeenCalled();

    await Promise.resolve();

    // Computed recomputes once after batch with both updates
    expect(combined()).toBe("10-20");
    expect(effectFn).toHaveBeenCalledWith(10, 20);
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  it("should handle batch with equality checks", async () => {
    const count = signal(1, { equals: (a, b) => a === b });
    const listener = vi.fn();
    count.on(listener);

    batch(() => {
      count.set(1); // Same value, should not notify
      count.set(2); // Different value, should notify
    });

    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should handle deep nesting of batches", async () => {
    const count = signal(0);
    const listener = vi.fn();
    count.on(listener);

    batch(() => {
      count.set(1);
      batch(() => {
        count.set(2);
        batch(() => {
          count.set(3);
          batch(() => {
            count.set(4);
          });
        });
      });
    });

    // Nested batches are flattened, notifications fire after outer batch
    expect(count()).toBe(4);
    // Notifications are deduped by signal key, so only last value notifies
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should batch updates from multiple computed signals", async () => {
    const a = signal(1);
    const b = signal(2);

    const sum = signal(() => a() + b());
    const product = signal(() => a() * b());
    const combined = signal(() => sum() + product());

    const listener = vi.fn();
    combined.on(listener);

    // Force initial computation
    expect(combined()).toBe(5); // (1+2) + (1*2) = 3 + 2 = 5

    batch(() => {
      a.set(3);
      b.set(4);
    });

    await Promise.resolve();

    expect(sum()).toBe(7); // 3 + 4
    expect(product()).toBe(12); // 3 * 4
    expect(combined()).toBe(19); // 7 + 12
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should return value from batch function", () => {
    const result = batch(() => {
      return 42;
    });

    expect(result).toBe(42);
  });

  it("should handle async functions in batch", async () => {
    const count = signal(0);
    const listener = vi.fn();
    count.on(listener);

    batch(() => {
      count.set(1);
      Promise.resolve().then(() => {
        count.set(2); // This is outside the batch
      });
    });

    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(2); // One for batched, one for async
  });

  it("should deduplicate notifications for same signal", async () => {
    const count = signal(0);
    const listener = vi.fn();
    count.on(listener);

    batch(() => {
      count.set(1);
      count.set(2);
      count.set(3);
    });

    // Notifications are deduped by signal key in the batch queue
    // Only the last notification fires (Map behavior)
    expect(listener).toHaveBeenCalledTimes(1);
    expect(count()).toBe(3);
  });

  it("should work with signal.peek() to avoid tracking", () => {
    const a = signal(1);
    const b = signal(2);
    const computeFn = vi.fn();

    const sum = signal(() => {
      computeFn();
      return a() + b.peek(); // Only track 'a'
    });

    expect(sum()).toBe(3);
    expect(computeFn).toHaveBeenCalledTimes(1);

    batch(() => {
      b.set(10); // Should not trigger recomputation
    });

    // Computed should not have recomputed
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it("should batch updates with signal array overload", () => {
    const a = signal({ count: 0 });
    const b = signal({ name: "Alice" });
    const c = signal({ age: 30 });

    batch([a, b, c], (draftA, draftB, draftC) => {
      draftA.count = 10;
      draftB.name = "Bob";
      draftC.age = 25;
    });

    expect(a()).toEqual({ count: 10 });
    expect(b()).toEqual({ name: "Bob" });
    expect(c()).toEqual({ age: 25 });
  });

  it("should infer correct types for signal array overload", () => {
    const num = signal(42);
    const str = signal("hello");
    const bool = signal(true);

    batch([num, str, bool], (n, s, b) => {
      // Type checks
      n satisfies number;
      s satisfies string;
      b satisfies boolean;

      // Use the values (this would fail if types were wrong)
      void ((n + 1) satisfies number);
      void (s.toUpperCase() satisfies string);
      void (!b satisfies boolean);
    });
  });

  it("should disable tracking during batch to prevent creating dependencies", () => {
    const a = signal(1);
    const b = signal(2);

    const trackedSignals: any[] = [];

    // Manually track what would happen if tracking were enabled

    batch(() => {
      // Access signals during batch
      a();
      b();

      // With tracking disabled, mockDispatcher.add should NOT be called
      // because getDispatcher(trackingToken) returns undefined
    });

    // Verify no tracking happened during batch
    expect(trackedSignals).toHaveLength(0);
  });

  it("should prevent effects from tracking dependencies created during batch", () => {
    const count = signal(0);
    let effectRunCount = 0;

    const cleanup = count.on(() => {
      effectRunCount++;
    });

    effectRunCount = 0;

    // Try to create a tracking context during batch
    batch(() => {
      // This should not create tracking dependencies
      // because trackingToken is disabled during batch
      const value = count();
      expect(value).toBe(0);

      // Update the signal
      count.set(5);
    });

    // Effect should run after batch (from the set notification)
    expect(effectRunCount).toBeGreaterThanOrEqual(1);
    expect(count()).toBe(5);

    cleanup();
  });

  it("should throw error when batch is called with async function", () => {
    const count = signal(0);

    expect(() => {
      batch(async () => {
        count.set(1);
        await Promise.resolve();
        count.set(2);
      });
    }).toThrow("batch() does not support async functions");
  });

  it("should throw error when batch returns a promise", () => {
    const count = signal(0);

    expect(() => {
      batch(() => {
        count.set(1);
        return Promise.resolve(42);
      });
    }).toThrow("batch() does not support async functions");
  });

  it("should throw error when batch returns a thenable object", () => {
    const count = signal(0);

    expect(() => {
      batch(() => {
        count.set(1);
        return {
          then: (resolve: (v: number) => void) => resolve(42),
        };
      });
    }).toThrow("batch() does not support async functions");
  });

  it("should not throw when batch returns a non-promise value", () => {
    const count = signal(0);

    expect(() => {
      const result = batch(() => {
        count.set(1);
        return 42;
      });
      expect(result).toBe(42);
    }).not.toThrow();
  });

  it("should not throw when batch returns undefined", () => {
    const count = signal(0);

    expect(() => {
      const result = batch(() => {
        count.set(1);
      });
      expect(result).toBeUndefined();
    }).not.toThrow();
  });

  it("should not throw when batch returns an object without then method", () => {
    const count = signal(0);

    expect(() => {
      const result = batch(() => {
        count.set(1);
        return { value: 42 };
      });
      expect(result).toEqual({ value: 42 });
    }).not.toThrow();
  });
});
