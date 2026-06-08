import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/macros/s/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, branches: ['MS', 'บางนา', 'มีนบุรี'] }),
    });
  });
});

test('guest app renders main routes without framework errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/create');

  await expect(page).toHaveTitle(/ShipTrack/);
  await expect(page.getByRole('heading', { name: /สร้างรายการส่ง/ }).first()).toBeVisible();
  await expect(page.getByPlaceholder('ระบุชื่อบริษัท หรือ ผู้ส่ง')).toBeVisible();

  await page.getByRole('link', { name: /ติดตามสถานะ/ }).first().click();
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.getByText('ค้นหาด้วยหมายเลขติดตาม ผู้รับ หรือปลายทาง')).toBeVisible();

  await page.getByRole('link', { name: /เข้าสู่ระบบพนักงาน/ }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบพนักงาน' })).toBeVisible();
  await expect(page.getByLabel('จำการเข้าสู่ระบบไว้บนอุปกรณ์นี้')).toBeVisible();

  expect(consoleErrors.filter(error => !error.includes('favicon'))).toEqual([]);
});

test('create page protects dirty drafts before navigation', async ({ page }) => {
  await page.goto('/create');

  const senderInput = page.getByPlaceholder('ระบุชื่อบริษัท หรือ ผู้ส่ง');
  await expect(senderInput).toBeVisible();
  await page.waitForTimeout(500);
  await senderInput.fill('บริษัททดสอบ');
  await expect(senderInput).toHaveValue('บริษัททดสอบ');
  await page.waitForFunction(() => sessionStorage.getItem('shiptrack:create_parcel_dirty') === 'true');
  await page.getByRole('link', { name: /ติดตามสถานะ/ }).first().click();

  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'มีข้อมูลที่กำลังกรอกค้างอยู่' })).toBeVisible();
  await page.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(page).toHaveURL(/\/create$/);
});
