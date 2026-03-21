import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RefineCliOptions, RefineConfig, ApplyMode } from "./refine-types.js";
import { REFINE_DEFAULTS } from "./refine-types.js";

// ── Validation errors ──

export class RefineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefineValidationError";
  }
}

// ── Mutual exclusion rules ──

export function validateOptions(opts: RefineCliOptions): void {
  // --stdin is mutually exclusive with --base/--changed
  if (opts.stdin && (opts.base || opts.changed)) {
    throw new RefineValidationError(
      "--stdin과 --base/--changed는 동시에 사용할 수 없습니다.\n" +
      "  파일 경로 또는 표준 입력 중 하나만 선택하세요.",
    );
  }

  // --apply and --interactive are mutually exclusive
  if (opts.apply && opts.interactive) {
    throw new RefineValidationError(
      "--apply와 --interactive는 동시에 사용할 수 없습니다.\n" +
      "  자동 적용 또는 대화형 모드 중 하나를 선택하세요.",
    );
  }

  // --dry-run cannot be combined with --apply
  if (opts.dryRun && opts.apply) {
    throw new RefineValidationError(
      "--dry-run과 --apply는 동시에 사용할 수 없습니다.",
    );
  }

  // If not stdin, at least one of base or changed should be provided (warn)
  // This is optional — allow no-arg run for default behavior
}

// ── Determine apply mode ──

function resolveApplyMode(opts: RefineCliOptions): ApplyMode {
  if (opts.dryRun) return "dry-run";
  if (opts.apply) return "apply";
  if (opts.interactive) return "interactive";
  return "preview";
}

// ── Config file loader ──

interface TaskflowConfigFile {
  refine?: Partial<{
    format: string;
    backupDir: string;
    logLevel: string;
    timeoutMs: number;
  }>;
}

async function loadTaskflowConfig(projectRoot: string): Promise<TaskflowConfigFile> {
  try {
    const configPath = path.join(projectRoot, ".taskflow", "config.json");
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) as TaskflowConfigFile;
  } catch {
    return {};
  }
}

// ── Merge: defaults < config.json < CLI options ──

export async function buildRefineConfig(
  opts: RefineCliOptions,
  projectRoot: string = process.cwd(),
): Promise<RefineConfig> {
  validateOptions(opts);

  const fileConfig = await loadTaskflowConfig(projectRoot);
  const refineFile = fileConfig.refine ?? {};

  return {
    base: opts.base ?? REFINE_DEFAULTS.base,
    changed: opts.changed ?? REFINE_DEFAULTS.changed,
    stdin: opts.stdin ?? REFINE_DEFAULTS.stdin,
    format: (opts.format ?? refineFile.format ?? REFINE_DEFAULTS.format) as RefineConfig["format"],
    applyMode: resolveApplyMode(opts),
    backupDir: opts.backupDir ?? refineFile.backupDir ?? REFINE_DEFAULTS.backupDir,
    logLevel: (opts.logLevel ?? refineFile.logLevel ?? REFINE_DEFAULTS.logLevel) as RefineConfig["logLevel"],
    timeoutMs: opts.timeoutMs ?? refineFile.timeoutMs ?? REFINE_DEFAULTS.timeoutMs,
  };
}
