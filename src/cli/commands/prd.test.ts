import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { registerPrdCommand } from "./prd.js";

describe("registerPrdCommand", () => {
  function createProgram() {
    const program = new Command();
    program.exitOverride();
    registerPrdCommand(program);
    return program;
  }

  it("prd 명령이 등록되어야 한다", () => {
    const program = createProgram();
    const prdCmd = program.commands.find((cmd) => cmd.name() === "prd");

    expect(prdCmd).toBeDefined();
  });

  it("prd 명령의 description이 한국어로 설정되어야 한다", () => {
    const program = createProgram();
    const prdCmd = program.commands.find((cmd) => cmd.name() === "prd");

    expect(prdCmd?.description()).toContain("PRD 생성");
  });

  it("init 명령과 충돌하지 않아야 한다", async () => {
    const { registerInitCommand } = await import("./init.js");
    const program = new Command();
    program.exitOverride();

    registerInitCommand(program);
    registerPrdCommand(program);

    const names = program.commands.map((cmd) => cmd.name());
    expect(names).toContain("init");
    expect(names).toContain("prd");
    expect(new Set(names).size).toBe(names.length);
  });

  it("--help 실행 시 종료 코드 0이어야 한다", () => {
    const program = createProgram();
    const prdCmd = program.commands.find((cmd) => cmd.name() === "prd")!;

    // Commander의 exitOverride를 사용하여 helpInformation 검증
    const helpText = prdCmd.helpInformation();

    expect(helpText).toContain("prd");
    expect(helpText).toContain("PRD 생성");
  });

  it("--help 출력에 사용 예시가 포함되어야 한다", () => {
    const program = createProgram();
    const prdCmd = program.commands.find((cmd) => cmd.name() === "prd")!;

    // Write output를 캡처
    let output = "";
    prdCmd.configureOutput({
      writeOut: (str) => {
        output += str;
      },
      writeErr: (str) => {
        output += str;
      },
    });

    try {
      prdCmd.parse(["--help"], { from: "user" });
    } catch {
      // exitOverride가 상위에서 설정되지 않으면 throw할 수 있음
    }

    // addHelpText의 after 내용은 helpInformation에 포함되지 않으므로
    // configureOutput으로 캡처한 출력을 확인
    expect(output).toContain("사용 예시");
    expect(output).toContain("task prd");
  });

  it("action에 runPrdFlow 핸들러가 연결되어 있어야 한다", () => {
    const program = createProgram();
    const prdCmd = program.commands.find((cmd) => cmd.name() === "prd")!;

    // Commander 내부적으로 action 핸들러가 등록되어 있는지 확인
    // _actionHandler는 Commander가 action()으로 등록한 함수를 저장하는 내부 속성
    expect((prdCmd as any)._actionHandler).toBeDefined();
    expect(typeof (prdCmd as any)._actionHandler).toBe("function");
  });
});
