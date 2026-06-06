"use client";

import type { CSSProperties } from "react";

import type { PortalAccent } from "@/lib/portal-accent";
import { portalAccentStyles } from "@/lib/portal-accent";
import { cn } from "@/lib/utils/cn";

/** Nền dashboard nhẹ: glow mờ + bong bóng hiện rồi tan (light/dark). */

interface DashboardAnimatedBackgroundProps {
  accent?: PortalAccent;
}

const BUBBLES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 17 + 8) % 92,
  top: (i * 23 + 12) % 78,
  size: 28 + (i % 5) * 14,
  delay: (i * 0.9) % 8,
  duration: 5.5 + (i % 4) * 1.5,
  drift: (i % 2 === 0 ? 1 : -1) * (6 + (i % 3) * 4),
}));

export function DashboardAnimatedBackground({
  accent = "emerald",
}: DashboardAnimatedBackgroundProps) {
  const s = portalAccentStyles[accent];

  return (
    <div
      className="dashboard-animated-bg pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950" />
      <div className={cn("absolute inset-0", s.radialLight, s.radialDark)} />

      <div
        className={cn(
          "dashboard-green-glow dashboard-green-glow-a absolute -left-[10%] top-[5%] h-[45%] w-[50%] rounded-full blur-[100px]",
          s.glowA
        )}
      />
      <div
        className={cn(
          "dashboard-green-glow dashboard-green-glow-b absolute -right-[8%] bottom-[5%] h-[40%] w-[48%] rounded-full blur-[110px]",
          s.glowB
        )}
      />

      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className={cn(
            "dashboard-bubble absolute rounded-full border shadow-[inset_0_0_12px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_0_10px_rgba(255,255,255,0.06)]",
            s.bubbleBorder,
            s.bubbleBg
          )}
          style={
            {
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: b.size,
              height: b.size,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
              "--bubble-drift": `${b.drift}px`,
            } as CSSProperties
          }
        />
      ))}

      {/* Lớp phủ mờ — giảm độ nổi, vẫn có chiều sâu */}
      <div className="absolute inset-0 bg-white/55 backdrop-blur-[3px] dark:bg-zinc-950/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-zinc-100/40 dark:from-zinc-950/25 dark:to-zinc-950/50" />
    </div>
  );
}
