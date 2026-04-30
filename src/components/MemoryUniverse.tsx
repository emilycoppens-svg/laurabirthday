import { useEffect, useMemo, useRef, useState } from "react";
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
  title: string;
  caption: string;
  tone: Tone;
  role: Role;
  media?: Media;
};

const WORLD_W = 1900;
const WORLD_H = 1200;
const DRAG_THRESHOLD = 10;

// Zoom constraints — pinch on mobile, also used by double-tap focus.
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_DIST = 30;

// Inertia tuning — "floaty & languid" (Apple Maps feel).
const FRICTION = 0.95;        // higher = floatier (Twitter ~0.88, Maps ~0.95)
const MIN_VELOCITY = 0.05;    // px/frame — below this, motion stops
const VELOCITY_WINDOW_MS = 100;

// Direct-drag follow-tightness (lerp factor toward target).
// Mobile feels muddy at 0.12, so we run snappier for touch.
const LERP_DESKTOP = 0.12;
const LERP_TOUCH = 0.20;

// Rubber-band resistance when dragging past world edges.
// 0 = hard wall, 1 = no resistance. ~0.55 feels native.
const OVERDRAG_RESISTANCE = 0.55;
const RUBBERBAND_RETURN = 0.18; // lerp speed when snapping back from over-drag

const TONE_HALO: Record<Tone, { inner: string; glow: string; far: string }> = {
  sky: {
    inner: "hsl(48 100% 88%)",
    glow:  "hsl(50 95% 75% / 0.55)",
    far:   "hsl(195 80% 70% / 0.30)",
  },
  moss: {
    inner: "hsl(50 100% 88%)",
    glow:  "hsl(50 90% 72% / 0.50)",
    far:   "hsl(150 60% 55% / 0.30)",
  },
  peach: {
    inner: "hsl(48 100% 90%)",
    glow:  "hsl(38 95% 72% / 0.55)",
    far:   "hsl(28 85% 60% / 0.32)",
  },
};

const ROLE_HALO_SCALE: Record<Role, { ring: number; glow: number; far: number; size: number; opacity: number }> = {
  anchor:  { ring: 1.4, glow: 1.6, far: 1.6, size: 1.15, opacity: 1.0 },
  hero:    { ring: 1.15, glow: 1.2, far: 1.2, size: 1.0, opacity: 1.0 },
  regular: { ring: 1.0, glow: 0.8, far: 0.7, size: 0.85, opacity: 0.85 },
};

const HEROES = new Set(["m5", "m7", "m12", "m19", "m24", "m29"]);

