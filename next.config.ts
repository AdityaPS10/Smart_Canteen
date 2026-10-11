import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow opening the dev server through an HTTPS tunnel (phones need HTTPS for the camera).
  allowedDevOrigins: ["*.trycloudflare.com"],
  // PGlite is only used by tests; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
