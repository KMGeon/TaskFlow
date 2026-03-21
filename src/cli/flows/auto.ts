import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface PrdResult {
  markdown: string;
  meta: Record<string, unknown>;
}

// ── 설정 ──

const SCAN_PATTERNS = [
  "package.json",
  "tsconfig*.json",
  "next.config.*",
  "vite.config.*",
  "nuxt.config.*",
  "nest-cli.json",
  "angular.json",
  "docker-compose*.{yml,yaml}",
  "Dockerfile",
  ".env.example",
  "src/**/*.{ts,tsx,js,jsx}",
  "app/**/*.{ts,tsx,js,jsx}",
  "server/**/*.{ts,tsx,js,jsx}",
  "api/**/*.{ts,tsx,js,jsx}",
  "lib/**/*.{ts,tsx,js,jsx}",
  "pages/**/*.{ts,tsx,js,jsx}",
];

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/*.d.ts",
];

const MAX_BYTES_PER_FILE = 16_000;
const MAX_FILES = 200;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

// ── 민감정보 마스킹 ──

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

// ── 파일 수집/샘플링 ──

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
      trimmed.startsWith("import ") ||
      trimmed.startsWith("export ") ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("* ") ||
      trimmed.startsWith("*/") ||
      trimmed.startsWith("interface ") ||
      trimmed.startsWith("type ") ||
      trimmed.startsWith("class ") ||
      trimmed.startsWith("function ") ||
      trimmed.startsWith("const ") ||
      trimmed.startsWith("async function") ||
      trimmed.startsWith("@") ||
      /^\s*(app|router|server)\.(get|post|put|delete|patch|use)\(/.test(trimmed) ||
      trimmed === "" ||
      trimmed === "{" ||
      trimmed === "}";

    if (isSignificant) {
      const lineBytes = Buffer.byteLength(line + "\n", "utf-8");
      if (bytes + lineBytes > maxBytes) break;
      significant.push(line);
      bytes += lineBytes;
    }
  }

  return significant.join("\n");
}

export async function sampleFiles(
  filePaths: string[],
  cwd: string,
): Promise<FileSample[]> {
  const samples: FileSample[] = [];

  for (const filePath of filePaths) {
    try {
      const fullPath = `${cwd}/${filePath}`;
      const raw = await readFile(fullPath, "utf-8");
      const originalBytes = Buffer.byteLength(raw, "utf-8");
      const content = extractSignature(raw, MAX_BYTES_PER_FILE);
      const masked = maskSensitive(content);

      samples.push({
        path: filePath,
        content: masked,
        truncated: originalBytes > MAX_BYTES_PER_FILE,
      });
    } catch {
      // 읽기 실패 시 무시
    }
  }

  return samples;
}

// ── 프로젝트명 추론 ──

export function inferProjectName(samples: FileSample[]): string {
  const pkgSample = samples.find((s) => s.path === "package.json");
  if (pkgSample) {
    try {
      const pkg = JSON.parse(pkgSample.content);
      if (pkg.name && typeof pkg.name === "string") {
        return pkg.name;
      }
    } catch {
      // 파싱 실패 시 폴백
    }
  }
  return basename(process.cwd());
}


export function buildAnalysisPrompt(samples: FileSample[]): string {
  const fileList = samples
    .map((s) => {
      const tag = s.truncated ? " [일부 발췌]" : "";
      return `### ${s.path}${tag}\n\`\`\`\n${s.content}\n\`\`\``;
    })
    .join("\n\n");

  return `아래는 프로젝트의 소스 코드 및 설정 파일입니다. 이 내용만을 근거로 PRD를 작성해주세요.

${fileList}`;
}

// ── 재시도 유틸 ──

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ── AI 호출 ──

export async function generateWithAI(_prompt: string): Promise<string> {
  throw new Error("AI PRD 생성 기능은 Claude Code 스킬을 통해 제공됩니다. /prd 명령어를 사용하세요.");
}

// ── 메인 플로우 ──

export async function runAutoPrd(): Promise<PrdResult> {
  const cwd = process.cwd();

  const filePaths = await scanFiles(cwd);

  if (filePaths.length === 0) {
    throw new Error(
      "분석할 소스 파일을 찾을 수 없습니다. 프로젝트 루트 디렉토리에서 실행해주세요.",
    );
  }

  const samples = await sampleFiles(filePaths, cwd);
  const projectName = inferProjectName(samples);
  const prompt = buildAnalysisPrompt(samples);

  const markdown = await withRetry(() => generateWithAI(prompt));

  return {
    markdown,
    meta: {
      projectName,
      generatedAt: new Date().toISOString(),
      mode: "auto",
      filesScanned: filePaths.length,
    },
  };
}
