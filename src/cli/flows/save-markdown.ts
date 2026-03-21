import { access, mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import inquirer from "inquirer";
import chalk from "chalk";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface SaveMarkdownOptions {
  projectName: string;
  filename: string;
  content: string;
}

export async function saveMarkdown({
  projectName,
  filename,
  content,
}: SaveMarkdownOptions): Promise<string> {
  const safe = slugify(projectName);

  if (!safe) {
    throw new Error("프로젝트명이 유효하지 않습니다. 영문/숫자/한글을 포함해주세요.");
  }

  const baseDir = join(process.cwd(), `${safe}-docs`);
  const filePath = join(baseDir, filename);
  const dir = dirname(filePath);

  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      throw new Error(
        `디렉토리를 생성할 수 없습니다. 쓰기 권한을 확인해주세요: ${dir}`,
      );
    }
    if (code === "ENAMETOOLONG") {
      throw new Error(
        `경로가 너무 깁니다. 프로젝트명을 줄여주세요: ${dir}`,
      );
    }
    throw error;
  }

  let fileExists = false;
  try {
    await access(filePath);
    fileExists = true;
  } catch {
    // 파일 없음 — 정상
  }

  if (fileExists) {
    const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
      {
        type: "confirm",
        name: "overwrite",
        message: `${filePath} 파일이 이미 존재합니다. 덮어쓸까요?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow("⚠ 저장을 취소했습니다. 기존 파일을 유지합니다."));
      return filePath;
    }
  }

  const tmpPath = `${filePath}.tmp`;

  try {
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, filePath);
  } catch (error) {
    // 임시 파일 정리
    try {
      await unlink(tmpPath);
    } catch {
      // 임시 파일이 없으면 무시
    }

    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      throw new Error(
        `파일을 저장할 수 없습니다. 쓰기 권한을 확인해주세요: ${filePath}`,
      );
    }
    throw error;
  }

  console.log(chalk.green(`✔ 저장 완료: ${filePath}`));
  return filePath;
}
