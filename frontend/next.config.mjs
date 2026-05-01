/** @type {import('next').NextConfig} */
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const proxyApiUrl =
  process.env.NODE_ENV === "development"
    ? rawApiUrl.replace("://localhost", "://127.0.0.1")
    : rawApiUrl;

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lvulwhyzdqqwpccksxem.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${proxyApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
