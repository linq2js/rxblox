import { describe, it, expect } from "vitest";
import { signal } from "./signal";

describe("signal.proxy (readonly)", () => {
  it("should provide stable proxy reference (unlike signal getter)", () => {
    const todo = signal({ title: "hello", done: false });

    // ✅ Proxy is stable (same reference)
    const proxy1 = todo.proxy;
    const proxy2 = todo.proxy;
    expect(proxy1).toBe(proxy2);

    // Even after updates, proxy reference remains stable
    todo.set({ title: "world", done: true });
    const proxy3 = todo.proxy;
    expect(proxy1).toBe(proxy3);

    // ❌ Signal getter returns different references after updates
    const obj1 = todo();
    todo.set({ title: "updated", done: false });
    const obj2 = todo();
    expect(obj1).not.toBe(obj2); // Different references (immutability)
  });

  it("should provide readonly property access for objects", () => {
    const todo = signal({ title: "hello", done: false });

    // Read works
    expect(todo.proxy.title).toBe("hello");
    expect(todo.proxy.done).toBe(false);

    // Write should throw (readonly)
    expect(() => {
      (todo.proxy as any).title = "updated";
    }).toThrow();
  });

  it("should reflect latest signal value", () => {
    const todo = signal({ title: "hello", done: false });
    const proxy = todo.proxy;

    // Initial value
    expect(proxy.title).toBe("hello");

    // Update signal
    todo.set({ title: "world", done: true });

    // Proxy reflects new value (same proxy object, fresh data)
    expect(proxy.title).toBe("world");
    expect(proxy.done).toBe(true);
  });

  it("should work with computed signals", () => {
    const state = signal({ count: 10 });
    const doubled = signal(() => ({ count: state().count * 2 }));

    // Read via proxy
    expect(doubled.proxy.count).toBe(20);

    // Update underlying signal
    state.set({ count: 15 });

    // Proxy reflects computed result
    expect(doubled.proxy.count).toBe(30);

    // Write should throw (readonly)
    expect(() => {
      (doubled.proxy as any).count = 100;
    }).toThrow();
  });

  it("should track dependencies in reactive contexts", () => {
    const todo = signal({ title: "hello", done: false });
    let computeCount = 0;

    const derived = signal(() => {
      computeCount++;
      return todo.proxy.title.toUpperCase();
    });

    expect(derived()).toBe("HELLO");
    expect(computeCount).toBe(1);

    // Update via signal
    todo.set({ title: "world", done: false });
    expect(derived()).toBe("WORLD");
    expect(computeCount).toBe(2);
  });

  it("should work with nested objects (readonly access)", () => {
    const state = signal({
      user: { name: "Alice", age: 30 },
      count: 0,
    });

    // Read nested
    expect(state.proxy.user.name).toBe("Alice");
    expect(state.proxy.count).toBe(0);

    // Update signal
    state.set({
      user: { name: "Bob", age: 25 },
      count: 10,
    });

    // Proxy reflects updated value
    expect(state.proxy.user.name).toBe("Bob");
    expect(state.proxy.count).toBe(10);

    // Write should throw (readonly)
    expect(() => {
      (state.proxy as any).count = 100;
    }).toThrow();
  });

  it("should auto-bind methods and provide stable references", () => {
    const obj = {
      name: "Alice",
      greet() {
        return `Hello, ${this.name}!`;
      },
    };
    const state = signal(obj);

    // Method works directly
    expect(state.proxy.greet()).toBe("Hello, Alice!");

    // Destructured method works (auto-bound)
    const { greet } = state.proxy;
    expect(greet()).toBe("Hello, Alice!");

    // Cached method reference is stable
    const greetMethod1 = state.proxy.greet;
    const greetMethod2 = state.proxy.greet;
    expect(greetMethod1).toBe(greetMethod2);

    // Cached method works
    expect(greetMethod1()).toBe("Hello, Alice!");
  });
});

