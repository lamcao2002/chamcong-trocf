import { defineConfig } from '@playwright/test';

/** Chạy trên app đang chạy (API_BASE_URL) với CSDL đã seed; `PW_CHANNEL=chrome` để dùng Chrome của máy. */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
    channel: process.env.PW_CHANNEL,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
});
