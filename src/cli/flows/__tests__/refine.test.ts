import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeDiff, analyzeDiffFromChanged, type DiffReport } from "../refine-diff.js";
import { parseImpactResponse, type ImpactResult } from "../refine-ai.js";
import { renderImpact } from "../refine-renderer.js";
import { buildPatchPlan, applyPlan, describePlan, restoreSnapshot, type PatchPlan } from "../refine-patcher.js";
import { classifyError, formatRefineError, type RefineError } from "../refine-errors.js";
import { buildRefineConfig, validateOptions, RefineValidationError } from "../refine-config.js";
import { createTask, ensureRepo, listTasks, readTask } from "@/features/taskflow/lib/repository";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "refine-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── T-022: Diff analysis tests ──

describe("refine-diff: analyzeDiff", () => {
  it("should detect added sections", () => {
    const base = `# Title\n\n## Section A\nContent A`;
    const changed = `# Title\n\n## Section A\nContent A\n\n## Section B\nNew content`;

    const result = analyzeDiff(base, changed);
    expect(result.sections.length).toBeGreaterThan(0);

    const added = result.sections.find((s) => s.changeType === "added");
    expect(added).toBeDefined();
    expect(added!.title).toBe("Section B");
  });

  it("should detect removed sections", () => {
    const base = `# Title\n\n## Section A\nContent A\n\n## Section B\nContent B`;
    const changed = `# Title\n\n## Section A\nContent A`;

    const result = analyzeDiff(base, changed);
    const removed = result.sections.find((s) => s.changeType === "removed");
    expect(removed).toBeDefined();
    expect(removed!.title).toBe("Section B");
  });

  it("should detect modified sections", () => {
    const base = `# Title\n\n## Section A\nOriginal content`;
    const changed = `# Title\n\n## Section A\nModified content that is different`;

    const result = analyzeDiff(base, changed);
    const modified = result.sections.find((s) => s.changeType === "modified");
    expect(modified).toBeDefined();
  });

  it("should compute line diff summary", () => {
    const base = `Line 1\nLine 2\nLine 3`;
    const changed = `Line 1\nLine 2 modified\nLine 3\nLine 4`;

    const result = analyzeDiff(base, changed);
    expect(result.lineDiffSummary.added).toBeGreaterThan(0);
  });

  it("should handle empty inputs gracefully", () => {
    const result = analyzeDiff("", "## New Section\nContent");
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("should handle plain text (non-markdown) input", () => {
    const base = "simple text";
    const changed = "different text";
    const result = analyzeDiff(base, changed);
    expect(result).toBeDefined();
    expect(result.lineDiffSummary).toBeDefined();
  });
});

describe("refine-diff: analyzeDiffFromChanged", () => {
  it("should treat everything as added when no base", () => {
    const result = analyzeDiffFromChanged("## New Feature\nDescription");
    expect(result.sections.every((s) => s.changeType === "added")).toBe(true);
  });

  it("should use provided base for comparison", () => {
    const base = "## Old\nOld content";
    const changed = "## Old\nNew content\n\n## Added\nNew section";
    const result = analyzeDiffFromChanged(changed, base);
    expect(result.sections.length).toBeGreaterThan(0);
  });
});

// ── T-023: AI response parsing tests ──

describe("refine-ai: parseImpactResponse", () => {
  it("should parse valid JSON response", () => {
    const raw = JSON.stringify({
      affectedTasks: [
        {
          id: "001",
          title: "Test task",
          changeType: "update",
          confidence: 0.85,
          rationale: "Related section changed",
          suggestions: ["Update implementation"],
        },
      ],
    });

    const result = parseImpactResponse(raw);
    expect(result.affectedTasks).toHaveLength(1);
    expect(result.affectedTasks[0].id).toBe("001");
    expect(result.affectedTasks[0].confidence).toBe(0.85);
  });

  it("should extract JSON from code blocks", () => {
    const raw = `Here is the analysis:\n\`\`\`json\n${JSON.stringify({
      affectedTasks: [
        { id: "002", title: "Task", changeType: "add", confidence: 0.7, rationale: "New", suggestions: [] },
      ],
    })}\n\`\`\``;

    const result = parseImpactResponse(raw);
    expect(result.affectedTasks).toHaveLength(1);
  });

  it("should recover partial valid items on schema violation", () => {
    const raw = JSON.stringify({
      affectedTasks: [
        { id: "001", title: "Valid", changeType: "update", confidence: 0.9, rationale: "OK", suggestions: ["fix"] },
        { id: "002", title: "Invalid", changeType: "invalid_type" }, // invalid
      ],
    });

    const result = parseImpactResponse(raw);
    expect(result.affectedTasks.length).toBeGreaterThanOrEqual(1);
    expect(result.affectedTasks[0].id).toBe("001");
  });

  it("should throw on completely invalid JSON", () => {
    expect(() => parseImpactResponse("not json at all")).toThrow();
  });

  it("should throw on empty response", () => {
    expect(() => parseImpactResponse("{}")).toThrow();
  });
});

// ── T-024: Renderer tests ──

describe("refine-renderer: renderImpact", () => {
  const sampleImpact: ImpactResult = {
    affectedTasks: [
      {
        id: "001",
        title: "Task one",
        changeType: "update",
        confidence: 0.9,
        rationale: "Section modified",
        suggestions: ["Update desc"],
      },
      {
        id: "002",
        title: "Task two",
        changeType: "add",
        confidence: 0.6,
        rationale: "New requirement",
        suggestions: ["Create task"],
      },
    ],
  };

  const sampleDiff: DiffReport = {
    sections: [],
    lineDiffSummary: { added: 10, removed: 5, unchanged: 50 },
  };

  it("should render table format", () => {
    const output = renderImpact(sampleImpact, "table", sampleDiff);
    expect(output).toContain("001");
    expect(output).toContain("002");
    expect(output).toContain("영향 분석 요약");
  });

  it("should render JSON format", () => {
    const output = renderImpact(sampleImpact, "json", sampleDiff);
    const parsed = JSON.parse(output);
    expect(parsed.affectedTasks).toHaveLength(2);
    expect(parsed.lineDiffSummary).toBeDefined();
    expect(parsed.generatedAt).toBeDefined();
  });

  it("should render markdown format", () => {
    const output = renderImpact(sampleImpact, "md", sampleDiff);
    expect(output).toContain("# 영향 분석 리포트");
    expect(output).toContain("| 001 |");
    expect(output).toContain("- [ ]");
  });

  it("should handle empty results", () => {
    const empty: ImpactResult = { affectedTasks: [] };
    const output = renderImpact(empty, "table");
    expect(output).toContain("영향받는 태스크가 없습니다");
  });
});

// ── T-025: Patcher tests ──

describe("refine-patcher: buildPatchPlan", () => {
  it("should create plan from impact result", () => {
    const impact: ImpactResult = {
      affectedTasks: [
        { id: "001", title: "T1", changeType: "update", confidence: 0.9, rationale: "r", suggestions: ["s"] },
        { id: "002", title: "T2", changeType: "add", confidence: 0.8, rationale: "r2", suggestions: ["s2"] },
      ],
    };

    const plan = buildPatchPlan(impact, tmpDir);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.affectedTaskIds).toContain("001");
    expect(plan.affectedTaskIds).toContain("002");
  });

  it("should include syncIndex as last step", () => {
    const impact: ImpactResult = {
      affectedTasks: [
        { id: "001", title: "T1", changeType: "update", confidence: 0.9, rationale: "r", suggestions: ["s"] },
      ],
    };
    const plan = buildPatchPlan(impact, tmpDir);
    const lastStep = plan.steps[plan.steps.length - 1];
    expect(lastStep.op).toBe("syncIndex");
  });
});

describe("refine-patcher: applyPlan", () => {
  it("should apply update patch to existing task", async () => {
    await ensureRepo(tmpDir);
    const task = await createTask(tmpDir, { title: "Original task", description: "Original desc" });

    const impact: ImpactResult = {
      affectedTasks: [
        {
          id: task.id,
          title: task.title,
          changeType: "update",
          confidence: 0.9,
          rationale: "PRD changed",
          suggestions: ["Update implementation"],
        },
      ],
    };

    const plan = buildPatchPlan(impact, tmpDir);
    const result = await applyPlan(plan, tmpDir, {
      backupDir: ".taskflow/backups",
      dryRun: false,
    });

    expect(result.success).toBe(true);
    expect(result.applied).toBeGreaterThan(0);

    // Verify task was updated
    const updated = await readTask(tmpDir, task.id);
    expect(updated!.description).toContain("변경 분석");
  });

  it("should not modify files in dry-run mode", async () => {
    await ensureRepo(tmpDir);
    const task = await createTask(tmpDir, { title: "Test", description: "Original" });

    const impact: ImpactResult = {
      affectedTasks: [
        { id: task.id, title: "Test", changeType: "update", confidence: 0.9, rationale: "r", suggestions: ["s"] },
      ],
    };

    const plan = buildPatchPlan(impact, tmpDir);
    await applyPlan(plan, tmpDir, { backupDir: ".taskflow/backups", dryRun: true });

    const unchanged = await readTask(tmpDir, task.id);
    expect(unchanged!.description).toBe("Original");
  });

  it("should create backup snapshot", async () => {
    await ensureRepo(tmpDir);
    const task = await createTask(tmpDir, { title: "Backup test", description: "desc" });

    const impact: ImpactResult = {
      affectedTasks: [
        { id: task.id, title: "Backup test", changeType: "update", confidence: 0.9, rationale: "r", suggestions: [] },
      ],
    };

    const plan = buildPatchPlan(impact, tmpDir);
    const result = await applyPlan(plan, tmpDir, { backupDir: ".taskflow/backups", dryRun: false });

    expect(result.snapshot).toBeDefined();
    expect(result.snapshot!.entries.length).toBeGreaterThan(0);
  });
});

describe("refine-patcher: describePlan", () => {
  it("should produce human-readable plan description", () => {
    const plan: PatchPlan = {
      steps: [
        { file: "", op: "updateFrontmatter", taskId: "001", data: {} },
        { file: "", op: "syncIndex", taskId: "", data: {} },
      ],
      affectedTaskIds: ["001"],
    };

    const desc = describePlan(plan);
    expect(desc).toContain("001");
    expect(desc).toContain("인덱스 동기화");
  });
});

// ── T-027: Error handling tests ──

describe("refine-errors: classifyError", () => {
  it("should classify input errors", () => {
    const err = new Error("파일을 읽을 수 없습니다: test.md");
    const classified = classifyError(err);
    expect(classified.code).toBe("Input");
    expect(classified.hint).toBeTruthy();
  });

  it("should classify AI errors", () => {
    const err = new Error("AI 응답이 비어있습니다.");
    const classified = classifyError(err);
    expect(classified.code).toBe("AI");
  });

  it("should classify parse errors", () => {
    const err = new Error("AI 응답이 유효한 JSON이 아닙니다");
    const classified = classifyError(err);
    expect(classified.code).toBe("Parse");
  });

  it("should classify IO errors", () => {
    const err = new Error("EACCES: permission denied");
    const classified = classifyError(err);
    expect(classified.code).toBe("IO");
  });

  it("should classify timeout errors", () => {
    const err = new Error("timeout exceeded");
    const classified = classifyError(err);
    expect(classified.code).toBe("Timeout");
  });

  it("should handle non-Error values", () => {
    const classified = classifyError("string error");
    expect(classified.code).toBe("Apply");
    expect(classified.message).toBe("string error");
  });
});

describe("refine-errors: formatRefineError", () => {
  it("should format error with hint", () => {
    const err: RefineError = {
      code: "Input",
      message: "test error",
      hint: "try this fix",
    };
    const output = formatRefineError(err);
    expect(output).toContain("Input");
    expect(output).toContain("test error");
    expect(output).toContain("try this fix");
  });

  it("should include stack trace in verbose mode", () => {
    const cause = new Error("cause");
    const err: RefineError = {
      code: "AI",
      message: "fail",
      hint: "hint",
      cause,
    };
    const output = formatRefineError(err, true);
    expect(output).toContain("Stack trace");
  });
});

// ── Config validation tests ──

describe("refine-config: validateOptions", () => {
  it("should reject --stdin with --base", () => {
    expect(() => validateOptions({ stdin: true, base: "file.md" })).toThrow(RefineValidationError);
  });

  it("should reject --apply with --interactive", () => {
    expect(() => validateOptions({ apply: true, interactive: true })).toThrow(RefineValidationError);
  });

  it("should reject --dry-run with --apply", () => {
    expect(() => validateOptions({ dryRun: true, apply: true })).toThrow(RefineValidationError);
  });

  it("should accept valid options", () => {
    expect(() => validateOptions({ base: "a.md", changed: "b.md" })).not.toThrow();
    expect(() => validateOptions({ stdin: true })).not.toThrow();
    expect(() => validateOptions({ apply: true })).not.toThrow();
  });
});

describe("refine-config: buildRefineConfig", () => {
  it("should apply defaults when no options given", async () => {
    const config = await buildRefineConfig({}, tmpDir);
    expect(config.format).toBe("table");
    expect(config.applyMode).toBe("preview");
    expect(config.logLevel).toBe("info");
    expect(config.timeoutMs).toBe(120_000);
  });

  it("should override defaults with CLI options", async () => {
    const config = await buildRefineConfig(
      { format: "json", apply: true, timeoutMs: 60000 },
      tmpDir,
    );
    expect(config.format).toBe("json");
    expect(config.applyMode).toBe("apply");
    expect(config.timeoutMs).toBe(60000);
  });
});

// ── Integration: diff → impact → render → patch pipeline ──

describe("refine pipeline integration", () => {
  it("should run full pipeline from diff to patch", async () => {
    await ensureRepo(tmpDir);

    // Create tasks
    await createTask(tmpDir, { title: "인증 시스템 구현", description: "사용자 인증" });
    await createTask(tmpDir, { title: "대시보드 UI", description: "칸반 보드" });

    // Simulate diff
    const base = `# PRD\n\n## 인증\n기본 로그인 구현`;
    const changed = `# PRD\n\n## 인증\nOAuth2.0 소셜 로그인 추가\n\n## 알림\n실시간 알림 시스템`;

    const diff = analyzeDiff(base, changed);
    expect(diff.sections.length).toBeGreaterThan(0);

    // Simulate AI response
    const mockImpact: ImpactResult = {
      affectedTasks: [
        {
          id: "001",
          title: "인증 시스템 구현",
          changeType: "update",
          confidence: 0.85,
          rationale: "인증 섹션이 OAuth2.0으로 변경됨",
          suggestions: ["OAuth2.0 지원 추가", "소셜 로그인 제공자 설정 구현"],
        },
      ],
    };

    // Render
    const tableOutput = renderImpact(mockImpact, "table", diff);
    expect(tableOutput).toContain("001");

    const jsonOutput = renderImpact(mockImpact, "json", diff);
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.affectedTasks).toHaveLength(1);

    const mdOutput = renderImpact(mockImpact, "md", diff);
    expect(mdOutput).toContain("# 영향 분석 리포트");
  });
});
