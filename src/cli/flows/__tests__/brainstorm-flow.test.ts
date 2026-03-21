import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  validateBrainstormResponse,
  extractJson,
  runBrainstormFlow,
  runExpandFlow,
} from "../brainstorm-flow";
import { saveBrainstormLog, loadLatestBrainstormLog } from "../brainstorm-log";
import { createTask, readTask, listTasks, ensureRepo } from "@/features/taskflow/lib/repository";
import type { BrainstormResponse } from "../brainstorm-schema";
import type { Task } from "@/features/taskflow/types";

const MOCK_RESPONSE: BrainstormResponse = {
  subtasks: [
    { tempId: "sub-1", title: "DB 스키마 설계", description: "ERD 작성", priority: 8, dependencies: [], estimate: "2h" },
    { tempId: "sub-2", title: "마이그레이션 작성", description: "SQL 생성", priority: 7, dependencies: ["sub-1"], estimate: "1h" },
    { tempId: "sub-3", title: "CRUD API 구현", description: "Hono 라우트", priority: 6, dependencies: ["sub-2"], estimate: "3h" },
  ],
  rationale: "DB 레이어부터 구현해야 API가 가능합니다",
};

// ── extractJson / validateBrainstormResponse ──

describe("extractJson", () => {
  it("should extract from code block", () => {
    const raw = '```json\n{"subtasks":[{"tempId":"s1","title":"T"}]}\n```';
    expect(extractJson(raw)).toBe('{"subtasks":[{"tempId":"s1","title":"T"}]}');
  });

  it("should extract raw JSON", () => {
    const raw = '{"subtasks":[{"tempId":"s1","title":"T"}]}';
    expect(extractJson(raw)).toBe(raw);
  });
});

describe("validateBrainstormResponse", () => {
  it("should parse valid response", () => {
    const json = JSON.stringify(MOCK_RESPONSE);
    const result = validateBrainstormResponse(json);
    expect(result.subtasks).toHaveLength(3);
    expect(result.rationale).toContain("DB");
  });

  it("should throw for invalid JSON", () => {
    expect(() => validateBrainstormResponse("not json")).toThrow("유효한 JSON이 아닙니다");
  });

  it("should throw for schema violation", () => {
    const bad = JSON.stringify({ subtasks: [{ title: "no tempId" }] });
    expect(() => validateBrainstormResponse(bad)).toThrow("스키마를 위반합니다");
  });
});

// ── Log save/load ──

describe("brainstorm log", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "brainstorm-log-"));
    await ensureRepo(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should save and load log", async () => {
    const log = {
      parentTaskId: "001",
      parentTaskTitle: "Test task",
      createdAt: "2026-03-21T00:00:00.000Z",
      response: MOCK_RESPONSE,
    };

    const savedPath = await saveBrainstormLog(tmpDir, log);
    expect(savedPath).toContain("brainstorm-001-");

    const loaded = await loadLatestBrainstormLog(tmpDir, "001");
    expect(loaded).not.toBeNull();
    expect(loaded!.parentTaskId).toBe("001");
    expect(loaded!.response.subtasks).toHaveLength(3);
  });

  it("should return null for missing log", async () => {
    const loaded = await loadLatestBrainstormLog(tmpDir, "999");
    expect(loaded).toBeNull();
  });
});

// ── runBrainstormFlow (mocked AI) ──

describe("runBrainstormFlow", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "brainstorm-flow-"));
    await ensureRepo(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should brainstorm and save log", async () => {
    const parent = await createTask(tmpDir, { title: "Parent task", priority: 5 });

    const response = await runBrainstormFlow(parent.id, {
      outDir: tmpDir,
      aiBrainstormer: async () => MOCK_RESPONSE,
    });

    expect(response.subtasks).toHaveLength(3);

    // Log should be saved
    const log = await loadLatestBrainstormLog(tmpDir, parent.id);
    expect(log).not.toBeNull();
    expect(log!.parentTaskTitle).toBe("Parent task");
  });

  it("should throw for non-existent task", async () => {
    await expect(
      runBrainstormFlow("999", {
        outDir: tmpDir,
        aiBrainstormer: async () => MOCK_RESPONSE,
      }),
    ).rejects.toThrow("태스크를 찾을 수 없습니다");
  });
});

