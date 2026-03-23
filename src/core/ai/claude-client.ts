import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import chalk from "chalk";

export interface PrdBrainstormOptions {
  projectRoot: string;
  systemPrompt: string;
  projectContext?: string;
}

export interface PrdBrainstormResult {
  markdown: string;
  projectName: string;
}

/**
 * Run interactive PRD brainstorm using Claude Agent SDK.
 * Claude will ask questions one at a time and generate a PRD.
 * The conversation happens in the terminal via the SDK's built-in I/O.
 */
export async function runPrdBrainstorm(
  options: PrdBrainstormOptions,
): Promise<PrdBrainstormResult | null> {
  const contextSection = options.projectContext
    ? `\n\n## 프로젝트 컨텍스트\n\n${options.projectContext}`
    : "";

  const prompt = `PRD를 작성해주세요. 사용자와 대화하며 요구사항을 수집하고, 완료되면 PRD 마크다운을 생성해주세요.${contextSection}`;

  let prdMarkdown = "";

  const conversation = query({
    prompt,
    options: {
      systemPrompt: options.systemPrompt,
      cwd: options.projectRoot,
      maxTurns: 30,
      model: "claude-sonnet-4-6",
      permissionMode: "default",
    },
  });

  for await (const message of conversation) {
    if (message.type === "assistant") {
      // SDKAssistantMessage: message field is BetaMessage
      // BetaMessage.content is an array of content blocks
      const betaMessage = (message as Extract<SDKMessage, { type: "assistant" }>).message;
      if (betaMessage?.content) {
        for (const block of betaMessage.content) {
          if (block.type === "text") {
            prdMarkdown = block.text;
            process.stdout.write(chalk.blue(block.text));
          }
        }
        process.stdout.write("\n");
      }
    } else if (message.type === "result") {
      const resultMsg = message as Extract<SDKMessage, { type: "result" }>;
      if (resultMsg.subtype === "success") {
        // SDKResultSuccess has a `result` field
        const successMsg = resultMsg as Extract<
          Extract<SDKMessage, { type: "result" }>,
          { subtype: "success" }
        >;
        if (successMsg.result) {
          prdMarkdown = successMsg.result;
        }
      }
    }
  }

  if (!prdMarkdown) return null;

  // Extract project name from PRD markdown heading
  const nameMatch = prdMarkdown.match(/^#\s+(.+?)(?:\s*—|\s*-|\n)/m);
  const projectName = nameMatch ? nameMatch[1].trim() : "project";

  return { markdown: prdMarkdown, projectName };
}
