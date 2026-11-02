import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Tắt metadata theo luồng: trên trang động thẻ link bị đẩy vào <body>, Chrome và iOS bỏ qua manifest
  htmlLimitedBots: /.*/,
  // Ant Design 5 dùng nhiều sub-package; tối ưu import để giảm bundle
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },
  // Chỉ chạy phía server; argon2 là module native nên không đóng gói được
  serverExternalPackages: ['postgres', 'argon2', 'exceljs'],
};

export default nextConfig;
