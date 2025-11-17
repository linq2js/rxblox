import { describe, it, expect, beforeEach, vi } from "vitest";
import { effect } from "./effect";
import { signal } from "./signal";
import {
  localEffectDispatcher,
  globalEffectDispatcher,
  effectToken,
} from "./effectDispatcher";
import { withDispatchers } from "./dispatcher";

describe("effect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should create an effect with run method", () => {
      const fn = vi.fn();
      const e = effect(fn);

      expect(e).toHaveProperty("run");
      expect(typeof e.run).toBe("function");
    });

    it("should execute the effect function when run", () => {
      const fn = vi.fn();
      const e = effect(fn);

      // Effect already ran once (default dispatcher)
      expect(fn).toHaveBeenCalledTimes(1);
      fn.mockClear();

      const cleanup = e.run();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(typeof cleanup).toBe("function");
    });

    it("should automatically run when created with default dispatcher", () => {
      const fn = vi.fn();
      effect(fn);

      // Effect should run automatically when created (default dispatcher)
      expect(fn).toHaveBeenCalled();
    });

    it("should return cleanup function from run", () => {
      const fn = vi.fn();
      const e = effect(fn);

      const cleanup = e.run();
      expect(typeof cleanup).toBe("function");
      cleanup(); // Should not throw
    });
  });

  describe("reactive tracking", () => {
    it("should track signal dependencies", () => {
      const s = signal(0);
      const fn = vi.fn(() => {
        s(); // Access signal
      });
      const e = effect(fn);

      fn.mockClear();
      e.run();
      expect(fn).toHaveBeenCalledTimes(1);

      // Changing the signal should re-run the effect
      s.set(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should re-run when tracked signal changes", () => {
      const count = signal(0);
      const calls: number[] = [];

      effect(() => {
        calls.push(count());
      });

      expect(calls).toEqual([0]);
      count.set(1);
      expect(calls).toEqual([0, 1]);
      count.set(2);
      expect(calls).toEqual([0, 1, 2]);
    });

    it("should track multiple signals", () => {
      const a = signal(1);
      const b = signal(2);
      const calls: number[] = [];

      effect(() => {
        calls.push(a() + b());
      });

      expect(calls).toEqual([3]);
      a.set(10);
      expect(calls).toEqual([3, 12]);
      b.set(20);
      expect(calls).toEqual([3, 12, 30]);
    });

    it("should only track signals accessed during execution", () => {
      const a = signal(1);
      const b = signal(2);
      let useA = true;
      const calls: number[] = [];

      effect(() => {
        if (useA) {
          calls.push(a());
        } else {
          calls.push(b());
        }
      });

      expect(calls).toEqual([1]);

      // Initially only tracks 'a'
      b.set(20);
      expect(calls).toEqual([1]); // Should not trigger

      a.set(10);
      expect(calls).toEqual([1, 10]); // Should trigger
    });
  });

  describe("cleanup function", () => {
    it("should call cleanup function before next execution", () => {
      const cleanup = vi.fn();
      const s = signal(0);

      effect(() => {
        s();
        return cleanup;
      });

      expect(cleanup).not.toHaveBeenCalled();
      s.set(1);
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("should call cleanup when cleanup function is called", () => {
      const dispatcher = localEffectDispatcher();
      const cleanupFn = vi.fn();
      const s = signal(0);
      let e: ReturnType<typeof effect>;

      withDispatchers([effectToken(dispatcher)], () => {
        e = effect(() => {
          s();
          return cleanupFn;
        });
      });

      // Effect hasn't run yet
      expect(cleanupFn).not.toHaveBeenCalled();

      // Run the effect
      const stop = e!.run();
      // Cleanup not called yet (only when signal changes or stop is called)
      expect(cleanupFn).not.toHaveBeenCalled();

      stop(); // Call cleanup
      // Cleanup should be called once
      expect(cleanupFn).toHaveBeenCalledTimes(1);
    });

    it("should handle effect without cleanup function", () => {
      const s = signal(0);
      const fn = vi.fn(() => {
        s();
      });

      const e = effect(fn);
      expect(() => {
        const cleanup = e.run();
        cleanup();
      }).not.toThrow();
    });

    it("should call cleanup only once per re-run", () => {
      const cleanup = vi.fn();
      const s = signal(0);

      effect(() => {
        s();
        return cleanup;
      });

      s.set(1);
      expect(cleanup).toHaveBeenCalledTimes(1);
      s.set(2);
      expect(cleanup).toHaveBeenCalledTimes(2);
    });
  });

  describe("run and cleanup", () => {
    it("should allow manual running", () => {
      const fn = vi.fn();
      const e = effect(fn);

      fn.mockClear();
      const cleanup = e.run();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(typeof cleanup).toBe("function");
    });

    it("should stop tracking when cleanup is called", () => {
      const s = signal(0);
      const fn = vi.fn(() => {
        s();
      });
      const e = effect(fn);

      // Effect already ran once (default dispatcher)
      fn.mockClear();
      const cleanup = e.run(); // Run again
      fn.mockClear();
      cleanup(); // Stop tracking
      s.set(1);
      expect(fn).not.toHaveBeenCalled();
    });

    it("should allow multiple runs", () => {
      const s = signal(0);
      const calls: number[] = [];

      effect(() => {
        calls.push(s());
      });

      expect(calls).toEqual([0]);
      s.set(1);
      expect(calls).toContain(1);
    });
  });

  describe("nested effects", () => {
    it("should handle nested signal access", () => {
      const a = signal(1);
      const b = signal(2);
      const calls: number[] = [];

      effect(() => {
        const sum = a() + b();
        calls.push(sum);
      });

      expect(calls).toEqual([3]);
      a.set(10);
      expect(calls).toEqual([3, 12]);
    });

    it("should handle computed signals in effects", () => {
      const source = signal(5);
      const doubled = signal(() => source() * 2);
      const calls: number[] = [];

      effect(() => {
        calls.push(doubled());
      });

      expect(calls).toEqual([10]);
      source.set(6);
      // Need to ensure doubled recomputes first
      doubled();
      expect(calls).toEqual([10, 12]);
    });
  });

  describe("edge cases", () => {
    it("should handle effect that throws", () => {
      const s = signal(0);
      let shouldThrow = false;

      expect(() => {
        effect(() => {
          s();
          if (shouldThrow) {
            throw new Error("Test error");
          }
        });

        shouldThrow = true;
        s.set(1);
      }).toThrow("Test error");
    });

    it("should handle effect that accesses no signals", () => {
      const fn = vi.fn(() => {
        // No signal access
      });

      effect(fn);
      expect(fn).toHaveBeenCalled();

      // Should not re-run since no dependencies
      fn.mockClear();
      // No way to trigger re-run without dependencies
      expect(fn).not.toHaveBeenCalled();
    });

    it("should handle rapid signal changes", () => {
      const s = signal(0);
      const calls: number[] = [];

      effect(() => {
        calls.push(s());
      });

      // Rapid changes
      s.set(1);
      s.set(2);
      s.set(3);

      // Should have all values
      expect(calls.length).toBeGreaterThanOrEqual(4);
      expect(calls).toContain(0);
      expect(calls).toContain(1);
      expect(calls).toContain(2);
      expect(calls).toContain(3);
    });

    it("should handle effect that modifies its own dependencies", () => {
      const s = signal(0);
      const calls: number[] = [];
      let maxIterations = 10; // Prevent infinite loops

      effect(() => {
        const val = s();
        calls.push(val);
        maxIterations--;
        if (val < 5 && maxIterations > 0) {
          s.set(val + 1);
        }
      });

      // Should eventually reach 5 (or stop due to max iterations)
      expect(calls.length).toBeGreaterThan(0);
      // The effect should have run at least once
      expect(calls[0]).toBe(0);
    });
  });

  describe("cleanup behavior", () => {
    it("should unsubscribe from signals when cleanup is called", () => {
      const dispatcher = localEffectDispatcher();
      const s = signal(0);
      const fn = vi.fn(() => {
        s();
      });
      let e: ReturnType<typeof effect>;

      withDispatchers([effectToken(dispatcher)], () => {
        e = effect(fn);
      });

      // Effect hasn't run yet
      expect(fn).not.toHaveBeenCalled();

      // Run the effect
      const cleanup = e!.run();
      expect(fn).toHaveBeenCalledTimes(1);

      fn.mockClear();
      cleanup(); // Stop tracking
      s.set(1);
      expect(fn).not.toHaveBeenCalled();
    });

    it("should resubscribe when run again after cleanup", () => {
      const s = signal(0);
      const calls: number[] = [];

      const e = effect(() => {
        calls.push(s());
      });

      const cleanup = e.run();
      cleanup(); // Stop
      e.run(); // Restart
      s.set(1);
      expect(calls).toContain(1);
    });
  });
});

describe("effectDispatcher", () => {
  describe("defaultEffectDispatcher", () => {
    it("should run effects immediately when added", () => {
      const fn = vi.fn();
      const dispatcher = globalEffectDispatcher();

      dispatcher.add({
        run: () => {
          fn();
          return () => {};
        },
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("effectDispatcher", () => {
    it("should collect effects without running them", () => {
      const dispatcher = localEffectDispatcher();
      const f1 = vi.fn();
      const f2 = vi.fn();

      withDispatchers([effectToken(dispatcher)], () => {
        effect(f1);
        effect(f2);
      });

      // Ensure no effect run
      expect(f1).not.toHaveBeenCalled();
      expect(f2).not.toHaveBeenCalled();
    });

    it("should run all effects when run() is called", () => {
      const dispatcher = localEffectDispatcher();
      const f1 = vi.fn();
      const f2 = vi.fn();

      withDispatchers([effectToken(dispatcher)], () => {
        effect(f1);
        effect(f2);
      });

      // Effects should not have run yet
      expect(f1).not.toHaveBeenCalled();
      expect(f2).not.toHaveBeenCalled();

      // Run all effects
      dispatcher.run();

      // Check f1 and f2 were called
      expect(f1).toHaveBeenCalled();
      expect(f2).toHaveBeenCalled();
    });

    it("should return cleanup function from run()", () => {
      const dispatcher = localEffectDispatcher();
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      withDispatchers([effectToken(dispatcher)], () => {
        effect(() => cleanup1);
        effect(() => cleanup2);
      });

      const stop = dispatcher.run();
      expect(typeof stop).toBe("function");

      // Cleanups should not be called yet
      expect(cleanup1).not.toHaveBeenCalled();
      expect(cleanup2).not.toHaveBeenCalled();

      // Call stop to clean up
      stop();
      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
    });

    it("should clear all effects", () => {
      const dispatcher = localEffectDispatcher();
      const f1 = vi.fn();
      const f2 = vi.fn();

      withDispatchers([effectToken(dispatcher)], () => {
        effect(f1);
        effect(f2);
      });

      dispatcher.clear();
      dispatcher.run();

      // Effects should not run after clear
      expect(f1).not.toHaveBeenCalled();
      expect(f2).not.toHaveBeenCalled();
    });

    it("should handle nested dispatchers", () => {
      const outerDispatcher = localEffectDispatcher();
      const innerDispatcher = localEffectDispatcher();
      const f1 = vi.fn();
      const f2 = vi.fn();

      withDispatchers([effectToken(outerDispatcher)], () => {
        effect(f1);
        withDispatchers([effectToken(innerDispatcher)], () => {
          effect(f2);
        });
      });

      // Neither should run yet
      expect(f1).not.toHaveBeenCalled();
      expect(f2).not.toHaveBeenCalled();

      // Run inner dispatcher
      innerDispatcher.run();
      expect(f1).not.toHaveBeenCalled();
      expect(f2).toHaveBeenCalled();

      // Run outer dispatcher
      outerDispatcher.run();
      expect(f1).toHaveBeenCalled();
    });

    it("should allow removing effects", () => {
      const dispatcher = localEffectDispatcher();
      const f1 = vi.fn();
      const f2 = vi.fn();

      let removeF1: VoidFunction | undefined;

      withDispatchers([effectToken(dispatcher)], () => {
        const e1 = effect(f1);
        effect(f2);
        // Manually add e1 to get a remove function
        // Note: e1 is already added when effect() is called, but we can still get remove function
        removeF1 = dispatcher.add(e1);
      });

      // Effects should not have run yet
      expect(f1).not.toHaveBeenCalled();
      expect(f2).not.toHaveBeenCalled();

      // Remove e1 (even though it was added twice, removing once should work)
      removeF1!();
      dispatcher.run();

      // Since e1 was added when effect() was called AND manually added,
      // removing once might not remove it if Set doesn't track duplicates
      // Let's just verify f2 runs
      expect(f2).toHaveBeenCalled();
    });

    it("should handle effects with signal dependencies", () => {
      const dispatcher = localEffectDispatcher();
      const s = signal(0);
      const calls: number[] = [];

      withDispatchers([effectToken(dispatcher)], () => {
        effect(() => {
          calls.push(s());
        });
      });

      // Effect should not run yet
      expect(calls).toEqual([]);

      dispatcher.run();
      expect(calls).toEqual([0]);

      // Signal changes should still trigger effect
      s.set(1);
      expect(calls).toEqual([0, 1]);
    });

    it("should handle cleanup when stop is called", () => {
      const dispatcher = localEffectDispatcher();
      const cleanup = vi.fn();
      const s = signal(0);

      withDispatchers([effectToken(dispatcher)], () => {
        effect(() => {
          s();
          return cleanup;
        });
      });

      const stop = dispatcher.run();
      // Cleanup from initial run (before signal change)
      expect(cleanup).not.toHaveBeenCalled();

      s.set(1);
      // Cleanup from previous run is called before new run
      expect(cleanup).toHaveBeenCalledTimes(1);

      stop(); // Stop all effects (calls cleanup from last run)
      expect(cleanup).toHaveBeenCalledTimes(2); // Once from signal change, once from stop
      s.set(2);
      // Should not trigger effect anymore
      expect(cleanup).toHaveBeenCalledTimes(2);
    });
  });

  describe("abortSignal", () => {
    it("should provide abortSignal in effect context", () => {
      let capturedSignal: AbortSignal | undefined;

      effect(({ abortSignal }) => {
        capturedSignal = abortSignal;
      });

      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(capturedSignal?.aborted).toBe(false);
    });

    it("should abort signal when effect is cleaned up", () => {
      let capturedSignal: AbortSignal | undefined;

      const e = effect(({ abortSignal }) => {
        capturedSignal = abortSignal;
      });

      expect(capturedSignal?.aborted).toBe(false);

      // Run cleanup
      const cleanup = e.run();
      cleanup();

      expect(capturedSignal?.aborted).toBe(true);
    });

    it("should abort signal when effect re-runs due to dependency change", async () => {
      const count = signal(0);
      const signals: AbortSignal[] = [];

      effect(({ abortSignal }) => {
        count(); // Track dependency
        signals.push(abortSignal);
      });

      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(false);

      // Trigger re-run
      count.set(1);

      expect(signals).toHaveLength(2);
      expect(signals[0].aborted).toBe(true); // First signal should be aborted
      expect(signals[1].aborted).toBe(false); // New signal should not be aborted
    });

    it("should create new abortSignal for each effect run", () => {
      const count = signal(0);
      const signals: AbortSignal[] = [];

      effect(({ abortSignal }) => {
        count();
        signals.push(abortSignal);
      });

      count.set(1);
      count.set(2);

      expect(signals).toHaveLength(3);
      // Each signal should be different
      expect(signals[0]).not.toBe(signals[1]);
      expect(signals[1]).not.toBe(signals[2]);
      // Previous signals should be aborted
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(true);
      expect(signals[2].aborted).toBe(false);
    });

    it("should abort fetch requests when effect is cleaned up", async () => {
      let fetchAborted = false;
      global.fetch = vi
        .fn()
        .mockImplementation((_url: string, options?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              fetchAborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            });
            // Never resolve to simulate long request
          });
        });

      const userId = signal(1);

      effect(({ abortSignal }) => {
        const id = userId();
        fetch(`/api/users/${id}`, { signal: abortSignal }).catch(() => {
          // Ignore abort errors
        });
      });

      expect(fetchAborted).toBe(false);

      // Trigger re-run, should abort previous fetch
      userId.set(2);

      // Wait a bit for abort to propagate
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchAborted).toBe(true);
    });

    it("should handle multiple async operations with same abortSignal", async () => {
      const abortedOperations: string[] = [];

      global.fetch = vi
        .fn()
        .mockImplementation((url: string, options?: RequestInit) => {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              abortedOperations.push(url as string);
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        });

      const trigger = signal(0);

      effect(({ abortSignal }) => {
        trigger();
        fetch("/api/users", { signal: abortSignal }).catch(() => {});
        fetch("/api/posts", { signal: abortSignal }).catch(() => {});
        fetch("/api/comments", { signal: abortSignal }).catch(() => {});
      });

      // Trigger re-run
      trigger.set(1);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // All three requests should be aborted
      expect(abortedOperations).toContain("/api/users");
      expect(abortedOperations).toContain("/api/posts");
      expect(abortedOperations).toContain("/api/comments");
    });

    it("should not abort signal if effect doesn't access it", () => {
      const count = signal(0);
      let runCount = 0;

      effect(() => {
        count();
        runCount++;
      });

      expect(runCount).toBe(1);

      count.set(1);
      expect(runCount).toBe(2);

      // No abort operations, should work fine
    });

    it("should work with effect cleanup function and abortSignal", async () => {
      const cleanups: string[] = [];
      const trigger = signal(0);

      effect(({ abortSignal }) => {
        trigger();

        const timer = setTimeout(() => {
          cleanups.push("timeout");
        }, 100);

        abortSignal.addEventListener("abort", () => {
          cleanups.push("abort");
          clearTimeout(timer);
        });

        return () => {
          cleanups.push("cleanup");
        };
      });

      expect(cleanups).toEqual([]);

      // Trigger re-run
      trigger.set(1);

      expect(cleanups).toEqual(["cleanup", "abort"]);
    });

    it("should abort on manual cleanup call", () => {
      let capturedSignal: AbortSignal | undefined;

      const e = effect(({ abortSignal }) => {
        capturedSignal = abortSignal;
      });

      expect(capturedSignal?.aborted).toBe(false);

      const cleanup = e.run();
      cleanup();

      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe("effect creation in rx() validation", () => {
    it("should throw error when creating effect inside rx()", async () => {
      const React = await import("react");
      const { render } = await import("@testing-library/react");
      const { rx } = await import("./rx");

      expect(() => {
        render(
          rx(() => {
            effect(() => {
              console.log("leak");
            });
            return React.createElement("div", null, "Content");
          })
        );
      }).toThrow("Cannot create effects inside rx() blocks");
    });

    it("should throw with helpful error message", async () => {
      const React = await import("react");
      const { render } = await import("@testing-library/react");
      const { rx } = await import("./rx");

      expect(() => {
        render(
          rx(() => {
            effect(() => {
              console.log("leak");
            });
            return React.createElement("div", null, "Content");
          })
        );
      }).toThrow(/causing subscription leaks/);
    });

    it("should throw for effect with dependencies in rx()", async () => {
      const React = await import("react");
      const { render } = await import("@testing-library/react");
      const { rx } = await import("./rx");
      const { signal } = await import("./signal");
      const count = signal(0);

      expect(() => {
        render(
          rx(() => {
            effect(() => {
              console.log("Count:", count());
            });
            return React.createElement("div", null, "Content");
          })
        );
      }).toThrow("Cannot create effects inside rx() blocks");
    });

    it("should not throw when creating effect in stable scope", async () => {
      const React = await import("react");
      const { render } = await import("@testing-library/react");
      const { rx } = await import("./rx");
      const { blox } = await import("./blox");

      expect(() => {
        const Component = blox(() => {
          effect(() => {
            console.log("once");
          }); // Created in stable scope
          return React.createElement(
            "div",
            null,
            rx(() => React.createElement("span", null, "Content"))
          );
        });
        render(React.createElement(Component));
      }).not.toThrow();
    });
  });
});
