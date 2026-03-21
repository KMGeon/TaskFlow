import fs from "node:fs/promises";
import path from "node:path";
import { SKILL_TEMPLATES } from "./skill-templates.js";

export const SKILL_NAMES = Object.keys(SKILL_TEMPLATES);

export async function installSkills(projectRoot: string): Promise<void> {
  const srcDir = path.join(projectRoot, ".taskflow", ".claude", "commands");
  const destDir = path.join(projectRoot, ".claude", "commands");

  await fs.mkdir(srcDir, { recursive: true });
  await fs.mkdir(destDir, { recursive: true });

  for (const [name, content] of Object.entries(SKILL_TEMPLATES)) {
    const srcFile = path.join(srcDir, `${name}.md`);
    const destFile = path.join(destDir, `${name}.md`);

    // 원본 스킬 파일 생성 (항상 최신 템플릿으로 덮어쓰기)
    await fs.writeFile(srcFile, content, "utf-8");

    // 기존 링크/파일이 있으면 심볼릭 링크 스킵
    try {
      await fs.lstat(destFile);
      continue;
    } catch {
      // 없으면 생성
    }

    const relativePath = path.relative(destDir, srcFile);
    await fs.symlink(relativePath, destFile);
  }
}
