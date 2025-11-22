import { describe, it, expect, vi } from "vitest";
import { signal } from "./signal";
import { persistSignals } from "./persistSignals";

describe("persistSignals", () => {
  describe("basic functionality", () => {
    it("should return signals and control functions", () => {
      const count = signal(0);
      const result = persistSignals({ count });

      expect(result.signals).toBeDefined();
      expect(result.signals.count).toBe(count);
      expect(typeof result.start).toBe("function");
      expect(typeof result.cancel).toBe("function");
      expect(typeof result.pause).toBe("function");
      expect(typeof result.resume).toBe("function");
      expect(typeof result.status).toBe("function");
    });

    it("should start with idle status when autoStart is false", () => {
      const count = signal(0);
      const result = persistSignals({ count }, { autoStart: false });

      expect(result.status()).toBe("idle");
    });

    it("should start with watching status when autoStart is true and no load", () => {
      const count = signal(0);
      const result = persistSignals({ count }, { autoStart: true });

      expect(result.status()).toBe("watching");
    });
  });

  describe("loading", () => {
    it("should transition from idle to loading to watching", async () => {
      const count = signal(0);
      const load = vi.fn().mockResolvedValue({ count: 42 });
      
      const result = persistSignals({ count }, { 
        autoStart: false,
        load 
      });

      expect(result.status()).toBe("idle");
      
      result.start();
      expect(result.status()).toBe("loading");

      // Wait for load to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.status()).toBe("watching");
      expect(count.get()).toBe(42);
      expect(load).toHaveBeenCalledTimes(1);
    });

    it("should load initial values from load function", async () => {
      const count = signal(0);
      const name = signal("");
      
      persistSignals({ count, name }, {
        load: () => ({ count: 42, name: "John" })
      });

      // Wait for load to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(count.get()).toBe(42);
      expect(name.get()).toBe("John");
    });

    it("should handle async load function", async () => {
      const count = signal(0);
      
      const result = persistSignals({ count }, {
        load: async (): Promise<{ count: number }> => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { count: 100 };
        }
      });

      expect(result.status()).toBe("loading");
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(result.status()).toBe("watching");
      expect(count.get()).toBe(100);
    });

    it("should handle partial load results", async () => {
      const count = signal(0);
      const name = signal("default");
      
      persistSignals({ count, name }, {
        load: () => ({ count: 42 }) // Only load count
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(count.get()).toBe(42);
      expect(name.get()).toBe("default"); // Should keep initial value
    });

    it("should apply sync loads immediately without async delay", () => {
      const count = signal(0);
      let loadCalled = false;
      
      const result = persistSignals({ count }, {
        load: () => {
          loadCalled = true;
          return { count: 42 };
        }
      });

      // Sync load should apply immediately
      expect(loadCalled).toBe(true);
      expect(count.get()).toBe(42);
      expect(result.status()).toBe("watching"); // Should be watching immediately, not loading
    });

    it("should handle async loads with loading state", async () => {
      const count = signal(0);
      
      const result = persistSignals({ count }, {
        load: async (): Promise<{ count: number }> => {
          return { count: 42 };
        }
      });

      // Async load should set status to loading
      expect(result.status()).toBe("loading");
      expect(count.get()).toBe(0); // Not yet loaded
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(result.status()).toBe("watching");
      expect(count.get()).toBe(42);
    });

    it("should handle load errors with onError", async () => {
      const count = signal(0);
      const onError = vi.fn();
      
      const result = persistSignals({ count }, {
        load: () => {
          throw new Error("Load failed");
        },
        onError
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error), "load");
      expect(result.status()).toBe("watching"); // Should still transition to watching
      expect(count.get()).toBe(0); // Keep initial value
    });


    it("should apply loaded values if signal not modified during load", async () => {
      const count = signal(0);
      const save = vi.fn();
      let resolveLoad: (value: any) => void;
      const loadPromise = new Promise<{ count: number }>(resolve => {
        resolveLoad = resolve;
      });
      
      const result = persistSignals({ count }, {
        load: () => loadPromise,
        save
      });

      expect(result.status()).toBe("loading");
      
      // Don't modify signal during loading
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Complete load
      resolveLoad!({ count: 42 });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(result.status()).toBe("watching");
      // Loaded value should be applied since signal wasn't modified
      expect(count.get()).toBe(42);
      
      // Now changes should trigger save
      count.set(50);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(save).toHaveBeenCalledWith({ count: 50 });
    });

    it("should preserve user modifications during async load", async () => {
      const count = signal(0);
      const save = vi.fn();
      let resolveLoad: (value: any) => void;
      const loadPromise = new Promise<{ count: number }>(resolve => {
        resolveLoad = resolve;
      });
      
      const result = persistSignals({ count }, {
        load: () => loadPromise,
        save
      });

      expect(result.status()).toBe("loading");
      
      // User modifies signal while loading
      count.set(10);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should not save while loading
      expect(save).not.toHaveBeenCalled();
      
      // Complete load
      resolveLoad!({ count: 42 });
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(result.status()).toBe("watching");
      // User's explicit modification (10) should win over loaded value (42)
      // because hydrate() skips if signal was already modified
      expect(count.get()).toBe(10);
      
      // Now changes should trigger save
      count.set(50);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(save).toHaveBeenCalledWith({ count: 50 });
    });
  });

  describe("saving", () => {
    it("should call save when signal changes", async () => {
      const count = signal(0);
      const save = vi.fn();
      
      persistSignals({ count }, { save });

      count.set(42);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(save).toHaveBeenCalledWith({ count: 42 });
    });

    it("should save all signal values", async () => {
      const count = signal(0);
      const name = signal("John");
      const save = vi.fn();
      
      persistSignals({ count, name }, { save });

      count.set(42);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(save).toHaveBeenCalledWith({ count: 42, name: "John" });
    });


    it("should handle save errors with onError", async () => {
      const count = signal(0);
      const onError = vi.fn();
      const save = vi.fn().mockImplementation(() => {
        throw new Error("Save failed");
      });
      
      persistSignals({ count }, { save, onError });

      count.set(42);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error), "save");
    });
  });

  describe("state transitions", () => {
    it("should transition from watching to paused", () => {
      const count = signal(0);
      const result = persistSignals({ count });

      expect(result.status()).toBe("watching");
      
      result.pause();
      expect(result.status()).toBe("paused");
    });

    it("should transition from paused to watching via resume", () => {
      const count = signal(0);
      const result = persistSignals({ count });

      result.pause();
      expect(result.status()).toBe("paused");
      
      result.resume();
      expect(result.status()).toBe("watching");
    });

    it("should transition from watching to idle via cancel", () => {
      const count = signal(0);
      const result = persistSignals({ count });

      expect(result.status()).toBe("watching");
      
      result.cancel();
      expect(result.status()).toBe("idle");
    });

    it("should transition from paused to idle via cancel", () => {
      const count = signal(0);
      const result = persistSignals({ count });

      result.pause();
      expect(result.status()).toBe("paused");
      
      result.cancel();
      expect(result.status()).toBe("idle");
    });

    it("should allow restart from idle via start", async () => {
      const count = signal(0);
      const load = vi.fn().mockReturnValue({ count: 42 });
      
      const result = persistSignals({ count }, { 
        autoStart: false,
        load 
      });

      expect(result.status()).toBe("idle");
      
      result.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.status()).toBe("watching");
      expect(load).toHaveBeenCalledTimes(1);
      
      result.cancel();
      expect(result.status()).toBe("idle");
      
      // Restart
      result.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.status()).toBe("watching");
      expect(load).toHaveBeenCalledTimes(2);
    });
  });

  describe("pause/resume behavior", () => {
    it("should not save while paused", async () => {
      const count = signal(0);
      const save = vi.fn();
      
      const result = persistSignals({ count }, { save });

      result.pause();
      
      count.set(42);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(save).not.toHaveBeenCalled();
    });

    it("should save latest state when resuming", async () => {
      const count = signal(0);
      const save = vi.fn();
      
      const result = persistSignals({ count }, { save });

      result.pause();
      
      count.set(42);
      count.set(100);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(save).not.toHaveBeenCalled();
      
      result.resume();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should save the latest state
      expect(save).toHaveBeenCalledWith({ count: 100 });
    });

    it("should continue saving after resume", async () => {
      const count = signal(0);
      const save = vi.fn();
      
      const result = persistSignals({ count }, { save });

      result.pause();
      result.resume();
      
      count.set(42);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(save).toHaveBeenCalledWith({ count: 42 });
    });

    it("should do nothing if pause is called when already paused", () => {
      const count = signal(0);
      const result = persistSignals({ count });

      result.pause();
      expect(result.status()).toBe("paused");
      
      result.pause();
      expect(result.status()).toBe("paused");
    });

    it("should do nothing if resume is called when not paused", async () => {
      const count = signal(0);
      const save = vi.fn();
      const result = persistSignals({ count }, { save });

      expect(result.status()).toBe("watching");
      
      result.resume();
      expect(result.status()).toBe("watching");
      
      // Should not trigger an extra save
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should not save after cancel", async () => {
      const count = signal(0);
      const save = vi.fn();
      
      const result = persistSignals({ count }, { save });

      result.cancel();
      
      count.set(42);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(save).not.toHaveBeenCalled();
    });

    it("should clean up subscriptions on cancel", async () => {
      const count = signal(0);
      const save = vi.fn();
      
      const result = persistSignals({ count }, { save });

      // Trigger save
      count.set(1);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(save).toHaveBeenCalledTimes(1);
      
      result.cancel();
      
      // Should not save after cancel
      count.set(2);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("should handle start when already started", async () => {
      const count = signal(0);
      const load = vi.fn().mockReturnValue({ count: 42 });
      
      const result = persistSignals({ count }, { load });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.status()).toBe("watching");
      expect(load).toHaveBeenCalledTimes(1);
      
      // Try to start again
      result.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should be no-op
      expect(result.status()).toBe("watching");
      expect(load).toHaveBeenCalledTimes(1);
    });

    it("should handle cancel when already idle", () => {
      const count = signal(0);
      const result = persistSignals({ count }, { autoStart: false });

      expect(result.status()).toBe("idle");
      
      result.cancel();
      expect(result.status()).toBe("idle");
    });

    it("should handle empty signal map", () => {
      const result = persistSignals({});

      expect(result.signals).toEqual({});
      expect(result.status()).toBe("watching");
    });

    it("should handle signal with undefined value", async () => {
      const value = signal<string | undefined>(undefined);
      const save = vi.fn();
      
      persistSignals({ value }, { save });

      value.set("test");
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(save).toHaveBeenCalledWith({ value: "test" });
    });
  });

  describe("options combinations", () => {
    it("should respect autoStart: false", () => {
      const count = signal(0);
      const save = vi.fn();
      
      const result = persistSignals({ count }, { 
        autoStart: false,
        save 
      });

      expect(result.status()).toBe("idle");
    });

  });
});

