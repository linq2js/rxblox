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

  it("should export on", () => {
    expect(index.on).toBeDefined();
    expect(typeof index.on).toBe("object");
    expect(typeof index.on.mount).toBe("function");
    expect(typeof index.on.render).toBe("function");
    expect(typeof index.on.unmount).toBe("function");
  });
});

