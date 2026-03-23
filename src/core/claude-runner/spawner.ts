import { spawnSync, spawn } from "child_process";

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Claude CLI를 실행한다.
 *
 * - spawnSync + stdio: 'inherit'로 실시간 터미널 I/O
 * - dry-run 모드: CC_DRY_RUN=1이면 실제 spawn 없이 명령어 출력
 * - env 파라미터: process.env에 merge되어 subprocess에 전달
 */
export function spawnClaude(
  flags: string[],
  env?: Record<string, string>,
): SpawnResult {
  if (process.env.CC_DRY_RUN === "1") {
    const command = ["claude", ...flags].join(" ");
    process.stdout.write(`[DRY-RUN] ${command}\n`);
    if (env && Object.keys(env).length > 0) {
      process.stdout.write(`[DRY-RUN] env: ${Object.keys(env).join(", ")}\n`);
    }
    return { exitCode: 0, stdout: "", stderr: "" };
  }

  const result = spawnSync("claude", flags, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

  return {
    exitCode: result.status ?? 1,
    stdout: "",
    stderr: "",
  };
}

/**
 * Claude CLI를 실행하되, stdout을 캡처하면서 터미널에도 출력한다.
 *
 * - stdin/stderr는 터미널에 직접 연결 (대화형 유지)
 * - stdout은 pipe → 터미널 출력 + 버퍼 저장
 */
export interface SpawnCaptureOptions {
  env?: Record<string, string>;
  /** stdout 청크를 터미널에 쓰기 전에 변환하는 함수 */
  transformOutput?: (text: string) => string;
}

export function spawnClaudeWithCapture(
  flags: string[],
  options?: SpawnCaptureOptions,
): Promise<SpawnResult> {
  const { env, transformOutput } = options ?? {};
  if (process.env.CC_DRY_RUN === "1") {
    const command = ["claude", ...flags].join(" ");
    process.stdout.write(`[DRY-RUN] ${command}\n`);
    return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
  }

  return new Promise((resolve) => {
    const child = spawn("claude", flags, {
      stdio: ["inherit", "pipe", "inherit"],
      env: { ...process.env, ...env },
    });

    const chunks: Buffer[] = [];

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      process.stdout.write(transformOutput ? transformOutput(text) : text);
      chunks.push(chunk);
    });

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(chunks).toString("utf-8"),
        stderr: "",
      });
    });
  });
}
