import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initProject } from "../init.js";

describe("initProject", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "taskflow-init-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create .taskflow directory and config.json", async () => {
    const result = await initProject(tmpDir);
    expect(result.created).toBe(true);

    const stat = await fs.stat(path.join(tmpDir, ".taskflow"));
    expect(stat.isDirectory()).toBe(true);

    const config = await fs.readFile(path.join(tmpDir, ".taskflow/config.json"), "utf-8");
    expect(JSON.parse(config).version).toBe("1.0");
  });

  it("should return created=false when .taskflow already exists", async () => {
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, ".taskflow/config.json"), "{}");

    const result = await initProject(tmpDir);
    expect(result.created).toBe(false);
    expect(result.alreadyExists).toBe(true);
  });
});
