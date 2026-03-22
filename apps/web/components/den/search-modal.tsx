"use client";

// ── SearchModal ───────────────────────────────────────────────────────────────
//
// Full-text search over the current den's notes using the existing
// searchNotes() backend from @meerkat/local-store.
//
// Opens with Cmd/Ctrl+K. Results update as-you-type (debounced 200 ms).
// Clicking a result calls onSelectNote so the parent can scroll/highlight it.

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, FileText, Tag, Globe } from "lucide-react";
import { searchNotes } from "@meerkat/local-store";
import type { NoteData } from "@meerkat/local-store";
import { relativeTime } from "@meerkat/utils/time";

interface SearchModalProps {
  denId: string;
  open: boolean;
  onClose: () => void;
  onSelectNote: (note: NoteData) => void;
}

// Highlight the matched substring in a string.
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        className="rounded px-0.5"
        style={{ background: "rgba(184,144,106,0.30)", color: "inherit" }}
      >
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

// Returns a short content preview (first 100 chars).
function preview(content: string): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length > 100 ? `${oneLine.slice(0, 100)}…` : oneLine;
}

export function SearchModal({
  denId,
  open,
  onClose,
  onSelectNote,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Global Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!open) return; // parent handles opening
        onClose();
      }
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Debounced search
  const runSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const found = await searchNotes(denId, { query: q, limit: 20 });
          setResults(found);
          setSelectedIdx(0);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 200);
    },
    [denId],
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    runSearch(e.target.value);
  };

  // Keyboard navigation through results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      onSelectNote(results[selectedIdx]!);
      onClose();
    }
  };

  const handleSelect = (note: NoteData) => {
    onSelectNote(note);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "rgba(0,0,0,0.48)",
              backdropFilter: "blur(4px)",
            }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-lg z-10 rounded-2xl overflow-hidden"
            style={{
              background: "var(--color-bg-card)",
              border: "1.5px solid var(--color-border-card)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.24)",
            }}
          >
            {/* Search input row */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 border-b"
              style={{ borderColor: "var(--color-border-card)" }}
            >
              <Search
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                ref={inputRef}
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                placeholder="Search notes…"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--color-text-primary)" }}
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                </button>
              )}
              <kbd
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono shrink-0"
                style={{
                  background: "rgba(138,96,53,0.08)",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border-card)",
                }}
              >
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {!query.trim() ? (
                <p
                  className="text-xs text-center py-8"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Type to search notes in this den
                </p>
              ) : loading ? (
                <p
                  className="text-xs text-center py-8"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Searching…
                </p>
              ) : results.length === 0 ? (
                <p
                  className="text-xs text-center py-8"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  No notes match &ldquo;{query}&rdquo;
                </p>
              ) : (
                <ul>
                  {results.map((note, i) => (
                    <li key={note.id}>
                      <button
                        onClick={() => handleSelect(note)}
                        onMouseEnter={() => setSelectedIdx(i)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                        style={{
                          background:
                            i === selectedIdx
                              ? "rgba(138,96,53,0.08)"
                              : "transparent",
                          borderBottom: "1px solid var(--color-border-card)",
                        }}
                      >
                        <div
                          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: "rgba(138,96,53,0.10)" }}
                        >
                          <FileText
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--color-text-secondary)" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            <Highlight
                              text={preview(note.content)}
                              query={query}
                            />
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className="text-xs"
                              style={{ color: "var(--color-text-muted)" }}
                            >
                              {relativeTime(
                                new Date(note.updatedAt).toISOString(),
                              )}
                            </span>
                            {note.isShared && (
                              <span
                                className="inline-flex items-center gap-1 text-xs"
                                style={{ color: "var(--color-text-muted)" }}
                              >
                                <Globe className="h-3 w-3" />
                                Shared
                              </span>
                            )}
                            {note.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5"
                                style={{
                                  background: "rgba(138,96,53,0.08)",
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer hint */}
            {results.length > 0 && (
              <div
                className="px-4 py-2 border-t flex items-center gap-3"
                style={{
                  borderColor: "var(--color-border-card)",
                  background: "rgba(138,96,53,0.03)",
                }}
              >
                <span
                  className="text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  ↑↓ navigate · ↵ open
                </span>
                <span
                  className="text-xs ml-auto"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
