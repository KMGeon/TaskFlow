import { describe, it, expect } from "vitest";
import { filterTasks, sortTasks } from "../filter";
import type { Task } from "../../types";

const now = "2026-03-21T00:00:00.000Z";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "001",
    title: "Test",
    status: "Todo",
    priority: 0,
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    description: "",
    ...overrides,
  };
}

const TASKS: Task[] = [
  makeTask({ id: "001", title: "Alpha", status: "Todo", priority: 3 }),
  makeTask({ id: "002", title: "Bravo", status: "InProgress", priority: 5 }),
  makeTask({ id: "003", title: "Charlie", status: "Done", priority: 1 }),
  makeTask({ id: "004", title: "Delta", status: "Blocked", priority: 2, parentId: "001" }),
];

describe("filterTasks", () => {
  it("should filter by single status", () => {
    const result = filterTasks(TASKS, { status: "Todo" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("001");
  });

  it("should filter by multiple statuses", () => {
    const result = filterTasks(TASKS, { status: ["Todo", "InProgress"] });
    expect(result).toHaveLength(2);
  });

  it("should filter by priority", () => {
    const result = filterTasks(TASKS, { priority: 5 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("002");
  });

  it("should filter by parentId", () => {
    const result = filterTasks(TASKS, { parentId: "001" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("004");
  });

  it("should combine filters", () => {
    const result = filterTasks(TASKS, { status: "Blocked", parentId: "001" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("004");
  });

  it("should return all tasks with empty filter", () => {
    const result = filterTasks(TASKS, {});
    expect(result).toHaveLength(4);
  });
});

describe("sortTasks", () => {
  it("should sort by priority ascending", () => {
    const result = sortTasks(TASKS, "priority", "asc");
    expect(result.map((t) => t.priority)).toEqual([1, 2, 3, 5]);
  });

  it("should sort by priority descending", () => {
    const result = sortTasks(TASKS, "priority", "desc");
    expect(result.map((t) => t.priority)).toEqual([5, 3, 2, 1]);
  });

  it("should sort by title ascending", () => {
    const result = sortTasks(TASKS, "title", "asc");
    expect(result.map((t) => t.title)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  });

  it("should sort by status order", () => {
    const result = sortTasks(TASKS, "status", "asc");
    expect(result.map((t) => t.status)).toEqual(["Todo", "InProgress", "Blocked", "Done"]);
  });

  it("should default to priority desc", () => {
    const result = sortTasks(TASKS);
    expect(result[0].priority).toBe(5);
  });
});
