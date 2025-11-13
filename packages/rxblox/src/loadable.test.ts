import { describe, it, expect } from "vitest";
import { type Loadable, LOADABLE_TYPE, loadable, isLoadable } from "./loadable";

describe("loadable", () => {
  describe("loadable factory - loading", () => {
    it("should create loading loadable with promise", () => {
      const promise = Promise.resolve(42);
      const l = loadable("loading", promise);

      expect(l.status).toBe("loading");
      expect(l.promise).toBe(promise);
      expect(l.data).toBeUndefined();
      expect(l.error).toBeUndefined();
      expect(l.loading).toBe(true);
      expect(l[LOADABLE_TYPE]).toBe(true);
    });

    it("should throw if no promise provided", () => {
      expect(() => {
        // @ts-expect-error - testing error case
        loadable("loading");
      }).toThrow("Loading loadable requires a promise");
    });

    it("should handle pending promise", async () => {
      let resolve: (value: number) => void;
      const promise = new Promise<number>((r) => {
        resolve = r;
      });
      const l = loadable("loading", promise);

      expect(l.status).toBe("loading");
      expect(l.data).toBeUndefined();

      // Resolve the promise
      resolve!(42);
      const result = await promise;
      expect(result).toBe(42);
    });

    it("should infer correct promise type", () => {
      const promise = Promise.resolve({ id: 1, name: "Alice" });
      const l = loadable("loading", promise);

      // Type should be LoadingLoadable<{ id: number; name: string }>
      expect(l.status).toBe("loading");
      // TypeScript should infer the correct type
    });
  });

  describe("loadable factory - success", () => {
    it("should create success loadable with data", () => {
      const data = { id: 1, name: "Alice" };
      const l = loadable("success", data);

      expect(l.status).toBe("success");
      expect(l.data).toEqual(data);
      expect(l.error).toBeUndefined();
      expect(l.loading).toBe(false);
      expect(l[LOADABLE_TYPE]).toBe(true);
    });

    it("should create promise if not provided", () => {
      const data = 42;
      const l = loadable("success", data);

      expect(l.promise).toBeInstanceOf(Promise);
    });

    it("should use provided promise", async () => {
      const data = 42;
      const promise = Promise.resolve(data);
      const l = loadable("success", data, promise);

      expect(l.promise).toBe(promise);
      expect(await l.promise).toBe(42);
    });

    it("should handle complex data types", () => {
      const data = {
        id: 1,
        nested: { value: "test" },
        array: [1, 2, 3],
      };
      const l = loadable("success", data);

      expect(l.data).toEqual(data);
      expect(l.data?.nested.value).toBe("test");
    });

    it("should handle null and undefined data", () => {
      const successNull = loadable("success", null);
      expect(successNull.data).toBeNull();

      const successUndef = loadable("success", undefined);
      expect(successUndef.data).toBeUndefined();
    });

    it("should infer correct data type", () => {
      const l = loadable("success", { id: 1, name: "Alice" });

      // Type should be SuccessLoadable<{ id: number; name: string }>
      if (l.status === "success") {
        // TypeScript should know data type
        const id: number = l.data.id;
        const name: string = l.data.name;
        expect(id).toBe(1);
        expect(name).toBe("Alice");
      }
    });
  });

  describe("loadable factory - error", () => {
    it("should create error loadable with error", () => {
      const err = new Error("Failed");
      const l = loadable("error", err);

      expect(l.status).toBe("error");
      expect(l.error).toBe(err);
      expect(l.data).toBeUndefined();
      expect(l.loading).toBe(false);
      expect(l[LOADABLE_TYPE]).toBe(true);
    });

    it("should create rejected promise if not provided", () => {
      const err = new Error("Failed");
      const l = loadable("error", err);

      expect(l.promise).toBeInstanceOf(Promise);
      // Should be rejected but caught internally
      return expect(l.promise).rejects.toBe(err);
    });

    it("should use provided promise", async () => {
      const err = new Error("Failed");
      const promise = Promise.reject(err);
      // Catch to prevent unhandled rejection
      promise.catch(() => {});

      const l = loadable("error", err, promise);

      expect(l.promise).toBe(promise);
      await expect(l.promise).rejects.toBe(err);
    });

    it("should handle different error types", () => {
      // Error object
      const errorObj = loadable("error", new Error("Error obj"));
      expect(errorObj.error).toBeInstanceOf(Error);

      // String error
      const errorStr = loadable("error", "String error");
      expect(errorStr.error).toBe("String error");

      // Number error
      const errorNum = loadable("error", 404);
      expect(errorNum.error).toBe(404);

      // Object error
      const errorCustom = loadable("error", { code: "NOT_FOUND" });
      expect(errorCustom.error).toEqual({ code: "NOT_FOUND" });
    });

    it("should not cause unhandled rejection warnings", () => {
      // Creating error loadable shouldn't cause unhandled rejection
      const l = loadable("error", new Error("Test"));

      // Promise rejection is caught internally
      expect(l.promise).toBeInstanceOf(Promise);
    });
  });

  describe("loadable factory - invalid status", () => {
    it("should throw on invalid status", () => {
      expect(() => {
        // @ts-expect-error - testing error case
        loadable("invalid", {});
      }).toThrow("Invalid loadable status");
    });
  });

  describe("isLoadable type guard", () => {
    it("should identify loading loadable", () => {
      const l = loadable("loading", Promise.resolve(1));
      expect(isLoadable(l)).toBe(true);
    });

    it("should identify success loadable", () => {
      const l = loadable("success", 42);
      expect(isLoadable(l)).toBe(true);
    });

    it("should identify error loadable", () => {
      const l = loadable("error", new Error());
      expect(isLoadable(l)).toBe(true);
    });

    it("should reject non-loadable values", () => {
      expect(isLoadable(null)).toBe(false);
      expect(isLoadable(undefined)).toBe(false);
      expect(isLoadable(42)).toBe(false);
      expect(isLoadable("string")).toBe(false);
      expect(isLoadable({})).toBe(false);
      expect(isLoadable([])).toBe(false);
      expect(isLoadable({ status: "success", data: 42 })).toBe(false);
    });

    it("should work with type narrowing", () => {
      const value: unknown = loadable("success", { id: 1, name: "Alice" });

      if (isLoadable<{ id: number; name: string }>(value)) {
        // TypeScript should know value is Loadable<{ id: number; name: string }>
        if (value.status === "success") {
          expect(value.data.id).toBe(1);
          expect(value.data.name).toBe("Alice");
        }
      }
    });
  });

  describe("type discrimination", () => {
    it("should narrow type based on status - loading", () => {
      const l: Loadable<number> = loadable("loading", Promise.resolve(42));

      if (l.status === "loading") {
        // TypeScript should know these are undefined
        expect(l.data).toBeUndefined();
        expect(l.error).toBeUndefined();
        expect(l.loading).toBe(true);
      }
    });

    it("should narrow type based on status - success", () => {
      const l: Loadable<number> = loadable("success", 42);

      if (l.status === "success") {
        // TypeScript should know data exists and is number
        const value: number = l.data;
        expect(value).toBe(42);
        expect(l.error).toBeUndefined();
        expect(l.loading).toBe(false);
      }
    });

    it("should narrow type based on status - error", () => {
      const err = new Error("Failed");
      const l: Loadable<number> = loadable("error", err);

      if (l.status === "error") {
        // TypeScript should know error exists
        expect(l.error).toBe(err);
        expect(l.data).toBeUndefined();
        expect(l.loading).toBe(false);
      }
    });

    it("should work with switch statement", () => {
      const testLoadable = (l: Loadable<string>) => {
        switch (l.status) {
          case "loading":
            return "loading";
          case "success":
            return `success: ${l.data}`;
          case "error":
            return `error: ${l.error}`;
        }
      };

      expect(testLoadable(loadable("loading", Promise.resolve("test")))).toBe(
        "loading"
      );
      expect(testLoadable(loadable("success", "hello"))).toBe("success: hello");
      expect(testLoadable(loadable("error", "oops"))).toBe("error: oops");
    });
  });

  describe("promise integration", () => {
    it("should maintain promise reference in loading state", async () => {
      const promise = Promise.resolve(42);
      const l = loadable("loading", promise);

      expect(l.promise).toBe(promise);
      const result = await l.promise;
      expect(result).toBe(42);
    });

    it("should handle promise resolution", async () => {
      const promise = Promise.resolve({ id: 1, name: "Alice" });
      const l = loadable("loading", promise);

      const data = await l.promise;
      expect(data).toEqual({ id: 1, name: "Alice" });
    });

    it("should handle promise rejection", async () => {
      const error = new Error("Failed");
      const promise = Promise.reject(error);
      const l = loadable("loading", promise);

      await expect(l.promise).rejects.toBe(error);
    });

    it("should allow suspense integration by throwing promise", () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve(42), 100);
      });
      const l = loadable("loading", promise);

      // In React Suspense, you would throw the promise
      let thrownValue;
      try {
        if (l.status === "loading") {
          throw l.promise;
        }
      } catch (e) {
        thrownValue = e;
      }

      expect(thrownValue).toBe(promise);
    });
  });

  describe("LOADABLE_TYPE symbol", () => {
    it("should be present on all loadable types", () => {
      const l1 = loadable("loading", Promise.resolve());
      const l2 = loadable("success", 42);
      const l3 = loadable("error", new Error());

      expect(l1[LOADABLE_TYPE]).toBe(true);
      expect(l2[LOADABLE_TYPE]).toBe(true);
      expect(l3[LOADABLE_TYPE]).toBe(true);
    });

    it("should be a unique symbol", () => {
      const obj = { [LOADABLE_TYPE]: true };
      expect(LOADABLE_TYPE.toString()).toContain("Symbol");
      expect(obj[LOADABLE_TYPE]).toBe(true);
    });

    it("should not conflict with regular properties", () => {
      const l = loadable("success", {
        status: "custom",
        data: "test",
      });

      expect(l.status).toBe("success");
      expect(l.data).toEqual({ status: "custom", data: "test" });
      expect(l[LOADABLE_TYPE]).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle promises that never resolve", () => {
      const neverResolve = new Promise(() => {});
      const l = loadable("loading", neverResolve);

      expect(l.status).toBe("loading");
      expect(l.promise).toBe(neverResolve);
    });

    it("should handle immediately resolved promises", async () => {
      const promise = Promise.resolve("immediate");
      const l = loadable("loading", promise);

      expect(l.status).toBe("loading");
      const result = await l.promise;
      expect(result).toBe("immediate");
    });

    it("should handle empty objects and arrays", () => {
      const emptyObj = loadable("success", {});
      expect(emptyObj.data).toEqual({});

      const emptyArr = loadable("success", []);
      expect(emptyArr.data).toEqual([]);
    });

    it("should handle boolean values", () => {
      const trueValue = loadable("success", true);
      expect(trueValue.data).toBe(true);

      const falseValue = loadable("success", false);
      expect(falseValue.data).toBe(false);
    });

    it("should handle zero and empty string", () => {
      const zero = loadable("success", 0);
      expect(zero.data).toBe(0);

      const empty = loadable("success", "");
      expect(empty.data).toBe("");
    });

    it("should handle generic type parameters correctly", () => {
      // Loading with specific type
      const loading = loadable<User>(
        "loading",
        Promise.resolve({ id: 1, name: "Alice" })
      );
      expect(loading.status).toBe("loading");

      // Success with inferred type
      const success = loadable("success", { id: 1, name: "Bob" });
      expect(success.data.name).toBe("Bob");

      // Error with type parameter
      const error = loadable<User>("error", new Error("Failed"));
      expect(error.status).toBe("error");
    });
  });

  describe("real-world scenarios", () => {
    it("should model fetching user data", async () => {
      // Start with loading
      const userPromise = Promise.resolve({
        id: 1,
        name: "Alice",
        email: "alice@example.com",
      });
      const loading = loadable("loading", userPromise);
      expect(loading.status).toBe("loading");

      // Resolve to success
      const userData = await userPromise;
      const success = loadable("success", userData);
      expect(success.status).toBe("success");
      expect(success.data.name).toBe("Alice");
    });

    it("should model failed API calls", () => {
      const apiError = new Error("Network error");
      const l = loadable("error", apiError);

      expect(l.status).toBe("error");
      expect(l.error).toBeInstanceOf(Error);
      expect((l.error as Error).message).toBe("Network error");
    });

    it("should work with React-like render logic", () => {
      const renderLoadable = <T>(l: Loadable<T>) => {
        switch (l.status) {
          case "loading":
            return "Loading...";
          case "success":
            return `Success: ${JSON.stringify(l.data)}`;
          case "error":
            return `Error: ${l.error}`;
        }
      };

      expect(renderLoadable(loadable("loading", Promise.resolve(1)))).toBe(
        "Loading..."
      );
      expect(renderLoadable(loadable("success", { value: 42 }))).toBe(
        'Success: {"value":42}'
      );
      expect(renderLoadable(loadable("error", "Failed"))).toBe("Error: Failed");
    });
  });
});

// Helper type for tests
type User = {
  id: number;
  name: string;
  email?: string;
};
