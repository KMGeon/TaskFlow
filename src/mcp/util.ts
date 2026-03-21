import path from "node:path";

export function resolveProjectRoot(input?: string): string {
  if (input) return path.resolve(input);
  return process.cwd();
}
