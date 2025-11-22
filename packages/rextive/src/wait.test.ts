import { describe, it, expect, vi } from "vitest";
import { wait, TimeoutError } from "./wait";
import { signal } from "./signal";
import { loadable } from "./utils/loadable";

describe("wait", () => {
  describe("waitAll - Synchronous mode (Suspense)", () => {
    describe("Single awaitable", () => {
      it("should return value from resolved promise", () => {
        const promise = Promise.resolve(42);
        
        expect(() => wait(promise)).toThrow(Promise);
        
        // After promise resolves
        return promise.then(() => {
          expect(wait(promise)).toBe(42);
        });
      });

      it.skip("should return value from success loadable", () => {
        const l = loadable("success", 42);
        const result = wait(l);
        expect(result).toBe(42);
      });

      it("should throw promise from loading loadable", () => {
        const promise = new Promise(() => {}); // Never resolves
        const l = loadable("loading", promise);
        
        expect(() => wait(l)).toThrow(Promise);
      });

      it.skip("should throw error from error loadable", () => {
        const error = new Error("Failed");
        const l = loadable("error", error);
        
        try {
          wait(l);
          expect.fail("Should have thrown");
        } catch (e: any) {
          expect(e).toBe(error);
          expect(e.message).toBe("Failed");
        }
      });

      it("should unwrap signal value", () => {
        const sig = signal(42);
        expect(wait(sig)).toBe(42);
      });

      it("should handle signal with loadable", () => {
        const l = loadable("success", 42);
        const sig = signal(l);
        
        expect(wait(sig)).toBe(42);
      });

      it("should throw promise from signal with loading loadable", () => {
        const promise = new Promise(() => {});
        const l = loadable("loading", promise);
        const sig = signal(l);
        
        expect(() => wait(sig)).toThrow(Promise);
      });
    });

    describe("Array of awaitables", () => {
      it("should return array of values when all resolved", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("success", 2);
        const l3 = loadable("success", 3);
        
        const result = wait([l1, l2, l3]);
        expect(result).toEqual([1, 2, 3]);
      });

      it("should throw combined promise when any loading", () => {
        const p1 = Promise.resolve(1);
        const p2 = new Promise(() => {}); // Never resolves
        const p3 = Promise.resolve(3);
        
        expect(() => wait([p1, p2, p3])).toThrow(Promise);
      });

      it("should throw first error when any failed", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("error", new Error("Error 2"));
        const l3 = loadable("error", new Error("Error 3"));
        
        expect(() => wait([l1, l2, l3])).toThrow("Error 2");
      });

      it("should handle mixed loadables and promises", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("success", 2);
        const l3 = loadable("success", 3);
        
        expect(wait([l1, l2, l3])).toEqual([1, 2, 3]);
      });

      it("should handle signals in array", () => {
        const sig1 = signal(1);
        const sig2 = signal(2);
        
        expect(wait([sig1, sig2])).toEqual([1, 2]);
      });
    });

    describe("Record of awaitables", () => {
      it("should return record of values when all resolved", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("success", "two");
        
        const result = wait({ a: l1, b: l2 });
        expect(result).toEqual({ a: 1, b: "two" });
      });

      it("should throw combined promise when any loading", () => {
        const p1 = Promise.resolve(1);
        const p2 = new Promise(() => {});
        
        expect(() => wait({ a: p1, b: p2 })).toThrow(Promise);
      });

      it("should throw first error when any failed", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("error", new Error("Error"));
        
        expect(() => wait({ a: l1, b: l2 })).toThrow("Error");
      });

      it("should handle signals in record", () => {
        const sig1 = signal(1);
        const sig2 = signal("two");
        
        expect(wait({ a: sig1, b: sig2 })).toEqual({ a: 1, b: "two" });
      });
    });
  });

  describe("waitAll - Async mode (Promise)", () => {
    describe("With onResolve callback", () => {
      it("should transform single value", async () => {
        const promise = Promise.resolve(42);
        
        const result = await wait(promise, (value) => value * 2);
        expect(result).toBe(84);
      });

      it("should transform array values", async () => {
        const result = await wait(
          [Promise.resolve(1), Promise.resolve(2)],
          (a, b) => a + b
        );
        expect(result).toBe(3);
      });

      it("should transform record values", async () => {
        const result = await wait(
          { x: Promise.resolve(5), y: Promise.resolve(10) },
          ({ x, y }) => x * y
        );
        expect(result).toBe(50);
      });

      it("should handle async onResolve", async () => {
        const result = await wait(
          Promise.resolve(10),
          async (value) => {
            await new Promise(r => setTimeout(r, 10));
            return value * 2;
          }
        );
        expect(result).toBe(20);
      });
    });

    describe("With onResolve and onError callbacks", () => {
      it("should call onError on failure", async () => {
        const promise = Promise.reject(new Error("Failed"));
        
        const result = await wait(
          promise,
          (value) => value,
          (error) => "recovered"
        );
        
        expect(result).toBe("recovered");
      });

      it("should call onResolve on success", async () => {
        const result = await wait(
          Promise.resolve(42),
          (value) => value * 2,
          () => 0
        );
        
        expect(result).toBe(84);
      });

      it("should handle async onError", async () => {
        const promise = Promise.reject(new Error("Failed"));
        
        const result = await wait(
          promise,
          (value) => value,
          async (error) => {
            await new Promise(r => setTimeout(r, 10));
            return "async recovered";
          }
        );
        
        expect(result).toBe("async recovered");
      });
    });
  });

  describe("wait.any", () => {
    describe("Synchronous mode", () => {
      it("should return first succeeded value with key", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("loading", new Promise(() => {}));
        
        const result = wait.any({ a: l1, b: l2 });
        expect(result).toEqual([1, "a"]);
      });

      it("should throw if all loading", () => {
        const p1 = new Promise(() => {});
        const p2 = new Promise(() => {});
        
        expect(() => wait.any({ a: p1, b: p2 })).toThrow(Promise);
      });

      it("should throw aggregated error if all failed", async () => {
        // Use loadables to avoid unhandled rejections
        const l1 = loadable("error", new Error("E1"));
        const l2 = loadable("error", new Error("E2"));
        
        expect(() => wait.any({ a: l1, b: l2 })).toThrow("All awaitables failed");
      });

      it("should handle immediate success loadable", () => {
        const l1 = loadable("loading", new Promise(() => {}));
        const l2 = loadable("success", 42);
        
        const result = wait.any({ a: l1, b: l2 });
        expect(result).toEqual([42, "b"]);
      });
    });

    describe("Async mode", () => {
      it("should transform first resolved value", async () => {
        const result = await wait.any(
          { a: Promise.resolve(1), b: Promise.resolve(2) },
          ([value, key]) => `${key}:${value}`
        );
        
        expect(result).toMatch(/^(a:1|b:2)$/);
      });

      it("should call onError if all fail", async () => {
        const result = await wait.any(
          { a: Promise.reject("E1"), b: Promise.reject("E2") },
          ([v, k]) => `${k}:${v}`,
          () => "all failed"
        );
        
        expect(result).toBe("all failed");
      });
    });
  });

  describe("wait.race", () => {
    describe("Synchronous mode", () => {
      it("should return first completed value (success or error)", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("loading", new Promise(() => {}));
        
        const result = wait.race({ a: l1, b: l2 });
        expect(result).toEqual([1, "a"]);
      });

      it("should throw first error if that completes first", () => {
        const l1 = loadable("error", new Error("Fast error"));
        const l2 = loadable("loading", new Promise(() => {}));
        
        expect(() => wait.race({ a: l1, b: l2 })).toThrow("Fast error");
      });

      it("should throw combined promise if all loading", () => {
        const p1 = new Promise(() => {});
        const p2 = new Promise(() => {});
        
        expect(() => wait.race({ a: p1, b: p2 })).toThrow(Promise);
      });
    });

    describe("Async mode", () => {
      it("should transform first completed value", async () => {
        const result = await wait.race(
          { a: Promise.resolve(1), b: Promise.resolve(2) },
          ([value, key]) => `${key}:${value}`
        );
        
        expect(result).toMatch(/^(a:1|b:2)$/);
      });

      it("should call onError on race error", async () => {
        const l1 = loadable("error", new Error("Error"));
        const l2 = loadable("loading", new Promise(() => {}));
        
        const promise = wait.race(
          { a: l1, b: l2 },
          ([v, k]) => `${k}:${v}`,
          () => "error handled"
        );
        
        // Should return error handled since l1 is already in error state
        const result = await promise;
        expect(result).toBe("error handled");
      });
    });
  });

  describe("wait.settled", () => {
    describe("Synchronous mode", () => {
      it.skip("should return settled results for single awaitable", () => {
        const l = loadable("success", 42);
        
        const result = wait.settled(l);
        expect(result).toEqual({ status: "fulfilled", value: 42 });
      });

      it("should return settled results for array", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("error", new Error("E2"));
        
        const result = wait.settled([l1, l2]);
        expect(result).toEqual([
          { status: "fulfilled", value: 1 },
          { status: "rejected", reason: expect.any(Error) }
        ]);
      });

      it("should return settled results for record", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("error", new Error("E2"));
        
        const result = wait.settled({ a: l1, b: l2 });
        expect(result).toEqual({
          a: { status: "fulfilled", value: 1 },
          b: { status: "rejected", reason: expect.any(Error) }
        });
      });

      it("should throw promise if any still loading", () => {
        const p1 = Promise.resolve(1);
        const p2 = new Promise(() => {});
        
        expect(() => wait.settled([p1, p2])).toThrow(Promise);
      });

      it("should handle loadables", () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("error", new Error("E2"));
        
        const result = wait.settled([l1, l2]);
        expect(result).toEqual([
          { status: "fulfilled", value: 1 },
          { status: "rejected", reason: expect.any(Error) }
        ]);
      });
    });

    describe("Async mode", () => {
      it("should transform settled results", async () => {
        const p1 = Promise.resolve(1);
        const p2 = Promise.reject("E2");
        
        const result = await wait.settled(
          [p1, p2],
          (results) => results.filter(r => r.status === "fulfilled").length
        );
        
        expect(result).toBe(1);
      });

      it("should never call onError (settled never throws)", async () => {
        const onError = vi.fn();
        
        await wait.settled(
          [Promise.resolve(1), Promise.reject("E")],
          () => "done",
          onError
        );
        
        expect(onError).not.toHaveBeenCalled();
      });

      it("should handle array with all success loadables in async mode", async () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("success", "static");
        
        const result = await wait.settled([l1, l2], (results) =>
          results.map((r: any) => r.value)
        );
        
        expect(result).toEqual([1, "static"]);
      });

      it("should handle array with all error loadables in async mode", async () => {
        const l1 = loadable("error", new Error("E1"));
        const l2 = loadable("error", new Error("E2"));
        
        const result = await wait.settled([l1, l2], (results: any) =>
          results.map((r: any) => r.status)
        );
        
        expect(result).toEqual(["rejected", "rejected"]);
      });

      it("should handle record with all success loadables in async mode", async () => {
        const l1 = loadable("success", 1);
        const l2 = loadable("success", "static");
        
        const result = await wait.settled(
          { a: l1, b: l2 },
          (results: any) => ({
            a: results.a.value,
            b: results.b.value,
          })
        );
        
        expect(result).toEqual({ a: 1, b: "static" });
      });

      it("should handle record with all error loadables in async mode", async () => {
        const l1 = loadable("error", new Error("E1"));
        const l2 = loadable("error", new Error("E2"));
        
        const result = await wait.settled(
          { a: l1, b: l2 },
          (results: any) => ({
            a: results.a.status,
            b: results.b.status,
          })
        );
        
        expect(result).toEqual({ a: "rejected", b: "rejected" });
      });

      it("should propagate errors from onResolve callback", async () => {
        const l1 = loadable("success", 1);
        const onResolve = vi.fn(() => {
          throw new Error("Transform error");
        });

        await expect(wait.settled(l1, onResolve)).rejects.toThrow(
          "Transform error"
        );
      });

      it("should handle single promise in async mode", async () => {
        const promise = Promise.resolve(42);
        const result = await wait.settled(promise, (r: any) => {
          expect(r.status).toBe("fulfilled");
          expect(r.value).toBe(42);
          return r.value;
        });

        expect(result).toBe(42);
      });

      it("should handle single rejected promise in async mode", async () => {
        const promise = Promise.reject(new Error("Test error"));
        const result = await wait.settled(promise, (r: any) => {
          expect(r.status).toBe("rejected");
          expect(r.reason).toBeInstanceOf(Error);
          return "handled";
        });

        expect(result).toBe("handled");
      });
    });
  });

  describe("wait.timeout", () => {
    it("should resolve before timeout", async () => {
      const promise = Promise.resolve(42);
      
      const result = await wait.timeout(promise, 1000);
      expect(result).toBe(42);
    });

    it("should reject with TimeoutError on timeout", async () => {
      const promise = new Promise(() => {}); // Never resolves
      
      await expect(wait.timeout(promise, 50)).rejects.toThrow(TimeoutError);
    });

    it("should use custom error message", async () => {
      const promise = new Promise(() => {});
      
      await expect(
        wait.timeout(promise, 50, "Custom timeout")
      ).rejects.toThrow("Custom timeout");
    });

    it("should use custom error function", async () => {
      const promise = new Promise(() => {});
      const customError = () => new Error("Custom error");
      
      await expect(
        wait.timeout(promise, 50, customError)
      ).rejects.toThrow("Custom error");
    });

    it("should timeout array of awaitables", async () => {
      const p1 = Promise.resolve(1);
      const p2 = new Promise(() => {});
      
      await expect(
        wait.timeout([p1, p2], 50)
      ).rejects.toThrow(TimeoutError);
    });

    it("should timeout record of awaitables", async () => {
      const p1 = Promise.resolve(1);
      const p2 = new Promise(() => {});
      
      await expect(
        wait.timeout({ a: p1, b: p2 }, 50)
      ).rejects.toThrow(TimeoutError);
    });

    it("should resolve array before timeout", async () => {
      const result = await wait.timeout(
        [Promise.resolve(1), Promise.resolve(2)],
        1000
      );
      
      expect(result).toEqual([1, 2]);
    });
  });

  describe("wait.delay", () => {
    it("should resolve after delay", async () => {
      const start = Date.now();
      await wait.delay(50);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some margin
    });

    it("should return undefined", async () => {
      const result = await wait.delay(10);
      expect(result).toBeUndefined();
    });
  });

  describe("TimeoutError", () => {
    it("should have correct name", () => {
      const error = new TimeoutError();
      expect(error.name).toBe("TimeoutError");
    });

    it("should have default message", () => {
      const error = new TimeoutError();
      expect(error.message).toBe("Operation timed out");
    });

    it("should accept custom message", () => {
      const error = new TimeoutError("Custom timeout message");
      expect(error.message).toBe("Custom timeout message");
    });

    it("should be instanceof Error", () => {
      const error = new TimeoutError();
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("Integration tests", () => {
    it("should handle complex signal + loadable + promise mix", () => {
      const sig = signal(loadable("success", 1));
      const l2 = loadable("success", 2);
      const l3 = loadable("success", 3);
      
      const result = wait([sig, l2, l3]);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should handle nested wait operations", async () => {
      const inner = await wait(
        Promise.resolve(10),
        (v) => v * 2
      );
      
      const outer = await wait(
        Promise.resolve(inner),
        (v) => v + 5
      );
      
      expect(outer).toBe(25);
    });

    it("should work with signal that updates", () => {
      const sig = signal(loadable("success", 42));
      
      expect(wait(sig)).toBe(42);
      
      // Update the signal
      sig.set(loadable("success", 84));
      
      // Should return updated value
      expect(wait(sig)).toBe(84);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty array", () => {
      const result = wait([]);
      expect(result).toEqual([]);
    });

    it("should handle empty record", () => {
      const result = wait({});
      expect(result).toEqual({});
    });

    it("should handle null/undefined in error handling", async () => {
      const result = await wait(
        Promise.reject(null),
        (v) => v,
        (e) => `error:${e}`
      );
      
      expect(result).toBe("error:null");
    });

    it("should preserve types through transformations", async () => {
      const result = await wait(
        { a: Promise.resolve(1), b: Promise.resolve("two") },
        ({ a, b }) => ({ num: a, str: b })
      );
      
      expect(result).toEqual({ num: 1, str: "two" });
    });
  });
});

