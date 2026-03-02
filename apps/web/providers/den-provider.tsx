"use client";

import React, { type ReactNode } from "react";
import { DenProvider as CRDTDenProvider } from "@meerkat/crdt";

interface DenProviderProps {
  denId: string;
  children: ReactNode;
  readOnly?: boolean;
}

/**
 * Den Provider — uses the local-first CRDT architecture.
 */
export function DenProvider({
  denId,
  children,
  readOnly = false,
}: DenProviderProps) {
  return (
    <CRDTDenProvider denId={denId} readOnly={readOnly}>
      {children}
    </CRDTDenProvider>
  );
}
