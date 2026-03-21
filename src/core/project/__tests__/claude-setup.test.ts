import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  generateClaudeMd,
  generateMcpJson,
  appendClaudeImport,
} from "../claude-setup.js";

describe("generateClaudeMd", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-setup-"));
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should generate .taskflow/CLAUDE.md with project info", async () => {
    await generateClaudeMd(tmpDir, {
      projectName: "TestProject",
      summary: "A test project",
      stack: ["TypeScript", "Next.js"],
    });

    const content = await fs.readFile(path.join(tmpDir, ".taskflow/CLAUDE.md"), "utf-8");
    expect(content).toContain("TestProject");
    expect(content).toContain("A test project");
    expect(content).toContain("TypeScript");
    expect(content).toContain("list_tasks");
  });
});

describe("generateMcpJson", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-json-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create .mcp.json with taskflow server config", async () => {
    await generateMcpJson(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, ".mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.taskflow).toBeDefined();
    expect(parsed.mcpServers.taskflow.type).toBe("stdio");
  });

  it("should merge with existing .mcp.json without overwriting other servers", async () => {
    await fs.writeFile(
      path.join(tmpDir, ".mcp.json"),
      JSON.stringify({ mcpServers: { other: { type: "stdio", command: "other" } } }),
    );

    await generateMcpJson(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, ".mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.other).toBeDefined();
    expect(parsed.mcpServers.taskflow).toBeDefined();
  });
});

describe("appendClaudeImport", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-import-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create CLAUDE.md with import if it does not exist", async () => {
    await appendClaudeImport(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("@./.taskflow/CLAUDE.md");
  });

  it("should append import to existing CLAUDE.md", async () => {
    await fs.writeFile(path.join(tmpDir, "CLAUDE.md"), "# My Project\n\nExisting content\n");

    await appendClaudeImport(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Existing content");
    expect(content).toContain("@./.taskflow/CLAUDE.md");
  });

  it("should not duplicate import if already present", async () => {
    await fs.writeFile(
      path.join(tmpDir, "CLAUDE.md"),
      "# My Project\n\n## TaskFlow\n@./.taskflow/CLAUDE.md\n",
    );

    await appendClaudeImport(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    const matches = content.match(/@\.\/\.taskflow\/CLAUDE\.md/g);
    expect(matches).toHaveLength(1);
  });
});
