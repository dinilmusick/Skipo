import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingExcludes: {
    '*': ['@swc/core', 'esbuild', 'terser', 'uglify-js', 'typescript'],
  },
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '.'),
      '@skipo/ui/theme': path.resolve(__dirname, 'src/libraries/skipo/ui/theme/index.ts'),
      '@skipo/ui': path.resolve(__dirname, 'src/libraries/skipo/ui/index.ts'),
      '@skipo/core': path.resolve(__dirname, 'src/libraries/skipo/core/index.ts'),
      '@skipo/backend': path.resolve(__dirname, 'src/libraries/skipo/backend/index.ts'),
      '@skipo/systems': path.resolve(__dirname, 'src/libraries/skipo/systems/index.ts'),
    };
    return config;
  },
};

export default nextConfig;
