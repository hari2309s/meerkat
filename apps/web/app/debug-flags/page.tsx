"use client";

import { useFeatureFlags } from "@/lib/feature-flags-context";
import { useState, useEffect } from "react";

// Force dynamic rendering to avoid SSR issues with localStorage
export const dynamic = "force-dynamic";

export default function DebugFlagsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const { flags, setFlags, resetFlags } = useFeatureFlags();
  const [copied, setCopied] = useState(false);

  const enableAllFlags = () => {
    setFlags({
      localFirstStorage: true,
      p2pSync: true,
      newUI: true,
      voiceAnalysis: true,
      encryption: true,
    });
    setTimeout(() => window.location.reload(), 500);
  };

  const disableAllFlags = () => {
    resetFlags();
    setTimeout(() => window.location.reload(), 500);
  };

  const copyLocalStorage = () => {
    if (typeof window === "undefined") return;
    const localStorageData = JSON.stringify(
      localStorage.getItem("meerkat:feature-flags"),
      null,
      2,
    );
    navigator.clipboard.writeText(localStorageData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Feature Flags Debug</h1>

        {/* Current Flags */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Feature Flags</h2>
          <div className="space-y-3">
            {Object.entries(flags).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between py-2 border-b"
              >
                <span className="font-medium">{key}</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    value
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {value ? "✓ Enabled" : "✗ Disabled"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* LocalStorage Raw Value */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">localStorage Value (Raw)</h2>
            <button
              onClick={copyLocalStorage}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
            {mounted
              ? localStorage.getItem("meerkat:feature-flags") || "null"
              : "Loading..."}
          </pre>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={enableAllFlags}
              className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
            >
              Enable All Flags (Recommended for Testing)
            </button>
            <button
              onClick={disableAllFlags}
              className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
            >
              Reset to Default (Legacy Mode)
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Note: Page will reload automatically after changing flags
          </p>
        </div>

        {/* Individual Toggles */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Individual Toggles</h2>
          <div className="space-y-3">
            {Object.entries(flags).map(([key, value]) => (
              <label
                key={key}
                className="flex items-center justify-between py-2 cursor-pointer hover:bg-gray-50 px-3 rounded"
              >
                <span className="font-medium">{key}</span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => {
                    setFlags({ [key]: e.target.checked } as any);
                    // Reload after a short delay to allow state update
                    setTimeout(() => window.location.reload(), 300);
                  }}
                  className="w-5 h-5"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Environment Variables */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Environment Variables (Read-Only)
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span>NEXT_PUBLIC_FF_LOCAL_FIRST</span>
              <span className="font-mono">
                {process.env.NEXT_PUBLIC_FF_LOCAL_FIRST || "not set"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>NEXT_PUBLIC_FF_P2P_SYNC</span>
              <span className="font-mono">
                {process.env.NEXT_PUBLIC_FF_P2P_SYNC || "not set"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>NEXT_PUBLIC_FF_NEW_UI</span>
              <span className="font-mono">
                {process.env.NEXT_PUBLIC_FF_NEW_UI || "not set"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>NEXT_PUBLIC_FF_VOICE_ANALYSIS</span>
              <span className="font-mono">
                {process.env.NEXT_PUBLIC_FF_VOICE_ANALYSIS || "not set"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>NEXT_PUBLIC_FF_ENCRYPTION</span>
              <span className="font-mono">
                {process.env.NEXT_PUBLIC_FF_ENCRYPTION || "not set"}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            localStorage overrides environment variables
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3 text-blue-900">
            What to Expect When Enabled
          </h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>
              <strong>localFirstStorage:</strong> Den data stored in IndexedDB
              (check DevTools → Application → IndexedDB)
            </li>
            <li>
              <strong>p2pSync:</strong> P2P sync status updates (requires
              localFirstStorage)
            </li>
            <li>
              <strong>newUI:</strong> Shows SyncStatusBadge in den header and
              VisitorPanel
            </li>
            <li>
              <strong>voiceAnalysis:</strong> On-device voice transcription
            </li>
            <li>
              <strong>encryption:</strong> E2E encryption for all content
            </li>
          </ul>
          <p className="text-sm text-blue-700 mt-4">
            <strong>Tip:</strong> Open DevTools Console to see debug logs from
            the CRDT provider
          </p>
        </div>

        {/* Navigation */}
        <div className="mt-6 text-center">
          <a href="/" className="text-blue-600 hover:underline font-medium">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
