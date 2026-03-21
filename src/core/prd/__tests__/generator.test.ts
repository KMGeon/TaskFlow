import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { savePrd } from "../generator.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("savePrd", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gen-test-"));
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should save PRD markdown to .taskflow/prd.md", async () => {
    const markdown = "# Test PRD\n\nContent here";
    const result = await savePrd(tmpDir, markdown);
    expect(result).toContain("prd.md");
    const content = await fs.readFile(result, "utf-8");
    expect(content).toBe(markdown);
  });
});
