import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Allow phones/tablets on the local Wi-Fi to hydrate dev JS.
  // (Next 16 blocks cross-origin /_next/* requests by default in dev.)
  allowedDevOrigins: [
    "192.168.68.101",
    "192.168.1.*",
    "192.168.0.*",
    "192.168.68.*",
    "10.0.0.*",
    "localhost",
  ],
  images: {
    remotePatterns: [
      supabaseHost
        ? {
            protocol: "https" as const,
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          }
        : {
            protocol: "https" as const,
            hostname: "*.supabase.co",
            pathname: "/storage/v1/object/public/**",
          },
      {
        protocol: "https" as const,
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
