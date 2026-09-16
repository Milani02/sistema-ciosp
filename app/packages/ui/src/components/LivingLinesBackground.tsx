import { cn } from "../lib/cn";

/** The signature "living lines" motif — glowing green ribbons drifting on
 *  a near-black canvas. Used identically everywhere it appears (login,
 *  the sistema app shell) so the brand moment reads as one consistent
 *  idea, not a one-off login effect. Pass `fixed` to pin it to the
 *  viewport (so it keeps covering the screen while content scrolls). */
export function LivingLinesBackground({ fixed, className }: { fixed?: boolean; className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none inset-0 h-full w-full", fixed ? "fixed" : "absolute", className)}
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <path className="noir-line noir-line-4" d="M -50 620 C 180 720, 260 500, 450 680" />
      <path className="noir-line noir-line-2" d="M -50 300 C 100 180, 300 420, 450 260" />
      <path className="noir-line noir-line-1" d="M -50 100 C 120 200, 280 40, 450 220" />
      <path className="noir-line noir-line-3" d="M -50 480 C 150 380, 250 620, 450 500" />
      <path className="noir-line noir-line-5" d="M -50 200 C 200 60, 220 340, 450 150" />
    </svg>
  );
}
