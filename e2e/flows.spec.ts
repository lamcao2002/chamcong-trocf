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

  await phone.goto('/m#/toi');
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
  await admin.getByRole('button', { name: /Công bố (phiếu lương|lại)$/ }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog.getByText(/sẽ thấy phiếu lương kỳ này/)).toBeVisible();
  await dialog.getByRole('button', { name: /^Công bố \d+ phiếu$/ }).click();
  await expect(admin.getByText(/^Đã công bố (lại )?phiếu lương$/)).toBeVisible();
  const periodCard = admin.getByRole('region', { name: 'Kỳ lương' });
  await expect(periodCard.getByText('Đã công bố', { exact: true })).toBeVisible();

  // Chọn một người rồi công bố lại riêng người đó
  await admin.getByRole('checkbox', { name: `Chọn ${staff.name}` }).check();
  await admin
    .getByRole('region', { name: 'Người đã chọn' })
    .getByRole('button', { name: /Công bố lại 1 người đã chọn$/ })
    .click();
  await admin
    .getByRole('dialog')
    .getByRole('button', { name: /^Công bố 1 phiếu$/ })
    .click();
  await expect(admin.getByText('Đã công bố phiếu lương cho 1 người')).toBeVisible();

  await phone.goto('/m#/luong');
  await expect(phone.getByRole('heading', { name: 'Phiếu lương' })).toBeVisible();
  await phone.locator('main button', { hasText: 'Công bố' }).first().click();
  const slip = phone.getByRole('dialog');
  await expect(slip.getByText('Thực lĩnh')).toBeVisible();
  await expect(slip.getByText(/bản đã công bố/)).toBeVisible();
  await slip.getByRole('button', { name: /Xem chi tiết \d+ ngày công$/ }).click();
  await expect(slip.getByRole('button', { name: /Ẩn chi tiết \d+ ngày công$/ })).toBeVisible();
  await expect(slip.getByRole('columnheader', { name: 'Ghi chú' })).toBeVisible();
  await expect(slip.getByRole('columnheader', { name: 'OT', exact: true })).toBeVisible();
  await expect(slip.getByRole('columnheader', { name: 'Ghi nhận' })).toHaveCount(0);
  await expect(slip.getByRole('columnheader', { name: 'Công', exact: true })).toHaveCount(0);
  await expect(slip.getByRole('columnheader', { name: 'Sau ca' })).toHaveCount(0);

  // Quản trị viên huỷ công bố: kỳ về Chưa công bố, nhân viên hết thấy phiếu
  await admin.getByRole('button', { name: /Huỷ công bố$/ }).click();
  await admin.locator('.ant-modal-confirm').getByRole('button', { name: 'Huỷ công bố' }).click();
  await expect(periodCard.getByText('Chưa công bố', { exact: true })).toBeVisible();
  await phone.reload();
  await expect(phone.locator('main button', { hasText: 'Công bố' })).toHaveCount(0);
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
  await admin.getByRole('button', { name: new RegExp(`^${staff.name}, `) }).click();
  await expect(admin.getByRole('dialog').getByText('Lần chấm')).toBeVisible();

  await admin.goto('/app/bang-cong?start=16');
  await expect(admin.getByText('Bắt đầu từ ngày')).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Kỳ này' })).toBeVisible();
});

test('Bảng công Theo tuần: Quản trị viên duyệt loạt ca Vắng, chọn cho đủ công', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);
  const yesterday = new Date(`${today()}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = yesterday.toISOString().slice(0, 10);
  await api.put('/api/v1/schedule', {
    data: { cells: [{ employeeId: staff.id, date, shiftIds: [staff.shiftId], isOff: false }] },
  });

  const admin = await adminPage(browser);
  await admin.goto(`/app/bang-cong?from=${date}&to=${date}&view=week`);
  await admin.getByLabel('Tìm tên').fill(staff.name);
  await admin.getByRole('button', { name: 'Duyệt loạt' }).click();
  await admin.getByRole('button', { name: new RegExp(`^${staff.name}, `) }).click();
  await admin.getByRole('button', { name: /Duyệt 1$/ }).click();
  const dialog = admin.getByRole('dialog');
  await expect(dialog.getByText('Có 1 ca Vắng')).toBeVisible();
  await dialog.getByLabel('Cho đủ công').check();
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();

  await expect(admin.getByText('Đã duyệt 1 việc')).toBeVisible();
  await expect(admin.getByText('1 công', { exact: true })).toBeVisible();
});

test('nhân viên đăng ký ca tuần sau, quản lý nhận ở kiểu Theo ca rồi công bố, chuông báo', async ({
  browser,
}) => {
  const api = await adminApi();
  const staff = await newStaff(api);

  const phone = await staffPage(browser, staff);
  await phone.goto('/m');
  await phone.getByRole('button', { name: 'Tạo đơn' }).click();
  const sheet = phone.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Đăng ký ca' }).click();
  await expect(sheet.getByText('Bấm ô để chọn')).toBeVisible();
  await sheet
    .getByRole('button', { name: new RegExp(`^Ca ${staff.tag}`) })
    .first()
    .click();
  await sheet.getByLabel('Ghi chú (không bắt buộc)').fill('Thứ Hai em làm được cả ngày');
  await sheet.getByRole('button', { name: /Gửi đăng ký · 1 ca/ }).click();
  await expect(phone.getByText('Đã gửi đăng ký')).toBeVisible();

  const admin = await adminPage(browser);
  const monday = new Date(`${today()}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
  await admin.goto(`/app/xep-ca?week=${monday.toISOString().slice(0, 10)}`);
  await admin.getByText('Theo ca', { exact: true }).click();
  await admin.getByRole('button', { name: new RegExp(`^E${staff.tag}, .*1 đăng ký chờ nhận`) }).click();
  await admin.getByRole('dialog').getByRole('button', { name: /Nhận$/ }).click();
  await expect(admin.getByText('Đã nhận 1 đăng ký vào nháp')).toBeVisible();
  await expect(admin.getByRole('dialog').getByText(staff.name)).toBeVisible();
  await admin.getByRole('dialog').getByRole('button', { name: 'Xong' }).click();

  await admin.getByRole('button', { name: /Công bố \(\d+\)/ }).click();
  await admin.locator('.ant-modal-confirm').getByRole('button', { name: 'Công bố' }).click();
  await expect(admin.getByText(/Đã công bố lịch của \d+ người/)).toBeVisible();

  await phone.reload();
  await phone.getByRole('button', { name: /Thông báo, 1 chưa đọc/ }).click();
  await expect(phone.getByText(/Lịch tuần .* đã công bố/)).toBeVisible();
});

