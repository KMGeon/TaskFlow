import { describe, it, expect } from "vitest";
import { validateOptions, buildRefineConfig, RefineValidationError } from "../refine-config";
import type { RefineCliOptions } from "../refine-types";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// ── validateOptions ──

describe("validateOptions", () => {
  it("should pass with no options", () => {
    expect(() => validateOptions({})).not.toThrow();
  });

  it("should pass with only --base and --changed", () => {
    expect(() => validateOptions({ base: "a.md", changed: "b.md" })).not.toThrow();
  });

  it("should pass with only --stdin", () => {
    expect(() => validateOptions({ stdin: true })).not.toThrow();
  });

  it("should reject --stdin with --base", () => {
    expect(() => validateOptions({ stdin: true, base: "a.md" })).toThrow(
      RefineValidationError,
    );
  });

  it("should reject --stdin with --changed", () => {
    expect(() => validateOptions({ stdin: true, changed: "b.md" })).toThrow(
      RefineValidationError,
    );
  });

  it("should reject --apply with --interactive", () => {
    expect(() => validateOptions({ apply: true, interactive: true })).toThrow(
      RefineValidationError,
    );
  });

  it("should reject --dry-run with --apply", () => {
    expect(() => validateOptions({ dryRun: true, apply: true })).toThrow(
      RefineValidationError,
    );
  });

  it("should allow --dry-run alone", () => {
    expect(() => validateOptions({ dryRun: true })).not.toThrow();
  });

  it("should allow --interactive alone", () => {
    expect(() => validateOptions({ interactive: true })).not.toThrow();
  });
});

// ── buildRefineConfig ──

describe("buildRefineConfig", () => {
  let tmpDir: string;

  async function setup(configExtra?: Record<string, unknown>): Promise<string> {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "refine-cfg-"));
    const taskflowDir = path.join(tmpDir, ".taskflow");
    await fs.mkdir(taskflowDir, { recursive: true });
    await fs.mkdir(path.join(taskflowDir, "tasks"), { recursive: true });
    await fs.mkdir(path.join(taskflowDir, "index"), { recursive: true });
    await fs.mkdir(path.join(taskflowDir, "logs"), { recursive: true });
    await fs.mkdir(path.join(taskflowDir, "cache"), { recursive: true });

    const config = {
      version: "1.0",
      project: { name: "Test" },
      tasks: { statusFlow: ["Todo", "InProgress", "Blocked", "Done"] },
      ...configExtra,
    };
    await fs.writeFile(
      path.join(taskflowDir, "config.json"),
      JSON.stringify(config),
      "utf-8",
    );
    return tmpDir;
  }

  it("should use defaults when no options provided", async () => {
    const root = await setup();
    const config = await buildRefineConfig({}, root);

    expect(config.format).toBe("table");
    expect(config.applyMode).toBe("preview");
    expect(config.logLevel).toBe("info");
    expect(config.timeoutMs).toBe(120_000);
    expect(config.backupDir).toBe(".taskflow/backups");
  });

  it("should override with CLI options", async () => {
    const root = await setup();
    const config = await buildRefineConfig(
      { format: "json", logLevel: "debug", timeoutMs: 5000 },
      root,
    );

    expect(config.format).toBe("json");
    expect(config.logLevel).toBe("debug");
    expect(config.timeoutMs).toBe(5000);
  });

  it("should read from config.json refine section", async () => {
    const root = await setup({
      refine: { format: "md", backupDir: "/custom/backup", logLevel: "warn" },
    });
    const config = await buildRefineConfig({}, root);

    expect(config.format).toBe("md");
    expect(config.backupDir).toBe("/custom/backup");
    expect(config.logLevel).toBe("warn");
  });

  it("should let CLI options override config.json", async () => {
    const root = await setup({
      refine: { format: "md", logLevel: "warn" },
    });
    const config = await buildRefineConfig({ format: "json", logLevel: "error" }, root);

    expect(config.format).toBe("json");
    expect(config.logLevel).toBe("error");
  });

  it("should resolve applyMode from flags", async () => {
    const root = await setup();

    expect((await buildRefineConfig({}, root)).applyMode).toBe("preview");
    expect((await buildRefineConfig({ apply: true }, root)).applyMode).toBe("apply");
    expect((await buildRefineConfig({ interactive: true }, root)).applyMode).toBe("interactive");
    expect((await buildRefineConfig({ dryRun: true }, root)).applyMode).toBe("dry-run");
  });

  it("should handle missing config.json gracefully", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "refine-no-cfg-"));
    const config = await buildRefineConfig({}, root);
    expect(config.format).toBe("table");
  });
});
