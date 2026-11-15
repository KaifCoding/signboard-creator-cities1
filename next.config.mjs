/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // konva ships an optional node-canvas require that must not be bundled for the browser
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
  experimental: { serverComponentsExternalPackages: ['pngjs'] },
};
export default nextConfig;
