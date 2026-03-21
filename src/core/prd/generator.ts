import fs from "node:fs/promises";
import path from "node:path";

export async function savePrd(projectRoot: string, markdown: string): Promise<string> {
  const filePath = path.join(projectRoot, ".taskflow", "prd.md");
  await fs.writeFile(filePath, markdown, "utf-8");
  return filePath;
}
