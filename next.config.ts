// next.config.js
import type { NextConfig } from "next";

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
}

module.exports = nextConfig