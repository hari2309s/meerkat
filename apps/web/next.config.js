/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@meerkat/types",
    "@meerkat/config",
    "@meerkat/ui",
    "@meerkat/utils",
    "@meerkat/crdt",
    "@meerkat/voice",
    "@meerkat/database",
    "@meerkat/shared",
    "@meerkat/mood-analyzer",
    "@meerkat/analyzer",
    "@meerkat/local-store",
    "@meerkat/p2p",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    // Exclude Node.js native bindings from client bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Force @huggingface/transformers to use web version
        'onnxruntime-node': false,
        'sharp': false,
      };

      // Handle onnxruntime-web as external assets
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });

      // Suppress critical dependency warnings for dynamic requires in onnxruntime
      config.plugins.push(
        new webpack.ContextReplacementPlugin(
          /onnxruntime-web/,
          (data) => {
            delete data.dependencies[0].critical;
            return data;
          }
        )
      );
    }

    // Exclude onnxruntime assets from optimization
    config.optimization = config.optimization || {};
    config.optimization.minimizer = config.optimization.minimizer || [];

    config.externals.push({
      "utf-8-validate": "commonjs utf-8-validate",
      bufferutil: "commonjs bufferutil",
      "onnxruntime-node": "commonjs onnxruntime-node",
    });

    // Fix for transformers.js URL resolution
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  async headers() {
    return [
      {
        // Required for SharedArrayBuffer (used by WASM/Whisper multi-threading)
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
