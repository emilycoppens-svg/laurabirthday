import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Puff = {
  w: number; // px container width
  h: number;
  top: string;
  left?: string;
  right?: string;
  bottom?: string;
  tone: "sky" | "moss" | "peach";
  delay?: number;
};

// Tones inspired by the reference: chunky cumulus puffs, sunlit warm-cream tops
// fading down through pastel cyan/mint into deeper moss at the base.
const toneStyles: Record<Puff["tone"], { base: string; highlight: string }> = {
  sky: {
    base: "linear-gradient(180deg, hsl(50 100% 96%) 0%, hsl(180 75% 86%) 35%, hsl(180 60% 70%) 70%, hsl(160 50% 50%) 100%)",
    highlight: "hsl(50 100% 95%)",
  },
  moss: {
    base: "linear-gradient(180deg, hsl(60 90% 94%) 0%, hsl(150 60% 80%) 35%, hsl(150 50% 60%) 70%, hsl(150 55% 38%) 100%)",
    highlight: "hsl(55 95% 94%)",
  },
  peach: {
    base: "linear-gradient(180deg, hsl(45 100% 95%) 0%, hsl(170 70% 85%) 40%, hsl(160 55% 65%) 75%, hsl(150 45% 42%) 100%)",
    highlight: "hsl(48 100% 96%)",
  },
};

const PuffCloud = ({ p }: { p: Puff }) => {
  const t = toneStyles[p.tone];
  // Fewer, fatter lobes — chunky cumulus stacks like the reference video.
  const circles = [
    { l: 0.0, t: 0.32, s: 0.65 },   // bottom-left lobe
    { l: 0.22, t: 0.04, s: 0.7 },   // tall top-left lobe
    { l: 0.5, t: 0.12, s: 0.66 },   // top-right lobe
    { l: 0.65, t: 0.38, s: 0.55 },  // bottom-right lobe
    { l: 0.32, t: 0.42, s: 0.5 },   // bottom-center filler
  ];
  return (
    <div
      className="puff cloud-float"
      style={{
        width: `calc(${p.w}px * var(--cloud-scale))`,
        height: `calc(${p.h}px * var(--cloud-scale))`,
        top: p.top,
        left: p.left,
        right: p.right,
        bottom: p.bottom,
        animationDelay: `${p.delay ?? 0}s`,
      }}
    >
      {circles.map((c, i) => (
        <span
          key={i}
          style={{
            left: `${c.l * 100}%`,
            top: `${c.t * 100}%`,
            width: `${c.s * 100}%`,
            height: `${c.s * 100}%`,
            background: t.base,
          }}
        />
      ))}
      {/* highlight dot */}
      <span
        style={{
          left: "30%",
          top: "18%",
          width: "18%",
          height: "18%",
          background: `radial-gradient(circle at 35% 30%, ${t.highlight} 0%, transparent 65%)`,
          filter: "blur(2px)",
          boxShadow: "none",
        }}
      />
    </div>
  );
};

// Cloud bank — densely cover the door. Inner clouds sit OVER the centered door
// and split off to the left when opened.
const leftPuffs: Puff[] = [
  // outer-left blanket
  { w: 420, h: 260, top: "4%", left: "2%", tone: "sky", delay: 0 },
  { w: 360, h: 220, top: "22%", left: "-6%", tone: "moss", delay: 1.5 },
  { w: 380, h: 230, top: "44%", left: "8%", tone: "peach", delay: 3 },
  { w: 320, h: 200, top: "62%", left: "-4%", tone: "sky", delay: 2 },
  { w: 380, h: 230, top: "78%", left: "6%", tone: "moss", delay: 3.8 },
  // inner — covering the door's left half (centered around 35-50%)
  { w: 380, h: 240, top: "12%", left: "32%", tone: "moss", delay: 4 },
  { w: 340, h: 210, top: "34%", left: "36%", tone: "peach", delay: 1 },
  { w: 360, h: 220, top: "56%", left: "30%", tone: "sky", delay: 2.6 },
  { w: 320, h: 200, top: "74%", left: "34%", tone: "peach", delay: 0.7 },
];

const rightPuffs: Puff[] = [
  // outer-right blanket
  { w: 420, h: 260, top: "2%", right: "2%", tone: "moss", delay: 0.5 },
  { w: 360, h: 220, top: "22%", right: "-6%", tone: "sky", delay: 2.5 },
  { w: 380, h: 230, top: "46%", right: "6%", tone: "peach", delay: 3.5 },
  { w: 320, h: 200, top: "64%", right: "-4%", tone: "moss", delay: 1.2 },
  { w: 380, h: 230, top: "80%", right: "4%", tone: "sky", delay: 4.2 },
  // inner — covering the door's right half (centered around 50-65%)
  { w: 380, h: 240, top: "14%", right: "30%", tone: "sky", delay: 4.5 },
  { w: 340, h: 210, top: "36%", right: "34%", tone: "moss", delay: 0.8 },
  { w: 360, h: 220, top: "58%", right: "28%", tone: "peach", delay: 2.2 },
  { w: 320, h: 200, top: "76%", right: "32%", tone: "moss", delay: 1.4 },
];

