import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * AdventureDoor — landing scene.
 *
 * One click triggers the full cinematic sequence:
 *   1. Brutalist hint fades + scales up
 *   2. Mist parts (drops + fades, ~2.6s)
 *   3. Door zooms toward camera (~3.2s, overlapping with mist)
 *   4. Door glow swells, then route transitions to /universe
 *
 * Total wall-clock: ~3.6s before navigate fires.
 */

type MistLayer = {
  width: number;
  height: number;
  leftPct: number;
  topPct: number;
  alphaMul: number;
  blurPx: number;
  driftX: number;
  driftY: number;
  delay: number;
  z: number;
};

// Palette: cool & dreamy
const PALETTE = {
  bgTop: "hsl(205 60% 84%)",
  bgBot: "hsl(210 35% 60%)",
  cloudA: "245, 248, 252",
  cloudB: "219, 230, 241",
  cloudC: "194, 211, 227",
  shadow: "60, 80, 110",
  doorTop: "hsl(215 40% 18%)",
  doorBot: "hsl(215 45% 11%)",
  doorBorder: "hsl(215 35% 45%)",
  glow: "232, 214, 168",
  textColor: "hsl(215 50% 14%)",
  textShadow: "255, 255, 255",
} as const;

const DENSITY = 8;
const MIST_HEIGHT_PCT = 85;

function buildMistLayers(): MistLayer[] {
  const layers: MistLayer[] = [];
  const layerCount = Math.min(8, 2 + Math.ceil(DENSITY * 0.7));

  for (let i = 0; i < layerCount; i++) {
    const w = 220 + ((i * 47) % 180);
    const h = 110 + ((i * 31) % 90);
    const yPct = (100 - MIST_HEIGHT_PCT) + (i / layerCount) * MIST_HEIGHT_PCT * 0.85;
    const xOff = ((i * 23) % 80) + 10 - 50;
    const leftPct = 50 + xOff - (w / 6.8) / 2;
    const driftDir = i % 2 === 0 ? 1 : -1;
    const driftAmt = 60 + ((i * 13) % 60);

    layers.push({
      width: w,
      height: h,
      leftPct,
      topPct: yPct,
      alphaMul: Math.min(0.95, 0.4 + DENSITY * 0.07),
      blurPx: 10 + (i % 3) * 4,
      driftX: driftDir * driftAmt,
      driftY: 50,
      delay: i * 0.06,
      z: 10 + i,
    });
  }

  if (DENSITY >= 6) {
    const wispCount = Math.floor((DENSITY - 5) * 1.5) + 1;
    for (let i = 0; i < wispCount; i++) {
      const w = 180 + ((i * 41) % 120);
      const h = 60 + ((i * 17) % 40);
      const yPct = 5 + ((i * 11) % 25);
      const leftPct = 5 + ((i * 29) % 80);
      const driftDir = i % 2 === 0 ? 1 : -1;

      layers.push({
        width: w,
        height: h,
        leftPct,
        topPct: yPct,
        alphaMul: 0.5 + (DENSITY - 5) * 0.05,
        blurPx: 14,
        driftX: driftDir * 80,
        driftY: -40,
        delay: 0.08 * i + 0.2,
        z: 20 + i,
      });
    }
  }
  return layers;
}

const MIST_LAYERS = buildMistLayers();

const rgba = (rgb: string, a: number) => `rgba(${rgb}, ${a})`;

