// 3D scenes (React Three Fiber inside Remotion). All motion is driven by the frame number.
import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { C } from "./theme";

const Lights = () => (
  <>
    <ambientLight intensity={0.35} />
    <pointLight position={[6, 6, 8]} intensity={120} />
    <pointLight position={[-6, -3, 4]} intensity={40} color={C.blue} />
  </>
);

/** A ring of blocks with a token travelling around it: "the loop". */
export const LoopRing: React.FC<{ speed?: number; offset?: [number, number, number] }> = ({ speed = 1, offset = [2.4, 0.9, 0] }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const n = 14, R = 2.6;
  const tokenAngle = f * 0.045 * speed;
  return (
    <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 9], fov: 45 }}>
      <Lights />
      <group position={offset} rotation={[1.05, 0, f * 0.004]}>
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2;
          let d = Math.abs(((tokenAngle % (Math.PI * 2)) - a + Math.PI * 3) % (Math.PI * 2) - Math.PI);
          const pulse = Math.max(0, 1 - d / 0.6);
          return (
            <mesh key={i} position={[R * Math.cos(a), R * Math.sin(a), 0]} rotation={[0, 0, a + f * 0.02]}
              scale={0.42 * (1 + 0.35 * pulse)}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={C.blue} emissive={C.blue} emissiveIntensity={0.15 + 1.2 * pulse}
                metalness={0.3} roughness={0.35} />
            </mesh>
          );
        })}
        <mesh position={[R * Math.cos(tokenAngle), R * Math.sin(tokenAngle), 0.55]}>
          <sphereGeometry args={[0.22, 32, 32]} />
          <meshStandardMaterial color={C.orange} emissive={C.orange} emissiveIntensity={2} />
        </mesh>
        <mesh>
          <torusGeometry args={[R, 0.02, 8, 120]} />
          <meshBasicMaterial color={C.grid} />
        </mesh>
      </group>
    </ThreeCanvas>
  );
};

const HUES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];

/** Eight different slabs pop in: a normal transformer, every layer has its own weights. */
export const LayerStack: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const tokenY = interpolate(f, [dur * 0.55, dur * 0.9], [-3.2, 3.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <ThreeCanvas width={width} height={height} camera={{ position: [0, 0.6, 12.5], fov: 42 }}>
      <Lights />
      <group position={[2.6, -0.5, 0]} rotation={[0.38, -0.6 + f * 0.006, 0]}>
        {HUES.map((c, i) => {
          const s = spring({ frame: f - 12 - i * 9, fps, config: { damping: 12 } });
          return (
            <mesh key={i} position={[0, -2.45 + i * 0.7, 0]} scale={[s, s, s]}>
              <boxGeometry args={[3.2, 0.32, 2.2]} />
              <meshStandardMaterial color={c} emissive={c}
                emissiveIntensity={Math.abs(tokenY - (-2.45 + i * 0.7)) < 0.4 ? 1.2 : 0.12} metalness={0.2} roughness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[1.9, tokenY, 0]}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} />
        </mesh>
      </group>
    </ThreeCanvas>
  );
};

/** prelude -> core (looped, same weights) -> coda. Returns current loop count via `loopsAt`. */
export const loopsAt = (f: number, dur: number, R: number) =>
  Math.min(R, Math.max(0, Math.floor(interpolate(f, [dur * 0.22, dur * 0.8], [0, R], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) + 0.0001)));

export const LoopCore: React.FC<{ dur: number; R: number }> = ({ dur, R }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t1 = dur * 0.22, t2 = dur * 0.8;
  let pos: [number, number, number];
  let corePulse = 0;
  if (f < t1) {
    const y = interpolate(f, [0, t1], [-3.6, 0], { extrapolateLeft: "clamp" });
    pos = [0, y, 1.6];
  } else if (f < t2) {
    const p = (f - t1) / (t2 - t1) * R;            // loops completed (fractional)
    const a = p * Math.PI * 2 + Math.PI / 2;
    pos = [2.3 * Math.cos(a), 0.35 * Math.sin(p * Math.PI * 2), 2.3 * Math.sin(a)];
    corePulse = Math.max(0, 1 - (p % 1) / 0.25);   // flash at the start of each loop
  } else {
    const y = interpolate(f, [t2, dur], [0, 3.8], { extrapolateRight: "clamp" });
    pos = [0, y, 1.6];
  }
  const slab = (y: number, color: string, glow: number, key: string, delay: number) => {
    const s = spring({ frame: f - delay, fps, config: { damping: 13 } });
    return (
      <mesh key={key} position={[0, y, 0]} scale={[s, s, s]}>
        <boxGeometry args={[3.4, 0.45, 2.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} metalness={0.25} roughness={0.35} />
      </mesh>
    );
  };
  return (
    <ThreeCanvas width={width} height={height} camera={{ position: [0, 2.2, 13], fov: 40 }}>
      <Lights />
      <group position={[-2.6, -0.6, 0]} rotation={[0.12, -0.35, 0]}>
        {slab(-2.1, "#6b6a66", 0.1, "pre", 4)}
        {slab(0, C.blue, 0.2 + 1.6 * corePulse, "core", 10)}
        {slab(2.1, "#6b6a66", 0.1, "coda", 16)}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.3, 0.015, 8, 120]} />
          <meshBasicMaterial color={C.grid} />
        </mesh>
        <mesh position={pos}>
          <sphereGeometry args={[0.24, 32, 32]} />
          <meshStandardMaterial color={C.orange} emissive={C.orange} emissiveIntensity={2} />
        </mesh>
      </group>
    </ThreeCanvas>
  );
};
