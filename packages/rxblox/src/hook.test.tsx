import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { blox, signal, rx } from "./index";
import { hook } from "./hook";
import { useState, useRef } from "react";

describe("hook", () => {
  it("should capture hook results", () => {
    const Component = blox(() => {
      const count = signal(0);

      const captured = blox.hook(() => {
        const [state] = useState("hello");
        return state;
      });

      return (
        <div>
          {/* Use rx() to access captured value reactively */}
          {rx(() => (
            <div data-testid="captured">{captured.current}</div>
          ))}
          {rx(() => (
            <div data-testid="count">{count()}</div>
          ))}
          <button onClick={() => count.set(count() + 1)}>Increment</button>
        </div>
      );
    });

    render(<Component />);

    expect(screen.getByTestId("captured")).toHaveTextContent("hello");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("should capture multiple hooks", () => {
    const Component = blox(() => {
      const captured = blox.hook(() => {
        const [stateA] = useState("A");
        const [stateB] = useState("B");
        const refC = useRef("C");
        return { stateA, stateB, refC: refC.current };
      });

      return rx(() => (
        <div>
          <div data-testid="a">{captured.current?.stateA}</div>
          <div data-testid="b">{captured.current?.stateB}</div>
          <div data-testid="c">{captured.current?.refC}</div>
        </div>
      ));
    });

    render(<Component />);

    expect(screen.getByTestId("a")).toHaveTextContent("A");
    expect(screen.getByTestId("b")).toHaveTextContent("B");
    expect(screen.getByTestId("c")).toHaveTextContent("C");
  });

  it("should capture latest hook values across renders", () => {
    let renderCount = 0;

    const Component = blox(() => {
      const captured = blox.hook(() => {
        renderCount++;
        return renderCount;
      });

      return rx(() => <div data-testid="captured">{captured.current}</div>);
    });

    const { rerender } = render(<Component />);
    expect(screen.getByTestId("captured")).toHaveTextContent("1");

    // Force a rerender by providing new props (even if empty)
    rerender(<Component key="2" />);
    expect(screen.getByTestId("captured")).toHaveTextContent("2");

    rerender(<Component key="3" />);
    expect(screen.getByTestId("captured")).toHaveTextContent("3");
  });

  it("should be undefined in builder phase, available in event handlers", () => {
    let capturedHook: ReturnType<typeof hook<string>> | undefined;
    let builderPhaseValue: string | undefined;

    const Component = blox(() => {
      capturedHook = blox.hook(() => {
        return "value";
      });

      // At this point in builder phase, current is still undefined
      builderPhaseValue = capturedHook.current;

      return (
        <div>
          {/* Must use rx() to access the value in JSX */}
          {rx(() => (
            <div data-testid="captured">{capturedHook?.current}</div>
          ))}
        </div>
      );
    });

    render(<Component />);

    // In builder phase, it was undefined
    expect(builderPhaseValue).toBe(undefined);

    // But in JSX with rx(), it's available
    expect(screen.getByTestId("captured")).toHaveTextContent("value");

    // And after render completes, it's available
    expect(capturedHook?.current).toBe("value");
  });

  it("should work with event handlers", () => {
    const mockFn = vi.fn();

    const Component = blox(() => {
      const count = signal(0);

      const captured = blox.hook(() => {
        return { id: Math.random() };
      });

      const handleClick = () => {
        mockFn(captured.current?.id);
      };

      return (
        <div>
          {rx(() => (
            <div data-testid="count">{count()}</div>
          ))}
          <button onClick={handleClick} data-testid="button">
            Click
          </button>
        </div>
      );
    });

    render(<Component />);

    screen.getByTestId("button").click();

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(expect.any(Number));
  });

  it("should work with complex return types", () => {
    interface CapturedData {
      name: string;
      age: number;
      nested: {
        value: boolean;
      };
    }

    const Component = blox(() => {
      const captured = blox.hook<CapturedData>(() => {
        return {
          name: "John",
          age: 30,
          nested: {
            value: true,
          },
        };
      });

      return rx(() => (
        <div>
          <div data-testid="name">{captured.current?.name}</div>
          <div data-testid="age">{captured.current?.age}</div>
          <div data-testid="nested">
            {String(captured.current?.nested.value)}
          </div>
        </div>
      ));
    });

    render(<Component />);

    expect(screen.getByTestId("name")).toHaveTextContent("John");
    expect(screen.getByTestId("age")).toHaveTextContent("30");
    expect(screen.getByTestId("nested")).toHaveTextContent("true");
  });

  it("should handle callback throwing errors", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const Component = blox(() => {
      const captured = blox.hook(() => {
        throw new Error("Test error");
      });

      return rx(() => (
        <div data-testid="result">{String(captured.current)}</div>
      ));
    });

    expect(() => render(<Component />)).toThrow("Test error");

    consoleError.mockRestore();
  });
});
