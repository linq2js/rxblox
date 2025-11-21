import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act, useState, Suspense } from "react";
import { rx } from "./rx";
import { signal } from "./signal";
import { ErrorBoundary } from "react-error-boundary";
import "@testing-library/jest-dom/vitest";

describe("rx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Overload 1: Static or manual control", () => {
    it("should render static content", () => {
      const TestComponent = () => {
        return rx(() => <div data-testid="static">Static content</div>);
      };

      render(<TestComponent />);
      expect(screen.getByTestId("static")).toHaveTextContent("Static content");
    });

    it("should not re-render without watch array", () => {
      let renderCount = 0;
      const TestComponent = () => {
        renderCount++;
        return rx(() => {
          renderCount++;
          return <div data-testid="count">{renderCount}</div>;
        });
      };

      const { rerender } = render(<TestComponent />);
      expect(screen.getByTestId("count")).toHaveTextContent("2");

      // Force parent re-render
      rerender(<TestComponent />);
      // Should still be 2 (no re-render of rx content)
      expect(screen.getByTestId("count")).toHaveTextContent("2");
    });

    it("should re-render when watch dependencies change", () => {
      let renderCount = 0;
      const TestComponent = ({ value }: { value: number }) => {
        return rx(
          () => {
            renderCount++;
            return <div data-testid="count">{renderCount}</div>;
          },
          { watch: [value] }
        );
      };

      const { rerender } = render(<TestComponent value={1} />);
      expect(screen.getByTestId("count")).toHaveTextContent("1");

      // Change watch dependency
      rerender(<TestComponent value={2} />);
      expect(screen.getByTestId("count")).toHaveTextContent("2");
    });

    it("should handle multiple watch dependencies", () => {
      const TestComponent = ({ a, b }: { a: number; b: string }) => {
        return rx(
          () => (
            <div data-testid="combined">
              {a} - {b}
            </div>
          ),
          { watch: [a, b] }
        );
      };

      const { rerender } = render(<TestComponent a={1} b="hello" />);
      expect(screen.getByTestId("combined")).toHaveTextContent("1 - hello");

      rerender(<TestComponent a={2} b="hello" />);
      expect(screen.getByTestId("combined")).toHaveTextContent("2 - hello");

      rerender(<TestComponent a={2} b="world" />);
      expect(screen.getByTestId("combined")).toHaveTextContent("2 - world");
    });

    it("should handle empty watch array", () => {
      let renderCount = 0;
      const TestComponent = () => {
        return rx(
          () => {
            renderCount++;
            return <div data-testid="count">{renderCount}</div>;
          },
          { watch: [] }
        );
      };

      const { rerender } = render(<TestComponent />);
      expect(screen.getByTestId("count")).toHaveTextContent("1");

      // Should not re-render even if parent re-renders
      rerender(<TestComponent />);
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });
  });

  describe("Overload 2: Single signal", () => {
    it("should render sync signal value directly", () => {
      const count = signal(42);
      const TestComponent = () => rx(count);

      render(<TestComponent />);
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("should update when signal changes", async () => {
      const count = signal(1);
      const TestComponent = () => rx(count);

      render(<TestComponent />);
      expect(screen.getByText("1")).toBeInTheDocument();

      act(() => {
        count.set(2);
      });

      await waitFor(() => {
        expect(screen.getByText("2")).toBeInTheDocument();
      });
    });

    it("should work with async signals and Suspense", async () => {
      const asyncValue = signal(Promise.resolve(100));
      const TestComponent = () => (
        <Suspense fallback={<div data-testid="loading">Loading...</div>}>
          {rx(asyncValue)}
        </Suspense>
      );

      render(<TestComponent />);
      expect(screen.getByTestId("loading")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("100")).toBeInTheDocument();
      });
    });

    it("should render string values", () => {
      const message = signal("Hello World");
      const TestComponent = () => rx(message);

      render(<TestComponent />);
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("should render JSX elements", () => {
      const content = signal(<span data-testid="jsx">JSX Content</span>);
      const TestComponent = () => rx(content);

      render(<TestComponent />);
      expect(screen.getByTestId("jsx")).toHaveTextContent("JSX Content");
    });

    it("should handle null/undefined values", () => {
      const nullValue = signal<string | null>(null);
      const TestComponent = () => (
        <div data-testid="container">{rx(nullValue)}</div>
      );

      render(<TestComponent />);
      expect(screen.getByTestId("container")).toBeEmptyDOMElement();
    });

    it("should respect watch options", () => {
      const count = signal(1);
      let innerRenderCount = 0;

      const TestComponent = ({ dep }: { dep: number }) => {
        // Track parent renders, but we care about inner rx renders
        return rx(count, { watch: [dep] });
      };

      const { rerender } = render(<TestComponent dep={1} />);
      expect(screen.getByText("1")).toBeInTheDocument();
      innerRenderCount++;

      // Change watch dep - should trigger new render
      rerender(<TestComponent dep={2} />);
      expect(screen.getByText("1")).toBeInTheDocument();
      innerRenderCount++;

      // Change signal value
      act(() => {
        count.set(42);
      });
      expect(screen.getByText("42")).toBeInTheDocument();

      // Don't change watch dep - rx should still respond to signal changes
      rerender(<TestComponent dep={2} />);
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  describe("Overload 3: Reactive with signals", () => {
    it("should render with resolved promise values", async () => {
      const promise = Promise.resolve(42);
      const count = signal(promise);
      const TestComponent = () => {
        return (
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            {rx({ count }, (awaited) => (
              <div data-testid="value">{awaited.count}</div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("42");
      });
    });

    it("should re-render when signal changes", async () => {
      const promise1 = Promise.resolve(0);
      const promise2 = Promise.resolve(1);
      const count = signal(promise1);
      const TestComponent = () => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx({ count }, (awaited) => (
              <div data-testid="value">{awaited.count}</div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("0");
      });

      act(() => {
        count.set(promise2);
      });

      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("1");
      });
    });

    it("should handle multiple signals", async () => {
      const a = signal(Promise.resolve(1));
      const b = signal(Promise.resolve(2));
      const TestComponent = () => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx({ a, b }, (awaited) => (
              <div data-testid="sum">{awaited.a + awaited.b}</div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(screen.getByTestId("sum")).toHaveTextContent("3");
      });

      act(() => {
        a.set(Promise.resolve(10));
      });

      await waitFor(() => {
        expect(screen.getByTestId("sum")).toHaveTextContent("12");
      });
    });

    it("should only track accessed signals (lazy tracking)", async () => {
      const tracked = signal(Promise.resolve(1));
      const untracked = signal(Promise.resolve(100));
      let trackedSubscriptions = 0;
      let untrackedSubscriptions = 0;

      // Track subscription counts
      const originalTrackedOn = tracked.on.bind(tracked);
      tracked.on = vi.fn((listener) => {
        trackedSubscriptions++;
        return originalTrackedOn(listener);
      });

      const originalUntrackedOn = untracked.on.bind(untracked);
      untracked.on = vi.fn((listener) => {
        untrackedSubscriptions++;
        return originalUntrackedOn(listener);
      });

      const TestComponent = () => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx({ tracked, untracked }, (awaited) => (
              <div data-testid="value">{awaited.tracked}</div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("1");
      });

      // Only tracked signal should have subscription
      expect(trackedSubscriptions).toBeGreaterThan(0);
      expect(untrackedSubscriptions).toBe(0);

      // Changing untracked should not cause re-render
      act(() => {
        untracked.set(Promise.resolve(200));
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByTestId("value")).toHaveTextContent("1");

      // Changing tracked should cause re-render
      act(() => {
        tracked.set(Promise.resolve(2));
      });

      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("2");
      });
    });

    it("should handle conditional signal access", async () => {
      const a = signal(Promise.resolve(1));
      const b = signal(Promise.resolve(2));
      const flag = signal(Promise.resolve(true));
      let aSubscriptions = 0;
      let bSubscriptions = 0;

      const originalAOn = a.on.bind(a);
      a.on = vi.fn((listener) => {
        aSubscriptions++;
        return originalAOn(listener);
      });

      const originalBOn = b.on.bind(b);
      b.on = vi.fn((listener) => {
        bSubscriptions++;
        return originalBOn(listener);
      });

      const TestComponent = () => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx({ a, b, flag }, (awaited) => (
              <div data-testid="value">
                {awaited.flag ? awaited.a : awaited.b}
              </div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("1");
      });

      // Initially only a should be tracked
      expect(aSubscriptions).toBeGreaterThan(0);
      expect(bSubscriptions).toBe(0);

      // Change flag to access b
      act(() => {
        flag.set(Promise.resolve(false));
      });

      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("2");
      });

      // Now b should be tracked
      expect(bSubscriptions).toBeGreaterThan(0);
    });

    it("should handle watch array for render function memoization", async () => {
      const count = signal(Promise.resolve(0));
      let renderCallCount = 0;

      const TestComponent = ({ extra }: { extra: number }) => {
        return rx(
          { count },
          (awaited) => {
            renderCallCount++;
            return (
              <div data-testid="value">
                {awaited.count} - {extra}
              </div>
            );
          },
          { watch: [extra] }
        );
      };

      const { rerender } = render(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent extra={1} />
        </Suspense>
      );
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("0 - 1");
      });
      const initialCalls = renderCallCount;

      // Change signal (should re-render)
      act(() => {
        count.set(Promise.resolve(1));
      });

      // Change extra (should recreate render function and re-render)
      rerender(
        <Suspense fallback={<div>Loading...</div>}>
          <TestComponent extra={2} />
        </Suspense>
      );

      await waitFor(() => {
        expect(renderCallCount).toBeGreaterThan(initialCalls);
      });
    });
  });

  describe("Awaited pattern (Suspense)", () => {
    it("should throw promise for loading state", async () => {
      const promise = new Promise<number>((resolve) => {
        setTimeout(() => resolve(42), 100);
      });
      const data = signal(promise);

      const TestComponent = () => {
        return (
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            {rx({ data }, (awaited) => (
              <div data-testid="value">{awaited.data}</div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      expect(screen.getByTestId("loading")).toBeInTheDocument();

      await waitFor(
        () => {
          expect(screen.getByTestId("value")).toHaveTextContent("42");
        },
        { timeout: 200 }
      );
    });

    it("should throw error for rejected promise", async () => {
      const error = new Error("Test error");
      const promise = Promise.reject(error);
      // Suppress unhandled rejection warning
      promise.catch(() => {});
      const data = signal(promise);

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      const TestComponent = () => {
        return (
          <ErrorBoundary
            fallbackRender={() => <div data-testid="error-boundary">Error</div>}
          >
            <Suspense fallback={<div>Loading...</div>}>
              {rx({ data }, (awaited) => (
                <div data-testid="value">{awaited.data}</div>
              ))}
            </Suspense>
          </ErrorBoundary>
        );
      };

      // Error should be thrown (would be caught by ErrorBoundary in real app)
      render(<TestComponent />);

      await waitFor(
        () => {
          expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
        },
        { timeout: 200 }
      );

      // Restore console.error
      console.error = originalError;
    });

    it("should return resolved value for resolved promise", async () => {
      const data = signal(Promise.resolve(42));

      const TestComponent = () => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx({ data }, (awaited) => (
              <div data-testid="value">{awaited.data}</div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("42");
      });
    });
  });

  describe("Loadable pattern (manual handling)", () => {
    it("should return loadable object for loading state", async () => {
      const promise = new Promise<number>((resolve) => {
        setTimeout(() => resolve(42), 50);
      });
      const data = signal(promise);

      const TestComponent = () => {
        return rx({ data }, (_awaited, loadable) => {
          const dataLoadable = loadable.data;
          if (dataLoadable.status === "loading") {
            return <div data-testid="loading">Loading...</div>;
          }
          return <div data-testid="value">{dataLoadable.value}</div>;
        });
      };

      render(<TestComponent />);
      // Initially loading
      expect(screen.getByTestId("loading")).toBeInTheDocument();

      // Wait for promise to resolve
      await waitFor(
        () => {
          expect(screen.getByTestId("value")).toHaveTextContent("42");
        },
        { timeout: 100 }
      );
    });

    it("should return loadable object for error state", async () => {
      const error = new Error("Test error");
      const promise = Promise.reject(error);
      const data = signal(promise);

      const TestComponent = () => {
        return rx({ data }, (_awaited, loadable) => {
          const dataLoadable = loadable.data;
          if (dataLoadable.status === "error") {
            const errorMessage =
              dataLoadable.error instanceof Error
                ? dataLoadable.error.message
                : String(dataLoadable.error);
            return <div data-testid="error">{errorMessage}</div>;
          }
          if (dataLoadable.status === "loading") {
            return <div data-testid="loading">Loading...</div>;
          }
          return <div data-testid="value">{dataLoadable.value}</div>;
        });
      };

      render(<TestComponent />);
      // Initially loading
      expect(screen.getByTestId("loading")).toBeInTheDocument();

      // Wait for promise to reject
      await waitFor(
        () => {
          expect(screen.getByTestId("error")).toHaveTextContent("Test error");
        },
        { timeout: 200 }
      );
    });

    it("should return loadable object for success state", async () => {
      const promise = new Promise<number>((resolve) => {
        setTimeout(() => resolve(42), 10);
      });
      const data = signal(promise);

      const TestComponent = () => {
        return rx({ data }, (_awaited, loadable) => {
          const dataLoadable = loadable.data;
          if (dataLoadable.status === "success") {
            return <div data-testid="value">{dataLoadable.value}</div>;
          }
          if (dataLoadable.status === "loading") {
            return <div data-testid="loading">Loading...</div>;
          }
          return <div>Other</div>;
        });
      };

      render(<TestComponent />);
      // Initially might be loading
      await waitFor(
        () => {
          expect(screen.getByTestId("value")).toHaveTextContent("42");
        },
        { timeout: 200 }
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle empty signals object", () => {
      const TestComponent = () => {
        return rx({}, () => <div data-testid="empty">Empty</div>);
      };

      render(<TestComponent />);
      expect(screen.getByTestId("empty")).toBeInTheDocument();
    });

    it("should handle undefined/null values in signals", async () => {
      // Use PromiseLike for null/undefined since getLoadable expects PromiseLike
      const value = signal(Promise.resolve<number | null>(null));

      const TestComponent = () => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx({ value }, (awaited) => (
              <div data-testid="value">
                {awaited.value === null ? "null" : String(awaited.value)}
              </div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("null");
      });
    });

    it("should handle rapid signal changes", async () => {
      const count = signal(Promise.resolve(0));
      const TestComponent = () => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx({ count }, (awaited) => (
              <div data-testid="value">{awaited.count}</div>
            ))}
          </Suspense>
        );
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("0");
      });

      // Rapid changes
      act(() => {
        count.set(Promise.resolve(1));
        count.set(Promise.resolve(2));
        count.set(Promise.resolve(3));
      });

      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("3");
      });
    });

    it("should cleanup subscriptions on unmount", async () => {
      const count = signal(Promise.resolve(0));
      let subscriptionCount = 0;

      const originalOn = count.on.bind(count);
      count.on = vi.fn((listener) => {
        subscriptionCount++;
        const unsubscribe = originalOn(listener);
        return () => {
          subscriptionCount--;
          unsubscribe();
        };
      });

      const TestComponent = () => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx({ count }, (awaited) => (
              <div data-testid="value">{awaited.count}</div>
            ))}
          </Suspense>
        );
      };

      const { unmount } = render(<TestComponent />);
      await waitFor(() => {
        expect(subscriptionCount).toBeGreaterThan(0);
      });

      unmount();
      // Subscription should be cleaned up
      expect(subscriptionCount).toBe(0);
    });

    it("should handle signals object reference changes", async () => {
      const count1 = signal(Promise.resolve(1));
      const count2 = signal(Promise.resolve(2));

      const TestComponent = ({ useFirst }: { useFirst: boolean }) => {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            {rx(useFirst ? { count: count1 } : { count: count2 }, (awaited) => (
              <div data-testid="value">{awaited.count}</div>
            ))}
          </Suspense>
        );
      };

      const { rerender } = render(<TestComponent useFirst={true} />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("1");
      });

      // Change signals object reference
      rerender(<TestComponent useFirst={false} />);
      await waitFor(() => {
        expect(screen.getByTestId("value")).toHaveTextContent("2");
      });
    });
  });

  describe("Integration with React state", () => {
    it("should work with useState in parent component", () => {
      const TestComponent = () => {
        const [value, setValue] = useState(0);
        return (
          <div>
            {rx(() => (
              <div data-testid="static">{value}</div>
            ))}
            <button data-testid="button" onClick={() => setValue(value + 1)}>
              Increment
            </button>
          </div>
        );
      };

      render(<TestComponent />);
      expect(screen.getByTestId("static")).toHaveTextContent("0");

      // Note: This won't re-render because rx() doesn't track useState
      // This demonstrates the static nature of overload 1 without watch
    });

    it("should work with useState and watch array", () => {
      const TestComponent = () => {
        const [value, setValue] = useState(0);
        return (
          <div>
            {rx(
              () => (
                <div data-testid="watched">{value}</div>
              ),
              { watch: [value] }
            )}
            <button data-testid="button" onClick={() => setValue(value + 1)}>
              Increment
            </button>
          </div>
        );
      };

      render(<TestComponent />);
      expect(screen.getByTestId("watched")).toHaveTextContent("0");

      act(() => {
        screen.getByTestId("button").click();
      });

      expect(screen.getByTestId("watched")).toHaveTextContent("1");
    });
  });
});
