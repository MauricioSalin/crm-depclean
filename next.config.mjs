/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.15.7'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
