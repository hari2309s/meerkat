interface GrainOverlayProps {
  position?: "fixed" | "absolute";
}

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`;

export function GrainOverlay({ position = "fixed" }: GrainOverlayProps) {
  return (
    <div
      className={`${position} inset-0 opacity-20 pointer-events-none`}
      style={{ backgroundImage: NOISE_SVG, backgroundSize: "150px" }}
    />
  );
}
