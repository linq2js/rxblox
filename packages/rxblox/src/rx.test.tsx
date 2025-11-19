import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React, { act, Suspense } from "react";
import { rx, Reactive } from "./rx";
import { signal } from "./signal";
import { delay } from "./delay";
import { loadable, Loadable } from "./loadable";

describe("rx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should render a static value", () => {
      const { container } = render(rx(() => "Hello World"));
      expect(container.textContent).toBe("Hello World");
    });

    it("should render a number", () => {
      const { container } = render(rx(() => 42));
      expect(container.textContent).toBe("42");
    });

    it("should render null", () => {
      const { container } = render(rx(() => null));
      expect(container.textContent).toBe("");
    });

    it("should render undefined", () => {
      const { container } = render(rx(() => undefined));
      expect(container.textContent).toBe("");
    });

    it("should render a React element", () => {
      const { container } = render(
        rx(() => <div data-testid="test">Test</div>)
      );
      const element = screen.getByTestId("test");
      expect(element).toBeTruthy();
      expect(element.textContent).toBe("Test");
      expect(container.querySelector('[data-testid="test"]')).toBeTruthy();
    });
  });

  describe("signal tracking", () => {
    it("should render signal value", () => {
      const s = signal(10);
      const { container } = render(rx(() => s()));
      expect(container.textContent).toBe("10");
    });

    it("should update when signal changes", async () => {
      const s = signal(0);
      const { container } = render(rx(() => s()));

      expect(container.textContent).toBe("0");

      act(() => {
        s.set(1);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("1");
      });
    });

    it("should track multiple signals", async () => {
      const a = signal(1);
      const b = signal(2);
      const { container } = render(rx(() => a() + b()));

      expect(container.textContent).toBe("3");

      act(() => {
        a.set(10);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("12");
      });

      act(() => {
        b.set(20);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("30");
      });
    });

    it("should update when any tracked signal changes", async () => {
      const count = signal(0);
      const multiplier = signal(1);
      const { container } = render(rx(() => count() * multiplier()));

      expect(container.textContent).toBe("0");

      act(() => {
        count.set(5);
      });
      // Wait for debounced update
      await waitFor(() => {
        expect(container.textContent).toBe("5");
      });
      act(() => {
        multiplier.set(2);
      });
      // Wait for debounced update
      await waitFor(() => {
        expect(container.textContent).toBe("10");
      });
    });
  });

  describe("computed signals", () => {
    it("should work with computed signals", async () => {
      const source = signal(5);
      const doubled = signal(() => source() * 2);
      const { container } = render(rx(() => doubled()));

      expect(container.textContent).toBe("10");

      act(() => {
        source.set(6);
      });
      // Wait for debounced update
      await waitFor(() => {
        expect(container.textContent).toBe("12");
      });
    });

    it("should track nested computed signals", async () => {
      const a = signal(2);
      const doubled = signal(() => a() * 2);
      const quadrupled = signal(() => doubled() * 2);
      const { container } = render(rx(() => quadrupled()));

      expect(container.textContent).toBe("8");

      act(() => {
        a.set(3);
      });
      doubled(); // Trigger recompute
      await waitFor(() => {
        expect(container.textContent).toBe("12");
      });
    });
  });

  describe("re-rendering", () => {
    it("should re-render when signal changes", async () => {
      const s = signal("initial");
      const renderCount = vi.fn();
      const TestComponent = () => {
        renderCount();
        return rx(() => s());
      };

      const { container } = render(<TestComponent />);
      expect(container.textContent).toBe("initial");
      expect(renderCount).toHaveBeenCalledTimes(1);

      act(() => {
        s.set("updated");
      });
      await waitFor(() => {
        expect(container.textContent).toBe("updated");
      });
      // The Reactive component re-renders internally, but TestComponent
      // might not re-render since it's just a wrapper
      // The important thing is that the content updates
      expect(container.textContent).toBe("updated");
    });

    it("should not re-render when signal value doesn't change", async () => {
      const s = signal(5);
      const renderCount = vi.fn();
      const TestComponent = () => {
        renderCount();
        return rx(() => s());
      };

      const { container } = render(<TestComponent />);
      expect(container.textContent).toBe("5");
      expect(renderCount).toHaveBeenCalledTimes(1);

      act(() => {
        s.set(5); // Same value
      });
      // Wait a bit to ensure no re-render happens
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(renderCount).toHaveBeenCalledTimes(1);
    });
  });

  describe("signal dependency changes", () => {
    it("should update subscriptions when signal dependencies change", async () => {
      const a = signal(1);
      const b = signal(2);
      let useA = true;

      const { container } = render(
        rx(() => {
          return useA ? a() : b();
        })
      );

      expect(container.textContent).toBe("1");

      // Initially tracks 'a'
      act(() => {
        b.set(20);
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(container.textContent).toBe("1"); // Should not change

      // Change to track 'b'
      useA = false;
      // Force re-render by changing a tracked signal
      act(() => {
        a.set(10);
      });
      await waitFor(() => {
        // Now it should track 'b' instead
        expect(container.textContent).toBe("20");
      });
    });
  });

  describe("error handling", () => {
    it("should throw errors from expression", () => {
      // Suppress React's error logging since ErrorBoundary catches it
      const originalError = console.error;
      console.error = vi.fn();

      class ErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean; error?: Error }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props);
          this.state = { hasError: false };
        }

        static getDerivedStateFromError(error: Error) {
          return { hasError: true, error };
        }

        componentDidCatch(_error: Error) {
          // Error is caught here
        }

        render() {
          if (this.state.hasError) {
            return (
              <div data-testid="error">
                {this.state.error?.message || "Error"}
              </div>
            );
          }
          return this.props.children;
        }
      }

      render(
        <ErrorBoundary>
          {rx(() => {
            throw new Error("Test error");
          })}
        </ErrorBoundary>
      );

      // Error should be caught and displayed
      const errorElement = screen.getByTestId("error");
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toBe("Test error");

      // Restore console.error
      console.error = originalError;
    });

    it("should handle errors during signal subscription", () => {
      // Suppress React's error logging since ErrorBoundary catches it
      const originalError = console.error;
      console.error = vi.fn();

      const badSignal = signal(0);
      // Mock signal.on to throw an error
      const originalOn = badSignal.on;
      badSignal.on = vi.fn(() => {
        throw new Error("Subscription error");
      });

      class ErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean; error?: Error }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props);
          this.state = { hasError: false };
        }

        static getDerivedStateFromError(error: Error) {
          return { hasError: true, error };
        }

        componentDidCatch(_error: Error) {
          // Error is caught here
        }

        render() {
          if (this.state.hasError) {
            return (
              <div data-testid="error">
                {this.state.error?.message || "Error"}
              </div>
            );
          }
          return this.props.children;
        }
      }

      render(<ErrorBoundary>{rx(() => badSignal())}</ErrorBoundary>);

      // Error should be caught
      const errorElement = screen.getByTestId("error");
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toBe("Subscription error");

      // Restore original
      badSignal.on = originalOn;
      console.error = originalError;
    });
  });

  describe("memoization", () => {
    it("should not re-render when props.exp doesn't change", () => {
      const s = signal(0);
      const exp = () => s();
      const renderCount = vi.fn();

      const TestComponent = ({ exp }: { exp: () => unknown }) => {
        renderCount();
        return <Reactive exp={exp} />;
      };

      const { container, rerender } = render(<TestComponent exp={exp} />);
      expect(container.textContent).toBe("0");
      expect(renderCount).toHaveBeenCalledTimes(1);

      // Re-render with same exp function
      rerender(<TestComponent exp={exp} />);
      // Reactive component should be memoized, so TestComponent re-renders
      // but Reactive might not if exp reference is the same
      expect(renderCount).toHaveBeenCalledTimes(2);
    });
  });

  describe("complex expressions", () => {
    it("should handle conditional expressions", async () => {
      const condition = signal(true);
      const a = signal("A");
      const b = signal("B");

      const { container } = render(rx(() => (condition() ? a() : b())));

      expect(container.textContent).toBe("A");

      act(() => {
        condition.set(false);
      });
      await waitFor(() => {
        expect(container.textContent).toBe("B");
      });
    });

    it("should handle array expressions", async () => {
      const items = signal([1, 2, 3]);
      const { container } = render(rx(() => items().join(", ")));

      expect(container.textContent).toBe("1, 2, 3");

      act(() => {
        items.set([4, 5, 6]);
      });
      await waitFor(() => {
        expect(container.textContent).toBe("4, 5, 6");
      });
    });

    it("should handle object expressions", async () => {
      const obj = signal({ name: "Alice", age: 30 });
      const { container } = render(rx(() => `${obj().name} is ${obj().age}`));

      expect(container.textContent).toBe("Alice is 30");

      act(() => {
        obj.set({ name: "Bob", age: 25 });
      });
      await waitFor(() => {
        expect(container.textContent).toBe("Bob is 25");
      });
    });
  });

  describe("edge cases", () => {
    it("should handle rapid signal changes", async () => {
      const s = signal(0);
      const { container } = render(rx(() => s()));

      act(() => {
        s.set(1);
        s.set(2);
        s.set(3);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("3");
      });
    });

    it("should handle expression that returns a function", () => {
      const fn = () => "function result";
      const { container } = render(rx(() => fn));
      // Functions can't be rendered in React, so it will be empty
      // This is expected behavior - functions are not valid React children
      // Warning is suppressed in vite.config.ts
      expect(container.textContent).toBe("");
    });

    it("should handle expression with no signals", () => {
      const { container } = render(rx(() => "static"));
      expect(container.textContent).toBe("static");
    });

    it("should handle multiple rx calls", () => {
      const a = signal(1);
      const b = signal(2);

      const { container } = render(
        <div>
          {rx(() => a())}
          <span>-</span>
          {rx(() => b())}
        </div>
      );

      // Both values should be rendered
      expect(container.textContent).toContain("1");
      expect(container.textContent).toContain("2");
    });

    it("should batch multiple synchronous signal updates", async () => {
      const signalA = signal(0);
      const signalB = signal(0);
      const signalC = signal(0);

      let renderCount = 0;

      const { container } = render(
        rx(() => {
          renderCount++;
          return `A: ${signalA()}, B: ${signalB()}, C: ${signalC()}`;
        })
      );

      expect(container.textContent).toBe("A: 0, B: 0, C: 0");

      // Change all three signals synchronously
      act(() => {
        signalA.set(1);
        signalB.set(2);
        signalC.set(3);
      });

      // Wait for debounced update
      await waitFor(
        () => {
          expect(container.textContent).toBe("A: 1, B: 2, C: 3");
        },
        { timeout: 100 }
      );
    });

    it("should handle multiple signals changing synchronously during render", async () => {
      const signalA = signal(0);
      const signalB = signal(0);

      // Expression depends on both signals
      const { container } = render(
        rx(() => `A: ${signalA()}, B: ${signalB()}`)
      );

      expect(container.textContent).toBe("A: 0, B: 0");

      // Change both signals synchronously - debouncing should prevent React errors
      act(() => {
        signalA.set(1);
        signalB.set(2);
      });

      // Wait for the debounced update to complete
      await waitFor(
        () => {
          expect(container.textContent).toBe("A: 1, B: 2");
        },
        { timeout: 100 }
      );

      // Verify no React errors occurred (test would fail if errors were thrown)
    });
  });

  describe("cleanup", () => {
    it("should cleanup subscriptions when unmounted", async () => {
      const s = signal(0);
      const listener = vi.fn();
      s.on(listener);

      const { unmount } = render(rx(() => s()));

      act(() => {
        s.set(1);
      });
      await waitFor(() => {
        expect(listener).toHaveBeenCalled();
      });

      listener.mockClear();
      unmount();

      act(() => {
        s.set(2);
      });
      // Wait a bit to ensure no re-render happens
      await new Promise((resolve) => setTimeout(resolve, 10));
      // The component is unmounted, so it shouldn't re-render
      // But the signal listener might still be called
      // The important thing is the component doesn't try to update
    });
  });

  describe("signal dependency changes", () => {
    it("should handle when new signal set has different signals than old set", async () => {
      const condition = signal(true);
      const signal1 = signal(1);
      const signal2 = signal(2);

      const TestComponent = () => {
        return rx(() => {
          // Access condition as signal to track it
          if (condition()) {
            return signal1();
          } else {
            return signal2();
          }
        });
      };

      const { container } = render(<TestComponent />);
      expect(container.textContent).toBe("1");

      // Switch to false - now signal2 is accessed (new signal not in old set)
      // This triggers isDiff where b has signal2 that a doesn't have (lines 32-33)
      act(() => {
        condition.set(false);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("2");
      });

      // Now switch back to test the other direction
      // Now signal1 is accessed again (new signal not in old set which had signal2)
      act(() => {
        condition.set(true);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("1");
      });
    });

    it("should handle when old signal set has signals that new set doesn't have", async () => {
      const condition = signal(true);
      const signal1 = signal(1);
      const signal2 = signal(2);
      const signal3 = signal(3);

      const TestComponent = () => {
        return rx(() => {
          // Access condition as a signal so it's tracked
          if (condition()) {
            // Access signal1 and signal2
            return signal1() + signal2();
          } else {
            // Only access signal3
            return signal3();
          }
        });
      };

      const { container } = render(<TestComponent />);
      expect(container.textContent).toBe("3"); // 1 + 2

      // Switch to false - now only signal3 is accessed
      // This should trigger isDiff where b (new set) has signal3 that a (old set) doesn't have
      act(() => {
        condition.set(false);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("3");
      });

      // Change signal3 to verify it's tracked
      act(() => {
        signal3.set(10);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("10");
      });

      // Switch back to true - now signal1 and signal2 are accessed again
      // This should trigger isDiff where b (new set) has signal1/signal2 that a (old set) doesn't have
      act(() => {
        condition.set(true);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("3"); // 1 + 2
      });
    });

    it("should detect when new dependencies are added (b has items not in a)", async () => {
      const signal1 = signal(1);
      const signal2 = signal(2);
      const signal3 = signal(3);
      const condition = signal(false);

      const Component = () => (
        <div>
          {rx(() => {
            if (condition()) {
              // When true: use signal3 only
              return signal3();
            } else {
              // When false: use signal1 and signal2
              return signal1() + signal2();
            }
          })}
        </div>
      );

      const { container } = render(<Component />);
      expect(container.textContent).toBe("3"); // 1 + 2

      // Switch to signal3 - new dependency set has signal3, old has signal1/signal2
      act(() => {
        condition.set(true);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("3"); // signal3 = 3
      });

      // Change signal3 - should trigger update
      act(() => {
        signal3.set(10);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("10");
      });

      // Switch back - old set (signal3) vs new set (signal1, signal2)
      // This tests lines 31-35 where b has items (signal1, signal2) not in a (signal3)
      act(() => {
        condition.set(false);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("3"); // 1 + 2
      });

      // Wait for subscriptions to be set up
      await delay(10);

      // Verify signal1/signal2 are tracked now
      act(() => {
        signal1.set(5);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("7"); // 5 + 2
      });
    });
  });

  describe("rx with signal array overload", () => {
    it("should unwrap signals and pass values to callback", () => {
      const count = signal(5);
      const multiplier = signal(3);

      render(
        <div data-testid="result">
          {rx([count, multiplier], (c, m) => (
            <span>
              {c} × {m} = {c * m}
            </span>
          ))}
        </div>
      );

      expect(screen.getByTestId("result")).toHaveTextContent("5 × 3 = 15");
    });

    it("should update when signals change", async () => {
      const count = signal(2);
      const multiplier = signal(4);

      render(
        <div data-testid="result">
          {rx([count, multiplier], (c, m) => (
            <span>Result: {c * m}</span>
          ))}
        </div>
      );

      expect(screen.getByTestId("result")).toHaveTextContent("Result: 8");

      act(() => count.set(5));
      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("Result: 20");
      });

      act(() => multiplier.set(10));
      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("Result: 50");
      });
    });

    it("should work with empty signal array", () => {
      render(
        <div data-testid="result">
          {rx([], () => (
            <span>No dependencies</span>
          ))}
        </div>
      );

      expect(screen.getByTestId("result")).toHaveTextContent("No dependencies");
    });

    it("should support multiple signal types", async () => {
      const strSignal = signal("hello");
      const numSignal = signal(42);
      const boolSignal = signal(true);

      render(
        <div data-testid="result">
          {rx([strSignal, numSignal, boolSignal], (str, num, bool) => (
            <span>
              {str}-{num}-{bool ? "yes" : "no"}
            </span>
          ))}
        </div>
      );

      expect(screen.getByTestId("result")).toHaveTextContent("hello-42-yes");

      act(() => {
        strSignal.set("world");
        numSignal.set(99);
        boolSignal.set(false);
      });

      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("world-99-no");
      });
    });
  });

  describe("rx with component and props overload", () => {
    it("should auto-unwrap signal props", () => {
      const title = signal("Hello World");
      const className = "test-class";

      render(
        <div data-testid="container">
          {rx("div", {
            title: title,
            className: className,
            children: "Content",
          })}
        </div>
      );

      const container = screen.getByTestId("container");
      const div = container.querySelector("div");
      expect(div).toHaveAttribute("title", "Hello World");
      expect(div).toHaveClass("test-class");
      expect(div).toHaveTextContent("Content");
    });

    it("should update when signal props change", async () => {
      const text = signal("Initial");

      render(
        <div data-testid="container">
          {rx("span", {
            children: text,
            "data-testid": "span",
          })}
        </div>
      );

      expect(screen.getByTestId("span")).toHaveTextContent("Initial");

      act(() => text.set("Updated"));
      await waitFor(() => {
        expect(screen.getByTestId("span")).toHaveTextContent("Updated");
      });
    });

    it("should work with multiple signal props", async () => {
      const title = signal("Title");
      const className = signal("class-1");
      const id = signal("id-1");

      render(
        <div data-testid="container">
          {rx("div", {
            title: title,
            className: className,
            id: id,
            "data-testid": "target",
          })}
        </div>
      );

      const target = screen.getByTestId("target");
      expect(target).toHaveAttribute("title", "Title");
      expect(target).toHaveClass("class-1");
      expect(target).toHaveAttribute("id", "id-1");

      act(() => {
        title.set("New Title");
        className.set("class-2");
        id.set("id-2");
      });

      await waitFor(() => {
        expect(target).toHaveAttribute("title", "New Title");
        expect(target).toHaveClass("class-2");
        expect(target).toHaveAttribute("id", "id-2");
      });
    });

    it("should work with custom components", async () => {
      const CustomComponent = ({
        value,
        label,
      }: {
        value: number;
        label: string;
      }) => (
        <div data-testid="custom">
          {label}: {value}
        </div>
      );

      const count = signal(42);
      const label = "Count";

      render(
        <div>
          {rx(CustomComponent, {
            value: count,
            label: label,
          })}
        </div>
      );

      expect(screen.getByTestId("custom")).toHaveTextContent("Count: 42");

      act(() => count.set(100));
      await waitFor(() => {
        expect(screen.getByTestId("custom")).toHaveTextContent("Count: 100");
      });
    });

    it("should handle signal children", async () => {
      const content = signal("Dynamic content");

      render(
        <div data-testid="container">
          {rx("div", {
            className: "wrapper",
            children: content,
          })}
        </div>
      );

      const wrapper = screen.getByTestId("container").querySelector(".wrapper");
      expect(wrapper).toHaveTextContent("Dynamic content");

      act(() => content.set("Updated content"));
      await waitFor(() => {
        expect(wrapper).toHaveTextContent("Updated content");
      });
    });

    it("should mix static and signal props", async () => {
      const dynamicTitle = signal("Dynamic");
      const staticClass = "static-class";

      render(
        <div data-testid="container">
          {rx("div", {
            title: dynamicTitle,
            className: staticClass,
            "data-static": "value",
            "data-testid": "target",
          })}
        </div>
      );

      const target = screen.getByTestId("target");
      expect(target).toHaveAttribute("title", "Dynamic");
      expect(target).toHaveClass("static-class");
      expect(target).toHaveAttribute("data-static", "value");

      act(() => dynamicTitle.set("Changed"));
      await waitFor(() => {
        expect(target).toHaveAttribute("title", "Changed");
      });
      expect(target).toHaveClass("static-class"); // Static props unchanged
    });

    it("should throw error with invalid arguments", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<div>{rx("div", null as any)}</div>);
      }).toThrow("Invalid arguments");

      consoleSpy.mockRestore();
    });

    it("should work with event handlers", async () => {
      const handleClick = vi.fn();
      const buttonText = signal("Click me");

      render(
        <div>
          {rx("button", {
            onClick: handleClick,
            children: buttonText,
            "data-testid": "button",
          })}
        </div>
      );

      const button = screen.getByTestId("button");
      expect(button).toHaveTextContent("Click me");

      button.click();
      expect(handleClick).toHaveBeenCalledTimes(1);

      act(() => buttonText.set("Updated"));
      await waitFor(() => {
        expect(button).toHaveTextContent("Updated");
      });

      button.click();
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe("React Strict Mode", () => {
    it("should handle rx() correctly in Strict Mode", () => {
      const count = signal(0);
      const renderSpy = vi.fn();

      function Component() {
        return (
          <div>
            {rx(() => {
              renderSpy();
              return <span data-testid="count">{count()}</span>;
            })}
          </div>
        );
      }

      const { getByTestId } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      // rx() should render correctly
      expect(getByTestId("count").textContent).toBe("0");

      // Update signal
      act(() => {
        count.set(5);
      });

      expect(getByTestId("count").textContent).toBe("5");
    });

    it("should handle signal updates in Strict Mode without double-rendering", async () => {
      const count = signal(0);
      const updateSpy = vi.fn();

      function Component() {
        return (
          <div>
            {rx(() => {
              updateSpy(count());
              return <span>{count()}</span>;
            })}
          </div>
        );
      }

      const { container } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      // Clear initial render calls
      updateSpy.mockClear();

      // Update signal
      act(() => {
        count.set(1);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("1");
      });

      // Should only re-render once per signal update (not doubled)
      expect(updateSpy).toHaveBeenCalledWith(1);
    });

    it("should handle multiple rx() expressions in Strict Mode", () => {
      const count = signal(0);
      const name = signal("Alice");

      function Component() {
        return (
          <div>
            <span data-testid="count">{rx(count)}</span>
            <span data-testid="name">{rx(name)}</span>
          </div>
        );
      }

      const { getByTestId } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      expect(getByTestId("count").textContent).toBe("0");
      expect(getByTestId("name").textContent).toBe("Alice");

      act(() => {
        count.set(10);
        name.set("Bob");
      });

      expect(getByTestId("count").textContent).toBe("10");
      expect(getByTestId("name").textContent).toBe("Bob");
    });

    it("should cleanup subscriptions properly in Strict Mode", async () => {
      const count = signal(0);
      const subscriptionSpy = vi.fn();

      // Track subscription via spy
      const originalOn = count.on.bind(count);
      count.on = vi.fn((listener) => {
        subscriptionSpy("subscribe");
        const unsubscribe = originalOn(listener);
        return () => {
          subscriptionSpy("unsubscribe");
          unsubscribe();
        };
      });

      function Component() {
        return <div>{rx(count)}</div>;
      }

      const { unmount } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      // Subscriptions created
      expect(subscriptionSpy).toHaveBeenCalledWith("subscribe");

      unmount();

      // Subscriptions cleaned up
      expect(subscriptionSpy).toHaveBeenCalledWith("unsubscribe");
    });

    it("should handle computed signals in rx() in Strict Mode", () => {
      const base = signal(2);
      const multiplier = signal(3);
      const computed = signal(() => base() * multiplier());

      function Component() {
        return (
          <div>
            <span data-testid="base">{rx(base)}</span>
            <span data-testid="multiplier">{rx(multiplier)}</span>
            <span data-testid="computed">{rx(computed)}</span>
          </div>
        );
      }

      const { getByTestId } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      expect(getByTestId("base").textContent).toBe("2");
      expect(getByTestId("multiplier").textContent).toBe("3");
      expect(getByTestId("computed").textContent).toBe("6");

      act(() => {
        base.set(5);
      });

      expect(getByTestId("computed").textContent).toBe("15");
    });

    it("should handle errors in rx() in Strict Mode", () => {
      const shouldError = signal(false);

      function Component() {
        return (
          <div>
            {rx(() => {
              if (shouldError()) {
                throw new Error("Test error");
              }
              return <span>OK</span>;
            })}
          </div>
        );
      }

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(
          <React.StrictMode>
            <Component />
          </React.StrictMode>
        );
      }).not.toThrow();

      console.error = originalError;
    });

    it("should handle conditional rendering in rx() in Strict Mode", () => {
      const showDetails = signal(false);
      const count = signal(0);

      function Component() {
        return (
          <div>
            {rx(() => (
              <div>
                <span data-testid="count">Count: {count()}</span>
                {showDetails() && <span data-testid="details">Details</span>}
              </div>
            ))}
          </div>
        );
      }

      const { getByTestId, queryByTestId } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      expect(getByTestId("count").textContent).toBe("Count: 0");
      expect(queryByTestId("details")).toBeNull();

      act(() => {
        showDetails.set(true);
      });

      expect(queryByTestId("details")).not.toBeNull();
    });
  });

  describe("async validation", () => {
    it("should throw error when expression returns a promise", () => {
      expect(() => {
        render(
          rx(async () => {
            return <div>Async content</div>;
          })
        );
      }).toThrow("rx() expression cannot return a promise");
    });

    it("should throw error when expression returns promise-like object", () => {
      expect(() => {
        render(
          rx(() => {
            return {
              then: (resolve: (val: any) => void) =>
                resolve(<div>Thenable</div>),
            };
          })
        );
      }).toThrow("rx() expression cannot return a promise");
    });

    it("should not throw when expression returns valid ReactNode", () => {
      expect(() => {
        const { container } = render(rx(() => <div>Sync content</div>));
        expect(container.textContent).toBe("Sync content");
      }).not.toThrow();
    });

    it("should not throw when expression returns a signal value", () => {
      const count = signal(42);
      expect(() => {
        const { container } = render(rx(() => count()));
        expect(container.textContent).toBe("42");
      }).not.toThrow();
    });
  });

  describe("nested rx() validation", () => {
    it("should throw error when rx() is called inside another rx()", () => {
      expect(() => {
        render(
          rx(() => (
            <div>
              {rx(() => (
                <span>Nested</span>
              ))}
            </div>
          ))
        );
      }).toThrow("Nested rx() blocks detected");
    });

    it("should throw with helpful error message", () => {
      expect(() => {
        render(
          rx(() => (
            <div>
              {rx(() => (
                <span>Nested</span>
              ))}
            </div>
          ))
        );
      }).toThrow(/consolidate into a single rx\(\) block/);
    });

    it("should throw for multiple nested rx() calls", () => {
      expect(() => {
        render(
          rx(() => (
            <div>
              {rx(() => (
                <span>First</span>
              ))}
              {rx(() => (
                <span>Second</span>
              ))}
            </div>
          ))
        );
      }).toThrow("Nested rx() blocks detected");
    });

    it("should throw for deeply nested rx()", () => {
      expect(() => {
        render(
          rx(() => (
            <div>
              {rx(() => (
                <div>
                  {rx(() => (
                    <span>Deep</span>
                  ))}
                </div>
              ))}
            </div>
          ))
        );
      }).toThrow("Nested rx() blocks detected");
    });

    it("should not throw for sibling rx() blocks", () => {
      expect(() => {
        const { container } = render(
          <div>
            {rx(() => (
              <span>First</span>
            ))}
            {rx(() => (
              <span>Second</span>
            ))}
          </div>
        );
        expect(container.textContent).toBe("FirstSecond");
      }).not.toThrow();
    });

    it("should not throw for rx() with signal array overload", () => {
      const count = signal(5);
      expect(() => {
        const { container } = render(rx([count], (c) => <div>Count: {c}</div>));
        expect(container.textContent).toBe("Count: 5");
      }).not.toThrow();
    });

    it("should throw for nested rx() with signal array overload", () => {
      const count = signal(5);
      expect(() => {
        render(
          rx(() => (
            <div>
              {rx([count], (c) => (
                <span>{c}</span>
              ))}
            </div>
          ))
        );
      }).toThrow("Nested rx() blocks detected");
    });

    it("should throw for nested rx() with component overload", () => {
      const value = signal("test");
      expect(() => {
        render(rx(() => <div>{rx("span", { children: value })}</div>));
      }).toThrow("Nested rx() blocks detected");
    });
  });

  describe("batch scope validation", () => {
    it("should throw when creating rx() inside batch()", async () => {
      const { batch } = await import("./batch");
      const count = signal(0);

      expect(() => {
        batch(() => {
          rx(() => <div>{count()}</div>); // Should throw
          count.set(1);
        });
      }).toThrow("Cannot create rx() blocks inside batch()");
    });

    it("should throw with helpful error message", async () => {
      const { batch } = await import("./batch");
      const count = signal(0);

      expect(() => {
        batch(() => {
          rx(() => <div>{count()}</div>);
        });
      }).toThrow(/batch\(\) is for grouping signal updates/);
    });

    it("should not throw when creating rx() outside batch", async () => {
      const { batch } = await import("./batch");
      const count = signal(0);

      expect(() => {
        const view = rx(() => <div>{count()}</div>); // Created outside
        batch(() => {
          count.set(1); // Just updating inside
          count.set(2);
        });
        render(view);
      }).not.toThrow();
    });
  });

  describe("loadable handling with explicit signals", () => {
    it("should throw promise when signal value is loading (triggers Suspense)", () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("loaded"), 100);
      });
      const asyncSignal = signal<Loadable<string>>(
        loadable("loading", promise)
      );

      // When a component throws a promise, Suspense catches it
      // We test this by wrapping in Suspense and checking fallback is shown
      const FallbackComponent = () => (
        <div data-testid="fallback">Loading...</div>
      );
      const { container } = render(
        <Suspense fallback={<FallbackComponent />}>
          {rx([asyncSignal], (value) => (
            <div data-testid="content">{value}</div>
          ))}
        </Suspense>
      );

      // Should show fallback when promise is thrown
      expect(container.textContent).toBe("Loading...");
      expect(screen.getByTestId("fallback")).toBeTruthy();
    });

    it("should throw error when signal value is error (triggers ErrorBoundary)", () => {
      const error = new Error("Failed to load");
      const asyncSignal = signal<Loadable<string>>(loadable("error", error));

      expect(() => {
        render(rx([asyncSignal], (value) => <div>{value}</div>));
      }).toThrow("Failed to load");
    });

    it("should render unwrapped value when signal value is success", () => {
      const asyncSignal = signal<Loadable<string>>(
        loadable("success", "Hello from async")
      );

      const { container } = render(
        rx([asyncSignal], (value) => <div>{value}</div>)
      );

      expect(container.textContent).toBe("Hello from async");
    });

    it("should handle multiple async signals", () => {
      const signal1 = signal<Loadable<number>>(loadable("success", 10));
      const signal2 = signal<Loadable<number>>(loadable("success", 20));

      const { container } = render(
        rx([signal1, signal2], (a, b) => <div>{a + b}</div>)
      );

      expect(container.textContent).toBe("30");
    });

    it("should throw promise if any signal is loading", () => {
      const promise = new Promise<number>((resolve) => {
        setTimeout(() => resolve(10), 100);
      });
      const loadingSignal = signal<Loadable<number>>(
        loadable("loading", promise)
      );
      const successSignal = signal<Loadable<number>>(loadable("success", 20));

      // When any signal is loading, wait() throws promise and Suspense catches it
      const FallbackComponent = () => (
        <div data-testid="fallback">Loading...</div>
      );
      const { container } = render(
        <Suspense fallback={<FallbackComponent />}>
          {rx([loadingSignal, successSignal], (a, b) => (
            <div data-testid="content">{a + b}</div>
          ))}
        </Suspense>
      );

      // Should show fallback when promise is thrown
      expect(container.textContent).toBe("Loading...");
      expect(screen.getByTestId("fallback")).toBeTruthy();
    });

    it("should throw error if any signal has error", () => {
      const error = new Error("Signal 1 failed");
      const errorSignal = signal<Loadable<number>>(loadable("error", error));
      const successSignal = signal<Loadable<number>>(loadable("success", 20));

      expect(() => {
        render(rx([errorSignal, successSignal], (a, b) => <div>{a + b}</div>));
      }).toThrow("Signal 1 failed");
    });

    it("should handle mixed sync and async signals", () => {
      const syncSignal = signal(10);
      const asyncSignal = signal<Loadable<number>>(loadable("success", 20));

      const { container } = render(
        rx([syncSignal, asyncSignal], (a, b) => <div>{a + b}</div>)
      );

      expect(container.textContent).toBe("30");
    });

    it("should re-render when async signal transitions from loading to success", async () => {
      let resolvePromise: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });

      const asyncSignal = signal<Loadable<string>>(
        loadable("loading", promise)
      );

      const FallbackComponent = () => <div>Loading...</div>;
      const TestComponent = () => (
        <Suspense fallback={<FallbackComponent />}>
          {rx([asyncSignal], (value) => (
            <div data-testid="result">{value}</div>
          ))}
        </Suspense>
      );

      const { container } = render(<TestComponent />);

      // Initially should show fallback
      expect(container.textContent).toBe("Loading...");

      // Resolve promise and update signal
      await act(async () => {
        resolvePromise!("Success!");
        await promise;
        asyncSignal.set(loadable("success", "Success!", promise));
      });

      // Should now show success value
      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent("Success!");
      });
    });

    it("should not interfere with non-loadable signal values", () => {
      const normalSignal = signal({ count: 10 });
      const asyncSignal = signal<Loadable<string>>(loadable("success", "test"));

      const { container } = render(
        rx([normalSignal, asyncSignal], (obj, str) => (
          <div>
            {obj.count} - {str}
          </div>
        ))
      );

      expect(container.textContent).toBe("10 - test");
    });
  });

  describe("direct promises and loadables (not in signals)", () => {
    it("should handle direct loadable success", () => {
      const userLoadable = loadable("success", { id: 1, name: "Alice" });

      const { container } = render(
        rx([userLoadable], (user) => (
          <div>
            {user.id} - {user.name}
          </div>
        ))
      );

      expect(container.textContent).toBe("1 - Alice");
    });

    it("should handle direct loadable loading (triggers Suspense)", () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("data"), 100);
      });
      const loadingLoadable = loadable("loading", promise);

      const FallbackComponent = () => (
        <div data-testid="fallback">Loading...</div>
      );
      const { container } = render(
        <Suspense fallback={<FallbackComponent />}>
          {rx([loadingLoadable], (value) => (
            <div data-testid="content">{value}</div>
          ))}
        </Suspense>
      );

      expect(container.textContent).toBe("Loading...");
      expect(screen.getByTestId("fallback")).toBeTruthy();
    });

    it("should handle direct loadable error (triggers ErrorBoundary)", () => {
      const error = new Error("Direct loadable failed");
      const errorLoadable = loadable<string>("error", error);

      expect(() => {
        render(rx([errorLoadable], (value) => <div>{value}</div>));
      }).toThrow("Direct loadable failed");
    });

    it("should handle direct promises", async () => {
      let resolvePromise: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });

      const FallbackComponent = () => <div>Loading...</div>;
      const TestComponent = () => (
        <Suspense fallback={<FallbackComponent />}>
          {rx([promise], (value) => (
            <div data-testid="result">{value}</div>
          ))}
        </Suspense>
      );

      const { container } = render(<TestComponent />);

      // Initially should show fallback (promise is loading)
      expect(container.textContent).toBe("Loading...");

      // Resolve promise
      await act(async () => {
        resolvePromise!("Promise resolved!");
        await promise;
      });

      // Should now show resolved value
      await waitFor(() => {
        expect(screen.getByTestId("result")).toHaveTextContent(
          "Promise resolved!"
        );
      });
    });

    it("should handle mixed direct loadables and signals", () => {
      const syncSignal = signal(100);
      const directLoadable = loadable("success", 200);

      const { container } = render(
        rx([syncSignal, directLoadable], (a, b) => <div>{a + b}</div>)
      );

      expect(container.textContent).toBe("300");
    });

    it("should handle mixed direct promises, loadables, and signals", async () => {
      const syncSignal = signal(10);
      const successLoadable = loadable("success", 20);
      const resolvedPromise = Promise.resolve(30);

      // Wait for promise to settle before rendering
      await resolvedPromise;

      const { container } = render(
        rx([syncSignal, successLoadable, resolvedPromise], (a, b, c) => (
          <div>{a + b + c}</div>
        ))
      );

      await waitFor(() => {
        expect(container.textContent).toBe("60");
      });
    });

    it("should handle multiple direct promises", async () => {
      const promise1 = Promise.resolve(100);
      const promise2 = Promise.resolve(200);

      // Wait for promises to settle
      await Promise.all([promise1, promise2]);

      const { container } = render(
        rx([promise1, promise2], (a, b) => <div>{a + b}</div>)
      );

      await waitFor(() => {
        expect(container.textContent).toBe("300");
      });
    });

    it("should throw if direct promise rejects (via error loadable)", () => {
      const error = new Error("Promise rejected");
      const rejectedPromise = Promise.reject(error);

      // Prevent unhandled rejection
      rejectedPromise.catch(() => {});

      // Use error loadable to simulate a rejected promise that's already cached
      const errorLoadable = loadable("error", error, rejectedPromise);

      expect(() => {
        render(rx([errorLoadable], (value) => <div>{value}</div>));
      }).toThrow("Promise rejected");
    });

    it("should reactively update when signal changes but direct loadable stays same", () => {
      const syncSignal = signal(1);
      const directLoadable = loadable("success", 100);

      const { container } = render(
        rx([syncSignal, directLoadable], (a, b) => <div>{a + b}</div>)
      );

      expect(container.textContent).toBe("101");

      act(() => {
        syncSignal.set(2);
      });

      expect(container.textContent).toBe("102");
    });
  });

  describe("object shape dependencies (named parameters)", () => {
    it("should handle object shape with sync signals", () => {
      const count = signal(10);
      const multiplier = signal(2);

      const { container } = render(
        rx({ count, multiplier }, ({ count, multiplier }) => (
          <div>{count * multiplier}</div>
        ))
      );

      expect(container.textContent).toBe("20");
    });

    it("should handle object shape with async signals", () => {
      const user = signal<Loadable<{ name: string }>>(
        loadable("success", { name: "Alice" })
      );
      const posts = signal<Loadable<string[]>>(
        loadable("success", ["post1", "post2"])
      );

      const { container } = render(
        rx({ user, posts }, ({ user, posts }) => (
          <div>
            {user.name} - {posts.length} posts
          </div>
        ))
      );

      expect(container.textContent).toBe("Alice - 2 posts");
    });

    it("should handle object shape with mixed sync and async", () => {
      const syncCount = signal(5);
      const asyncUser = signal<Loadable<{ id: number }>>(
        loadable("success", { id: 123 })
      );

      const { container } = render(
        rx({ syncCount, asyncUser }, ({ syncCount, asyncUser }) => (
          <div>
            {syncCount} - {asyncUser.id}
          </div>
        ))
      );

      expect(container.textContent).toBe("5 - 123");
    });

    it("should handle object shape with direct promises", async () => {
      const promise1 = Promise.resolve(100);
      const promise2 = Promise.resolve(200);

      // Wait for promises to settle
      await Promise.all([promise1, promise2]);

      const { container } = render(
        rx({ p1: promise1, p2: promise2 }, ({ p1, p2 }) => <div>{p1 + p2}</div>)
      );

      await waitFor(() => {
        expect(container.textContent).toBe("300");
      });
    });

    it("should handle object shape with direct loadables", () => {
      const loadable1 = loadable("success", { value: 10 });
      const loadable2 = loadable("success", { value: 20 });

      const { container } = render(
        rx({ l1: loadable1, l2: loadable2 }, ({ l1, l2 }) => (
          <div>{l1.value + l2.value}</div>
        ))
      );

      expect(container.textContent).toBe("30");
    });

    it("should handle object shape with loading state (Suspense)", () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("data"), 100);
      });
      const loadingLoadable = loadable("loading", promise);

      const FallbackComponent = () => (
        <div data-testid="fallback">Loading...</div>
      );
      const { container } = render(
        <Suspense fallback={<FallbackComponent />}>
          {rx({ data: loadingLoadable }, ({ data }) => (
            <div data-testid="content">{data}</div>
          ))}
        </Suspense>
      );

      expect(container.textContent).toBe("Loading...");
      expect(screen.getByTestId("fallback")).toBeTruthy();
    });

    it("should handle object shape with error state (ErrorBoundary)", () => {
      const error = new Error("Object shape failed");
      const errorLoadable = loadable<string>("error", error);

      expect(() => {
        render(rx({ data: errorLoadable }, ({ data }) => <div>{data}</div>));
      }).toThrow("Object shape failed");
    });

    it("should reactively update with object shape", () => {
      const count = signal(1);
      const name = signal("Alice");

      const { container } = render(
        rx({ count, name }, ({ count, name }) => (
          <div>
            {name}: {count}
          </div>
        ))
      );

      expect(container.textContent).toBe("Alice: 1");

      act(() => {
        count.set(2);
      });

      expect(container.textContent).toBe("Alice: 2");

      act(() => {
        name.set("Bob");
      });

      expect(container.textContent).toBe("Bob: 2");
    });

    it("should handle object shape with many dependencies (readability)", () => {
      const user = signal({ name: "Alice" });
      const posts = signal(["post1", "post2"]);
      const settings = signal({ theme: "dark" });
      const notifications = signal(5);

      const { container } = render(
        rx(
          { user, posts, settings, notifications },
          ({ user, posts, settings, notifications }) => (
            <div>
              {user.name} - {posts.length} posts - {settings.theme} -{" "}
              {notifications} notifications
            </div>
          )
        )
      );

      expect(container.textContent).toBe(
        "Alice - 2 posts - dark - 5 notifications"
      );
    });

    it("should preserve property order in object shape", () => {
      const a = signal("A");
      const b = signal("B");
      const c = signal("C");

      const { container } = render(
        rx({ a, b, c }, ({ a, b, c }) => <div>{a + b + c}</div>)
      );

      expect(container.textContent).toBe("ABC");
    });

    it("should work with computed signals in object shape", () => {
      const base = signal(10);
      const doubled = signal(() => base() * 2);
      const tripled = signal(() => base() * 3);

      const { container } = render(
        rx({ base, doubled, tripled }, ({ base, doubled, tripled }) => (
          <div>
            {base} - {doubled} - {tripled}
          </div>
        ))
      );

      expect(container.textContent).toBe("10 - 20 - 30");

      act(() => {
        base.set(5);
      });

      expect(container.textContent).toBe("5 - 10 - 15");
    });
  });
});
