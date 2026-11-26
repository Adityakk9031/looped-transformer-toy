import React from "react";
import { Img, spring, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { C, FONT, MONO, Heading, Legend, ramp } from "./theme";
import { LoopRing, LayerStack, LoopCore, loopsAt } from "./three";

type P = { dur: number };
const T: React.CSSProperties = { fontFamily: FONT, color: C.ink };

// ---------- 1. Title ----------
export const TitleScene: React.FC<P> = () => {
  const f = useCurrentFrame();
  return (
    <>
      <LoopRing />
      <div style={{ position: "absolute", left: 120, bottom: 190, opacity: ramp(f, 8, 25) }}>
        <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: 5, color: C.blue }}>BUILT FROM SCRATCH · MACBOOK AIR M4</div>
        <div style={{ ...T, fontSize: 108, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>Looped Transformers</div>
        <div style={{ ...T, fontSize: 44, color: C.ink2, marginTop: 18, opacity: ramp(f, 30, 25) }}>
          Can an AI think longer, without getting bigger?
        </div>
      </div>
    </>
  );
};

// ---------- 2. Normal transformer ----------
export const LayersScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  return (
    <>
      <LayerStack dur={dur} />
      <Heading n="01" kicker="The problem" title="More thinking = more layers" />
      <div style={{ position: "absolute", left: 110, top: 330, width: 720, ...T, fontSize: 38, lineHeight: 1.5, color: C.ink2 }}>
        <div style={{ opacity: ramp(f, 25) }}>Each layer = <b style={{ color: C.ink }}>one step</b> of thinking.</div>
        <div style={{ opacity: ramp(f, dur * 0.4) }}>Each layer has its <b style={{ color: C.orange }}>own weights</b>.</div>
        <div style={{ opacity: ramp(f, dur * 0.65), marginTop: 30, fontSize: 46, color: C.ink }}>
          8 layers → 8× the parameters
        </div>
      </div>
    </>
  );
};

// ---------- 3. Looped transformer ----------
export const LoopScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const R = 6, l = loopsAt(f, dur, R);
  const chip = (label: string, color: string, d: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: ramp(f, d), marginBottom: 26 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: color }} />
      <span>{label}</span>
    </div>
  );
  return (
    <>
      <LoopCore dur={dur} R={R} />
      <Heading n="02" kicker="The idea" title="Reuse one layer, R times" />
      <div style={{ position: "absolute", left: 1080, top: 320, ...T, fontSize: 36, color: C.ink2 }}>
        {chip("Prelude: reads the problem", "#6b6a66", 10)}
        {chip("Core: SAME weights every loop", C.blue, 30)}
        {chip("Coda: gives the answer", "#6b6a66", 50)}
        <div style={{ marginTop: 50, fontFamily: MONO, fontSize: 64, color: C.ink, opacity: ramp(f, dur * 0.2) }}>
          loop {l} / {R}
        </div>
        <div style={{ marginTop: 20, fontSize: 40, color: C.aqua, opacity: ramp(f, dur * 0.7) }}>
          + loops, + thinking, +0 parameters
        </div>
      </div>
    </>
  );
};

// ---------- 4. Puzzle ----------
const ORDER = [4, 12, 3, 9, 14, 7, 0, 10, 5, 15, 2, 8, 13, 1, 11, 6]; // one long cycle
const NEXT: Record<number, number> = {};
ORDER.forEach((a, i) => (NEXT[a] = ORDER[(i + 1) % 16]));
const PATH = [4, 12, 3, 9, 14, 7];

