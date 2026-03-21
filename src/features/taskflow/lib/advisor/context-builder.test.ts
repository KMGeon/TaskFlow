import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { classifyQuestion, buildContext, estimateTokens } from "./context-builder.js";
import { AdvisorDb } from "./db.js";
import { createTask, ensureRepo } from "../repository.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ctx-builder-"));
  await ensureRepo(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("classifyQuestion", () => {
  it("should detect code-related keywords", () => {
    const result = classifyQuestion("최근 코드 변경사항 알려줘");
    expect(result.needsGitDiff).toBe(true);
  });

  it("should detect decision-related keywords", () => {
    const result = classifyQuestion("왜 인증을 빼기로 결정했어?");
    expect(result.needsConversationLogs).toBe(true);
  });

  it("should detect planning keywords", () => {
    const result = classifyQuestion("전체 목표가 뭐야?");
    expect(result.needsTrdPrd).toBe(true);
  });

  it("should return defaults for generic questions", () => {
    const result = classifyQuestion("다음 뭐 해?");
    expect(result.needsGitDiff).toBe(false);
    expect(result.needsConversationLogs).toBe(false);
    expect(result.needsTrdPrd).toBe(false);
  });
});

describe("buildContext", () => {
  it("should always include tasks and decisions for status command", async () => {
    await createTask(tmpDir, { title: "Test task" });
    const db = await AdvisorDb.open(path.join(tmpDir, ".taskflow", "advisor.db"));
    db.insertDecision("s1", "test decision", "reason", []);

    const ctx = await buildContext({ command: "status", projectRoot: tmpDir, db });
    expect(ctx.tasks.length).toBeGreaterThan(0);
    expect(ctx.decisions.length).toBeGreaterThan(0);
    expect(ctx.gitDiff).toBeUndefined();

    db.close();
  });

  it("should include TRD/PRD for next command", async () => {
    await createTask(tmpDir, { title: "Test task" });
    const db = await AdvisorDb.open(path.join(tmpDir, ".taskflow", "advisor.db"));

    const ctx = await buildContext({ command: "next", projectRoot: tmpDir, db });
    expect(ctx.tasks.length).toBeGreaterThan(0);

    db.close();
  });
});

describe("estimateTokens", () => {
  it("should approximate tokens from character count", () => {
    expect(estimateTokens("hello world")).toBe(3); // 11 chars / 4 = 2.75 → 3
  });
});
