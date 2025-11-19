import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { blox } from "./index";

describe("eventDispatcher", () => {
  describe("blox.on - mount", () => {
    it("should call mount callback when component mounts", async () => {
      const mountCallback = vi.fn();

      const Component = blox(() => {
        blox.on({ mount: mountCallback });
        return <div>Test</div>;
      });

      render(<Component />);
      // Mount callbacks are called after layout effects
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mountCallback).toHaveBeenCalledTimes(1);
    });

    it("should call multiple mount callbacks", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const Component = blox(() => {
        blox.on({ mount: [callback1, callback2] });
        return <div>Test</div>;
      });

      render(<Component />);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should throw error when called outside blox component", () => {
      expect(() => {
        blox.on({ mount: () => {} });
      }).toThrow("must be called inside a blox component");
    });

    it("should work inside blox.slot()", async () => {
      const mountCallback = vi.fn();

      const Component = blox(() => {
        const [slot] = blox.slot(() => {
          blox.on({ mount: mountCallback });
          return "slot logic";
        });
        return <div>{slot}</div>;
      });

      render(<Component />);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mountCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("blox.on - render", () => {
    it("should call render callback on each render", () => {
      const renderCallback = vi.fn();

      const Component = blox<{ count: number }>((props) => {
        blox.on({ render: renderCallback });
        return <div>{props.count}</div>;
      });

      const { rerender } = render(<Component count={0} />);
      expect(renderCallback).toHaveBeenCalledTimes(1);

      rerender(<Component count={1} />);
      expect(renderCallback).toHaveBeenCalledTimes(2);
    });

    it("should call multiple render callbacks", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const Component = blox(() => {
        blox.on({ render: [callback1, callback2] });
        return <div>Test</div>;
      });

      render(<Component />);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should throw error when called outside blox component", () => {
      expect(() => {
        blox.on({ render: () => {} });
      }).toThrow("must be called inside a blox component");
    });

    it("should work inside blox.slot()", () => {
      const renderCallback = vi.fn();

      const Component = blox<{ count: number }>((props) => {
        // blox.slot() is called once during builder, but onRender is registered
        // to the parent component's render cycle
        const [slot] = blox.slot(() => {
          blox.on({ render: renderCallback });
          return "slot logic";
        });
        return <div>{props.count} {slot}</div>;
      });

      const { rerender } = render(<Component count={0} />);
      // Initial render calls onRender once
      expect(renderCallback).toHaveBeenCalledTimes(1);

      // Re-render the component to trigger onRender again
      rerender(<Component count={1} />);
      expect(renderCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe("blox.on - unmount", () => {
    it("should call unmount callback when component unmounts", async () => {
      const unmountCallback = vi.fn();

      const Component = blox(() => {
        blox.on({ unmount: unmountCallback });
        return <div>Test</div>;
      });

      const { unmount } = render(<Component />);
      expect(unmountCallback).not.toHaveBeenCalled();

      unmount();
      // Wait for useUnmount to execute (deferred in StrictMode)
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unmountCallback).toHaveBeenCalledTimes(1);
    });

    it("should throw error when called outside blox component", () => {
      expect(() => {
        blox.on({ unmount: () => {} });
      }).toThrow("must be called inside a blox component");
    });

    it("should work inside blox.slot()", async () => {
      const unmountCallback = vi.fn();

      const Component = blox(() => {
        const [slot] = blox.slot(() => {
          blox.on({ unmount: unmountCallback });
          return "slot logic";
        });
        return <div>{slot}</div>;
      });

      const { unmount } = render(<Component />);
      expect(unmountCallback).not.toHaveBeenCalled();

      unmount();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unmountCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("blox.on - multiple events", () => {
    it("should handle multiple event types at once", async () => {
      const mountCallback = vi.fn();
      const renderCallback = vi.fn();
      const unmountCallback = vi.fn();

      const Component = blox(() => {
        blox.on({
          mount: mountCallback,
          render: renderCallback,
          unmount: unmountCallback,
        });
        return <div>Test</div>;
      });

      const { unmount } = render(<Component />);
      
      // Render callback called immediately
      expect(renderCallback).toHaveBeenCalledTimes(1);
      
      // Mount callback called after layout effects
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mountCallback).toHaveBeenCalledTimes(1);

      // Unmount callback not yet called
      expect(unmountCallback).not.toHaveBeenCalled();

      unmount();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unmountCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("context validation", () => {
    it("should throw error when called in effect context", async () => {
      const { effect } = await import("./effect");
      expect(() => {
        effect(() => {
          blox.on({ mount: () => {} });
        });
      }).toThrow("must be called inside a blox component");
    });

    it("should throw error when called in signal context", async () => {
      const { signal } = await import("./signal");
      expect(() => {
        const computed = signal(() => {
          blox.on({ render: () => {} });
          return 0;
        });
        // Access the computed signal to trigger the computation
        computed();
      }).toThrow("must be called inside a blox component");
    });

    it("should throw error when called in batch context", async () => {
      const { signal } = await import("./signal");
      const { batch } = await import("./batch");
      const count = signal(0);
      
      expect(() => {
        batch(() => {
          blox.on({ unmount: () => {} });
          count.set(1);
        });
      }).toThrow("must be called inside a blox component");
    });
  });
});
