import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;

if (!BACKEND_URL) {
  throw new Error('BACKEND_URL or NEXT_PUBLIC_API_URL must be set');
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/oauth2/:path*',
        destination: `${BACKEND_URL}/oauth2/:path*`,
      },
      {
        source: '/login/oauth2/:path*',
        destination: `${BACKEND_URL}/login/oauth2/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${BACKEND_URL}/ws/:path*`,
      },
    ]
  },
};

export default nextConfig;
