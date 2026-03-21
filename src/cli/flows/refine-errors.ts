import chalk from "chalk";

// ── Error categories ──

export type ErrorCategory = "Input" | "AI" | "Parse" | "Apply" | "IO" | "Timeout";

export interface RefineError {
  code: ErrorCategory;
  message: string;
  hint: string;
  cause?: Error;
}

// ── Classification ──

export function classifyError(err: unknown): RefineError {
  if (err instanceof Error) {
    const msg = err.message;

    // Input errors (file not found, empty stdin — but NOT "AI 응답" messages)
    if (
      (msg.includes("파일을 읽을 수 없습니다") || msg.includes("표준 입력이 비어있습니다"))
    ) {
      return {
        code: "Input",
        message: msg,
        hint: "입력 파일 경로를 확인하고 파일이 존재하는지 확인하세요.",
        cause: err,
      };
    }

    // Parse errors (check before AI — "AI 응답이 유효한 JSON" should be Parse)
    if (msg.includes("JSON") || msg.includes("스키마") || msg.includes("parse")) {
      return {
        code: "Parse",
        message: msg,
        hint: "AI 응답 형식이 예상과 다릅니다. --verbose 옵션으로 응답을 확인하세요.",
        cause: err,
      };
    }

    // AI errors
    if (
      msg.includes("AI 응답") ||
      msg.includes("claude") ||
      msg.includes("network") ||
      msg.includes("ECONNREFUSED")
    ) {
      return {
        code: "AI",
        message: msg,
        hint: "Claude API 연결을 확인하세요. Claude Max 인증이 활성화되어 있는지 확인하세요.",
        cause: err,
      };
    }

    // IO errors
    if (
      msg.includes("EACCES") ||
      msg.includes("EPERM") ||
      msg.includes("ENOSPC") ||
      msg.includes("ENOENT")
    ) {
      return {
        code: "IO",
        message: msg,
        hint: "파일 권한 또는 디스크 공간을 확인하세요.",
        cause: err,
      };
    }

    // Timeout
    if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
      return {
        code: "Timeout",
        message: msg,
        hint: "--timeout-ms 옵션으로 타임아웃을 늘려보세요.",
        cause: err,
      };
    }

    // Apply errors
    if (msg.includes("Task not found") || msg.includes("rollback")) {
      return {
        code: "Apply",
        message: msg,
        hint: "태스크 파일이 손상되었을 수 있습니다. .taskflow/backups에서 복원하세요.",
        cause: err,
      };
    }

    return {
      code: "Apply",
      message: msg,
      hint: "예상치 못한 오류입니다. --verbose 옵션으로 상세 로그를 확인하세요.",
      cause: err,
    };
  }

  return {
    code: "Apply",
    message: String(err),
    hint: "알 수 없는 오류입니다.",
  };
}

// ── Formatted output ──

export function formatRefineError(err: RefineError, verbose = false): string {
  const lines: string[] = [
    "",
    chalk.red(`✖ [${err.code}] ${err.message}`),
    "",
    chalk.yellow(`💡 ${err.hint}`),
  ];

  if (verbose && err.cause?.stack) {
    lines.push("", chalk.gray("Stack trace:"), chalk.gray(err.cause.stack));
  }

  lines.push("");
  return lines.join("\n");
}

// ── Wrap function with error handling ──

export async function withRefineErrorBoundary<T>(
  fn: () => Promise<T>,
  options: { verbose?: boolean; onError?: (err: RefineError) => void } = {},
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const classified = classifyError(err);

    if (options.onError) {
      options.onError(classified);
    } else {
      console.error(formatRefineError(classified, options.verbose));
    }

    return null;
  }
}
