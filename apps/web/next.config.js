/** @type {import('next').NextConfig} */
const path = require("path");
const withPWA = require("@ducanh2912/next-pwa").default;

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

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        "onnxruntime-web",
        "onnxruntime-node",
        "onnxruntime-common",
        "@huggingface/transformers",
        "sharp",
      );
    }

    if (!isServer) {
      const transformersEntry = require.resolve("@huggingface/transformers");
      const transformersDistDir = path.dirname(transformersEntry);
      const transformersWebBuild = path.join(
        transformersDistDir,
        "transformers.web.js",
      );

      config.resolve.alias = {
        ...config.resolve.alias,
        "@huggingface/transformers$": transformersWebBuild,
        "onnxruntime-node$": false,
        "sharp$": false,
      };

      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules[/\\]onnxruntime/,
        type: "javascript/esm",
        resolve: { fullySpecified: false },
      });
    }

    return config;
  },

  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "node_modules/.pnpm/onnxruntime-node@*/**",
        "node_modules/onnxruntime-node/**",
        "node_modules/.pnpm/@img+sharp*/**",
        "node_modules/.pnpm/sharp@*/**",
        "node_modules/@img/**",
        "node_modules/sharp/**",
        "node_modules/.pnpm/@huggingface+transformers@*/**",
        "node_modules/@huggingface/transformers/**",
      ],
    },
  },
};

module.exports = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  // Don't force-reload when coming back online — the app works offline
  // and a hard reload would discard any unsaved in-memory state.
  reloadOnOnline: false,
  // Keep SW active in development so offline behaviour can be tested locally.
  disable: false,
  workboxOptions: {
    disableDevLogs: true,
    // Offline fallback: serve cached shell for any navigation request that
    // fails while offline, instead of showing a browser error page.
    navigateFallback: "/offline",
    navigateFallbackDenylist: [
      // Don't intercept API routes — they should fail gracefully in the app.
      /^\/api\//,
      // Don't intercept auth confirm callback (needs network).
      /^\/auth\//,
    ],
    runtimeCaching: [
      // API routes: network-first with offline fallback to avoid hard crashes.
      {
        urlPattern: /^\/api\//,
        handler: "NetworkOnly",
      },
    ],
  },
})(nextConfig);