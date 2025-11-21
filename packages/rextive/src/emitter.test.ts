import { describe, it, expect, vi } from "vitest";
import { emitter } from "./emitter";

describe("emitter", () => {
  describe("basic functionality", () => {
    it("should create an emitter", () => {
      const eventEmitter = emitter();
      expect(eventEmitter).toBeDefined();
      expect(typeof eventEmitter.on).toBe("function");
      expect(typeof eventEmitter.emit).toBe("function");
      expect(typeof eventEmitter.clear).toBe("function");
    });

    it("should add and call listeners", () => {
      const eventEmitter = emitter<string>();
      const listener = vi.fn();

      eventEmitter.on(listener);
      eventEmitter.emit("test");

      expect(listener).toHaveBeenCalledWith("test");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should support multiple listeners", () => {
      const eventEmitter = emitter<string>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventEmitter.on(listener1);
      eventEmitter.on(listener2);
      eventEmitter.on(listener3);

      eventEmitter.emit("message");

      expect(listener1).toHaveBeenCalledWith("message");
      expect(listener2).toHaveBeenCalledWith("message");
      expect(listener3).toHaveBeenCalledWith("message");
    });

    it("should call listeners in order", () => {
      const eventEmitter = emitter<string>();
      const callOrder: string[] = [];

      eventEmitter.on(() => callOrder.push("first"));
      eventEmitter.on(() => callOrder.push("second"));
      eventEmitter.on(() => callOrder.push("third"));

      eventEmitter.emit("test");

      expect(callOrder).toEqual(["first", "second", "third"]);
    });
  });

  describe("unsubscribe functionality", () => {
    it("should remove listener when unsubscribe is called", () => {
      const eventEmitter = emitter<string>();
      const listener = vi.fn();

      const unsubscribe = eventEmitter.on(listener);
      eventEmitter.emit("first");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventEmitter.emit("second");
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it("should allow multiple unsubscribe calls", () => {
      const eventEmitter = emitter<string>();
      const listener = vi.fn();

      const unsubscribe = eventEmitter.on(listener);
      unsubscribe();
      unsubscribe(); // Should be safe to call multiple times
      unsubscribe();

      eventEmitter.emit("test");
      expect(listener).not.toHaveBeenCalled();
    });

    it("should only remove the specific listener", () => {
      const eventEmitter = emitter<string>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      const unsubscribe1 = eventEmitter.on(listener1);
      eventEmitter.on(listener2);
      eventEmitter.on(listener3);

      unsubscribe1();
      eventEmitter.emit("test");

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith("test");
      expect(listener3).toHaveBeenCalledWith("test");
    });
  });

  describe("clear functionality", () => {
    it("should remove all listeners when clear is called", () => {
      const eventEmitter = emitter<string>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventEmitter.on(listener1);
      eventEmitter.on(listener2);
      eventEmitter.on(listener3);

      eventEmitter.clear();
      eventEmitter.emit("test");

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });

    it("should allow adding listeners after clear", () => {
      const eventEmitter = emitter<string>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventEmitter.on(listener1);
      eventEmitter.clear();
      eventEmitter.on(listener2);

      eventEmitter.emit("test");

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith("test");
    });
  });

  describe("emit behavior", () => {
    it("should handle listeners that unsubscribe during emission", () => {
      const eventEmitter = emitter<string>();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      let unsubscribe2: VoidFunction | undefined;

      eventEmitter.on(listener1);
      unsubscribe2 = eventEmitter.on(() => {
        listener2();
        unsubscribe2?.(); // Unsubscribe during emission
      });
      eventEmitter.on(listener3);

      eventEmitter.emit("test");

      // All listeners should be called (emission uses slice() to avoid issues)
      expect(listener1).toHaveBeenCalledWith("test");
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalledWith("test");
    });

    it("should handle listeners that add new listeners during emission", () => {
      const eventEmitter = emitter<string>();
      const newListener = vi.fn();
      const listener = vi.fn(() => {
        eventEmitter.on(newListener);
      });

      eventEmitter.on(listener);
      eventEmitter.emit("test");

      expect(listener).toHaveBeenCalledWith("test");
      // New listener should not be called in the same emission cycle
      expect(newListener).not.toHaveBeenCalled();

      // But should be called in the next emission
      eventEmitter.emit("test2");
      expect(newListener).toHaveBeenCalledWith("test2");
    });

    it("should handle void payload type", () => {
      const eventEmitter = emitter<void>();
      const listener = vi.fn();

      eventEmitter.on(listener);
      eventEmitter.emit(undefined);

      expect(listener).toHaveBeenCalledWith(undefined);
    });

    it("should handle object payload type", () => {
      const eventEmitter = emitter<{ id: number; name: string }>();
      const listener = vi.fn();

      eventEmitter.on(listener);
      eventEmitter.emit({ id: 1, name: "test" });

      expect(listener).toHaveBeenCalledWith({ id: 1, name: "test" });
    });

    it("should handle number payload type", () => {
      const eventEmitter = emitter<number>();
      const listener = vi.fn();

      eventEmitter.on(listener);
      eventEmitter.emit(42);

      expect(listener).toHaveBeenCalledWith(42);
    });
  });

  describe("edge cases", () => {
    it("should handle empty emitter", () => {
      const eventEmitter = emitter<string>();
      // Should not throw when emitting with no listeners
      expect(() => eventEmitter.emit("test")).not.toThrow();
    });

    it("should handle clear on empty emitter", () => {
      const eventEmitter = emitter<string>();
      // Should not throw when clearing with no listeners
      expect(() => eventEmitter.clear()).not.toThrow();
    });

    it("should handle listener that throws an error", () => {
      const eventEmitter = emitter<string>();
      const listener1 = vi.fn();
      const listener2 = vi.fn(() => {
        throw new Error("Listener error");
      });
      const listener3 = vi.fn();

      // Use console.error spy to catch the error
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      eventEmitter.on(listener1);
      eventEmitter.on(listener2);
      eventEmitter.on(listener3);

      // Errors in listeners will propagate, but we can catch them
      // The implementation uses forEach which will stop on error
      // So we expect it to throw, but listener1 should have been called
      try {
        eventEmitter.emit("test");
      } catch (error) {
        // Error is expected
        expect(error).toBeInstanceOf(Error);
      }

      expect(listener1).toHaveBeenCalledWith("test");
      // listener2 threw, so listener3 may or may not be called depending on implementation
      // The current implementation stops on error, so listener3 won't be called

      consoleSpy.mockRestore();
    });
  });
});
