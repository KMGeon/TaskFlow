import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runRefineFlow } from "../refine-flow";
import { ensureRepo } from "@/features/taskflow/lib/repository";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "refine-flow-"));
  await ensureRepo(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("runRefineFlow", () => {
  it("should print usage guide when no input provided", async () => {
    const result = await runRefineFlow({}, tmpDir);
    expect(result.config.applyMode).toBe("preview");
    expect(result.input.source).toBe("file");
  });

  it("should load file input with --base and --changed", async () => {
    const basePath = path.join(tmpDir, "base.md");
    const changedPath = path.join(tmpDir, "changed.md");
    await fs.writeFile(basePath, "# Base\nOld content", "utf-8");
    await fs.writeFile(changedPath, "# Changed\nNew content", "utf-8");

    const result = await runRefineFlow(
      { base: basePath, changed: changedPath },
      tmpDir,
    );

    expect(result.input.source).toBe("file");
    expect(result.input.base).toContain("Old content");
    expect(result.input.changed).toContain("New content");
  });

  it("should respect --format option", async () => {
    const result = await runRefineFlow({ format: "json" }, tmpDir);
    expect(result.config.format).toBe("json");
  });

  it("should set apply mode correctly", async () => {
    const preview = await runRefineFlow({}, tmpDir);
    expect(preview.config.applyMode).toBe("preview");

    const changedPath = path.join(tmpDir, "c.md");
    await fs.writeFile(changedPath, "content", "utf-8");

    const apply = await runRefineFlow({ changed: changedPath, apply: true }, tmpDir);
    expect(apply.config.applyMode).toBe("apply");

    const dryRun = await runRefineFlow({ changed: changedPath, dryRun: true }, tmpDir);
    expect(dryRun.config.applyMode).toBe("dry-run");
  });

  it("should throw for missing file", async () => {
    await expect(
      runRefineFlow({ base: "/nonexistent/file.md" }, tmpDir),
    ).rejects.toThrow("읽을 수 없습니다");
  });

  it("should respect custom timeout", async () => {
    const result = await runRefineFlow({ timeoutMs: 5000 }, tmpDir);
    expect(result.config.timeoutMs).toBe(5000);
  });

  it("should respect custom log level", async () => {
    const result = await runRefineFlow({ logLevel: "debug" }, tmpDir);
    expect(result.config.logLevel).toBe("debug");
  });
});
