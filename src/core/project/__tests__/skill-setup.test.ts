import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installSkills, SKILL_NAMES } from "../skill-setup.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("installSkills", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-test-"));
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create skill source files and symlinks", async () => {
    await installSkills(tmpDir);

    const srcDir = path.join(tmpDir, ".taskflow", ".claude", "commands");
    const destDir = path.join(tmpDir, ".claude", "commands");

    for (const name of SKILL_NAMES) {
      const srcFile = path.join(srcDir, `${name}.md`);
      const srcContent = await fs.readFile(srcFile, "utf-8");
      expect(srcContent.length).toBeGreaterThan(0);

      const linkPath = path.join(destDir, `${name}.md`);
      const stat = await fs.lstat(linkPath);
      expect(stat.isSymbolicLink()).toBe(true);

      const linkContent = await fs.readFile(linkPath, "utf-8");
      expect(linkContent).toBe(srcContent);
    }
  });

  it("should skip symlink if destination file already exists", async () => {
    const destDir = path.join(tmpDir, ".claude", "commands");
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, "prd.md"), "# user custom prd");

    await installSkills(tmpDir);

    const content = await fs.readFile(path.join(destDir, "prd.md"), "utf-8");
    expect(content).toBe("# user custom prd");
  });

  it("should overwrite stale skill source files on re-init", async () => {
    await installSkills(tmpDir);

    const srcFile = path.join(tmpDir, ".taskflow", ".claude", "commands", "prd.md");
    await fs.writeFile(srcFile, "# old content");

    await installSkills(tmpDir);

    const content = await fs.readFile(srcFile, "utf-8");
    expect(content).not.toBe("# old content");
    expect(content).toContain("PRD");
  });
});
