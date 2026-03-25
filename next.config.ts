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
  // Redirects for renamed routes
  async redirects() {
    return [
      {
        source: "/favorites",
        destination: "/saved-plays",
        permanent: true,
      },
    ];
  },
  // Dub Analytics and PostHog reverse proxy support
  async rewrites() {
    return [
      // Dub Analytics
      {
        source: "/_proxy/dub/track/:path*",
        destination: "https://api.dub.co/track/:path*",
      },
      {
        source: "/_proxy/dub/script.js",
        destination: "https://www.dubcdn.com/analytics/script.js",
      },
      // PostHog reverse proxy
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
