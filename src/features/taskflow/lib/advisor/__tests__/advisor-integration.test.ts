import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdvisorDb } from "../db.js";
import { buildLocalSummary, formatStatusOutput } from "../local-summary.js";
import { buildContext, classifyQuestion } from "../context-builder.js";
import { createTask, ensureRepo, listTasks } from "../../repository.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "advisor-integ-"));
  await ensureRepo(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("Advisor Integration", () => {
  it("should build local summary from real tasks", async () => {
    await createTask(tmpDir, { title: "Task 1", status: "Done" });
    await createTask(tmpDir, { title: "Task 2", status: "Todo" });
    await createTask(tmpDir, { title: "Task 3", status: "InProgress" });

    const tasks = await listTasks(tmpDir);
    const summary = buildLocalSummary(tasks);

    expect(summary.total).toBe(3);
    expect(summary.done).toBe(1);
    expect(summary.progressPercent).toBe(33);
  });

  it("should build context with DB decisions", async () => {
    await createTask(tmpDir, { title: "Test Task" });

    const dbPath = path.join(tmpDir, ".taskflow", "advisor.db");
    const db = await AdvisorDb.open(dbPath);
    db.insertDecision("s1", "Test decision", "Test reason", ["1"]);

    const context = await buildContext({
      command: "status",
      projectRoot: tmpDir,
      db,
    });

    expect(context.tasks.length).toBe(1);
    expect(context.decisions.length).toBe(1);
    expect(context.decisions[0].decision).toBe("Test decision");

    db.close();
  });

  it("should persist DB, reload, and retain data", async () => {
    const dbPath = path.join(tmpDir, ".taskflow", "advisor.db");

    const db1 = await AdvisorDb.open(dbPath);
    db1.insertLog("ask", "s1", "user", "테스트 질문");
    db1.insertDecision("s1", "테스트 결정", "이유", []);
    await db1.persistToDisk();
    db1.close();

    const db2 = await AdvisorDb.open(dbPath);
    expect(db2.getLogsBySession("s1")).toHaveLength(1);
    expect(db2.getAllDecisions()).toHaveLength(1);
    db2.close();
  });

  it("should format status output correctly", async () => {
    await createTask(tmpDir, { title: "Done task", status: "Done" });
    await createTask(tmpDir, { title: "Todo task", status: "Todo" });

    const tasks = await listTasks(tmpDir);
    const summary = buildLocalSummary(tasks);
    const output = formatStatusOutput(summary);

    expect(output).toContain("1/2");
    expect(output).toContain("50%");
  });

  it("should classify questions correctly in context building", async () => {
    await createTask(tmpDir, { title: "Test" });
    const dbPath = path.join(tmpDir, ".taskflow", "advisor.db");
    const db = await AdvisorDb.open(dbPath);

    const ctx = await buildContext({
      command: "ask",
      projectRoot: tmpDir,
      db,
      question: "최근 코드 변경 뭐 있어?",
    });

    expect(ctx.tasks.length).toBe(1);

    db.close();
  });
});
