import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid "inferred workspace root" warning when multiple lockfiles exist (e.g. monorepo parent)
  turbopack: { root: process.cwd() },
};

export default nextConfig;
