import { describe, it, expect } from "vitest";

describe("claude-client", () => {
  it("should export runPrdBrainstorm function", async () => {
    const { runPrdBrainstorm } = await import("../claude-client.js");
    expect(typeof runPrdBrainstorm).toBe("function");
  });
});
