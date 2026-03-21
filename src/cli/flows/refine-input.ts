import { readFile } from "node:fs/promises";
import type { RefineConfig } from "./refine-types.js";
import { RefineValidationError } from "./refine-config.js";

export interface RefineInput {
  base?: string;
  changed?: string;
  source: "file" | "stdin";
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export async function resolveInput(config: RefineConfig): Promise<RefineInput> {
  if (config.stdin) {
    const content = await readStdin();
    if (!content.trim()) {
      throw new RefineValidationError("표준 입력이 비어있습니다.");
    }
    return { changed: content, source: "stdin" };
  }

  const result: RefineInput = { source: "file" };

  if (config.base) {
    try {
      result.base = await readFile(config.base, "utf-8");
    } catch {
      throw new RefineValidationError(`base 파일을 읽을 수 없습니다: ${config.base}`);
    }
  }

  if (config.changed) {
    try {
      result.changed = await readFile(config.changed, "utf-8");
    } catch {
      throw new RefineValidationError(`changed 파일을 읽을 수 없습니다: ${config.changed}`);
    }
  }

  return result;
}
