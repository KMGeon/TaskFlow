import { describe, it, expect } from "vitest";
import { buildLocalSummary, formatStatusOutput } from "./local-summary.js";
import type { Task } from "../../types.js";

const makeTasks = (): Task[] => [
  { id: "1", title: "Task A", status: "Done", priority: 5, dependencies: [], createdAt: "", updatedAt: "", description: "" },
  { id: "2", title: "Task B", status: "Done", priority: 4, dependencies: ["1"], createdAt: "", updatedAt: "", description: "" },
  { id: "3", title: "Task C", status: "InProgress", priority: 3, dependencies: [], createdAt: "", updatedAt: "", description: "" },
  { id: "4", title: "Task D", status: "Todo", priority: 2, dependencies: ["3"], createdAt: "", updatedAt: "", description: "" },
  { id: "5", title: "Task E", status: "Blocked", priority: 1, dependencies: [], createdAt: "", updatedAt: "", description: "" },
];

describe("buildLocalSummary", () => {
  it("should calculate correct progress", () => {
    const summary = buildLocalSummary(makeTasks());
    expect(summary.total).toBe(5);
    expect(summary.done).toBe(2);
    expect(summary.progressPercent).toBe(40);
  });

  it("should group tasks by status", () => {
    const summary = buildLocalSummary(makeTasks());
    expect(summary.groups.Done).toHaveLength(2);
    expect(summary.groups.InProgress).toHaveLength(1);
    expect(summary.groups.Todo).toHaveLength(1);
    expect(summary.groups.Blocked).toHaveLength(1);
  });

  it("should handle empty task list", () => {
    const summary = buildLocalSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.progressPercent).toBe(0);
  });
});

describe("formatStatusOutput", () => {
  it("should produce formatted output with all sections", () => {
    const summary = buildLocalSummary(makeTasks());
    const output = formatStatusOutput(summary);
    expect(output).toContain("2/5");
    expect(output).toContain("40%");
    expect(output).toContain("Done");
    expect(output).toContain("In Progress");
    expect(output).toContain("Todo");
    expect(output).toContain("Blocked");
  });

  it("should handle no tasks gracefully", () => {
    const summary = buildLocalSummary([]);
    const output = formatStatusOutput(summary);
    expect(output).toContain("0/0");
  });
});
