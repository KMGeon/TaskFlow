import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { ensureRepo } from "../../features/taskflow/lib/repository.js";
import { getAdvisorDbPath } from "../../features/taskflow/constants.js";
import { AdvisorDb } from "../../features/taskflow/lib/advisor/db.js";
import { buildContext } from "../../features/taskflow/lib/advisor/context-builder.js";
import { getAnswer } from "../../features/taskflow/lib/advisor/ai-advisor.js";

export function registerAskCommand(program: Command) {
  program
    .command("ask")
    .description("AI 비서에게 프로젝트에 대해 자유롭게 질문합니다")
    .argument("<question>", "질문 내용")
    .action(
      withCliErrorBoundary(async (question: string) => {
        const projectRoot = process.cwd();
        await ensureRepo(projectRoot);

        const spinner = ora("답변 생성 중...").start();

        try {
          const db = await AdvisorDb.open(getAdvisorDbPath(projectRoot));
          const context = await buildContext({
            command: "ask",
            projectRoot,
            db,
            question,
          });

          const answer = await getAnswer(context, question);

          const sessionId = `ask-${Date.now()}`;
          db.insertLog("ask", sessionId, "user", question);
          db.insertLog("ask", sessionId, "assistant", answer);
          db.persistToDiskAsync();
          db.close();

          spinner.stop();
          console.log("");
          console.log(answer);
          console.log("");
        } catch {
          spinner.stop();
          console.log(chalk.red("AI 연결 실패. 잠시 후 다시 시도해주세요."));
        }
      })
    );
}
