import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react";
import { useUnmount } from "./useUnmount";

describe("useUnmount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic functionality", () => {
    it("should call callback when component unmounts", async () => {
      const callback = vi.fn();

      const TestComponent = () => {
        useUnmount(callback);
        return <div>Test</div>;
      };

      const { unmount } = render(<TestComponent />);
      expect(callback).not.toHaveBeenCalled();

      unmount();

      // Wait for the deferred callback (Promise.resolve().then())
      await act(async () => {
        await Promise.resolve();
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should not call callback on re-render", () => {
      const callback = vi.fn();

      const TestComponent = ({ count }: { count: number }) => {
        useUnmount(callback);
        return <div>{count}</div>;
      };

      const { rerender } = render(<TestComponent count={0} />);
      expect(callback).not.toHaveBeenCalled();

      rerender(<TestComponent count={1} />);
      rerender(<TestComponent count={2} />);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should use latest callback when callback changes", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      const TestComponent = ({
        callback,
      }: {
        callback: VoidFunction;
      }) => {
        useUnmount(callback);
        return <div>Test</div>;
      };

      const { rerender, unmount } = render(
        <TestComponent callback={callback1} />
      );

      rerender(<TestComponent callback={callback2} />);
      rerender(<TestComponent callback={callback3} />);

      unmount();

      await act(async () => {
        await Promise.resolve();
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalledTimes(1);
    });
  });

  describe("React StrictMode behavior", () => {
    it("should handle component re-mounting in StrictMode", async () => {
      const callback = vi.fn();

      const TestComponent = () => {
        useUnmount(callback);
        return <div>Test</div>;
      };

      const { unmount } = render(<TestComponent />);

      // Simulate StrictMode: unmount and immediately re-mount
      // Note: We can't actually re-mount after unmount in testing,
      // but we can test that the deferred callback respects the unmount flag
      unmount();

      // Wait a bit, then check callback wasn't called yet
      await act(async () => {
        await Promise.resolve();
      });

      // Callback should be called after unmount
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple mount/unmount cycles", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const TestComponent = ({
        callback,
      }: {
        callback: VoidFunction;
      }) => {
        useUnmount(callback);
        return <div>Test</div>;
      };

      // First mount/unmount cycle
      const { unmount: unmount1 } = render(
        <TestComponent callback={callback1} />
      );
      unmount1();
      await act(async () => {
        await Promise.resolve();
      });
      expect(callback1).toHaveBeenCalledTimes(1);

      // Second mount/unmount cycle
      const { unmount: unmount2 } = render(
        <TestComponent callback={callback2} />
      );
      unmount2();
      await act(async () => {
        await Promise.resolve();
      });
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("deferred execution", () => {
    it("should defer callback execution to next microtask", async () => {
      const callback = vi.fn();
      const beforeUnmount = vi.fn();
      const afterUnmount = vi.fn();

      const TestComponent = () => {
        useUnmount(callback);
        return <div>Test</div>;
      };

      const { unmount } = render(<TestComponent />);

      beforeUnmount();
      unmount();
      afterUnmount();

      // Callback should not be called synchronously
      expect(callback).not.toHaveBeenCalled();
      expect(beforeUnmount).toHaveBeenCalled();
      expect(afterUnmount).toHaveBeenCalled();

      // Wait for microtask
      await act(async () => {
        await Promise.resolve();
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback that throws an error", async () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Unmount error");
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const TestComponent = () => {
        useUnmount(errorCallback);
        return <div>Test</div>;
      };

      const { unmount } = render(<TestComponent />);

      unmount();

      // The error will be thrown in a Promise, so we need to handle it
      await act(async () => {
        try {
          await Promise.resolve();
        } catch (error) {
          // Error is expected and handled
        }
      });

      expect(errorCallback).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should handle callback that is undefined", async () => {
      const TestComponent = () => {
        useUnmount(undefined as any);
        return <div>Test</div>;
      };

      const { unmount } = render(<TestComponent />);

      // Should not throw
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it("should handle callback that returns a value", async () => {
      const callback = vi.fn(() => {
        return "return value";
      });

      const TestComponent = () => {
        useUnmount(callback);
        return <div>Test</div>;
      };

      const { unmount } = render(<TestComponent />);

      unmount();

      await act(async () => {
        await Promise.resolve();
      });

      // Callback should be called, return value is ignored
      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveReturnedWith("return value");
    });

    it("should handle rapid mount/unmount cycles", async () => {
      const callbacks = Array.from({ length: 5 }, () => vi.fn());

      const TestComponent = ({
        callback,
      }: {
        callback: VoidFunction;
      }) => {
        useUnmount(callback);
        return <div>Test</div>;
      };

      // Create and unmount multiple components rapidly
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(
          <TestComponent callback={callbacks[i]} />
        );
        unmount();
      }

      await act(async () => {
        await Promise.resolve();
      });

      // All callbacks should have been called
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });
  });
});

