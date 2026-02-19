"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Users, Briefcase, Heart, Star, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startNavigationProgress } from "@/components/navigation-progress";

interface Den {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
}

const DEN_SUGGESTIONS = ["Family", "Friends", "Work", "For You", "Creative"];

function getDenIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("family")) return Heart;
  if (lower.includes("work") || lower.includes("job")) return Briefcase;
  if (lower.includes("friend")) return Users;
  if (
    lower.includes("you") ||
    lower.includes("me") ||
    lower.includes("personal")
  )
    return Star;
  return Users;
}

function getDenGradient(index: number) {
  const gradients = [
    "linear-gradient(135deg, rgba(184,144,106,0.18) 0%, rgba(107,79,46,0.28) 100%)",
    "linear-gradient(135deg, rgba(154,114,72,0.15) 0%, rgba(90,55,20,0.25) 100%)",
    "linear-gradient(135deg, rgba(212,165,116,0.18) 0%, rgba(154,114,72,0.28) 100%)",
    "linear-gradient(135deg, rgba(107,79,46,0.15) 0%, rgba(58,39,24,0.35) 100%)",
    "linear-gradient(135deg, rgba(184,144,106,0.12) 0%, rgba(212,165,116,0.22) 100%)",
  ];
  return gradients[index % gradients.length];
}

// ─── Create Den Modal ────────────────────────────────────────────────────────

interface CreateDenModalProps {
  onClose: () => void;
  onCreated: (den: Den) => void;
  userId: string;
}

function CreateDenModal({ onClose, onCreated, userId }: CreateDenModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please give your den a name.");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("dens")
      .insert({ name: trimmed, user_id: userId })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    onCreated(data as Den);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{
          background: "var(--color-bg-card)",
          border: "1.5px solid var(--color-border-card)",
          boxShadow: "var(--color-shadow-card)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="icon-btn absolute right-4 top-4 rounded-lg p-1.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>

        <h2
          className="text-xl font-bold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          Create a den
        </h2>
        <p
          className="text-sm mb-5"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Dens are your spaces to gather, share, and connect.
        </p>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Name your den…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-xs" style={{ color: "#e07050" }}>
              {error}
            </p>
          )}
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2 mb-6">
          {DEN_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setName(suggestion)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-[1.04] active:scale-95"
              style={{
                background:
                  name === suggestion
                    ? "var(--color-btn-default-bg)"
                    : "var(--color-btn-secondary-bg)",
                color:
                  name === suggestion
                    ? "var(--color-btn-default-text)"
                    : "var(--color-btn-secondary-text)",
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="btn-default w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create den
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Dens Section ────────────────────────────────────────────────────────────

interface DensSectionProps {
  userId: string;
}

export function DensSection({ userId }: DensSectionProps) {
  const router = useRouter();
  const [dens, setDens] = useState<Den[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  // Track which den card is currently loading navigation
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const fetchDens = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("dens")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    setDens((data as Den[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchDens();
  }, [fetchDens]);

  const handleDenClick = (den: Den) => {
    setNavigatingId(den.id);
    startNavigationProgress();
    router.push(`/dens/${den.id}`);
  };

  // After creating, just close modal and add to list — don't navigate
  const handleDenCreated = (den: Den) => {
    setDens((prev) => [...prev, den]);
    setShowModal(false);
  };

  return (
    <>
      <div className="w-full">
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Your Dens
          </h3>
          {dens.length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              New den
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl animate-pulse"
                style={{ background: "var(--color-bg-card)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {/* Existing den cards */}
              {dens.map((den, index) => {
                const Icon = getDenIcon(den.name);
                const isNavigating = navigatingId === den.id;
                return (
                  <motion.button
                    key={den.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.06 }}
                    onClick={() => handleDenClick(den)}
                    disabled={!!navigatingId}
                    className="relative h-28 rounded-2xl p-4 text-left group overflow-hidden"
                    style={{
                      background: getDenGradient(index),
                      border: "1.5px solid var(--color-border-card)",
                      boxShadow: "var(--color-shadow-card)",
                      transition:
                        "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
                    }}
                    whileHover={!navigatingId ? { scale: 1.03, y: -2 } : {}}
                    whileTap={!navigatingId ? { scale: 0.97 } : {}}
                  >
                    {/* Icon or spinner */}
                    <div
                      className="mb-3 inline-flex rounded-xl p-2 transition-colors group-hover:bg-white/20"
                      style={{ background: "rgba(255,255,255,0.1)" }}
                    >
                      {isNavigating ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          style={{ color: "var(--color-text-primary)" }}
                        />
                      ) : (
                        <Icon
                          className="h-4 w-4"
                          style={{ color: "var(--color-text-primary)" }}
                        />
                      )}
                    </div>
                    <p
                      className="text-sm font-semibold leading-tight"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {den.name}
                    </p>

                    {/* Hover shimmer */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.09) 0%, transparent 60%)",
                      }}
                    />

                    {/* Border glow on hover */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"
                      style={{
                        boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.18)",
                      }}
                    />
                  </motion.button>
                );
              })}

              {/* "Create / New den" dashed card */}
              <motion.button
                key="create"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: dens.length * 0.06 }}
                onClick={() => setShowModal(true)}
                disabled={!!navigatingId}
                className="h-28 rounded-2xl p-4 text-left group"
                style={{
                  background: "transparent",
                  border: "1.5px dashed var(--color-border-card)",
                  transition:
                    "transform 0.18s ease, border-color 0.2s ease, background 0.18s ease",
                }}
                whileHover={!navigatingId ? { scale: 1.03, y: -2 } : {}}
                whileTap={!navigatingId ? { scale: 0.97 } : {}}
              >
                {/* Icon wrapper — brightens on hover via group */}
                <div
                  className="mb-3 inline-flex rounded-xl p-2 transition-all duration-200 group-hover:bg-white/12 group-hover:scale-110"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <Plus
                    className="h-4 w-4 transition-colors duration-200 group-hover:text-[var(--color-text-primary)]"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                </div>

                <p
                  className="text-sm font-medium transition-colors duration-200 group-hover:text-[var(--color-text-primary)]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {dens.length === 0 ? "Create your first den" : "New den"}
                </p>

                {/* Dashed border highlight on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(184,144,106,0.06) 0%, transparent 70%)",
                  }}
                />
              </motion.button>
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <CreateDenModal
            userId={userId}
            onClose={() => setShowModal(false)}
            onCreated={handleDenCreated}
          />
        )}
      </AnimatePresence>
    </>
  );
}
