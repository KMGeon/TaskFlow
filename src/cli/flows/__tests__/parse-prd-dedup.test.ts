import { describe, it, expect } from "vitest";
import { findDuplicates } from "../parse-prd-dedup";
import type { Task, TaskCreateInput } from "@/features/taskflow/types";

const now = "2026-03-21T00:00:00.000Z";

function makeExistingTask(overrides: Partial<Task>): Task {
  return {
    id: "001",
    title: "Existing task",
    status: "Todo",
    priority: 5,
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    description: "",
    ...overrides,
  };
}

function makeNewTask(overrides: Partial<TaskCreateInput>): TaskCreateInput {
  return {
    title: "New task",
    ...overrides,
  };
}

describe("findDuplicates", () => {
  it("should detect exact title duplicates", () => {
    const existing = [makeExistingTask({ id: "001", title: "Setup database" })];
    const newTasks = [makeNewTask({ title: "Setup database" })];

    const result = findDuplicates(newTasks, existing);

    expect(result.duplicates).toHaveLength(1);
    expect(result.unique).toHaveLength(0);
    expect(result.duplicates[0].score).toBe(1);
  });

  it("should detect similar title duplicates", () => {
    const existing = [makeExistingTask({ id: "001", title: "Setup the database connection" })];
    const newTasks = [makeNewTask({ title: "Setup database connection" })];

    const result = findDuplicates(newTasks, existing);

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].score).toBeGreaterThan(0.7);
  });

  it("should pass through unique tasks", () => {
    const existing = [makeExistingTask({ id: "001", title: "Setup database" })];
    const newTasks = [makeNewTask({ title: "Implement authentication" })];

    const result = findDuplicates(newTasks, existing);

    expect(result.duplicates).toHaveLength(0);
    expect(result.unique).toHaveLength(1);
  });

  it("should handle empty existing tasks", () => {
    const newTasks = [
      makeNewTask({ title: "Task A" }),
      makeNewTask({ title: "Task B" }),
    ];

    const result = findDuplicates(newTasks, []);

    expect(result.duplicates).toHaveLength(0);
    expect(result.unique).toHaveLength(2);
  });

  it("should handle mixed unique and duplicate tasks", () => {
    const existing = [
      makeExistingTask({ id: "001", title: "Setup project" }),
      makeExistingTask({ id: "002", title: "Add authentication" }),
    ];
    const newTasks = [
      makeNewTask({ title: "Setup project" }), // duplicate
      makeNewTask({ title: "Create API endpoints" }), // unique
      makeNewTask({ title: "Add authentication system" }), // similar
    ];

    const result = findDuplicates(newTasks, existing);

    expect(result.unique).toHaveLength(1);
    expect(result.unique[0].title).toBe("Create API endpoints");
    expect(result.duplicates.length).toBeGreaterThanOrEqual(1);
  });
});
