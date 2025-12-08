import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.nba.com",
        pathname: "/headshots/nba/latest/**",
      },
    ],
  },
  // Dub Analytics reverse proxy support
  async rewrites() {
    return [
      {
        source: "/_proxy/dub/track/:path*",
        destination: "https://api.dub.co/track/:path*",
      },
      {
        source: "/_proxy/dub/script.js",
        destination: "https://www.dubcdn.com/analytics/script.js",
      },
    ];
  },
};

export default nextConfig;
