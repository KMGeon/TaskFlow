import { describe, it, expect } from "vitest";

describe("askClaude", () => {
  it("should be importable and have correct signature", async () => {
    const { askClaude } = await import("../client.js");
    expect(typeof askClaude).toBe("function");
  });
});

describe("askClaudeWithRetry", () => {
  it("should be importable", async () => {
    const { askClaudeWithRetry } = await import("../client.js");
    expect(typeof askClaudeWithRetry).toBe("function");
  });
});

describe("brainstormTask", () => {
  it("should be importable", async () => {
    const { brainstormTask } = await import("../client.js");
    expect(typeof brainstormTask).toBe("function");
  });
});
