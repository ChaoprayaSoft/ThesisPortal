import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa', 'xlsx'],
};

export default nextConfig;