export const PuzzleScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const cx = 600, cy = 560, R = 320, nr = 30;
  const pt = (n: number) => [cx + R * Math.cos((n / 16) * 2 * Math.PI - Math.PI / 2), cy + R * Math.sin((n / 16) * 2 * Math.PI - Math.PI / 2)];
  const hopStart = dur * 0.45, hopLen = dur * 0.075;
  const hopsDone = Math.max(0, Math.min(5, (f - hopStart) / hopLen));
  const seg = (a: number, b: number) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b);
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    return [x1 + ux * nr, y1 + uy * nr, x2 - ux * (nr + 6), y2 - uy * (nr + 6)];
  };
  return (
    <>
      <Heading n="03" kicker="The test" title="Follow the arrows" />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <defs>
          {[["a", C.muted], ["h", C.orange]].map(([id, c]) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={c} />
            </marker>
          ))}
        </defs>
        {Array.from({ length: 16 }).map((_, a) => {
          const [x1, y1, x2, y2] = seg(a, NEXT[a]);
          const p = ramp(f, 15 + a * 3, 18);
          return <line key={a} x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p}
            stroke={C.muted} strokeOpacity={0.55} strokeWidth={2} markerEnd={p > 0.95 ? "url(#a)" : undefined} />;
        })}
        {PATH.slice(0, 5).map((a, i) => {
          const p = Math.max(0, Math.min(1, hopsDone - i));
          if (p <= 0) return null;
          const [x1, y1, x2, y2] = seg(a, PATH[i + 1]);
          return <line key={"h" + i} x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p}
            stroke={C.orange} strokeWidth={6} markerEnd={p > 0.95 ? "url(#h)" : undefined} />;
        })}
        {Array.from({ length: 16 }).map((_, n) => {
          const [x, y] = pt(n);
          const s = ramp(f, 4 + n * 1.5, 14);
          const onPath = PATH.indexOf(n), reached = onPath >= 0 && hopsDone >= onPath && f > hopStart - 10;
          const isAns = n === 7 && hopsDone >= 5;
          return (
            <g key={n} transform={`translate(${x},${y}) scale(${s})`}>
              <circle r={isAns ? nr + 8 : nr} fill={isAns ? C.aqua : reached ? C.orange : C.raised}
                stroke={n === 4 ? C.orange : C.grid} strokeWidth={3} />
              <text textAnchor="middle" dy="0.35em" fontFamily={FONT} fontSize={26} fontWeight={700} fill={C.ink}>{n}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 1080, top: 300, width: 740, ...T }}>
        <div style={{ fontSize: 34, color: C.ink2, opacity: ramp(f, dur * 0.08) }}>16 nodes · each points to exactly one other node · shuffled every puzzle</div>
        <div style={{ marginTop: 40, fontSize: 46, fontWeight: 700, opacity: ramp(f, dur * 0.3) }}>
          Start at <span style={{ color: C.orange }}>4</span>, follow <span style={{ color: C.orange }}>5</span> arrows.
        </div>
        <div style={{ marginTop: 28, fontFamily: MONO, fontSize: 46 }}>
          {PATH.map((n, i) => (
            <span key={i} style={{ opacity: i === 0 ? ramp(f, dur * 0.35) : Math.min(1, Math.max(0, hopsDone - i + 1)), color: i === 5 ? C.aqua : C.ink }}>
              {i > 0 ? " → " : ""}{n}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 50, fontSize: 32, color: C.ink2, lineHeight: 1.6, opacity: ramp(f, dur * 0.85) }}>
          Train on <b style={{ color: C.ink }}>1–4 hops</b><br />Test on <b style={{ color: C.ink }}>1–8 hops</b> (5–8 never seen)
        </div>
      </div>
    </>
  );
};

// ---------- 5. Models ----------
export const ModelsScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const loopDepth = f < dur * 0.72 ? 6 : f < dur * 0.84 ? 10 : 18;
  const models = [
    { name: "Shallow", params: 0.40, depth: 2, color: C.blue, note: "2 unique layers", d: 0.1 },
    { name: "Deep", params: 1.59, depth: 8, color: C.orange, note: "8 unique layers", d: 0.28 },
    { name: "Looped", params: 0.62, depth: loopDepth, color: C.aqua, note: `1 + core×R + 1 (R = ${loopDepth - 2})`, d: 0.5 },
  ];
  return (
    <>
      <Heading n="04" kicker="The contestants" title="Three models, trained from scratch" />
      <div style={{ position: "absolute", left: 110, top: 300, display: "flex", gap: 50 }}>
        {models.map((m) => {
          const s = spring({ frame: f - dur * m.d, fps, config: { damping: 14 } });
          return (
            <div key={m.name} style={{ width: 520, height: 540, background: C.surface, borderRadius: 24, padding: 40, boxSizing: "border-box",
              transform: `translateY(${(1 - s) * 60}px)`, opacity: s, borderTop: `6px solid ${m.color}`, ...T }}>
              <div style={{ fontSize: 54, fontWeight: 800 }}>{m.name}</div>
              <div style={{ fontSize: 28, color: C.ink2, marginTop: 6 }}>{m.note}</div>
              <div style={{ marginTop: 44, fontSize: 26, color: C.muted, fontFamily: MONO }}>PARAMETERS</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
                <div style={{ height: 26, width: (m.params / 1.59) * 300 * s, background: m.color, borderRadius: 6 }} />
                <span style={{ fontSize: 36, fontWeight: 700 }}>{m.params.toFixed(2)}M</span>
              </div>
              <div style={{ marginTop: 40, fontSize: 26, color: C.muted, fontFamily: MONO }}>DEPTH (STEPS)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, width: 440 }}>
                {Array.from({ length: m.depth }).map((_, i) => (
                  <div key={i} style={{ width: 40, height: 40, borderRadius: 6, background: m.color, opacity: 0.35 + 0.65 * s }} />
                ))}
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, marginTop: 12 }}>{m.depth}</div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ---------- 6. Accuracy bars ----------
const ACC = {
  shallow: [100, 100, 45.4, 17.1, 13.2, 24.2, 12.6, 21.0],
  deep: [100, 100, 100, 99.8, 23.6, 11.0, 12.7, 10.1],
  looped: [100, 100, 100, 100, 96.4, 7.6, 9.6, 15.3],
};
export const AccuracyScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x0 = 240, x1 = 1760, yTop = 330, yBot = 880, gw = (x1 - x0) / 8, bw = 46;
  const y = (v: number) => yBot - (v / 100) * (yBot - yTop);
  const series: [keyof typeof ACC, string, number][] = [["shallow", C.blue, 0.1], ["deep", C.orange, 0.27], ["looped", C.aqua, 0.45]];
  const call = ramp(f, dur * 0.6);
  return (
    <>
      <Heading n="05" kicker="Benchmark 1" title="Accuracy by number of hops" />
      <Legend x={1010} y={110} items={[["Shallow (0.40M)", C.blue], ["Deep (1.59M)", C.orange], ["Looped (0.62M, R=8)", C.aqua]]} />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <rect x={x0 + gw * 4} y={yTop - 30} width={gw * 4} height={yBot - yTop + 30} fill="#ffffff" opacity={0.035} />
        <text x={x0 + gw * 6} y={yTop - 42} textAnchor="middle" fontFamily={FONT} fontSize={28} fill={C.ink2}>never seen in training</text>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth={1} />
            <text x={x0 - 18} y={y(v)} dy="0.35em" textAnchor="end" fontFamily={FONT} fontSize={24} fill={C.muted}>{v}%</text>
          </g>
        ))}
        {Array.from({ length: 8 }).map((_, k) => (
          <text key={k} x={x0 + gw * (k + 0.5)} y={yBot + 44} textAnchor="middle" fontFamily={FONT} fontSize={30} fill={C.ink}>k={k + 1}</text>
        ))}
        {series.map(([name, color, d], si) =>
          ACC[name].map((v, k) => {
            const s = spring({ frame: f - dur * d - k * 3, fps, config: { damping: 18 } });
            const h = (v / 100) * (yBot - yTop) * s;
            const x = x0 + gw * (k + 0.5) + (si - 1) * (bw + 6) - bw / 2;
            return <rect key={name + k} x={x} y={yBot - h} width={bw} height={Math.max(0, h)} rx={4} fill={color} />;
          })
        )}
        <g opacity={call}>
          <text x={x0 + gw * 4.5 + bw + 6} y={y(96.4) - 22} textAnchor="middle" fontFamily={FONT} fontSize={40} fontWeight={800} fill={C.ink}>96%</text>
        </g>
      </svg>
    </>
  );
};

