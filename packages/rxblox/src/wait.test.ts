import { describe, it, expect, vi } from "vitest";
import { wait } from "./wait";
import { delay } from "./delay";
import { asyncSignal } from "./asyncSignal";

describe("wait.timeout", () => {
  describe("with single awaitable", () => {
    it("should return value if already resolved", async () => {
      const count = asyncSignal(async () => 42);

      // Wait for count to resolve
      while (count().status === "loading") {
        await delay(10);
      }

      const result = asyncSignal(() => wait.timeout(count, 1000));

      // Wait for result to resolve
      while (result().status === "loading") {
        await delay(10);
      }

      expect(result().status).toBe("success");
      expect(result().value).toBe(42);
    });
  });

  describe("with array of awaitables", () => {
    it("should return all values if already resolved", async () => {
      const s1 = asyncSignal(async () => 1);
      const s2 = asyncSignal(async () => 2);

      // Wait for signals to resolve
      while (s1().status === "loading" || s2().status === "loading") {
        await delay(10);
      }

      const result = asyncSignal(() => wait.timeout([s1, s2], 1000));

      // Wait for result to resolve
      while (result().status === "loading") {
        await delay(10);
      }

      expect(result().status).toBe("success");
      expect(result().value).toEqual([1, 2]);
    });
  });

  describe("with record of awaitables", () => {
    it("should return record of values if already resolved", async () => {
      const s1 = asyncSignal(async () => 1);
      const s2 = asyncSignal(async () => 2);

      // Wait for signals to resolve
      while (s1().status === "loading" || s2().status === "loading") {
        await delay(10);
      }

      const result = asyncSignal(() => wait.timeout({ a: s1, b: s2 }, 1000));

      // Wait for result to resolve
      while (result().status === "loading") {
        await delay(10);
      }

      expect(result().status).toBe("success");
      expect(result().value).toEqual({ a: 1, b: 2 });
    });
  });
});

describe("wait.fallback", () => {
  it("should return result and undefined error on success", () => {
    const [result, error] = wait.fallback(() => 42, 0);
    expect(result).toBe(42);
    expect(error).toBeUndefined();
  });

  it("should return fallback and error on sync failure", () => {
    const err = new Error("Failed");
    const [result, error] = wait.fallback(() => {
      throw err;
    }, 99);
    expect(result).toBe(99);
    expect(error).toBe(err);
  });

  it("should handle async signal success", async () => {
    const dataSignal = asyncSignal(async () => 42);

    // Wait for signal to resolve
    while (dataSignal().status === "loading") {
      await delay(10);
    }

    // Call the signal to get the loadable
    const [result, error] = wait.fallback(() => dataSignal(), 0);
    expect(result).toBe(42);
    expect(error).toBeUndefined();
  });

  it("should handle async signal error", async () => {
    const err = new Error("Failed");
    const dataSignal = asyncSignal(async () => {
      throw err;
    });

    // Wait for signal to error
    while (dataSignal().status === "loading") {
      await delay(10);
    }

    // Call the signal to get the loadable
    const [result, error] = wait.fallback(() => dataSignal(), 99);
    expect(result).toBe(99);
    expect(error).toBe(err);
  });

  it("should handle promise success via asyncSignal", async () => {
    const promiseSignal = asyncSignal(() => Promise.resolve(42));

    // Wait for signal to resolve
    while (promiseSignal().status === "loading") {
      await delay(10);
    }

    // Call the signal to get the loadable
    const [result, error] = wait.fallback(() => promiseSignal(), 0);
    expect(result).toBe(42);
    expect(error).toBeUndefined();
  });

  it("should handle promise rejection via asyncSignal", async () => {
    const err = new Error("Failed");
    const promiseSignal = asyncSignal(() => Promise.reject(err));

    // Wait for signal to error
    while (promiseSignal().status === "loading") {
      await delay(10);
    }

    // Call the signal to get the loadable
    const [result, error] = wait.fallback(() => promiseSignal(), 99);
    expect(result).toBe(99);
    expect(error).toBe(err);
  });

  it("should call fallback factory on error", () => {
    const factory = vi.fn(() => 99);
    const [result, error] = wait.fallback(() => {
      throw new Error("Failed");
    }, factory);

    expect(result).toBe(99);
    expect(factory).toHaveBeenCalled();
    expect(error).toBeInstanceOf(Error);
  });

  it("should work with signal returning a value", async () => {
    const userSignal = asyncSignal(async () => ({ name: "John", id: 1 }));

    // Wait for signal to resolve
    while (userSignal().status === "loading") {
      await delay(10);
    }

    // Call the signal to get the loadable
    const [user, error] = wait.fallback(() => userSignal(), {
      name: "Guest",
      id: 0,
    });

    expect(user).toEqual({ name: "John", id: 1 });
    expect(error).toBeUndefined();
  });

  it("should use fallback when signal errors", async () => {
    const userSignal = asyncSignal(async () => {
      throw new Error("Network error");
    });

    // Wait for signal to error
    while (userSignal().status === "loading") {
      await delay(10);
    }

    // Call the signal to get the loadable
    const [user, error] = wait.fallback(() => userSignal(), {
      name: "Guest",
      id: 0,
    });

    expect(user).toEqual({ name: "Guest", id: 0 });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Network error");
  });
});

