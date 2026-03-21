import { describe, it, expect } from "vitest";
import { parseTask, serializeTask } from "../serializer";
import type { Task } from "../../types";

const SAMPLE_TASK: Task = {
  id: "001",
  title: "Setup project",
  status: "Todo",
  priority: 3,
  dependencies: [],
  createdAt: "2026-03-21T00:00:00.000Z",
  updatedAt: "2026-03-21T00:00:00.000Z",
  description: "Initialize the project structure.",
};

const SAMPLE_MD = `---
id: "001"
title: Setup project
status: Todo
priority: 3
createdAt: "2026-03-21T00:00:00.000Z"
updatedAt: "2026-03-21T00:00:00.000Z"
---
Initialize the project structure.
`;

describe("serializeTask", () => {
  it("should produce valid frontmatter markdown", () => {
    const output = serializeTask(SAMPLE_TASK);

    expect(output).toContain("id:");
    expect(output).toContain("001");
    expect(output).toContain("title: Setup project");
    expect(output).toContain("status: Todo");
    expect(output).toContain("priority: 3");
    expect(output).toContain("Initialize the project structure.");
  });

  it("should include dependencies when present", () => {
    const task = { ...SAMPLE_TASK, dependencies: ["002", "003"] };
    const output = serializeTask(task);

    expect(output).toContain("dependencies:");
    expect(output).toContain("002");
    expect(output).toContain("003");
  });

  it("should omit dependencies when empty", () => {
    const output = serializeTask(SAMPLE_TASK);
    expect(output).not.toContain("dependencies:");
  });

  it("should include parentId when present", () => {
    const task = { ...SAMPLE_TASK, parentId: "000" };
    const output = serializeTask(task);
    expect(output).toContain("parentId:");
    expect(output).toContain("000");
  });
});

describe("parseTask", () => {
  it("should parse frontmatter and body", () => {
    const task = parseTask(SAMPLE_MD);

    expect(task.id).toBe("001");
    expect(task.title).toBe("Setup project");
    expect(task.status).toBe("Todo");
    expect(task.priority).toBe(3);
    expect(task.description).toBe("Initialize the project structure.");
  });

  it("should default status to Todo for invalid values", () => {
    const md = SAMPLE_MD.replace("status: Todo", "status: InvalidStatus");
    const task = parseTask(md);
    expect(task.status).toBe("Todo");
  });

  it("should default empty dependencies", () => {
    const task = parseTask(SAMPLE_MD);
    expect(task.dependencies).toEqual([]);
  });

  it("should throw for missing required fields", () => {
    const md = `---\ntitle: Test\n---\nBody`;
    expect(() => parseTask(md)).toThrow("missing required fields");
  });

  it("should roundtrip serialize/parse", () => {
    const serialized = serializeTask(SAMPLE_TASK);
    const parsed = parseTask(serialized);

    expect(parsed.id).toBe(SAMPLE_TASK.id);
    expect(parsed.title).toBe(SAMPLE_TASK.title);
    expect(parsed.status).toBe(SAMPLE_TASK.status);
    expect(parsed.priority).toBe(SAMPLE_TASK.priority);
    expect(parsed.description).toBe(SAMPLE_TASK.description);
  });
});
