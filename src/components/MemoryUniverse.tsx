import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Tone = "sky" | "moss" | "peach";

type Media =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster?: string };

type Role = "anchor" | "hero" | "regular";

type Memory = {
  id: string;
  x: number;
  y: number;
  tone: Tone;
  role: Role;
  media?: Media;
};

const WORLD_W = 1900;
const WORLD_H = 1200;
const DRAG_THRESHOLD = 10;

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_DIST = 30;

// Inertia tuning — Apple Maps feel.
const FRICTION = 0.95;
const MIN_VELOCITY = 0.05;
const VELOCITY_WINDOW_MS = 100;

const LERP_DESKTOP = 0.12;
const LERP_TOUCH = 0.20;

const OVERDRAG_RESISTANCE = 0.55;
const RUBBERBAND_RETURN = 0.18;

// Tone-tinted halo colors. Five alpha-graded stops feed a radial gradient that
// fades exponentially from the photo edge — never solid, never with a visible
// outer ring. Inner stops keep low alpha so the glow blurs off the photo
// instead of sitting around it as a bright disc.
const TONE_HALO: Record<Tone, {
  s1: string; s2: string; s3: string; s4: string; s5: string;
}> = {
  sky: {
    s1: "hsl(50 95% 80% / 0.28)",
    s2: "hsl(50 95% 80% / 0.18)",
    s3: "hsl(50 90% 78% / 0.10)",
    s4: "hsl(195 75% 75% / 0.04)",
    s5: "hsl(195 75% 75% / 0)",
  },
  moss: {
    s1: "hsl(55 90% 78% / 0.26)",
    s2: "hsl(55 85% 78% / 0.16)",
    s3: "hsl(80 60% 70% / 0.09)",
    s4: "hsl(150 55% 60% / 0.04)",
    s5: "hsl(150 55% 60% / 0)",
  },
  peach: {
    s1: "hsl(38 95% 78% / 0.28)",
    s2: "hsl(38 95% 78% / 0.18)",
    s3: "hsl(34 90% 75% / 0.10)",
    s4: "hsl(28 80% 70% / 0.04)",
    s5: "hsl(28 80% 70% / 0)",
  },
};

// Role-driven sizing. Halo size is a multiplier on a fixed envelope; we keep
// the touch-target wrapper constant for thumb reliability.
const ROLE_SCALE: Record<Role, { size: number; haloRadius: number; opacity: number }> = {
  anchor:  { size: 1.15, haloRadius: 1.5,  opacity: 1.0 },
  hero:    { size: 1.0,  haloRadius: 1.15, opacity: 1.0 },
  regular: { size: 0.85, haloRadius: 0.85, opacity: 0.85 },
};

const HEROES = new Set(["m5", "m7", "m12", "m19", "m24", "m29"]);

