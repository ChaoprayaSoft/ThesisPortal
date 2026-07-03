import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/firestore',
    'firebase-admin/auth',
    'firebase-admin/storage',
    'xlsx'
  ],
};

export default nextConfig;
