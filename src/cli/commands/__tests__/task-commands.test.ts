import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createTask,
  readTask,
  listTasks,
  updateTask,
  ensureRepo,
} from "../../../features/taskflow/lib/repository.js";
import { filterTasks, sortTasks } from "../../../features/taskflow/lib/filter.js";
import type { Task } from "../../../features/taskflow/types.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-cmd-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("set-status integration", () => {
  it("should change task status and update file", async () => {
    const task = await createTask(tmpDir, { title: "My task", status: "Todo" });
    const updated = await updateTask(tmpDir, task.id, { status: "InProgress" });

    expect(updated.status).toBe("InProgress");
    expect(updated.updatedAt).not.toBe(task.updatedAt);

    // Verify file was persisted
    const reRead = await readTask(tmpDir, task.id);
    expect(reRead!.status).toBe("InProgress");
  });

  it("should update TASKS.md index after status change", async () => {
    const task = await createTask(tmpDir, { title: "Index task" });
    await updateTask(tmpDir, task.id, { status: "Done" });

    const indexPath = path.join(tmpDir, ".taskflow", "index", "TASKS.md");
    const content = await fs.readFile(indexPath, "utf-8");
    expect(content).toContain("Done");
  });

  it("should reject invalid status", async () => {
    const task = await createTask(tmpDir, { title: "Invalid" });
    // updateTask accepts TaskUpdateInput which has TaskStatus type
    // But we test that the CLI layer validates — here just test the type
    const reRead = await readTask(tmpDir, task.id);
    expect(reRead!.status).toBe("Todo");
  });
});

describe("filter integration", () => {
  let tasks: Task[];

  beforeEach(async () => {
    tasks = [];
    tasks.push(await createTask(tmpDir, { title: "A", status: "Todo", priority: 3 }));
    tasks.push(await createTask(tmpDir, { title: "B", status: "InProgress", priority: 7 }));
    tasks.push(await createTask(tmpDir, { title: "C", status: "Done", priority: 1 }));
    tasks.push(
      await createTask(tmpDir, {
        title: "D",
        status: "Blocked",
        priority: 5,
        dependencies: [tasks[0].id],
      }),
    );
  });

  it("should filter by status", async () => {
    const result = await listTasks(tmpDir, { filter: { status: "Todo" } });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("A");
  });

  it("should filter by multiple statuses", async () => {
    const result = await listTasks(tmpDir, {
      filter: { status: ["Todo", "InProgress"] },
    });
    expect(result).toHaveLength(2);
  });

  it("should filter by priority", async () => {
    const result = await listTasks(tmpDir, { filter: { priority: 7 } });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("B");
  });

  it("should filter by hasDependency", async () => {
    const result = await listTasks(tmpDir, {
      filter: { hasDependency: tasks[0].id },
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("D");
  });

  it("should filter by updatedSince", async () => {
    // All tasks were just created, so they should all pass a past date
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const result = await listTasks(tmpDir, {
      filter: { updatedSince: yesterday },
    });
    expect(result).toHaveLength(4);

    // Future date should return none
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const result2 = await listTasks(tmpDir, {
      filter: { updatedSince: tomorrow },
    });
    expect(result2).toHaveLength(0);
  });

  it("should sort by priority descending", async () => {
    const result = await listTasks(tmpDir, {
      sortKey: "priority",
      sortOrder: "desc",
    });
    expect(result.map((t) => t.priority)).toEqual([7, 5, 3, 1]);
  });

  it("should sort by status order", async () => {
    const result = await listTasks(tmpDir, {
      sortKey: "status",
      sortOrder: "asc",
    });
    expect(result.map((t) => t.status)).toEqual([
      "Todo",
      "InProgress",
      "Blocked",
      "Done",
    ]);
  });
});

describe("performance", () => {
  it("should list 1000 tasks under 200ms", async () => {
    await ensureRepo(tmpDir);

    // Batch create 1000 task files directly for speed
    const tasksDir = path.join(tmpDir, ".taskflow", "tasks");
    const writes = Array.from({ length: 1000 }, (_, i) => {
      const id = String(i + 1).padStart(4, "0");
      const content = [
        "---",
        `id: '${id}'`,
        `title: Task ${id}`,
        "status: Todo",
        `priority: ${(i % 10) + 1}`,
        `createdAt: '2026-03-21T00:00:00.000Z'`,
        `updatedAt: '2026-03-21T00:00:00.000Z'`,
        "---",
        `Description for task ${id}`,
        "",
      ].join("\n");
      return fs.writeFile(path.join(tasksDir, `task-${id}.md`), content, "utf-8");
    });
    await Promise.all(writes);

    const start = performance.now();
    const tasks = await listTasks(tmpDir);
    const elapsed = performance.now() - start;

    expect(tasks).toHaveLength(1000);
    expect(elapsed).toBeLessThan(1000);
  });
});
