import { describe, it, expect } from "vitest";
import { groupByStatus, computeProgress } from "../kanban-utils";
import type { Task } from "@/features/taskflow/types";

const now = "2026-03-21T00:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "001",
    title: "Test",
    status: "Todo",
    priority: 5,
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    description: "",
    ...overrides,
  };
}

describe("groupByStatus", () => {
  it("should group tasks into columns", () => {
    const tasks = [
      makeTask({ id: "1", status: "Todo" }),
      makeTask({ id: "2", status: "InProgress" }),
      makeTask({ id: "3", status: "Done" }),
      makeTask({ id: "4", status: "Todo" }),
      makeTask({ id: "5", status: "Blocked" }),
    ];

    const columns = groupByStatus(tasks);

    expect(columns.Todo).toHaveLength(2);
    expect(columns.InProgress).toHaveLength(1);
    expect(columns.Blocked).toHaveLength(1);
    expect(columns.Done).toHaveLength(1);
  });

  it("should return empty arrays for empty input", () => {
    const columns = groupByStatus([]);
    expect(columns.Todo).toHaveLength(0);
    expect(columns.InProgress).toHaveLength(0);
    expect(columns.Blocked).toHaveLength(0);
    expect(columns.Done).toHaveLength(0);
  });

  it("should handle all tasks in one column", () => {
    const tasks = [
      makeTask({ id: "1", status: "Done" }),
      makeTask({ id: "2", status: "Done" }),
    ];
    const columns = groupByStatus(tasks);
    expect(columns.Done).toHaveLength(2);
    expect(columns.Todo).toHaveLength(0);
  });
});

describe("computeProgress", () => {
  it("should return 0 for empty tasks", () => {
    expect(computeProgress([])).toBe(0);
  });

  it("should return 100 when all done", () => {
    const tasks = [
      makeTask({ status: "Done" }),
      makeTask({ status: "Done" }),
    ];
    expect(computeProgress(tasks)).toBe(100);
  });

  it("should return 0 when none done", () => {
    const tasks = [
      makeTask({ status: "Todo" }),
      makeTask({ status: "InProgress" }),
    ];
    expect(computeProgress(tasks)).toBe(0);
  });

  it("should calculate percentage correctly", () => {
    const tasks = [
      makeTask({ status: "Done" }),
      makeTask({ status: "Todo" }),
      makeTask({ status: "InProgress" }),
      makeTask({ status: "Done" }),
    ];
    expect(computeProgress(tasks)).toBe(50);
  });

  it("should round to nearest integer", () => {
    const tasks = [
      makeTask({ status: "Done" }),
      makeTask({ status: "Todo" }),
      makeTask({ status: "Todo" }),
    ];
    expect(computeProgress(tasks)).toBe(33);
  });
});
