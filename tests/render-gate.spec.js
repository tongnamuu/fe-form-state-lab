import { expect, test } from '@playwright/test';

for (const mode of ['broken', 'fixed']) {
  test(`${mode}: validate every intermediate render, not only the final error`, async ({ page }) => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let started;
    const began = new Promise(resolve => { started = resolve; });
    let listRequests = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/sessions') listRequests++; });
    await page.addInitScript(() => {
      window.exposed = false;
      new MutationObserver(() => { if (document.querySelector('[data-testid="workshop-list"]')) window.exposed = true; })
        .observe(document, { childList: true, subtree: true });
    });
    await page.route('**/api/ticket', async route => { started(); await held; await route.fulfill({ json: { accepted: false } }); });
    await page.goto(`/${mode}`);
    await page.getByRole('button', { name: '티켓 확인' }).click();
    await began;
    try {
      await expect(page.getByTestId('phase')).toHaveText('상태: checking');
      if (mode === 'broken') {
        await expect(page.getByTestId('workshop-list')).toBeVisible();
        await expect.poll(() => listRequests).toBeGreaterThan(0);
      } else {
        await expect(page.getByTestId('workshop-list')).toHaveCount(0);
      }
    } finally { release(); }
    await expect(page.getByText('등록되지 않은 티켓입니다.')).toBeVisible();
    await expect(page.getByTestId('workshop-list')).toHaveCount(0);
    expect(await page.evaluate(() => window.exposed)).toBe(mode === 'broken');
    if (mode === 'broken') expect(listRequests).toBeGreaterThan(0);
    else expect(listRequests).toBe(0);
  });
}
for (const ticket of ['TICKET7', 'EMPTY77']) {
  test(`fixed: actual API accepts ${ticket}`, async ({ page }) => {
    await page.goto('/fixed');
    await page.getByLabel('워크숍 티켓').fill(ticket);
    await page.getByRole('button', { name: '티켓 확인' }).click();
    await expect(page.getByTestId('phase')).toHaveText('상태: approved');
    if (ticket === 'TICKET7') await expect(page.getByText('Paper circuits', { exact: true })).toBeVisible();
    else await expect(page.getByText('예약할 워크숍이 없습니다.')).toBeVisible();
  });
}
test('server still refuses a direct unauthorized list request', async ({ request }) => {
  const response = await request.get('/api/sessions', { headers: { 'X-Demo-Ticket': 'NOENTRY' } });
  expect(response.status()).toBe(403);
});
