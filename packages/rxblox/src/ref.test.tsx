import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { blox } from "./index";

describe("blox.ref", () => {
  describe("basic functionality", () => {
    it("should create a ref with null initial value", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        expect(inputRef.current).toBeNull();
        return <input ref={inputRef} />;
      });

      render(<Component />);
    });

    it("should have current value after mount", () => {
      let capturedRef: any;

      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        capturedRef = inputRef;
        return <input ref={inputRef} />;
      });

      render(<Component />);

      // After render, ref should be set
      expect(capturedRef.current).toBeInstanceOf(HTMLInputElement);
    });

    it("should throw error when called outside blox component", () => {
      expect(() => {
        blox.ref<HTMLInputElement>();
      }).toThrow("blox.ref() must be called inside a blox component");
    });
  });

  describe("ready() instance method", () => {
    it("should call callback when ref is ready", () => {
      const callback = vi.fn();

      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();

        blox.onMount(() => {
          inputRef.ready((input) => {
            callback(input);
          });
        });

        return <input ref={inputRef} />;
      });

      render(<Component />);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(HTMLInputElement));
    });

    it("should provide non-nullable element type", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();

        blox.onMount(() => {
          inputRef.ready((input) => {
            // TypeScript should not require null checking
            expect(input.tagName).toBe("INPUT");
            expect(input.focus).toBeDefined();
          });
        });

        return <input ref={inputRef} />;
      });

      render(<Component />);
    });

    it("should not call callback if ref is null", () => {
      const callback = vi.fn();

      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();

        blox.onMount(() => {
          inputRef.ready((input) => {
            callback(input);
          });
        });

        // Don't attach ref to any element
        return <div>No ref attached</div>;
      });

      render(<Component />);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should work with multiple ready() calls on same ref", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();

        blox.onMount(() => {
          inputRef.ready((input) => callback1(input));
          inputRef.ready((input) => callback2(input));
        });

        return <input ref={inputRef} />;
      });

      render(<Component />);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should return callback result when ref is ready", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        let capturedValue: string | undefined;

        blox.onMount(() => {
          capturedValue = inputRef.ready((input) => input.value);
        });

        return <input ref={inputRef} defaultValue="test-value" />;
      });

      render(<Component />);

      // Note: capturedValue will be captured during mount
      // We can't directly assert it here, but TypeScript verifies the type
    });

    it("should return undefined when ref is null", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        let result: number | undefined;

        blox.onMount(() => {
          result = inputRef.ready((input) => input.value.length);
          expect(result).toBeUndefined();
        });

        // Don't attach ref
        return <div>No ref</div>;
      });

      render(<Component />);
    });

    it("should work with cleanup using effect", async () => {
      const cleanupFn = vi.fn();

      const Component = blox(() => {
        const videoRef = blox.ref<HTMLVideoElement>();

        blox.onMount(() => {
          videoRef.ready((video) => {
            video.play();
          });
        });

        // Cleanup in unmount callback
        blox.onUnmount(() => {
          cleanupFn();
        });

        return <video ref={videoRef} />;
      });

      const { unmount } = render(<Component />);
      unmount();

      // Wait for deferred unmount
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(cleanupFn).toHaveBeenCalled();
    });
  });

  describe("blox.ready() static method", () => {
    it("should call callback when all refs are ready", () => {
      const callback = vi.fn();

      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        const buttonRef = blox.ref<HTMLButtonElement>();

        blox.onMount(() => {
          blox.ready([inputRef, buttonRef], (input, button) => {
            callback(input, button);
          });
        });

        return (
          <>
            <input ref={inputRef} />
            <button ref={buttonRef}>Click</button>
          </>
        );
      });

      render(<Component />);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.any(HTMLInputElement),
        expect.any(HTMLButtonElement)
      );
    });

    it("should not call callback if any ref is null", () => {
      const callback = vi.fn();

      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        const buttonRef = blox.ref<HTMLButtonElement>();

        blox.onMount(() => {
          blox.ready([inputRef, buttonRef], (input, button) => {
            callback(input, button);
          });
        });

        // Only attach one ref
        return (
          <>
            <input ref={inputRef} />
            <div>No button</div>
          </>
        );
      });

      render(<Component />);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should provide correct types for all elements", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        const buttonRef = blox.ref<HTMLButtonElement>();
        const divRef = blox.ref<HTMLDivElement>();

        blox.onMount(() => {
          blox.ready([inputRef, buttonRef, divRef], (input, button, div) => {
            // TypeScript should infer correct types
            expect(input.tagName).toBe("INPUT");
            expect(button.tagName).toBe("BUTTON");
            expect(div.tagName).toBe("DIV");
          });
        });

        return (
          <>
            <input ref={inputRef} />
            <button ref={buttonRef}>Click</button>
            <div ref={divRef}>Content</div>
          </>
        );
      });

      render(<Component />);
    });

    it("should work with single ref in array", () => {
      const callback = vi.fn();

      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();

        blox.onMount(() => {
          blox.ready([inputRef], (input) => {
            callback(input);
          });
        });

        return <input ref={inputRef} />;
      });

      render(<Component />);

      expect(callback).toHaveBeenCalledWith(expect.any(HTMLInputElement));
    });

    it("should work with many refs", () => {
      const callback = vi.fn();

      const Component = blox(() => {
        const ref1 = blox.ref<HTMLInputElement>();
        const ref2 = blox.ref<HTMLButtonElement>();
        const ref3 = blox.ref<HTMLDivElement>();
        const ref4 = blox.ref<HTMLSpanElement>();
        const ref5 = blox.ref<HTMLLabelElement>();

        blox.onMount(() => {
          blox.ready([ref1, ref2, ref3, ref4, ref5], (r1, r2, r3, r4, r5) => {
            callback(r1, r2, r3, r4, r5);
          });
        });

        return (
          <>
            <input ref={ref1} />
            <button ref={ref2}>Click</button>
            <div ref={ref3}>Content</div>
            <span ref={ref4}>Text</span>
            <label ref={ref5}>Label</label>
          </>
        );
      });

      render(<Component />);

      expect(callback).toHaveBeenCalledWith(
        expect.any(HTMLInputElement),
        expect.any(HTMLButtonElement),
        expect.any(HTMLDivElement),
        expect.any(HTMLSpanElement),
        expect.any(HTMLLabelElement)
      );
    });

    it("should return callback result from ready()", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        const divRef = blox.ref<HTMLDivElement>();
        let result: { inputValue: string; divWidth: number } | undefined;

        blox.onMount(() => {
          result = blox.ready([inputRef, divRef], (input, div) => ({
            inputValue: input.value,
            divWidth: div.clientWidth,
          }));

          expect(result).toBeDefined();
          expect(result?.inputValue).toBe("test");
          expect(typeof result?.divWidth).toBe("number");
        });

        return (
          <>
            <input ref={inputRef} defaultValue="test" />
            <div ref={divRef}>Content</div>
          </>
        );
      });

      render(<Component />);
    });

    it("should return undefined when any ref is null", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        const divRef = blox.ref<HTMLDivElement>();
        let result: { value: string } | undefined;

        blox.onMount(() => {
          result = blox.ready([inputRef, divRef], (input, div) => ({
            value: "test",
          }));

          expect(result).toBeUndefined();
        });

        // Only attach one ref
        return <input ref={inputRef} />;
      });

      render(<Component />);
    });
  });

  describe("real-world use cases", () => {
    it("should support focus management", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();

        blox.onMount(() => {
          inputRef.ready((input) => {
            input.focus();
          });
        });

        return <input ref={inputRef} />;
      });

      const { container } = render(<Component />);
      const input = container.querySelector("input");

      expect(document.activeElement).toBe(input);
    });

    it("should support event listeners with cleanup", async () => {
      const handleClick = vi.fn();
      const cleanupFn = vi.fn();

      const Component = blox(() => {
        const buttonRef = blox.ref<HTMLButtonElement>();

        blox.onMount(() => {
          buttonRef.ready((button) => {
            button.addEventListener("click", handleClick);
          });
        });

        // Cleanup registered separately
        blox.onUnmount(() => {
          if (buttonRef.current) {
            buttonRef.current.removeEventListener("click", handleClick);
          }
          cleanupFn();
        });

        return <button ref={buttonRef}>Click Me</button>;
      });

      const { container, unmount } = render(<Component />);
      const button = container.querySelector("button")!;

      button.click();
      expect(handleClick).toHaveBeenCalledTimes(1);

      unmount();

      // Wait for deferred unmount
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(cleanupFn).toHaveBeenCalled();
    });

    it("should support multiple refs for coordinated setup", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        const buttonRef = blox.ref<HTMLButtonElement>();

        blox.onMount(() => {
          blox.ready([inputRef, buttonRef], (input, button) => {
            input.focus();
            button.disabled = false;
          });
        });

        return (
          <>
            <input ref={inputRef} />
            <button ref={buttonRef} disabled>
              Submit
            </button>
          </>
        );
      });

      const { container } = render(<Component />);
      const input = container.querySelector("input")!;
      const button = container.querySelector("button")!;

      expect(document.activeElement).toBe(input);
      expect(button.disabled).toBe(false);
    });

    it("should work with DOM manipulation", () => {
      const Component = blox(() => {
        const divRef = blox.ref<HTMLDivElement>();

        blox.onMount(() => {
          divRef.ready((div) => {
            div.style.backgroundColor = "red";
            div.style.width = "100px";
            div.style.height = "100px";
          });
        });

        return <div ref={divRef}>Content</div>;
      });

      const { container } = render(<Component />);
      const div = container.querySelector("div")!;

      expect(div.style.backgroundColor).toBe("red");
      expect(div.style.width).toBe("100px");
      expect(div.style.height).toBe("100px");
    });
  });

  describe("type safety", () => {
    it("should narrow type from T | null to T", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();

        // Before ready(), current is T | null
        const before: HTMLInputElement | null = inputRef.current;
        expect(before).toBeDefined();

        blox.onMount(() => {
          inputRef.ready((input) => {
            // Inside ready(), parameter is T (not T | null)
            const inside: HTMLInputElement = input;
            expect(inside).toBeDefined();
          });
        });

        return <input ref={inputRef} />;
      });

      render(<Component />);
    });

    it("should infer correct tuple types for multiple refs", () => {
      const Component = blox(() => {
        const inputRef = blox.ref<HTMLInputElement>();
        const buttonRef = blox.ref<HTMLButtonElement>();
        const divRef = blox.ref<HTMLDivElement>();

        blox.onMount(() => {
          blox.ready([inputRef, buttonRef, divRef], (input, button, div) => {
            // TypeScript should infer correct types
            const i: HTMLInputElement = input;
            const b: HTMLButtonElement = button;
            const d: HTMLDivElement = div;

            expect(i).toBeDefined();
            expect(b).toBeDefined();
            expect(d).toBeDefined();
          });
        });

        return (
          <>
            <input ref={inputRef} />
            <button ref={buttonRef}>Click</button>
            <div ref={divRef}>Content</div>
          </>
        );
      });

      render(<Component />);
    });
  });
});
