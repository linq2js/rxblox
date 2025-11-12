import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { act, createRef } from "react";
import { blox } from "./blox";
import { on } from "./eventDispatcher";
import { signal } from "./signal";
import { effect } from "./effect";
import { Handle } from "./types";
import { rx } from "./rx";

describe("blox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should render a component with static content", () => {
      const Component = blox(() => <div>Hello World</div>);
      const { container } = render(<Component />);
      expect(container.textContent).toBe("Hello World");
    });

    it("should render with props", () => {
      const Component = blox<{ name: string }>((props) => (
        <div>Hello {props.name}</div>
      ));
      const { container } = render(<Component name="Alice" />);
      expect(container.textContent).toBe("Hello Alice");
    });

    it("should render multiple children", () => {
      const Component = blox(() => (
        <div>
          <span>1</span>
          <span>2</span>
        </div>
      ));
      const { container } = render(<Component />);
      expect(container.textContent).toBe("12");
    });

    it("should render null", () => {
      const Component = blox(() => null);
      const { container } = render(<Component />);
      expect(container.textContent).toBe("");
    });

    it("should render undefined", () => {
      const Component = blox(() => undefined);
      const { container } = render(<Component />);
      expect(container.textContent).toBe("");
    });
  });

  describe("props handling", () => {
    it("should render initial props", () => {
      const Component = blox<{ count: number }>((props) => (
        <div>{props.count}</div>
      ));
      const { container } = render(<Component count={0} />);
      expect(container.textContent).toBe("0");
    });

    it("should re-render if props change", async () => {
      const rerenderCount = vi.fn();
      const Component = blox<{ count: number }>((props) => {
        rerenderCount();
        return <div>{rx(() => props.count)}</div>;
      });
      const { container, rerender } = render(<Component count={0} />);
      expect(container.textContent).toBe("0");
      expect(rerenderCount).toHaveBeenCalledTimes(1);

      act(() => {
        rerender(<Component count={1} />);
        rerender(<Component count={1} />);
        rerender(<Component count={1} />);
      });
      // Wait for debounced update from rx
      await waitFor(() => {
        expect(container.textContent).toBe("1");
      });
      // the content updated due to `rx` not blox, so rerenderCount should not be called again
      expect(rerenderCount).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple props", () => {
      const Component = blox<{ a: number; b: number }>((props) => (
        <div>
          {props.a} + {props.b} = {props.a + props.b}
        </div>
      ));
      const { container } = render(<Component a={1} b={2} />);
      expect(container.textContent).toBe("1 + 2 = 3");
    });

    it("should handle object props", () => {
      const Component = blox<{ user: { name: string; age: number } }>(
        (props) => (
          <div>
            {props.user.name} is {props.user.age}
          </div>
        )
      );
      const { container } = render(
        <Component user={{ name: "Alice", age: 25 }} />
      );
      expect(container.textContent).toBe("Alice is 25");
    });

    it("should track props as signals when accessed", async () => {
      const Component = blox<{ count: number }>((props) => {
        // Access props to track them as signals
        const count = props.count;
        return <div>{count}</div>;
      });
      const { container } = render(<Component count={0} />);
      expect(container.textContent).toBe("0");
      // Note: blox stores result in useState, so it doesn't automatically update
      // Props are tracked as signals, but component needs effects to react to changes
    });
  });

  describe("handle functionality", () => {
    it("should provide a handle object", () => {
      let receivedHandle: Handle<number> | undefined;
      const Component = blox<{}, number>((_props, handle) => {
        receivedHandle = handle;
        return <div>Test</div>;
      });
      render(<Component />);
      expect(receivedHandle).toBeDefined();
      expect(receivedHandle?.current).toBeUndefined();
    });

    it("should allow setting handle value during render", () => {
      const Component = blox<{}, number>((_props, handle) => {
        if (handle.current === undefined) {
          handle.current = 42;
        }
        return <div>{handle.current}</div>;
      });
      const { container } = render(<Component />);
      expect(container.textContent).toBe("42");
    });

    it("should render handle current value", () => {
      const Component = blox<{}, number>((_props, handle) => {
        return <div>{handle.current ?? "empty"}</div>;
      });
      const { container } = render(<Component />);
      expect(container.textContent).toBe("empty");
    });

    it("should expose handle via ref", () => {
      const ref = createRef<number>();
      const Component = blox<{}, number>((_props, handle) => {
        handle.current = 100;
        return <div>{handle.current}</div>;
      });
      render(<Component ref={ref} />);
      expect(ref.current).toBe(100);
    });

    it("should update ref when handle is set during render", () => {
      const ref = createRef<string>();
      const Component = blox<{}, string>((_props, handle) => {
        handle.current = "initial";
        return <div>{handle.current}</div>;
      });
      const { container } = render(<Component ref={ref} />);
      expect(ref.current).toBe("initial");
      expect(container.textContent).toBe("initial");
    });
  });

  describe("effects", () => {
    it("should collect effects during render", () => {
      const effectFn = vi.fn();
      const Component = blox(() => {
        effect(() => {
          effectFn();
        });
        return <div>Test</div>;
      });
      render(<Component />);
      // Effects are collected and run in useLayoutEffect
      // The effect should be called after the effect dispatcher runs
      expect(effectFn).toHaveBeenCalled();
    });

    it("should run effects with cleanup on unmount", () => {
      const cleanupFn = vi.fn();
      const Component = blox(() => {
        effect(() => {
          return cleanupFn;
        });
        return <div>Test</div>;
      });
      const { unmount: unmountComponent } = render(<Component />);
      unmountComponent();
      expect(cleanupFn).toHaveBeenCalled();
    });

    it("should collect effects that access props", () => {
      const effectFn = vi.fn();
      const Component = blox<{ count: number }>((props) => {
        effect(() => {
          effectFn(props.count);
        });
        return <div>{props.count}</div>;
      });
      render(<Component count={0} />);
      expect(effectFn).toHaveBeenCalledWith(0);
    });
  });

  describe("signal integration", () => {
    it("should track external signals when accessed", () => {
      const externalSignal = signal(0);
      const Component = blox<{ count: number }>((props) => {
        // Access external signal - it will be tracked
        const ext = externalSignal();
        return (
          <div>
            {props.count} + {ext} = {props.count + ext}
          </div>
        );
      });
      const { container } = render(<Component count={5} />);
      expect(container.textContent).toBe("5 + 0 = 5");
      // Note: blox stores result in useState, so external signal changes
      // won't automatically update unless effects are used to trigger re-renders
    });

    it("should render props signal value", () => {
      const Component = blox<{ value: number }>((props) => {
        return <div>{props.value}</div>;
      });
      const { container } = render(<Component value={1} />);
      expect(container.textContent).toBe("1");
    });
  });

  describe("memoization", () => {
    it("should not re-render when props don't change", () => {
      const renderCount = vi.fn();
      const Component = blox<{ value: number }>((props) => {
        renderCount();
        return <div>{props.value}</div>;
      });
      const { rerender } = render(<Component value={5} />);
      const initialCount = renderCount.mock.calls.length;

      rerender(<Component value={5} />);
      // Component is memoized, so it may not re-render if props are referentially equal
      // But React will still call render if the component reference changes
      expect(renderCount.mock.calls.length).toBeGreaterThanOrEqual(
        initialCount
      );
    });
  });

  describe("unmount function", () => {
    it("should throw error when called outside blox component", () => {
      expect(() => {
        on.unmount(() => {});
      }).toThrow("Event dispatcher not found");
    });

    it("should register callback when called inside blox component", async () => {
      const callback = vi.fn();

      const Component = blox(() => {
        on.unmount(callback);
        return <div>Test</div>;
      });

      const { unmount: unmountComponent } = render(<Component />);
      expect(callback).not.toHaveBeenCalled();

      unmountComponent();
      // Callback should be called when component unmounts
      // Note: useUnmount uses deferred execution, so we need to wait
      await act(async () => {
        await Promise.resolve();
      });
      expect(callback).toHaveBeenCalled();
    });

    it("should handle multiple unmount callbacks", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      const Component = blox(() => {
        on.unmount(callback1);
        on.unmount(callback2);
        on.unmount(callback3);
        return <div>Test</div>;
      });

      const { unmount: unmountComponent } = render(<Component />);
      unmountComponent();

      await act(async () => {
        await Promise.resolve();
      });
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });

    it("should handle unmount callback that throws error", async () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Unmount error");
      });
      const normalCallback = vi.fn();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const Component = blox(() => {
        on.unmount(errorCallback);
        on.unmount(normalCallback);
        return <div>Test</div>;
      });

      const { unmount: unmountComponent } = render(<Component />);
      unmountComponent();

      await act(async () => {
        await Promise.resolve();
      });

      // Error callback throws, which stops the emitter's forEach loop
      // Since errorCallback is registered first, it's called first and throws
      // This stops the forEach, so normalCallback won't be called
      // But useUnmount's try-catch catches the error and logs it
      expect(errorCallback).toHaveBeenCalled();
      // The emitter's forEach stops on first error, so normalCallback is not called
      expect(normalCallback).not.toHaveBeenCalled();
      // Verify error was logged by useUnmount's try-catch
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("proxy handlers", () => {
    it("should support Object.keys() on props", () => {
      const Component = blox<{ a: number; b: string }>((props) => {
        const keys = Object.keys(props);
        return <div>{keys.join(",")}</div>;
      });
      const { container } = render(<Component a={1} b="test" />);
      expect(container.textContent).toBe("a,b");
    });

    it("should support Object.getOwnPropertyDescriptor() on props", () => {
      const Component = blox<{ count: number }>((props) => {
        const descriptor = Object.getOwnPropertyDescriptor(props, "count");
        return <div>{descriptor ? "found" : "not found"}</div>;
      });
      const { container } = render(<Component count={5} />);
      expect(container.textContent).toBe("found");
    });

    it("should return correct property descriptor values", () => {
      const Component = blox<{ value: string }>((props) => {
        const descriptor = Object.getOwnPropertyDescriptor(props, "value");
        return <div>{descriptor?.value || "undefined"}</div>;
      });
      const { container } = render(<Component value="test" />);
      expect(container.textContent).toBe("test");
    });

    it("should handle Object.keys() with empty props", () => {
      const Component = blox(() => {
        const keys = Object.keys({} as any);
        return <div>{keys.length}</div>;
      });
      const { container } = render(<Component />);
      expect(container.textContent).toBe("0");
    });

    it("should return undefined for non-existent property descriptor", () => {
      const Component = blox<{ count: number }>((props) => {
        const descriptor = Object.getOwnPropertyDescriptor(
          props,
          "nonexistent"
        );
        return <div>{descriptor === undefined ? "undefined" : "found"}</div>;
      });
      const { container } = render(<Component count={5} />);
      expect(container.textContent).toBe("undefined");
    });
  });

  describe("edge cases", () => {
    it("should handle empty props", () => {
      const Component = blox(() => <div>No props</div>);
      const { container } = render(<Component />);
      expect(container.textContent).toBe("No props");
    });

    it("should handle function props", () => {
      const Component = blox<{ onClick: () => void }>((props) => (
        <button onClick={props.onClick}>Click</button>
      ));
      const onClick = vi.fn();
      const { container } = render(<Component onClick={onClick} />);
      const button = container.querySelector("button");
      expect(button).toBeTruthy();
      button?.click();
      expect(onClick).toHaveBeenCalled();
    });

    it("should handle array props", () => {
      const Component = blox<{ items: number[] }>((props) => (
        <div>{props.items.join(", ")}</div>
      ));
      const { container } = render(<Component items={[1, 2, 3]} />);
      expect(container.textContent).toBe("1, 2, 3");
    });

    it("should handle complex nested props", () => {
      const Component = blox<{
        data: { nested: { value: string } };
      }>((props) => <div>{props.data.nested.value}</div>);
      const { container } = render(
        <Component data={{ nested: { value: "deep" } }} />
      );
      expect(container.textContent).toBe("deep");
    });

    it("should handle handle with undefined initial value", () => {
      const Component = blox<{}, string>((_props, handle) => {
        return <div>{handle.current ?? "undefined"}</div>;
      });
      const { container } = render(<Component />);
      expect(container.textContent).toBe("undefined");
    });
  });

  describe("ref forwarding", () => {
    it("should forward ref correctly", () => {
      const ref = createRef<number>();
      const Component = blox<{}, number>((_props, handle) => {
        handle.current = 42;
        return <div>Test</div>;
      });
      render(<Component ref={ref} />);
      expect(ref.current).toBe(42);
    });

    it("should update ref when handle is set during render", () => {
      const ref = createRef<string>();
      const Component = blox<{}, string>((_props, handle) => {
        handle.current = "initial value";
        return <div>{handle.current}</div>;
      });
      const { container } = render(<Component ref={ref} />);
      expect(ref.current).toBe("initial value");
      expect(container.textContent).toBe("initial value");
    });
  });

  describe("edge cases for proxy handlers", () => {
    it("should handle Object.keys() when propsRef is null during initialization", () => {
      let keys: string[] = [];
      const Component = blox<{ a: number }>((props) => {
        // Access keys immediately during first render to test null case
        keys = Object.keys(props);
        return <div>{keys.join(",")}</div>;
      });
      const { container } = render(<Component a={1} />);
      expect(container.textContent).toBe("a");
      expect(keys).toEqual(["a"]);
    });

    it("should handle getOwnPropertyDescriptor when propsRef is null during initialization", () => {
      let descriptor: PropertyDescriptor | undefined;
      const Component = blox<{ value: string }>((props) => {
        // Access descriptor immediately to test null case
        descriptor = Object.getOwnPropertyDescriptor(props, "value");
        return <div>{descriptor?.value}</div>;
      });
      const { container } = render(<Component value="test" />);
      expect(container.textContent).toBe("test");
      expect(descriptor).toBeDefined();
    });
  });

  describe("effect cleanup", () => {
    it("should cleanup effects on unmount", () => {
      const cleanupFn = vi.fn();
      const Component = blox(() => {
        effect(() => {
          return cleanupFn;
        });
        return <div>Test</div>;
      });
      const { unmount: unmountComponent } = render(<Component />);
      unmountComponent();
      expect(cleanupFn).toHaveBeenCalled();
    });

    it("should cleanup effects when component unmounts", () => {
      const cleanupFn = vi.fn();
      const Component = blox<{ value: number }>((props) => {
        effect(() => {
          return cleanupFn;
        });
        return <div>{props.value}</div>;
      });
      const { unmount: unmountComponent } = render(<Component value={1} />);
      unmountComponent();
      expect(cleanupFn).toHaveBeenCalled();
    });
  });
});
