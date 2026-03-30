/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['square', 'resend', 'googleapis', '@upstash/redis', 'pdf-parse', 'mammoth'],
};

module.exports = nextConfig;
