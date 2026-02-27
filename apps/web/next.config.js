/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  output: "standalone",
  reactStrictMode: false
};

export default nextConfig;
