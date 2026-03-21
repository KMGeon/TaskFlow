import chalk from "chalk";
import type { LogLevel } from "./refine-types.js";

const LEVEL_ORDER: LogLevel[] = ["debug", "info", "warn", "error", "silent"];

export interface RefineLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createRefineLogger(level: LogLevel): RefineLogger {
  const threshold = LEVEL_ORDER.indexOf(level);

  function shouldLog(msgLevel: LogLevel): boolean {
    return LEVEL_ORDER.indexOf(msgLevel) >= threshold;
  }

  return {
    debug: (...args) => shouldLog("debug") && console.debug(chalk.gray("[debug]"), ...args),
    info: (...args) => shouldLog("info") && console.log(chalk.cyan("[info]"), ...args),
    warn: (...args) => shouldLog("warn") && console.warn(chalk.yellow("[warn]"), ...args),
    error: (...args) => shouldLog("error") && console.error(chalk.red("[error]"), ...args),
  };
}
