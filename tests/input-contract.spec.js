import { expect, test } from '@playwright/test';

test('broken: Unicode in a header fails before the API is requested', async ({ page }) => {
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/ticket')) calls++; });
  await page.goto('/broken');
  await page.getByRole('button', { name: '티켓 확인' }).click();
  await expect(page.getByTestId('result')).toContainText(/ByteString|ISO-8859-1|code point|character/i);
  expect(calls).toBe(0);
});
test('fixed: Unicode is sent as JSON and the API reports format failure', async ({ page }) => {
  await page.goto('/fixed');
  const outgoing = page.waitForRequest('**/api/ticket');
  await page.getByRole('button', { name: '티켓 확인' }).click();
  const request = await outgoing;
  expect(request.postDataJSON().ticket).toBe('한글티켓');
  expect(request.headers()['x-demo-ticket']).toBeUndefined();
  await expect(page.getByTestId('result')).toHaveText('올바른 티켓 형식이 아닙니다.');
});
for (const mode of ['broken', 'fixed']) {
  test(`${mode}: syntactically valid but unknown ticket has a distinct meaning`, async ({ page }) => {
    await page.goto(`/${mode}`);
    await page.getByLabel('워크숍 티켓').fill('NOENTRY');
    await page.getByRole('button', { name: '티켓 확인' }).click();
    await expect(page.getByTestId('result')).toHaveText(mode === 'fixed' ? '등록되지 않은 티켓입니다.' : '영문 대문자와 숫자 7자로 입력해주세요.');
  });
  test(`${mode}: HTML error responses must not become user-facing markup text`, async ({ page }) => {
    await page.goto(`/${mode}`);
    await page.getByLabel('워크숍 티켓').fill('TICKET7');
    await page.getByLabel('502 HTML 응답 재현').check();
    await page.getByRole('button', { name: '티켓 확인' }).click();
    await expect(page.getByTestId('result')).toContainText(mode === 'fixed' ? '일시적으로 요청을 처리하지 못했습니다.' : '<!doctype html>');
  });
  test(`${mode}: clearing the field must also clear the applied search`, async ({ page }) => {
    await page.goto(`/${mode}`);
    await page.getByLabel('이름·카테고리 검색').fill('nothing-matches');
    await page.getByRole('button', { name: '검색', exact: true }).click();
    await expect(page.getByText('검색 결과가 없습니다.', { exact: true })).toBeVisible();
    await page.getByLabel('이름·카테고리 검색').fill('');
    await expect(page.getByRole('region', { name: '검색 결과' }).getByRole('article')).toHaveCount(mode === 'fixed' ? 2 : 0);
  });
}
test('fixed: clear button resets a category search', async ({ page }) => {
  await page.goto('/fixed');
  await page.getByLabel('이름·카테고리 검색').fill('Animation');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.getByRole('region', { name: '검색 결과' }).getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(page.getByRole('region', { name: '검색 결과' }).getByRole('article')).toHaveCount(2);
});
for (const failure of ['network', 'bad-json']) {
  test(`fixed: ${failure} becomes a retry message`, async ({ page }) => {
    await page.route('**/api/ticket', route => failure === 'network' ? route.abort() : route.fulfill({ contentType: 'application/json', body: 'not json' }));
    await page.goto('/fixed');
    await page.getByLabel('워크숍 티켓').fill('TICKET7');
    await page.getByRole('button', { name: '티켓 확인' }).click();
    await expect(page.getByTestId('result')).toHaveAttribute('data-kind', 'unavailable');
    await expect(page.getByTestId('result')).toHaveText('일시적으로 요청을 처리하지 못했습니다. 다시 시도해주세요.');
  });
}
test('fixed: actual API accepts the registered ticket', async ({ page }) => {
  await page.goto('/fixed');
  await page.getByLabel('워크숍 티켓').fill('TICKET7');
  await page.getByRole('button', { name: '티켓 확인' }).click();
  await expect(page.getByTestId('result')).toHaveAttribute('data-kind', 'accepted');
});
for (const ticket of [' TICKET7', 'TICKET7 ', 'TICK ET', '티켓12345', 'TICKET7\n']) {
  test(`API rejects the exact unnormalized input ${JSON.stringify(ticket)}`, async ({ request }) => {
    const response = await request.post('/api/ticket', { data: { ticket, delayMs: 0 } });
    expect(response.status()).toBe(400);
  });
}
