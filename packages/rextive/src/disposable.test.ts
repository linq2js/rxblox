import { disposable, DisposalAggregateError } from "./disposable";
import { describe, it, expect, vi } from "vitest";

describe("disposable", () => {
  describe("merge strategy: overwrite (default)", () => {
    it("should merge all properties from multiple disposables", () => {
      const service1 = {
        func1: () => "service1",
        dispose: vi.fn(),
      };

      const service2 = {
        func2: () => "service2",
        dispose: vi.fn(),
      };

      const combined = disposable([service1, service2]);

      expect(combined.func1()).toBe("service1");
      expect(combined.func2()).toBe("service2");
    });

    it("should overwrite conflicting properties (last wins)", () => {
      const service1 = {
        value: 1,
        dispose: vi.fn(),
      };

      const service2 = {
        value: 2,
        dispose: vi.fn(),
      };

      const combined = disposable([service1, service2]);

      expect(combined.value).toBe(2); // service2 wins
    });

    it("should overwrite conflicting methods (last wins)", () => {
      const service1 = {
        save: () => "service1",
        dispose: vi.fn(),
      };

      const service2 = {
        save: () => "service2",
        dispose: vi.fn(),
      };

      const combined = disposable([service1, service2]);

      expect(combined.save()).toBe("service2"); // service2 wins
    });

    it("should not overwrite dispose method", () => {
      const service1 = {
        func1: () => "service1",
        dispose: vi.fn(),
      };

      const service2 = {
        func2: () => "service2",
        dispose: vi.fn(),
      };

      const combined = disposable([service1, service2]);

      combined.dispose();

      // Both should be called
      expect(service1.dispose).toHaveBeenCalledTimes(1);
      expect(service2.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe("merge strategy: error", () => {
    it("should throw error on property conflict", () => {
      const service1 = {
        value: 1,
        dispose: vi.fn(),
      };

      const service2 = {
        value: 2,
        dispose: vi.fn(),
      };

      expect(() => {
        disposable([service1, service2], { merge: "error" });
      }).toThrow("Property conflict: 'value' exists in multiple services");
    });

    it("should throw error on method conflict", () => {
      const service1 = {
        save: () => 1,
        dispose: vi.fn(),
      };

      const service2 = {
        save: () => 2,
        dispose: vi.fn(),
      };

      expect(() => {
        disposable([service1, service2], { merge: "error" });
      }).toThrow("Property conflict: 'save' exists in multiple services");
    });

    it("should not throw on dispose method (always allowed)", () => {
      const service1 = {
        func1: () => 1,
        dispose: vi.fn(),
      };

      const service2 = {
        func2: () => 2,
        dispose: vi.fn(),
      };

      expect(() => {
        disposable([service1, service2], { merge: "error" });
      }).not.toThrow();
    });

    it("should merge when no conflicts exist", () => {
      const service1 = {
        func1: () => "service1",
        dispose: vi.fn(),
      };

      const service2 = {
        func2: () => "service2",
        dispose: vi.fn(),
      };

      const combined = disposable([service1, service2], { merge: "error" });

      expect(combined.func1()).toBe("service1");
      expect(combined.func2()).toBe("service2");
    });
  });

  describe("dispose behavior", () => {
    it("should call all dispose methods in reverse order (LIFO)", () => {
      const order: number[] = [];

      const service1 = {
        dispose: vi.fn(() => order.push(1)),
      };

      const service2 = {
        dispose: vi.fn(() => order.push(2)),
      };

      const service3 = {
        dispose: vi.fn(() => order.push(3)),
      };

      const combined = disposable([service1, service2, service3]);
      combined.dispose();

      expect(order).toEqual([3, 2, 1]); // Reverse order
      expect(service1.dispose).toHaveBeenCalledTimes(1);
      expect(service2.dispose).toHaveBeenCalledTimes(1);
      expect(service3.dispose).toHaveBeenCalledTimes(1);
    });

    it("should collect all disposal errors and throw DisposalAggregateError", () => {
      const error1 = new Error("Error 1");
      const error2 = new Error("Error 2");

      const service1 = {
        dispose: vi.fn(() => {
          throw error1;
        }),
      };

      const service2 = {
        dispose: vi.fn(() => {
          throw error2;
        }),
      };

      const service3 = {
        dispose: vi.fn(), // This should still be called
      };

      const combined = disposable([service1, service2, service3]);

      expect.hasAssertions();

      try {
        combined.dispose();
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(DisposalAggregateError);
        expect((error as DisposalAggregateError).errors).toHaveLength(2);
        expect((error as DisposalAggregateError).errors[0].cause).toBe(error2); // Reverse order
        expect((error as DisposalAggregateError).errors[1].cause).toBe(error1);
        expect((error as DisposalAggregateError).message).toContain(
          "Failed to dispose 2 service(s)"
        );
      }

      // All dispose methods should be called despite errors
      expect(service1.dispose).toHaveBeenCalledTimes(1);
      expect(service2.dispose).toHaveBeenCalledTimes(1);
      expect(service3.dispose).toHaveBeenCalledTimes(1);
    });

    it("should continue disposing even if one fails", () => {
      const service1 = {
        dispose: vi.fn(() => {
          throw new Error("Fail");
        }),
      };

      const service2 = {
        dispose: vi.fn(),
      };

      const combined = disposable([service1, service2]);

      expect(() => {
        combined.dispose();
      }).toThrow(DisposalAggregateError);

      expect(service1.dispose).toHaveBeenCalled();
      expect(service2.dispose).toHaveBeenCalled(); // Should still be called
    });

    it("should warn if dispose is called multiple times", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const service = {
        dispose: vi.fn(),
      };

      const combined = disposable([service]);

      combined.dispose();
      combined.dispose(); // Second call

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Already disposed")
      );

      // Should only dispose once
      expect(service.dispose).toHaveBeenCalledTimes(1);

      consoleWarnSpy.mockRestore();
    });
  });

  describe("lifecycle callbacks", () => {
    it("should call onBefore before disposing", () => {
      const order: string[] = [];

      const service = {
        dispose: vi.fn(() => order.push("dispose")),
      };

      const combined = disposable([service], {
        onBefore: () => order.push("before"),
      });

      combined.dispose();

      expect(order).toEqual(["before", "dispose"]);
    });

    it("should call onAfter after disposing", () => {
      const order: string[] = [];

      const service = {
        dispose: vi.fn(() => order.push("dispose")),
      };

      const combined = disposable([service], {
        onAfter: () => order.push("after"),
      });

      combined.dispose();

      expect(order).toEqual(["dispose", "after"]);
    });

    it("should call onBefore and onAfter in correct order", () => {
      const order: string[] = [];

      const service1 = {
        dispose: vi.fn(() => order.push("service1")),
      };

      const service2 = {
        dispose: vi.fn(() => order.push("service2")),
      };

      const combined = disposable([service1, service2], {
        onBefore: () => order.push("before"),
        onAfter: () => order.push("after"),
      });

      combined.dispose();

      expect(order).toEqual(["before", "service2", "service1", "after"]);
    });

    it("should call onAfter even if dispose throws", () => {
      const service = {
        dispose: vi.fn(() => {
          throw new Error("Fail");
        }),
      };

      const onAfter = vi.fn();

      const combined = disposable([service], { onAfter });

      expect(() => {
        combined.dispose();
      }).toThrow(DisposalAggregateError);

      expect(onAfter).toHaveBeenCalled();
    });

    it("should not call callbacks on second dispose", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const onBefore = vi.fn();
      const onAfter = vi.fn();

      const service = {
        dispose: vi.fn(),
      };

      const combined = disposable([service], { onBefore, onAfter });

      combined.dispose();
      combined.dispose(); // Second call

      expect(onBefore).toHaveBeenCalledTimes(1);
      expect(onAfter).toHaveBeenCalledTimes(1);

      consoleWarnSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle empty services array", () => {
      const combined = disposable([]);

      expect(() => {
        combined.dispose();
      }).not.toThrow();
    });

    it("should handle single service", () => {
      const service = {
        func1: () => "test",
        dispose: vi.fn(),
      };

      const combined = disposable([service]);

      expect(combined.func1()).toBe("test");
      combined.dispose();
      expect(service.dispose).toHaveBeenCalledTimes(1);
    });

    it("should preserve method binding", () => {
      const service = {
        value: 42,
        getValue() {
          return this.value;
        },
        dispose: vi.fn(),
      };

      const combined = disposable([service]);

      expect(combined.getValue()).toBe(42);
    });

    it("should handle services without dispose method", () => {
      const service1 = {
        func1: () => "test",
      };

      const service2 = {
        func2: () => "test2",
        dispose: vi.fn(),
      };

      const combined = disposable([service1 as any, service2]);

      expect(() => {
        combined.dispose();
      }).not.toThrow();

      expect(service2.dispose).toHaveBeenCalled();
    });
  });

  describe("DisposalAggregateError", () => {
    it("should contain all errors", () => {
      const error1 = new Error("Error 1");
      const error2 = new Error("Error 2");

      const service1 = {
        dispose: () => {
          throw error1;
        },
      };

      const service2 = {
        dispose: () => {
          throw error2;
        },
      };

      const combined = disposable([service1, service2]);

      expect.hasAssertions();

      try {
        combined.dispose();
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(DisposalAggregateError);
        const aggError = error as DisposalAggregateError;
        expect(aggError.errors).toHaveLength(2);
        expect(aggError.errors[0].cause).toBe(error2);
        expect(aggError.errors[1].cause).toBe(error1);
      }
    });

    it("should have descriptive message", () => {
      const service1 = {
        dispose: () => {
          throw new Error("Fail 1");
        },
      };

      const service2 = {
        dispose: () => {
          throw new Error("Fail 2");
        },
      };

      const combined = disposable([service1, service2]);

      try {
        combined.dispose();
      } catch (error) {
        expect((error as DisposalAggregateError).message).toBe(
          "Failed to dispose 2 service(s)"
        );
      }
    });
  });
});
