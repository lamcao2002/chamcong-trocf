import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Ant Design 5 dùng nhiều sub-package; tối ưu import để giảm bundle
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },
  // Chỉ chạy phía server; argon2 là module native nên không đóng gói được
  serverExternalPackages: ['postgres', 'argon2'],
};

export default nextConfig;
