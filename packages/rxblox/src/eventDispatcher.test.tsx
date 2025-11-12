import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { blox } from "./blox";
import { on } from "./eventDispatcher";

describe("eventDispatcher", () => {
  describe("on.mount", () => {
    it("should call mount callback when component mounts", async () => {
      const mountCallback = vi.fn();

      const Component = blox(() => {
        on.mount(mountCallback);
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
        on.mount(callback1, callback2);
        return <div>Test</div>;
      });

      render(<Component />);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should throw error when called outside blox component", () => {
      expect(() => {
        on.mount(() => {});
      }).toThrow("Event dispatcher not found");
    });
  });

  describe("on.render", () => {
    it("should call render callback on each render", () => {
      const renderCallback = vi.fn();

      const Component = blox<{ count: number }>((props) => {
        on.render(renderCallback);
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
        on.render(callback1, callback2);
        return <div>Test</div>;
      });

      render(<Component />);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should throw error when called outside blox component", () => {
      expect(() => {
        on.render(() => {});
      }).toThrow("Event dispatcher not found");
    });
  });

  describe("on.unmount", () => {
    it("should call unmount callback when component unmounts", async () => {
      const unmountCallback = vi.fn();

      const Component = blox(() => {
        on.unmount(unmountCallback);
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
        on.unmount(() => {});
      }).toThrow("Event dispatcher not found");
    });
  });
});

