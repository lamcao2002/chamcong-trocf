import { expect, test } from '@playwright/test';
import { adminApi, adminPage, newStaff, scheduleToday, staffPage, today } from './helpers';

test('quản lý xếp ca, nhân viên chấm công, Bảng công có ngày công', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);

  const admin = await adminPage(browser);
  await admin.goto('/app/xep-ca');
  await admin
    .getByRole('button', { name: new RegExp(staff.name) })
    .first()
    .click();
  const weekday = (new Date(`${today()}T00:00:00Z`).getUTCDay() + 6) % 7;
  await admin.getByRole('dialog').locator('.ant-tag-checkable').nth(weekday).click();
  await admin.getByRole('button', { name: 'Xong' }).click();
  await admin.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(admin.getByText('Đã lưu lịch')).toBeVisible();

  const phone = await staffPage(browser, staff);
  await phone.goto('/m');
  await expect(phone.getByText(/Trong vùng ·/)).toBeVisible();
  await phone.getByRole('button', { name: 'VÀO CA' }).click();
  await expect(phone.getByText(/Đã vào ca lúc/)).toBeVisible();
  await expect(phone.getByRole('button', { name: 'RA CA' })).toBeVisible();
  await phone.getByRole('button', { name: 'RA CA' }).click();
  await expect(phone.getByText(/Đã ra ca lúc/)).toBeVisible();

  await admin.goto('/app/bang-cong');
  await admin.getByLabel('Tìm tên').fill(staff.name);
  await expect(admin.getByRole('button', { name: new RegExp(staff.name) }).first()).toBeVisible();
});

test('duyệt hết một việc trong Hộp việc', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);
  await scheduleToday(api, staff);

  const phone = await staffPage(browser, staff);
  const punched = await phone.context().request.post('/api/v1/app/punch', {
    data: { type: 'in', lat: 21.1, lng: 105.9, accuracy: 10, chosenShiftId: staff.shiftId },
  });
  expect(punched.status()).toBe(201);

  const admin = await adminPage(browser);
  await admin.goto('/app');
  await admin
    .getByRole('button', { name: new RegExp(staff.name) })
    .first()
    .click();
  await admin.getByRole('button', { name: 'Duyệt vị trí', exact: true }).click();
  await expect(admin.getByText('Đã duyệt', { exact: true })).toBeVisible();
  await expect(admin.getByRole('button', { name: new RegExp(staff.name) })).toHaveCount(0);
});

test('nhân viên gửi đơn quên chấm, quản lý duyệt, app thấy trạng thái', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);

  const phone = await staffPage(browser, staff);
  await phone.goto('/m');
  await phone.getByRole('button', { name: 'Tạo đơn' }).click();
  const sheet = phone.getByRole('dialog');
  await sheet.getByText('Quên chấm').click();
  await sheet.getByLabel('Ngày').fill(today());
  await sheet.getByLabel('Ca').click();
  await phone.locator('.ant-select-item-option').first().click();
  await sheet.getByLabel('Giờ vào thực tế').fill('00:05');
  await sheet.getByLabel('Lý do').fill('Quên bấm khi vào ca');
  await sheet.getByRole('button', { name: 'Gửi đơn' }).click();
  await expect(phone.getByText('Đã gửi đơn')).toBeVisible();

  const admin = await adminPage(browser);
  await admin.goto('/app');
  await admin
    .getByRole('button', { name: new RegExp(staff.name) })
    .first()
    .click();
  await admin.getByRole('button', { name: 'Duyệt đơn' }).click();
  await expect(admin.getByText('Đã duyệt đơn')).toBeVisible();

  await phone.goto('/m#/lich');
  await expect(phone.getByText('Đơn của tôi')).toBeVisible();
  await expect(phone.getByText('Đã duyệt', { exact: true })).toBeVisible();
});
