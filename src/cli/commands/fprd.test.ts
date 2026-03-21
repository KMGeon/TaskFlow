import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { registerFprdCommand } from "./fprd.js";

describe("registerFprdCommand", () => {
  function createProgram() {
    const program = new Command();
    program.exitOverride();
    registerFprdCommand(program);
    return program;
  }

  it("fprd 명령이 등록되어야 한다", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "fprd");
    expect(cmd).toBeDefined();
  });

  it("fprd 명령의 description이 한국어로 설정되어야 한다", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "fprd");
    expect(cmd?.description()).toContain("기능별 PRD");
  });

  it("--help 출력에 사용 예시가 포함되어야 한다", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "fprd")!;

    let output = "";
    cmd.configureOutput({
      writeOut: (str) => { output += str; },
      writeErr: (str) => { output += str; },
    });

    try {
      cmd.parse(["--help"], { from: "user" });
    } catch {
      // exitOverride
    }

    expect(output).toContain("사용 예시");
    expect(output).toContain("task fprd");
    expect(output).toContain("저장 경로");
  });

  it("prd/init 명령과 충돌하지 않아야 한다", async () => {
    const { registerInitCommand } = await import("./init.js");
    const { registerPrdCommand } = await import("./prd.js");
    const program = new Command();
    program.exitOverride();

    registerInitCommand(program);
    registerPrdCommand(program);
    registerFprdCommand(program);

    const names = program.commands.map((c) => c.name());
    expect(names).toContain("init");
    expect(names).toContain("prd");
    expect(names).toContain("fprd");
    expect(new Set(names).size).toBe(names.length);
  });

  it("action 핸들러가 연결되어 있어야 한다", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "fprd")!;
    expect((cmd as any)._actionHandler).toBeDefined();
  });
});
