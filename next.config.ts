import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The route indicator sits over the app's sidebar footer and would show in
  // screen recordings. Compile and runtime errors still surface.
  devIndicators: false,
};

export default nextConfig;
