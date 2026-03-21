import { describe, it, expect } from "vitest";
import { maskSensitive, extractSignature, inferProjectName } from "../scanner.js";
import type { FileSample } from "../scanner.js";

describe("maskSensitive", () => {
  it("should mask API keys", () => {
    const input = 'const apiKey = "sk-abc123def456ghi789jkl012"';
    const result = maskSensitive(input);
    expect(result).not.toContain("sk-abc123def456ghi789jkl012");
    expect(result).toContain("[REDACTED]");
  });
});

describe("extractSignature", () => {
  it("should keep import/export lines within byte limit", () => {
    const content = 'import foo from "bar";\nexport function test() {}\nconst x = 1;\nconst y = 2;\n';
    const result = extractSignature(content, 100);
    expect(result).toContain("import foo");
    expect(result).toContain("export function");
  });
});

describe("inferProjectName", () => {
  it("should extract name from package.json sample", () => {
    const samples: FileSample[] = [
      { path: "package.json", content: '{"name": "my-project"}', truncated: false },
    ];
    expect(inferProjectName(samples, "/tmp/test")).toBe("my-project");
  });

  it("should fallback to projectRoot basename", () => {
    const samples: FileSample[] = [];
    expect(inferProjectName(samples, "/tmp/my-awesome-project")).toBe("my-awesome-project");
  });
});
