import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        // When the browser asks Vercel for /api/something...
        source: '/api/:path*',
        // ...Vercel secretly fetches it from your DigitalOcean server
        destination: 'http://134.122.7.82:8080/api/:path*', 
      },
    ]
  },
};

export default nextConfig;
