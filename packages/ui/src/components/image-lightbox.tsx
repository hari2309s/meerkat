"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface LightboxImage {
  src: string;
  alt?: string;
  caption?: string;
}

export interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
}: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  const prev = useCallback(() => {
    if (index > 0) {
      setDirection(-1);
      setIndex((i) => i - 1);
    }
  }, [index]);

  const next = useCallback(() => {
    if (index < images.length - 1) {
      setDirection(1);
      setIndex((i) => i + 1);
    }
  }, [index, images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  const current = images[index];
  if (!current) return null;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)" }}
      />

      {/* Close */}
      <button
        className="absolute top-4 right-4 z-10 rounded-full p-2 hover:bg-white/10 transition-colors"
        onClick={onClose}
        aria-label="Close"
        style={{ color: "rgba(255,255,255,0.8)" }}
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-xs font-medium rounded-full px-3 py-1.5"
          style={{
            background: "rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          {index + 1} / {images.length}
        </div>
      )}

      {/* Main area */}
      <div
        className="relative z-10 flex items-center justify-center w-full h-full px-16 py-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev */}
        {images.length > 1 && index > 0 && (
          <button
            className="absolute left-4 rounded-full p-2.5 hover:bg-white/10 transition-colors"
            onClick={prev}
            aria-label="Previous image"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={current.alt ?? ""}
              className="rounded-xl object-contain shadow-2xl"
              style={{
                maxHeight: "calc(100vh - 10rem)",
                maxWidth: "min(90vw, 900px)",
              }}
            />
            {current.caption && (
              <p
                className="text-sm text-center max-w-md"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {current.caption}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Next */}
        {images.length > 1 && index < images.length - 1 && (
          <button
            className="absolute right-4 rounded-full p-2.5 hover:bg-white/10 transition-colors"
            onClick={next}
            aria-label="Next image"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
