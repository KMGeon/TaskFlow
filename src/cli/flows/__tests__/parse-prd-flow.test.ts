import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  extractJson,
  validateAiResponse,
  toCreateInputs,
  runParsePrdFlow,
  readPrdInput,
} from "../parse-prd-flow";
import { listTasks, ensureRepo, createTask } from "@/features/taskflow/lib/repository";
import type { TaskItem } from "../parse-prd-schema";

// ── extractJson ──

describe("extractJson", () => {
  it("should extract JSON from code block", () => {
    const raw = '```json\n{"tasks":[{"title":"A"}]}\n```';
    expect(extractJson(raw)).toBe('{"tasks":[{"title":"A"}]}');
  });

  it("should extract JSON from plain code block", () => {
    const raw = '```\n{"tasks":[{"title":"A"}]}\n```';
    expect(extractJson(raw)).toBe('{"tasks":[{"title":"A"}]}');
  });

  it("should extract raw JSON object", () => {
    const raw = 'Here is the result:\n{"tasks":[{"title":"A"}]}';
    expect(extractJson(raw)).toBe('{"tasks":[{"title":"A"}]}');
  });

  it("should handle clean JSON", () => {
    const raw = '{"tasks":[{"title":"A"}]}';
    expect(extractJson(raw)).toBe('{"tasks":[{"title":"A"}]}');
  });
});

// ── validateAiResponse ──

describe("validateAiResponse", () => {
  const VALID_RESPONSE = JSON.stringify({
    tasks: [
      { title: "Setup project", description: "Init", priority: 8 },
      { title: "Add tests", description: "Unit tests", priority: 5 },
    ],
  });

  it("should parse valid JSON response", () => {
    const tasks = validateAiResponse(VALID_RESPONSE);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe("Setup project");
    expect(tasks[0].priority).toBe(8);
  });

  it("should parse JSON wrapped in code block", () => {
    const tasks = validateAiResponse(`\`\`\`json\n${VALID_RESPONSE}\n\`\`\``);
    expect(tasks).toHaveLength(2);
  });

  it("should throw for invalid JSON", () => {
    expect(() => validateAiResponse("not json at all")).toThrow(
      "유효한 JSON이 아닙니다",
    );
  });

  it("should throw for schema violation", () => {
    const invalid = JSON.stringify({ tasks: [{ description: "no title" }] });
    expect(() => validateAiResponse(invalid)).toThrow("스키마를 위반합니다");
  });

  it("should throw for empty tasks", () => {
    const empty = JSON.stringify({ tasks: [] });
    expect(() => validateAiResponse(empty)).toThrow("스키마를 위반합니다");
  });

  it("should apply defaults for minimal tasks", () => {
    const minimal = JSON.stringify({ tasks: [{ title: "Minimal" }] });
    const tasks = validateAiResponse(minimal);

    expect(tasks[0].priority).toBe(5);
    expect(tasks[0].status).toBe("Todo");
    expect(tasks[0].dependencies).toEqual([]);
  });
});

// ── toCreateInputs ──

describe("toCreateInputs", () => {
  it("should convert TaskItems to TaskCreateInputs", () => {
    const items: TaskItem[] = [
      { title: "A", description: "Desc A", priority: 8, dependencies: ["B"], status: "Todo" },
      { title: "B", description: "Desc B", priority: 5, dependencies: [], status: "Todo" },
    ];

    const inputs = toCreateInputs(items);

    expect(inputs).toHaveLength(2);
    expect(inputs[0].title).toBe("A");
    expect(inputs[0].dependencies).toEqual(["B"]);
  });
});

// ── readPrdInput ──

describe("readPrdInput", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "parse-prd-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should read a file", async () => {
    const filePath = path.join(tmpDir, "test.md");
    await fs.writeFile(filePath, "# PRD Content\nSome text", "utf-8");

    const content = await readPrdInput(filePath);
    expect(content).toContain("PRD Content");
  });

  it("should throw for empty file", async () => {
    const filePath = path.join(tmpDir, "empty.md");
    await fs.writeFile(filePath, "", "utf-8");

    await expect(readPrdInput(filePath)).rejects.toThrow("비어있습니다");
  });

  it("should throw for non-existent file", async () => {
    await expect(readPrdInput("/non/existent/path.md")).rejects.toThrow();
  });
});

// ── Mock AI Parser ──

