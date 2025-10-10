// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['scontent.fmnl13-4.fna.fbcdn.net'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'scontent.fmnl13-4.fna.fbcdn.net',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // ✅ Important for styled-components in production
  compiler: {
    styledComponents: true,
  },
};

module.exports = nextConfig;
