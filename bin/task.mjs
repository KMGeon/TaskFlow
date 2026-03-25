#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const entry = resolve(root, "src/cli/index.ts");

const require = createRequire(import.meta.url);
const tsx = require.resolve("tsx/cli");

try {
  execFileSync(process.execPath, [tsx, entry, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
} catch (error) {
  process.exitCode = error.status ?? 1;
}
