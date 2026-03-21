export type OutputFormat = "table" | "json" | "md";
export type ApplyMode = "preview" | "apply" | "interactive" | "dry-run";
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface RefineCliOptions {
  base?: string;
  changed?: string;
  stdin?: boolean;
  format?: OutputFormat;
  apply?: boolean;
  interactive?: boolean;
  dryRun?: boolean;
  backupDir?: string;
  logLevel?: LogLevel;
  timeoutMs?: number;
}

export interface RefineConfig {
  base?: string;
  changed?: string;
  stdin: boolean;
  format: OutputFormat;
  applyMode: ApplyMode;
  backupDir: string;
  logLevel: LogLevel;
  timeoutMs: number;
}

export const REFINE_DEFAULTS: RefineConfig = {
  stdin: false,
  format: "table",
  applyMode: "preview",
  backupDir: ".taskflow/backups",
  logLevel: "info",
  timeoutMs: 120_000,
};