const AdventureDoor = () => {
  const [phase, setPhase] = useState<"idle" | "playing">("idle");
  const navigate = useNavigate();
  const playedRef = useRef(false);

  const play = () => {
    if (playedRef.current) return;
    playedRef.current = true;
    setPhase("playing");
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setTimeout(() => navigate("/universe"), 3600);
    return () => clearTimeout(t);
  }, [phase, navigate]);

  const opened = phase === "playing";

  const baseAlpha = Math.min(1, 0.35 + DENSITY * 0.075);
  const baseStop = Math.max(15, 50 - DENSITY * 4);
  const baseMistGradient = `linear-gradient(180deg,
    transparent 0%,
    ${rgba(PALETTE.cloudA, baseAlpha * 0.3)} ${baseStop}%,
    ${rgba(PALETTE.cloudB, baseAlpha * 0.7)} ${Math.min(95, baseStop + 25)}%,
    ${rgba(PALETTE.cloudC, baseAlpha)} 100%)`;

  return (
    <section
      className="relative min-h-screen w-full overflow-hidden cursor-pointer select-none"
      style={{
        background: `linear-gradient(180deg, ${PALETTE.bgTop} 0%, ${PALETTE.bgBot} 100%)`,
      }}
      onClick={play}
      role="button"
      aria-label="Click to go on an adventure"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.4,
          background: `
            radial-gradient(ellipse at 25% 30%, ${rgba(PALETTE.cloudA, 0.8)}, transparent 55%),
            radial-gradient(ellipse at 75% 65%, ${rgba(PALETTE.cloudB, 0.67)}, transparent 60%)`,
        }}
      />

      {/* Door — beneath mist when at rest, scales up dramatically on play */}
      <div
        className="absolute left-1/2 top-1/2 z-[5]"
        style={{
          transform: opened
            ? "translate(-50%, -50%) scale(7)"
            : "translate(-50%, -50%) scale(var(--door-closed-scale))",
          opacity: opened ? 0.85 : 0.95,
          transition:
            "transform 3.2s cubic-bezier(0.55, 0, 0.2, 1), opacity 1s ease",
        }}
      >
        <div
          className="relative w-[18rem] md:w-[22rem] h-[28rem] md:h-[34rem] rounded-t-full"
          style={{
            background: `linear-gradient(180deg, ${PALETTE.doorTop} 0%, ${PALETTE.doorBot} 100%)`,
            border: `2px solid ${PALETTE.doorBorder}66`,
            boxShadow:
              `0 30px 60px -20px ${rgba(PALETTE.shadow, 0.55)},
               0 10px 25px -10px ${rgba(PALETTE.shadow, 0.45)},
               inset 0 1px 0 ${PALETTE.doorBorder}44`,
          }}
        >
          <div
            className="absolute inset-4 rounded-t-full border"
            style={{ borderColor: `${PALETTE.doorBorder}55` }}
          />
          <div
            className="absolute right-6 top-1/2 w-4 h-4 rounded-full"
            style={{
              background: `rgb(${PALETTE.glow})`,
              boxShadow: `0 0 20px ${rgba(PALETTE.glow, 0.8)}`,
            }}
          />
          <div
            className="absolute -inset-1 rounded-t-full pointer-events-none"
            style={{
              opacity: opened ? 1 : 0,
              boxShadow: `0 0 80px 12px ${rgba(PALETTE.glow, 0.7)},
                          inset 0 0 60px ${rgba(PALETTE.glow, 0.4)}`,
              transition: "opacity 1s ease",
            }}
          />
        </div>
      </div>

      {/* Base mist — wall of fog rising from bottom */}
      <div
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{
          height: `${MIST_HEIGHT_PCT}%`,
          background: baseMistGradient,
          filter: `blur(${6 + DENSITY * 0.6}px)`,
          opacity: opened ? 0 : 1,
          transform: opened ? "translateY(80%)" : "translateY(0)",
          transition:
            "transform 2.6s cubic-bezier(0.65,0,0.35,1), opacity 1.8s ease 0.3s",
          zIndex: 8,
        }}
      />

      {/* Layered mist puffs */}
      {MIST_LAYERS.map((m, i) => {
        const layerAlpha = m.alphaMul;
        const isWisp = m.z >= 20;
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: `${m.leftPct}%`,
              top: `${m.topPct}%`,
              width: m.width,
              height: m.height,
              background: isWisp
                ? `radial-gradient(ellipse at 50% 50%,
                    ${rgba(PALETTE.cloudA, layerAlpha)} 0%,
                    ${rgba(PALETTE.cloudB, 0.25)} 50%,
                    transparent 80%)`
                : `radial-gradient(ellipse at 50% 50%,
                    ${rgba(PALETTE.cloudA, layerAlpha)} 0%,
                    ${rgba(PALETTE.cloudB, layerAlpha * 0.7)} 45%,
                    ${rgba(PALETTE.cloudC, layerAlpha * 0.3)} 75%,
                    transparent 100%)`,
              filter: `blur(${m.blurPx}px)`,
              opacity: opened
                ? 0
                : isWisp
                  ? 0.8
                  : Math.min(1, 0.55 + DENSITY * 0.05),
              transform: opened
                ? `translate(${m.driftX}px, ${m.driftY}px) scale(0.9)`
                : "translate(0, 0) scale(1)",
              transition: `transform 2.6s cubic-bezier(0.65,0,0.35,1) ${m.delay}s,
                           opacity 1.6s ease ${m.delay + 0.3}s`,
              zIndex: m.z,
            }}
          />
        );
      })}

      {/* Brutalist headline */}
      <div
        className="absolute left-0 right-0 top-1/2 z-[35] text-center pointer-events-none px-4"
        style={{
          transform: opened
            ? "translateY(-50%) scale(1.18)"
            : "translateY(-50%) scale(1)",
          opacity: opened ? 0 : 1,
          transition: "opacity 0.7s ease, transform 0.9s cubic-bezier(0.7,0,0.3,1)",
        }}
      >
        <div
          className="font-brutalist uppercase"
          style={{
            color: PALETTE.textColor,
            fontSize: "clamp(42px, 9vw, 130px)",
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: "0.01em",
            textShadow: `0 2px 0 ${rgba(PALETTE.textShadow, 0.45)},
                         0 0 40px ${rgba(PALETTE.textShadow, 0.5)}`,
          }}
        >
          click to go on
          <br />
          an adventure
        </div>
      </div>

      {/* Corner labels */}
      <div
        className="absolute bottom-6 left-8 z-30 text-[0.65rem] tracking-[0.4em] uppercase"
        style={{
          color: PALETTE.textColor,
          opacity: opened ? 0 : 0.5,
          transition: "opacity 0.6s ease",
        }}
      >
        N° 001 — Mossgate
      </div>
      <div
        className="absolute bottom-6 right-8 z-30 text-[0.65rem] tracking-[0.4em] uppercase"
        style={{
          color: PALETTE.textColor,
          opacity: opened ? 0 : 0.5,
          transition: "opacity 0.6s ease",
        }}
      >
        Est. ✦ Wander
      </div>
    </section>
  );
};

export default AdventureDoor;
