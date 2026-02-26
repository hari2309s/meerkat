import { DenProvider } from "@/providers/den-provider";

interface DenLayoutProps {
  params: { id: string };
  children: React.ReactNode;
}

/**
 * Den Layout
 *
 * Wraps the den page with the DenProvider which conditionally uses
 * the local-first CRDT architecture based on feature flags.
 *
 * When localFirstStorage is enabled:
 *   - IndexedDB + Yjs for offline-first storage
 *   - P2P sync via WebRTC (when p2pSync flag is enabled)
 *   - useDenContext() hook available to all child components
 *
 * When localFirstStorage is disabled:
 *   - Falls back to legacy tRPC-based data fetching
 */
export default function DenLayout({ params, children }: DenLayoutProps) {
  return <DenProvider denId={params.id}>{children}</DenProvider>;
}
