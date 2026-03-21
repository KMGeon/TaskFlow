const MAX_INPUT_LENGTH = 500;
const MAX_NAME_LENGTH = 100;
const FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

export function validateRequired(label: string) {
  return (value: string): true | string => {
    if (!value.trim()) {
      return `${label}은(는) 필수 입력입니다.`;
    }
    return true;
  };
}

export function validateName(label: string) {
  return (value: string): true | string => {
    if (!value.trim()) {
      return `${label}은(는) 필수 입력입니다.`;
    }
    if (value.length > MAX_NAME_LENGTH) {
      return `${label}은(는) ${MAX_NAME_LENGTH}자 이내로 입력해주세요.`;
    }
    if (FORBIDDEN_CHARS.test(value)) {
      return `${label}에 사용할 수 없는 문자가 포함되어 있습니다. (< > : " / \\ | ? *)`;
    }
    return true;
  };
}

export function validateCommaList(label: string) {
  return (value: string): true | string => {
    if (!value.trim()) {
      return `최소 하나의 ${label}을(를) 입력하세요.`;
    }
    if (value.length > MAX_INPUT_LENGTH) {
      return `입력이 너무 깁니다. ${MAX_INPUT_LENGTH}자 이내로 입력해주세요.`;
    }
    return true;
  };
}

export function validateOptional() {
  return (_value: string): true => true;
}
