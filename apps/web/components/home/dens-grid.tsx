"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startNavigationProgress } from "@/components/navigation-progress";
import { DenCard } from "@/components/home/den-card";
import { CreateDenModal } from "@/components/home/create-den-modal";
import { useStoredKeys } from "@meerkat/keys";
import type { Den } from "@/types/den";

async function fetchUserDens(): Promise<Den[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("dens")
    .select("*, members:den_members(count)")
    .order("created_at", { ascending: true });
  return (data as Den[]) ?? [];
}

// ── Section config ─────────────────────────────────────────────────────────────

type SectionId =
  | "owned"
  | "house-sit"
  | "come-over"
  | "peek"
  | "letterbox"
  | "member";

const SECTION_META: Record<
  SectionId,
  { emoji: string; label: string; description?: string }
> = {
  owned: { emoji: "🏡", label: "Your Dens" },
  "house-sit": {
    emoji: "🏠",
    label: "House-sit",
    description: "Full access, offline",
  },
  "come-over": {
    emoji: "👋",
    label: "Come Over",
    description: "Live read & write",
  },
  peek: { emoji: "👀", label: "Peek", description: "Read only" },
  letterbox: {
    emoji: "📬",
    label: "Letterbox",
    description: "Drop messages",
  },
  member: { emoji: "🤝", label: "Member", description: "Shared dens" },
};

const VISITOR_ORDER: SectionId[] = [
  "house-sit",
  "come-over",
  "peek",
  "letterbox",
  "member",
];

// ── Component ─────────────────────────────────────────────────────────────────

interface DensGridProps {
  userId: string;
}

export function DensGrid({ userId }: DensGridProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const { data: dens = [], isLoading } = useQuery({
    queryKey: ["dens", userId],
    queryFn: () => fetchUserDens(),
  });

  const { validKeys } = useStoredKeys();

  const handleDenClick = (den: Den) => {
    setNavigatingId(den.id);
    startNavigationProgress();
    router.push(`/dens/${den.id}`);
  };

  // ── Categorise dens into sections ──────────────────────────────────────────

  const ownedDens = dens.filter((d) => d.user_id === userId);
  const visitorDens = dens.filter((d) => d.user_id !== userId);

  // Map denId → stored key type for visitor dens
  const keyTypeByDenId: Record<string, string> = {};
  for (const { key } of validKeys) {
    keyTypeByDenId[key.denId] = key.keyType;
  }

  const visitorBySection: Partial<Record<SectionId, Den[]>> = {};
  for (const den of visitorDens) {
    const kt = keyTypeByDenId[den.id];
    const section: SectionId =
      kt === "house-sit" ||
      kt === "come-over" ||
      kt === "peek" ||
      kt === "letterbox"
        ? kt
        : "member";
    (visitorBySection[section] ??= []).push(den);
  }

  const visitorSections = VISITOR_ORDER.filter(
    (id) => (visitorBySection[id]?.length ?? 0) > 0,
  );

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <div
            className="h-4 w-20 rounded animate-pulse mb-4"
            style={{ background: "var(--color-border-card)" }}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl animate-pulse"
                style={{ background: "var(--color-bg-card)" }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-10">
        {/* ── Your Dens ── */}
        <DenSection
          id="owned"
          dens={ownedDens}
          userId={userId}
          navigatingId={navigatingId}
          onNavigate={handleDenClick}
          showCreate
          onCreateClick={() => setShowModal(true)}
        />

        {/* ── Visitor sections ── */}
        {visitorSections.map((id) => (
          <DenSection
            key={id}
            id={id}
            dens={visitorBySection[id]!}
            userId={userId}
            navigatingId={navigatingId}
            onNavigate={handleDenClick}
          />
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <CreateDenModal
            userId={userId}
            onClose={() => setShowModal(false)}
            onCreated={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── DenSection ────────────────────────────────────────────────────────────────

interface DenSectionProps {
  id: SectionId;
  dens: Den[];
  userId: string;
  navigatingId: string | null;
  onNavigate: (den: Den) => void;
  showCreate?: boolean;
  onCreateClick?: () => void;
}

function DenSection({
  id,
  dens,
  userId,
  navigatingId,
  onNavigate,
  showCreate = false,
  onCreateClick,
}: DenSectionProps) {
  const { emoji, label, description } = SECTION_META[id];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{emoji}</span>
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {label}
          </span>
          {description && (
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              · {description}
            </span>
          )}
        </div>

        {showCreate && dens.length > 0 && (
          <button
            onClick={onCreateClick}
            className="btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            New den
          </button>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {dens.map((den, index) => (
            <DenCard
              key={den.id}
              den={den}
              index={index}
              currentUserId={userId}
              navigatingId={navigatingId}
              onNavigate={onNavigate}
            />
          ))}

          {/* "New den" / "Create first den" dashed card — only in the owned section */}
          {showCreate && (
            <motion.button
              key="create"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: dens.length * 0.06 }}
              onClick={onCreateClick}
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
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
