import { describe, it, expect, vi } from "vitest";
import { createProxy } from "./createProxy";

describe("createProxy", () => {
  describe("basic functionality", () => {
    it("should create a proxy with dynamic get", () => {
      let value = { name: "Alice", age: 30 };
      const proxy = createProxy({ get: () => value });

      expect(proxy.name).toBe("Alice");
      expect(proxy.age).toBe(30);
    });

    it("should reflect changes in dynamic target", () => {
      let value = { count: 0 };
      const proxy = createProxy({ get: () => value });

      expect(proxy.count).toBe(0);

      value = { count: 10 };
      expect(proxy.count).toBe(10);
    });

    it("should support property access for objects", () => {
      const obj = {
        name: "Alice",
        nested: { value: 42 },
        method() {
          return "hello";
        },
      };
      const proxy = createProxy({ get: () => obj });

      expect(proxy.name).toBe("Alice");
      expect(proxy.nested.value).toBe(42);
      expect(proxy.method()).toBe("hello");
    });

    it("should throw error when invoking non-function target", () => {
      const proxy = createProxy({ get: () => ({ name: "Alice" }) });

      expect(() => {
        (proxy as any)();
      }).toThrow("Cannot invoke proxy: target is object, not a function");
    });
  });

  describe("function invocation", () => {
    it("should invoke function targets", () => {
      const fn = vi.fn(() => "hello");
      const proxy = createProxy({ get: () => fn });

      const result = (proxy as any)();
      expect(result).toBe("hello");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should pass arguments to function", () => {
      const fn = vi.fn((a: number, b: number) => a + b);
      const proxy = createProxy({ get: () => fn });

      const result = (proxy as any)(5, 10);
      expect(result).toBe(15);
      expect(fn).toHaveBeenCalledWith(5, 10);
    });

    it("should preserve this context when invoking", () => {
      const obj = {
        name: "Alice",
        greet() {
          return `Hello, ${this.name}!`;
        },
      };
      const fn = obj.greet.bind(obj);
      const proxy = createProxy({ get: () => fn });

      expect((proxy as any)()).toBe("Hello, Alice!");
    });

    it("should allow switching between function and non-function targets", () => {
      let value: any = () => "function";
      const proxy = createProxy({ get: () => value });

      // Function target - invocation works
      expect((proxy as any)()).toBe("function");

      // Switch to object
      value = { name: "object" };
      expect(proxy.name).toBe("object");

      // Invocation now throws
      expect(() => (proxy as any)()).toThrow(
        "Cannot invoke proxy: target is object, not a function"
      );
    });
  });

  describe("auto-binding of methods", () => {
    it("should auto-bind object methods", () => {
      const obj = {
        name: "Alice",
        greet() {
          return `Hello, ${this.name}!`;
        },
      };
      const proxy = createProxy({ get: () => obj });

      // Direct call works
      expect(proxy.greet()).toBe("Hello, Alice!");

      // Destructured call works (auto-bound)
      const { greet } = proxy;
      expect(greet()).toBe("Hello, Alice!");
    });

    it("should provide stable references for bound methods", () => {
      const obj = {
        name: "Alice",
        greet() {
          return `Hello, ${this.name}!`;
        },
      };
      const proxy = createProxy({ get: () => obj });

      const greet1 = proxy.greet;
      const greet2 = proxy.greet;

      // Same reference (cached)
      expect(greet1).toBe(greet2);

      // Still works
      expect(greet1()).toBe("Hello, Alice!");
    });

    it("should cache methods per target instance", () => {
      const obj1 = {
        name: "Alice",
        greet() {
          return this.name;
        },
      };
      const obj2 = {
        name: "Bob",
        greet() {
          return this.name;
        },
      };

      let current = obj1;
      const proxy = createProxy({ get: () => current });

      const greet1 = proxy.greet;
      expect(greet1()).toBe("Alice");

      // Switch target
      current = obj2;
      const greet2 = proxy.greet;
      expect(greet2()).toBe("Bob");

      // Different bound methods for different targets
      expect(greet1).not.toBe(greet2);
      expect(greet1()).toBe("Alice");
      expect(greet2()).toBe("Bob");
    });

    it("should handle methods with arguments", () => {
      const obj = {
        name: "Alice",
        greet(greeting: string) {
          return `${greeting}, ${this.name}!`;
        },
      };
      const proxy = createProxy({ get: () => obj });

      const { greet } = proxy;
      expect(greet("Hello")).toBe("Hello, Alice!");
      expect(greet("Hi")).toBe("Hi, Alice!");
    });
  });

  describe("readonly mode (default)", () => {
    it("should be readonly by default", () => {
      const obj = { count: 0 };
      const proxy = createProxy({ get: () => obj });

      expect(() => {
        (proxy as any).count = 10;
      }).toThrow("Cannot set property 'count' on readonly proxy");
    });

    it("should throw on attempting to set new properties", () => {
      const obj = { count: 0 };
      const proxy = createProxy({ get: () => obj });

      expect(() => {
        (proxy as any).newProp = "value";
      }).toThrow("Cannot set property 'newProp' on readonly proxy");
    });

    it("should allow reads but not writes", () => {
      const obj = { name: "Alice", age: 30 };
      const proxy = createProxy({ get: () => obj });

      expect(proxy.name).toBe("Alice");
      expect(proxy.age).toBe(30);

      expect(() => {
        (proxy as any).name = "Bob";
      }).toThrow();
      expect(() => {
        (proxy as any).age = 25;
      }).toThrow();
    });
  });

  describe("custom set handler", () => {
    it("should use custom set handler for writes", () => {
      const obj = { count: 0 };
      const updates: Array<[string, any]> = [];

      const proxy = createProxy({
        get: () => obj,
        set: (key, value) => {
          updates.push([key as string, value]);
        },
      });

      (proxy as any).count = 10;
      (proxy as any).name = "Alice";

      expect(updates).toEqual([
        ["count", 10],
        ["name", "Alice"],
      ]);
    });

    it("should allow shallow updates via set handler", () => {
      let obj = { count: 0, name: "Alice" };

      const proxy = createProxy({
        get: () => obj,
        set: (key, value) => {
          obj = { ...obj, [key]: value };
        },
      });

      expect(proxy.count).toBe(0);

      (proxy as any).count = 10;
      expect(proxy.count).toBe(10);

      (proxy as any).name = "Bob";
      expect(proxy.name).toBe("Bob");
    });
  });

  describe("writable mode", () => {
    it("should allow direct mutation with writable: true", () => {
      const obj = { count: 0, name: "Alice" };
      const proxy = createProxy({
        get: () => obj,
        writable: true,
      });

      proxy.count = 10;
      expect(proxy.count).toBe(10);
      expect(obj.count).toBe(10); // Direct mutation

      proxy.name = "Bob";
      expect(proxy.name).toBe("Bob");
      expect(obj.name).toBe("Bob");
    });

    it("should allow mutation of specific properties with writable array", () => {
      const obj = { count: 0, name: "Alice", id: 1 };
      const proxy = createProxy({
        get: () => obj,
        writable: ["count", "name"],
      });

      // Allowed writes
      proxy.count = 10;
      expect(proxy.count).toBe(10);

      proxy.name = "Bob";
      expect(proxy.name).toBe("Bob");

      // Disallowed write
      expect(() => {
        (proxy as any).id = 2;
      }).toThrow("Cannot set property 'id' on readonly proxy");
    });

    it("should throw error when setting built-in properties on function target", () => {
      const fn = () => "hello";
      const proxy = createProxy({
        get: () => fn,
        writable: true,
      });

      expect(() => {
        (proxy as any).length = 5;
      }).toThrow("Cannot set built-in property 'length' on function target");

      expect(() => {
        (proxy as any).name = "customName";
      }).toThrow("Cannot set built-in property 'name' on function target");
    });

    it("should allow custom properties on function target", () => {
      const fn = (() => "hello") as any;
      const proxy = createProxy({
        get: () => fn,
        writable: true,
      });

      // Custom property should work
      (proxy as any).customProp = "value";
      expect(fn.customProp).toBe("value");
      expect((proxy as any).customProp).toBe("value");
    });
  });

  describe("custom traps", () => {
    it("should use custom get trap", () => {
      const obj = { name: "Alice" };
      const proxy = createProxy({
        get: () => obj,
        traps: {
          get: (_target, prop) => {
            if (prop === "name") {
              return obj.name.toUpperCase();
            }
            return obj[prop as keyof typeof obj];
          },
        },
      });

      expect(proxy.name).toBe("ALICE");
    });

    it("should use custom set trap", () => {
      const obj = { count: 0 };
      const setCalls: any[] = [];

      const proxy = createProxy({
        get: () => obj,
        traps: {
          set: (_target, prop, value) => {
            setCalls.push({ prop, value });
            obj[prop as keyof typeof obj] = value * 2; // Double the value
            return true;
          },
        },
      });

      (proxy as any).count = 5;
      expect(obj.count).toBe(10); // Doubled
      expect(setCalls).toEqual([{ prop: "count", value: 5 }]);
    });

    it("should use custom has trap", () => {
      const obj = { name: "Alice" };
      const proxy = createProxy({
        get: () => obj,
        traps: {
          has: (target, prop) => {
            // Hide 'name' property
            if (prop === "name") return false;
            return prop in target;
          },
        },
      });

      expect("name" in proxy).toBe(false);
      expect("age" in proxy).toBe(false);
    });

    it("should use custom ownKeys trap", () => {
      const obj = { name: "Alice", age: 30 };
      const proxy = createProxy({
        get: () => obj,
        traps: {
          ownKeys: (_target) => {
            // Only expose 'name'
            return ["name"];
          },
        },
      });

      const keys = Object.keys(proxy);
      expect(keys).toContain("name");
    });

    it("should use custom apply trap", () => {
      const fn = vi.fn(() => "original");
      const proxy = createProxy({
        get: () => fn,
        traps: {
          apply: (_target, _thisArg, _args) => {
            return "custom";
          },
        },
      });

      expect((proxy as any)()).toBe("custom");
      expect(fn).not.toHaveBeenCalled(); // Original not called
    });

    it("should use custom getOwnPropertyDescriptor trap", () => {
      const obj = { name: "Alice" };
      const proxy = createProxy({
        get: () => obj,
        traps: {
          getOwnPropertyDescriptor: (target, prop) => {
            if (prop === "name") {
              return {
                value: "Bob",
                writable: true,
                enumerable: true,
                configurable: true,
              };
            }
            return Object.getOwnPropertyDescriptor(target, prop);
          },
        },
      });

      const desc = Object.getOwnPropertyDescriptor(proxy, "name");
      expect(desc?.value).toBe("Bob");
    });
  });

  describe("property operators", () => {
    it("should support 'in' operator", () => {
      const obj = { name: "Alice", age: 30 };
      const proxy = createProxy({ get: () => obj });

      expect("name" in proxy).toBe(true);
      expect("age" in proxy).toBe(true);
      expect("missing" in proxy).toBe(false);
    });

    it("should support Object.keys()", () => {
      const obj = { name: "Alice", age: 30 };
      const proxy = createProxy({ get: () => obj });

      const keys = Object.keys(proxy);
      expect(keys).toContain("name");
      expect(keys).toContain("age");
    });

    it("should support Object.getOwnPropertyDescriptor()", () => {
      const obj = { name: "Alice" };
      const proxy = createProxy({ get: () => obj });

      const desc = Object.getOwnPropertyDescriptor(proxy, "name");
      expect(desc?.value).toBe("Alice");
      expect(desc?.enumerable).toBe(true);
      expect(desc?.configurable).toBe(true);
    });

    it("should support property enumeration", () => {
      const obj = { name: "Alice", age: 30 };
      const proxy = createProxy({ get: () => obj });

      const props: string[] = [];
      for (const key in proxy) {
        props.push(key);
      }

      expect(props).toContain("name");
      expect(props).toContain("age");
    });
  });

  describe("edge cases", () => {
    it("should handle undefined and null targets", () => {
      const proxy = createProxy({ get: () => undefined }) as any;
      // Accessing properties on undefined will throw
      expect(() => proxy.name).toThrow();
    });

    it("should handle primitive targets", () => {
      const proxy = createProxy({ get: () => 42 as any });
      expect(() => (proxy as any).name).not.toThrow();
    });

    it("should handle array targets", () => {
      const arr = [1, 2, 3];
      const proxy = createProxy({ get: () => arr });

      expect(proxy[0]).toBe(1);
      expect(proxy[1]).toBe(2);
      expect(proxy.length).toBe(3);
    });

    it("should handle empty objects", () => {
      const obj = {};
      const proxy = createProxy({ get: () => obj }) as any;

      expect(Object.keys(proxy).length).toBeGreaterThanOrEqual(0);
      expect(() => proxy.name).not.toThrow();
    });

    it("should handle symbols", () => {
      const sym = Symbol("test");
      const obj = { [sym]: "value" };
      const proxy = createProxy({ get: () => obj });

      expect(proxy[sym]).toBe("value");
      expect(sym in proxy).toBe(true);
    });

    it("should handle getters and setters", () => {
      const obj = {
        _value: 0,
        get value() {
          return this._value;
        },
        set value(v: number) {
          this._value = v;
        },
      };
      const proxy = createProxy({
        get: () => obj,
        writable: true,
      });

      expect(proxy.value).toBe(0);
      proxy.value = 10;
      expect(proxy.value).toBe(10);
      expect(obj._value).toBe(10);
    });
  });

  describe("integration scenarios", () => {
    it("should work as a signal value proxy", () => {
      let value = { count: 0, name: "Alice" };
      const proxy = createProxy({
        get: () => value,
        set: (key, val) => {
          value = { ...value, [key]: val };
        },
      });

      // Read
      expect(proxy.count).toBe(0);
      expect(proxy.name).toBe("Alice");

      // Write (shallow update)
      (proxy as any).count = 10;
      expect(proxy.count).toBe(10);

      // Original reference changed (immutable)
      expect(value.count).toBe(10);
    });

    it("should work with dynamic target switching", () => {
      let mode: "object" | "function" = "object";
      const obj = { name: "Alice" };
      const fn = () => "Hello";

      const proxy = createProxy({
        get: () => (mode === "object" ? obj : fn),
      });

      // Object mode
      expect(proxy.name).toBe("Alice");
      expect(() => (proxy as any)()).toThrow();

      // Switch to function mode
      mode = "function";
      expect((proxy as any)()).toBe("Hello");
      // Functions have a .name property (the function name)
      expect(proxy.name).toBe("fn");
    });

    it("should preserve proxy identity across target changes", () => {
      let value = { count: 0 };
      const proxy = createProxy({ get: () => value });

      const ref1 = proxy;
      value = { count: 10 };
      const ref2 = proxy;

      // Same proxy reference
      expect(ref1).toBe(ref2);

      // Different values
      expect(ref1.count).toBe(10);
    });
  });
});
