import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  turbopack: { root: process.cwd() },
  // Several root layouts (one per area), so unmatched URLs use app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  // The previous app's Usage page lived at /analytics.
  redirects: async () => [{ source: "/analytics", destination: "/usage", permanent: true }],
};

export default nextConfig;

initOpenNextCloudflareForDev();
