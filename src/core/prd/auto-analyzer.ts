import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { askClaudeWithRetry } from "../ai/client.js";
import type { PrdResult } from "../types.js";

const SCAN_PATTERNS = [
  "package.json", "tsconfig*.json", "next.config.*", "vite.config.*",
  "nuxt.config.*", "nest-cli.json", "angular.json",
  "docker-compose*.{yml,yaml}", "Dockerfile", ".env.example",
  "src/**/*.{ts,tsx,js,jsx}", "app/**/*.{ts,tsx,js,jsx}",
  "server/**/*.{ts,tsx,js,jsx}", "api/**/*.{ts,tsx,js,jsx}",
  "lib/**/*.{ts,tsx,js,jsx}", "pages/**/*.{ts,tsx,js,jsx}",
];

const IGNORE_PATTERNS = [
  "**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**",
  "**/.next/**", "**/coverage/**", "**/*.test.*", "**/*.spec.*",
  "**/__tests__/**", "**/*.d.ts",
];

const MAX_BYTES_PER_FILE = 16_000;
const MAX_FILES = 200;

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|credential|auth)\s*[:=]\s*["']?[^\s"',]+/gi,
  /(?:sk|pk|key)-[a-zA-Z0-9]{20,}/g,
  /\/Users\/[^\s/]+/g,
  /\/home\/[^\s/]+/g,
  /C:\\Users\\[^\s\\]+/g,
];

export function maskSensitive(content: string): string {
  let masked = content;
  for (const pattern of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, "[REDACTED]");
  }
  return masked;
}

export interface FileSample {
  path: string;
  content: string;
  truncated: boolean;
}

export async function scanFiles(cwd: string): Promise<string[]> {
  const files = await fg(SCAN_PATTERNS, {
    cwd,
    ignore: IGNORE_PATTERNS,
    dot: true,
    absolute: false,
    onlyFiles: true,
  });
  return files.slice(0, MAX_FILES).sort();
}

export function extractSignature(content: string, maxBytes: number): string {
  if (Buffer.byteLength(content, "utf-8") <= maxBytes) {
    return content;
  }

  const lines = content.split("\n");
  const significant: string[] = [];
  let bytes = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const isSignificant =
      trimmed.startsWith("import ") || trimmed.startsWith("export ") ||
      trimmed.startsWith("//") || trimmed.startsWith("/*") ||
      trimmed.startsWith("* ") || trimmed.startsWith("*/") ||
      trimmed.startsWith("interface ") || trimmed.startsWith("type ") ||
      trimmed.startsWith("class ") || trimmed.startsWith("function ") ||
      trimmed.startsWith("const ") || trimmed.startsWith("async function") ||
      trimmed.startsWith("@") ||
      /^\s*(app|router|server)\.(get|post|put|delete|patch|use)\(/.test(trimmed) ||
      trimmed === "" || trimmed === "{" || trimmed === "}";

    if (isSignificant) {
      const lineBytes = Buffer.byteLength(line + "\n", "utf-8");
      if (bytes + lineBytes > maxBytes) break;
      significant.push(line);
      bytes += lineBytes;
    }
  }

  return significant.join("\n");
}

export async function sampleFiles(filePaths: string[], cwd: string): Promise<FileSample[]> {
  const samples: FileSample[] = [];

  for (const filePath of filePaths) {
    try {
      const fullPath = `${cwd}/${filePath}`;
      const raw = await readFile(fullPath, "utf-8");
      const originalBytes = Buffer.byteLength(raw, "utf-8");
      const content = extractSignature(raw, MAX_BYTES_PER_FILE);
      const masked = maskSensitive(content);
      samples.push({ path: filePath, content: masked, truncated: originalBytes > MAX_BYTES_PER_FILE });
    } catch {
      // skip unreadable files
    }
  }

  return samples;
}

export function inferProjectName(samples: FileSample[], projectRoot: string): string {
  const pkgSample = samples.find((s) => s.path === "package.json");
  if (pkgSample) {
    try {
      const pkg = JSON.parse(pkgSample.content);
      if (pkg.name && typeof pkg.name === "string") return pkg.name;
    } catch { /* fallback */ }
  }
  return basename(projectRoot);
}

function buildAnalysisPrompt(samples: FileSample[]): string {
  const fileList = samples
    .map((s) => {
      const tag = s.truncated ? " [일부 발췌]" : "";
      return `### ${s.path}${tag}\n\`\`\`\n${s.content}\n\`\`\``;
    })
    .join("\n\n");

  return `아래는 프로젝트의 소스 코드 및 설정 파일입니다. 이 내용만을 근거로 PRD를 작성해주세요.\n\n${fileList}`;
}

const SYSTEM_PROMPT = `당신은 소프트웨어 프로젝트 분석 전문가입니다.
제공된 소스 코드와 설정 파일을 분석하여 한국어 PRD(Product Requirements Document)를 작성합니다.

규칙:
- 실제 파일 내용에서 확인된 사실만 작성하세요. 추측하지 마세요.
- 확인할 수 없는 항목은 "N/A (코드에서 확인 불가)"로 표시하세요.
- 응답은 마크다운 형식이어야 합니다.
- 모든 내용은 한국어로 작성하세요.

다음 섹션을 포함하세요:
1. 제품 개요
2. 타겟 사용자
3. 해결하려는 문제 및 솔루션
4. 목표 및 핵심 지표
5. 주요 사용 시나리오
6. 기능 요구사항 (Must-Have / Optional 표)
7. 비기능 요구사항
8. 기술 스택
9. 범위 (포함 / 제외)
10. 마일스톤
11. 리스크 및 완화 전략`;

export async function runAutoAnalysis(projectRoot: string): Promise<PrdResult> {
  const filePaths = await scanFiles(projectRoot);

  if (filePaths.length === 0) {
    throw new Error("분석할 소스 파일을 찾을 수 없습니다. 프로젝트 루트 디렉토리에서 실행해주세요.");
  }

  const samples = await sampleFiles(filePaths, projectRoot);
  const projectName = inferProjectName(samples, projectRoot);
  const prompt = buildAnalysisPrompt(samples);

  const response = await askClaudeWithRetry({ prompt, systemPrompt: SYSTEM_PROMPT });

  return {
    markdown: response.text,
    meta: {
      projectName,
      generatedAt: new Date().toISOString(),
      mode: "auto",
      filesScanned: filePaths.length,
    },
  };
}