// ---------- 7. Staircase heatmap (real plot) ----------
export const StaircaseScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, dur], [1, 1.06]);
  return (
    <>
      <Heading n="06" kicker="Benchmark 2" title="The staircase: loops × hops" />
      <div style={{ position: "absolute", left: 235, top: 225, width: 1450, opacity: ramp(f, 8), transform: `scale(${z})`, transformOrigin: "30% 40%" }}>
        <Img src={staticFile("plots/acc_vs_loops.png")} style={{ width: 1450, borderRadius: 18 }} />
      </div>
      <div style={{ position: "absolute", right: 110, top: 105, ...T, fontSize: 32, color: C.aqua, opacity: ramp(f, dur * 0.45) }}>
        each extra loop ≈ one more hop
      </div>
    </>
  );
};

// ---------- 8. Logit lens ----------
const LENS = [[3, 68], [4, 96], [5, 92], [5, 97], [5, 98]]; // loop r -> (most likely hop j, %)
export const LensScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const x0 = 470, cw = 200, y0 = 330, rh = 105;
  return (
    <>
      <Heading n="07" kicker="Looking inside" title="Logit lens: what is it thinking?" />
      <div style={{ position: "absolute", left: 110, top: 220, ...T, fontSize: 30, color: C.ink2, opacity: ramp(f, 10) }}>
        Puzzle with 5 hops · decode the hidden state after every loop · 512 examples
      </div>
      {["start", "hop 1", "hop 2", "hop 3", "hop 4", "hop 5 ✓"].map((h, j) => (
        <div key={h} style={{ position: "absolute", left: x0 + j * cw, top: y0, width: cw - 16, textAlign: "center", ...T,
          fontSize: 30, fontWeight: 700, color: j === 5 ? C.aqua : C.ink2, opacity: ramp(f, 14 + j * 3) }}>{h}</div>
      ))}
      {LENS.map(([j, pct], r) => {
        const a = ramp(f, dur * (0.22 + r * 0.13), 16);
        return (
          <React.Fragment key={r}>
            <div style={{ position: "absolute", left: 140, top: y0 + 70 + r * rh, ...T, fontFamily: MONO, fontSize: 34, color: C.ink2, opacity: a }}>
              after loop {r + 1}
            </div>
            {Array.from({ length: 6 }).map((_, c) => (
              <div key={c} style={{ position: "absolute", left: x0 + c * cw, top: y0 + 60 + r * rh, width: cw - 16, height: rh - 22,
                borderRadius: 12, background: c === j ? (j === 5 ? C.aqua : C.orange) : C.surface, opacity: c === j ? a : 0.6 * a,
                display: "flex", alignItems: "center", justifyContent: "center", ...T, fontSize: 38, fontWeight: 800 }}>
                {c === j ? `${pct}%` : ""}
              </div>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------- line chart helper ----------
const RS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 24, 32];
const LineChart: React.FC<{ lines: { ys: number[]; color: string; start: number; len: number; label: string; dash?: string }[]; f: number }> = ({ lines, f }) => {
  const x0 = 240, x1 = 1640, yTop = 300, yBot = 860;
  const X = (r: number) => x0 + (Math.log2(r) / 5) * (x1 - x0);
  const Y = (v: number) => yBot - (v / 100) * (yBot - yTop);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute" }}>
      <rect x={X(3.5)} y={yTop - 20} width={X(4.5) - X(3.5)} height={yBot - yTop + 20} fill="#ffffff" opacity={0.05} />
      <text x={X(4)} y={yTop - 32} textAnchor="middle" fontFamily={FONT} fontSize={24} fill={C.muted}>trained R=4</text>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}><line x1={x0} x2={x1} y1={Y(v)} y2={Y(v)} stroke={C.grid} />
          <text x={x0 - 18} y={Y(v)} dy="0.35em" textAnchor="end" fontFamily={FONT} fontSize={24} fill={C.muted}>{v}%</text></g>
      ))}
      {[1, 2, 4, 8, 16, 32].map((r) => (
        <text key={r} x={X(r)} y={yBot + 42} textAnchor="middle" fontFamily={FONT} fontSize={28} fill={C.ink}>{r}</text>
      ))}
      <text x={(x0 + x1) / 2} y={yBot + 90} textAnchor="middle" fontFamily={FONT} fontSize={28} fill={C.ink2}>loops at test time (R)</text>
      {lines.map((l) => {
        const d = RS.map((r, i) => `${i ? "L" : "M"}${X(r)},${Y(l.ys[i])}`).join(" ");
        const p = ramp(f, l.start, l.len);
        const last = RS.length - 1;
        return (
          <g key={l.label}>
            <path d={d} fill="none" stroke={l.color} strokeWidth={6} strokeLinejoin="round" pathLength={1}
              strokeDasharray={l.dash ? undefined : "1 1"} strokeDashoffset={l.dash ? undefined : 1 - p} opacity={l.dash ? p : 1} />
            {RS.map((r, i) => (i / last <= p ? <circle key={r} cx={X(r)} cy={Y(l.ys[i])} r={7} fill={l.color} stroke={C.bg} strokeWidth={2} /> : null))}
            <text x={X(32) + 24} y={Y(l.ys[last])} dy="0.35em" fontFamily={FONT} fontSize={28} fontWeight={700} fill={C.ink} opacity={p > 0.98 ? 1 : 0}>{l.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ---------- 9. Overthinking ----------
const FIXED = [12, 5, 100, 100, 100, 100, 98, 91, 75, 63, 50, 40, 35];
const RANDOM = [6, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
export const OverthinkScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  return (
    <>
      <Heading n="08" kicker="The trap" title="Overthinking" />
      <Legend x={1060} y={110} items={[["Trained with R = 4", C.red], ["Trained with random R", C.aqua]]} />
      <div style={{ position: "absolute", left: 110, top: 215, ...T, fontSize: 30, color: C.ink2 }}>Accuracy on 4-hop puzzles vs. number of loops</div>
      <LineChart f={f} lines={[
        { ys: FIXED, color: C.red, start: dur * 0.12, len: dur * 0.35, label: "35%" },
        { ys: RANDOM, color: C.aqua, start: dur * 0.72, len: dur * 0.2, label: "100%" },
      ]} />
      <div style={{ position: "absolute", left: 1230, top: 370, ...T, fontSize: 44, fontWeight: 800, color: C.red, opacity: ramp(f, dur * 0.5) }}>
        overthinking ↘
      </div>
    </>
  );
};

// ---------- 10. Cures ----------
export const CuresScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows: [string, number, string, number][] = [
    ["No fix (fixed R = 4)", 35, C.red, 0.02], ["Multi-step loss", 50, C.orange, 0.18],
    ["Random loop counts in training", 100, C.aqua, 0.36], ["Write-back gate", 100, C.blue, 0.55],
  ];
  const g = interpolate(f, [dur * 0.62, dur * 0.85], [1, 0.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <Heading n="09" kicker="Three cures" title="Accuracy on 4 hops, at 32 loops" />
      {rows.map(([label, v, color, d], i) => {
        const s = spring({ frame: f - dur * d, fps, config: { damping: 16 } });
        return (
          <div key={label} style={{ position: "absolute", left: 110, top: 290 + i * 120, display: "flex", alignItems: "center", opacity: s, ...T }}>
            <div style={{ width: 560, fontSize: 36, color: C.ink2 }}>{label}</div>
            <div style={{ height: 64, width: v * 7.2 * s, background: color, borderRadius: "0 8px 8px 0" }} />
            <div style={{ marginLeft: 20, fontSize: 44, fontWeight: 800 }}>{Math.round(v * s)}%</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 110, top: 800, ...T, opacity: ramp(f, dur * 0.6) }}>
        <div style={{ fontFamily: MONO, fontSize: 36 }}>h ← h + <span style={{ color: C.blue }}>g</span> · (new − h)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14, fontSize: 30, color: C.ink2 }}>
          gate g <div style={{ width: 400, height: 22, background: C.surface, borderRadius: 11 }}>
            <div style={{ width: 400 * g, height: 22, background: C.blue, borderRadius: 11 }} /></div>
          {g < 0.1 ? "“I'm done, freeze me.”" : "still updating…"}
        </div>
      </div>
    </>
  );
};

// ---------- 11. Harder problems ----------
export const HarderScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data: [string, number, number][] = [["5 hops", 37, 95], ["6 hops", 11, 78], ["7 hops", 12, 50]];
  const yBot = 840, H = 480;
  return (
    <>
      <Heading n="10" kicker="Test-time compute" title="Think longer → solve harder (sometimes)" />
      <Legend x={110} y={225} items={[["4 loops", C.muted], ["16 loops", C.blue]]} />
      {data.map(([k, a, b], i) => {
        const sa = spring({ frame: f - dur * 0.08 - i * 4, fps, config: { damping: 16 } });
        const sb = spring({ frame: f - dur * 0.3 - i * 6, fps, config: { damping: 16 } });
        const x = 260 + i * 420;
        return (
          <React.Fragment key={k}>
            {[[a, sa, C.muted, 0], [b, sb, C.blue, 150]].map(([v, s, c, dx]) => (
              <React.Fragment key={String(dx)}>
                <div style={{ position: "absolute", left: x + (dx as number), top: yBot - (v as number) / 100 * H * (s as number), width: 130,
                  height: (v as number) / 100 * H * (s as number), background: c as string, borderRadius: "8px 8px 0 0" }} />
                <div style={{ position: "absolute", left: x + (dx as number), width: 130, textAlign: "center", top: yBot - (v as number) / 100 * H - 56,
                  ...T, fontSize: 38, fontWeight: 800, opacity: s as number }}>{v}%</div>
              </React.Fragment>
            ))}
            <div style={{ position: "absolute", left: x, width: 280, textAlign: "center", top: yBot + 16, ...T, fontSize: 34 }}>{k}</div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", right: 110, top: 380, width: 420, ...T, fontSize: 32, color: C.ink2, lineHeight: 1.5,
        background: C.surface, padding: 30, borderRadius: 18, borderLeft: `6px solid ${C.yellow}`, opacity: ramp(f, dur * 0.62) }}>
        Never trained on these.<br /><b style={{ color: C.ink }}>One seed only</b>: another seed didn't improve.
        It knows how to <i>step</i>, not always when to <i>stop</i>.
      </div>
    </>
  );
};

// ---------- 12. Cost ----------
export const CostScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms: [number, number][] = [[1, 5.2], [2, 6.8], [4, 10.0], [8, 16.5], [16, 29.8], [32, 57.1]];
  const yBot = 860, H = 520, max = 60;
  return (
    <>
      <Heading n="11" kicker="The price" title="Every loop costs time" />
      <div style={{ position: "absolute", left: 110, top: 215, ...T, fontSize: 30, color: C.ink2 }}>Milliseconds per forward pass (batch 256, M4 GPU)</div>
      {ms.map(([r, v], i) => {
        const s = spring({ frame: f - 10 - i * 7, fps, config: { damping: 16 } });
        const x = 240 + i * 250;
        return (
          <React.Fragment key={r}>
            <div style={{ position: "absolute", left: x, top: yBot - (v / max) * H * s, width: 150, height: (v / max) * H * s, background: C.blue, borderRadius: "8px 8px 0 0" }} />
            <div style={{ position: "absolute", left: x, width: 150, textAlign: "center", top: yBot - (v / max) * H - 52, ...T, fontSize: 34, fontWeight: 700, opacity: s }}>{v}</div>
            <div style={{ position: "absolute", left: x, width: 150, textAlign: "center", top: yBot + 14, ...T, fontSize: 30 }}>R={r}</div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 220, width: 1520, top: yBot - (12.5 / max) * H, borderTop: `3px dashed ${C.orange}`, opacity: ramp(f, dur * 0.45) }}>
        <span style={{ position: "relative", top: -44, left: 20, ...T, fontSize: 28, color: C.orange }}>deep (8 layers): 12.5 ms</span>
      </div>
    </>
  );
};

// ---------- 13. Receipts ----------
export const ReceiptsScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const imgs: [string, string][] = [["baseline.png", "Baseline (seed 0)"], ["gate.png", "+ write-back gate"], ["ms.png", "+ multi-step loss"], ["gate_seed1.png", "+ gate, seed 1"]];
  return (
    <>
      <Heading n="12" kicker="The receipts" title="Every benchmark, raw" />
      {imgs.map(([src, label], i) => {
        const a = ramp(f, 10 + i * dur * 0.12, 18);
        return (
          <div key={src} style={{ position: "absolute", left: 230 + (i % 2) * 760, top: 200 + Math.floor(i / 2) * 375, opacity: a,
            transform: `translateY(${(1 - a) * 30}px)` }}>
            <div style={{ ...T, fontSize: 28, color: C.ink2, marginBottom: 8 }}>{label}</div>
            <Img src={staticFile(`plots/${src}`)} style={{ width: 700, borderRadius: 12 }} />
          </div>
        );
      })}
    </>
  );
};

// ---------- 14. Outro ----------
export const OutroScene: React.FC<P> = ({ dur }) => {
  const f = useCurrentFrame();
  const items: [string, string][] = [["Depth beats size", C.aqua], ["Loops are reasoning steps", C.blue], ["Looped models must learn when to stop", C.orange]];
  return (
    <>
      <div style={{ position: "absolute", inset: 0, opacity: 0.3 }}><LoopRing speed={0.6} offset={[3.2, -0.6, 0]} /></div>
      <div style={{ position: "absolute", left: 120, top: 220, ...T }}>
        {items.map(([t, c], i) => (
          <div key={t} style={{ fontSize: 70, fontWeight: 800, letterSpacing: -1.5, marginBottom: 26, opacity: ramp(f, 8 + i * dur * 0.14),
            borderLeft: `10px solid ${c}`, paddingLeft: 30 }}>{t}</div>
        ))}
        <div style={{ marginTop: 70, fontFamily: MONO, fontSize: 40, color: C.ink2, opacity: ramp(f, dur * 0.55) }}>
          github.com/Adityakk9031/looped-transformer-toy
        </div>
      </div>
    </>
  );
};
