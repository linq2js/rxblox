import { describe, it, expect } from "vitest";
import * as index from "./index";

describe("index exports", () => {
  it("should export signal", () => {
    expect(index.signal).toBeDefined();
    expect(typeof index.signal).toBe("function");
  });

  it("should export effect", () => {
    expect(index.effect).toBeDefined();
    expect(typeof index.effect).toBe("function");
  });

  it("should export rx", () => {
    expect(index.rx).toBeDefined();
    expect(typeof index.rx).toBe("function");
  });

  it("should export blox", () => {
    expect(index.blox).toBeDefined();
    expect(typeof index.blox).toBe("function");
  });

  it("should export provider", () => {
    expect(index.provider).toBeDefined();
    expect(typeof index.provider).toBe("function");
  });

  it("should export blox.on and blox.onEvent", () => {
    expect(index.blox.on).toBeDefined();
    expect(index.blox.onEvent).toBeDefined();
    expect(typeof index.blox.on).toBe("function");
    expect(typeof index.blox.onEvent).toBe("function");
    // Verify they're the same function (alias)
    expect(index.blox.on).toBe(index.blox.onEvent);
  });

  it("should export standalone onEvent function", () => {
    expect(index.onEvent).toBeDefined();
    expect(typeof index.onEvent).toBe("function");
  });

  it("should export blox.hook", () => {
    expect(index.blox.hook).toBeDefined();
    expect(typeof index.blox.hook).toBe("function");
  });
});
