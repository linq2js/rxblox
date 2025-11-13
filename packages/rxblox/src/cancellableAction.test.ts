import { describe, it, expect, vi } from "vitest";
import { action } from "./index";
import { aborter } from "./cancellableAction";

describe("action.cancellable", () => {
  describe("basic functionality", () => {
    it("should create a cancellable action", () => {
      const fetchData = action.cancellable(
        async (_signal: AbortSignal, id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `data-${id}`;
        }
      );

      expect(fetchData.status).toBe("idle");
      expect(fetchData.cancelled).toBe(false);
    });

    it("should provide AbortSignal to the function", async () => {
      const signalSpy = vi.fn();
      const fetchData = action.cancellable(
        async (signal: AbortSignal, id: number) => {
          signalSpy(signal);
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `data-${id}`;
        }
      );

      await fetchData(123);
      expect(signalSpy).toHaveBeenCalledWith(expect.any(AbortSignal));
    });

    it("should cancel the action", async () => {
      let abortedDuringExecution = false;

      const fetchData = action.cancellable(
        async (signal: AbortSignal, id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          abortedDuringExecution = signal.aborted;
          return `data-${id}`;
        }
      );

      const promise = fetchData(123);
      expect(fetchData.status).toBe("loading");
      expect(fetchData.cancelled).toBe(false);

      // Cancel mid-flight
      fetchData.cancel();
      expect(fetchData.cancelled).toBe(true);

      await promise;
      expect(abortedDuringExecution).toBe(true);
    });

    it("should work with fetch() and AbortSignal", async () => {
      (globalThis as any).fetch = vi.fn(async (_url, options?: any) => {
        // Simulate fetch with signal
        if (options?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        await new Promise((resolve) => setTimeout(resolve, 50));

        if (options?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        return {
          ok: true,
          json: async () => ({ id: 123, name: "John" }),
        };
      });

      const fetchUser = action.cancellable(
        async (signal: AbortSignal, userId: number) => {
          const response: any = await fetch(`/api/users/${userId}`, {
            signal,
          });
          return response.json();
        }
      );

      const promise = fetchUser(123);
      fetchUser.cancel();

      // The fetch should eventually throw AbortError
      // (in real browser, this would happen immediately)
      await expect(promise).rejects.toThrow();
    });

    it("should reset AbortSignal for each new call", async () => {
      const signals: AbortSignal[] = [];

      const fetchData = action.cancellable(
        async (signal: AbortSignal, id: number) => {
          signals.push(signal);
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `data-${id}`;
        }
      );

      await fetchData(1);
      await fetchData(2);
      await fetchData(3);

      expect(signals).toHaveLength(3);
      expect(signals[0]).not.toBe(signals[1]);
      expect(signals[1]).not.toBe(signals[2]);
    });

    it("should abort previous call when new call is made", async () => {
      const signals: AbortSignal[] = [];

      const fetchData = action.cancellable(
        async (signal: AbortSignal, id: number) => {
          signals.push(signal);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return `data-${id}`;
        }
      );

      fetchData(1);
      const promise2 = fetchData(2);

      // First signal should be aborted when second call starts
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);

      await promise2;
    });
  });

  describe("event callbacks", () => {
    it("should call callbacks with error when cancelled", async () => {
      const errorSpy = vi.fn();
      const doneSpy = vi.fn();

      const fetchData = action.cancellable(
        async (signal: AbortSignal, id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          if (signal.aborted) {
            throw new Error("Cancelled");
          }
          return `data-${id}`;
        },
        {
          on: {
            error: errorSpy,
            done: doneSpy,
          },
        }
      );

      const promise = fetchData(123);
      fetchData.cancel();

      await expect(promise).rejects.toThrow("Cancelled");
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(doneSpy).toHaveBeenCalledWith(expect.any(Error), undefined);
    });

    it("should call init callback on each invocation", () => {
      const initSpy = vi.fn();

      const fetchData = action.cancellable(
        async (_signal: AbortSignal, id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `data-${id}`;
        },
        { on: { init: initSpy } }
      );

      fetchData(1);
      expect(initSpy).toHaveBeenCalledTimes(1);

      fetchData(2);
      expect(initSpy).toHaveBeenCalledTimes(2);
    });

    it("should call success callback when not cancelled", async () => {
      const successSpy = vi.fn();

      const fetchData = action.cancellable(
        async (_signal: AbortSignal, id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `data-${id}`;
        },
        { on: { success: successSpy } }
      );

      await fetchData(123);
      expect(successSpy).toHaveBeenCalledWith("data-123");
    });
  });

  describe("status tracking", () => {
    it("should track status correctly", async () => {
      const fetchData = action.cancellable(
        async (_signal: AbortSignal, id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `data-${id}`;
        }
      );

      expect(fetchData.status).toBe("idle");

      const promise = fetchData(123);
      expect(fetchData.status).toBe("loading");

      const result = await promise;
      expect(result).toBe("data-123");
      expect(fetchData.status).toBe("success");
      expect(fetchData.result).toBe("data-123");
    });

    it("should track error status", async () => {
      const fetchData = action.cancellable(
        async (_signal: AbortSignal, _id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error("fetch failed");
        }
      );

      await expect(fetchData(123)).rejects.toThrow("fetch failed");
      expect(fetchData.status).toBe("error");
      expect(fetchData.error).toBeInstanceOf(Error);
    });

    it("should track calls correctly", async () => {
      const fetchData = action.cancellable(
        async (_signal: AbortSignal, id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `data-${id}`;
        }
      );

      expect(fetchData.calls).toBe(0);

      await fetchData(1);
      expect(fetchData.calls).toBe(1);

      await fetchData(2);
      expect(fetchData.calls).toBe(2);

      fetchData.reset();
      expect(fetchData.calls).toBe(0);
    });

    it("should reset properly", async () => {
      const fetchData = action.cancellable(
        async (_signal: AbortSignal, id: number) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `data-${id}`;
        }
      );

      await fetchData(123);
      expect(fetchData.status).toBe("success");
      expect(fetchData.result).toBe("data-123");
      expect(fetchData.calls).toBe(1);

      fetchData.reset();
      expect(fetchData.status).toBe("idle");
      expect(fetchData.result).toBeUndefined();
      expect(fetchData.calls).toBe(0);
      expect(fetchData.cancelled).toBe(false);
    });
  });

  describe("with multiple arguments", () => {
    it("should handle multiple arguments", async () => {
      const concat = action.cancellable(
        async (_signal: AbortSignal, a: string, b: string, c: string) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `${a}-${b}-${c}`;
        }
      );

      const result = await concat("hello", "world", "test");
      expect(result).toBe("hello-world-test");
      expect(concat.result).toBe("hello-world-test");
    });
  });

  describe("practical use cases", () => {
    it("should handle debounced search", async () => {
      const searchResults = action.cancellable(
        async (signal: AbortSignal, query: string) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (signal.aborted) {
            throw new Error("Aborted");
          }
          return `Results for: ${query}`;
        }
      );

      // Simulate rapid typing
      const promise1 = searchResults("h");
      const promise2 = searchResults("he");
      const promise3 = searchResults("hel");
      const promise4 = searchResults("hello");

      // Only the last one should complete successfully
      await expect(promise1).rejects.toThrow();
      await expect(promise2).rejects.toThrow();
      await expect(promise3).rejects.toThrow();

      const result = await promise4;
      expect(result).toBe("Results for: hello");
      expect(searchResults.result).toBe("Results for: hello");
    });

    it("should handle file upload cancellation", async () => {
      const uploadFile = action.cancellable(
        async (signal: AbortSignal, file: { name: string; size: number }) => {
          let progress = 0;
          while (progress < 100) {
            if (signal.aborted) {
              throw new Error("Upload cancelled");
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
            progress += 10;
          }
          return { uploaded: true, file: file.name };
        }
      );

      const promise = uploadFile({ name: "large-file.pdf", size: 1000000 });

      // Cancel after a short delay
      setTimeout(() => uploadFile.cancel(), 25);

      await expect(promise).rejects.toThrow("Upload cancelled");
      expect(uploadFile.status).toBe("error");
    });
  });

  describe("aborter", () => {
    it("should create an AbortController wrapper", () => {
      const ac = aborter();

      expect(ac.signal).toBeInstanceOf(AbortSignal);
      expect(ac.signal.aborted).toBe(false);
    });

    it("should abort the signal", () => {
      const ac = aborter();

      ac.abort();
      expect(ac.signal.aborted).toBe(true);
    });

    it("should reset to a new AbortController", () => {
      const ac = aborter();
      const firstSignal = ac.signal;

      ac.abort();
      expect(firstSignal.aborted).toBe(true);

      ac.reset();
      const secondSignal = ac.signal;

      expect(secondSignal).not.toBe(firstSignal);
      expect(secondSignal.aborted).toBe(false);
      expect(firstSignal.aborted).toBe(true); // Old signal still aborted
    });
  });
});
