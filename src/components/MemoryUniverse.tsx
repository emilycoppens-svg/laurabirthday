import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Tone = "sky" | "moss" | "peach";

type Media =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster?: string };

type Memory = {
  id: string;
  x: number; // world-space px
  y: number;
  title: string;
  caption: string;
  tone: Tone;
  media?: Media;
};

const WORLD_W = 1900;
const WORLD_H = 1200;
const DRAG_THRESHOLD = 10;

// Soft yellow halo — every memory node glows like a star, regardless of tone.
const STAR_RING_INNER = "hsl(48 100% 88%)";
const STAR_RING_GLOW = "hsl(48 95% 72% / 0.55)";
const STAR_RING_FAR = "hsl(48 95% 65% / 0.35)";

// 32 memories in 6 clusters + 1 video anchor at center.
// Edit titles/captions/photos freely. Tone is now visual-only (kept for future
// theming) — shadows are uniformly star-yellow regardless of tone.
const memories: Memory[] = [
  // NW cluster
  { id: "m1",  x: 230,  y: 170,  title: "First snow",      caption: "the morning everything went quiet", tone: "sky",
    media: { type: "image", src: "/memories/IMG_0121.jpeg" } },
  { id: "m2",  x: 360,  y: 150,  title: "Sunday tea",      caption: "the kettle and the long talk",      tone: "peach",
    media: { type: "image", src: "/memories/IMG_0137.jpeg" } },
  { id: "m3",  x: 200,  y: 270,  title: "Window light",    caption: "afternoon, no plans",                tone: "peach",
    media: { type: "image", src: "/memories/IMG_0327.jpeg" } },
  { id: "m4",  x: 340,  y: 280,  title: "Late calls",      caption: "midnight, laughing",                 tone: "sky",
    media: { type: "image", src: "/memories/IMG_1092.jpeg" } },
  { id: "m5",  x: 470,  y: 200,  title: "Lavender",        caption: "the field at dusk",                  tone: "moss",
    media: { type: "image", src: "/memories/IMG_1214.jpeg" } },

  // N cluster
  { id: "m6",  x: 800,  y: 150,  title: "Train rides",     caption: "windows, hours, snacks",             tone: "sky",
    media: { type: "image", src: "/memories/IMG_1250.jpeg" } },
  { id: "m7",  x: 940,  y: 130,  title: "Candles",         caption: "every year, every wish",             tone: "peach",
    media: { type: "image", src: "/memories/IMG_1261.jpeg" } },
  { id: "m8",  x: 1060, y: 180,  title: "Tide pools",      caption: "barefoot, salt-bright",              tone: "sky",
    media: { type: "image", src: "/memories/IMG_1286.jpeg" } },
  { id: "m9",  x: 870,  y: 260,  title: "December",        caption: "the cold and the tinsel",            tone: "sky",
    media: { type: "image", src: "/memories/IMG_1440.jpeg" } },
  { id: "m10", x: 1020, y: 280,  title: "Stars",           caption: "looking up, naming none",            tone: "moss",
    media: { type: "image", src: "/memories/IMG_1534.jpeg" } },

  // NE cluster
  { id: "m11", x: 1450, y: 160,  title: "Saturday market", caption: "flowers, cheese, sun",               tone: "peach",
    media: { type: "image", src: "/memories/IMG_2445.jpeg" } },
  { id: "m12", x: 1600, y: 150,  title: "Lake afternoon",  caption: "green water, slow boat",             tone: "moss",
    media: { type: "image", src: "/memories/IMG_2454.jpeg" } },
  { id: "m13", x: 1730, y: 200,  title: "Orange jacket",   caption: "you, every winter",                  tone: "peach",
    media: { type: "image", src: "/memories/IMG_2465.jpeg" } },
  { id: "m14", x: 1490, y: 280,  title: "Vienna",          caption: "coffee, cobblestones, snow",         tone: "sky",
    media: { type: "image", src: "/memories/IMG_2554.jpeg" } },
  { id: "m15", x: 1660, y: 290,  title: "Birthday",        caption: "today.",                             tone: "peach",
    media: { type: "image", src: "/memories/IMG_3466.jpeg" } },

  // Anchor — video at center
  { id: "m16", x: 950,  y: 600,  title: "Mossgate",        caption: "where it all begins",                tone: "moss",
    media: { type: "video", src: "/memories/IMG_3468.mov" } },

  // SW cluster
  { id: "m17", x: 220,  y: 820,  title: "Kitchen radio",   caption: "old songs, hot stove",               tone: "peach",
    media: { type: "image", src: "/memories/IMG_3764.jpeg" } },
  { id: "m18", x: 380,  y: 800,  title: "First trip",      caption: "the airport, your laugh",            tone: "sky",
    media: { type: "image", src: "/memories/IMG_4603.jpeg" } },
  { id: "m19", x: 280,  y: 920,  title: "Long walks",      caption: "no destination",                     tone: "moss",
    media: { type: "image", src: "/memories/IMG_4650.jpeg" } },
  { id: "m20", x: 440,  y: 940,  title: "Late library",    caption: "stacks, soft yellow",                tone: "peach",
    media: { type: "image", src: "/memories/IMG_4671.jpeg" } },
  { id: "m21", x: 180,  y: 1010, title: "The river",       caption: "stones and silence",                 tone: "sky",
    media: { type: "image", src: "/memories/IMG_4749.jpeg" } },

  // S cluster
  { id: "m22", x: 830,  y: 870,  title: "Old road",        caption: "the long way home",                  tone: "moss",
    media: { type: "image", src: "/memories/IMG_5951.jpeg" } },
  { id: "m23", x: 970,  y: 860,  title: "Yellow umbrella", caption: "sudden rain, no hurry",              tone: "peach",
    media: { type: "image", src: "/memories/IMG_5992.JPG" } },
  { id: "m24", x: 1090, y: 910,  title: "Ferry day",       caption: "wind in everyone's hair",            tone: "sky",
    media: { type: "image", src: "/memories/IMG_7733.jpeg" } },
  { id: "m25", x: 880,  y: 990,  title: "Paper notes",     caption: "drawn on napkins",                   tone: "peach",
    media: { type: "image", src: "/memories/IMG_7811.jpeg" } },
  { id: "m26", x: 1030, y: 1020, title: "Bonfire",         caption: "the sparks like words",              tone: "moss",
    media: { type: "image", src: "/memories/IMG_7922.jpeg" } },
  { id: "m27", x: 1160, y: 990,  title: "The garden",      caption: "the one with the bench",             tone: "moss",
    media: { type: "image", src: "/memories/c78ccaf7-5e56-48a4-9cb1-b761c2e68db6.jpg" } },

  // SE cluster
  { id: "m28", x: 1480, y: 820,  title: "Sunday paint",    caption: "tiny canvases, tiny disasters",      tone: "peach",
    media: { type: "image", src: "/memories/IMG_7943.jpeg" } },
  { id: "m29", x: 1620, y: 820,  title: "Slow morning",    caption: "coffee, two pages",                  tone: "sky",
    media: { type: "image", src: "/memories/IMG_7956.jpeg" } },
  { id: "m30", x: 1740, y: 920,  title: "The dog years",   caption: "muddy, perfect",                     tone: "moss",
    media: { type: "image", src: "/memories/IMG_8450.jpeg" } },
  { id: "m31", x: 1520, y: 970,  title: "Last summer",     caption: "the longest light",                  tone: "sky",
    media: { type: "image", src: "/memories/IMG_8500.jpeg" } },
  { id: "m32", x: 1680, y: 1010, title: "Tonight",         caption: "this one, right now",                tone: "peach",
    media: { type: "image", src: "/memories/IMG_8884.jpeg" } },
];

