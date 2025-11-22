import { describe, it, expect } from "vitest";
import { signal } from "./signal";

describe("isSignal", () => {
  it("should identify any signal", () => {
    const mutable = signal(1);
    const computed = signal({ mutable }, ({ deps }) => deps.mutable * 2);
    const notSignal = { value: 1 };

    expect(signal.is(mutable)).toBe(true);
    expect(signal.is(computed)).toBe(true);
    expect(signal.is(notSignal)).toBe(false);
    expect(signal.is(null)).toBe(false);
    expect(signal.is(undefined)).toBe(false);
    expect(signal.is(42)).toBe(false);
  });

  it("should identify mutable signals", () => {
    const mutable = signal(1);
    const computed = signal({ mutable }, ({ deps }) => deps.mutable * 2);

    expect(signal.is(mutable, "mutable")).toBe(true);
    expect(signal.is(computed, "mutable")).toBe(false);

    if (signal.is(mutable, "mutable")) {
      // TypeScript should know mutable has set method
      mutable.set(5);
      expect(mutable()).toBe(5);
    }
  });

  it("should identify computed signals", () => {
    const mutable = signal(1);
    const computed = signal({ mutable }, ({ deps }) => deps.mutable * 2);

    expect(signal.is(computed, "computed")).toBe(true);
    expect(signal.is(mutable, "computed")).toBe(false);

    if (signal.is(computed, "computed")) {
      // TypeScript should know computed has pause/resume methods
      computed.pause();
      expect(computed.paused()).toBe(true);
      computed.resume();
      expect(computed.paused()).toBe(false);
    }
  });

  it("should work with type guards in conditional logic", () => {
    const signals: unknown[] = [
      signal(1),
      signal({ a: signal(1) }, ({ deps }) => deps.a * 2),
      { value: 1 },
      null,
    ];

    const mutableSignals = signals.filter((s) => signal.is(s, "mutable"));
    const computedSignals = signals.filter((s) => signal.is(s, "computed"));
    const anySignals = signals.filter((s) => signal.is(s));

    expect(mutableSignals).toHaveLength(1);
    expect(computedSignals).toHaveLength(1);
    expect(anySignals).toHaveLength(2);
  });

  it("should provide proper type narrowing", () => {
    const mixed: unknown = signal(42);

    if (signal.is(mixed, "mutable")) {
      // TypeScript knows this has set method
      mixed.set(100);
      expect(mixed()).toBe(100);
    }

    const computed = signal({ a: signal(1) }, ({ deps }) => deps.a * 2);

    if (signal.is(computed, "computed")) {
      // TypeScript knows this has pause/resume
      computed.pause();
      expect(computed.paused()).toBe(true);
    }
  });
});

