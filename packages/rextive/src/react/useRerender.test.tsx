import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { act, useState } from "react";
import { useRerender } from "./useRerender";

describe("useRerender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should return a callable function", () => {
      const TestComponent = () => {
        const rerender = useRerender();
        expect(typeof rerender).toBe("function");
        return <div>Test</div>;
      };

      render(<TestComponent />);
    });

    it("should have data, cancel, flush, and immediate properties", () => {
      const TestComponent = () => {
        const rerender = useRerender();
        expect(typeof rerender.data).toBeDefined();
        expect(typeof rerender.cancel).toBe("function");
        expect(typeof rerender.flush).toBe("function");
        expect(typeof rerender.immediate).toBe("function");
        return <div>Test</div>;
      };

      render(<TestComponent />);
    });

    it("should trigger re-render when called", async () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender();
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Rerender").click();
      });

      await waitFor(() => {
        expect(getByTestId("count").textContent).toBe("2");
      });
    });

    it("should update data property when called with data", async () => {
      const TestComponent = () => {
        const rerender = useRerender<{ value: number }>();
        return (
          <div>
            <button onClick={() => rerender({ value: 42 })}>Update</button>
            <span data-testid="data">
              {String(rerender.data?.value ?? "none")}
            </span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("data").textContent).toBe("none");

      act(() => {
        getByText("Update").click();
      });

      await waitFor(() => {
        expect(getByTestId("data").textContent).toBe("42");
      });
    });
  });

  describe("without debounce", () => {
    it("should call rerender immediately", async () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender();
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Rerender").click();
      });

      // Without debounce, should update immediately
      await waitFor(() => {
        expect(getByTestId("count").textContent).toBe("2");
      });
    });

    it("should have no-op cancel and flush functions", () => {
      const TestComponent = () => {
        const rerender = useRerender();
        // Should not throw
        rerender.cancel();
        rerender.flush();
        expect(rerender.cancel).toBeDefined();
        expect(rerender.flush).toBeDefined();
        return <div>Test</div>;
      };

      render(<TestComponent />);
    });

    it("should have immediate function that works the same as rerender", async () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender();
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender.immediate()}>Immediate</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Immediate").click();
      });

      await waitFor(() => {
        expect(getByTestId("count").textContent).toBe("2");
      });
    });
  });

  describe("with microtask debounce", () => {
    it("should debounce rerenders using microtask queue", async () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: "microtask" });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      // Multiple quick calls
      act(() => {
        getByText("Rerender").click();
        getByText("Rerender").click();
        getByText("Rerender").click();
      });

      // Should batch in microtask
      await waitFor(() => {
        expect(parseInt(getByTestId("count").textContent || "0")).toBeGreaterThan(1);
      });
    });

    it("should cancel microtask-debounced rerender as no-op", async () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: "microtask" });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <button onClick={() => rerender.cancel()}>Cancel</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      
      // Cancel should work without error (no-op for microtask)
      expect(() => {
        act(() => {
          getByText("Cancel").click();
        });
      }).not.toThrow();
    });

    it("should handle flush as no-op for microtask", () => {
      const TestComponent = () => {
        const rerender = useRerender({ debounce: "microtask" });
        return (
          <div>
            <button onClick={() => rerender.flush()}>Flush</button>
          </div>
        );
      };

      const { getByText } = render(<TestComponent />);
      
      expect(() => {
        act(() => {
          getByText("Flush").click();
        });
      }).not.toThrow();
    });
  });

  describe("with debounce", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should debounce multiple rapid calls", async () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: 100 });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        // Call multiple times rapidly
        getByText("Rerender").click();
        getByText("Rerender").click();
        getByText("Rerender").click();
      });

      // Should still be 1 before debounce timeout
      expect(getByTestId("count").textContent).toBe("1");

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should only render once more (total 2) after debounce
      expect(getByTestId("count").textContent).toBe("2");
    });

    it("should cancel pending debounced calls", () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: 100 });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <button onClick={() => rerender.cancel()}>Cancel</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Rerender").click();
      });

      // Cancel before timeout
      act(() => {
        getByText("Cancel").click();
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should not have rendered again
      expect(getByTestId("count").textContent).toBe("1");
    });

    it("should flush pending debounced calls immediately", () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: 100 });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <button onClick={() => rerender.flush()}>Flush</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Rerender").click();
      });

      // Should still be 1 before flush
      expect(getByTestId("count").textContent).toBe("1");

      // Flush immediately
      act(() => {
        getByText("Flush").click();
      });

      // Should have rendered immediately
      expect(getByTestId("count").textContent).toBe("2");
    });

    it("should update data property with debounced rerender", async () => {
      const TestComponent = () => {
        const rerender = useRerender<{ value: number }>({ debounce: 100 });
        return (
          <div>
            <button onClick={() => rerender({ value: 42 })}>Update</button>
            <span data-testid="data">
              {String(rerender.data?.value ?? "none")}
            </span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("data").textContent).toBe("none");

      act(() => {
        getByText("Update").click();
      });

      // Should still be "none" before debounce timeout
      expect(getByTestId("data").textContent).toBe("none");

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(getByTestId("data").textContent).toBe("42");
    });

    it("should use immediate function to bypass debounce", () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: 100 });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender.immediate()}>Immediate</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Immediate").click();
      });

      // Should update immediately, bypassing debounce
      expect(getByTestId("count").textContent).toBe("2");
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should handle multiple rapid calls with different data", () => {
      const TestComponent = () => {
        const rerender = useRerender<{ value: number }>({ debounce: 100 });
        return (
          <div>
            <button onClick={() => rerender({ value: 1 })}>Set 1</button>
            <button onClick={() => rerender({ value: 2 })}>Set 2</button>
            <button onClick={() => rerender({ value: 3 })}>Set 3</button>
            <span data-testid="data">
              {String(rerender.data?.value ?? "none")}
            </span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("data").textContent).toBe("none");

      act(() => {
        getByText("Set 1").click();
        getByText("Set 2").click();
        getByText("Set 3").click();
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should have the last value (3) after debounce
      expect(getByTestId("data").textContent).toBe("3");
    });

    it("should handle cancel after flush", () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: 100 });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <button onClick={() => rerender.flush()}>Flush</button>
            <button onClick={() => rerender.cancel()}>Cancel</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Rerender").click();
        getByText("Flush").click();
        getByText("Cancel").click(); // Should be no-op after flush
      });

      expect(getByTestId("count").textContent).toBe("2");
    });

    it("should handle multiple cancel calls", () => {
      const TestComponent = () => {
        const rerender = useRerender({ debounce: 100 });
        // Should not throw
        rerender.cancel();
        rerender.cancel();
        rerender.cancel();
        return <div>Test</div>;
      };

      render(<TestComponent />);
    });

    it("should handle multiple flush calls", () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: 100 });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <button onClick={() => rerender.flush()}>Flush</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Rerender").click();
        getByText("Flush").click();
        getByText("Flush").click(); // Second flush should be no-op
      });

      expect(getByTestId("count").textContent).toBe("2");
    });

    it("should handle zero debounce time", async () => {
      let renderCount = 0;
      const TestComponent = () => {
        const rerender = useRerender({ debounce: 0 });
        renderCount++;
        return (
          <div>
            <button onClick={() => rerender()}>Rerender</button>
            <span data-testid="count">{renderCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("count").textContent).toBe("1");

      act(() => {
        getByText("Rerender").click();
      });

      // With 0 debounce, lodash debounce still uses setTimeout, so advance timers
      act(() => {
        vi.advanceTimersByTime(1);
      });

      // Should update after debounce
      expect(getByTestId("count").textContent).toBe("2");
    });

    it("should maintain data across multiple rerenders", () => {
      const TestComponent = () => {
        const rerender = useRerender<{ count: number }>({ debounce: 50 });
        const [localCount, setLocalCount] = useState(0);

        return (
          <div>
            <button
              onClick={() => {
                const newCount = localCount + 1;
                setLocalCount(newCount);
                rerender({ count: newCount });
              }}
            >
              Increment
            </button>
            <span data-testid="data">
              {String(rerender.data?.count ?? "none")}
            </span>
            <span data-testid="local">{localCount}</span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("data").textContent).toBe("none");
      expect(getByTestId("local").textContent).toBe("0");

      act(() => {
        getByText("Increment").click();
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(getByTestId("data").textContent).toBe("1");
      expect(getByTestId("local").textContent).toBe("1");
    });
  });

  describe("type safety", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should work with typed data", () => {
      interface TestData {
        name: string;
        age: number;
      }

      const TestComponent = () => {
        const rerender = useRerender<TestData>({ debounce: 50 });
        return (
          <div>
            <button onClick={() => rerender({ name: "Alice", age: 30 })}>
              Update
            </button>
            <span data-testid="name">{rerender.data?.name ?? "none"}</span>
            <span data-testid="age">
              {String(rerender.data?.age ?? "none")}
            </span>
          </div>
        );
      };

      const { getByText, getByTestId } = render(<TestComponent />);
      expect(getByTestId("name").textContent).toBe("none");
      expect(getByTestId("age").textContent).toBe("none");

      act(() => {
        getByText("Update").click();
      });

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(getByTestId("name").textContent).toBe("Alice");
      expect(getByTestId("age").textContent).toBe("30");
    });
  });
});
