import { expect, test } from '@playwright/test';

for (const mode of ['broken', 'fixed']) {
  test(`${mode}: close after response parsing, before uncancellable processing ends`, async ({ page }) => {
    await page.clock.install();
    await page.route('**/api/ticket', route => route.fulfill({ json: { accepted: true } }));
    await page.goto(`/${mode}`);
    await page.getByRole('button', { name: '티켓 확인' }).click();
    await expect(page.getByTestId('dialog-phase')).toHaveText('상태: processing');
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.clock.runFor(700);
    if (mode === 'broken') await expect(page.getByTestId('ticket-list')).toBeVisible();
    else {
      await expect(page.getByTestId('ticket-list')).toHaveCount(0);
      await expect(page).toHaveURL(/\/fixed$/);
      await expect(page.getByTestId('phase')).toHaveText('상태: editing');
    }
  });
  test(`${mode}: clearing a temporary dialog and selecting a public route have different reload contracts`, async ({ page }) => {
    await page.goto(`/${mode}`);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '공개 워크숍 보기' }).click();
    await expect(page.getByTestId('public-list')).toBeVisible();
    await page.reload();
    if (mode === 'fixed') {
      await expect(page).toHaveURL(/\/fixed\/open$/);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByTestId('public-list')).toBeVisible();
    } else await expect(page.getByRole('dialog')).toBeVisible();
  });
}

test('fixed: an old finally cannot end the next request loading state', async ({ page }) => {
  await page.clock.install();
  let release, started;
  const held = new Promise(resolve => { release = resolve; });
  const began = new Promise(resolve => { started = resolve; });
  await page.route('**/api/ticket', async route => {
    if (route.request().postDataJSON().ticket === 'TICKET7') await route.fulfill({ json: { accepted: true } });
    else { started(); await held; await route.fulfill({ json: { accepted: false } }); }
  });
  await page.goto('/fixed');
  await page.getByRole('button', { name: '티켓 확인' }).click();
  await expect(page.getByTestId('dialog-phase')).toHaveText('상태: processing');
  await page.getByLabel('티켓', { exact: true }).fill('NOENTRY');
  await page.getByRole('button', { name: '티켓 확인' }).click();
  await began;
  try {
    await page.clock.runFor(700);
    await expect(page.getByTestId('dialog-phase')).toHaveText('상태: checking');
    await expect(page.getByRole('button', { name: '티켓 확인' })).toBeDisabled();
    await expect(page).toHaveURL(/\/fixed$/);
  } finally { release(); }
  await expect(page.getByTestId('dialog-phase')).toHaveText('상태: processing');
  await page.clock.runFor(700);
  await expect(page.getByRole('alert').filter({ hasText: '등록되지 않은 티켓' })).toBeVisible();
});

test('fixed: public navigation invalidates an in-progress result', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/ticket', route => route.fulfill({ json: { accepted: true } }));
  await page.goto('/fixed');
  await page.getByRole('button', { name: '티켓 확인' }).click();
  await expect(page.getByTestId('dialog-phase')).toHaveText('상태: processing');
  await page.getByRole('button', { name: '공개 워크숍 보기' }).click();
  await page.clock.runFor(700);
  await expect(page).toHaveURL(/\/fixed\/open$/);
  await expect(page.getByTestId('public-list')).toBeVisible();
  await expect(page.getByTestId('ticket-list')).toHaveCount(0);
});

test('fixed: ticket URL reload revalidates before rendering, without reopening the chooser', async ({ page }) => {
  await page.goto('/fixed');
  await page.getByRole('button', { name: '티켓 확인' }).click();
  await expect(page.getByTestId('ticket-list')).toBeVisible();
  await expect(page).toHaveURL(/\/fixed\/ticket$/);
  let release, started;
  const held = new Promise(resolve => { release = resolve; });
  const began = new Promise(resolve => { started = resolve; });
  await page.route('**/api/ticket', async route => { started(); await held; await route.fulfill({ json: { accepted: true } }); });
  await page.reload(); await began;
  try {
    await expect(page.getByTestId('ticket-list')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally { release(); }
  await expect(page.getByTestId('ticket-list')).toBeVisible();
});

test('fixed: direct ticket URL with no stored selection asks for input', async ({ page }) => {
  await page.goto('/fixed/ticket');
  await expect(page.getByRole('alert').filter({ hasText: '티켓을 다시 입력해주세요.' })).toBeVisible();
  await expect(page.getByTestId('ticket-list')).toHaveCount(0);
});

test('fixed: sign-in error route has no chooser', async ({ page }) => {
  await page.goto('/fixed/sign-in-error');
  await expect(page.getByRole('heading', { name: '로그인 요청을 완료하지 못했습니다.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
