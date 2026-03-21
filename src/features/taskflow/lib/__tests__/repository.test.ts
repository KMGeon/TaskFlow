import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ensureRepo,
  createTask,
  readTask,
  listTasks,
  updateTask,
  deleteTask,
  searchTasks,
} from "../repository";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "taskflow-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("ensureRepo", () => {
  it("should create all required directories", async () => {
    await ensureRepo(tmpDir);

    const dirs = ["tasks", "index", "logs", "cache"];
    for (const dir of dirs) {
      const stat = await fs.stat(path.join(tmpDir, ".taskflow", dir));
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it("should be idempotent", async () => {
    await ensureRepo(tmpDir);
    await ensureRepo(tmpDir);

    const stat = await fs.stat(path.join(tmpDir, ".taskflow", "tasks"));
    expect(stat.isDirectory()).toBe(true);
  });
});

describe("createTask", () => {
  it("should create a task file and return the task", async () => {
    const task = await createTask(tmpDir, { title: "First task" });

    expect(task.id).toBe("001");
    expect(task.title).toBe("First task");
    expect(task.status).toBe("Todo");
    expect(task.priority).toBe(0);
  });

  it("should auto-increment IDs", async () => {
    const t1 = await createTask(tmpDir, { title: "Task 1" });
    const t2 = await createTask(tmpDir, { title: "Task 2" });

    expect(t1.id).toBe("001");
    expect(t2.id).toBe("002");
  });

  it("should rebuild TASKS.md index", async () => {
    await createTask(tmpDir, { title: "Indexed task" });

    const indexPath = path.join(tmpDir, ".taskflow", "index", "TASKS.md");
    const content = await fs.readFile(indexPath, "utf-8");

    expect(content).toContain("Indexed task");
    expect(content).toContain("001");
  });
});

describe("readTask", () => {
  it("should read an existing task", async () => {
    const created = await createTask(tmpDir, {
      title: "Read me",
      description: "Some description",
    });
    const task = await readTask(tmpDir, created.id);

    expect(task).not.toBeNull();
    expect(task!.title).toBe("Read me");
    expect(task!.description).toBe("Some description");
  });

  it("should return null for non-existent task", async () => {
    await ensureRepo(tmpDir);
    const task = await readTask(tmpDir, "999");
    expect(task).toBeNull();
  });
});

describe("updateTask", () => {
  it("should update task fields", async () => {
    const created = await createTask(tmpDir, { title: "Original" });
    const updated = await updateTask(tmpDir, created.id, {
      title: "Updated",
      status: "InProgress",
    });

    expect(updated.title).toBe("Updated");
    expect(updated.status).toBe("InProgress");
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  it("should throw for non-existent task", async () => {
    await ensureRepo(tmpDir);
    await expect(
      updateTask(tmpDir, "999", { title: "Nope" }),
    ).rejects.toThrow("Task not found");
  });

  it("should preserve createdAt on update", async () => {
    const created = await createTask(tmpDir, { title: "Keep date" });
    const updated = await updateTask(tmpDir, created.id, { status: "Done" });

    expect(updated.createdAt).toBe(created.createdAt);
  });
});

describe("deleteTask", () => {
  it("should remove the task file", async () => {
    const created = await createTask(tmpDir, { title: "Delete me" });
    const result = await deleteTask(tmpDir, created.id);

    expect(result).toBe(true);
    expect(await readTask(tmpDir, created.id)).toBeNull();
  });

  it("should return false for non-existent task", async () => {
    await ensureRepo(tmpDir);
    const result = await deleteTask(tmpDir, "999");
    expect(result).toBe(false);
  });

  it("should update index after deletion", async () => {
    await createTask(tmpDir, { title: "Task A" });
    const taskB = await createTask(tmpDir, { title: "Task B" });
    await deleteTask(tmpDir, taskB.id);

    const indexPath = path.join(tmpDir, ".taskflow", "index", "TASKS.md");
    const content = await fs.readFile(indexPath, "utf-8");

    expect(content).toContain("Task A");
    expect(content).not.toContain("Task B");
  });
});

describe("listTasks", () => {
  it("should list all tasks", async () => {
    await createTask(tmpDir, { title: "A" });
    await createTask(tmpDir, { title: "B" });
    await createTask(tmpDir, { title: "C" });

    const tasks = await listTasks(tmpDir);
    expect(tasks).toHaveLength(3);
  });

  it("should filter by status", async () => {
    await createTask(tmpDir, { title: "Todo task", status: "Todo" });
    await createTask(tmpDir, { title: "Done task", status: "Done" });

    const todoTasks = await listTasks(tmpDir, {
      filter: { status: "Todo" },
    });
    expect(todoTasks).toHaveLength(1);
    expect(todoTasks[0].title).toBe("Todo task");
  });

  it("should sort by priority descending", async () => {
    await createTask(tmpDir, { title: "Low", priority: 1 });
    await createTask(tmpDir, { title: "High", priority: 5 });
    await createTask(tmpDir, { title: "Mid", priority: 3 });

    const tasks = await listTasks(tmpDir, {
      sortKey: "priority",
      sortOrder: "desc",
    });

    expect(tasks[0].title).toBe("High");
    expect(tasks[1].title).toBe("Mid");
    expect(tasks[2].title).toBe("Low");
  });
});

describe("searchTasks", () => {
  it("should search by title", async () => {
    await createTask(tmpDir, { title: "Setup database" });
    await createTask(tmpDir, { title: "Write tests" });

    const results = await searchTasks(tmpDir, "database");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Setup database");
  });

  it("should search by description", async () => {
    await createTask(tmpDir, {
      title: "Task",
      description: "Configure PostgreSQL connection",
    });

    const results = await searchTasks(tmpDir, "postgresql");
    expect(results).toHaveLength(1);
  });

  it("should be case-insensitive", async () => {
    await createTask(tmpDir, { title: "UPPERCASE TASK" });

    const results = await searchTasks(tmpDir, "uppercase");
    expect(results).toHaveLength(1);
  });
});

describe("atomic write integrity", () => {
  it("should handle sequential writes without corruption", async () => {
    await ensureRepo(tmpDir);

    for (let i = 0; i < 10; i++) {
      await createTask(tmpDir, { title: `Sequential task ${i}`, priority: i });
    }

    const allTasks = await listTasks(tmpDir);
    expect(allTasks).toHaveLength(10);

    for (const task of allTasks) {
      const read = await readTask(tmpDir, task.id);
      expect(read).not.toBeNull();
      expect(read!.title).toBe(task.title);
    }
  });
});
