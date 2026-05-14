/** @type {import('next').NextConfig} */
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const proxyApiUrl =
  process.env.NODE_ENV === "development"
    ? rawApiUrl.replace("://localhost", "://127.0.0.1")
    : rawApiUrl;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : "";

const nextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            port: "",
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
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
