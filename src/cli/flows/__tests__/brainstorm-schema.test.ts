import { describe, it, expect } from "vitest";
import { brainstormResponseSchema, subtaskItemSchema } from "../brainstorm-schema";

describe("subtaskItemSchema", () => {
  it("should validate a complete subtask", () => {
    const result = subtaskItemSchema.safeParse({
      tempId: "sub-1",
      title: "Setup database",
      description: "PostgreSQL connection",
      priority: 7,
      dependencies: ["sub-0"],
      estimate: "2h",
    });
    expect(result.success).toBe(true);
  });

  it("should apply defaults", () => {
    const result = subtaskItemSchema.safeParse({
      tempId: "sub-1",
      title: "Minimal",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(5);
      expect(result.data.dependencies).toEqual([]);
      expect(result.data.description).toBe("");
    }
  });

  it("should reject missing tempId", () => {
    const result = subtaskItemSchema.safeParse({ title: "No id" });
    expect(result.success).toBe(false);
  });

  it("should reject missing title", () => {
    const result = subtaskItemSchema.safeParse({ tempId: "sub-1" });
    expect(result.success).toBe(false);
  });
});

describe("brainstormResponseSchema", () => {
  it("should validate response with rationale", () => {
    const result = brainstormResponseSchema.safeParse({
      subtasks: [{ tempId: "sub-1", title: "Test" }],
      rationale: "Because reasons",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty subtasks", () => {
    const result = brainstormResponseSchema.safeParse({ subtasks: [] });
    expect(result.success).toBe(false);
  });
});
