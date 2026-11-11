import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite bringt eigene WASM-Dateien mit und darf nicht gebündelt werden.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Die App liegt in einem Unterordner eines Repos mit eigenem Lockfile.
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  // Kontoauszüge (CSV) werden per Server Action hochgeladen.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
