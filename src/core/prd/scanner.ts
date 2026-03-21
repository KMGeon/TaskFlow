import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

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

export const MAX_BYTES_PER_FILE = 16_000;
export const MAX_FILES = 200;

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
