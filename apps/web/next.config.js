/** @type {import('next').NextConfig} */
const path = require("path");
const fs = require("fs");
const withPWA = require("@ducanh2912/next-pwa").default;

// ─── Copy ORT WASM/MJS files to public/ort/ ──────────────────────────────────
//
// onnxruntime-web ships a dev pre-release build (1.22.0-dev.*) that is NOT
// published to npm/CDN. transformers.js sets wasmPaths to its own jsdelivr
// CDN prefix, but "ort-wasm-simd-threaded.mjs" (the worker entrypoint) lives
// in the onnxruntime-web package, not the transformers package → 404.
//
// Fix: copy the two files ORT needs at runtime into public/ort/ and override
// wasmPaths in model-registry.ts so the browser loads them locally.
try {
  const transformersEntry = require.resolve("@huggingface/transformers");
  const transformersDistDir = path.dirname(transformersEntry);
  const ortEntry = require.resolve("onnxruntime-web", {
    paths: [transformersDistDir],
  });
  const ortDistDir = path.dirname(ortEntry);
  const ortPublicDir = path.join(__dirname, "public", "ort");
  fs.mkdirSync(ortPublicDir, { recursive: true });

  // Only the two files ORT needs at runtime: worker entrypoint + WASM binary.
  const COPY_FILES = [
    "ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.wasm",
  ];
  for (const file of COPY_FILES) {
    const src = path.join(ortDistDir, file);
    const dest = path.join(ortPublicDir, file);
    // Only copy if source is newer (avoids unnecessary rebuilds).
    const srcMtime = fs.existsSync(src) ? fs.statSync(src).mtimeMs : 0;
    const destMtime = fs.existsSync(dest) ? fs.statSync(dest).mtimeMs : 0;
    if (srcMtime > destMtime) {
      fs.copyFileSync(src, dest);
      console.log(`[meerkat] Copied ORT file: ${file}`);
    }
  }
} catch (e) {
  console.warn("[meerkat] Could not copy ORT WASM files:", e.message);
}
// ─────────────────────────────────────────────────────────────────────────────

const nextConfig = {
  reactStrictMode: true,

  // COOP + COEP headers are required for SharedArrayBuffer, which
  // onnxruntime-web 1.22.x uses unconditionally (only the threaded WASM
  // binary is shipped — there is no non-threaded fallback). Without
  // crossOriginIsolated the WASM runtime throws on init and transcription
  // always returns "".
  //
  // COEP "credentialless" (not "require-corp") allows no-cors cross-origin
  // requests (e.g. <audio> elements pointing at Supabase Storage signed URLs)
  // to load as opaque responses without requiring the remote server to set
  // CORP: cross-origin. Only credentialed CORS fetches need explicit CORP.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },

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

      // onnxruntime-web ships only a threaded WASM build (ort.bundle.min.mjs
      // / ort-wasm-simd-threaded.wasm). The default ESM export
      // (ort.bundle.min.mjs) uses `new URL(import.meta.url)` for its inline
      // Worker — webpack replaces import.meta.url with its RelativeURL shim
      // which receives undefined and throws "url.replace is not a function".
      //
      // Fix: alias to the CJS browser build (ort.wasm.min.js) which has zero
      // import.meta references. transformers.js sets wasmPaths to the CDN so
      // the WASM binary is still fetched from jsdelivr at runtime — we don't
      // need the bundled-WASM variant.
      //
      // onnxruntime-web is a dep of @huggingface/transformers (not hoisted to
      // the workspace root), so resolve it from the transformers package dir.
      const onnxrtWebEntry = require.resolve("onnxruntime-web", {
        paths: [transformersDistDir],
      });
      const onnxrtWebDistDir = path.dirname(onnxrtWebEntry);
      const onnxrtWebBrowserBuild = path.join(
        onnxrtWebDistDir,
        "ort.wasm.min.js",
      );

      config.resolve.alias = {
        ...config.resolve.alias,
        "@huggingface/transformers$": transformersWebBuild,
        "onnxruntime-web$": onnxrtWebBrowserBuild,
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
  // Disable SW in development so the dev server's headers are always applied
  // directly (no stale cached shell). Production behaviour is unchanged.
  disable: process.env.NODE_ENV === "development",
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
      // Supabase Storage signed URLs — pass straight through without caching.
      // Under COEP, the SW must not try to store opaque cross-origin responses
      // (CORP: same-origin from Supabase would block them). NetworkOnly lets
      // the browser receive the opaque no-cors response directly.
      {
        urlPattern: /^https:\/\/[^/]+\.supabase\.co\/storage\//,
        handler: "NetworkOnly",
      },
    ],
  },
})(nextConfig);