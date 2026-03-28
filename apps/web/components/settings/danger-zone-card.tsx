"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@meerkat/ui";
import { SectionCard, ConfirmModal } from "@/components/settings/shared";

export function DangerZoneCard({ email }: { email: string }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Deletion failed");
      }
      toast.success("Account deleted");
      router.push("/login");
    } catch (err: unknown) {
      toast.error("Failed to delete account", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <SectionCard title="Danger Zone" subtitle="Irreversible actions">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "#c0392b" }}>
              Delete account
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Permanently delete your account and all data
            </p>
          </div>
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            onClick={() => {
              setConfirmText("");
              setDeleteOpen(true);
            }}
          >
            Delete account
          </Button>
        </div>
      </SectionCard>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => !isDeleting && setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete your account?"
        body={
          <div className="space-y-3">
            <p>
              This will permanently delete your account, dens you own, and all
              associated data. <strong>This cannot be undone.</strong>
            </p>
            <div className="space-y-1.5">
              <p
                className="text-xs font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                Type <strong>{email}</strong> to confirm
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={email}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none border"
                style={{
                  background: "var(--color-bg-input, rgba(255,255,255,0.06))",
                  borderColor: "var(--color-border-card)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          </div>
        }
        confirmLabel="Delete my account"
        confirmVariant="danger"
        loading={isDeleting}
      />
    </>
  );
}
