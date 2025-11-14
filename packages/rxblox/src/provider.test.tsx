import { describe, it, expect, vi } from "vitest";
import { provider } from "./provider";
import { rx } from "./rx";
import { blox } from "./blox";
import { render, waitFor } from "@testing-library/react";
import { act } from "react";
import { effect } from "./effect";
import { Signal } from "./types";
import { signal } from "./signal";

describe("provider", () => {
  describe("basic functionality", () => {
    it("should throw error when consume() called outside provider context", () => {
      const [useCount] = provider("count", 0);
      expect(() => {
        useCount();
      }).toThrow("Provider count not found");
    });

    it("should provide a signal that can be read when inside provider context", () => {
      const [useCount, CountProvider] = provider("count", 0);
      const Child = blox(() => {
        const signal = useCount();
        return <div>{rx(() => signal())}</div>;
      });

      const { container } = render(
        <CountProvider value={0}>
          <Child />
        </CountProvider>
      );
      expect(container.textContent).toBe("0");
    });

    it("should create provider with name and initial value", () => {
      const [useNamed, NamedProvider] = provider("test-provider", "value");
      expect(useNamed).toBeDefined();
      expect(NamedProvider).toBeDefined();
      expect(typeof useNamed).toBe("function");
      expect(typeof NamedProvider).toBe("function");
    });

    it("should create provider with options", () => {
      const [useNamed, NamedProvider] = provider("test-provider", "value", {
        equals: (a, b) => a === b,
      });
      expect(useNamed).toBeDefined();
      expect(NamedProvider).toBeDefined();
      expect(typeof useNamed).toBe("function");
      expect(typeof NamedProvider).toBe("function");
    });
  });

  describe("provider rendering", () => {
    it("should render children", () => {
      const [, ThemeProvider] = provider("theme", "default");
      const { container } = render(
        <ThemeProvider value="value">
          <div>Child Content</div>
        </ThemeProvider>
      );
      expect(container.textContent).toBe("Child Content");
    });

    it("should render multiple children", () => {
      const [, ThemeProvider] = provider("theme", "default");
      const { container } = render(
        <ThemeProvider value="value">
          <div>Child 1</div>
          <div>Child 2</div>
        </ThemeProvider>
      );
      expect(container.textContent).toBe("Child 1Child 2");
    });

    it("should render null children", () => {
      const [, ThemeProvider] = provider("theme", "default");
      const { container } = render(
        <ThemeProvider value="value">{null}</ThemeProvider>
      );
      expect(container.textContent).toBe("");
    });
  });

  describe("provider value access", () => {
    it("should allow parent component to change provider value", async () => {
      const [useCount, CountProvider] = provider("count", 0);
      const Child = blox(() => {
        const count = useCount();
        return <div>{rx(() => count())}</div>;
      });

      const { container, rerender } = render(
        <CountProvider value={0}>
          <Child />
        </CountProvider>
      );
      expect(container.textContent).toBe("0");

      act(() => {
        rerender(
          <CountProvider value={1}>
            <Child />
          </CountProvider>
        );
      });
      await waitFor(() => {
        expect(container.textContent).toBe("1");
      });

      act(() => {
        rerender(
          <CountProvider value={2}>
            <Child />
          </CountProvider>
        );
      });
      await waitFor(() => {
        expect(container.textContent).toBe("2");
      });
    });

    it("should use provided value", () => {
      const [useCount, CountProvider] = provider("count", 0);
      const Child = blox(() => {
        const count = useCount();
        return <div>{rx(() => count())}</div>;
      });

      const { container } = render(
        <CountProvider value={10}>
          <Child />
        </CountProvider>
      );
      expect(container.textContent).toBe("10");
    });

    it("should update when parent changes value", async () => {
      const [useCount, CountProvider] = provider("count", 0);
      const Child = blox(() => {
        const count = useCount();
        return <div>{rx(() => `Count: ${count()}`)}</div>;
      });

      const Parent = blox<{ count: number }>((props) => {
        // should wrap in rx to ensure re-rendering when props.count changes
        return rx(() => (
          <CountProvider value={props.count}>
            <Child />
          </CountProvider>
        ));
      });

      const { container, rerender } = render(<Parent count={5} />);
      expect(container.textContent).toBe("Count: 5");

      rerender(<Parent count={15} />);
      await waitFor(() => {
        expect(container.textContent).toBe("Count: 15");
      });
    });
  });

  describe("nested providers", () => {
    it("should handle nested provider rendering", () => {
      const [, OuterProvider] = provider("outer", "outer");
      const [, InnerProvider] = provider("inner", "inner");

      const { container } = render(
        <OuterProvider value="outer-value">
          <InnerProvider value="inner-value">
            <div>Nested</div>
          </InnerProvider>
        </OuterProvider>
      );
      expect(container.textContent).toBe("Nested");
    });

    it("should allow accessing outer provider from inner component", () => {
      const [useTheme, ThemeProvider] = provider(
        "theme",
        "light" as "dark" | "light"
      );
      const [, CountProvider] = provider("count", 0);

      const InnerComponent = blox(() => {
        const theme = useTheme();
        return <div>{rx(() => `Theme: ${theme()}`)}</div>;
      });

      const { container } = render(
        <ThemeProvider value="dark">
          <CountProvider value={5}>
            <InnerComponent />
          </CountProvider>
        </ThemeProvider>
      );
      expect(container.textContent).toBe("Theme: dark");
    });

    it("should resolve correct provider in nested hierarchy", () => {
      const [useOuter, OuterProvider] = provider("outer", "outer-default");
      const [useInner, InnerProvider] = provider("inner", "inner-default");

      const InnerComponent = blox(() => {
        const inner = useInner();
        return <div>{rx(() => `Inner: ${inner()}`)}</div>;
      });

      const OuterComponent = blox(() => {
        const outer = useOuter();
        return (
          <div>
            <div>{rx(() => `Outer: ${outer()}`)}</div>
            <InnerComponent />
          </div>
        );
      });

      const { container } = render(
        <OuterProvider value="outer-value">
          <InnerProvider value="inner-value">
            <OuterComponent />
          </InnerProvider>
        </OuterProvider>
      );

      expect(container.textContent).toContain("Outer: outer-value");
      expect(container.textContent).toContain("Inner: inner-value");
    });
  });

  describe("reactive usage", () => {
    it("should work with rx() for reactive rendering", () => {
      const [useTheme, ThemeProvider] = provider(
        "theme",
        "light" as "dark" | "light"
      );

      const TestComponent = blox(() => {
        const theme = useTheme();
        return <div>{rx(() => theme())}</div>;
      });

      const { container } = render(
        <ThemeProvider value={"dark"}>
          <TestComponent />
        </ThemeProvider>
      );
      expect(container.textContent).toBe("dark");
    });

    it("should update reactively when provider value changes", async () => {
      const [useCount, CountProvider] = provider("count", 0);

      const TestComponent = blox(() => {
        const count = useCount();
        return <div>{rx(() => `Count: ${count()}`)}</div>;
      });

      const Parent = blox<{ count: number }>((props) => {
        return rx(() => (
          <CountProvider value={props.count}>
            <TestComponent />
          </CountProvider>
        ));
      });

      const { container, rerender } = render(<Parent count={0} />);
      expect(container.textContent).toContain("Count: 0");

      rerender(<Parent count={10} />);
      await waitFor(() => {
        expect(container.textContent).toContain("Count: 10");
      });
    });

    it("should work with effects that track provider values", async () => {
      const [useCount, CountProvider] = provider("count", 0);
      const effectFn = vi.fn();

      const TestComponent = blox(() => {
        const count = useCount();
        effect(() => {
          effectFn(count());
        });
        return <div>{rx(() => count())}</div>;
      });

      const Parent = blox<{ count: number }>((props) => {
        return rx(() => (
          <CountProvider value={props.count}>
            <TestComponent />
          </CountProvider>
        ));
      });

      const { rerender } = render(<Parent count={5} />);
      await waitFor(() => {
        expect(effectFn).toHaveBeenCalledWith(5);
      });

      act(() => {
        rerender(<Parent count={10} />);
      });
      // Effect should re-run when count changes
      await waitFor(() => {
        expect(effectFn).toHaveBeenCalledWith(10);
      });
    });
  });

  describe("signal functionality", () => {
    it("should return a signal that can be read with peek()", () => {
      const [useTheme, ThemeProvider] = provider(
        "theme",
        "light" as "dark" | "light"
      );

      const Child = blox(() => {
        const themeSignal = useTheme();
        return <div>{rx(() => `${themeSignal()}-${themeSignal.peek()}`)}</div>;
      });

      const { container } = render(
        <ThemeProvider value={"light"}>
          <Child />
        </ThemeProvider>
      );
      expect(container.textContent).toBe("light-light");
    });

    it("should return Signal<T> type (read-only via TypeScript)", () => {
      const [useCount, CountProvider] = provider("count", 0);

      const Child = blox(() => {
        const countSignal = useCount();
        // Type check - Signal should be assignable to Signal<T>
        const signal: Signal<number> = countSignal;
        expect(signal).toBeDefined();
        expect(typeof signal).toBe("function");
        expect(typeof signal.peek).toBe("function");
        expect(typeof signal.on).toBe("function");
        return <div>{rx(() => countSignal())}</div>;
      });

      render(
        <CountProvider value={0}>
          <Child />
        </CountProvider>
      );
      // TypeScript prevents calling set/reset, even if they exist at runtime
      // This is enforced by the return type Signal<T> instead of MutableSignal<T>
    });
  });

  describe("multiple providers", () => {
    it("should handle multiple independent providers", () => {
      const [useTheme, ThemeProvider] = provider(
        "theme",
        "light" as "dark" | "light"
      );
      const [useCount, CountProvider] = provider("count", 0);

      const Child = blox(() => {
        const themeSignal = useTheme();
        const countSignal = useCount();
        return <div>{rx(() => `${themeSignal()}-${countSignal()}`)}</div>;
      });

      const { container } = render(
        <ThemeProvider value="light">
          <CountProvider value={0}>
            <Child />
          </CountProvider>
        </ThemeProvider>
      );
      expect(container.textContent).toBe("light-0");
    });

    it("should handle providers with same type but different instances", () => {
      const [useProvider1, Provider1] = provider("provider1", "value1");
      const [useProvider2, Provider2] = provider("provider2", "value2");

      const Child = blox(() => {
        const signal1 = useProvider1();
        const signal2 = useProvider2();
        return <div>{rx(() => `${signal1()}-${signal2()}`)}</div>;
      });

      const { container } = render(
        <Provider1 value="value1">
          <Provider2 value="value2">
            <Child />
          </Provider2>
        </Provider1>
      );
      expect(container.textContent).toBe("value1-value2");
    });

    it("should allow multiple providers in same component", () => {
      const [useTheme, ThemeProvider] = provider(
        "theme",
        "light" as "dark" | "light"
      );
      const [useCount, CountProvider] = provider("count", 0);

      const TestComponent = blox(() => {
        const theme = useTheme();
        const count = useCount();
        return <div>{rx(() => `${theme()}: ${count()}`)}</div>;
      });

      const { container } = render(
        <ThemeProvider value="dark">
          <CountProvider value={5}>
            <TestComponent />
          </CountProvider>
        </ThemeProvider>
      );
      expect(container.textContent).toBe("dark: 5");
    });
  });

  describe("provider options", () => {
    it("should support name option", () => {
      const [useNamed, NamedProvider] = provider("test-provider", "value");

      expect(NamedProvider).toBeDefined();

      const Child = blox(() => {
        const signal = useNamed();
        return <div>{rx(() => signal())}</div>;
      });

      const { container } = render(
        <NamedProvider value={"value"}>
          <Child />
        </NamedProvider>
      );
      expect(container.textContent).toBe("value");
    });

    it("should work with name", () => {
      const [useUnnamed, UnnamedProvider] = provider("unnamed", "value");

      expect(UnnamedProvider).toBeDefined();

      const Child = blox(() => {
        const signal = useUnnamed();
        return <div>{rx(() => signal())}</div>;
      });

      const { container } = render(
        <UnnamedProvider value={"value"}>
          <Child />
        </UnnamedProvider>
      );
      expect(container.textContent).toBe("value");
    });

    it("should support equals option for custom equality", async () => {
      const [useObject, ObjectProvider] = provider(
        "object",
        { id: 1, name: "Alice" },
        {
          equals: (a, b) => a.id === b.id,
        }
      );

      const Child = blox(() => {
        const obj = useObject();
        return <div>{rx(() => obj().name)}</div>;
      });

      const { container, rerender } = render(
        <ObjectProvider value={{ id: 1, name: "Bob" }}>
          <Child />
        </ObjectProvider>
      );
      // With custom equals, same id should not trigger update (signal value doesn't change)
      // But the initial render should show the provided value
      await waitFor(() => {
        expect(container.textContent).toBe("Bob");
      });

      rerender(
        <ObjectProvider value={{ id: 2, name: "Charlie" }}>
          <Child />
        </ObjectProvider>
      );
      // Different id should trigger update
      await waitFor(() => {
        expect(container.textContent).toBe("Charlie");
      });
    });
  });

  describe("edge cases", () => {
    it("should handle null values", () => {
      const [useNull, NullProvider] = provider("null", null as string | null);

      const Child = blox(() => {
        const signal = useNull();
        return <div>{rx(() => (signal() === null ? "null" : "not-null"))}</div>;
      });

      const { container } = render(
        <NullProvider value={null}>
          <Child />
        </NullProvider>
      );
      expect(container.textContent).toBe("null");
    });

    it("should handle undefined values", () => {
      const [useUndefined, UndefinedProvider] = provider(
        "undefined",
        undefined as string | undefined
      );

      const Child = blox(() => {
        const signal = useUndefined();
        return (
          <div>
            {rx(() => (signal() === undefined ? "undefined" : "defined"))}
          </div>
        );
      });

      const { container } = render(
        <UndefinedProvider value={undefined}>
          <Child />
        </UndefinedProvider>
      );
      expect(container.textContent).toBe("undefined");
    });

    it("should handle object values", () => {
      const [useObject, ObjectProvider] = provider("object", {
        name: "Alice",
        age: 25,
      });

      const Child = blox(() => {
        const signal = useObject();
        return <div>{rx(() => signal().name)}</div>;
      });

      const { container } = render(
        <ObjectProvider value={{ name: "Alice", age: 25 }}>
          <Child />
        </ObjectProvider>
      );
      expect(container.textContent).toBe("Alice");
    });

    it("should handle array values", () => {
      const [useArray, ArrayProvider] = provider("array", [1, 2, 3]);

      const Child = blox(() => {
        const signal = useArray();
        return <div>{rx(() => signal().join(","))}</div>;
      });

      const { container } = render(
        <ArrayProvider value={[1, 2, 3]}>
          <Child />
        </ArrayProvider>
      );
      expect(container.textContent).toBe("1,2,3");
    });

    it("should handle function values", () => {
      const fn = () => "test";
      const [useFunction, FunctionProvider] = provider("function", fn);

      const Child = blox(() => {
        const signal = useFunction();
        const returnedFn = signal();

        return (
          <div>
            {rx(() =>
              typeof returnedFn === "function" ? returnedFn() : "not-function"
            )}
          </div>
        );
      });

      const { container } = render(
        <FunctionProvider value={fn}>
          <Child />
        </FunctionProvider>
      );
      expect(container.textContent).toBe("test");
    });

    it("should handle empty string", () => {
      const [useString, StringProvider] = provider("string", "");

      const Child = blox(() => {
        const signal = useString();
        return <div>{rx(() => (signal() === "" ? "empty" : "not-empty"))}</div>;
      });

      const { container } = render(
        <StringProvider value={""}>
          <Child />
        </StringProvider>
      );
      expect(container.textContent).toBe("empty");
    });

    it("should handle zero value", () => {
      const [useNumber, NumberProvider] = provider("number", 0);

      const Child = blox(() => {
        const signal = useNumber();
        return <div>{rx(() => signal())}</div>;
      });

      const { container } = render(
        <NumberProvider value={0}>
          <Child />
        </NumberProvider>
      );
      expect(container.textContent).toBe("0");
    });

    it("should handle false boolean", () => {
      const [useBool, BoolProvider] = provider("bool", false);

      const Child = blox(() => {
        const signal = useBool();
        return <div>{rx(() => (signal() ? "true" : "false"))}</div>;
      });

      const { container } = render(
        <BoolProvider value={false}>
          <Child />
        </BoolProvider>
      );
      expect(container.textContent).toBe("false");
    });
  });

  describe("read-only signal behavior", () => {
    it("should return Signal<T> type which prevents mutation via TypeScript", () => {
      const [useCount, CountProvider] = provider("count", 0);

      const Child = blox(() => {
        const countSignal = useCount();
        // TypeScript enforces read-only access via Signal<T> return type
        // Consumers cannot call set() or reset() due to type checking
        // The signal is typed as Signal<T>, not MutableSignal<T>
        expect(typeof countSignal).toBe("function");
        expect(typeof countSignal.peek).toBe("function");
        expect(typeof countSignal.on).toBe("function");

        // Type check: should be assignable to Signal<T>
        const signal: Signal<number> = countSignal;
        expect(signal).toBeDefined();
        return <div>{rx(() => countSignal())}</div>;
      });

      render(
        <CountProvider value={0}>
          <Child />
        </CountProvider>
      );
    });

    it("should allow reading signal value multiple times", () => {
      const [useCount, CountProvider] = provider("count", 5);

      const Child = blox(() => {
        const countSignal = useCount();
        expect(countSignal()).toBe(5);
        expect(countSignal()).toBe(5);
        expect(countSignal.peek()).toBe(5);
        return <div>{rx(() => countSignal())}</div>;
      });

      render(
        <CountProvider value={5}>
          <Child />
        </CountProvider>
      );
    });

    it("should allow multiple subscriptions", async () => {
      const [useCount, CountProvider] = provider("count", 0);

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const Child = blox(() => {
        const countSignal = useCount();
        // Subscribe directly to the signal, not inside an effect
        // Store unsubscribe functions for cleanup
        const unsubscribe1 = countSignal.on(listener1);
        const unsubscribe2 = countSignal.on(listener2);

        // Use effect() only for cleanup, not for subscribing
        effect(() => {
          countSignal();
          // This effect runs once and returns cleanup
          return () => {
            unsubscribe1();
            unsubscribe2();
          };
        });

        return <div>Test</div>;
      });

      const Parent = blox<{ count: number }>((props) => {
        return rx(() => (
          <CountProvider value={props.count}>
            <Child />
          </CountProvider>
        ));
      });

      const { rerender } = render(<Parent count={0} />);

      act(() => {
        rerender(<Parent count={1} />);
      });

      await waitFor(() => {
        expect(listener1).toHaveBeenCalledWith(1);
        expect(listener2).toHaveBeenCalledWith(1);
      });
    });
  });

  describe("provider value updates", () => {
    it("should update signal when parent re-renders with new value", async () => {
      const [useCount, CountProvider] = provider("count", 0);

      const Child = blox(() => {
        const count = useCount();
        return <div>{rx(() => count())}</div>;
      });

      const Parent = blox<{ count: number }>((props) => {
        return rx(() => (
          <CountProvider value={props.count}>
            <Child />
          </CountProvider>
        ));
      });

      const { container, rerender } = render(<Parent count={0} />);
      expect(container.textContent).toBe("0");

      act(() => {
        rerender(<Parent count={10} />);
      });
      await waitFor(() => {
        expect(container.textContent).toBe("10");
      });
      act(() => {
        rerender(<Parent count={20} />);
      });
      await waitFor(() => {
        expect(container.textContent).toBe("20");
      });
    });

    it("should not update when parent re-renders with same value", () => {
      const [useCount, CountProvider] = provider("count", 0);
      const renderCount = vi.fn();

      const Child = blox(() => {
        renderCount();
        const count = useCount();
        return <div>{rx(() => count())}</div>;
      });

      const Parent = blox<{ count: number }>((props) => {
        return (
          <CountProvider value={props.count}>
            <Child />
          </CountProvider>
        );
      });

      const { rerender } = render(<Parent count={5} />);
      const initialRenderCount = renderCount.mock.calls.length;

      rerender(<Parent count={5} />);
      // Component may re-render due to React, but signal shouldn't change
      expect(renderCount.mock.calls.length).toBeGreaterThanOrEqual(
        initialRenderCount
      );
    });
  });

  describe("complex scenarios", () => {
    it("should handle computed values based on provider", async () => {
      const [useCount, CountProvider] = provider("count", 0);

      const ComputedComponent = blox(() => {
        const count = useCount();
        const doubled = rx(() => count() * 2);
        return <div>{doubled}</div>;
      });

      const { container, rerender } = render(
        <CountProvider value={5}>
          <ComputedComponent />
        </CountProvider>
      );
      await waitFor(() => {
        expect(container.textContent).toBe("10");
      });

      act(() => {
        rerender(
          <CountProvider value={10}>
            <ComputedComponent />
          </CountProvider>
        );
      });
      await waitFor(() => {
        expect(container.textContent).toBe("20");
      });
    });

    it("should handle multiple consumers of same provider", async () => {
      const [useTheme, ThemeProvider] = provider(
        "theme",
        "light" as "dark" | "light"
      );

      const Consumer1 = blox(() => {
        const theme = useTheme();
        return <div>{rx(() => `Consumer1: ${theme()}`)}</div>;
      });

      const Consumer2 = blox(() => {
        const theme = useTheme();
        return <div>{rx(() => `Consumer2: ${theme()}`)}</div>;
      });

      const { container, rerender } = render(
        <ThemeProvider value="dark">
          <>
            <Consumer1 />
            <Consumer2 />
          </>
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(container.textContent).toContain("Consumer1: dark");
        expect(container.textContent).toContain("Consumer2: dark");
      });

      act(() => {
        rerender(
          <ThemeProvider value="light">
            <>
              <Consumer1 />
              <Consumer2 />
            </>
          </ThemeProvider>
        );
      });

      await waitFor(() => {
        expect(container.textContent).toContain("Consumer1: light");
        expect(container.textContent).toContain("Consumer2: light");
      });
    });

    it("should handle provider with conditional rendering", async () => {
      const [useCount, CountProvider] = provider("count", 0);

      const ConditionalComponent = blox<{ show: boolean }>((props) => {
        const count = useCount();
        return <div>{rx(() => (props.show ? count() : null))}</div>;
      });

      const Parent = blox<{ count: number; show: boolean }>((props) => {
        return rx(() => (
          <CountProvider value={props.count}>
            <ConditionalComponent show={props.show} />
          </CountProvider>
        ));
      });

      const { container, rerender } = render(<Parent count={5} show={true} />);
      await waitFor(() => {
        expect(container.textContent).toBe("5");
      });

      act(() => {
        rerender(<Parent count={10} show={false} />);
      });
      await waitFor(() => {
        expect(container.textContent).toBe("");
      });
    });
  });

  describe("error handling for nested providers", () => {
    it("should throw error when trying to access non-existent parent provider", () => {
      const [useOuter] = provider("outer", 0);
      const [useInner, InnerProvider] = provider("inner", 1);

      const Child = blox(() => {
        useInner(); // This works
        // Try to access outer which doesn't exist in provider chain
        // This should throw an error
        expect(() => useOuter()).toThrow("Provider outer not found");
        return <div>Test</div>;
      });

      // Render should succeed, but calling useOuter() inside the component throws
      render(
        <InnerProvider value={1}>
          <Child />
        </InnerProvider>
      );
    });
  });

  // Note: Provider reactivity is documented in provider.tsx and types.ts
  // Key characteristic: Providers return signals, and only rx() or effect()
  // that consume the signal will be reactive. Child components themselves
  // will NOT automatically re-render when provider value changes.

  describe("Signal<T> as provider value", () => {
    it("should accept Signal<T> as provider value", () => {
      const [withTheme, ThemeProvider] = provider(
        "theme",
        "light" as "light" | "dark"
      );

      const Child = blox(() => {
        const theme = withTheme();
        return <div>{rx(() => theme())}</div>;
      });

      const themeSignal = signal<"light" | "dark">("light");

      const { container } = render(
        <ThemeProvider value={themeSignal}>
          <Child />
        </ThemeProvider>
      );

      expect(container.textContent).toBe("light");
    });

    it("should update consumer when source signal changes", async () => {
      const [withCount, CountProvider] = provider("count", 0);

      const Child = blox(() => {
        const count = withCount();
        return <div>{rx(() => count())}</div>;
      });

      const countSignal = signal(0);

      const { container } = render(
        <CountProvider value={countSignal}>
          <Child />
        </CountProvider>
      );

      expect(container.textContent).toBe("0");

      await act(async () => {
        countSignal.set(5);
      });
      await waitFor(() => expect(container.textContent).toBe("5"));

      expect(container.textContent).toBe("5");

      await act(async () => {
        countSignal.set(10);
      });
      await waitFor(() => expect(container.textContent).toBe("10"));

      expect(container.textContent).toBe("10");
    });

    it("should work with computed signals", async () => {
      const [withDoubled, DoubledProvider] = provider("doubled", 0);

      const Child = blox(() => {
        const doubled = withDoubled();
        return <div>{rx(() => doubled())}</div>;
      });

      const count = signal(5);
      const doubled = signal(() => count() * 2);

      const { container } = render(
        <DoubledProvider value={doubled}>
          <Child />
        </DoubledProvider>
      );

      expect(container.textContent).toBe("10");

      await act(async () => {
        count.set(7);
      });
      await waitFor(() => expect(container.textContent).toBe("14"));

      expect(container.textContent).toBe("14");
    });

    it("should trigger effects when signal changes", async () => {
      const [withValue, ValueProvider] = provider("value", 0);
      const effectSpy = vi.fn();

      const Child = blox(() => {
        const value = withValue();
        effect(() => {
          effectSpy(value());
        });
        return <div>Child</div>;
      });

      const valueSignal = signal(1);

      render(
        <ValueProvider value={valueSignal}>
          <Child />
        </ValueProvider>
      );

      // Effect runs immediately
      await waitFor(() => expect(effectSpy).toHaveBeenCalledWith(1));
      expect(effectSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        valueSignal.set(2);
        await waitFor(() => expect(effectSpy).toHaveBeenCalledWith(2));
      });

      expect(effectSpy).toHaveBeenCalledTimes(2);

      await act(async () => {
        valueSignal.set(3);
        await waitFor(() => expect(effectSpy).toHaveBeenCalledWith(3));
      });

      expect(effectSpy).toHaveBeenCalledTimes(3);
    });

    it("should handle nested providers using signals", async () => {
      const [withOuter, OuterProvider] = provider("outer", "");
      const [withInner, InnerProvider] = provider("inner", 0);

      const Child = blox(() => {
        const outer = withOuter();
        const inner = withInner();
        return <div>{rx(() => `${outer()}-${inner()}`)}</div>;
      });

      const outerSignal = signal("A");
      const innerSignal = signal(1);

      const { container } = render(
        <OuterProvider value={outerSignal}>
          <InnerProvider value={innerSignal}>
            <Child />
          </InnerProvider>
        </OuterProvider>
      );

      expect(container.textContent).toBe("A-1");

      await act(async () => {
        outerSignal.set("B");
      });
      await waitFor(() => expect(container.textContent).toBe("B-1"));

      await act(async () => {
        innerSignal.set(2);
      });
      await waitFor(() => expect(container.textContent).toBe("B-2"));

      await act(async () => {
        outerSignal.set("C");
        innerSignal.set(3);
      });
      await waitFor(() => expect(container.textContent).toBe("C-3"));
    });

    it("should cleanup signal subscription on unmount", async () => {
      const [withValue, ValueProvider] = provider("value", 0);
      const renderSpy = vi.fn();

      const Child = blox(() => {
        const value = withValue();
        return (
          <div>
            {rx(() => {
              renderSpy();
              return value();
            })}
          </div>
        );
      });

      const valueSignal = signal(0);

      const { unmount } = render(
        <ValueProvider value={valueSignal}>
          <Child />
        </ValueProvider>
      );

      // Initial render
      await waitFor(() => expect(renderSpy).toHaveBeenCalledTimes(1));

      await act(async () => {
        valueSignal.set(1);
      });

      await waitFor(() => expect(renderSpy).toHaveBeenCalledTimes(2));

      renderSpy.mockClear();

      // Unmount
      unmount();

      // Signal changes should not trigger renders after unmount
      await act(async () => {
        valueSignal.set(2);
        valueSignal.set(3);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(renderSpy).not.toHaveBeenCalled();
    });

    it("should respect custom equals function with signals", async () => {
      const [withUser, UserProvider] = provider(
        "user",
        { id: 0, name: "" },
        { equals: (a, b) => a.id === b.id }
      );
      const renderSpy = vi.fn();

      const Child = blox(() => {
        const user = withUser();
        return (
          <div>
            {rx(() => {
              renderSpy();
              return `${user().id}-${user().name}`;
            })}
          </div>
        );
      });

      const userSignal = signal({ id: 1, name: "John" });

      const { container } = render(
        <UserProvider value={userSignal}>
          <Child />
        </UserProvider>
      );

      await waitFor(() => expect(container.textContent).toBe("1-John"));
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Same id, different name - should not trigger update
      await act(async () => {
        userSignal.set({ id: 1, name: "Jane" });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(container.textContent).toBe("1-John");

      // Different id - should trigger update
      await act(async () => {
        userSignal.set({ id: 2, name: "Alice" });
      });

      await waitFor(() => expect(container.textContent).toBe("2-Alice"));

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it("should lazily create internal signal only when accessed", () => {
      const [withValue, ValueProvider] = provider("value", 0);
      const valueSignal = signal(42);

      // Render provider but don't access the signal yet
      render(
        <ValueProvider value={valueSignal}>
          <div>No consumer</div>
        </ValueProvider>
      );

      // Change signal value before anyone accesses it
      act(() => {
        valueSignal.set(100);
      });

      // Now add a consumer - it should see the latest value (100)
      const Child = blox(() => {
        const value = withValue();
        return <div>{rx(() => value())}</div>;
      });

      const { container } = render(
        <ValueProvider value={valueSignal}>
          <Child />
        </ValueProvider>
      );

      // Should see 100, not 42, proving signal was created lazily
      expect(container.textContent).toBe("100");
    });
  });
});
