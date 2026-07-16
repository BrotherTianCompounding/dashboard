import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this folder. Otherwise Turbopack can infer the
  // parent directory as root and fail to resolve deps (e.g. tailwindcss) in
  // `next dev`. This has no effect on the production build output.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
