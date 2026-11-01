import { defineConfig } from 'vitest/config';

/** Test API qua HTTP: cần app đang chạy (API_BASE_URL) trên CSDL đã migrate + seed. Xem tests/api/helpers.ts. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/api/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
