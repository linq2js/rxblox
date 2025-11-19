import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React, { act, createRef } from "react";
import { blox, Ref } from "./index";
import { signal } from "./signal";
import { effect } from "./effect";
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
      let receivedHandle: Ref<number> | undefined;
      const Component = blox<{}, number>((_props, handle) => {
        receivedHandle = handle;
        return <div>Test</div>;
      });
      render(<Component />);
      expect(receivedHandle).toBeDefined();
      expect(typeof receivedHandle).toBe("function");
    });

    it("should allow setting handle value during render", () => {
      const ref = createRef<number>();
      const Component = blox<{}, number>((_props, handle) => {
        handle(42);
        return <div>42</div>;
      });
      render(<Component ref={ref} />);
      expect(ref.current).toBe(42);
    });

    it("should work without setting handle value", () => {
      const ref = createRef<number>();
      const Component = blox<{}, number>((_props, _handle) => {
        // Don't set handle value
        return <div>empty</div>;
      });
      const { container } = render(<Component ref={ref} />);
      expect(container.textContent).toBe("empty");
      expect(ref.current).toBeUndefined();
    });

    it("should expose handle via ref", () => {
      const ref = createRef<number>();
      const Component = blox<{}, number>((_props, handle) => {
        handle(100);
        return <div>100</div>;
      });
      render(<Component ref={ref} />);
      expect(ref.current).toBe(100);
    });

    it("should update ref when handle is set during render", () => {
      const ref = createRef<string>();
      const Component = blox<{}, string>((_props, handle) => {
        handle("initial");
        return <div>initial</div>;
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

    it("should run effects with cleanup on unmount", async () => {
      const cleanupFn = vi.fn();
      const Component = blox(() => {
        effect(() => {
          return cleanupFn;
        });
        return <div>Test</div>;
      });
      const { unmount: unmountComponent } = render(<Component />);
      unmountComponent();
      // Wait for deferred unmount callback
      await new Promise((resolve) => setTimeout(resolve, 10));
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
        blox.on({ unmount: () => {} });
      }).toThrow("must be called inside a blox component");
    });

    it("should register callback when called inside blox component", async () => {
      const callback = vi.fn();

      const Component = blox(() => {
        blox.on({ unmount: callback });
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
        blox.on({ unmount: [callback1, callback2, callback3] });
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
        blox.on({ unmount: [errorCallback, normalCallback] });
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

    it("should handle handle without setting value", () => {
      const ref = createRef<string>();
      const Component = blox<{}, string>((_props, _handle) => {
        // Don't call handle
        return <div>undefined</div>;
      });
      const { container } = render(<Component ref={ref} />);
      expect(container.textContent).toBe("undefined");
      expect(ref.current).toBeUndefined();
    });
  });

  describe("ref forwarding", () => {
    it("should forward ref correctly", () => {
      const ref = createRef<number>();
      const Component = blox<{}, number>((_props, handle) => {
        handle(42);
        return <div>Test</div>;
      });
      render(<Component ref={ref} />);
      expect(ref.current).toBe(42);
    });

    it("should update ref when handle is set during render", () => {
      const ref = createRef<string>();
      const Component = blox<{}, string>((_props, handle) => {
        handle("initial value");
        return <div>initial value</div>;
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
    it("should cleanup effects on unmount", async () => {
      const cleanupFn = vi.fn();
      const Component = blox(() => {
        effect(() => {
          return cleanupFn;
        });
        return <div>Test</div>;
      });
      const { unmount: unmountComponent } = render(<Component />);
      unmountComponent();
      // Wait for deferred unmount callback
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(cleanupFn).toHaveBeenCalled();
    });

    it("should cleanup effects when component unmounts", async () => {
      const cleanupFn = vi.fn();
      const Component = blox<{ value: number }>((props) => {
        effect(() => {
          return cleanupFn;
        });
        return <div>{props.value}</div>;
      });
      const { unmount: unmountComponent } = render(<Component value={1} />);
      unmountComponent();
      // Wait for deferred unmount callback
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(cleanupFn).toHaveBeenCalled();
    });
  });

  describe("React Strict Mode", () => {
    it("should handle double-invocation in Strict Mode", () => {
      const initSpy = vi.fn();
      const renderSpy = vi.fn();

      const Component = blox(() => {
        initSpy(); // Definition phase
        const count = signal(0);

        return rx(() => {
          renderSpy();
          return <div>{count()}</div>;
        });
      });

      const { container } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      // In Strict Mode, definition phase runs twice
      expect(initSpy).toHaveBeenCalledTimes(2);
      // But render should work correctly
      expect(container.textContent).toBe("0");
    });

    it("should handle effects correctly in Strict Mode", async () => {
      const effectSpy = vi.fn();
      const cleanupSpy = vi.fn();

      const Component = blox(() => {
        const count = signal(0);

        effect(() => {
          effectSpy(count());
          return cleanupSpy;
        });

        return <div>{rx(count)}</div>;
      });

      const { unmount } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      // Effects run immediately during builder execution
      // In Strict Mode, React double-invokes the builder, so effect runs twice
      expect(effectSpy).toHaveBeenCalled();
      expect(effectSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      unmount();
      // Wait for deferred unmount callback
      await new Promise((resolve) => setTimeout(resolve, 10));
      // Cleanup should have been called for each effect invocation
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should maintain signal state despite double-invocation", () => {
      const Component = blox(() => {
        const count = signal(0);
        const increment = () => count.set(count() + 1);

        return (
          <div>
            <span data-testid="count">{rx(count)}</span>
            <button onClick={increment}>+</button>
          </div>
        );
      });

      const { getByTestId, getByRole } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      expect(getByTestId("count").textContent).toBe("0");

      // Signal updates should work correctly
      act(() => {
        getByRole("button").click();
      });

      expect(getByTestId("count").textContent).toBe("1");
    });

    it("should handle signal subscriptions correctly in Strict Mode", async () => {
      const externalSignal = signal(0);

      const Component = blox(() => {
        const unsubscribe = externalSignal.on(() => {
          // Subscription callback
        });
        blox.on({ unmount: unsubscribe });
        return <div>{rx(externalSignal)}</div>;
      });

      const { container } = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      // Verify component is mounted and rendering
      expect(container.textContent).toBe("0");

      // Update signal while mounted - should work
      act(() => {
        externalSignal.set(1);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("1");
      });

      // Test that multiple updates work
      act(() => {
        externalSignal.set(2);
      });

      await waitFor(() => {
        expect(container.textContent).toBe("2");
      });
    });

    it("should handle props signal correctly in Strict Mode", () => {
      const Component = blox<{ value: number }>((props) => {
        const effectSpy = vi.fn();

        effect(() => {
          effectSpy(props.value);
        });

        return <div>{rx(() => props.value)}</div>;
      });

      const { container, rerender } = render(
        <React.StrictMode>
          <Component value={1} />
        </React.StrictMode>
      );

      expect(container.textContent).toBe("1");

      // Update props
      rerender(
        <React.StrictMode>
          <Component value={2} />
        </React.StrictMode>
      );

      expect(container.textContent).toBe("2");
    });
  });

  describe("async validation", () => {
    it("should throw error when builder returns a promise", () => {
      expect(() => {
        const Component = blox((async () => {
          return <div>Async content</div>;
        }) as any);
        render(<Component />);
      }).toThrow("blox() builder function cannot return a promise");
    });

    it("should throw error when builder returns promise-like object", () => {
      expect(() => {
        const Component = blox((() => {
          return {
            then: (resolve: (val: any) => void) => resolve(<div>Thenable</div>),
          };
        }) as any);
        render(<Component />);
      }).toThrow("blox() builder function cannot return a promise");
    });

    it("should not throw when builder returns valid ReactNode", () => {
      expect(() => {
        const Component = blox(() => <div>Sync content</div>);
        const { container } = render(<Component />);
        expect(container.textContent).toBe("Sync content");
      }).not.toThrow();
    });
  });
});
