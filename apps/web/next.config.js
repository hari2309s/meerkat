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
      // onnxruntime-web and @huggingface/transformers are browser-only;
      // excluding them from the server bundle prevents import.meta errors
      // during SSR compilation.
      config.externals.push(
        "onnxruntime-web",
        "onnxruntime-node",
        "onnxruntime-common",
        "@huggingface/transformers",
        "sharp",
      );
    }

    if (!isServer) {
      // `@huggingface/transformers` does not export `./package.json`, so we
      // resolve its main CJS entry and derive the dist directory from that.
      const transformersEntry = require.resolve("@huggingface/transformers");
      const transformersDistDir = path.dirname(transformersEntry);
      const transformersWebBuild = path.join(
        transformersDistDir,
        "transformers.web.js",
      );

      config.resolve.alias = {
        ...config.resolve.alias,
        // Force the explicit browser build of transformers.js.
        // This avoids webpack runtime URL resolution issues like:
        // "TypeError: url.replace is not a function" inside RelativeURL.
        "@huggingface/transformers$": transformersWebBuild,
        // Stub out the Node-only packages so webpack never tries to bundle them.
        "onnxruntime-node$": false,
        "sharp$": false,
      };

      // onnxruntime-web ships .mjs files that use import.meta.url.
      // Telling webpack they are ESM ensures import.meta is replaced
      // before SWC's minifier sees the bundle (which would otherwise
      // throw "'import.meta' cannot be used outside of module code").
      config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules[/\\]onnxruntime/,
        type: "javascript/esm",
        resolve: { fullySpecified: false },
      });

      // Serve WASM files as static assets so onnxruntime-web can load them
      // at runtime via fetch() without requiring a Node.js file system.
      config.module.rules.push({
        test: /\.wasm$/,
        type: "asset/resource",
      });
    }

    config.externals.push({
      "utf-8-validate": "commonjs utf-8-validate",
      bufferutil: "commonjs bufferutil",
      "onnxruntime-node": "commonjs onnxruntime-node",
    });

    // Fix for transformers.js URL resolution in webpack
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

    // ─── Vercel serverless function size fix ──────────────────────────────
    //
    // @huggingface/transformers lists onnxruntime-node (~405 MB) and sharp
    // (~32 MB) as npm deps. Next.js's file tracer includes everything it
    // finds in the require() graph, pushing /dens/[id] to ~444 MB —
    // over Vercel's 250 MB hard limit.
    //
    // These packages are NEVER used at runtime: all ML inference runs
    // on-device via onnxruntime-web (WASM). The tracer just picks them up
    // by following the @huggingface/transformers package.json dep list.
    //
    // Globs cover both the pnpm virtual store and direct node_modules paths.
    outputFileTracingExcludes: {
      "*": [
        // onnxruntime-node native addon (~405 MB)
        "node_modules/.pnpm/onnxruntime-node@*/**",
        "node_modules/onnxruntime-node/**",

        // sharp native image processing (~32 MB)
        "node_modules/.pnpm/@img+sharp*/**",
        "node_modules/.pnpm/sharp@*/**",
        "node_modules/@img/**",
        "node_modules/sharp/**",

        // transformers dist (~2.7 MB) — browser-only, excluded from server
        // bundle via config.externals but still traced by the file crawler.
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
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);