// Per-cloud vertical drift (px) when parting — some rise, some sink, varied magnitudes
const leftDriftY = [-80, 60, -110, 90, -50, 70, -40, 100, -90];
const rightDriftY = [70, -90, 50, -100, 80, -60, 95, -75, 55];
// Slight rotation for organic motion
const leftRot = [-8, 6, -10, 4, -5, 7, -9, 5, -6];
const rightRot = [9, -6, 8, -7, 5, -9, 7, -8, 4];

const AdventureDoor = () => {
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();

  // After the clouds part and the door zooms in, transport into the universe
  useEffect(() => {
    if (!opened) return;
    const t = setTimeout(() => navigate("/universe"), 4000);
    return () => clearTimeout(t);
  }, [opened, navigate]);

  return (
    <section
      className="relative min-h-screen w-full overflow-hidden cursor-pointer select-none"
      style={{ background: "var(--gradient-sky)" }}
      onClick={() => setOpened(true)}
      role="button"
      aria-label="Click to go on an adventure"
    >
      {/* Distant atmospheric haze (subtle) */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 20% 20%, hsl(195 70% 85% / 0.6), transparent 50%), radial-gradient(ellipse at 80% 80%, hsl(150 40% 70% / 0.5), transparent 55%)",
        }}
      />

      {/* Stage */}
      <div className="relative flex items-center justify-center" style={{ height: "100vh" }}>
        {/* Door — scales up like walking toward it */}
        <div
          className="relative z-10"
          style={{
            transform: opened
              ? "scale(var(--door-open-scale)) translateY(-10px)"
              : "scale(var(--door-closed-scale))",
            opacity: opened ? 1 : 0.95,
            transition: "transform 3.6s var(--ease-cloud), opacity 1.8s var(--ease-cloud)",
          }}
        >
          <div
            className={`relative w-[18rem] md:w-[22rem] h-[28rem] md:h-[34rem] rounded-t-full ${opened ? "door-glow" : ""}`}
            style={{
              background: "linear-gradient(180deg, hsl(var(--door-wood)) 0%, hsl(150 35% 14%) 100%)",
              boxShadow: "var(--shadow-door)",
              border: "2px solid hsl(165 40% 45% / 0.4)",
            }}
          >
            <div className="absolute inset-4 rounded-t-full border" style={{ borderColor: "hsl(165 40% 45% / 0.3)" }} />
            <div
              className="absolute right-6 top-1/2 w-4 h-4 rounded-full"
              style={{ background: "hsl(var(--door-glow))", boxShadow: "0 0 20px hsl(var(--door-glow) / 0.8)" }}
            />
            {opened && (
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-3 rounded-full blur-md"
                style={{ background: "hsl(var(--door-glow) / 0.9)" }}
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <h2
                className={`font-display text-2xl md:text-3xl leading-tight tracking-tight ${opened ? "text-reveal" : "opacity-0"}`}
                style={{ color: "hsl(var(--sky-pale))", fontWeight: 600 }}
              >
                Going on an<br />adventure
              </h2>
            </div>
          </div>
        </div>

        {/* LEFT clouds — each drifts independently with vertical motion + fade */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {leftPuffs.map((p, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                transform: opened
                  ? `translate(-140%, ${leftDriftY[i]}px) rotate(${leftRot[i]}deg) scale(0.7)`
                  : "translate(0, 0) rotate(0) scale(1)",
                opacity: opened ? 0 : 1,
                transition: `transform 3.4s var(--ease-cloud) ${i * 0.08}s, opacity 1.8s ease-out ${0.6 + i * 0.08}s`,
              }}
            >
              <PuffCloud p={p} />
            </div>
          ))}
        </div>

        {/* RIGHT clouds */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {rightPuffs.map((p, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                transform: opened
                  ? `translate(140%, ${rightDriftY[i]}px) rotate(${rightRot[i]}deg) scale(0.7)`
                  : "translate(0, 0) rotate(0) scale(1)",
                opacity: opened ? 0 : 1,
                transition: `transform 3.4s var(--ease-cloud) ${i * 0.08}s, opacity 1.8s ease-out ${0.6 + i * 0.08}s`,
              }}
            >
              <PuffCloud p={p} />
            </div>
          ))}
        </div>

        {/* Hint */}
        {!opened && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 text-center hint-pulse px-6">
            <div className="font-display text-base md:text-xl text-primary/80 tracking-tight">
              click to go on an adventure
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-8 z-30 text-[0.65rem] tracking-[0.4em] uppercase text-primary/50">
        N° 001 — Mossgate
      </div>
      <div className="absolute bottom-6 right-8 z-30 text-[0.65rem] tracking-[0.4em] uppercase text-primary/50">
        Est. ✦ Wander
      </div>
    </section>
  );
};

export default AdventureDoor;