test('nhân viên gửi đơn Muộn/sớm, quản lý thấy đúng nội dung trong Hộp việc', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);

  const phone = await staffPage(browser, staff);
  await phone.goto('/m');
  await phone.getByRole('button', { name: 'Tạo đơn' }).click();
  const sheet = phone.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Muộn / sớm' }).click();
  await sheet.getByLabel('Ngày').fill(today());
  await sheet.getByLabel('Số phút').fill('15');
  await sheet.getByLabel('Lý do').fill('Xe hỏng giữa đường');
  await sheet.getByRole('button', { name: 'Gửi đơn' }).click();
  await expect(phone.getByText('Đã gửi đơn')).toBeVisible();

  const admin = await adminPage(browser);
  await admin.goto('/app');
  await expect(admin.getByText('Xin đi trễ 15 phút · Cả ngày').first()).toBeVisible();
});

test('gắn thiết bị: máy khác bị chặn, Nhân sự mở khoá thì máy mới chấm được', async ({ browser }) => {
  const api = await adminApi();
  await api.patch('/api/v1/company', { data: { deviceBinding: true } });
  try {
    const staff = await newStaff(api);
    await scheduleToday(api, staff);
    const data = { lat: 21.02452, lng: 105.85308, accuracy: 10, chosenShiftId: staff.shiftId };

    const first = await staffPage(browser, staff);
    expect(
      (await first.context().request.post('/api/v1/app/punch', { data: { ...data, type: 'in' } })).status(),
    ).toBe(201);

    const second = await staffPage(browser, staff);
    await second.goto('/m');
    const blocked = await second
      .context()
      .request.post('/api/v1/app/punch', { data: { ...data, type: 'out' } });
    expect(blocked.status()).toBe(403);

    const admin = await adminPage(browser);
    await admin.goto('/app/nhan-su');
    await admin.getByRole('button', { name: new RegExp(staff.name) }).click();
    await admin.getByRole('button', { name: 'Mở khoá máy' }).click();
    await admin.locator('.ant-modal-confirm').getByRole('button', { name: 'Mở khoá máy' }).click();
    await expect(admin.getByText('Đã mở khoá máy')).toBeVisible();

    const login = await second.context().request.post('/api/v1/auth/app/login', {
      data: { companyCode: 'PHONHO', email: staff.email, pin: staff.pin },
    });
    expect(login.status()).toBe(200);
    expect(
      (await second.context().request.post('/api/v1/app/punch', { data: { ...data, type: 'out' } })).status(),
    ).toBe(201);
  } finally {
    await api.patch('/api/v1/company', { data: { deviceBinding: false } });
  }
});

test('Quản trị viên xoá nhân viên sau khi gõ lại email', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);

  const admin = await adminPage(browser);
  await admin.goto('/app/nhan-su');
  await admin.getByRole('button', { name: new RegExp(staff.name) }).click();
  await admin.getByRole('button', { name: /^(delete )?Xoá$/ }).click();

  const dialog = admin.getByRole('dialog', { name: new RegExp(`Xoá hẳn ${staff.name}`) });
  await expect(dialog.getByText('Không khôi phục được')).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Xoá vĩnh viễn' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Email xác nhận').fill(staff.email);
  await confirm.click();

  await expect(admin.getByText(`Đã xoá ${staff.name}`)).toBeVisible();
  await expect(admin.getByRole('button', { name: new RegExp(staff.name) })).toHaveCount(0);
});

