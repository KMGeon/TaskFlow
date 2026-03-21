import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * write-temp-rename 전략으로 원자적 파일 쓰기
 * 임시파일에 먼저 쓴 후 rename하여 손상 방지
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);

  await fs.writeFile(tmpPath, normalizeLineEndings(content), "utf-8");
  await fs.rename(tmpPath, filePath);
}

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return normalizeLineEndings(content);
  } catch {
    return null;
  }
}

export async function safeRemove(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
