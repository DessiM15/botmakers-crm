/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['square', 'resend', 'googleapis', '@upstash/redis'],
};

module.exports = nextConfig;
