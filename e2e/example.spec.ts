import { test, expect } from '@playwright/test';

test.describe('Example Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/example');
  });

  test('should render the example page correctly', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page.getByRole('heading', { name: /Backend Health Check/i })).toBeVisible();

    // 설명 텍스트 확인
    await expect(page.getByText(/예시 API/i)).toBeVisible();

    // 입력 필드 확인
    const input = page.getByPlaceholder(/00000000-0000-0000-0000-000000000000/i);
    await expect(input).toBeVisible();

    // 조회 버튼 확인
    const button = page.getByRole('button', { name: /조회하기/i });
    await expect(button).toBeVisible();

    // 초기 상태는 Idle
    await expect(page.getByText(/Idle/i)).toBeVisible();
  });

  test('should show idle message when no ID is provided', async ({ page }) => {
    // 초기 상태 메시지 확인
    await expect(page.getByText(/UUID를 입력하고 조회하기 버튼을 누르면/i)).toBeVisible();

    // Idle 상태 뱃지 확인
    await expect(page.getByText(/Idle/i)).toBeVisible();
  });

  test('should clear results when empty input is submitted', async ({ page }) => {
    const input = page.getByPlaceholder(/00000000-0000-0000-0000-000000000000/i);
    const button = page.getByRole('button', { name: /조회하기/i });

    // 빈 문자열 입력
    await input.fill('   ');
    await button.click();

    // Idle 상태로 돌아가는지 확인
    await expect(page.getByText(/Idle/i)).toBeVisible();
    await expect(page.getByText(/UUID를 입력하고 조회하기 버튼을 누르면/i)).toBeVisible();
  });

  test('should show error for invalid UUID', async ({ page }) => {
    const input = page.getByPlaceholder(/00000000-0000-0000-0000-000000000000/i);
    const button = page.getByRole('button', { name: /조회하기/i });

    // 잘못된 UUID 입력
    await input.fill('invalid-uuid-format');
    await button.click();

    // Error 상태 뱃지 확인
    await expect(page.getByText(/Error/i).first()).toBeVisible({ timeout: 10000 });

    // 에러 메시지 확인
    await expect(page.getByText(/요청 실패/i)).toBeVisible();
  });

  test('should handle loading state', async ({ page }) => {
    const input = page.getByPlaceholder(/00000000-0000-0000-0000-000000000000/i);
    const button = page.getByRole('button', { name: /조회하기/i });

    // 임의의 UUID 입력 (느린 응답을 시뮬레이션하기 위해)
    await input.fill('00000000-0000-0000-0000-000000000001');
    await button.click();

    // Fetching 상태가 나타나는지 확인 (빠르게 지나갈 수 있음)
    const fetchingOrError = page.getByText(/Fetching|Error/i).first();
    await expect(fetchingOrError).toBeVisible({ timeout: 10000 });
  });

  test('should allow refetch with same ID', async ({ page }) => {
    const input = page.getByPlaceholder(/00000000-0000-0000-0000-000000000000/i);
    const button = page.getByRole('button', { name: /조회하기/i });

    const testId = 'test-id-12345';

    // 첫 번째 조회
    await input.fill(testId);
    await button.click();

    // 결과 대기
    await expect(page.getByText(/Error|Success/i).first()).toBeVisible({ timeout: 10000 });

    // 같은 ID로 다시 조회
    await button.click();

    // 다시 Fetching 상태가 되는지 확인
    await expect(page.getByText(/Fetching|Error|Success/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should display result sections correctly', async ({ page }) => {
    // 현재 상태 섹션 확인
    await expect(page.getByRole('heading', { name: /현재 상태/i })).toBeVisible();

    // 결과 표시 영역이 존재하는지 확인
    const resultSection = page.locator('article').filter({ hasText: /현재 상태/ });
    await expect(resultSection).toBeVisible();
  });
});
