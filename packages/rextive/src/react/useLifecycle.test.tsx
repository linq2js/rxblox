import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { useLifecycle } from "./useLifecycle";
import "@testing-library/jest-dom/vitest";

describe("useLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("init callback", () => {
    it("should call init during component initialization", () => {
      const init = vi.fn();

      const TestComponent = () => {
        useLifecycle({ init });
        return <div>test</div>;
      };

      render(<TestComponent />);
      expect(init).toHaveBeenCalledTimes(1);
    });

    it("should call init before first render", () => {
      const callOrder: string[] = [];

      const TestComponent = () => {
        useLifecycle({
          init: () => callOrder.push("init"),
          render: () => callOrder.push("render"),
        });
        return <div>test</div>;
      };

      render(<TestComponent />);
      expect(callOrder).toEqual(["init", "render"]);
    });

    it("should call init only once even on re-renders", () => {
      const init = vi.fn();

      const TestComponent = ({ count }: { count: number }) => {
        useLifecycle({ init });
        return <div>{count}</div>;
      };

      const { rerender } = render(<TestComponent count={1} />);
      expect(init).toHaveBeenCalledTimes(1);

      rerender(<TestComponent count={2} />);
      expect(init).toHaveBeenCalledTimes(1);
    });
  });

  describe("mount callback", () => {
    it("should call mount after first render", async () => {
      const mount = vi.fn();

      const TestComponent = () => {
        useLifecycle({ mount });
        return <div>test</div>;
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(mount).toHaveBeenCalledTimes(1);
      });
    });

    it("should call mount after init and render", async () => {
      const callOrder: string[] = [];

      const TestComponent = () => {
        useLifecycle({
          init: () => callOrder.push("init"),
          render: () => callOrder.push("render"),
          mount: () => callOrder.push("mount"),
        });
        return <div>test</div>;
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(callOrder).toEqual(["init", "render", "mount"]);
      });
    });

    it("should not call mount on re-renders", async () => {
      const mount = vi.fn();

      const TestComponent = ({ count }: { count: number }) => {
        useLifecycle({ mount });
        return <div>{count}</div>;
      };

      const { rerender } = render(<TestComponent count={1} />);
      await waitFor(() => {
        expect(mount).toHaveBeenCalledTimes(1);
      });

      rerender(<TestComponent count={2} />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mount).toHaveBeenCalledTimes(1);
    });
  });

  describe("render callback", () => {
    it("should call render on every render", () => {
      const renderCallback = vi.fn();

      const TestComponent = ({ count }: { count: number }) => {
        useLifecycle({ render: renderCallback });
        return <div>{count}</div>;
      };

      const { rerender } = render(<TestComponent count={1} />);
      expect(renderCallback).toHaveBeenCalledTimes(1);

      rerender(<TestComponent count={2} />);
      expect(renderCallback).toHaveBeenCalledTimes(2);

      rerender(<TestComponent count={3} />);
      expect(renderCallback).toHaveBeenCalledTimes(3);
    });

    it("should call render before mount", async () => {
      const callOrder: string[] = [];

      const TestComponent = () => {
        useLifecycle({
          render: () => callOrder.push("render"),
          mount: () => callOrder.push("mount"),
        });
        return <div>test</div>;
      };

      render(<TestComponent />);
      await waitFor(() => {
        expect(callOrder).toEqual(["render", "mount"]);
      });
    });
  });

  describe("cleanup callback", () => {
    it("should call cleanup on unmount", async () => {
      const cleanup = vi.fn();

      const TestComponent = () => {
        useLifecycle({ cleanup });
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      expect(cleanup).not.toHaveBeenCalled();

      unmount();
      await waitFor(() => {
        expect(cleanup).toHaveBeenCalledTimes(1);
      });
    });

    it("should call cleanup before dispose", async () => {
      const callOrder: string[] = [];

      const TestComponent = () => {
        useLifecycle({
          cleanup: () => callOrder.push("cleanup"),
          dispose: () => callOrder.push("dispose"),
        });
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      unmount();

      await waitFor(() => {
        expect(callOrder).toEqual(["cleanup", "dispose"]);
      });
    });
  });

  describe("dispose callback", () => {
    it("should call dispose on unmount", async () => {
      const dispose = vi.fn();

      const TestComponent = () => {
        useLifecycle({ dispose });
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      expect(dispose).not.toHaveBeenCalled();

      unmount();

      // dispose is deferred to microtask
      await waitFor(() => {
        expect(dispose).toHaveBeenCalledTimes(1);
      });
    });

    it("should defer dispose to microtask", async () => {
      const dispose = vi.fn();

      const TestComponent = () => {
        useLifecycle({ dispose });
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      unmount();

      // Should not be called synchronously
      expect(dispose).not.toHaveBeenCalled();

      // Should be called after microtask
      await Promise.resolve();
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("should handle errors in dispose without crashing", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const dispose = vi.fn(() => {
        throw new Error("Test error");
      });

      const TestComponent = () => {
        useLifecycle({ dispose });
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      unmount();

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Error in dispose callback:",
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe("lifecycle order", () => {
    it("should execute all callbacks in correct order", async () => {
      const callOrder: string[] = [];

      const TestComponent = () => {
        useLifecycle({
          init: () => callOrder.push("init"),
          render: () => callOrder.push("render"),
          mount: () => callOrder.push("mount"),
          cleanup: () => callOrder.push("cleanup"),
          dispose: () => callOrder.push("dispose"),
        });
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);

      await waitFor(() => {
        expect(callOrder).toEqual(["init", "render", "mount"]);
      });

      unmount();

      await waitFor(() => {
        expect(callOrder).toEqual([
          "init",
          "render",
          "mount",
          "cleanup",
          "dispose",
        ]);
      });
    });
  });

  describe("callback updates", () => {
    it("should use latest callbacks on each call", async () => {
      let renderCount = 0;
      let mountCount = 0;

      const TestComponent = ({ id }: { id: number }) => {
        useLifecycle({
          render: () => {
            renderCount = id;
          },
          mount: () => {
            mountCount = id;
          },
        });
        return <div>{id}</div>;
      };

      const { rerender } = render(<TestComponent id={1} />);
      expect(renderCount).toBe(1);
      await waitFor(() => {
        expect(mountCount).toBe(1);
      });

      rerender(<TestComponent id={2} />);
      expect(renderCount).toBe(2);
      // mount doesn't run again
      expect(mountCount).toBe(1);
    });

    it("should use latest dispose callback", async () => {
      let disposeValue = 0;

      const TestComponent = ({ id }: { id: number }) => {
        useLifecycle({
          dispose: () => {
            disposeValue = id;
          },
        });
        return <div>{id}</div>;
      };

      const { rerender, unmount } = render(<TestComponent id={1} />);
      rerender(<TestComponent id={2} />);
      rerender(<TestComponent id={3} />);

      unmount();

      await waitFor(() => {
        expect(disposeValue).toBe(3); // Latest value
      });
    });
  });

  describe("no callbacks", () => {
    it("should work with no callbacks provided", () => {
      const TestComponent = () => {
        useLifecycle({});
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      expect(() => unmount()).not.toThrow();
    });

    it("should work with empty options", () => {
      const TestComponent = () => {
        useLifecycle({});
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("partial callbacks", () => {
    it("should work with only init", () => {
      const init = vi.fn();

      const TestComponent = () => {
        useLifecycle({ init });
        return <div>test</div>;
      };

      render(<TestComponent />);
      expect(init).toHaveBeenCalledTimes(1);
    });

    it("should work with only dispose", async () => {
      const dispose = vi.fn();

      const TestComponent = () => {
        useLifecycle({ dispose });
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      unmount();

      await waitFor(() => {
        expect(dispose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("multiple components", () => {
    it("should handle multiple components independently", async () => {
      const init1 = vi.fn();
      const init2 = vi.fn();
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      const Component1 = () => {
        useLifecycle({ init: init1, dispose: dispose1 });
        return <div>1</div>;
      };

      const Component2 = () => {
        useLifecycle({ init: init2, dispose: dispose2 });
        return <div>2</div>;
      };

      const { unmount: unmount1 } = render(<Component1 />);
      const { unmount: unmount2 } = render(<Component2 />);

      expect(init1).toHaveBeenCalledTimes(1);
      expect(init2).toHaveBeenCalledTimes(1);

      unmount1();
      await waitFor(() => {
        expect(dispose1).toHaveBeenCalledTimes(1);
        expect(dispose2).not.toHaveBeenCalled();
      });

      unmount2();
      await waitFor(() => {
        expect(dispose2).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("error handling", () => {
    it("should handle errors in dispose callback gracefully", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const dispose = vi.fn(() => {
        throw new Error("Dispose error");
      });

      const TestComponent = () => {
        useLifecycle({ dispose });
        return <div>test</div>;
      };

      const { unmount } = render(<TestComponent />);
      unmount();

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Error in dispose callback:",
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });
});
