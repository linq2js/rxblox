import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { blox } from "./index";

describe("eventDispatcher", () => {
  describe("blox.onMount", () => {
    it("should call mount callback when component mounts", async () => {
      const mountCallback = vi.fn();

      const Component = blox(() => {
        blox.onMount(mountCallback);
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
        blox.onMount(callback1, callback2);
        return <div>Test</div>;
      });

      render(<Component />);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should throw error when called outside blox component", () => {
      expect(() => {
        blox.onMount(() => {});
      }).toThrow("Event dispatcher not found");
    });
  });

  describe("blox.onRender", () => {
    it("should call render callback on each render", () => {
      const renderCallback = vi.fn();

      const Component = blox<{ count: number }>((props) => {
        blox.onRender(renderCallback);
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
        blox.onRender(callback1, callback2);
        return <div>Test</div>;
      });

      render(<Component />);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should throw error when called outside blox component", () => {
      expect(() => {
        blox.onRender(() => {});
      }).toThrow("Event dispatcher not found");
    });
  });

  describe("blox.onUnmount", () => {
    it("should call unmount callback when component unmounts", async () => {
      const unmountCallback = vi.fn();

      const Component = blox(() => {
        blox.onUnmount(unmountCallback);
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
        blox.onUnmount(() => {});
      }).toThrow("Event dispatcher not found");
    });
  });
});
