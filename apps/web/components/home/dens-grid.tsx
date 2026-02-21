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
import type { Den } from "@/types/den";

async function fetchUserDens(): Promise<Den[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("dens")
    .select("*, members:den_members(count)")
    .order("created_at", { ascending: true });
  return (data as Den[]) ?? [];
}

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

  const handleDenClick = (den: Den) => {
    setNavigatingId(den.id);
    startNavigationProgress();
    router.push(`/dens/${den.id}`);
  };

  const handleDenCreated = (_den: Den) => {
    setShowModal(false);
    // Query is automatically refetched via useMutation cache invalidation in CreateDenModal
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

        {isLoading ? (
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
              {dens.map((den, index) => (
                <DenCard
                  key={den.id}
                  den={den}
                  index={index}
                  currentUserId={userId}
                  navigatingId={navigatingId}
                  onNavigate={handleDenClick}
                />
              ))}

              {/* Create / New den dashed card */}
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