// ── runExpandFlow ──

describe("runExpandFlow", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "expand-flow-"));
    await ensureRepo(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should return empty without --apply (preview)", async () => {
    const parent = await createTask(tmpDir, { title: "Parent" });
    await saveBrainstormLog(tmpDir, {
      parentTaskId: parent.id,
      parentTaskTitle: parent.title,
      createdAt: new Date().toISOString(),
      response: MOCK_RESPONSE,
    });

    const tasks = await runExpandFlow(parent.id, { outDir: tmpDir });
    expect(tasks).toHaveLength(0);
  });

  it("should create subtasks with --apply", async () => {
    const parent = await createTask(tmpDir, { title: "Parent" });
    await saveBrainstormLog(tmpDir, {
      parentTaskId: parent.id,
      parentTaskTitle: parent.title,
      createdAt: new Date().toISOString(),
      response: MOCK_RESPONSE,
    });

    const created = await runExpandFlow(parent.id, { outDir: tmpDir, apply: true });

    expect(created).toHaveLength(3);

    // All subtasks should have parentId set
    for (const task of created) {
      expect(task.parentId).toBe(parent.id);
    }
  });

  it("should resolve tempId dependencies to real IDs", async () => {
    const parent = await createTask(tmpDir, { title: "Parent" });
    await saveBrainstormLog(tmpDir, {
      parentTaskId: parent.id,
      parentTaskTitle: parent.title,
      createdAt: new Date().toISOString(),
      response: MOCK_RESPONSE,
    });

    const created = await runExpandFlow(parent.id, { outDir: tmpDir, apply: true });

    // sub-2 depends on sub-1, which should now be a real ID
    const migrationTask = created.find((t) => t.title === "마이그레이션 작성");
    expect(migrationTask).toBeDefined();
    expect(migrationTask!.dependencies.length).toBe(1);
    // Real ID should be a numeric string, not "sub-1"
    expect(migrationTask!.dependencies[0]).toMatch(/^\d{3}$/);
  });

  it("should update TASKS.md index", async () => {
    const parent = await createTask(tmpDir, { title: "Parent" });
    await saveBrainstormLog(tmpDir, {
      parentTaskId: parent.id,
      parentTaskTitle: parent.title,
      createdAt: new Date().toISOString(),
      response: MOCK_RESPONSE,
    });

    await runExpandFlow(parent.id, { outDir: tmpDir, apply: true });

    const indexPath = path.join(tmpDir, ".taskflow", "index", "TASKS.md");
    const content = await fs.readFile(indexPath, "utf-8");
    expect(content).toContain("DB 스키마 설계");
    expect(content).toContain("마이그레이션 작성");
    expect(content).toContain("CRUD API 구현");
  });

  it("should throw if no brainstorm log exists", async () => {
    const parent = await createTask(tmpDir, { title: "No log" });

    await expect(
      runExpandFlow(parent.id, { outDir: tmpDir, apply: true }),
    ).rejects.toThrow("브레인스톰 로그가 없습니다");
  });

  it("should sort subtasks by priority (desc) before creation", async () => {
    const parent = await createTask(tmpDir, { title: "Parent" });
    await saveBrainstormLog(tmpDir, {
      parentTaskId: parent.id,
      parentTaskTitle: parent.title,
      createdAt: new Date().toISOString(),
      response: MOCK_RESPONSE,
    });

    const created = await runExpandFlow(parent.id, { outDir: tmpDir, apply: true });

    // Created order should be by priority desc: 8, 7, 6
    expect(created[0].priority).toBe(8);
    expect(created[1].priority).toBe(7);
    expect(created[2].priority).toBe(6);
  });
});
