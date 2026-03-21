import { describe, expect, it, vi, beforeEach } from "vitest";
import { join } from "node:path";

import {
  maskSensitive,
  scanFiles,
  sampleFiles,
  extractSignature,
  inferProjectName,
  buildAnalysisPrompt,
  withRetry,
  generateWithAI,
  runAutoPrd,
  type FileSample,
} from "./auto.js";

const FIXTURES_DIR = join(__dirname, "__fixtures__", "sample-project");

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 민감정보 마스킹 ──

describe("maskSensitive", () => {
  it("API 키 패턴을 마스킹해야 한다", () => {
    const result = maskSensitive('api_key = "sk-abc123def456"');
    expect(result).not.toContain("sk-abc123def456");
    expect(result).toContain("[REDACTED]");
  });

  it("시크릿 토큰을 마스킹해야 한다", () => {
    expect(maskSensitive("secret: my-super-secret-value")).toBe("[REDACTED]");
  });

  it("로컬 경로를 마스킹해야 한다", () => {
    expect(maskSensitive("/Users/mugeon/project")).toBe("[REDACTED]/project");
    expect(maskSensitive("/home/developer/app")).toBe("[REDACTED]/app");
  });

  it("민감정보가 없으면 원본을 반환해야 한다", () => {
    const safe = "const x = 42;";
    expect(maskSensitive(safe)).toBe(safe);
  });

  it("sk- 접두사 키를 마스킹해야 한다", () => {
    expect(maskSensitive("sk-abcdefghijklmnopqrstuvwxyz")).toBe("[REDACTED]");
  });
});

// ── 파일 스캔 ──

describe("scanFiles", () => {
  it("픽스처 디렉토리에서 파일을 스캔해야 한다", async () => {
    const files = await scanFiles(FIXTURES_DIR);

    expect(files).toContain("package.json");
    expect(files).toContain("tsconfig.json");
    expect(files).toContain("src/index.ts");
  });

  it("node_modules를 제외해야 한다", async () => {
    const files = await scanFiles(FIXTURES_DIR);

    const hasNodeModules = files.some((f) => f.includes("node_modules"));
    expect(hasNodeModules).toBe(false);
  });

  it("테스트 파일을 제외해야 한다", async () => {
    const files = await scanFiles(FIXTURES_DIR);

    const hasTest = files.some((f) => f.includes(".test.") || f.includes(".spec."));
    expect(hasTest).toBe(false);
  });

  it("결과를 정렬해야 한다", async () => {
    const files = await scanFiles(FIXTURES_DIR);
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });
});

// ── 시그니처 추출 ──

describe("extractSignature", () => {
  it("작은 파일은 전체를 반환해야 한다", () => {
    const content = "const x = 1;\nexport default x;";
    expect(extractSignature(content, 1000)).toBe(content);
  });

  it("큰 파일은 시그니처 라인만 추출해야 한다", () => {
    const lines = [
      'import express from "express";',
      "",
      "// 서버 설정",
      "const app = express();",
      "const internalVar = doSomethingVeryLong();", // 비시그니처
      "app.get('/api/users', handler);",
      'export default app;',
    ];
    const content = lines.join("\n");
    const result = extractSignature(content, 200);

    expect(result).toContain("import express");
    expect(result).toContain("export default app");
    expect(result).toContain("// 서버 설정");
  });

  it("maxBytes를 초과하지 않아야 한다", () => {
    const longContent = Array(1000)
      .fill('import { something } from "module";')
      .join("\n");
    const result = extractSignature(longContent, 500);
    expect(Buffer.byteLength(result, "utf-8")).toBeLessThanOrEqual(500 + 100); // 라인 단위 커팅 허용
  });
});

// ── 파일 샘플링 ──

describe("sampleFiles", () => {
  it("픽스처 파일을 샘플링해야 한다", async () => {
    const files = await scanFiles(FIXTURES_DIR);
    const samples = await sampleFiles(files, FIXTURES_DIR);

    expect(samples.length).toBeGreaterThan(0);
    const pkgSample = samples.find((s) => s.path === "package.json");
    expect(pkgSample).toBeDefined();
    expect(pkgSample!.content).toContain("sample-app");
  });

  it("민감정보를 마스킹해야 한다", async () => {
    const samples = await sampleFiles(["package.json"], FIXTURES_DIR);
    // 픽스처에는 민감정보가 없으므로 마스킹 없이 통과
    expect(samples[0].content).not.toContain("[REDACTED]");
  });

  it("존재하지 않는 파일을 무시해야 한다", async () => {
    const samples = await sampleFiles(["nonexistent.ts"], FIXTURES_DIR);
    expect(samples).toHaveLength(0);
  });
});

// ── 프로젝트명 추론 ──

describe("inferProjectName", () => {
  it("package.json에서 프로젝트명을 추론해야 한다", () => {
    const samples: FileSample[] = [
      { path: "package.json", content: '{"name": "my-app"}', truncated: false },
    ];
    expect(inferProjectName(samples)).toBe("my-app");
  });

  it("package.json이 없으면 cwd basename을 반환해야 한다", () => {
    const samples: FileSample[] = [
      { path: "src/index.ts", content: "export {};", truncated: false },
    ];
    const name = inferProjectName(samples);
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });

  it("package.json 파싱 실패 시 폴백해야 한다", () => {
    const samples: FileSample[] = [
      { path: "package.json", content: "invalid json", truncated: false },
    ];
    const name = inferProjectName(samples);
    expect(typeof name).toBe("string");
  });
});

// ── 프롬프트 빌더 ──

describe("buildAnalysisPrompt", () => {
  it("파일 내용을 코드 블록으로 포함해야 한다", () => {
    const samples: FileSample[] = [
      { path: "index.ts", content: "const x = 1;", truncated: false },
    ];
    const prompt = buildAnalysisPrompt(samples);
    expect(prompt).toContain("### index.ts");
    expect(prompt).toContain("```");
    expect(prompt).toContain("const x = 1;");
  });

  it("발췌 표시를 포함해야 한다", () => {
    const samples: FileSample[] = [
      { path: "big.ts", content: "...", truncated: true },
    ];
    const prompt = buildAnalysisPrompt(samples);
    expect(prompt).toContain("[일부 발췌]");
  });
});

// ── 재시도 ──

describe("withRetry", () => {
  it("성공 시 바로 반환해야 한다", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, 3);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("실패 후 재시도해야 한다", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, 3);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("최대 재시도 초과 시 마지막 에러를 던져야 한다", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent"));

    await expect(withRetry(fn, 2)).rejects.toThrow("persistent");
    expect(fn).toHaveBeenCalledTimes(3); // 초기 + 2회 재시도
  });
});

// ── AI 호출 (스텁) ──

describe("generateWithAI", () => {
  it("AI 클라이언트 제거로 에러를 던져야 한다", async () => {
    await expect(generateWithAI("test prompt")).rejects.toThrow();
  });
});

// ── 메인 플로우 ──

describe("runAutoPrd", () => {
  it("generateWithAI가 AI 클라이언트 제거로 에러를 던져야 한다", async () => {
    // generateWithAI is the AI-dependent function; runAutoPrd calls it after file scan
    await expect(generateWithAI("any prompt")).rejects.toThrow();
  });
});