const memories: Memory[] = [
  // NW cluster
  { id: "m1",  x: 230,  y: 170,  title: "First snow",      caption: "the morning everything went quiet", tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_0121.jpeg" } },
  { id: "m2",  x: 360,  y: 150,  title: "Sunday tea",      caption: "the kettle and the long talk",      tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_0137.jpeg" } },
  { id: "m3",  x: 200,  y: 270,  title: "Window light",    caption: "afternoon, no plans",                tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_0327.jpeg" } },
  { id: "m4",  x: 340,  y: 280,  title: "Late calls",      caption: "midnight, laughing",                 tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1092.jpeg" } },
  { id: "m5",  x: 470,  y: 200,  title: "Lavender",        caption: "the field at dusk",                  tone: "moss",  role: "hero",    media: { type: "image", src: "/memories/IMG_1214.jpeg" } },

  // N cluster
  { id: "m6",  x: 800,  y: 150,  title: "Train rides",     caption: "windows, hours, snacks",             tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1250.jpeg" } },
  { id: "m7",  x: 940,  y: 130,  title: "Candles",         caption: "every year, every wish",             tone: "peach", role: "hero",    media: { type: "image", src: "/memories/IMG_1261.jpeg" } },
  { id: "m8",  x: 1060, y: 180,  title: "Tide pools",      caption: "barefoot, salt-bright",              tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1286.jpeg" } },
  { id: "m9",  x: 870,  y: 260,  title: "December",        caption: "the cold and the tinsel",            tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_1440.jpeg" } },
  { id: "m10", x: 1020, y: 280,  title: "Stars",           caption: "looking up, naming none",            tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_1534.jpeg" } },

  // NE cluster
  { id: "m11", x: 1450, y: 160,  title: "Saturday market", caption: "flowers, cheese, sun",               tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_2445.jpeg" } },
  { id: "m12", x: 1600, y: 150,  title: "Lake afternoon",  caption: "green water, slow boat",             tone: "moss",  role: "hero",    media: { type: "image", src: "/memories/IMG_2454.jpeg" } },
  { id: "m13", x: 1730, y: 200,  title: "Orange jacket",   caption: "you, every winter",                  tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_2465.jpeg" } },
  { id: "m14", x: 1490, y: 280,  title: "Vienna",          caption: "coffee, cobblestones, snow",         tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_2554.jpeg" } },
  { id: "m15", x: 1660, y: 290,  title: "Birthday",        caption: "today.",                             tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_3466.jpeg" } },

  // Anchor — video at center
  { id: "m16", x: 950,  y: 600,  title: "Mossgate",        caption: "where it all begins",                tone: "moss",  role: "anchor",  media: { type: "video", src: "/memories/IMG_3468.mov" } },

  // SW cluster
  { id: "m17", x: 220,  y: 820,  title: "Kitchen radio",   caption: "old songs, hot stove",               tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_3764.jpeg" } },
  { id: "m18", x: 380,  y: 800,  title: "First trip",      caption: "the airport, your laugh",            tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_4603.jpeg" } },
  { id: "m19", x: 280,  y: 920,  title: "Long walks",      caption: "no destination",                     tone: "moss",  role: "hero",    media: { type: "image", src: "/memories/IMG_4650.jpeg" } },
  { id: "m20", x: 440,  y: 940,  title: "Late library",    caption: "stacks, soft yellow",                tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_4671.jpeg" } },
  { id: "m21", x: 180,  y: 1010, title: "The river",       caption: "stones and silence",                 tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_4749.jpeg" } },

  // S cluster
  { id: "m22", x: 830,  y: 870,  title: "Old road",        caption: "the long way home",                  tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_5951.jpeg" } },
  { id: "m23", x: 970,  y: 860,  title: "Yellow umbrella", caption: "sudden rain, no hurry",              tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_5992.JPG" } },
  { id: "m24", x: 1090, y: 910,  title: "Ferry day",       caption: "wind in everyone's hair",            tone: "sky",   role: "hero",    media: { type: "image", src: "/memories/IMG_7733.jpeg" } },
  { id: "m25", x: 880,  y: 990,  title: "Paper notes",     caption: "drawn on napkins",                   tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_7811.jpeg" } },
  { id: "m26", x: 1030, y: 1020, title: "Bonfire",         caption: "the sparks like words",              tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_7922.jpeg" } },
  { id: "m27", x: 1160, y: 990,  title: "The garden",      caption: "the one with the bench",             tone: "moss",  role: "regular", media: { type: "image", src: "/memories/c78ccaf7-5e56-48a4-9cb1-b761c2e68db6.jpg" } },

  // SE cluster
  { id: "m28", x: 1480, y: 820,  title: "Sunday paint",    caption: "tiny canvases, tiny disasters",      tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_7943.jpeg" } },
  { id: "m29", x: 1620, y: 820,  title: "Slow morning",    caption: "coffee, two pages",                  tone: "sky",   role: "hero",    media: { type: "image", src: "/memories/IMG_7956.jpeg" } },
  { id: "m30", x: 1740, y: 920,  title: "The dog years",   caption: "muddy, perfect",                     tone: "moss",  role: "regular", media: { type: "image", src: "/memories/IMG_8450.jpeg" } },
  { id: "m31", x: 1520, y: 970,  title: "Last summer",     caption: "the longest light",                  tone: "sky",   role: "regular", media: { type: "image", src: "/memories/IMG_8500.jpeg" } },
  { id: "m32", x: 1680, y: 1010, title: "Tonight",         caption: "this one, right now",                tone: "peach", role: "regular", media: { type: "image", src: "/memories/IMG_8884.jpeg" } },
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
];

const MemoryUniverse = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // Transform state — single source of truth, mutated outside React.
  // current/target separation lets us lerp toward target each frame.
  const target = useRef({ x: 0, y: 0, scale: 1 });
  const current = useRef({ x: 0, y: 0, scale: 1 });

  // Velocity for inertia (px/frame in world space).
  const velocity = useRef({ x: 0, y: 0 });

  // Sampling buffer for release-velocity calculation.
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

    // Detect coarse pointer (touch) for tuning.
    const isTouchPrimary = matchMedia("(pointer: coarse)").matches;
    const lerpFactor = isTouchPrimary ? LERP_TOUCH : LERP_DESKTOP;

    let raf = 0;
    let running = false;

    // Compute the max pan offset in screen-space, given current scale.
    // World is centered, so when world is bigger than viewport we can pan
    // up to (worldDim*scale - viewport)/2 in either direction.
    const maxPan = (scale: number) => ({
      x: Math.max(0, (WORLD_W * scale - rect.width) / 2),
      y: Math.max(0, (WORLD_H * scale - rect.height) / 2),
    });

    // Apply transform to the DOM. Single write per frame.
    const applyTransform = () => {
      if (!worldRef.current) return;
      const c = current.current;
      worldRef.current.style.transform =
        `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.scale})`;
    };

    const tick = () => {
      const c = current.current;
      const t = target.current;

      // 1) Inertia phase — when not actively dragging, integrate velocity into target.
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

      // 2) Rubber-band the target back inside bounds when not dragging.
      // While dragging we let it overshoot with resistance (handled in pointermove).
      if (!dragging) {
        const max = maxPan(t.scale);
        if (t.x > max.x) t.x = max.x;
        if (t.x < -max.x) t.x = -max.x;
        if (t.y > max.y) t.y = max.y;
        if (t.y < -max.y) t.y = -max.y;
      }

      // 3) Lerp current toward target.
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

      // Use a slightly stiffer lerp for the rubber-band return so it doesn't drift.
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

    // ---- Pointer / gesture handling ----

    let dragging = false;
    let startTargetX = 0;
    let startTargetY = 0;

    // Active pointers tracked for pinch.
    const pointers = new Map<number, { x: number; y: number }>();

    // For pinch gesture state.
    let pinchStart: {
      dist: number;
      midX: number;
      midY: number;
      startScale: number;
      startTargetX: number;
      startTargetY: number;
    } | null = null;

    // For double-tap detection.
    let lastTap = { t: 0, x: 0, y: 0 };

    const pinchDistAndMid = () => {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return null;
      const [a, b] = pts;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return {
        dist: Math.hypot(dx, dy),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    };

    const recordSample = (x: number, y: number) => {
      const t = performance.now();
      samples.current.push({ x, y, t });
      // Drop old samples outside the velocity window.
      const cutoff = t - VELOCITY_WINDOW_MS;
      while (samples.current.length && samples.current[0].t < cutoff) {
        samples.current.shift();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Two pointers → start pinch.
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
        // Cancel any single-finger drag-in-progress data.
        dragging = false;
        velocity.current.x = 0;
        velocity.current.y = 0;
        return;
      }

      // Single pointer → start drag.
      dragging = true;
      velocity.current.x = 0;
      velocity.current.y = 0;
      samples.current = [];
      recordSample(e.clientX, e.clientY);
      startTargetX = target.current.x;
      startTargetY = target.current.y;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // ---- Pinch update ----
      if (pinchStart && pointers.size >= 2) {
        const m = pinchDistAndMid();
        if (!m) return;

        // New scale clamped.
        const rawScale = pinchStart.startScale * (m.dist / pinchStart.dist);
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));

        // Keep the midpoint fixed in world space:
        // midpoint in viewport-relative coords:
        const mvpX = pinchStart.midX - rect.left - rect.width / 2;
        const mvpY = pinchStart.midY - rect.top - rect.height / 2;
        // World coord under midpoint at gesture start:
        // worldPt = (midViewport - startTarget) / startScale
        const worldPtX = (mvpX - pinchStart.startTargetX) / pinchStart.startScale;
        const worldPtY = (mvpY - pinchStart.startTargetY) / pinchStart.startScale;
        // Solve for new target so worldPt stays at the same viewport position:
        target.current.scale = newScale;
        target.current.x = mvpX - worldPtX * newScale;
        target.current.y = mvpY - worldPtY * newScale;

        ensureRunning();
        return;
      }

      // ---- Single-finger drag ----
      if (!dragging) return;
      if (samples.current.length === 0) return;

      const first = samples.current[0];
      const dx = e.clientX - first.x;
      const dy = e.clientY - first.y;

      // Resolve drag-vs-tap via cumulative distance.
      const moved = Math.hypot(dx, dy);
      if (moved <= DRAG_THRESHOLD) {
        recordSample(e.clientX, e.clientY);
        return;
      }

      // Apply rubber-band over-drag: when target leaves bounds, scale
      // additional movement by OVERDRAG_RESISTANCE.
      const max = maxPan(target.current.scale);
      let nextX = startTargetX + dx;
      let nextY = startTargetY + dy;

      // Compute over-drag amount and damp it.
      const dampAxis = (next: number, max: number) => {
        if (next > max) return max + (next - max) * OVERDRAG_RESISTANCE;
        if (next < -max) return -max + (next + max) * OVERDRAG_RESISTANCE;
        return next;
      };
      target.current.x = dampAxis(nextX, max.x);
      target.current.y = dampAxis(nextY, max.y);

      recordSample(e.clientX, e.clientY);
      ensureRunning();
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);

      // End pinch when fewer than 2 pointers.
      if (pinchStart && pointers.size < 2) {
        pinchStart = null;
        // No inertia from pinch — feels weird if scale "coasts".
        velocity.current.x = 0;
        velocity.current.y = 0;
        ensureRunning();
        // If a finger remains, transition to a single-finger drag from here.
        if (pointers.size === 1) {
          const remaining = Array.from(pointers.values())[0];
          dragging = true;
          samples.current = [];
          recordSample(remaining.x, remaining.y);
          startTargetX = target.current.x;
          startTargetY = target.current.y;
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

        // If we crossed the drag threshold at any point, treat as a drag
        // (consume the upcoming click) and compute fling velocity.
        if (totalMoved > DRAG_THRESHOLD) {
          didDragRef.current = true;
          setTimeout(() => { didDragRef.current = false; }, 60);

          if (dt > 0) {
            // px per frame at 60Hz = (px/ms) * (1000/60)
            const pxPerMs = {
              x: (last.x - first.x) / dt,
              y: (last.y - first.y) / dt,
            };
            velocity.current.x = pxPerMs.x * (1000 / 60);
            velocity.current.y = pxPerMs.y * (1000 / 60);
          }
        }
      }

      // Double-tap detection — fires when no drag happened.
      if (!didDragRef.current && samps.length > 0) {
        const last = samps[samps.length - 1];
        const now = performance.now();
        const dt = now - lastTap.t;
        const dist = Math.hypot(last.x - lastTap.x, last.y - lastTap.y);
        if (dt < DOUBLE_TAP_MS && dist < DOUBLE_TAP_DIST) {
          // Double-tap zooms in around the tap point.
          const tapVpX = last.x - rect.left - rect.width / 2;
          const tapVpY = last.y - rect.top - rect.height / 2;
          const startScale = target.current.scale;
          const newScale = startScale < 1.4 ? 1.6 : 1.0; // toggle zoom in / out
          // World coord under tap:
          const worldX = (tapVpX - target.current.x) / startScale;
          const worldY = (tapVpY - target.current.y) / startScale;
          target.current.scale = newScale;
          target.current.x = tapVpX - worldX * newScale;
          target.current.y = tapVpY - worldY * newScale;
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

    // Pan so a world-space point lands at the viewport center, optionally
    // zooming in to the given scale.
    focusOnRef.current = (x: number, y: number, scale?: number) => {
      const s = scale ?? Math.max(target.current.scale, 1.3);
      target.current.scale = s;
      target.current.x = -x * s;
      target.current.y = -y * s;
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
      // On selection, gently focus & zoom toward it (1.3x).
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
      <Stars count={140} />

      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 20% 30%, hsl(195 60% 30% / 0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, hsl(150 40% 25% / 0.35) 0%, transparent 60%), radial-gradient(ellipse at 60% 20%, hsl(28 60% 35% / 0.18) 0%, transparent 50%)",
        }}
      />

      {/* World — translated + scaled by gesture loop */}
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
          <defs>
            <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
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
                filter={isActive ? "url(#line-glow)" : undefined}
                style={{ transition: "stroke 400ms ease, stroke-width 400ms ease, opacity 400ms ease" }}
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
            onToggle={() => handleNodeToggle(m.id)}
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

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 px-4 text-center whitespace-nowrap">
        <div className="font-display text-xs sm:text-sm text-parchment/50 tracking-tight">
          drag to wander · pinch to zoom · tap a memory
        </div>
        <div className="hidden sm:block mt-1 text-[0.55rem] tracking-[0.3em] uppercase text-parchment/30">
          press esc to close · double-tap to zoom
        </div>
      </div>
    </div>
  );
};

const MemoryNode = ({
  m,
  isExpanded,
  isAnyExpanded,
  onToggle,
}: {
  m: Memory;
  isExpanded: boolean;
  isAnyExpanded: boolean;
  onToggle: () => void;
}) => {
  const dim = isAnyExpanded && !isExpanded;
  const halo = TONE_HALO[m.tone];
  const scale = ROLE_HALO_SCALE[m.role];

  const baseSize = m.media ? 88 : 36;
  const collapsedSize = baseSize * scale.size;

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: m.x,
        top: m.y,
        zIndex: isExpanded ? 40 : m.role === "anchor" ? 20 : m.role === "hero" ? 15 : 10,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isExpanded) onToggle();
      }}
    >
      {/* Touch-target wrapper — generous so thumbs hit reliably even when the
          visible halo is small (hero/regular). 96×96 is well above Apple's 44pt min. */}
      <div className="relative" style={{ width: 96, height: 96 }}>
        <div
          className="absolute left-1/2 top-1/2 overflow-hidden"
          style={{
            width: isExpanded ? "clamp(240px, 72vw, 320px)" : collapsedSize,
            height: isExpanded ? "clamp(240px, 72vw, 320px)" : collapsedSize,
            transform: "translate(-50%, -50%)",
            borderRadius: isExpanded ? 22 : 9999,
            background: m.media ? "transparent" : `${halo.glow}`,
            boxShadow: isExpanded
              ? `0 0 80px 10px ${halo.glow}, 0 0 180px 40px ${halo.far}, 0 25px 50px -12px hsl(0 0% 0% / 0.7)`
              : [
                  `0 0 0 ${1.5 * scale.ring}px ${halo.inner}`,
                  `0 0 ${20 * scale.glow}px ${5 * scale.glow}px ${halo.glow}`,
                  `0 0 ${50 * scale.far}px ${18 * scale.far}px ${halo.far}`,
                ].join(", "),
            transition:
              "width 600ms cubic-bezier(0.6,0,0.2,1), height 600ms cubic-bezier(0.6,0,0.2,1), border-radius 600ms cubic-bezier(0.6,0,0.2,1), box-shadow 600ms ease, opacity 400ms ease",
            cursor: isExpanded ? "default" : "pointer",
            opacity: dim ? 0.30 : scale.opacity,
          }}
        >
          {!isExpanded && !m.media && (
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${halo.glow} 0%, transparent 70%)`,
                animation: "memory-pulse 3.4s ease-in-out infinite",
              }}
            />
          )}

          {m.media?.type === "image" && (
            <img
              src={m.media.src}
              alt={m.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          )}
          {m.media?.type === "video" && (
            <video
              src={m.media.src}
              poster={m.media.poster}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {isExpanded && (
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end px-5 pb-5 text-center"
              style={{
                animation: "text-reveal 600ms cubic-bezier(0.6,0,0.2,1) 200ms both",
                background: m.media
                  ? "linear-gradient(to top, hsl(0 0% 0% / 0.78) 0%, hsl(0 0% 0% / 0.4) 35%, transparent 60%)"
                  : "transparent",
                justifyContent: m.media ? "flex-end" : "center",
              }}
            >
              <div
                className="font-display text-base sm:text-lg leading-tight tracking-tight"
                style={{ color: "hsl(0 0% 100% / 0.98)", fontWeight: 600 }}
              >
                {m.title}
              </div>
              <div
                className="mt-1 text-[0.7rem] leading-snug max-w-[220px]"
                style={{ color: "hsl(0 0% 100% / 0.85)" }}
              >
                {m.caption}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Stars = ({ count }: { count: number }) => {
  const stars = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 1.6 + 0.4,
        delay: Math.random() * 4,
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
            animation: `star-flicker 3.6s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
};

export default MemoryUniverse;
