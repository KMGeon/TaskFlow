import fs from "node:fs/promises";
import path from "node:path";
import { DOCS_TEMPLATES } from "./docs-templates.js";

const DOCS_DIR = "docs";

export const DOCS_NAMES = Object.keys(DOCS_TEMPLATES);

export async function installDocs(projectRoot: string): Promise<void> {
  const docsDir = path.join(projectRoot, DOCS_DIR);
  await fs.mkdir(docsDir, { recursive: true });

  for (const [name, content] of Object.entries(DOCS_TEMPLATES)) {
    const filePath = path.join(docsDir, `${name}.md`);

    // Don't overwrite existing docs (user may have customized them)
    try {
      await fs.access(filePath);
      continue;
    } catch {
      // File doesn't exist — create it
    }

    await fs.writeFile(filePath, content, "utf-8");
  }
}