const edges: [string, string][] = [
  // NW intra
  ["m1","m2"], ["m1","m3"], ["m2","m5"], ["m3","m4"], ["m4","m5"], ["m1","m4"],
  // N intra
  ["m6","m7"], ["m7","m8"], ["m6","m9"], ["m8","m10"], ["m9","m10"], ["m7","m9"],
  // NE intra
  ["m11","m12"], ["m12","m13"], ["m11","m14"], ["m13","m15"], ["m14","m15"], ["m12","m14"],
  // SW intra
  ["m17","m18"], ["m17","m19"], ["m18","m20"], ["m19","m21"], ["m19","m20"], ["m17","m20"],
  // S intra
  ["m22","m23"], ["m23","m24"], ["m22","m25"], ["m24","m26"], ["m25","m26"], ["m23","m25"], ["m26","m27"], ["m24","m27"],
  // SE intra
  ["m28","m29"], ["m29","m30"], ["m28","m31"], ["m30","m32"], ["m31","m32"], ["m29","m31"],
  // Cross-cluster bridges
  ["m5","m6"], ["m8","m11"], ["m4","m17"], ["m10","m23"], ["m13","m28"], ["m20","m22"], ["m27","m30"],
  // Anchor (video) hubs out to every cluster
  ["m16","m4"], ["m16","m9"], ["m16","m14"], ["m16","m20"], ["m16","m23"], ["m16","m30"],
];

