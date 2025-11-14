import { describe, it, expect, vi } from "vitest";
import { signalDispatcher, signalToken } from "./signalDispatcher";
import { signal } from "./signal";
import { getDispatcher, withDispatchers } from "./dispatcher";
import { emitter } from "./emitter";

describe("signalDispatcher", () => {
  describe("basic functionality", () => {
    it("should create a signal dispatcher", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
      expect(dispatcher).toBeDefined();
      expect(typeof dispatcher.add).toBe("function");
      expect(typeof dispatcher.track).toBe("function");
      expect(typeof dispatcher.clear).toBe("function");
      expect(dispatcher.signals).toEqual([]);
    });

    it("should track signals when added", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
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
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
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
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
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
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
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
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
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
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
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
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
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
  });

  describe("getDispatcher", () => {
    it("should return undefined when no dispatcher is active", () => {
      expect(getDispatcher(signalToken)).toBeUndefined();
    });

    it("should return the active dispatcher", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = signalDispatcher(onUpdate, onCleanup);

      withDispatchers([signalToken(dispatcher)], () => {
        expect(getDispatcher(signalToken)).toBe(dispatcher);
      });
    });
  });

  describe("withDispatchers", () => {
    it("should execute function and return result", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
      const result = withDispatchers([signalToken(dispatcher)], () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it("should track signals accessed during execution", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
      const s1 = signal(1);
      const s2 = signal(2);

      withDispatchers([signalToken(dispatcher)], () => {
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
      const dispatcher1 = signalDispatcher(onUpdate1, onCleanup1);
      const onUpdate2 = vi.fn();
      const onCleanup2 = emitter();
      const dispatcher2 = signalDispatcher(onUpdate2, onCleanup2);

      withDispatchers([signalToken(dispatcher1)], () => {
        expect(getDispatcher(signalToken)).toBe(dispatcher1);

        withDispatchers([signalToken(dispatcher2)], () => {
          expect(getDispatcher(signalToken)).toBe(dispatcher2);
        });

        expect(getDispatcher(signalToken)).toBe(dispatcher1);
      });

      expect(getDispatcher(signalToken)).toBeUndefined();
    });

    it("should restore dispatcher even if function throws", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = signalDispatcher(onUpdate, onCleanup);

      expect(() => {
        withDispatchers([signalToken(dispatcher)], () => {
          throw new Error("Test error");
        });
      }).toThrow("Test error");

      expect(getDispatcher(signalToken)).toBeUndefined();
    });

    it("should handle nested dispatchers correctly", () => {
      const onUpdate1 = vi.fn();
      const onCleanup1 = emitter();
      const outerDispatcher = signalDispatcher(onUpdate1, onCleanup1);
      const onUpdate2 = vi.fn();
      const onCleanup2 = emitter();
      const innerDispatcher = signalDispatcher(onUpdate2, onCleanup2);
      const s1 = signal(1);
      const s2 = signal(2);

      withDispatchers([signalToken(outerDispatcher)], () => {
        s1(); // Should be tracked by outerDispatcher

        withDispatchers([signalToken(innerDispatcher)], () => {
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
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
      const s1 = signal(1);

      s1(); // Access outside context - should not be tracked

      withDispatchers([signalToken(dispatcher)], () => {
        // Do nothing
      });

      expect(dispatcher.signals.length).toBe(0);
    });
  });

  describe("signal integration", () => {
    it("should track signals when read within dispatcher context", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
      const count = signal(0);

      withDispatchers([signalToken(dispatcher)], () => {
        const value = count(); // Reading signal should add it to dispatcher
        expect(value).toBe(0);
      });

      expect(dispatcher.signals).toContain(count);
    });

    it("should track multiple signals accessed in computed expression", () => {
      const onUpdate = vi.fn();
      const onCleanup = emitter();
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      withDispatchers([signalToken(dispatcher)], () => {
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
      const dispatcher = signalDispatcher(onUpdate, onCleanup);
      const count = signal(0);

      withDispatchers([signalToken(dispatcher)], () => {
        count.peek(); // peek() should not add to dispatcher
      });

      expect(dispatcher.signals.length).toBe(0);
    });
  });
});

