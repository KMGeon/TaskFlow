import { describe, it, expect } from "vitest";
import { parsePrdResponseSchema } from "../parse-prd-schema";

describe("parsePrdResponseSchema", () => {
  it("should validate a correct response", () => {
    const input = {
      tasks: [
        { title: "Setup project", description: "Init repo", priority: 8 },
        { title: "Add auth", description: "OAuth2", priority: 5 },
      ],
    };
    const result = parsePrdResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should apply defaults for optional fields", () => {
    const input = { tasks: [{ title: "Minimal task" }] };
    const result = parsePrdResponseSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tasks[0].priority).toBe(5);
      expect(result.data.tasks[0].status).toBe("Todo");
      expect(result.data.tasks[0].dependencies).toEqual([]);
      expect(result.data.tasks[0].description).toBe("");
    }
  });

  it("should reject empty tasks array", () => {
    const result = parsePrdResponseSchema.safeParse({ tasks: [] });
    expect(result.success).toBe(false);
  });

  it("should reject missing title", () => {
    const result = parsePrdResponseSchema.safeParse({
      tasks: [{ description: "No title" }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid priority range", () => {
    const result = parsePrdResponseSchema.safeParse({
      tasks: [{ title: "Test", priority: 15 }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid status", () => {
    const result = parsePrdResponseSchema.safeParse({
      tasks: [{ title: "Test", status: "Invalid" }],
    });
    expect(result.success).toBe(false);
  });
});
