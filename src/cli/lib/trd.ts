import * as fs from "node:fs";
import * as path from "node:path";

export interface TrdFile {
  name: string;
  fileName: string;
  filePath: string;
}

export function findTrdFiles(projectRoot: string): TrdFile[] {
  const taskflowDir = path.join(projectRoot, ".taskflow");
  if (!fs.existsSync(taskflowDir)) return [];

  return fs
    .readdirSync(taskflowDir)
    .filter((f) => f.startsWith("trd-") && f.endsWith(".md"))
    .map((fileName) => {
      const name = fileName
        .replace(/^trd-/, "")
        .replace(/\.md$/, "")
        .replace(/-/g, " ");
      return {
        name,
        fileName,
        filePath: path.join(taskflowDir, fileName),
      };
    });
}

/** TRD 파일에서 그룹 이름 목록 반환 */
export function getTrdGroupNames(projectRoot: string): string[] {
  return findTrdFiles(projectRoot).map((t) => t.name);
}
