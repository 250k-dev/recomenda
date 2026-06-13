import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      "date-fns/locale": "date-fns/locale.js",
    },
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