const MemoryUniverse = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const recenterRef = useRef<() => void>(() => {});
  const focusOnRef = useRef<(x: number, y: number) => void>(() => {});
  const [selected, setSelected] = useState<string | null>(null);

  // Unified drag-to-pan (mouse + touch via Pointer Events).
  // Tap vs. drag is decided by movement threshold; drags suppress the click that follows.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rect = el.getBoundingClientRect();
    const onResize = () => { rect = el.getBoundingClientRect(); };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let running = false;

    const tick = () => {
      const c = current.current;
      const t = target.current;
      const dx = t.x - c.x;
      const dy = t.y - c.y;
      if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
        c.x = t.x;
        c.y = t.y;
        if (worldRef.current) {
          worldRef.current.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
        }
        running = false;
        return;
      }
      c.x += dx * 0.12;
      c.y += dy * 0.12;
      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    const ensureRunning = () => {
      if (running || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

    // Drag state
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startTargetX = 0;
    let startTargetY = 0;
    let moved = 0;

    const onPointerDown = (e: PointerEvent) => {
      // Only primary mouse button; touch/pen always pass.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startY = e.clientY;
      startTargetX = target.current.x;
      startTargetY = target.current.y;
      // NOTE: do NOT setPointerCapture — that redirects the click event to the
      // container and breaks node onClick handlers. We rely on window-level
      // move/up listeners below to track drags that leave the container.
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > DRAG_THRESHOLD) {
        const maxX = Math.max(0, (WORLD_W - rect.width) / 2);
        const maxY = Math.max(0, (WORLD_H - rect.height) / 2);
        target.current.x = clamp(startTargetX + dx, maxX);
        target.current.y = clamp(startTargetY + dy, maxY);
        ensureRunning();
      }
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      if (moved > DRAG_THRESHOLD) {
        // Was a real drag — swallow the click that follows pointerup
        didDragRef.current = true;
        setTimeout(() => { didDragRef.current = false; }, 60);
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    // Listen on window so dragging keeps tracking even if the cursor leaves
    // the container (and so up always fires).
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    // ESC closes expanded card
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

    // Expose recenter for the home button
    recenterRef.current = () => {
      target.current.x = 0;
      target.current.y = 0;
      ensureRunning();
    };

    // Smoothly pan so the given world-space point ends up at viewport center.
    focusOnRef.current = (x: number, y: number) => {
      const maxX = Math.max(0, (WORLD_W - rect.width) / 2);
      const maxY = Math.max(0, (WORLD_H - rect.height) / 2);
      target.current.x = clamp(WORLD_W / 2 - x, maxX);
      target.current.y = clamp(WORLD_H / 2 - y, maxY);
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
    if (didDragRef.current) return; // just released a drag — don't close
    setSelected(null);
  };

  const handleNodeToggle = (id: string) => {
    if (didDragRef.current) return;
    setSelected((s) => {
      if (s === id) return null; // tapping the open node closes it
      const m = byId[id];
      if (m) focusOnRef.current(m.x, m.y); // pan to center the node
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

      {/* World — translated by drag */}
      <div
        ref={worldRef}
        className="absolute left-1/2 top-1/2"
        style={{
          width: WORLD_W,
          height: WORLD_H,
          marginLeft: -WORLD_W / 2,
          marginTop: -WORLD_H / 2,
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
            return (
              <line
                key={i}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke={isActive ? "hsl(195 95% 92% / 0.95)" : "hsl(195 70% 82% / 0.55)"}
                strokeWidth={isActive ? 2.2 : 1.4}
                filter="url(#line-glow)"
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
            onToggle={() => handleNodeToggle(m.id)}
          />
        ))}
      </div>

      {/* Foreground UI */}
      <Link
        to="/"
        className="pointer-events-auto absolute left-5 top-5 z-40 rounded-full px-4 py-2 text-[0.7rem] tracking-[0.3em] uppercase text-parchment/70 backdrop-blur-sm transition hover:text-parchment"
        style={{ background: "hsl(0 0% 100% / 0.06)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
      >
        ← back
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          recenterRef.current();
        }}
        className="pointer-events-auto absolute right-5 top-5 z-40 rounded-full px-4 py-2 text-[0.7rem] tracking-[0.3em] uppercase text-parchment/70 backdrop-blur-sm transition hover:text-parchment"
        style={{ background: "hsl(0 0% 100% / 0.06)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
      >
        ⊕ home
      </button>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 px-4 text-center whitespace-nowrap">
        <div className="font-display text-xs sm:text-sm text-parchment/60 tracking-tight">
          drag to wander · tap a memory
        </div>
        <div className="hidden sm:block mt-1 text-[0.6rem] tracking-[0.3em] uppercase text-parchment/40">
          press esc to close
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
  // Tone is no longer used for shadows — every node glows soft yellow like a star.
  // Kept on the type for future per-memory accents.
  const dim = isAnyExpanded && !isExpanded;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: m.x,
        top: m.y,
        zIndex: isExpanded ? 40 : 10,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isExpanded) onToggle();
      }}
    >
      {/* Touch-target wrapper. Non-flex, so the inner card can size freely
          (a flex parent would squish the inner card on its main axis). */}
      <div className="relative" style={{ width: 96, height: 96 }}>
        <div
          className="absolute left-1/2 top-1/2 overflow-hidden"
          style={{
            // Collapsed: 88px circular thumbnail. Expanded: rounded square card.
            width: isExpanded ? "clamp(240px, 72vw, 320px)" : m.media ? 88 : 36,
            height: isExpanded ? "clamp(240px, 72vw, 320px)" : m.media ? 88 : 36,
            transform: "translate(-50%, -50%)",
            borderRadius: isExpanded ? 22 : 9999,
            background: m.media ? "transparent" : "hsl(48 60% 70% / 0.4)",
            boxShadow: isExpanded
              ? `0 0 80px 10px ${STAR_RING_GLOW}, 0 0 180px 40px ${STAR_RING_FAR}, 0 25px 50px -12px hsl(0 0% 0% / 0.7)`
              : `0 0 0 2px ${STAR_RING_INNER}, 0 0 22px 5px ${STAR_RING_GLOW}, 0 0 50px 18px ${STAR_RING_FAR}`,
            transition:
              "width 600ms cubic-bezier(0.6,0,0.2,1), height 600ms cubic-bezier(0.6,0,0.2,1), border-radius 600ms cubic-bezier(0.6,0,0.2,1), box-shadow 600ms ease, opacity 400ms ease",
            cursor: isExpanded ? "default" : "pointer",
            opacity: dim ? 0.35 : 1,
          }}
        >
          {!isExpanded && !m.media && (
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${STAR_RING_GLOW} 0%, transparent 70%)`,
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
