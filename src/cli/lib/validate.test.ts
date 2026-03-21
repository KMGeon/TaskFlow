import { describe, expect, it } from "vitest";
import {
  validateRequired,
  validateName,
  validateCommaList,
  validateOptional,
} from "./validate.js";

describe("validateRequired", () => {
  const validate = validateRequired("프로젝트명");

  it("값이 있으면 true를 반환해야 한다", () => {
    expect(validate("TaskFlow")).toBe(true);
  });

  it("빈 값이면 에러 메시지를 반환해야 한다", () => {
    expect(validate("")).toContain("필수 입력");
  });

  it("공백만 있으면 에러 메시지를 반환해야 한다", () => {
    expect(validate("   ")).toContain("필수 입력");
  });

  it("에러 메시지에 라벨이 포함되어야 한다", () => {
    expect(validate("")).toContain("프로젝트명");
  });
});

describe("validateName", () => {
  const validate = validateName("기능명");

  it("일반 이름은 통과해야 한다", () => {
    expect(validate("사용자-인증")).toBe(true);
  });

  it("빈 값이면 에러를 반환해야 한다", () => {
    expect(validate("")).toContain("필수 입력");
  });

  it("100자 초과 시 에러를 반환해야 한다", () => {
    const long = "a".repeat(101);
    expect(validate(long)).toContain("100자 이내");
  });

  it("100자 이하는 통과해야 한다", () => {
    expect(validate("a".repeat(100))).toBe(true);
  });

  it("금지 문자 포함 시 에러를 반환해야 한다", () => {
    expect(validate("name<bad>")).toContain("사용할 수 없는 문자");
    expect(validate('name"bad')).toContain("사용할 수 없는 문자");
    expect(validate("name|bad")).toContain("사용할 수 없는 문자");
    expect(validate("name?bad")).toContain("사용할 수 없는 문자");
  });

  it("허용 문자는 통과해야 한다", () => {
    expect(validate("auth-module_v2")).toBe(true);
    expect(validate("한글기능")).toBe(true);
  });
});

describe("validateCommaList", () => {
  const validate = validateCommaList("요구사항");

  it("값이 있으면 통과해야 한다", () => {
    expect(validate("항목1, 항목2")).toBe(true);
  });

  it("빈 값이면 에러를 반환해야 한다", () => {
    expect(validate("")).toContain("최소 하나");
  });

  it("500자 초과 시 에러를 반환해야 한다", () => {
    const long = "a".repeat(501);
    expect(validate(long)).toContain("500자 이내");
  });
});

describe("validateOptional", () => {
  const validate = validateOptional();

  it("빈 값도 통과해야 한다", () => {
    expect(validate("")).toBe(true);
  });

  it("값이 있어도 통과해야 한다", () => {
    expect(validate("something")).toBe(true);
  });
});
