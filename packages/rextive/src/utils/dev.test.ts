import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { devLog, devWarn, devError, devOnly, devAssert } from "./dev";

describe("dev utilities", () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("devLog", () => {
    it("should log in development", () => {
      devLog("test message", { data: 123 });

      // In test environment (__DEV__ is true), it should log
      expect(consoleLogSpy).toHaveBeenCalledWith("[rextive] test message", {
        data: 123,
      });
    });

    it("should prefix messages with [rextive]", () => {
      devLog("hello");

      expect(consoleLogSpy).toHaveBeenCalledWith("[rextive] hello");
    });
  });

  describe("devWarn", () => {
    it("should warn in development", () => {
      devWarn("warning message");

      expect(consoleWarnSpy).toHaveBeenCalledWith("[rextive] warning message");
    });

    it("should support multiple arguments", () => {
      devWarn("deprecated", "feature", 123);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[rextive] deprecated",
        "feature",
        123
      );
    });
  });

  describe("devError", () => {
    it("should error in development", () => {
      devError("error message");

      expect(consoleErrorSpy).toHaveBeenCalledWith("[rextive] error message");
    });
  });

  describe("devOnly", () => {
    it("should execute function in development", () => {
      const mockFn = vi.fn();
      devOnly(mockFn);

      // In test environment (__DEV__ is true), function should execute
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should execute complex logic", () => {
      let executed = false;
      devOnly(() => {
        executed = true;
      });

      expect(executed).toBe(true);
    });
  });

  describe("devAssert", () => {
    it("should pass when condition is true", () => {
      expect(() => devAssert(true, "should not throw")).not.toThrow();
    });

    it("should throw when condition is false", () => {
      expect(() => devAssert(false, "test failure")).toThrow(
        "[rextive] Assertion failed: test failure"
      );
    });

    it("should throw with custom message", () => {
      const a: any = 1;
      const b: any = 2;
      expect(() => devAssert(a === b, "math is broken")).toThrow(
        "[rextive] Assertion failed: math is broken"
      );
    });
  });
});
