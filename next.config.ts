import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite is only used by tests; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
