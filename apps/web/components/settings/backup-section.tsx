"use client";

// ── BackupSection ─────────────────────────────────────────────────────────────
//
// Lets the user export each den's Yjs state as a local JSON file and restore
// from a previously exported file.
//
// Export format (unencrypted — warn the user):
//   { version: 1, denId, exportedAt, privateState: base64, sharedState: base64 }
//
// importDenState() is a CRDT merge, not a destructive replace — it is safe to
// call on a den that already has data (Yjs merges without data loss).

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { exportDen, importDenState } from "@meerkat/local-store";
import { SectionCard } from "@/components/settings/shared";

// ── Serialization helpers ────────────────────────────────────────────────────

interface BackupFile {
  version: 1;
  denId: string;
  exportedAt: number;
  privateState: string; // base64
  sharedState: string; // base64
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// ── ExportCard ───────────────────────────────────────────────────────────────

interface OwnedDen {
  id: string;
  name: string;
}

function ExportCard({ dens }: { dens: OwnedDen[] }) {
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExport = async (den: OwnedDen) => {
    setExportingId(den.id);
    try {
      const exported = await exportDen(den.id);

      const file: BackupFile = {
        version: 1,
        denId: exported.denId,
        exportedAt: exported.exportedAt,
        privateState: uint8ToBase64(exported.privateState),
        sharedState: uint8ToBase64(exported.sharedState),
      };

      const blob = new Blob([JSON.stringify(file, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meerkat-${den.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Backup downloaded`, {
        description: `"${den.name}" exported. Store it somewhere safe.`,
      });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setExportingId(null);
    }
  };

  return (
    <SectionCard
      title="Export den"
      subtitle="Download a local backup of a den's notes and voice memos"
    >
      {/* Warning banner */}
      <div
        className="flex gap-3 rounded-xl p-3 mb-4"
        style={{
          background: "rgba(200,150,50,0.08)",
          border: "1px solid rgba(200,150,50,0.2)",
        }}
      >
        <AlertTriangle
          className="h-4 w-4 shrink-0 mt-0.5"
          style={{ color: "#c89632" }}
        />
        <p className="text-xs leading-relaxed" style={{ color: "#c89632" }}>
          Backups are <strong>not encrypted</strong>. Keep the file on a secure
          device and do not share it.
        </p>
      </div>

      {dens.length === 0 ? (
        <p
          className="text-sm py-4 text-center"
          style={{ color: "var(--color-text-muted)" }}
        >
          No dens with local data found
        </p>
      ) : (
        <div
          className="divide-y"
          style={{ borderColor: "var(--color-border-card)" }}
        >
          {dens.map((den) => (
            <div
              key={den.id}
              className="flex items-center justify-between py-3 first:pt-0"
            >
              <p
                className="text-sm font-medium truncate mr-4"
                style={{ color: "var(--color-text-primary)" }}
              >
                {den.name}
              </p>
              <button
                onClick={() => handleExport(den)}
                disabled={exportingId === den.id}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 transition-opacity hover:opacity-75 disabled:opacity-50"
                style={{
                  background: "rgba(138,96,53,0.10)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {exportingId === den.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                Export
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── ImportCard ───────────────────────────────────────────────────────────────

function ImportCard() {
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupFile;

      if (backup.version !== 1 || !backup.denId) {
        throw new Error("Unrecognised backup format");
      }

      await importDenState(backup.denId, {
        denId: backup.denId,
        exportedAt: backup.exportedAt,
        privateState: base64ToUint8(backup.privateState),
        sharedState: base64ToUint8(backup.sharedState),
      });

      toast.success("Backup restored", {
        description: "Den data merged successfully. Open the den to see it.",
      });
    } catch (err) {
      toast.error("Import failed", {
        description:
          err instanceof Error ? err.message : "Invalid backup file.",
      });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <SectionCard
      title="Restore from backup"
      subtitle="Merge a previously exported backup file into a den"
    >
      <p
        className="text-sm mb-4 leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Restoring merges the backup with your existing den data — nothing is
        deleted. It is safe to restore multiple times.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-75 disabled:opacity-50"
        style={{
          background: "var(--color-btn-default-bg)",
          color: "var(--color-btn-default-text)",
          boxShadow: "0 4px 18px var(--color-btn-default-shadow)",
        }}
      >
        {importing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {importing ? "Restoring…" : "Choose backup file"}
      </button>
    </SectionCard>
  );
}

// ── BackupSection (exported) ─────────────────────────────────────────────────

export function BackupSection({ dens }: { dens: OwnedDen[] }) {
  return (
    <>
      <ExportCard dens={dens} />
      <ImportCard />
    </>
  );
}
