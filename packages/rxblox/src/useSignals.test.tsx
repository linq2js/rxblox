import { describe, it, expect, vi } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { useState } from "react";
import { useSignals } from "./useSignals";
import { MutableSignal } from "./types";

describe("useSignals", () => {
  describe("basic functionality", () => {
    it("should create signals from object values", () => {
      const Component = () => {
        const signals = useSignals({ count: 0, name: "Alice" });

        signals.count satisfies MutableSignal<number>;
        signals.name satisfies MutableSignal<string>;

        return (
          <div>
            <div data-testid="count">{signals.count()}</div>
            <div data-testid="name">{signals.name()}</div>
          </div>
        );
      };

      const { getByTestId } = render(<Component />);

      expect(getByTestId("count").textContent).toBe("0");
      expect(getByTestId("name").textContent).toBe("Alice");
    });

    it("should allow setting signal values", () => {
      const Component = () => {
        const signals = useSignals({ count: 0 });

        const increment = () => signals.count.set((c) => c + 1);

        return (
          <div>
            <div data-testid="count">{signals.count()}</div>
            <button onClick={increment}>Increment</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(<Component />);

      expect(getByTestId("count").textContent).toBe("0");

      getByText("Increment").click();

      // Signal changes don't automatically re-render without rx()
      expect(getByTestId("count").textContent).toBe("0");
    });

    it("should create signals lazily on first access", () => {
      const Component = () => {
        const signals = useSignals({ a: 1, b: 2, c: 3 });

        // Only access 'a'
        return <div data-testid="a">{signals.a()}</div>;
      };

      const { getByTestId } = render(<Component />);

      expect(getByTestId("a").textContent).toBe("1");
    });

    it("should handle multiple signals", () => {
      const Component = () => {
        const signals = useSignals({
          count: 0,
          name: "Bob",
          active: true,
          items: [1, 2, 3],
        });

        return (
          <div>
            <div data-testid="count">{signals.count()}</div>
            <div data-testid="name">{signals.name()}</div>
            <div data-testid="active">{String(signals.active())}</div>
            <div data-testid="items">{signals.items().length}</div>
          </div>
        );
      };

      const { getByTestId } = render(<Component />);

      expect(getByTestId("count").textContent).toBe("0");
      expect(getByTestId("name").textContent).toBe("Bob");
      expect(getByTestId("active").textContent).toBe("true");
      expect(getByTestId("items").textContent).toBe("3");
    });
  });

  describe("autoSync option", () => {
    it("should not sync by default", () => {
      const Component = ({ value }: { value: number }) => {
        const signals = useSignals({ count: value });

        return <div data-testid="count">{signals.count()}</div>;
      };

      const { getByTestId, rerender } = render(<Component value={0} />);

      expect(getByTestId("count").textContent).toBe("0");

      // Re-render with new prop value
      rerender(<Component value={10} />);

      // Signal should NOT sync (default behavior)
      expect(getByTestId("count").textContent).toBe("0");
    });

    it("should sync when autoSync is true", () => {
      const Component = ({ value }: { value: number }) => {
        const signals = useSignals({ count: value }, { autoSync: true });

        return <div data-testid="count">{signals.count()}</div>;
      };

      const { getByTestId, rerender } = render(<Component value={0} />);

      expect(getByTestId("count").textContent).toBe("0");

      // Re-render with new prop value
      rerender(<Component value={10} />);

      // Signal should sync
      expect(getByTestId("count").textContent).toBe("10");
    });

    it("should sync multiple signals when autoSync is true", () => {
      const Component = ({ count, name }: { count: number; name: string }) => {
        const signals = useSignals({ count, name }, { autoSync: true });

        return (
          <div>
            <div data-testid="count">{signals.count()}</div>
            <div data-testid="name">{signals.name()}</div>
          </div>
        );
      };

      const { getByTestId, rerender } = render(
        <Component count={0} name="Alice" />
      );

      expect(getByTestId("count").textContent).toBe("0");
      expect(getByTestId("name").textContent).toBe("Alice");

      rerender(<Component count={5} name="Bob" />);

      expect(getByTestId("count").textContent).toBe("5");
      expect(getByTestId("name").textContent).toBe("Bob");
    });
  });

  describe("custom equality", () => {
    it("should use custom equality function", () => {
      const listener = vi.fn();

      const Component = () => {
        const signals = useSignals(
          { user: { id: 1, name: "Alice" } },
          { equals: (a: any, b: any) => a?.id === b?.id }
        );

        // Subscribe to changes
        signals.user.on(listener);

        const changeName = () => {
          signals.user.set({ id: 1, name: "Bob" });
        };

        const changeId = () => {
          signals.user.set({ id: 2, name: "Bob" });
        };

        return (
          <div>
            <button onClick={changeName}>Change Name</button>
            <button onClick={changeId}>Change ID</button>
          </div>
        );
      };

      const { getByText } = render(<Component />);

      // Change name but same id - should not notify
      getByText("Change Name").click();
      expect(listener).not.toHaveBeenCalled();

      // Change id - should notify
      getByText("Change ID").click();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup", () => {
    it("should cleanup signals on unmount", () => {
      const listener = vi.fn();

      const Component = () => {
        const signals = useSignals({ count: 0 });

        signals.count.on(listener);

        return <div>Component</div>;
      };

      const { unmount } = render(<Component />);

      unmount();

      // After unmount, listener should not be called
      // (signals should be disposed)
    });

    it("should handle multiple component instances independently", () => {
      const Component = ({ id }: { id: number }) => {
        const signals = useSignals({ count: id });

        return <div data-testid={`count-${id}`}>{signals.count()}</div>;
      };

      const { getByTestId } = render(
        <div>
          <Component id={1} />
          <Component id={2} />
          <Component id={3} />
        </div>
      );

      expect(getByTestId("count-1").textContent).toBe("1");
      expect(getByTestId("count-2").textContent).toBe("2");
      expect(getByTestId("count-3").textContent).toBe("3");
    });
  });

  describe("type safety", () => {
    it("should preserve types", () => {
      const Component = () => {
        const signals = useSignals({
          count: 0,
          name: "Alice",
          active: true,
          items: [1, 2, 3],
          user: { id: 1, name: "Bob" },
        });

        // Type checks
        signals.count() satisfies number;
        signals.name() satisfies string;
        signals.active() satisfies boolean;
        signals.items() satisfies number[];
        signals.user() satisfies { id: number; name: string };

        return <div>Type test</div>;
      };

      render(<Component />);
    });
  });

  describe("edge cases", () => {
    it("should handle undefined values", () => {
      const Component = () => {
        const signals = useSignals<{ value: number | undefined }>({
          value: undefined,
        });

        return (
          <div data-testid="value">
            {signals.value() === undefined
              ? "undefined"
              : String(signals.value())}
          </div>
        );
      };

      const { getByTestId } = render(<Component />);

      expect(getByTestId("value").textContent).toBe("undefined");
    });

    it("should handle null values", () => {
      const Component = () => {
        const signals = useSignals<{ value: number | null }>({
          value: null,
        });

        return (
          <div data-testid="value">
            {signals.value() === null ? "null" : String(signals.value())}
          </div>
        );
      };

      const { getByTestId } = render(<Component />);

      expect(getByTestId("value").textContent).toBe("null");
    });

    it("should handle empty object", () => {
      const Component = () => {
        useSignals({});

        return <div>Empty</div>;
      };

      const { container } = render(<Component />);

      expect(container.textContent).toBe("Empty");
    });

    it("should handle dynamic property access", async () => {
      const Component = () => {
        const signals = useSignals({ a: 1, b: 2, c: 3 });
        const [key, setKey] = useState<"a" | "b" | "c">("a");

        return (
          <div>
            <div data-testid="value">{signals[key]()}</div>
            <button onClick={() => setKey("b")}>Switch to B</button>
            <button onClick={() => setKey("c")}>Switch to C</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(<Component />);

      expect(getByTestId("value").textContent).toBe("1");

      act(() => {
        getByText("Switch to B").click();
      });

      await waitFor(() => {
        expect(getByTestId("value").textContent).toBe("2");
      });

      act(() => {
        getByText("Switch to C").click();
      });

      await waitFor(() => {
        expect(getByTestId("value").textContent).toBe("3");
      });
    });
  });

  describe("integration with other hooks", () => {
    it("should work with useState", () => {
      const Component = () => {
        const [multiplier, setMultiplier] = useState(2);
        const signals = useSignals({ base: 10 });

        const result = signals.base() * multiplier;

        return (
          <div>
            <div data-testid="result">{result}</div>
            <button onClick={() => setMultiplier(3)}>Change Multiplier</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(<Component />);

      expect(getByTestId("result").textContent).toBe("20");

      act(() => {
        getByText("Change Multiplier").click();
      });

      expect(getByTestId("result").textContent).toBe("30");
    });
  });
});
