import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 10mb. Fridge photos are resized client-side before upload
    // (see lib/image.ts), but this gives headroom for anything that slips
    // through instead of the request silently truncating mid-JSON.
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