describe("wait.until", () => {
  describe("with single awaitable", () => {
    it("should return value when predicate is true", async () => {
      const count = asyncSignal(async () => 10);

      // Wait for count to resolve
      while (count().status === "loading") {
        await delay(10);
      }

      const result = asyncSignal(() => wait.until(count, (c) => c > 5));

      // Wait for result to resolve
      while (result().status === "loading") {
        await delay(10);
      }

      expect(result().status).toBe("success");
      expect(result().value).toBe(10);
    });

    it("should never resolve when predicate is false", async () => {
      const count = asyncSignal(async () => 3);
      const result = asyncSignal(() => wait.until(count, (c) => c > 5));

      // Should be loading (never resolves)
      expect(result().status).toBe("loading");

      // Wait a bit and verify it's still loading
      await delay(100);
      expect(result().status).toBe("loading");
    });
  });

  describe("with array of awaitables", () => {
    it("should return values when predicate is true", async () => {
      const s1 = asyncSignal(async () => 10);
      const s2 = asyncSignal(async () => 20);

      // Wait for signals to resolve
      while (s1().status === "loading" || s2().status === "loading") {
        await delay(10);
      }

      const result = asyncSignal(() =>
        wait.until([s1, s2], (a, b) => a + b > 25)
      );

      // Wait for result to resolve
      while (result().status === "loading") {
        await delay(10);
      }

      expect(result().status).toBe("success");
      expect(result().value).toEqual([10, 20]);
    });

    it("should never resolve when predicate is false", async () => {
      const s1 = asyncSignal(async () => 5);
      const s2 = asyncSignal(async () => 10);
      const result = asyncSignal(() =>
        wait.until([s1, s2], (a, b) => a + b > 50)
      );

      // Should be loading (never resolves)
      expect(result().status).toBe("loading");

      // Wait a bit and verify it's still loading
      await delay(100);
      expect(result().status).toBe("loading");
    });
  });

  describe("with record of awaitables", () => {
    it("should return record when predicate is true", async () => {
      const s1 = asyncSignal(async () => 10);
      const s2 = asyncSignal(async () => 20);

      // Wait for signals to resolve
      while (s1().status === "loading" || s2().status === "loading") {
        await delay(10);
      }

      const result = asyncSignal(() =>
        wait.until({ a: s1, b: s2 }, ({ a, b }) => a + b > 25)
      );

      // Wait for result to resolve
      while (result().status === "loading") {
        await delay(10);
      }

      expect(result().status).toBe("success");
      expect(result().value).toEqual({ a: 10, b: 20 });
    });

    it("should never resolve when predicate is false", async () => {
      const s1 = asyncSignal(async () => 5);
      const s2 = asyncSignal(async () => 10);
      const result = asyncSignal(() =>
        wait.until({ a: s1, b: s2 }, ({ a, b }) => a + b > 50)
      );

      // Should be loading (never resolves)
      expect(result().status).toBe("loading");

      // Wait a bit and verify it's still loading
      await delay(100);
      expect(result().status).toBe("loading");
    });
  });
});

describe("wait.never", () => {
  it("should never resolve", async () => {
    const result = asyncSignal(() => wait.never());

    // Should be loading (never resolves)
    expect(result().status).toBe("loading");

    // Wait a bit and verify it's still loading
    await delay(100);
    expect(result().status).toBe("loading");
  });
});
