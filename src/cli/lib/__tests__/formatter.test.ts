import { describe, it, expect } from "vitest";
import { truncate, formatTaskTable, formatTaskDetail } from "../formatter";
import type { Task } from "../../../features/taskflow/types.js";

const now = new Date().toISOString();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "001",
    title: "Test task",
    status: "Todo",
    priority: 5,
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    description: "",
    ...overrides,
  };
}

describe("truncate", () => {
  it("should not truncate short strings", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("should truncate long strings with ellipsis", () => {
    expect(truncate("a very long string that exceeds", 15)).toBe("a very long s..");
  });

  it("should handle exact length", () => {
    expect(truncate("exact", 5)).toBe("exact");
  });

  it("should handle maxLen <= 3", () => {
    expect(truncate("hello", 3)).toBe("hel");
  });

  it("should handle empty string", () => {
    expect(truncate("", 10)).toBe("");
  });
});

describe("formatTaskTable", () => {
  it("should show empty message for no tasks", () => {
    const output = formatTaskTable([]);
    expect(output).toContain("태스크가 없습니다");
  });

  it("should render table with tasks", () => {
    const tasks = [
      makeTask({ id: "001", title: "Setup", priority: 8, status: "InProgress" }),
      makeTask({ id: "002", title: "Auth", priority: 5, status: "Todo" }),
    ];
    const output = formatTaskTable(tasks);

    // strip ANSI
    const plain = output.replace(/\x1b\[[0-9;]*m/g, "");

    expect(plain).toContain("001");
    expect(plain).toContain("002");
    expect(plain).toContain("Setup");
    expect(plain).toContain("Auth");
    expect(plain).toContain("InProgress");
    expect(plain).toContain("Todo");
  });

  it("should show dependency count", () => {
    const tasks = [
      makeTask({ id: "001", dependencies: ["002", "003"] }),
    ];
    const output = formatTaskTable(tasks);
    const plain = output.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("2");
  });

  it("should truncate long titles", () => {
    const tasks = [
      makeTask({ title: "This is an extremely long task title that should be truncated in the table view" }),
    ];
    const output = formatTaskTable(tasks);
    const plain = output.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("..");
  });
});

describe("formatTaskDetail", () => {
  it("should display all task fields", () => {
    const task = makeTask({
      id: "005",
      title: "Implement auth",
      status: "InProgress",
      priority: 8,
      dependencies: ["001", "002"],
      parentId: "000",
      description: "OAuth2 implementation details",
    });

    const output = formatTaskDetail(task);
    const plain = output.replace(/\x1b\[[0-9;]*m/g, "");

    expect(plain).toContain("005");
    expect(plain).toContain("Implement auth");
    expect(plain).toContain("InProgress");
    expect(plain).toContain("8");
    expect(plain).toContain("001, 002");
    expect(plain).toContain("000");
    expect(plain).toContain("OAuth2 implementation details");
  });

  it("should show '없음' for no dependencies", () => {
    const task = makeTask({ dependencies: [] });
    const output = formatTaskDetail(task);
    const plain = output.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("없음");
  });

  it("should omit parentId if not set", () => {
    const task = makeTask({ parentId: undefined });
    const output = formatTaskDetail(task);
    const plain = output.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).not.toContain("상위 태스크");
  });
});
