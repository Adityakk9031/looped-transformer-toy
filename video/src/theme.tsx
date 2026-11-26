import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

export const C = {
  bg: "#0d0d0d", surface: "#1a1a19", raised: "#242423", grid: "#383835",
  ink: "#f0efec", ink2: "#c3c2b7", muted: "#898781",
  blue: "#3987e5", orange: "#d95926", aqua: "#199e70", yellow: "#c98500", violet: "#9085e9", red: "#e66767",
};
export const FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
export const MONO = '"SF Mono", Menlo, monospace';

/** 0 -> 1 between frame `start` and `start + len`, eased and clamped. */
export const ramp = (f: number, start: number, len = 20) =>
  interpolate(f, [start, start + len], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });

/** Kicker + title, fades in. */
export const Heading: React.FC<{ n: string; kicker: string; title: string }> = ({ n, kicker, title }) => {
  const f = useCurrentFrame();
  const a = ramp(f, 2, 18);
  return (
    <div style={{ position: "absolute", left: 110, top: 70, opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: 4, color: C.blue, textTransform: "uppercase" }}>
        {n} · {kicker}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 64, fontWeight: 700, color: C.ink, marginTop: 10, letterSpacing: -1 }}>
        {title}
      </div>
    </div>
  );
};

/** Bottom subtitles: narration split into sentences, timed by length. */
export const Subtitles: React.FC<{ text: string; dur: number; lead: number }> = ({ text, dur, lead }) => {
  const f = useCurrentFrame() - lead;
  const parts = text.split(/(?<=[.!?])\s+/);
  const total = parts.reduce((s, p) => s + p.length, 0);
  const speak = dur - lead - 20;
  let acc = 0, idx = 0;
  for (let i = 0; i < parts.length; i++) {
    const end = ((acc + parts[i].length) / total) * speak;
    if (f < end) { idx = i; break; }
    acc += parts[i].length; idx = i;
  }
  if (f < 0) return null;
  return (
    <div style={{ position: "absolute", bottom: 46, width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{
        fontFamily: FONT, fontSize: 34, color: C.ink, background: "rgba(13,13,13,0.78)",
        padding: "12px 28px", borderRadius: 12, maxWidth: 1500, textAlign: "center", lineHeight: 1.3,
      }}>
        {parts[idx]}
      </div>
    </div>
  );
};

/** Scene shell: background, fade in/out. */
export const Shell: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const o = Math.min(ramp(f, 0, 12), 1 - ramp(f, dur - 12, 12));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 30%, #17191d 0%, ${C.bg} 70%)`, opacity: o }}>
      {children}
    </AbsoluteFill>
  );
};

export const Legend: React.FC<{ items: [string, string][]; x: number; y: number }> = ({ items, x, y }) => (
  <div style={{ position: "absolute", left: x, top: y, display: "flex", gap: 36, fontFamily: FONT, fontSize: 28, color: C.ink2 }}>
    {items.map(([label, color]) => (
      <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: color }} />
        {label}
      </div>
    ))}
  </div>
);
