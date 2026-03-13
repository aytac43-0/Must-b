/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'http://localhost:4310/:path*',
      },
    ];
  },
};

export default nextConfig;