test('nhân viên sửa rồi xoá đơn ở tab Tôi trong 10 phút đầu', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);
  const phone = await staffPage(browser, staff);
  const sent = await phone.context().request.post('/api/v1/app/requests', {
    data: {
      type: 'late_early',
      kind: 'late',
      date: today(),
      minutes: 15,
      shiftId: '',
      reason: 'Xe hỏng giữa đường',
    },
  });
  expect(sent.status()).toBe(201);

  await phone.goto('/m#/toi');
  await expect(phone.getByText(/Sửa, xoá được trong \d+ phút nữa/)).toBeVisible();
  await phone.getByRole('button', { name: /Sửa$/ }).click();
  const sheet = phone.getByRole('dialog');
  await expect(sheet.getByText('Sửa đơn')).toBeVisible();
  await expect(sheet.getByLabel('Số phút')).toHaveValue('15');
  await sheet.getByLabel('Số phút').fill('20');
  await sheet.getByRole('button', { name: /Lưu đơn/ }).click();
  await expect(phone.getByText('Đã sửa đơn')).toBeVisible();
  await expect(phone.getByText(/Xin đi trễ 20 phút/)).toBeVisible();

  await phone.getByRole('button', { name: /Xoá$/ }).click();
  await phone.locator('.ant-modal-confirm').getByRole('button', { name: 'Xoá đơn' }).click();
  await expect(phone.getByText('Đã xoá đơn')).toBeVisible();
  await expect(phone.getByText('Bạn chưa gửi đơn nào.')).toBeVisible();
});

test('quản lý xem lại lịch sử đơn ở Đơn từ, duyệt ngay trong chi tiết', async ({ browser }) => {
  const api = await adminApi();
  const staff = await newStaff(api);
  const phone = await staffPage(browser, staff);
  const sent = await phone.context().request.post('/api/v1/app/requests', {
    data: {
      type: 'late_early',
      kind: 'late',
      date: today(),
      minutes: 25,
      shiftId: '',
      reason: 'Đưa con đi học',
    },
  });
  expect(sent.status()).toBe(201);

  const admin = await adminPage(browser);
  await admin.goto('/app/don-tu');
  await admin.getByLabel('Tìm tên').fill(staff.name);
  await admin.getByRole('button', { name: new RegExp(`^${staff.name}, Muộn / sớm`) }).click();
  const drawer = admin.getByRole('dialog');
  await expect(drawer.getByText('Đưa con đi học')).toBeVisible();
  await drawer.getByRole('button', { name: /Duyệt$/ }).click();
  await expect(admin.getByText('Đã duyệt đơn')).toBeVisible();

  await admin.getByText(/^Đã duyệt \(\d+\)$/).click();
  const row = admin.getByRole('button', { name: new RegExp(`^${staff.name}, Muộn / sớm.*Đã duyệt$`) });
  await expect(row).toBeVisible();
  await expect(row.getByText(/Duyệt bởi Nguyễn Thu Hà lúc/)).toBeVisible();
});

test('nhân viên pass ca cho đồng nghiệp, người nhận đồng ý thì lịch đổi', async ({ browser }) => {
  const api = await adminApi();
  const giver = await newStaff(api);
  const taker = await newStaff(api);
  const tomorrow = new Date(Date.parse(`${today()}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const monday = new Date(`${tomorrow}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  await api.put('/api/v1/schedule', {
    data: { cells: [{ employeeId: giver.id, date: tomorrow, shiftIds: [giver.shiftId], isOff: false }] },
  });
  await api.post('/api/v1/schedule/publish', { data: { week: monday.toISOString().slice(0, 10) } });

  const phone = await staffPage(browser, giver);
  await phone.goto('/m');
  await phone.getByRole('button', { name: 'Tạo đơn' }).click();
  const sheet = phone.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Pass ca' }).click();
  await sheet.getByLabel('Ca của bạn').click();
  await phone
    .locator('.ant-select-item-option')
    .filter({ hasText: `Ca ${giver.tag}` })
    .click();
  await sheet.getByLabel('Pass cho').fill(taker.name);
  await phone.locator('.ant-select-item-option').filter({ hasText: taker.name }).click();
  await sheet.getByLabel('Lý do').fill('Có việc gia đình đột xuất');
  await sheet.getByRole('button', { name: 'Gửi đơn' }).click();
  await expect(phone.getByText('Đã gửi, chờ người nhận đồng ý')).toBeVisible();

  const other = await staffPage(browser, taker);
  await other.goto('/m#/toi');
  const box = other.getByRole('region', { name: 'Pass ca gửi tới bạn' });
  await expect(box.getByText(giver.name)).toBeVisible();
  await box.getByRole('button', { name: 'Nhận ca' }).click();
  await other.locator('.ant-modal-confirm').getByRole('button', { name: 'Nhận ca' }).click();
  await expect(other.getByText('Đã nhận ca, lịch của bạn đã cập nhật')).toBeVisible();

  await phone.goto('/m#/toi');
  await expect(phone.getByText('Đã nhận', { exact: true })).toBeVisible();
});
