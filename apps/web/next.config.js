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
    if (isServer) {
      // onnxruntime-web and @huggingface/transformers are browser-only;
      // excluding them from the server bundle prevents import.meta errors
      // during SSR compilation.
      config.externals.push(
        'onnxruntime-web',
        'onnxruntime-common',
        '@huggingface/transformers',
      );
    }

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Force @huggingface/transformers to use web version
        'onnxruntime-node': false,
        'sharp': false,
      };

      // onnxruntime-web ships .mjs files that use import.meta.url.
      // Telling webpack they are ESM ensures import.meta is replaced
      // before SWC's minifier sees the bundle (which would otherwise
      // throw "'import.meta' cannot be used outside of module code").
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules[/\\]onnxruntime/,
        type: 'javascript/esm',
        resolve: { fullySpecified: false },
      });

      // Serve WASM files as static assets
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });
    }

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
