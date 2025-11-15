import { describe, it, expect, vi } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import React from "react";
import { useAction } from "./useAction";
import { cancellableAction } from "./cancellableAction";
import { delay } from "./delay";

describe("useAction", () => {
  describe("Mode 1: Global Action (Reactive)", () => {
    it("should make global action reactive", async () => {
      // Create global action
      const fetchData = cancellableAction(async (signal: AbortSignal) => {
        await delay(10);
        return { data: "success" };
      });

      const Component = () => {
        const dataAction = useAction(fetchData);
        
        return (
          <div>
            <div data-testid="status">{dataAction.status}</div>
            <div data-testid="data">{dataAction.result?.data || "none"}</div>
            <button onClick={() => dataAction()}>Fetch</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(<Component />);
      
      expect(getByTestId("status").textContent).toBe("idle");
      expect(getByTestId("data").textContent).toBe("none");

      act(() => {
        getByText("Fetch").click();
      });

      // Should show loading immediately
      await waitFor(() => {
        expect(getByTestId("status").textContent).toBe("loading");
      });

      // Should show data after completion
      await waitFor(() => {
        expect(getByTestId("data").textContent).toBe("success");
      });

      expect(getByTestId("status").textContent).toBe("success");
    });

    it("should share action state across components", async () => {
      const sharedAction = cancellableAction(async (signal: AbortSignal, value: number) => {
        await delay(10);
        return value * 2;
      });

      const Component1 = () => {
        const myAction = useAction(sharedAction);
        return (
          <div>
            <div data-testid="comp1-data">{myAction.result || 0}</div>
            <button onClick={() => myAction(5)}>Run</button>
          </div>
        );
      };

      const Component2 = () => {
        const myAction = useAction(sharedAction);
        return <div data-testid="comp2-data">{myAction.result || 0}</div>;
      };

      const { getByTestId, getByText } = render(
        <div>
          <Component1 />
          <Component2 />
        </div>
      );

      act(() => {
        getByText("Run").click();
      });

      // Both components should show the same data
      await waitFor(() => {
        expect(getByTestId("comp1-data").textContent).toBe("10");
        expect(getByTestId("comp2-data").textContent).toBe("10");
      });
    });

    it("should handle action errors", async () => {
      const failingAction = cancellableAction(async () => {
        await delay(10);
        throw new Error("Action failed");
      });

      const Component = () => {
        const myAction = useAction(failingAction);
        
        return (
          <div>
            <div data-testid="error">{myAction.error?.message || "none"}</div>
            <button onClick={() => myAction().catch(() => {})}>Run</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(<Component />);

      act(() => {
        getByText("Run").click();
      });

      await waitFor(() => {
        expect(getByTestId("error").textContent).toBe("Action failed");
      });
    });

    it("should handle action reset", async () => {
      const myAction = cancellableAction(async () => {
        await delay(10);
        return "data";
      });

      const Component = () => {
        const localAction = useAction(myAction);
        
        return (
          <div>
            <div data-testid="data">{localAction.result || "none"}</div>
            <button onClick={() => localAction()}>Run</button>
            <button onClick={() => localAction.reset()}>Reset</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(<Component />);

      act(() => {
        getByText("Run").click();
      });

      await waitFor(() => {
        expect(getByTestId("data").textContent).toBe("data");
      });

      act(() => {
        getByText("Reset").click();
      });

      await waitFor(() => {
        expect(getByTestId("data").textContent).toBe("none");
      });
    });
  });

  describe("Mode 2: Local Action Creation", () => {
    it("should create local action from function", async () => {
      const Component = () => {
        const myAction = useAction(async (signal: AbortSignal, value: number) => {
          await delay(10);
          return value * 2;
        });

        return (
          <div>
            <div data-testid="status">{myAction.status}</div>
            <div data-testid="data">{myAction.result || 0}</div>
            <button onClick={() => myAction(5)}>Run</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(<Component />);

      act(() => {
        getByText("Run").click();
      });

      await waitFor(() => {
        expect(getByTestId("status").textContent).toBe("loading");
      });

      await waitFor(() => {
        expect(getByTestId("data").textContent).toBe("10");
      });
    });

    it("should call option callbacks", async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const onLoading = vi.fn();
      const onDone = vi.fn();

      const Component = () => {
        const myAction = useAction(
          async () => {
            await delay(10);
            return "result";
          },
          {
            on: {
              loading: onLoading,
              success: onSuccess,
              error: onError,
              done: onDone,
            },
          }
        );

        return <button onClick={() => myAction()}>Run</button>;
      };

      const { getByText } = render(<Component />);

      act(() => {
        getByText("Run").click();
      });

      await waitFor(() => {
        expect(onLoading).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith("result");
        expect(onDone).toHaveBeenCalledWith(undefined, "result");
      });

      expect(onError).not.toHaveBeenCalled();
    });

    it("should call error callback on failure", async () => {
      const onError = vi.fn();
      const onDone = vi.fn();

      const Component = () => {
        const myAction = useAction(
          async () => {
            await delay(10);
            throw new Error("Failed");
          },
          {
            on: {
              error: onError,
              done: onDone,
            },
          }
        );

        return <button onClick={() => myAction().catch(() => {})}>Run</button>;
      };

      const { getByText } = render(<Component />);

      act(() => {
        getByText("Run").click();
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({
          message: "Failed"
        }));
      });

      expect(onDone).toHaveBeenCalled();
    });

    it("should use latest function on each run", async () => {
      const Component = () => {
        const [multiplier, setMultiplier] = React.useState(2);
        
        const myAction = useAction(async (signal: AbortSignal, value: number) => {
          await delay(10);
          return value * multiplier; // Uses current multiplier
        });

        return (
          <div>
            <div data-testid="data">{myAction.result || 0}</div>
            <button onClick={() => myAction(5)}>Run</button>
            <button onClick={() => setMultiplier(3)}>Change Multiplier</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(<Component />);

      act(() => {
        getByText("Run").click();
      });

      await waitFor(() => {
        expect(getByTestId("data").textContent).toBe("10"); // 5 * 2
      });

      act(() => {
        getByText("Change Multiplier").click();
      });

      act(() => {
        getByText("Run").click();
      });

      await waitFor(() => {
        expect(getByTestId("data").textContent).toBe("15"); // 5 * 3
      });
    });

    it("should create separate actions for each component instance", async () => {
      const Component = ({ id }: { id: number }) => {
        const myAction = useAction(async (signal: AbortSignal) => {
          await delay(10);
          return `result-${id}`;
        });

        return (
          <div>
            <div data-testid={`data-${id}`}>{myAction.result || "none"}</div>
            <button onClick={() => myAction()}>Run {id}</button>
          </div>
        );
      };

      const { getByTestId, getByText } = render(
        <div>
          <Component id={1} />
          <Component id={2} />
        </div>
      );

      act(() => {
        getByText("Run 1").click();
      });

      await waitFor(() => {
        expect(getByTestId("data-1").textContent).toBe("result-1");
      });

      // Second component should still show "none"
      expect(getByTestId("data-2").textContent).toBe("none");

      act(() => {
        getByText("Run 2").click();
      });

      await waitFor(() => {
        expect(getByTestId("data-2").textContent).toBe("result-2");
      });
    });
  });

  describe("Abort handling", () => {
    it("should abort previous action when new run starts", async () => {
      const abortSpy = vi.fn();

      const Component = () => {
        const myAction = useAction(async (signal: AbortSignal, id: number) => {
          signal.addEventListener("abort", () => abortSpy(id));
          await delay(100);
          return `result-${id}`;
        });

        return (
          <div>
            <button onClick={() => myAction(1)}>Run 1</button>
            <button onClick={() => myAction(2)}>Run 2</button>
          </div>
        );
      };

      const { getByText } = render(<Component />);

      act(() => {
        getByText("Run 1").click();
      });

      await delay(10);

      act(() => {
        getByText("Run 2").click();
      });

      await waitFor(() => {
        expect(abortSpy).toHaveBeenCalledWith(1); // First run aborted
      });
    });
  });

  describe("Cleanup", () => {
    it("should cleanup subscription on unmount", async () => {
      const myAction = cancellableAction(async () => {
        return "data";
      });

      const Component = () => {
        const localAction = useAction(myAction);
        return <div>{localAction.result || "none"}</div>;
      };

      const { unmount } = render(<Component />);

      // Should not throw or cause memory leaks
      unmount();
    });
  });

  describe("Microtask debouncing", () => {
    it("should batch multiple state changes into one render", async () => {
      const renderSpy = vi.fn();

      const Component = () => {
        renderSpy();
        
        const myAction = useAction(async () => {
          await delay(10);
          return "result";
        });

        return <button onClick={() => myAction()}>Run</button>;
      };

      const { getByText } = render(<Component />);

      const initialRenders = renderSpy.mock.calls.length;

      act(() => {
        getByText("Run").click();
      });

      // Should batch loading + data changes
      await waitFor(() => {
        // Should have fewer renders than individual state changes
        expect(renderSpy.mock.calls.length).toBeLessThan(initialRenders + 3);
      });
    });
  });
});
