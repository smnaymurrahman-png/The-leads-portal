import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared workspace package ships as TypeScript-compiled CommonJS;
  // transpiling it keeps the dev/build pipeline consistent.
  transpilePackages: ['@leads-portal/shared'],
};

export default nextConfig;
