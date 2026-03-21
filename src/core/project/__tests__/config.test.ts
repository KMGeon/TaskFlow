import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readConfig, writeConfig, DEFAULT_CONFIG } from "../config.js";

describe("config", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "taskflow-test-"));
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should return default config when file does not exist", async () => {
    const config = await readConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("should write and read config", async () => {
    const config = { ...DEFAULT_CONFIG, project: { ...DEFAULT_CONFIG.project, name: "test" } };
    await writeConfig(tmpDir, config);
    const result = await readConfig(tmpDir);
    expect(result.project.name).toBe("test");
  });
});
