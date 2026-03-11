"use client";

import { ZoomIn } from "lucide-react";

export interface ImageThumbnailProps {
  src: string;
  alt?: string;
  onClick?: () => void;
  /** Max width in pixels (default 260) */
  maxWidth?: number;
  /** Max height in pixels (default 200) */
  maxHeight?: number;
}

export function ImageThumbnail({
  src,
  alt,
  onClick,
  maxWidth = 260,
  maxHeight = 200,
}: ImageThumbnailProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? "View image" : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      className={[
        "relative group overflow-hidden rounded-xl",
        onClick ? "cursor-zoom-in" : "",
      ].join(" ")}
      style={{ maxWidth, display: "inline-block" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        className="block w-full object-cover bg-black/5"
        style={{ maxHeight, minWidth: "80px" }}
        draggable={false}
      />
      {onClick && (
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-xl"
          style={{ background: "rgba(0,0,0,0.32)" }}
        >
          <ZoomIn className="h-6 w-6 text-white drop-shadow" />
        </div>
      )}
    </div>
  );
}
