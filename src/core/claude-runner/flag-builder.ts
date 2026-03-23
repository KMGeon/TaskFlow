export interface FlagBuilderInput {
  /** --system-prompt-file 경로 (기존 시스템 프롬프트 전체 교체) */
  systemPromptFilePath?: string;
  /** --append-system-prompt-file 경로 (기존 시스템 프롬프트에 추가) */
  appendSystemPromptFilePath?: string;
  /** --model 값 */
  model?: string;
  /** --mcp-config 경로 */
  mcpConfigFilePath?: string;
  /** --permission-mode 값 */
  permissionMode?: string;
  /** --max-turns 값 */
  maxTurns?: number;
  /** 마지막에 붙을 프롬프트 텍스트 (없으면 interactive mode) */
  prompt?: string;
  /** 추가 CLI 플래그 (예: ['-p']) */
  passthroughFlags?: string[];
}

export function buildFlags(input: FlagBuilderInput): string[] {
  const flags: string[] = [];

  if (input.systemPromptFilePath) {
    flags.push("--system-prompt-file", input.systemPromptFilePath);
  }

  if (input.appendSystemPromptFilePath) {
    flags.push("--append-system-prompt-file", input.appendSystemPromptFilePath);
  }

  if (input.model) {
    flags.push("--model", input.model);
  }

  if (input.mcpConfigFilePath) {
    flags.push("--mcp-config", input.mcpConfigFilePath);
  }

  if (input.permissionMode) {
    flags.push("--permission-mode", input.permissionMode);
  }

  if (input.maxTurns !== undefined) {
    flags.push("--max-turns", String(input.maxTurns));
  }

  if (input.passthroughFlags && input.passthroughFlags.length > 0) {
    flags.push(...input.passthroughFlags);
  }

  // prompt는 마지막에 (없으면 interactive mode)
  if (input.prompt) {
    flags.push(input.prompt);
  }

  return flags;
}