const MOCK_TASKS: TaskItem[] = [
  { title: "프로젝트 초기 설정", description: "Next.js 프로젝트 생성", priority: 9, dependencies: [], status: "Todo" },
  { title: "인증 시스템 구현", description: "OAuth2 로그인", priority: 7, dependencies: ["프로젝트 초기 설정"], status: "Todo" },
  { title: "대시보드 UI", description: "칸반 보드 구현", priority: 6, dependencies: [], status: "Todo" },
];

function createMockAiParser(tasks: TaskItem[] = MOCK_TASKS) {
  return async (_prdContent: string) => tasks;
}

// ── 통합 테스트 ──

describe("runParsePrdFlow (mocked AI)", () => {
  let tmpDir: string;
  let tmpPrd: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "parse-prd-integ-"));
    tmpPrd = path.join(tmpDir, "prd.md");
    await fs.writeFile(tmpPrd, "# Test PRD\n\nSome requirements here.", "utf-8");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create tasks from mocked AI response (dry-run)", async () => {
    const tasks = await runParsePrdFlow(tmpPrd, {
      dryRun: true,
      outDir: tmpDir,
      aiParser: createMockAiParser(),
    });

    expect(tasks).toHaveLength(3);
    expect(tasks[0].title).toBe("프로젝트 초기 설정");
    expect(tasks[1].priority).toBe(7);
  });

  it("should create task files from mocked AI response", async () => {
    const tasks = await runParsePrdFlow(tmpPrd, {
      outDir: tmpDir,
      aiParser: createMockAiParser(),
    });

    expect(tasks).toHaveLength(3);

    const savedTasks = await listTasks(tmpDir);
    expect(savedTasks).toHaveLength(3);

    const indexPath = path.join(tmpDir, ".taskflow", "index", "TASKS.md");
    const indexContent = await fs.readFile(indexPath, "utf-8");
    expect(indexContent).toContain("프로젝트 초기 설정");
    expect(indexContent).toContain("인증 시스템 구현");
  });

  it("should skip duplicates without --merge", async () => {
    // 첫 번째 실행: 태스크 생성
    await runParsePrdFlow(tmpPrd, {
      outDir: tmpDir,
      aiParser: createMockAiParser(),
    });

    // 두 번째 실행: 중복 감지
    const tasks2 = await runParsePrdFlow(tmpPrd, {
      outDir: tmpDir,
      aiParser: createMockAiParser(),
    });

    expect(tasks2).toHaveLength(0);
  });

  it("should force create with --merge", async () => {
    await runParsePrdFlow(tmpPrd, {
      outDir: tmpDir,
      aiParser: createMockAiParser(),
    });

    const tasks2 = await runParsePrdFlow(tmpPrd, {
      outDir: tmpDir,
      merge: true,
      aiParser: createMockAiParser(),
    });

    expect(tasks2).toHaveLength(3);
    const allTasks = await listTasks(tmpDir);
    expect(allTasks).toHaveLength(6);
  });

  it("should resolve dependency titles to IDs", async () => {
    const tasks = await runParsePrdFlow(tmpPrd, {
      outDir: tmpDir,
      aiParser: createMockAiParser(),
    });

    const authTask = tasks.find((t) => t.title === "인증 시스템 구현");
    expect(authTask).toBeDefined();
    // dependency should be resolved from title to ID
    expect(authTask!.dependencies[0]).toMatch(/^\d{3}$/);
  });

  it("should rollback on partial failure", async () => {
    await ensureRepo(tmpDir);

    let callCount = 0;
    const failingParser = async (_prd: string): Promise<TaskItem[]> => MOCK_TASKS;

    // Mock createTask to fail on second call
    const repoModule = await import("@/features/taskflow/lib/repository");
    const originalCreate = repoModule.createTask;
    vi.spyOn(repoModule, "createTask").mockImplementation(async (root, input) => {
      callCount++;
      if (callCount === 2) {
        throw new Error("Simulated write failure");
      }
      return originalCreate(root, input);
    });

    await expect(
      runParsePrdFlow(tmpPrd, {
        outDir: tmpDir,
        aiParser: failingParser,
      }),
    ).rejects.toThrow("Simulated write failure");

    // 롤백 확인: 생성된 1개 태스크가 삭제되어야 함
    const remaining = await listTasks(tmpDir);
    expect(remaining).toHaveLength(0);

    vi.restoreAllMocks();
  });
});
