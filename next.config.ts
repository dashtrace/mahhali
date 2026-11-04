import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server bundle for the Docker image.
  output: "standalone",
  // The preview shows an owner's unsaved look, only ever inside their own settings page.
  headers: async () => [{ source: "/preview/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] }],
};

export default nextConfig;
