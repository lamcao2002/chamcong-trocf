import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Ant Design 5 dùng nhiều sub-package; tối ưu import để giảm bundle
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },
  // `postgres` chỉ chạy phía server, không đóng gói vào client
  serverExternalPackages: ['postgres'],
};

export default nextConfig;
