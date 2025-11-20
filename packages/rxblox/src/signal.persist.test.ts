import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { signal } from "./signal";
import { effect } from "./effect";
import { rx } from "./rx";
import type { Persistor } from "./types";

describe("signal persistence", () => {
  describe("basic persistence", () => {
    it("should initialize with idle status when no persist option", () => {
      const count = signal(0);

      expect(count.persistInfo.status).toBe("idle");
      expect(count.persistInfo.error).toBeUndefined();
    });

    it("should hydrate value from persistor on initialization", async () => {
      const persistor: Persistor<number> = {
        get: () => ({ value: 42 }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      // Sync persistor: value applied immediately (no flicker!)
      expect(count()).toBe(42);
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should handle async persistor.get()", async () => {
      const persistor: Persistor<number> = {
        get: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { value: 100 };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      // Wait a bit - status should be reading
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count.persistInfo.status).toBe("reading");

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(count()).toBe(100);
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should keep initial value when persistor returns null", async () => {
      const persistor: Persistor<number> = {
        get: () => null,
        set: vi.fn(),
      };

      const count = signal(42, { persist: persistor });

      // Sync persistor with null: keep initial value
      expect(count()).toBe(42);
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should apply sync persistor value immediately (no flicker)", () => {
      const persistor: Persistor<number> = {
        get: () => ({ value: 100 }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      // Value is hydrated synchronously before any renders (no flicker!)
      expect(count()).toBe(100);
      expect(count.persistInfo.status).toBe("synced");

      // This happens immediately, not in a microtask
      // So UI can render with the correct value from the start
    });
  });

  describe("read errors", () => {
    it("should handle sync read errors", async () => {
      const persistor: Persistor<number> = {
        get: () => {
          throw new Error("Read failed");
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count()).toBe(0); // Keep initial value
      expect(count.persistInfo.status).toBe("read-failed");
      expect(count.persistInfo.error).toBeInstanceOf(Error);
      expect((count.persistInfo.error as Error).message).toBe("Read failed");
    });

    it("should handle async read errors", async () => {
      const persistor: Persistor<number> = {
        get: async () => {
          throw new Error("Async read failed");
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count()).toBe(0);
      expect(count.persistInfo.status).toBe("read-failed");
      expect((count.persistInfo.error as Error).message).toBe(
        "Async read failed"
      );
    });
  });

  describe("write operations", () => {
    it("should persist value on set()", async () => {
      const setSpy = vi.fn();
      const persistor: Persistor<number> = {
        get: () => null,
        set: setSpy,
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));

      count.set(42);

      // Wait for async persist
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(setSpy).toHaveBeenCalledWith(42);
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should handle async set", async () => {
      const setSpy = vi.fn(
        (_value: unknown) =>
          new Promise<void>((resolve) => setTimeout(resolve, 50))
      );
      const persistor: Persistor<number> = {
        get: () => null,
        set: setSpy,
      };

      const count = signal(0, { persist: persistor });
      await new Promise((resolve) => setTimeout(resolve, 10));

      count.set(42);

      // Status should be writing
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count.persistInfo.status).toBe("writing");

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(count.persistInfo.status).toBe("synced");
      expect(setSpy).toHaveBeenCalledWith(42);
    });

    it("should handle write errors", async () => {
      const persistor: Persistor<number> = {
        get: () => null,
        set: () => {
          throw new Error("Write failed");
        },
      };

      const count = signal(0, { persist: persistor });
      await new Promise((resolve) => setTimeout(resolve, 10));

      count.set(42);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count()).toBe(42); // Value updated in memory
      expect(count.persistInfo.status).toBe("write-failed");
      expect((count.persistInfo.error as Error).message).toBe("Write failed");
    });

    it("should recover from write-failed to synced", async () => {
      let shouldFail = true;
      const persistor: Persistor<number> = {
        get: () => null,
        set: () => {
          if (shouldFail) throw new Error("Write failed");
        },
      };

      const count = signal(0, { persist: persistor });
      await new Promise((resolve) => setTimeout(resolve, 10));

      count.set(42);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count.persistInfo.status).toBe("write-failed");

      // Fix the error
      shouldFail = false;
      count.set(43);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count.persistInfo.status).toBe("synced");
      expect(count.persistInfo.error).toBeUndefined();
    });
  });

  describe("dirty tracking", () => {
    it("should not overwrite dirty value with hydrated value", async () => {
      let resolveGet: ((value: { value: number } | null) => void) | undefined;
      const getPromise = new Promise<{ value: number } | null>((resolve) => {
        resolveGet = resolve;
      });

      const persistor: Persistor<number> = {
        get: () => getPromise,
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      // Modify value before hydration completes
      count.set(100);
      expect(count()).toBe(100);

      // Now resolve hydration with different value
      resolveGet!({ value: 42 });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should keep the dirty value
      expect(count()).toBe(100);
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should apply hydrated value if not dirty", async () => {
      let resolveGet: ((value: { value: number } | null) => void) | undefined;
      const getPromise = new Promise<{ value: number } | null>((resolve) => {
        resolveGet = resolve;
      });

      const persistor: Persistor<number> = {
        get: () => getPromise,
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      // Don't modify - just wait for hydration
      resolveGet!({ value: 42 });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count()).toBe(42);
    });
  });

  describe("external changes (on subscription)", () => {
    it("should re-hydrate on external change notification", async () => {
      let externalCallback: VoidFunction | undefined;
      let currentValue = 42;

      const persistor: Persistor<number> = {
        get: () => ({ value: currentValue }),
        set: vi.fn(),
        on: (callback) => {
          externalCallback = callback;
          return () => {
            externalCallback = undefined;
          };
        },
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count()).toBe(42);

      // Simulate external change
      currentValue = 100;
      externalCallback!();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count()).toBe(100);
    });

    it("should handle errors in external change notification", async () => {
      let externalCallback: VoidFunction | undefined;
      let shouldFail = false;

      const persistor: Persistor<number> = {
        get: () => {
          if (shouldFail) throw new Error("External read failed");
          return { value: 42 };
        },
        set: vi.fn(),
        on: (callback) => {
          externalCallback = callback;
          return () => {
            externalCallback = undefined;
          };
        },
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count()).toBe(42);
      expect(count.persistInfo.status).toBe("synced");

      // Trigger external change with error
      shouldFail = true;
      externalCallback!();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count()).toBe(42); // Value unchanged
      expect(count.persistInfo.status).toBe("read-failed");
    });
  });

  describe("custom equality", () => {
    it("should respect custom equals when hydrating", async () => {
      const persistor: Persistor<{ id: number; name: string }> = {
        get: () => ({ value: { id: 1, name: "Updated" } }),
        set: vi.fn(),
      };

      const obj = signal(
        { id: 1, name: "Original" },
        {
          persist: persistor,
          equals: (a, b) => a.id === b.id,
        }
      );

      const listener = vi.fn();
      obj.on(listener);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not emit because id is the same
      expect(listener).not.toHaveBeenCalled();
      expect(obj().name).toBe("Original");
    });
  });

  describe("integration", () => {
    it("should work with computed signals", async () => {
      const persistor: Persistor<number> = {
        get: () => ({ value: 10 }),
        set: vi.fn(),
      };

      const base = signal(0, { persist: persistor });
      const doubled = signal(() => base() * 2);

      // Sync persistor: base is immediately 10, so doubled is immediately 20
      expect(doubled()).toBe(20);
    });

    it("should trigger listeners on hydration", async () => {
      const persistor: Persistor<number> = {
        get: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { value: 42 };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });
      const listener = vi.fn();
      count.on(listener);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("reactive persistInfo", () => {
    it("should make persistInfo reactive in rx()", async () => {
      const persistor: Persistor<number> = {
        get: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { value: 42 };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });
      const renderSpy = vi.fn();

      // Track renders with persistInfo access
      const Component = () => {
        return rx(() => {
          renderSpy(count.persistInfo.status);
          return React.createElement("div", null, count.persistInfo.status);
        });
      };

      const { container } = render(React.createElement(Component));

      // Initial status
      expect(container.textContent).toBe("reading");
      expect(renderSpy).toHaveBeenCalledWith("reading");

      // Wait for hydration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Status updated reactively
      expect(container.textContent).toBe("synced");
      expect(renderSpy).toHaveBeenCalledWith("synced");
      expect(renderSpy).toHaveBeenCalledTimes(2); // reading → synced
    });

    it("should make persistInfo reactive in effect()", async () => {
      const persistor: Persistor<number> = {
        get: () => null,
        set: vi.fn(
          (_value: unknown) =>
            new Promise<void>((resolve) => setTimeout(resolve, 50))
        ),
      };

      const count = signal(0, { persist: persistor });
      const effectSpy = vi.fn();

      await new Promise((resolve) => setTimeout(resolve, 10));

      effect(() => {
        effectSpy(count.persistInfo.status);
      });

      // Initial call
      expect(effectSpy).toHaveBeenCalledWith("synced");

      // Trigger write
      count.set(42);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Effect re-ran due to status change
      expect(effectSpy).toHaveBeenCalledWith("writing");

      // Wait for write to complete
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Effect re-ran again
      expect(effectSpy).toHaveBeenCalledWith("synced");
      expect(effectSpy).toHaveBeenCalledTimes(3); // synced → writing → synced
    });

    it("should make persistInfo reactive in computed signals", async () => {
      const persistor: Persistor<number> = {
        get: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { value: 42 };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });
      const statusMessage = signal(() => {
        const status = count.persistInfo.status;
        return status === "reading"
          ? "Loading..."
          : status === "synced"
          ? "Ready"
          : "Error";
      });

      expect(statusMessage()).toBe("Loading...");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(statusMessage()).toBe("Ready");
    });

    it("should not trigger updates if status unchanged", () => {
      const persistor: Persistor<number> = {
        get: () => ({ value: 42 }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });
      const effectSpy = vi.fn();

      effect(() => {
        effectSpy(count.persistInfo.status);
      });

      // Initial: synced (sync persistor)
      expect(effectSpy).toHaveBeenCalledTimes(1);
      expect(effectSpy).toHaveBeenCalledWith("synced");

      // Access persistInfo multiple times (shouldn't trigger)
      count.persistInfo.status;
      count.persistInfo.status;

      expect(effectSpy).toHaveBeenCalledTimes(1);
    });

    it("should track persistInfo.error reactively", async () => {
      const persistor: Persistor<number> = {
        get: () => null,
        set: () => {
          throw new Error("Write failed");
        },
      };

      const count = signal(0, { persist: persistor });
      const errorMessages: unknown[] = [];

      await new Promise((resolve) => setTimeout(resolve, 10));

      effect(() => {
        errorMessages.push(count.persistInfo.error);
      });

      expect(errorMessages).toEqual([undefined]);

      count.set(42);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Effect runs 2 times: initial (undefined) → write-failed (Error)
      // No "writing" state because sync error is caught immediately
      expect(errorMessages.length).toBe(2);
      expect(errorMessages[0]).toBeUndefined();
      expect(errorMessages[1]).toBeInstanceOf(Error);
      expect((errorMessages[1] as Error).message).toBe("Write failed");
    });

    it("should work with conditional persistInfo access", async () => {
      const persistor: Persistor<number> = {
        get: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { value: 42 };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });
      const showLoading = signal(true);
      const renderSpy = vi.fn();

      const Component = () => {
        return rx(() => {
          const loading = showLoading();
          const status = loading ? count.persistInfo.status : null;
          renderSpy(status);
          return React.createElement("div", null, status || "hidden");
        });
      };

      const { container } = render(React.createElement(Component));

      expect(container.textContent).toBe("reading");
      expect(renderSpy).toHaveBeenCalledWith("reading");

      // Wait for hydration
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(container.textContent).toBe("synced");
      expect(renderSpy).toHaveBeenCalledWith("synced");

      // Hide loading - should stop tracking persistInfo
      showLoading.set(false);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(container.textContent).toBe("hidden");
      expect(renderSpy).toHaveBeenCalledWith(null);
    });

    it("should work in multiple reactive contexts simultaneously", async () => {
      const persistor: Persistor<number> = {
        get: () => null,
        set: vi.fn(
          (_value: unknown) =>
            new Promise<void>((resolve) => setTimeout(resolve, 50))
        ),
      };

      const count = signal(0, { persist: persistor });
      const effect1Spy = vi.fn();
      const effect2Spy = vi.fn();

      await new Promise((resolve) => setTimeout(resolve, 10));

      effect(() => {
        effect1Spy(count.persistInfo.status);
      });

      effect(() => {
        effect2Spy(count.persistInfo.status);
      });

      expect(effect1Spy).toHaveBeenCalledWith("synced");
      expect(effect2Spy).toHaveBeenCalledWith("synced");

      count.set(42);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Both effects should see "writing"
      expect(effect1Spy).toHaveBeenCalledWith("writing");
      expect(effect2Spy).toHaveBeenCalledWith("writing");

      await new Promise((resolve) => setTimeout(resolve, 60));

      // Both effects should see "synced"
      expect(effect1Spy).toHaveBeenCalledTimes(3);
      expect(effect2Spy).toHaveBeenCalledTimes(3);
    });

    it("should not make persistInfo reactive outside tracking context", () => {
      const persistor: Persistor<number> = {
        get: () => ({ value: 42 }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      // Access outside reactive context - just returns value
      const status1 = count.persistInfo.status;
      expect(status1).toBe("synced");

      const status2 = count.persistInfo.status;
      expect(status2).toBe("synced");

      // No subscriptions created
      expect(status1).toBe(status2);
    });
  });

  describe("manual hydration (hydrate method)", () => {
    it("should expose hydrate method for persisted signals", () => {
      const persistor: Persistor<number> = {
        get: () => ({ value: 42 }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      expect(typeof count.hydrate).toBe("function");
    });

    it("should reload from storage when hydrate is called", async () => {
      let storageValue = 42;
      const persistor: Persistor<number> = {
        get: () => ({ value: storageValue }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      expect(count()).toBe(42);

      // Change storage value
      storageValue = 100;

      // Manual hydration
      count.hydrate();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count()).toBe(100);
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should handle async hydrate correctly", async () => {
      let storageValue = 42;
      const persistor: Persistor<number> = {
        get: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { value: storageValue };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      // Wait for initial hydration
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(count()).toBe(42);

      // Change storage
      storageValue = 200;

      // Manual hydration
      count.hydrate();

      // Status should be reading
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count.persistInfo.status).toBe("reading");

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(count()).toBe(200);
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should trigger listeners when hydrate updates value", async () => {
      let storageValue = 42;
      const persistor: Persistor<number> = {
        get: () => ({ value: storageValue }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });
      const listener = vi.fn();
      count.on(listener);

      await new Promise((resolve) => setTimeout(resolve, 10));
      listener.mockClear();

      // Change storage and hydrate
      storageValue = 100;
      count.hydrate();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should not trigger listeners if hydrated value is unchanged", async () => {
      const persistor: Persistor<number> = {
        get: () => ({ value: 42 }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });
      const listener = vi.fn();

      await new Promise((resolve) => setTimeout(resolve, 10));

      count.on(listener);
      listener.mockClear();

      // Hydrate with same value
      count.hydrate();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle hydrate errors gracefully", async () => {
      let shouldFail = false;
      const persistor: Persistor<number> = {
        get: () => {
          if (shouldFail) throw new Error("Hydrate failed");
          return { value: 42 };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count()).toBe(42);
      expect(count.persistInfo.status).toBe("synced");

      // Trigger error
      shouldFail = true;
      count.hydrate();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count()).toBe(42); // Value unchanged
      expect(count.persistInfo.status).toBe("read-failed");
      expect((count.persistInfo.error as Error).message).toBe("Hydrate failed");
    });

    it("should recover from read-failed status on successful hydrate", async () => {
      let shouldFail = true;
      const persistor: Persistor<number> = {
        get: () => {
          if (shouldFail) throw new Error("Read failed");
          return { value: 100 };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count.persistInfo.status).toBe("read-failed");

      // Fix the error and retry
      shouldFail = false;
      count.hydrate();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count()).toBe(100);
      expect(count.persistInfo.status).toBe("synced");
      expect(count.persistInfo.error).toBeUndefined();
    });

    it("should clear dirty flag and reload when hydrate is called explicitly", async () => {
      let storageValue = 42;
      const persistor: Persistor<number> = {
        get: () => ({ value: storageValue }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count()).toBe(42);

      // Make signal dirty
      count.set(999);
      expect(count()).toBe(999);

      // Change storage and call hydrate explicitly
      storageValue = 100;
      count.hydrate();

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Manual hydrate() clears dirty flag and reloads from storage
      expect(count()).toBe(100);
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should work with hydrate in reactive contexts", async () => {
      let storageValue = 42;
      const persistor: Persistor<number> = {
        get: () => ({ value: storageValue }),
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });
      const doubled = signal(() => count() * 2);

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(doubled()).toBe(84);

      // Change storage and hydrate
      storageValue = 50;
      count.hydrate();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count()).toBe(50);
      expect(doubled()).toBe(100);
    });

    it("should handle multiple rapid hydrate calls", async () => {
      let getCount = 0;
      const persistor: Persistor<number> = {
        get: async () => {
          const count = ++getCount;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { value: count * 10 };
        },
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      // Wait for initial hydration
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(count()).toBe(10);

      // Trigger multiple hydrations rapidly
      count.hydrate();
      await new Promise((resolve) => setTimeout(resolve, 10));
      count.hydrate();
      await new Promise((resolve) => setTimeout(resolve, 10));
      count.hydrate();

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should use the latest hydration result (race condition handled)
      expect(count()).toBe(40); // Last hydration (4th call)
      expect(count.persistInfo.status).toBe("synced");
    });

    it("should allow hydrate during write operations", async () => {
      let storageValue = 42;
      const persistor: Persistor<number> = {
        get: () => ({ value: storageValue }),
        set: vi.fn(
          (_value: unknown) =>
            new Promise<void>((resolve) => setTimeout(resolve, 100))
        ),
      };

      const count = signal(0, { persist: persistor });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(count()).toBe(42);

      // Start a write operation
      count.set(100);
      expect(count.persistInfo.status).toBe("writing");

      // Hydrate during write (synchronous hydration)
      storageValue = 200;
      count.hydrate();

      // Manual hydrate() clears dirty flag, so value updates from storage
      // Since get() is sync, value and status update immediately
      expect(count()).toBe(200);
      expect(count.persistInfo.status).toBe("synced");

      // Wait for write to complete (stale write, should not change status)
      await new Promise((resolve) => setTimeout(resolve, 110));
      expect(count.persistInfo.status).toBe("synced");
      expect(count()).toBe(200);
    });

    it("should do nothing if persistor has no get method", () => {
      const persistor: Persistor<number> = {
        set: vi.fn(),
      };

      const count = signal(0, { persist: persistor });

      expect(count()).toBe(0);
      expect(count.persistInfo.status).toBe("idle");

      // Hydrate should be safe to call but do nothing
      count.hydrate();

      expect(count()).toBe(0);
      expect(count.persistInfo.status).toBe("idle");
    });
  });

  describe("race condition handling", () => {
    it("should handle concurrent write operations correctly", async () => {
      let writeCount = 0;
      const persistor: Persistor<number> = {
        get: () => null,
        set: vi.fn(
          (_value: unknown) =>
            new Promise<void>((resolve) => {
              const count = ++writeCount;
              // First write takes longer
              const delay = count === 1 ? 100 : 50;
              setTimeout(resolve, delay);
            })
        ),
      };

      const count = signal(0, { persist: persistor });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Start first write (takes 100ms)
      count.set(1);
      expect(count.persistInfo.status).toBe("writing");

      // Start second write before first completes (takes 50ms)
      await new Promise((resolve) => setTimeout(resolve, 10));
      count.set(2);

      // Second write completes first
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(count.persistInfo.status).toBe("synced");

      // First write completes, but status shouldn't change (stale promise)
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(count.persistInfo.status).toBe("synced");
      expect(count()).toBe(2); // Value is correct
    });

    it("should handle write failure after successful write", async () => {
      let callCount = 0;
      const persistor: Persistor<number> = {
        get: () => null,
        set: vi.fn((_value: unknown) => {
          const count = ++callCount;
          return new Promise<void>((resolve, reject) => {
            const delay = count === 1 ? 100 : 50;
            setTimeout(() => {
              if (count === 1) {
                reject(new Error("First write failed"));
              } else {
                resolve();
              }
            }, delay);
          });
        }),
      };

      const count = signal(0, { persist: persistor });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Start first write (will fail after 100ms)
      count.set(1);

      // Start second write (will succeed after 50ms)
      await new Promise((resolve) => setTimeout(resolve, 10));
      count.set(2);

      // Second write succeeds
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(count.persistInfo.status).toBe("synced");
      expect(count.persistInfo.error).toBeUndefined();

      // First write fails, but status shouldn't change (stale promise)
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(count.persistInfo.status).toBe("synced"); // Still synced!
      expect(count.persistInfo.error).toBeUndefined(); // No error!
    });

    it("should handle concurrent hydration operations via storage events", async () => {
      let getCount = 0;
      let notifyCallback: VoidFunction | undefined;

      const persistor: Persistor<number> = {
        get: () => {
          const count = ++getCount;
          return new Promise<{ value: number }>((resolve) => {
            const delay = count === 1 ? 100 : 50;
            setTimeout(() => resolve({ value: count * 10 }), delay);
          });
        },
        set: vi.fn(),
        on: (callback) => {
          notifyCallback = callback;
          return () => {
            notifyCallback = undefined;
          };
        },
      };

      const count = signal(0, { persist: persistor });

      // First hydration starts automatically (takes 100ms)
      expect(count.persistInfo.status).toBe("reading");

      // Simulate external storage change after 10ms
      await new Promise((resolve) => setTimeout(resolve, 10));
      notifyCallback?.(); // Triggers second hydration (takes 50ms)

      // Wait for second hydration to complete
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Should be synced (second hydration completed)
      expect(count.persistInfo.status).toBe("synced");
      expect(count()).toBe(20); // Value from second hydration

      // Wait for first hydration to complete (stale)
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Status and value should remain unchanged (first hydration is stale)
      expect(count.persistInfo.status).toBe("synced");
      expect(count()).toBe(20); // Still the second value
    });

    it("should handle rapid successive writes", async () => {
      const persistor: Persistor<number> = {
        get: () => null,
        set: vi.fn(
          (_value: unknown) =>
            new Promise<void>((resolve) => setTimeout(resolve, 50))
        ),
      };

      const count = signal(0, { persist: persistor });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Rapid writes
      count.set(1);
      count.set(2);
      count.set(3);
      count.set(4);
      count.set(5);

      expect(count.persistInfo.status).toBe("writing");
      expect(count()).toBe(5); // Value updates immediately

      // Wait for all writes to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be synced (only last write matters)
      expect(count.persistInfo.status).toBe("synced");
      expect(count()).toBe(5);
      expect(persistor.set).toHaveBeenCalledTimes(5);
    });

    it("should track promise correctly in persistInfo", async () => {
      const persistor: Persistor<number> = {
        get: () => null,
        set: vi.fn(
          (_value: unknown) =>
            new Promise<void>((resolve) => setTimeout(resolve, 50))
        ),
      };

      const count = signal(0, { persist: persistor });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count.persistInfo.promise).toBeUndefined();

      count.set(1);
      const promise1 = count.persistInfo.promise;
      expect(promise1).toBeInstanceOf(Promise);

      // New write creates new promise
      await new Promise((resolve) => setTimeout(resolve, 10));
      count.set(2);
      const promise2 = count.persistInfo.promise;
      expect(promise2).toBeInstanceOf(Promise);
      expect(promise2).not.toBe(promise1); // Different promise

      // Before completion, promise2 is tracked
      expect(count.persistInfo.promise).toBe(promise2);

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(count.persistInfo.status).toBe("synced");

      // After completion, promise is still tracked for race condition checks
      // (We keep it to verify which promise completed)
      expect(count.persistInfo.promise).toBe(promise2);
    });
  });
});
