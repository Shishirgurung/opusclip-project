import path from 'path';
import fs from 'fs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  typescript: {
    // Do not ignore build errors: fail build on any TypeScript error
    ignoreBuildErrors: false,
  },
  experimental: {
    // Enable ES module external handling for better ESM compatibility
    esmExternals: true,
  },
};

export default nextConfig;