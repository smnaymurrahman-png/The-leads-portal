import type { NextConfig } from 'next';
import path from 'node:path';

// Pin both Turbopack's root and Next's file-tracing root to the monorepo
// root (two levels up from apps/web). Without this, Vercel's prebuilt build
// wrapper sometimes infers a wrong root and can't resolve `next/package.json`.
const workspaceRoot = path.resolve(process.cwd(), '..', '..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared workspace package ships as TypeScript-compiled CommonJS;
  // transpiling it keeps the dev/build pipeline consistent.
  transpilePackages: ['@leads-portal/shared'],
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.leads-portal.net' }],
        destination: 'https://leads-portal.net/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
