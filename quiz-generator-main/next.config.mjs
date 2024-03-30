/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          net: false,
          dns: false,
          tls: false,
          fs: false,
          request: false,
          child_process: false,
        },
      };
    }
    config.externals.push({ canvas: "commonjs canvas" });
    return config;
  },
};

export default nextConfig;
