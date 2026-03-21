import chalk from "chalk";

const ERROR_MESSAGES: Record<string, string> = {
  EACCES: "파일 또는 디렉토리에 대한 접근 권한이 없습니다.",
  EPERM: "작업에 필요한 권한이 없습니다.",
  EROFS: "읽기 전용 파일 시스템에는 쓸 수 없습니다.",
  ENAMETOOLONG: "파일 경로가 너무 깁니다. 프로젝트명이나 기능명을 줄여주세요.",
  ENOSPC: "디스크 공간이 부족합니다.",
  ETIMEDOUT: "요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.",
  ECONNREFUSED: "서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.",
  ENOTFOUND: "서버를 찾을 수 없습니다. 네트워크 연결을 확인해주세요.",
};

export function humanizeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && ERROR_MESSAGES[code]) {
      return `${ERROR_MESSAGES[code]} (${code})`;
    }
    return error.message;
  }
  return String(error);
}

export function withCliErrorBoundary<
  T extends (...args: any[]) => Promise<any>,
>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      // CTRL+C (Inquirer ExitPromptError)는 조용히 종료
      if (isUserCancellation(error)) {
        console.log(chalk.yellow("\n\n👋 작업을 취소했습니다. 언제든 다시 시도해주세요!"));
        process.exitCode = 0;
        return;
      }

      console.error("");
      console.error(chalk.red("✖ 오류가 발생했습니다:"));
      console.error(chalk.red(`  ${humanizeError(error)}`));
      console.error("");
      console.error(chalk.gray("💡 해결 방법:"));
      console.error(chalk.gray("  • 명령어를 다시 실행하여 재시도해주세요"));
      console.error(chalk.gray("  • 문제가 지속되면 --help 옵션으로 사용법을 확인하세요"));
      console.error("");

      process.exitCode = 1;
    }
  }) as T;
}

function isUserCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // Inquirer의 ExitPromptError
  const name = (error as Error).name;
  if (name === "ExitPromptError") return true;

  // 일반적인 사용자 취소 메시지
  const message = (error as Error).message ?? "";
  if (
    message.includes("User force closed") ||
    message.includes("prompt was closed")
  ) {
    return true;
  }

  return false;
}
