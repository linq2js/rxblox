import { describe, it, expect, vi } from "vitest";
import { trackingDispatcher, trackingToken } from "./trackingDispatcher";
import { signal } from "./signal";
import { getDispatcher, withDispatchers } from "./dispatcher";
import { emitter } from "./emitter";

describe("trackingDispatcher", () => {
  describe("basic functionality", () => {
    it("should create a signal dispatcher", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      expect(dispatcher).toBeDefined();
      expect(typeof dispatcher.add).toBe("function");
      expect(typeof dispatcher.track).toBe("function");
      expect(typeof dispatcher.clear).toBe("function");
      expect(dispatcher.signals).toEqual([]);
    });

    it("should track signals when added", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const s1 = signal(1);
      const s2 = signal(2);

      dispatcher.add(s1);
      dispatcher.add(s2);

      expect(dispatcher.signals).toContain(s1);
      expect(dispatcher.signals).toContain(s2);
      expect(dispatcher.signals.length).toBe(2);
    });

    it("should not duplicate signals when added multiple times", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const s1 = signal(1);

      const result1 = dispatcher.add(s1);
      const result2 = dispatcher.add(s1);
      const result3 = dispatcher.add(s1);

      expect(result1).toBe(true); // First add returns true
      expect(result2).toBe(false); // Duplicate returns false
      expect(result3).toBe(false); // Duplicate returns false
      expect(dispatcher.signals.length).toBe(1);
      expect(dispatcher.signals).toContain(s1);
    });

    it("should clear all signals", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const s1 = signal(1);
      const s2 = signal(2);

      dispatcher.add(s1);
      dispatcher.add(s2);
      expect(dispatcher.signals.length).toBe(2);

      dispatcher.clear();
      expect(dispatcher.signals.length).toBe(0);
    });

    it("should call onUpdate when tracked signal changes", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const s1 = signal(1);

      dispatcher.add(s1);
      expect(onUpdate).not.toHaveBeenCalled();

      s1.set(2);
      expect(onUpdate).toHaveBeenCalledTimes(1);

      s1.set(3);
      expect(onUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe("track() method", () => {
    it("should create a proxy that tracks signal accesses", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const s1 = signal(10);
      const s2 = signal(20);

      const tracked = dispatcher.track({ s1, s2 });

      expect(dispatcher.signals.length).toBe(0);

      const value1 = tracked.s1;
      expect(value1).toBe(10);
      expect(dispatcher.signals).toContain(s1);
      expect(dispatcher.signals.length).toBe(1);

      const value2 = tracked.s2;
      expect(value2).toBe(20);
      expect(dispatcher.signals).toContain(s2);
      expect(dispatcher.signals.length).toBe(2);
    });

    it("should only track accessed signals", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const tracked = dispatcher.track({ a, b, c });

      // Only access 'a' and 'b', not 'c'
      const sum = tracked.a + tracked.b;
      expect(sum).toBe(3);

      expect(dispatcher.signals).toContain(a);
      expect(dispatcher.signals).toContain(b);
      expect(dispatcher.signals).not.toContain(c);
      expect(dispatcher.signals.length).toBe(2);
    });

    it("should support conditional tracking", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const condition = signal(true);
      const a = signal(10);
      const b = signal(20);

      const tracked = dispatcher.track({ condition, a, b });

      const result = tracked.condition ? tracked.a : tracked.b;
      expect(result).toBe(10);

      // Should track condition and a, but not b
      expect(dispatcher.signals).toContain(condition);
      expect(dispatcher.signals).toContain(a);
      expect(dispatcher.signals).not.toContain(b);
      expect(dispatcher.signals.length).toBe(2);
    });

    it("should track computed properties with arrow functions", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const count = signal(5);
      const multiplier = signal(2);

      const tracked = dispatcher.track({
        count,
        doubled: () => count() * 2,
        tripled: () => count() * 3,
        multiplied: () => count() * multiplier(),
      });

      // Access only 'doubled'
      expect(tracked.doubled).toBe(10);
      expect(dispatcher.signals).toContain(count);
      expect(dispatcher.signals).not.toContain(multiplier);
      expect(dispatcher.signals.length).toBe(1);

      dispatcher.clear();

      // Access 'multiplied' which uses both signals
      expect(tracked.multiplied).toBe(10);
      expect(dispatcher.signals).toContain(count);
      expect(dispatcher.signals).toContain(multiplier);
      expect(dispatcher.signals.length).toBe(2);
    });

    it("should throw error when tracked property is not a function", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);

      // @ts-expect-error - Testing runtime error for non-function property
      const tracked = dispatcher.track({ invalidProp: 123 });

      expect(() => tracked.invalidProp).toThrow(
        "Track prop invalidProp must be a function"
      );
    });

    it("should support tracking in async contexts", async () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const count = signal(1);
      const name = signal("Alice");

      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const tracked = dispatcher.track({ count, name });

      // Track before await
      const initialCount = tracked.count;
      expect(initialCount).toBe(1);
      expect(dispatcher.signals).toContain(count);
      expect(dispatcher.signals.length).toBe(1);

      await delay(10);

      // Track after await - still works!
      const nameValue = tracked.name;
      expect(nameValue).toBe("Alice");
      expect(dispatcher.signals).toContain(name);
      expect(dispatcher.signals.length).toBe(2);
    });

    it("should support tracking props-like objects in async contexts", async () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);

      // Simulate props from a blox component
      const userId = signal(1);
      const userName = signal("Alice");

      const props = {
        userId,
        userName,
        fullName: () => `User: ${userName()}`,
      };

      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const tracked = dispatcher.track(props);

      // Before await
      const id1 = tracked.userId;
      expect(id1).toBe(1);
      expect(dispatcher.signals).toContain(userId);

      await delay(10);

      // After await - tracking still works
      const name1 = tracked.userName;
      expect(name1).toBe("Alice");
      expect(dispatcher.signals).toContain(userName);

      await delay(10);

      // Computed property after multiple awaits
      const fullName = tracked.fullName;
      expect(fullName).toBe("User: Alice");
      expect(dispatcher.signals.length).toBe(2);
    });

    it("should avoid premature tracking with lazy proxy", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const tracked = dispatcher.track({ a, b, c });

      // Just creating the proxy doesn't track anything
      expect(dispatcher.signals.length).toBe(0);

      // Even passing the proxy around doesn't track
      const passedProxy = tracked;
      expect(dispatcher.signals.length).toBe(0);

      // Only when we access a property does tracking happen
      const value = passedProxy.a;
      expect(value).toBe(1);
      expect(dispatcher.signals.length).toBe(1);
      expect(dispatcher.signals).toContain(a);
    });

    it("should support destructuring after conditional check", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const isLoggedIn = signal(true);
      const userId = signal(123);
      const userName = signal("Alice");

      const tracked = dispatcher.track({ isLoggedIn, userId, userName });

      // Check condition first
      if (tracked.isLoggedIn) {
        // Only track isLoggedIn at this point
        expect(dispatcher.signals.length).toBe(1);

        // Now destructure and track the rest
        const { userId: id, userName: name } = tracked;
        expect(id).toBe(123);
        expect(name).toBe("Alice");
        expect(dispatcher.signals.length).toBe(3);
      }
    });

    it("should work with nested async/await and conditional tracking", async () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const status = signal("loading");
      const data = signal({ id: 1, value: "test" });
      const error = signal<Error | null>(null);

      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const tracked = dispatcher.track({ status, data, error });

      // First async operation
      await delay(5);
      const currentStatus = tracked.status;
      expect(currentStatus).toBe("loading");
      expect(dispatcher.signals.length).toBe(1);

      // Conditional tracking after await
      if (currentStatus === "loading") {
        await delay(5);
        // Don't access error, only data
        const currentData = tracked.data;
        expect(currentData).toEqual({ id: 1, value: "test" });
        expect(dispatcher.signals.length).toBe(2);
        expect(dispatcher.signals).toContain(status);
        expect(dispatcher.signals).toContain(data);
        expect(dispatcher.signals).not.toContain(error);
      }
    });

    it("should track all signals when using spread operator", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const s1 = signal(10);
      const s2 = signal(20);
      const s3 = signal(30);

      const tracked = dispatcher.track({ s1, s2, s3 });

      // Initially no signals are tracked
      expect(dispatcher.signals.length).toBe(0);

      // Spread operator accesses all properties, thus tracking all signals
      const values = { ...tracked };

      expect(values).toEqual({ s1: 10, s2: 20, s3: 30 });
      expect(dispatcher.signals.length).toBe(3);
      expect(dispatcher.signals).toContain(s1);
      expect(dispatcher.signals).toContain(s2);
      expect(dispatcher.signals).toContain(s3);
    });

    it("should track all signals with Object.assign", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const tracked = dispatcher.track({ a, b, c });

      // Initially no signals are tracked
      expect(dispatcher.signals.length).toBe(0);

      // Object.assign accesses all properties
      const values = Object.assign({}, tracked);

      expect(values).toEqual({ a: 1, b: 2, c: 3 });
      expect(dispatcher.signals.length).toBe(3);
      expect(dispatcher.signals).toContain(a);
      expect(dispatcher.signals).toContain(b);
      expect(dispatcher.signals).toContain(c);
    });

    it("should track signals with Object.values", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const x = signal(100);
      const y = signal(200);
      const z = signal(300);

      const tracked = dispatcher.track({ x, y, z });

      // Object.values accesses all enumerable properties
      const values = Object.values(tracked);

      expect(values).toEqual([100, 200, 300]);
      expect(dispatcher.signals.length).toBe(3);
      expect(dispatcher.signals).toContain(x);
      expect(dispatcher.signals).toContain(y);
      expect(dispatcher.signals).toContain(z);
    });

    it("should track signals with Object.entries", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const name = signal("Alice");
      const age = signal(25);

      const tracked = dispatcher.track({ name, age });

      // Object.entries accesses all enumerable properties
      const entries = Object.entries(tracked);

      expect(entries).toEqual([
        ["name", "Alice"],
        ["age", 25],
      ]);
      expect(dispatcher.signals.length).toBe(2);
      expect(dispatcher.signals).toContain(name);
      expect(dispatcher.signals).toContain(age);
    });
  });

  describe("getDispatcher", () => {
    it("should return undefined when no dispatcher is active", () => {
      expect(getDispatcher(trackingToken)).toBeUndefined();
    });

    it("should return the active dispatcher", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);

      withDispatchers([trackingToken(dispatcher)], () => {
        expect(getDispatcher(trackingToken)).toBe(dispatcher);
      });
    });
  });

  describe("withDispatchers", () => {
    it("should execute function and return result", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const result = withDispatchers([trackingToken(dispatcher)], () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it("should track signals accessed during execution", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const s1 = signal(1);
      const s2 = signal(2);

      withDispatchers([trackingToken(dispatcher)], () => {
        s1(); // Access signal - should be tracked
        s2(); // Access signal - should be tracked
      });

      expect(dispatcher.signals).toContain(s1);
      expect(dispatcher.signals).toContain(s2);
      expect(dispatcher.signals.length).toBe(2);
    });

    it("should restore previous dispatcher after execution", () => {
      const onUpdate1 = vi.fn();
      const onCleanup1 = emitter();
      const dispatcher1 = trackingDispatcher(onUpdate1, onCleanup1);
      const onUpdate2 = vi.fn();
      const onCleanup2 = emitter();
      const dispatcher2 = trackingDispatcher(onUpdate2, onCleanup2);

      withDispatchers([trackingToken(dispatcher1)], () => {
        expect(getDispatcher(trackingToken)).toBe(dispatcher1);

        withDispatchers([trackingToken(dispatcher2)], () => {
          expect(getDispatcher(trackingToken)).toBe(dispatcher2);
        });

        expect(getDispatcher(trackingToken)).toBe(dispatcher1);
      });

      expect(getDispatcher(trackingToken)).toBeUndefined();
    });

    it("should restore dispatcher even if function throws", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);

      expect(() => {
        withDispatchers([trackingToken(dispatcher)], () => {
          throw new Error("Test error");
        });
      }).toThrow("Test error");

      expect(getDispatcher(trackingToken)).toBeUndefined();
    });

    it("should handle nested dispatchers correctly", () => {
      const onUpdate1 = vi.fn();
      const onCleanup1 = emitter();
      const outerDispatcher = trackingDispatcher(onUpdate1, onCleanup1);
      const onUpdate2 = vi.fn();
      const onCleanup2 = emitter();
      const innerDispatcher = trackingDispatcher(onUpdate2, onCleanup2);
      const s1 = signal(1);
      const s2 = signal(2);

      withDispatchers([trackingToken(outerDispatcher)], () => {
        s1(); // Should be tracked by outerDispatcher

        withDispatchers([trackingToken(innerDispatcher)], () => {
          s2(); // Should be tracked by innerDispatcher
        });

        expect(outerDispatcher.signals).toContain(s1);
        expect(outerDispatcher.signals).not.toContain(s2);
        expect(innerDispatcher.signals).toContain(s2);
        expect(innerDispatcher.signals).not.toContain(s1);
      });
    });

    it("should not track signals accessed outside dispatcher context", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const s1 = signal(1);

      s1(); // Access outside context - should not be tracked

      withDispatchers([trackingToken(dispatcher)], () => {
        // Do nothing
      });

      expect(dispatcher.signals.length).toBe(0);
    });
  });

  describe("signal integration", () => {
    it("should track signals when read within dispatcher context", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const count = signal(0);

      withDispatchers([trackingToken(dispatcher)], () => {
        const value = count(); // Reading signal should add it to dispatcher
        expect(value).toBe(0);
      });

      expect(dispatcher.signals).toContain(count);
    });

    it("should track multiple signals accessed in computed expression", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      withDispatchers([trackingToken(dispatcher)], () => {
        const result = a() + b() + c();
        expect(result).toBe(6);
      });

      expect(dispatcher.signals.length).toBe(3);
      expect(dispatcher.signals).toContain(a);
      expect(dispatcher.signals).toContain(b);
      expect(dispatcher.signals).toContain(c);
    });

    it("should not track signals accessed via peek()", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = trackingDispatcher(onUpdate, onCleanup);
      const count = signal(0);

      withDispatchers([trackingToken(dispatcher)], () => {
        count.peek(); // peek() should not add to dispatcher
      });

      expect(dispatcher.signals.length).toBe(0);
    });
  });
});
