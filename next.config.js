// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Don't forbid embedding
          { key: "X-Frame-Options", value: "ALLOWALL" },
          // Explicitly allow Warpcast/Farcaster to iframe your pages
          {
            key: "Content-Security-Policy",
            // add your own domains as needed, keep 'self'
            value:
              "frame-ancestors 'self' https://warpcast.com https://*.warpcast.com https://farcaster.xyz https://*.farcaster.xyz;",
          },
        ],
      },
    ];
  },

  // Fix optional/node-only deps that some wallet/logging libs pull in
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

module.exports = nextConfig;