// Photos only — no titles or captions. Add real ones later if you want them.
const memories: Memory[] = [
  // NW cluster
  { id: "m1",  x: 230,  y: 170,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_0121.jpeg" } },
  { id: "m2",  x: 360,  y: 150,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_0137.jpeg" } },
  { id: "m3",  x: 200,  y: 270,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_0327.jpeg" } },
  { id: "m4",  x: 340,  y: 280,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1092.jpeg" } },
  { id: "m5",  x: 470,  y: 200,  tone: "moss",  role: "hero",    media: { type: "image", src: "/memories/IMG_1214.jpeg" } },

  // N cluster
  { id: "m6",  x: 800,  y: 150,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1250.jpeg" } },
  { id: "m7",  x: 940,  y: 130,  tone: "peach", role: "hero",    media: { type: "image", src: "/memories/IMG_1261.jpeg" } },
  { id: "m8",  x: 1060, y: 180,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1286.jpeg" } },
  { id: "m9",  x: 870,  y: 260,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1440.jpeg" } },
  { id: "m10", x: 1020, y: 280,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_1534.jpeg" } },

  // NE cluster
  { id: "m11", x: 1450, y: 160,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_2445.jpeg" } },
  { id: "m12", x: 1600, y: 150,  tone: "moss",  role: "hero",    media: { type: "image", src: "/memories/IMG_2454.jpeg" } },
  { id: "m13", x: 1730, y: 200,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_2465.jpeg" } },
  { id: "m14", x: 1490, y: 280,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_2554.jpeg" } },
  { id: "m15", x: 1660, y: 290,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_3466.jpeg" } },

  // Anchor — video at center
  { id: "m16", x: 950,  y: 600,  tone: "moss",  role: "anchor",  media: { type: "video", src: "/memories/IMG_3468.mov" } },

  // SW cluster
  { id: "m17", x: 220,  y: 820,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_3764.jpeg" } },
  { id: "m18", x: 380,  y: 800,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_4603.jpeg" } },
  { id: "m19", x: 280,  y: 920,  tone: "moss",  role: "hero",    media: { type: "image", src: "/memories/IMG_4650.jpeg" } },
  { id: "m20", x: 440,  y: 940,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_4671.jpeg" } },
  { id: "m21", x: 180,  y: 1010, tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_4749.jpeg" } },

  // S cluster
  { id: "m22", x: 830,  y: 870,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_5951.jpeg" } },
  { id: "m23", x: 970,  y: 860,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_5992.JPG" } },
  { id: "m24", x: 1090, y: 910,  tone: "sky",   role: "hero",    media: { type: "image", src: "/memories/IMG_7733.jpeg" } },
  { id: "m25", x: 880,  y: 990,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_7811.jpeg" } },
  { id: "m26", x: 1030, y: 1020, tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_7922.jpeg" } },
  { id: "m27", x: 1160, y: 990,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/c78ccaf7-5e56-48a4-9cb1-b761c2e68db6.jpg" } },

  // SE cluster
  { id: "m28", x: 1480, y: 820,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_7943.jpeg" } },
  { id: "m29", x: 1620, y: 820,  tone: "sky",   role: "hero",    media: { type: "image", src: "/memories/IMG_7956.jpeg" } },
  { id: "m30", x: 1740, y: 920,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_8450.jpeg" } },
  { id: "m31", x: 1520, y: 970,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_8500.jpeg" } },
  { id: "m32", x: 1680, y: 1010, tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_8884.jpeg" } },

  // ───── New nodes ─────
  // Connectors between N clusters
  { id: "m33", x: 600,  y: 200,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_0034.jpeg" } },
  { id: "m34", x: 1250, y: 220,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_0104.jpeg" } },

  // Upper mid-band (between N clusters and anchor)
  { id: "m35", x: 460,  y: 400,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_8452.jpeg" } },
  { id: "m36", x: 1450, y: 400,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_8465.jpeg" } },
  { id: "m37", x: 950,  y: 380,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_3915.jpeg" } },
  { id: "m38", x: 1130, y: 380,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/340CA33A-DA6D-4865-ACE8-AA7B0C4938DF.jpg" } },

  // Mid-band ring around the anchor (videos as wandering moments)
  { id: "m39", x: 240,  y: 580,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_7836.jpeg" } },
  { id: "m40", x: 700,  y: 480,  tone: "sky",   role: "regular", media: { type: "video", src: "/memories/IMG_1627.mov" } },
  { id: "m41", x: 1200, y: 480,  tone: "peach", role: "regular", media: { type: "video", src: "/memories/IMG_2450.mov" } },
  { id: "m42", x: 1700, y: 590,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_7869.jpeg" } },
  { id: "m43", x: 1550, y: 530,  tone: "moss",  role: "regular", media: { type: "video", src: "/memories/IMG_1470.mov" } },

  // Lower mid-band (between anchor and S clusters)
  { id: "m44", x: 580,  y: 720,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_2464.jpeg" } },
  { id: "m45", x: 380,  y: 720,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_8540.jpeg" } },
  { id: "m46", x: 800,  y: 760,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_8436.jpeg" } },
  { id: "m47", x: 1100, y: 740,  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_6271.jpeg" } },
  { id: "m48", x: 1340, y: 720,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_3460.jpeg" } },
  { id: "m49", x: 1620, y: 720,  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_8623.jpeg" } },

  // Just below the anchor
  { id: "m50", x: 950,  y: 750,  tone: "moss",  role: "regular", media: { type: "video", src: "/memories/IMG_8498.mov" } },
  { id: "m51", x: 290,  y: 450,  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1447.jpeg" } },
];

memories.forEach((m) => {
  if (HEROES.has(m.id) && m.role !== "anchor") m.role = "hero";
});

const edges: [string, string][] = [
  ["m1","m2"], ["m1","m3"], ["m2","m5"], ["m3","m4"], ["m4","m5"], ["m1","m4"],
  ["m6","m7"], ["m7","m8"], ["m6","m9"], ["m8","m10"], ["m9","m10"], ["m7","m9"],
  ["m11","m12"], ["m12","m13"], ["m11","m14"], ["m13","m15"], ["m14","m15"], ["m12","m14"],
  ["m17","m18"], ["m17","m19"], ["m18","m20"], ["m19","m21"], ["m19","m20"], ["m17","m20"],
  ["m22","m23"], ["m23","m24"], ["m22","m25"], ["m24","m26"], ["m25","m26"], ["m23","m25"], ["m26","m27"], ["m24","m27"],
  ["m28","m29"], ["m29","m30"], ["m28","m31"], ["m30","m32"], ["m31","m32"], ["m29","m31"],
  ["m5","m6"], ["m8","m11"], ["m4","m17"], ["m10","m23"], ["m13","m28"], ["m20","m22"], ["m27","m30"],
  ["m16","m4"], ["m16","m9"], ["m16","m14"], ["m16","m20"], ["m16","m23"], ["m16","m30"],

  // ───── Edges for the new nodes ─────
  // N-band connectors
  ["m33","m5"], ["m33","m6"], ["m34","m8"], ["m34","m11"],
  // Upper mid-band into N clusters and anchor
  ["m35","m5"], ["m35","m51"], ["m51","m1"],
  ["m36","m11"], ["m36","m43"],
  ["m37","m9"], ["m37","m38"], ["m38","m10"],
  ["m37","m16"], ["m38","m16"],
  // Mid-band ring around anchor
  ["m39","m51"], ["m39","m17"],
  ["m40","m37"], ["m40","m16"], ["m41","m38"], ["m41","m16"],
  ["m42","m13"], ["m42","m43"], ["m43","m41"],
  // Lower mid-band into S clusters
  ["m44","m45"], ["m44","m46"], ["m45","m17"],
  ["m46","m22"], ["m46","m50"], ["m47","m24"], ["m47","m48"],
  ["m48","m28"], ["m49","m29"], ["m49","m42"],
  // Anchor to lower-mid
  ["m50","m16"], ["m50","m23"],
];

const MemoryUniverse = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  const target = useRef({ x: 0, y: 0, scale: 1 });
  const current = useRef({ x: 0, y: 0, scale: 1 });
  const velocity = useRef({ x: 0, y: 0 });
  const samples = useRef<{ x: number; y: number; t: number }[]>([]);

  const didDragRef = useRef(false);
  const recenterRef = useRef<() => void>(() => {});
  const focusOnRef = useRef<(x: number, y: number, scale?: number) => void>(() => {});
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rect = el.getBoundingClientRect();
    const onResize = () => { rect = el.getBoundingClientRect(); };
    window.addEventListener("resize", onResize);

    const isTouchPrimary = matchMedia("(pointer: coarse)").matches;
    const lerpFactor = isTouchPrimary ? LERP_TOUCH : LERP_DESKTOP;

    let raf = 0;
    let running = false;

    // ---- Coordinate model ----
    // The world div is positioned at left:50% top:50% with marginLeft:-W/2,
    // marginTop:-H/2, then transformed translate(c.x, c.y) scale(c.scale)
    // with transform-origin: center center.
    // So a world-space point (wx, wy) — measured from world's TOP-LEFT — lands
    // at viewport position:
    //     px = vpCenterX + c.x + (wx - W/2) * c.scale
    //     py = vpCenterY + c.y + (wy - H/2) * c.scale
    // To CENTER (wx, wy) in the viewport, set px = vpCenterX, py = vpCenterY:
    //     c.x = -(wx - W/2) * c.scale
    //     c.y = -(wy - H/2) * c.scale
    // This is the math the previous version got wrong (it ignored the W/2
    // origin shift caused by transform-origin: center).

    const focusWorldPoint = (wx: number, wy: number, scale: number) => {
      target.current.scale = scale;
      target.current.x = -(wx - WORLD_W / 2) * scale;
      target.current.y = -(wy - WORLD_H / 2) * scale;
    };

    const maxPan = (scale: number) => ({
      x: Math.max(0, (WORLD_W * scale - rect.width) / 2),
      y: Math.max(0, (WORLD_H * scale - rect.height) / 2),
    });

    const applyTransform = () => {
      if (!worldRef.current) return;
      const c = current.current;
      worldRef.current.style.transform =
        `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.scale})`;
    };

    const tick = () => {
      const c = current.current;
      const t = target.current;

      const v = velocity.current;
      if (!dragging && (Math.abs(v.x) > MIN_VELOCITY || Math.abs(v.y) > MIN_VELOCITY)) {
        t.x += v.x;
        t.y += v.y;
        v.x *= FRICTION;
        v.y *= FRICTION;
      } else if (!dragging) {
        v.x = 0;
        v.y = 0;
      }

      if (!dragging) {
        const max = maxPan(t.scale);
        if (t.x > max.x) t.x = max.x;
        if (t.x < -max.x) t.x = -max.x;
        if (t.y > max.y) t.y = max.y;
        if (t.y < -max.y) t.y = -max.y;
      }

      const dx = t.x - c.x;
      const dy = t.y - c.y;
      const ds = t.scale - c.scale;

      const stillX = Math.abs(dx) < 0.1;
      const stillY = Math.abs(dy) < 0.1;
      const stillS = Math.abs(ds) < 0.001;
      const stillV = Math.abs(v.x) < MIN_VELOCITY && Math.abs(v.y) < MIN_VELOCITY;

      if (stillX && stillY && stillS && stillV) {
        c.x = t.x; c.y = t.y; c.scale = t.scale;
        applyTransform();
        running = false;
        return;
      }

      const isReturning = !dragging && (
        Math.abs(t.x) < Math.abs(c.x) - 1 ||
        Math.abs(t.y) < Math.abs(c.y) - 1
      );
      const f = isReturning ? RUBBERBAND_RETURN : lerpFactor;

      c.x += dx * f;
      c.y += dy * f;
      c.scale += ds * f;

      applyTransform();
      raf = requestAnimationFrame(tick);
    };

    const ensureRunning = () => {
      if (running || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    let dragging = false;
    let startTargetX = 0;
    let startTargetY = 0;
    // Pointer position at drag start. Stable — does NOT roll with the velocity
    // sample window the way samples.current[0] does.
    let dragStartX = 0;
    let dragStartY = 0;

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: {
      dist: number;
      midX: number;
      midY: number;
      startScale: number;
      startTargetX: number;
      startTargetY: number;
    } | null = null;
    let lastTap = { t: 0, x: 0, y: 0 };

    const pinchDistAndMid = () => {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return null;
      const [a, b] = pts;
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    };

    const recordSample = (x: number, y: number) => {
      const t = performance.now();
      samples.current.push({ x, y, t });
      const cutoff = t - VELOCITY_WINDOW_MS;
      while (samples.current.length && samples.current[0].t < cutoff) {
        samples.current.shift();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const m = pinchDistAndMid();
        if (m) {
          pinchStart = {
            dist: m.dist,
            midX: m.midX,
            midY: m.midY,
            startScale: target.current.scale,
            startTargetX: target.current.x,
            startTargetY: target.current.y,
          };
        }
        dragging = false;
        velocity.current.x = 0;
        velocity.current.y = 0;
        return;
      }

      dragging = true;
      velocity.current.x = 0;
      velocity.current.y = 0;
      samples.current = [];
      recordSample(e.clientX, e.clientY);
      startTargetX = target.current.x;
      startTargetY = target.current.y;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinchStart && pointers.size >= 2) {
        const m = pinchDistAndMid();
        if (!m) return;

        const rawScale = pinchStart.startScale * (m.dist / pinchStart.dist);
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));

        // Pinch midpoint in viewport-relative coords (centered on viewport).
        const mvpX = pinchStart.midX - rect.left - rect.width / 2;
        const mvpY = pinchStart.midY - rect.top - rect.height / 2;

        // Find the world point under the pinch midpoint at gesture start, then
        // re-solve target so that point stays at the same viewport position
        // after scaling. Inverse of the forward map noted above.
        const wx = (mvpX - pinchStart.startTargetX) / pinchStart.startScale + WORLD_W / 2;
        const wy = (mvpY - pinchStart.startTargetY) / pinchStart.startScale + WORLD_H / 2;

        target.current.scale = newScale;
        target.current.x = mvpX - (wx - WORLD_W / 2) * newScale;
        target.current.y = mvpY - (wy - WORLD_H / 2) * newScale;

        ensureRunning();
        return;
      }

      if (!dragging) return;

      // Drag offset is measured against the STABLE pointerdown position so the
      // world doesn't drift as the velocity sample window rolls.
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      const moved = Math.hypot(dx, dy);
      if (moved <= DRAG_THRESHOLD) {
        recordSample(e.clientX, e.clientY);
        return;
      }

      const max = maxPan(target.current.scale);
      const dampAxis = (next: number, m: number) => {
        if (next > m) return m + (next - m) * OVERDRAG_RESISTANCE;
        if (next < -m) return -m + (next + m) * OVERDRAG_RESISTANCE;
        return next;
      };
      target.current.x = dampAxis(startTargetX + dx, max.x);
      target.current.y = dampAxis(startTargetY + dy, max.y);

      // Snap current to target while dragging — no lerp. Lerp during active
      // drag is what makes the world feel like it's chasing the finger.
      current.current.x = target.current.x;
      current.current.y = target.current.y;

      recordSample(e.clientX, e.clientY);
      ensureRunning();
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);

      if (pinchStart && pointers.size < 2) {
        pinchStart = null;
        velocity.current.x = 0;
        velocity.current.y = 0;
        ensureRunning();
        if (pointers.size === 1) {
          const remaining = Array.from(pointers.values())[0];
          dragging = true;
          samples.current = [];
          recordSample(remaining.x, remaining.y);
          startTargetX = target.current.x;
          startTargetY = target.current.y;
          dragStartX = remaining.x;
          dragStartY = remaining.y;
        }
        return;
      }

      if (!dragging) return;
      dragging = false;

      const samps = samples.current;
      if (samps.length >= 2) {
        const last = samps[samps.length - 1];
        const first = samps[0];
        const dt = last.t - first.t;
        const totalMoved = Math.hypot(last.x - first.x, last.y - first.y);

        if (totalMoved > DRAG_THRESHOLD) {
          didDragRef.current = true;
          setTimeout(() => { didDragRef.current = false; }, 60);

          if (dt > 0) {
            const pxPerMs = {
              x: (last.x - first.x) / dt,
              y: (last.y - first.y) / dt,
            };
            velocity.current.x = pxPerMs.x * (1000 / 60);
            velocity.current.y = pxPerMs.y * (1000 / 60);
          }
        }
      }

      // Double-tap on empty area → toggle zoom around tap point.
      if (!didDragRef.current && samps.length > 0) {
        const last = samps[samps.length - 1];
        const now = performance.now();
        const dt = now - lastTap.t;
        const dist = Math.hypot(last.x - lastTap.x, last.y - lastTap.y);
        if (dt < DOUBLE_TAP_MS && dist < DOUBLE_TAP_DIST) {
          const tapVpX = last.x - rect.left - rect.width / 2;
          const tapVpY = last.y - rect.top - rect.height / 2;
          const startScale = target.current.scale;
          const newScale = startScale < 1.4 ? 1.6 : 1.0;
          // World point under tap → keep it under tap after scale change.
          const wx = (tapVpX - target.current.x) / startScale + WORLD_W / 2;
          const wy = (tapVpY - target.current.y) / startScale + WORLD_H / 2;
          target.current.scale = newScale;
          target.current.x = tapVpX - (wx - WORLD_W / 2) * newScale;
          target.current.y = tapVpY - (wy - WORLD_H / 2) * newScale;
          lastTap = { t: 0, x: 0, y: 0 };
        } else {
          lastTap = { t: now, x: last.x, y: last.y };
        }
      }

      samples.current = [];
      ensureRunning();
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      } else {
        ensureRunning();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    recenterRef.current = () => {
      target.current.x = 0;
      target.current.y = 0;
      target.current.scale = 1;
      velocity.current.x = 0;
      velocity.current.y = 0;
      ensureRunning();
    };

    focusOnRef.current = (x: number, y: number, scale?: number) => {
      const s = scale ?? Math.max(target.current.scale, 1.3);
      focusWorldPoint(x, y, s);
      velocity.current.x = 0;
      velocity.current.y = 0;
      ensureRunning();
    };

    ensureRunning();

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf);
    };
  }, []);

  const byId = useMemo(() => Object.fromEntries(memories.map((m) => [m.id, m])), []);

  const handleContainerClick = () => {
    if (didDragRef.current) return;
    setSelected(null);
  };

  const handleNodeToggle = (id: string) => {
    if (didDragRef.current) return;
    setSelected((s) => {
      if (s === id) return null;
      const m = byId[id];
      if (m) focusOnRef.current(m.x, m.y, 1.3);
      return id;
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden touch-none select-none"
      onClick={handleContainerClick}
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, hsl(210 35% 14%) 0%, hsl(180 30% 8%) 45%, hsl(150 35% 4%) 100%)",
        cursor: "grab",
      }}
    >
      <Stars count={120} />

      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 20% 30%, hsl(195 60% 30% / 0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, hsl(150 40% 25% / 0.35) 0%, transparent 60%), radial-gradient(ellipse at 60% 20%, hsl(28 60% 35% / 0.18) 0%, transparent 50%)",
        }}
      />

      <div
        ref={worldRef}
        className="absolute left-1/2 top-1/2"
        style={{
          width: WORLD_W,
          height: WORLD_H,
          marginLeft: -WORLD_W / 2,
          marginTop: -WORLD_H / 2,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width={WORLD_W}
          height={WORLD_H}
          style={{ overflow: "visible" }}
        >
          {edges.map(([a, b], i) => {
            const A = byId[a];
            const B = byId[b];
            if (!A || !B) return null;
            const isActive = selected === a || selected === b;
            const isAnyActive = selected !== null;
            return (
              <line
                key={i}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke={
                  isActive
                    ? "hsl(195 95% 92% / 0.95)"
                    : isAnyActive
                      ? "hsl(195 50% 75% / 0.18)"
                      : "hsl(195 50% 75% / 0.30)"
                }
                strokeWidth={isActive ? 2.0 : 0.9}
                style={{ transition: "stroke 400ms ease, stroke-width 400ms ease" }}
              />
            );
          })}
        </svg>

        {memories.map((m) => (
          <MemoryNode
            key={m.id}
            m={m}
            isExpanded={selected === m.id}
            isAnyExpanded={selected !== null}
            onToggle={handleNodeToggle}
          />
        ))}
      </div>

      <Link
        to="/"
        className="pointer-events-auto absolute left-5 top-5 z-40 rounded-full px-3.5 py-1.5 text-[0.65rem] tracking-[0.3em] uppercase text-parchment/60 backdrop-blur-sm transition hover:text-parchment"
        style={{ background: "hsl(0 0% 100% / 0.04)", border: "1px solid hsl(0 0% 100% / 0.08)" }}
      >
        ← back
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          recenterRef.current();
        }}
        className="pointer-events-auto absolute right-5 top-5 z-40 rounded-full px-3.5 py-1.5 text-[0.65rem] tracking-[0.3em] uppercase text-parchment/60 backdrop-blur-sm transition hover:text-parchment"
        style={{ background: "hsl(0 0% 100% / 0.04)", border: "1px solid hsl(0 0% 100% / 0.08)" }}
      >
        ⊕ home
      </button>
    </div>
  );
};

// Renders a video that only plays when `active` is true. Avoids the perf
// cost of multiple simultaneous decoders when many video nodes are on-screen.
const VideoNode = ({
  src,
  poster,
  active,
}: {
  src: string;
  poster?: string;
  active: boolean;
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active]);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
};

// Cheap halo — single radial-gradient background on a wrapper div behind the
// thumbnail. Replaces the old triple-layered box-shadow which was the main
// cause of jank on mobile (each shadow with 50px+ blur composites separately).
const MemoryNode = memo(
  ({
    m,
    isExpanded,
    isAnyExpanded,
    onToggle,
  }: {
    m: Memory;
    isExpanded: boolean;
    isAnyExpanded: boolean;
    onToggle: (id: string) => void;
  }) => {
    const dim = isAnyExpanded && !isExpanded;
    const halo = TONE_HALO[m.tone];
    const scale = ROLE_SCALE[m.role];

    const baseSize = m.media ? 88 : 36;
    const collapsedSize = baseSize * scale.size;
    // Halo wrapper extends moderately past the photo — narrower than before so
    // the falloff feels close to the photo, not like a bright surrounding ring.
    const haloSize = collapsedSize + 70 * scale.haloRadius;
    // R = the photo's edge as a fraction of the halo's radius. Stops inside
    // R% are hidden behind the photo; the visible glow lives between R and 100.
    const R = (collapsedSize / 2 / haloSize) * 100;
    // Pre-compute the five stop positions so the falloff curve is smooth.
    const reach = 100 - R;
    const p1 = R;
    const p2 = R + reach * 0.18;
    const p3 = R + reach * 0.40;
    const p4 = R + reach * 0.68;
    const p5 = 100;

    const expanded = isExpanded;

    return (
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: m.x,
          top: m.y,
          zIndex: expanded ? 40 : m.role === "anchor" ? 20 : m.role === "hero" ? 15 : 10,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!expanded) onToggle(m.id);
        }}
      >
        <div className="relative" style={{ width: 96, height: 96 }}>
          {/* Halo wrapper — single GPU-friendly radial gradient with five
              alpha stops, easing from a low-alpha edge to fully transparent.
              No solid plateau, no visible outer cut-off. */}
          {!expanded && (
            <div
              className="absolute left-1/2 top-1/2 pointer-events-none rounded-full"
              style={{
                width: haloSize,
                height: haloSize,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle,
                  ${halo.s1} ${p1}%,
                  ${halo.s2} ${p2}%,
                  ${halo.s3} ${p3}%,
                  ${halo.s4} ${p4}%,
                  ${halo.s5} ${p5}%)`,
                opacity: dim ? 0.25 : scale.opacity,
                transition: "opacity 400ms ease",
              }}
            />
          )}

          {/* Photo thumbnail — collapsed = circle, expanded = rounded square */}
          <div
            className="absolute left-1/2 top-1/2 overflow-hidden"
            style={{
              width: expanded ? "clamp(240px, 72vw, 320px)" : collapsedSize,
              height: expanded ? "clamp(240px, 72vw, 320px)" : collapsedSize,
              transform: "translate(-50%, -50%)",
              borderRadius: expanded ? 22 : 9999,
              background: m.media ? "transparent" : halo.s1,
              // No ring on collapsed nodes — the soft halo gradient is the
              // only visual edge, so the photo blends smoothly into its glow.
              boxShadow: expanded
                ? `0 18px 36px -10px hsl(0 0% 0% / 0.6)`
                : "none",
              transition:
                "width 500ms cubic-bezier(0.6,0,0.2,1), height 500ms cubic-bezier(0.6,0,0.2,1), border-radius 500ms cubic-bezier(0.6,0,0.2,1), opacity 400ms ease",
              opacity: dim ? 0.35 : scale.opacity,
            }}
          >
            {m.media?.type === "image" && (
              <img
                src={m.media.src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            )}
            {m.media?.type === "video" && (
              <VideoNode
                src={m.media.src}
                poster={m.media.poster}
                // Only the anchor video plays continuously. Others stay paused
                // (decoding metadata only) until the user taps to expand them.
                active={m.role === "anchor" || expanded}
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);

MemoryNode.displayName = "MemoryNode";

// Stars are drawn dense for visual depth, but only ~25% twinkle. The rest are
// static dots — basically free to render. This keeps the night-sky feel
// without 100+ simultaneous keyframe animations chewing CPU.
const Stars = ({ count }: { count: number }) => {
  const stars = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 1.6 + 0.4,
        delay: Math.random() * 4,
        animated: i % 4 === 0, // every 4th star twinkles
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: "hsl(0 0% 100%)",
            opacity: 0.55,
            animation: s.animated
              ? `star-flicker 3.6s ease-in-out ${s.delay}s infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  );
};

export default MemoryUniverse;
