import { expect, test, type Browser } from '@playwright/test';
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

test('quản lý công bố phiếu, nhân viên xem phiếu trong app', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);
  await scheduleToday(api, staff);

  const phone = await staffPage(browser, staff);
  const request = phone.context().request;
  for (const type of ['in', 'out']) {
    const punched = await request.post('/api/v1/app/punch', {
      data: { type, lat: 21.02452, lng: 105.85308, accuracy: 10, chosenShiftId: staff.shiftId },
    });
    expect(punched.status()).toBe(201);
  }

  const admin = await adminPage(browser);
  await admin.goto('/app/luong');
  await admin.getByRole('button', { name: /^Công bố (phiếu lương|lại)$/ }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog.getByText(/sẽ thấy phiếu lương kỳ này/)).toBeVisible();
  await dialog.getByRole('button', { name: /^Công bố \d+ phiếu$/ }).click();
  await expect(admin.getByText(/^Đã công bố (lại )?phiếu lương$/)).toBeVisible();
  await expect(admin.getByText('Đã công bố', { exact: true })).toBeVisible();

  await phone.goto('/m#/luong');
  await expect(phone.getByRole('heading', { name: 'Phiếu lương' })).toBeVisible();
  await phone.locator('main button', { hasText: 'Công bố' }).first().click();
  const slip = phone.getByRole('dialog');
  await expect(slip.getByText('Thực lĩnh')).toBeVisible();
  await expect(slip.getByText(/bản đã công bố/)).toBeVisible();
});

test('thêm hàng loạt: dán danh sách, xem trước, nhân viên đăng nhập bằng PIN vừa hiện', async ({
  browser,
}) => {
  const tag = Date.now().toString(36);
  const good = `lo-${tag}@phonho.vn`;
  const admin = await adminPage(browser);
  await admin.goto('/app/nhan-su');
  await admin.getByRole('button', { name: 'Thêm hàng loạt' }).click();

  const dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Danh sách nhân viên').fill(`Người Lô ${tag}\t${good}\tphuc vu\nThiếu Email, sai`);
  await expect(dialog.getByText('1 người sẵn sàng, 1 dòng bỏ qua.')).toBeVisible();
  await expect(dialog.getByText('Thiếu email hoặc email sai')).toBeVisible();
  await expect(dialog.getByText('Phục vụ')).toBeVisible();
  await dialog.getByRole('button', { name: 'Thêm 1 người' }).click();

  const result = admin.getByRole('dialog', { name: 'Đã thêm 1 người' });
  const pin = await result.locator('tbody strong').innerText();
  await result.getByRole('button', { name: 'Đã lưu PIN, đóng' }).click();
  await expect(admin.getByText(`Người Lô ${tag}`)).toBeVisible();

  const login = await (
    await adminApi()
  ).post('/api/v1/auth/app/login', {
    data: { companyCode: 'PHONHO', email: good, pin },
  });
  expect(login.status()).toBe(200);
});

/** Nhân viên chấm ngoài vùng hôm nay: một việc có đề xuất Duyệt vị trí. */
async function outOfZone(api: Awaited<ReturnType<typeof adminApi>>, browser: Browser) {
  const staff = await newStaff(api);
  await scheduleToday(api, staff);
  const phone = await staffPage(browser, staff);
  const punched = await phone.context().request.post('/api/v1/app/punch', {
    data: { type: 'in', lat: 21.1, lng: 105.9, accuracy: 10, chosenShiftId: staff.shiftId },
  });
  expect(punched.status()).toBe(201);
  return staff;
}

test('Hộp việc: tích nhiều việc rồi duyệt theo đề xuất', async ({ browser }) => {
  const api = await adminApi();
  const first = await outOfZone(api, browser);
  const second = await outOfZone(api, browser);

  const admin = await adminPage(browser);
  await admin.goto('/app');
  await admin.getByRole('checkbox', { name: new RegExp(`Chọn ${first.name}`) }).check();
  await admin.getByRole('checkbox', { name: new RegExp(`Chọn ${second.name}`) }).check();
  await admin.getByRole('button', { name: 'Duyệt theo đề xuất · 2' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Duyệt', exact: true }).click();

  await expect(admin.getByText('Đã duyệt 2 việc')).toBeVisible();
  await expect(admin.getByRole('button', { name: new RegExp(first.name) })).toHaveCount(0);
  await expect(admin.getByRole('button', { name: new RegExp(second.name) })).toHaveCount(0);
});

test('Bảng công: chọn ô cần duyệt rồi Duyệt loạt', async ({ browser }) => {
  const api = await adminApi();
  const staff = await outOfZone(api, browser);

  const admin = await adminPage(browser);
  await admin.goto('/app/bang-cong');
  await admin.getByLabel('Tìm tên').fill(staff.name);
  await admin.getByRole('button', { name: 'Duyệt loạt' }).click();
  await admin.getByRole('button', { name: 'Chọn mọi ô cần duyệt' }).click();
  await admin.getByRole('button', { name: /Duyệt 1$/ }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Duyệt', exact: true }).click();

  await expect(admin.getByText('Đã duyệt 1 việc')).toBeVisible();
  await expect(admin.getByRole('button', { name: 'Duyệt loạt' })).toBeDisabled();
});

test('Bảng công: Kỳ lệch, Tự chọn và Theo tuần', async ({ browser }) => {
  const api = await adminApi();
  const staff = await outOfZone(api, browser);

  const admin = await adminPage(browser);
  await admin.goto(`/app/bang-cong?from=${today()}&to=${today()}`);
  await expect(admin.getByText('Đây là khoảng xem, không phải kỳ lương')).toBeVisible();
  await expect(admin.getByRole('button', { name: 'Kỳ sau' })).toHaveCount(0);

  await admin.getByText('Theo tuần', { exact: true }).click();
  await expect(admin).toHaveURL(/view=week/);
  await admin.getByLabel('Tìm tên').fill(staff.name);
  await expect(admin.getByRole('button', { name: 'Duyệt loạt' })).toHaveCount(0);
  await admin.getByRole('button', { name: new RegExp(`^${staff.name}, `) }).click();
  await expect(admin.getByRole('dialog').getByText('Lần chấm')).toBeVisible();

  await admin.goto('/app/bang-cong?start=16');
  await expect(admin.getByText('Bắt đầu từ ngày')).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Kỳ này' })).toBeVisible();
});
