interface DenLayoutProps {
  children: React.ReactNode;
}

/**
 * Den Layout
 *
 * DenProvider has been moved into page.tsx so it can receive readOnly={!isOwner}.
 * Non-owners should not auto-host (broadcast "host-online" on the signaling channel).
 */
export default function DenLayout({ children }: DenLayoutProps) {
  return <>{children}</>;
}
