// V17o — GameVault explainer animation. Imported from the design handoff
// (GameVaultVideo.jsx). Self-contained 32s looping 16:9 explainer that
// walks buyers through the SafeDrop buyer-protection flow. Hand-rolled timeline engine —
// no external animation library needed.
//
// Conversions from the handoff:
//   - Added `import React from 'react'` (was reading from global scope).
//   - Removed `window.GameVaultVideo` / `module.exports` at the bottom in
//     favor of an `export default GameVaultVideo`.
//   - Removed the <PlaybackBar /> render from <Stage> so the production
//     widget autoplays cleanly without scrubber UI underneath.
//   - Swapped the backdrop URL to /section-bg/explainer-backdrop.png.
//
// 'use client' is set at the top because the engine uses React state,
// requestAnimationFrame, and localStorage.
'use client'
/* eslint-disable @typescript-eslint/no-unused-vars, @next/next/no-img-element, react/no-unknown-property */

import React from 'react'

/* BEGIN USAGE */
// animations.jsx
// Reusable animation starter: Stage, Timeline, Sprite, easing helpers.
// Exports (to window): Stage, Sprite, PlaybackBar, TextSprite, ImageSprite, RectSprite,
//   useTime, useTimeline, useSprite, Easing, interpolate, animate, clamp.
//
// Usage (in an HTML file that loads React + Babel):
//
//   <Stage width={1280} height={720} duration={10} background="#f6f4ef">
//     <MyScene />
//   </Stage>
//
// <Stage> auto-scales to the viewport and provides the scrubber, play/pause,
// ←/→ seek, space, and 0-to-reset controls, and persists the playhead.
// Inside <Stage>, any child can call useTime() to read the current
// playhead (seconds). Or wrap content in <Sprite start={1} end={4}>...</Sprite>
// to only render during that window -- children receive a `localTime` and
// `progress` via the useSprite() hook. Use Easing + interpolate()/animate()
// for tweens; TextSprite / ImageSprite / RectSprite have built-in entry/exit.
// Build YOUR scenes by composing Sprites inside a Stage.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

// ── Easing functions (hand-rolled, Popmotion-style) ─────────────────────────
// All easings take t ∈ [0,1] and return eased t ∈ [0,1] (may overshoot for back/elastic).
const Easing = {
  linear: (t) => t,

  // Quad
  easeInQuad:    (t) => t * t,
  easeOutQuad:   (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // Cubic
  easeInCubic:    (t) => t * t * t,
  easeOutCubic:   (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

  // Quart
  easeInQuart:    (t) => t * t * t * t,
  easeOutQuart:   (t) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t),

  // Expo
  easeInExpo:  (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10);
    return 1 - 0.5 * Math.pow(2, -20 * t + 10);
  },

  // Sine
  easeInSine:    (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine:   (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Back (overshoot)
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeInOutBack: (t) => {
    const c1 = 1.70158, c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic
  easeOutElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

// ── Core interpolation helpers ──────────────────────────────────────────────

// Clamp a value to [min, max]
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// interpolate([0, 0.5, 1], [0, 100, 50], ease?) -> fn(t)
// Popmotion-style: linearly maps t across input keyframes to output values,
// with optional easing per segment (single fn or array of fns).
function interpolate(input, output, ease = Easing.linear) {
  return (t) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const easeFn = Array.isArray(ease) ? (ease[i] || Easing.linear) : ease;
        const eased = easeFn(local);
        return output[i] + (output[i + 1] - output[i]) * eased;
      }
    }
    return output[output.length - 1];
  };
}

// animate({from, to, start, end, ease})(t) — simpler single-segment tween.
// Returns `from` before `start`, `to` after `end`.
function animate({ from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic }) {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    const local = (t - start) / (end - start);
    return from + (to - from) * ease(local);
  };
}

// ── Timeline context ────────────────────────────────────────────────────────

const TimelineContext = React.createContext({ time: 0, duration: 10, playing: false });

const useTime = () => React.useContext(TimelineContext).time;
const useTimeline = () => React.useContext(TimelineContext);

// ── Sprite ──────────────────────────────────────────────────────────────────
// Renders children only when the playhead is inside [start, end]. Provides
// a sub-context with `localTime` (seconds since start) and `progress` (0..1).
//
//   <Sprite start={2} end={5}>
//     {({ localTime, progress }) => <Thing x={progress * 100} />}
//   </Sprite>
//
// Or as a plain wrapper — children can call useSprite() themselves.

const SpriteContext = React.createContext({ localTime: 0, progress: 0, duration: 0 });
const useSprite = () => React.useContext(SpriteContext);

function Sprite({ start = 0, end = Infinity, children, keepMounted = false }) {
  const { time } = useTimeline();
  const visible = time >= start && time <= end;
  if (!visible && !keepMounted) return null;

  const duration = end - start;
  const localTime = Math.max(0, time - start);
  const progress = duration > 0 && isFinite(duration)
    ? clamp(localTime / duration, 0, 1)
    : 0;

  const value = { localTime, progress, duration, visible };

  return (
    <SpriteContext.Provider value={value}>
      {typeof children === 'function' ? children(value) : children}
    </SpriteContext.Provider>
  );
}

// ── Sample sprite components ────────────────────────────────────────────────

// TextSprite: fades/slides text in on entry, holds, then fades out on exit.
// Props: text, x, y, size, color, font, entryDur, exitDur, align
function TextSprite({
  text,
  x = 0, y = 0,
  size = 48,
  color = '#111',
  font = 'Inter, system-ui, sans-serif',
  weight = 600,
  entryDur = 0.45,
  exitDur = 0.35,
  entryEase = Easing.easeOutBack,
  exitEase = Easing.easeInCubic,
  align = 'left',
  letterSpacing = '-0.01em',
}) {
  const { localTime, duration } = useSprite();
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let ty = 0;

  if (localTime < entryDur) {
    const t = entryEase(clamp(localTime / entryDur, 0, 1));
    opacity = t;
    ty = (1 - t) * 16;
  } else if (localTime > exitStart) {
    const t = exitEase(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    ty = -t * 8;
  }

  const translateX = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      transform: `translate(${translateX}, ${ty}px)`,
      opacity,
      fontFamily: font,
      fontSize: size,
      fontWeight: weight,
      color,
      letterSpacing,
      whiteSpace: 'pre',
      lineHeight: 1.1,
      willChange: 'transform, opacity',
    }}>
      {text}
    </div>
  );
}

// ImageSprite: scales + fades in; optional Ken Burns drift during hold.
function ImageSprite({
  src,
  x = 0, y = 0,
  width = 400, height = 300,
  entryDur = 0.6,
  exitDur = 0.4,
  kenBurns = false,
  kenBurnsScale = 1.08,
  radius = 12,
  fit = 'cover',
  placeholder = null, // {label: string} for striped placeholder
}) {
  const { localTime, duration } = useSprite();
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let scale = 1;

  if (localTime < entryDur) {
    const t = Easing.easeOutCubic(clamp(localTime / entryDur, 0, 1));
    opacity = t;
    scale = 0.96 + 0.04 * t;
  } else if (localTime > exitStart) {
    const t = Easing.easeInCubic(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    scale = (kenBurns ? kenBurnsScale : 1) + 0.02 * t;
  } else if (kenBurns) {
    const holdSpan = exitStart - entryDur;
    const holdT = holdSpan > 0 ? (localTime - entryDur) / holdSpan : 0;
    scale = 1 + (kenBurnsScale - 1) * holdT;
  }

  const content = placeholder ? (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'repeating-linear-gradient(135deg, #e9e6df 0 10px, #dcd8cf 10px 20px)',
      color: '#6b6458',
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 13,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {placeholder.label || 'image'}
    </div>
  ) : (
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />
  );

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width, height,
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      borderRadius: radius,
      overflow: 'hidden',
      willChange: 'transform, opacity',
    }}>
      {content}
    </div>
  );
}

// RectSprite: simple rectangle that animates position/size/color via props.
// Useful demo primitive — takes a `render` fn for per-frame customization.
function RectSprite({
  x = 0, y = 0,
  width = 100, height = 100,
  color = '#111',
  radius = 8,
  entryDur = 0.4,
  exitDur = 0.3,
  render, // optional: (ctx) => style overrides
}) {
  const spriteCtx = useSprite();
  const { localTime, duration } = spriteCtx;
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let scale = 1;

  if (localTime < entryDur) {
    const t = Easing.easeOutBack(clamp(localTime / entryDur, 0, 1));
    opacity = clamp(localTime / entryDur, 0, 1);
    scale = 0.4 + 0.6 * t;
  } else if (localTime > exitStart) {
    const t = Easing.easeInQuad(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    scale = 1 - 0.15 * t;
  }

  const overrides = render ? render(spriteCtx) : {};

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width, height,
      background: color,
      borderRadius: radius,
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      willChange: 'transform, opacity',
      ...overrides,
    }} />
  );
}


function Stage({
  width = 1280,
  height = 720,
  duration = 10,
  background = '#f6f4ef',
  fps = 60,
  loop = true,
  autoplay = true,
  // V17u — When defined, this overrides the user-controlled `playing`
  // state. Parent toggles it based on IntersectionObserver: true when
  // the animation is in view, false when scrolled out. The internal
  // `playing` state is preserved for keyboard space-toggle UX, but
  // visibility wins if it's explicitly set to false.
  externalPlay = undefined,
  persistKey = 'animstage',
  children,
}) {
  const [time, setTime] = React.useState(() => {
    try {
      const v = parseFloat(localStorage.getItem(persistKey + ':t') || '0');
      return isFinite(v) ? clamp(v, 0, duration) : 0;
    } catch { return 0; }
  });
  const [playing, setPlaying] = React.useState(autoplay);
  // V17v — When externalPlay is explicitly provided, it IS the source
  // of truth. Previously we anded with `playing` which broke the case
  // of autoplay=false + externalPlay=true (used by the scroll-trigger
  // wrapper) — `playing` stayed false forever because nothing flipped
  // it. The local `playing` is only meaningful when externalPlay
  // isn't supplied (e.g. dev with PlaybackBar).
  const effectivePlaying = externalPlay === undefined ? playing : externalPlay;
  const [hoverTime, setHoverTime] = React.useState(null);
  const [scale, setScale] = React.useState(1);

  const stageRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const lastTsRef = React.useRef(null);

  // Persist playhead
  React.useEffect(() => {
    try { localStorage.setItem(persistKey + ':t', String(time)); } catch {}
  }, [time, persistKey]);

  // Auto-scale to fit viewport
  React.useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const measure = () => {
      // V17o — barH was 44 to reserve space for the PlaybackBar. We've
      // removed the bar so the canvas can use the full parent height.
      const s = Math.min(
        el.clientWidth / width,
        el.clientHeight / height
      );
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [width, height]);

  // Animation loop. V17u — Gates on effectivePlaying so the rAF loop
  // pauses cleanly when the explainer is scrolled out of view.
  React.useEffect(() => {
    if (!effectivePlaying) {
      lastTsRef.current = null;
      return;
    }
    const step = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((t) => {
        let next = t + dt;
        if (next >= duration) {
          if (loop) next = next % duration;
          else { next = duration; setPlaying(false); }
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [effectivePlaying, duration, loop]);

  // Keyboard: space = play/pause, ← → = seek
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(p => !p);
      } else if (e.code === 'ArrowLeft') {
        setTime(t => clamp(t - (e.shiftKey ? 1 : 0.1), 0, duration));
      } else if (e.code === 'ArrowRight') {
        setTime(t => clamp(t + (e.shiftKey ? 1 : 0.1), 0, duration));
      } else if (e.key === '0' || e.code === 'Home') {
        setTime(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration]);

  const displayTime = hoverTime != null ? hoverTime : time;

  const ctxValue = React.useMemo(
    () => ({ time: displayTime, duration, playing, setTime, setPlaying }),
    [displayTime, duration, playing]
  );

  return (
    <div
      ref={stageRef}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        background: '#0a0a0a',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Canvas area — vertically centered in remaining space */}
      <div style={{
        flex: 1,
        width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <div
          ref={canvasRef}
          style={{
            width, height,
            background,
            position: 'relative',
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            flexShrink: 0,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          <TimelineContext.Provider value={ctxValue}>
            {children}
          </TimelineContext.Provider>
        </div>
      </div>

      {/* V17o — PlaybackBar removed for production. Animation
          autoplays + loops; users get the clean explainer. The bar
          is preserved as a component below in case we want a review
          mode later. */}
    </div>
  );
}

// ── Playback bar ────────────────────────────────────────────────────────────
// Play/pause, return-to-begin, scrub track, time display.
// Uses fixed-width time fields so layout doesn't thrash.

function PlaybackBar({ time, duration, playing, onPlayPause, onReset, onSeek, onHover }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const timeFromEvent = React.useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return x * duration;
  }, [duration]);

  const onTrackMove = (e) => {
    if (!trackRef.current) return;
    const t = timeFromEvent(e);
    if (dragging) {
      onSeek(t);
    } else {
      onHover(t);
    }
  };

  const onTrackLeave = () => {
    if (!dragging) onHover(null);
  };

  const onTrackDown = (e) => {
    setDragging(true);
    const t = timeFromEvent(e);
    onSeek(t);
    onHover(null);
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onUp = () => setDragging(false);
    const onMove = (e) => {
      if (!trackRef.current) return;
      const t = timeFromEvent(e);
      onSeek(t);
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
    };
  }, [dragging, timeFromEvent, onSeek]);

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const fmt = (t) => {
    const total = Math.max(0, t);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const cs = Math.floor((total * 100) % 100);
    return `${String(m).padStart(1, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const mono = 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px',
      background: 'rgba(20,20,20,0.92)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      width: '100%',
      maxWidth: 680,
      alignSelf: 'center',

      borderRadius: 8,
      color: '#f6f4ef',
      fontFamily: 'Inter, system-ui, sans-serif',
      userSelect: 'none',
      flexShrink: 0,
    }}>
      <IconButton onClick={onReset} title="Return to start (0)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 2v10M12 2L5 7l7 5V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      </IconButton>
      <IconButton onClick={onPlayPause} title="Play/pause (space)">
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="2" width="3" height="10" fill="currentColor"/>
            <rect x="8" y="2" width="3" height="10" fill="currentColor"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2l9 5-9 5V2z" fill="currentColor"/>
          </svg>
        )}
      </IconButton>

      {/* Current time: fixed width so it doesn't thrash */}
      <div style={{
        fontFamily: mono,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        width: 64, textAlign: 'right',
        color: '#f6f4ef',
      }}>
        {fmt(time)}
      </div>

      {/* Scrub track */}
      <div
        ref={trackRef}
        onMouseMove={onTrackMove}
        onMouseLeave={onTrackLeave}
        onMouseDown={onTrackDown}
        style={{
          flex: 1,
          height: 22,
          position: 'relative',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}
      >
        <div style={{
          position: 'absolute',
          left: 0, right: 0, height: 4,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 2,
        }}/>
        <div style={{
          position: 'absolute',
          left: 0, width: `${pct}%`, height: 4,
          background: 'oklch(72% 0.12 250)',
          borderRadius: 2,
        }}/>
        <div style={{
          position: 'absolute',
          left: `${pct}%`, top: '50%',
          width: 12, height: 12,
          marginLeft: -6, marginTop: -6,
          background: '#fff',
          borderRadius: 6,
          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
        }}/>
      </div>

      {/* Duration: fixed width */}
      <div style={{
        fontFamily: mono,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        width: 64, textAlign: 'left',
        color: 'rgba(246,244,239,0.55)',
      }}>
        {fmt(duration)}
      </div>
    </div>
  );
}

function IconButton({ children, onClick, title }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        color: '#f6f4ef',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}


// V17w — Guarded for SSR. The handoff file exposed the engine on
// window for debugging in the standalone HTML; under Next's SSR
// `window` doesn't exist, which was crashing the homepage with a
// 500 error and masking other bugs (clicks not navigating because
// the page didn't load fresh code).
if (typeof window !== 'undefined') {
  Object.assign(window, {
    Easing, interpolate, animate, clamp,
    TimelineContext, useTime, useTimeline,
    Sprite, SpriteContext, useSprite,
    TextSprite, ImageSprite, RectSprite,
    Stage, PlaybackBar,
  });
}

/* ════════════════════════════════════════════════════════════════════════
   DROPMARKET — "How SafeDrop keeps you safe" explainer
   ════════════════════════════════════════════════════════════════════════ */

const C = {
  bg: '#0a0c0a',
  panel: '#0f120d',
  panel2: '#15190f',
  card: '#13160f',
  line: 'rgba(198,242,74,0.14)',
  lineSoft: 'rgba(255,255,255,0.07)',
  lime: '#c6f24a',
  limeBright: '#dcff6e',
  limeDim: 'rgba(198,242,74,0.10)',
  limeDim2: 'rgba(198,242,74,0.22)',
  white: '#f2f5ec',
  muted: '#8b938a',
  mutedDim: '#5b625a',
  danger: '#ff7a59',
};
const FD = '"Inter", system-ui, sans-serif';
const FB = '"Inter", system-ui, sans-serif';
// V17o — Was "Space Mono" in the handoff. Falling back to JetBrains
// Mono (already loaded globally via --font-jetbrains-mono in
// app/layout.tsx) for the numeric/timer labels.
const FM = 'var(--font-jetbrains-mono), ui-monospace, "Space Mono", monospace';

// progress within [s,e] eased
const seg = (lt, s, e, ease = Easing.easeOutCubic) => ease(clamp((lt - s) / (e - s), 0, 1));

// ── Line icons (lucide-style) ───────────────────────────────────────────────
function Icon({ name, size = 24, color = C.lime, stroke = 2, fill = 'none', style }) {
  const paths = {
    search: <React.Fragment><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></React.Fragment>,
    tag: <React.Fragment><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2.5 12V2.5h9.5l8.6 8.1a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1.4" /></React.Fragment>,
    lock: <React.Fragment><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></React.Fragment>,
    box: <React.Fragment><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.3 7L12 12l8.7-5" /><line x1="12" y1="22" x2="12" y2="12" /></React.Fragment>,
    check: <polyline points="20 6 9 17 4 12" />,
    checkCircle: <React.Fragment><circle cx="12" cy="12" r="9.5" /><polyline points="16.5 9 10.5 15.5 7.5 12.5" /></React.Fragment>,
    star: <polygon points="12 2.5 14.85 8.3 21.2 9.25 16.6 13.7 17.7 20.1 12 17.1 6.3 20.1 7.4 13.7 2.8 9.25 9.15 8.3" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    cursor: <path d="M4 3l7 16 2.3-6.9 6.9-2.3z" />,
    arrow: <React.Fragment><line x1="4" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></React.Fragment>,
    clock: <React.Fragment><circle cx="12" cy="12" r="9.5" /><polyline points="12 6.5 12 12 16 14" /></React.Fragment>,
    user: <React.Fragment><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></React.Fragment>,
    coins: <React.Fragment><circle cx="9" cy="9" r="6.5" /><path d="M16.5 5.3a6.5 6.5 0 0 1 0 13.4M6.6 9h2.4M9 6.6v4.8" /></React.Fragment>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {paths[name]}
    </svg>
  );
}

// Lime-tinted rounded icon tile (matches reference)
function IconTile({ name, size = 64, icon = 32, glow = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 16,
      background: C.limeDim, border: `1px solid ${C.limeDim2}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: glow ? `0 0 28px rgba(198,242,74,0.35)` : 'none',
    }}>
      <Icon name={name} size={icon} color={C.lime} stroke={2} />
    </div>
  );
}

// ── Ambient background: dark + drifting lime bloom + dot grid + vignette ──────
function GlowBg() {
  const t = useTime();
  const drift = Math.sin(t * 0.35) * 36;
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.5);
  // V17o — Asset served from /public/section-bg/.
  const backdropUrl = '/section-bg/explainer-backdrop.png';
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden' }}>
      {/* blurred Roblox backdrop — more visible, behind a lighter dark wash */}
      <div style={{
        position: 'absolute', inset: '-6%',
        backgroundImage: `url("${backdropUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: `center ${60 + drift * 0.15}%`,
        filter: 'blur(14px) brightness(0.64) saturate(0.92)',
        opacity: 0.5,
        transform: `scale(${1.06 + 0.03 * breathe})`,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(10,12,10,0.5) 0%, rgba(10,12,10,0.2) 44%, rgba(10,12,10,0.74) 100%)',
      }} />
      {/* green harmonizing tint */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(40,60,16,0.16)', mixBlendMode: 'overlay' }} />
      <div style={{
        position: 'absolute', left: '50%', top: -260 + drift, width: 1500, height: 1050,
        transform: 'translateX(-50%)',
        background: `radial-gradient(ellipse at center, rgba(198,242,74,${0.09 + 0.05 * breathe}) 0%, rgba(198,242,74,0) 62%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '44px 44px', opacity: 0.4,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 88% 78% at center, transparent 36%, rgba(0,0,0,0.52) 100%)',
      }} />
    </div>
  );
}

// ── Persistent brand mark (top-left during steps) ────────────────────────────
function BrandMark() {
  return (
    <div style={{ position: 'absolute', left: 120, top: 84, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11, background: C.limeDim,
        border: `1px solid ${C.limeDim2}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="lock" size={21} color={C.lime} stroke={2.2} />
      </div>
      <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 26, color: C.white, letterSpacing: '-0.02em' }}>
        Drop<span style={{ color: C.lime }}>Market</span>
      </span>
    </div>
  );
}

// ── Step caption block (number / title / desc + icon tile) ───────────────────
function Caption({ lt, num, icon, title, desc, x = 120, y = 380, w = 560 }) {
  const a = seg(lt, 0.15, 0.7, Easing.easeOutCubic);
  const b = seg(lt, 0.3, 0.9, Easing.easeOutCubic);
  const c = seg(lt, 0.45, 1.05, Easing.easeOutCubic);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w }}>
      <div style={{ opacity: a, transform: `translateY(${(1 - a) * 18}px)`, marginBottom: 26 }}>
        <IconTile name={icon} size={68} icon={34} glow />
      </div>
      <div style={{
        fontFamily: FM, fontSize: 17, color: C.lime, letterSpacing: '0.22em',
        opacity: a, marginBottom: 14,
      }}>STEP {num} / 04</div>
      <div style={{
        fontFamily: FD, fontWeight: 700, fontSize: 56, color: C.white, lineHeight: 1.04,
        letterSpacing: '-0.025em', opacity: b, transform: `translateY(${(1 - b) * 16}px)`, marginBottom: 20,
      }}>{title}</div>
      <div style={{
        fontFamily: FB, fontWeight: 450, fontSize: 25, color: C.muted, lineHeight: 1.5,
        opacity: c, transform: `translateY(${(1 - c) * 12}px)`, textWrap: 'pretty', maxWidth: 500,
      }}>{desc}</div>
    </div>
  );
}

// ── Bottom step progress indicator ───────────────────────────────────────────
function StepProgress({ active }) {
  const steps = ['Find', 'Pay', 'Receive', 'Confirm'];
  const targets = [3.7, 8.1, 12.4, 17.8]; // jump-to time for each section
  const { setTime, setPlaying } = useTimeline();
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 64, transform: 'translateX(-50%)',
      display: 'flex', gap: 16, alignItems: 'center', pointerEvents: 'auto',
    }}>
      {steps.map((s, i) => {
        const on = i === active;
        const done = i < active;
        return (
          <div key={i}
            onClick={() => { if (setTime) { setTime(targets[i]); if (setPlaying) setPlaying(true); } }}
            title={`Jump to: ${s}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 13,
              padding: '16px 28px', borderRadius: 16,
              background: on ? C.limeDim : 'rgba(255,255,255,0.03)',
              border: `1px solid ${on ? C.limeDim2 : C.lineSoft}`,
              transition: 'all 320ms ease', cursor: 'pointer',
            }}>
            <span style={{
              fontFamily: FM, fontSize: 18, fontWeight: 700,
              color: on ? C.lime : done ? C.muted : C.mutedDim, letterSpacing: '0.04em',
            }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{
              fontFamily: FB, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em',
              color: on ? C.white : C.mutedDim,
            }}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Reusable app panel frame ─────────────────────────────────────────────────
function Panel({ x, y, w, h, children, scaleIn = 1, opacity = 1 }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      background: C.panel, border: `1px solid ${C.lineSoft}`, borderRadius: 24,
      boxShadow: '0 40px 90px rgba(0,0,0,0.5)', overflow: 'hidden',
      transform: `scale(${scaleIn})`, transformOrigin: 'center', opacity,
    }}>
      {/* top window dots */}
      <div style={{ display: 'flex', gap: 9, padding: '20px 24px', borderBottom: `1px solid ${C.lineSoft}` }}>
        {['#3a3f36', '#3a3f36', '#3a3f36'].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
        ))}
      </div>
      {children}
    </div>
  );
}

// ════════ SCENE 1 — INTRO ════════
function IntroScene() {
  const { localTime, duration } = useSprite();
  const out = 1 - seg(localTime, duration - 0.45, duration, Easing.easeInCubic);
  const mark = seg(localTime, 0.0, 0.85, Easing.easeOutBack);
  const wm = seg(localTime, 0.6, 1.25, Easing.easeOutCubic);
  const tag = seg(localTime, 1.25, 1.85, Easing.easeOutCubic);
  const sub = seg(localTime, 2.0, 2.6, Easing.easeOutCubic);
  const shackle = seg(localTime, 0.85, 1.15, Easing.easeOutBack);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* Vault mark */}
      <div style={{
        width: 132, height: 132, borderRadius: 30,
        background: C.limeDim, border: `1.5px solid ${C.limeDim2}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${0.5 + 0.5 * mark})`, opacity: mark,
        boxShadow: `0 0 ${50 * mark}px rgba(198,242,74,0.4)`, marginBottom: 44,
      }}>
        <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" style={{ transformOrigin: '12px 11px', transform: `translateY(${(1 - shackle) * 4}px)` }} />
        </svg>
      </div>
      <div style={{
        fontFamily: FD, fontWeight: 700, fontSize: 92, color: C.white, letterSpacing: '-0.03em',
        opacity: wm, transform: `translateY(${(1 - wm) * 22}px)`, marginBottom: 26,
      }}>Drop<span style={{ color: C.lime }}>Market</span></div>
      <div style={{
        fontFamily: FB, fontWeight: 600, fontSize: 32, color: C.white, opacity: tag,
        transform: `translateY(${(1 - tag) * 14}px)`, marginBottom: 16,
      }}>Game currency, top-ups & skins — bought safely.</div>
      <div style={{
        fontFamily: FB, fontWeight: 450, fontSize: 24, color: C.muted, opacity: sub,
        transform: `translateY(${(1 - sub) * 12}px)`,
      }}>Get what you ordered, or your money back — here's how.</div>
    </div>
  );
}

// ════════ SCENE 2 — SEARCH / FIND LISTING ════════
const LISTINGS = [
  { game: 'Roblox', item: '5,000 Robux', price: '$29.40', seller: 'NovaTopUp', rating: '4.9', best: false },
  { game: 'Roblox', item: '5,000 Robux', price: '$27.10', seller: 'AceVault', rating: '5.0', best: true },
  { game: 'Roblox', item: '5,000 Robux', price: '$31.80', seller: 'GG_Store', rating: '4.8', best: false },
];
function SearchScene() {
  const { localTime, duration } = useSprite();
  const out = 1 - seg(localTime, duration - 0.45, duration, Easing.easeInCubic);
  const panel = seg(localTime, 0.0, 0.55, Easing.easeOutCubic);
  const query = 'Roblox 5000 Robux';
  const typed = query.slice(0, Math.round(interpolate([0.5, 1.7], [0, query.length])(localTime)));
  const caret = Math.floor(localTime * 2.4) % 2 === 0 && localTime < 1.9;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <Caption lt={localTime} num="01" icon="tag" title={'Find your\nlisting'}
        desc="Search verified listings from KYC-checked sellers and lock in the lowest price." />
      <Panel x={748} y={250} w={1052} h={580} scaleIn={0.96 + 0.04 * panel} opacity={panel}>
        {/* search bar */}
        <div style={{ padding: '30px 36px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, height: 66, padding: '0 24px',
            background: C.card, border: `1.5px solid ${localTime > 0.5 && localTime < 1.9 ? C.limeDim2 : C.lineSoft}`,
            borderRadius: 15,
          }}>
            <Icon name="search" size={24} color={C.muted} stroke={2} />
            <span style={{ fontFamily: FB, fontSize: 24, color: C.white, fontWeight: 500 }}>
              {typed}<span style={{ opacity: caret ? 1 : 0, color: C.lime, fontWeight: 400 }}>|</span>
            </span>
          </div>
        </div>
        {/* result rows */}
        <div style={{ padding: '14px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {LISTINGS.map((l, i) => {
            const p = seg(localTime, 1.85 + i * 0.16, 2.4 + i * 0.16, Easing.easeOutBack);
            const highlight = l.best && localTime > 3.0;
            const hl = seg(localTime, 3.0, 3.4);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px',
                background: highlight ? C.panel2 : C.card,
                border: `1.5px solid ${highlight ? `rgba(198,242,74,${0.25 + 0.25 * hl})` : C.lineSoft}`,
                borderRadius: 15, opacity: p, transform: `translateY(${(1 - p) * 26}px)`,
                boxShadow: highlight ? `0 0 30px rgba(198,242,74,${0.18 * hl})` : 'none',
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 11, background: C.limeDim, border: `1px solid ${C.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="coins" size={26} color={C.lime} stroke={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FD, fontWeight: 600, fontSize: 23, color: C.white }}>{l.game} · {l.item}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <Icon name="star" size={15} color={C.lime} stroke={1.5} />
                    <span style={{ fontFamily: FM, fontSize: 15, color: C.muted }}>{l.rating} · {l.seller}</span>
                  </div>
                </div>
                {highlight && (
                  <span style={{ fontFamily: FM, fontSize: 13, color: C.lime, background: C.limeDim, border: `1px solid ${C.limeDim2}`, padding: '5px 11px', borderRadius: 8, letterSpacing: '0.05em' }}>BEST PRICE</span>
                )}
                <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 28, color: highlight ? C.lime : C.white }}>{l.price}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ════════ SCENE 3 — CHECK RATING & BUY ════════
function BuyScene() {
  const { localTime, duration } = useSprite();
  const out = 1 - seg(localTime, duration - 0.45, duration, Easing.easeInCubic);
  const panel = seg(localTime, 0.0, 0.55, Easing.easeOutCubic);
  const stars = seg(localTime, 0.7, 1.5);
  const press = localTime > 2.55 && localTime < 2.75;
  const placed = seg(localTime, 2.85, 3.3, Easing.easeOutBack);
  // cursor path → buy button
  const cx = interpolate([1.3, 2.5], [1460, 1206], Easing.easeInOutCubic)(localTime);
  const cy = interpolate([1.3, 2.5], [900, 672], Easing.easeInOutCubic)(localTime);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <Caption lt={localTime} num="02" icon="star" title={'Check rating\n& buy'}
        desc="Review verified seller ratings and sales history, then check out with confidence." />
      <Panel x={812} y={262} w={788} h={556} scaleIn={0.96 + 0.04 * panel} opacity={panel}>
        <div style={{ padding: '34px 40px' }}>
          {/* item header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: FM, fontSize: 14, color: C.lime, letterSpacing: '0.16em', marginBottom: 8 }}>ROBLOX</div>
              <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 38, color: C.white, letterSpacing: '-0.02em' }}>5,000 Robux</div>
            </div>
            <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 46, color: C.lime }}>$27.10</div>
          </div>
          {/* seller card */}
          <div style={{ marginTop: 30, padding: 26, background: C.card, border: `1px solid ${C.lineSoft}`, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: C.limeDim, border: `1px solid ${C.limeDim2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="user" size={28} color={C.lime} stroke={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: FD, fontWeight: 600, fontSize: 26, color: C.white }}>AceVault</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FM, fontSize: 13, color: C.lime, background: C.limeDim, border: `1px solid ${C.limeDim2}`, padding: '4px 10px', borderRadius: 8 }}>
                    <Icon name="checkCircle" size={13} color={C.lime} stroke={2.2} /> VERIFIED
                  </span>
                </div>
                <div style={{ fontFamily: FB, fontSize: 16, color: C.muted, marginTop: 6 }}>2,341 orders · Member since 2019</div>
              </div>
            </div>
            {/* stars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
              {[0, 1, 2, 3, 4].map((i) => {
                const sp = clamp((stars * 5) - i, 0, 1);
                return <div key={i} style={{ opacity: 0.3 + 0.7 * sp, transform: `scale(${0.7 + 0.3 * sp})` }}><Icon name="star" size={28} color={C.lime} fill={C.lime} stroke={1.5} /></div>;
              })}
              <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 26, color: C.white, marginLeft: 8 }}>5.0</span>
              <span style={{ fontFamily: FB, fontSize: 17, color: C.muted, marginLeft: 2 }}>· 100% delivery rate</span>
            </div>
          </div>
          {/* buy button */}
          <div style={{
            marginTop: 26, height: 72, borderRadius: 16,
            background: placed > 0 ? C.panel2 : C.lime,
            border: placed > 0 ? `1.5px solid ${C.limeDim2}` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            transform: `scale(${press ? 0.97 : 1})`, transition: 'transform 90ms',
            boxShadow: placed > 0 ? 'none' : '0 10px 30px rgba(198,242,74,0.3)',
          }}>
            {placed > 0
              ? <React.Fragment><Icon name="checkCircle" size={26} color={C.lime} stroke={2.2} /><span style={{ fontFamily: FD, fontWeight: 700, fontSize: 24, color: C.lime }}>Order placed — covered by SafeDrop</span></React.Fragment>
              : <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 24, color: '#0a0c0a' }}>Buy now · $27.10</span>}
          </div>
        </div>
      </Panel>
      {/* cursor */}
      {localTime > 1.25 && localTime < 3.0 && (
        <div style={{ position: 'absolute', left: cx, top: cy, transform: `scale(${press ? 0.85 : 1})`, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))' }}>
          <Icon name="cursor" size={34} color="#fff" stroke={1.5} style={{ fill: '#0a0c0a' }} />
          {press && <div style={{ position: 'absolute', left: -14, top: -14, width: 44, height: 44, borderRadius: 22, border: `2px solid ${C.lime}`, opacity: 0.7 }} />}
        </div>
      )}
    </div>
  );
}

// ── Flow diagram node ────────────────────────────────────────────────────────
function FlowNode({ cx, cy, w = 250, label, sub, icon, active, accent = C.lime, p = 1 }) {
  return (
    <div style={{
      position: 'absolute', left: cx - w / 2, top: cy - 90, width: w,
      opacity: p, transform: `translateY(${(1 - p) * 20}px)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: 24,
        background: active ? 'rgba(198,242,74,0.16)' : C.card,
        border: `1.5px solid ${active ? accent : C.lineSoft}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: active ? `0 0 40px ${accent}55` : 'none',
        transition: 'all 300ms ease',
      }}>
        <Icon name={icon} size={44} color={active ? accent : C.muted} stroke={2} />
      </div>
      <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 26, color: active ? C.white : C.muted, marginTop: 18 }}>{label}</div>
      <div style={{ fontFamily: FM, fontSize: 14, color: active ? accent : C.mutedDim, marginTop: 6, letterSpacing: '0.04em' }}>{sub}</div>
    </div>
  );
}

// ════════ SCENE 4 — SAFEDROP COVERAGE (hero) ════════
const BUYER = { x: 320, y: 470 };
const VAULT = { x: 960, y: 470 };
const SELLER = { x: 1600, y: 470 };

function EscrowScene() {
  const { localTime, duration } = useSprite();
  const out = 1 - seg(localTime, duration - 0.45, duration, Easing.easeInCubic);
  const intro = seg(localTime, 0.0, 0.5);
  const fill = clamp((localTime - 0.7) / 2.3, 0, 1);
  const lockPulse = 0.5 + 0.5 * Math.sin(localTime * 4);
  const cap = seg(localTime, 1.2, 1.8, Easing.easeOutCubic);
  const NCOINS = 6;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <SceneTitle lt={localTime} num="03" text="Your order is covered by SafeDrop" />

      {/* link buyer → vault (active, flowing) */}
      <DashLink x1={BUYER.x + 60} x2={VAULT.x - 70} y={BUYER.y} active flow={localTime} />
      {/* link vault → seller (LOCKED) */}
      <DashLink x1={VAULT.x + 70} x2={SELLER.x - 60} y={BUYER.y} locked lockPulse={lockPulse} />

      {/* coins flying buyer → vault */}
      {Array.from({ length: NCOINS }).map((_, k) => {
        const t = clamp((localTime - (0.7 + k * 0.28)) / 1.0, 0, 1);
        if (t <= 0 || t >= 1) return null;
        const e = Easing.easeInOutQuad(t);
        const x = BUYER.x + 60 + (VAULT.x - 70 - BUYER.x - 60) * e;
        const y = BUYER.y - Math.sin(t * Math.PI) * 70;
        return (
          <div key={k} style={{ position: 'absolute', left: x - 18, top: y - 18, width: 36, height: 36, borderRadius: 18, background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(198,242,74,0.6)', opacity: t < 0.1 ? t * 10 : 1 }}>
            <span style={{ fontFamily: FD, fontWeight: 800, fontSize: 20, color: '#0a0c0a' }}>$</span>
          </div>
        );
      })}

      {/* nodes */}
      <FlowNode cx={BUYER.x} cy={BUYER.y} label="You" sub="BUYER" icon="user" active p={intro} accent={C.lime} />
      {/* vault with fill ring */}
      <div style={{ position: 'absolute', left: VAULT.x - 70, top: VAULT.y - 70, width: 140, height: 140, opacity: intro }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 34,
          background: 'rgba(198,242,74,0.16)', border: `2px solid ${C.lime}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 ${30 + 50 * fill}px rgba(198,242,74,${0.3 + 0.4 * fill})`,
        }}>
          <Icon name="lock" size={58} color={C.lime} stroke={2} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: VAULT.x - 125, top: VAULT.y + 84, width: 250, textAlign: 'center', opacity: intro }}>
        <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 28, color: C.white }}>DropMarket</div>
        <div style={{ fontFamily: FM, fontSize: 14, color: C.lime, marginTop: 6, letterSpacing: '0.06em' }}>SAFEDROP PROTECTION</div>
      </div>
      <FlowNode cx={SELLER.x} cy={SELLER.y} label="Seller" sub="NOT PAID YET" icon="user" active={false} p={intro} />

      {/* inline label on the buyer → vault segment */}
      <FloatLabel x={(BUYER.x + VAULT.x) / 2} y={BUYER.y + 86} text="Delivered — or your money back" p={cap} />
    </div>
  );
}

// ════════ SCENE 5 — DELIVERY & SELLER PAYOUT ════════
function ReleaseScene() {
  const { localTime, duration } = useSprite();
  const out = 1 - seg(localTime, duration - 0.45, duration, Easing.easeInCubic);
  const intro = seg(localTime, 0.0, 0.45);
  // box seller → buyer
  const dt = clamp((localTime - 0.4) / 1.1, 0, 1);
  const boxX = SELLER.x - 60 + (BUYER.x + 60 - (SELLER.x - 60)) * Easing.easeInOutCubic(dt);
  const boxVisible = localTime > 0.4 && localTime < 1.6;
  const delivered = seg(localTime, 1.55, 1.95, Easing.easeOutBack);
  // coins vault → seller
  const NCOINS = 5;
  const releaseStart = 2.2;
  const sellerPaid = seg(localTime, 3.4, 3.8, Easing.easeOutBack);
  const pDeliver = Math.min(seg(localTime, 0.6, 1.1), 1 - seg(localTime, 1.95, 2.25, Easing.easeInCubic));
  const pRelease = seg(localTime, 2.4, 2.9, Easing.easeOutCubic);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <SceneTitle lt={localTime} num="04" text="Delivery, then the seller gets paid" />

      <DashLink x1={BUYER.x + 60} x2={VAULT.x - 70} y={BUYER.y} active={false} />
      <DashLink x1={VAULT.x + 70} x2={SELLER.x - 60} y={BUYER.y} active={localTime > releaseStart} flow={localTime > releaseStart ? localTime : null} />

      {/* delivery box seller→buyer */}
      {boxVisible && (
        <div style={{ position: 'absolute', left: boxX - 22, top: BUYER.y - 80 - Math.sin(dt * Math.PI) * 60, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="box" size={42} color={C.lime} stroke={2} style={{ filter: 'drop-shadow(0 0 12px rgba(198,242,74,0.5))' }} />
        </div>
      )}
      {/* coins vault→seller on release */}
      {Array.from({ length: NCOINS }).map((_, k) => {
        const t = clamp((localTime - (releaseStart + k * 0.22)) / 0.9, 0, 1);
        if (t <= 0 || t >= 1) return null;
        const e = Easing.easeInOutQuad(t);
        const x = VAULT.x + 70 + (SELLER.x - 60 - VAULT.x - 70) * e;
        const y = BUYER.y - Math.sin(t * Math.PI) * 60;
        return (
          <div key={k} style={{ position: 'absolute', left: x - 17, top: y - 17, width: 34, height: 34, borderRadius: 17, background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(198,242,74,0.6)' }}>
            <span style={{ fontFamily: FD, fontWeight: 800, fontSize: 18, color: '#0a0c0a' }}>$</span>
          </div>
        );
      })}

      {/* buyer node w/ confirm check */}
      <FlowNode cx={BUYER.x} cy={BUYER.y} label="You" sub={delivered > 0.5 ? 'DELIVERY CONFIRMED' : 'AWAITING'} icon={delivered > 0.5 ? 'checkCircle' : 'user'} active p={intro} />
      {/* vault */}
      <div style={{ position: 'absolute', left: VAULT.x - 70, top: VAULT.y - 70, width: 140, height: 140, opacity: intro }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 34, background: 'rgba(198,242,74,0.16)', border: `2px solid ${C.lime}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 30px rgba(198,242,74,0.3)` }}>
          <Icon name={localTime > releaseStart ? 'coins' : 'lock'} size={56} color={C.lime} stroke={2} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: VAULT.x - 125, top: VAULT.y + 84, width: 250, textAlign: 'center', opacity: intro }}>
        <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 28, color: C.white }}>DropMarket</div>
        <div style={{ fontFamily: FM, fontSize: 14, color: C.lime, marginTop: 6, letterSpacing: '0.06em' }}>{localTime > releaseStart ? 'PAYING SELLER…' : 'SAFEDROP PROTECTION'}</div>
      </div>
      <FlowNode cx={SELLER.x} cy={SELLER.y} label="Seller" sub={sellerPaid > 0.5 ? 'PAID' : 'DELIVERS ITEM'} icon={sellerPaid > 0.5 ? 'checkCircle' : 'user'} active={sellerPaid > 0.3} p={intro} />

      {/* inline labels on the active segments */}
      <FloatLabel x={(BUYER.x + VAULT.x) / 2} y={BUYER.y + 86} text="Seller delivers to you" p={pDeliver} />
      <FloatLabel x={(VAULT.x + SELLER.x) / 2} y={BUYER.y + 86} text="Seller paid out" p={pRelease} />
    </div>
  );
}

// ── small shared bits for diagrams ───────────────────────────────────────────
// floating inline label that sits on a flow segment
function FloatLabel({ x, y, text, p, accent = C.lime }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: `translate(-50%,-50%) translateY(${(1 - p) * 10}px)`, opacity: p,
      display: 'flex', alignItems: 'center', gap: 11, padding: '13px 22px', borderRadius: 13,
      background: 'rgba(9,11,9,0.74)', border: `1px solid ${C.limeDim2}`,
      whiteSpace: 'nowrap', boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: accent, boxShadow: `0 0 12px ${accent}` }} />
      <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 27, color: C.white, letterSpacing: '-0.01em' }}>{text}</span>
    </div>
  );
}

function SceneTitle({ lt, num, text }) {
  const p = seg(lt, 0.1, 0.6, Easing.easeOutCubic);
  return (
    <div style={{ position: 'absolute', left: '50%', top: 200, transform: 'translateX(-50%)', textAlign: 'center', opacity: p }}>
      <div style={{ fontFamily: FM, fontSize: 17, color: C.lime, letterSpacing: '0.22em', marginBottom: 14 }}>STEP {num} / 04</div>
      <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 52, color: C.white, letterSpacing: '-0.025em' }}>{text}</div>
    </div>
  );
}
function DashLink({ x1, x2, y, active, locked, flow, lockPulse = 1 }) {
  const w = x2 - x1;
  const col = locked ? C.mutedDim : active ? C.lime : C.mutedDim;
  return (
    <div style={{ position: 'absolute', left: x1, top: y - 1, width: w, height: 2 }}>
      <div style={{
        position: 'absolute', inset: 0, borderTop: `2px dashed ${col}`,
        opacity: locked ? 0.5 : active ? 0.8 : 0.3,
        backgroundPosition: flow != null ? `${(flow * 60) % 24}px 0` : '0 0',
      }} />
      {locked && (
        <div style={{ position: 'absolute', left: w / 2 - 26, top: -25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.card, border: `1.5px solid ${C.mutedDim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 ${10 + 14 * lockPulse}px rgba(255,122,89,0.25)` }}>
            <Icon name="lock" size={22} color={C.danger} stroke={2} />
          </div>
          <span style={{ fontFamily: FM, fontSize: 12, color: C.danger, letterSpacing: '0.1em' }}>PAID AFTER DELIVERY</span>
        </div>
      )}
    </div>
  );
}

// ════════ SCENE 6 — DISPUTE / GUARANTEE ════════
function DisputeScene() {
  const { localTime, duration } = useSprite();
  const out = 1 - seg(localTime, duration - 0.45, duration, Easing.easeInCubic);
  const head = seg(localTime, 0.1, 0.7, Easing.easeOutCubic);
  const chips = [
    { icon: 'clock', t: 'Not delivered in time?', s: 'Guaranteed delivery window expires', accent: C.danger },
    { icon: 'shield', t: 'Open a dispute', s: 'One tap — our team reviews it', accent: C.lime },
    { icon: 'coins', t: 'Refunded in full', s: "Didn't get it? You get your money back", accent: C.lime },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ opacity: head, transform: `translateY(${(1 - head) * 18}px)`, textAlign: 'center', marginBottom: 60 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <IconTile name="shield" size={66} icon={34} glow />
        </div>
        <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 58, color: C.white, letterSpacing: '-0.025em' }}>
          And if something goes wrong?
        </div>
        <div style={{ fontFamily: FB, fontWeight: 450, fontSize: 26, color: C.muted, marginTop: 16 }}>
          Every order is covered by <span style={{ color: C.lime, fontWeight: 600 }}>SafeDrop Buyer Protection</span>.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {chips.map((c, i) => {
          const p = seg(localTime, 0.9 + i * 0.32, 1.45 + i * 0.32, Easing.easeOutBack);
          return (
            <React.Fragment key={i}>
              <div style={{
                width: 340, padding: '34px 30px', borderRadius: 20,
                background: C.card, border: `1.5px solid ${i === 0 ? 'rgba(255,122,89,0.3)' : C.limeDim2}`,
                opacity: p, transform: `translateY(${(1 - p) * 28}px) scale(${0.92 + 0.08 * p})`,
              }}>
                <div style={{ width: 58, height: 58, borderRadius: 14, background: i === 0 ? 'rgba(255,122,89,0.12)' : C.limeDim, border: `1px solid ${i === 0 ? 'rgba(255,122,89,0.3)' : C.limeDim2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
                  <Icon name={c.icon} size={30} color={c.accent} stroke={2} />
                </div>
                <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 26, color: C.white, marginBottom: 10 }}>{c.t}</div>
                <div style={{ fontFamily: FB, fontWeight: 450, fontSize: 18, color: C.muted, lineHeight: 1.45 }}>{c.s}</div>
              </div>
              {i < chips.length - 1 && (
                <div style={{ opacity: seg(localTime, 1.3 + i * 0.32, 1.7 + i * 0.32) }}>
                  <Icon name="arrow" size={36} color={C.mutedDim} stroke={2} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ════════ SCENE 7 — OUTRO / FOUR STEPS ════════
const OUTRO_CARDS = [
  { n: '01', icon: 'tag', t: 'Find your listing', d: 'Browse listings from verified sellers.' },
  { n: '02', icon: 'shield', t: 'Pay with protection', d: 'Every order is covered by SafeDrop Buyer Protection.' },
  { n: '03', icon: 'box', t: 'Receive your goods', d: 'Instant auto-delivery or a guided handover.' },
  { n: '04', icon: 'checkCircle', t: 'Confirm delivery', d: 'Happy? The seller gets paid. Problem? Full refund.' },
];
function OutroScene() {
  const { localTime, duration } = useSprite();
  const head = seg(localTime, 0.1, 0.7, Easing.easeOutCubic);
  // phase A (four steps) fades out to reveal the closing logo
  const aOut = 1 - seg(localTime, 2.8, 3.4, Easing.easeInCubic);
  // phase B (closing logo + CTA) — mirrors the intro so the video loops cleanly
  const mark = seg(localTime, 3.3, 4.1, Easing.easeOutBack);
  const wm = seg(localTime, 3.6, 4.2, Easing.easeOutCubic);
  const cta = seg(localTime, 4.1, 4.7, Easing.easeOutBack);
  const shackle = seg(localTime, 4.1, 4.4, Easing.easeOutBack);
  // fade the whole closing frame to empty right at the end → seamless loop into the intro bloom
  const loopOut = 1 - seg(localTime, duration - 0.5, duration, Easing.easeInCubic);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* ── Phase A: Safe in four steps ── */}
      <div style={{ position: 'absolute', inset: 0, opacity: aOut }}>
        <div style={{ position: 'absolute', left: 150, top: 140, opacity: head, transform: `translateY(${(1 - head) * 18}px)` }}>
          <div style={{ fontFamily: FM, fontSize: 18, color: C.lime, letterSpacing: '0.24em', marginBottom: 18 }}>HOW IT WORKS</div>
          <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 76, color: C.white, letterSpacing: '-0.03em' }}>Safe in four steps.</div>
        </div>
        <div style={{ position: 'absolute', left: 150, top: 420, display: 'flex', gap: 24 }}>
          {OUTRO_CARDS.map((c, i) => {
            const p = seg(localTime, 0.5 + i * 0.16, 1.1 + i * 0.16, Easing.easeOutBack);
            return (
              <div key={i} style={{
                width: 372, height: 360, padding: '32px 30px', borderRadius: 22,
                background: C.card, border: `1px solid ${C.lineSoft}`,
                opacity: p, transform: `translateY(${(1 - p) * 34}px)`,
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ fontFamily: FM, fontSize: 17, color: C.lime, letterSpacing: '0.08em', marginBottom: 28 }}>{c.n}</div>
                <IconTile name={c.icon} size={64} icon={32} />
                <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 30, color: C.white, marginTop: 32, marginBottom: 14 }}>{c.t}</div>
                <div style={{ fontFamily: FB, fontWeight: 450, fontSize: 20, color: C.muted, lineHeight: 1.5, textWrap: 'pretty' }}>{c.d}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Phase B: closing logo + Explore Items (loop point) ── */}
      <div style={{ position: 'absolute', inset: 0, opacity: loopOut, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{
          width: 132, height: 132, borderRadius: 30,
          background: C.limeDim, border: `1.5px solid ${C.limeDim2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `scale(${0.5 + 0.5 * mark})`, opacity: mark,
          boxShadow: `0 0 ${50 * mark}px rgba(198,242,74,0.4)`, marginBottom: 42,
        }}>
          <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" style={{ transformOrigin: '12px 11px', transform: `translateY(${(1 - shackle) * 4}px)` }} />
          </svg>
        </div>
        <div style={{
          fontFamily: FD, fontWeight: 800, fontSize: 92, color: C.white, letterSpacing: '-0.03em',
          opacity: wm, transform: `translateY(${(1 - wm) * 22}px)`, marginBottom: 44,
        }}>Drop<span style={{ color: C.lime }}>Market</span></div>
        <div style={{
          padding: '22px 48px', borderRadius: 16, background: C.lime,
          fontFamily: FD, fontWeight: 700, fontSize: 30, color: '#0a0c0a',
          opacity: cta, transform: `translateY(${(1 - cta) * 16}px) scale(${0.92 + 0.08 * cta})`,
          boxShadow: '0 14px 40px rgba(198,242,74,0.34)',
        }}>Explore Items →</div>
      </div>
    </div>
  );
}

// ── persistent chrome (brand + progress) with fade ───────────────────────────
function Chrome({ active }) {
  const { localTime, duration } = useSprite();
  const a = Math.min(seg(localTime, 0, 0.5), 1 - seg(localTime, duration - 0.4, duration, Easing.easeInCubic));
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: a, pointerEvents: 'none' }}>
      <BrandMark />
      <StepProgress active={active} />
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
// V17u — `autoplay` controls initial state; `externalPlay` is the
// scroll-driven override. Parent wraps the explainer in an
// IntersectionObserver and toggles externalPlay between true/false
// based on visibility. autoplay=false + externalPlay=true behaves the
// same as "wait for in-view, then start" without the user ever seeing
// the animation play off-screen.
function GameVaultVideo({ autoplay = false, externalPlay } = {}) {
  return (
    <Stage width={1920} height={1080} duration={32} background={C.bg} persistKey="gamevault" loop={true} autoplay={autoplay} externalPlay={externalPlay}>
      <GlowBg />

      <Sprite start={0} end={3.6}><IntroScene /></Sprite>

      <Sprite start={3.4} end={25.9}>
        <ChromeAt windows={[[3.5, 8.0, 0], [8.0, 12.3, 1], [12.3, 17.7, 2], [17.7, 25.9, 3]]} />
      </Sprite>

      <Sprite start={3.5} end={8.0}><SearchScene /></Sprite>
      <Sprite start={8.0} end={12.3}><BuyScene /></Sprite>
      <Sprite start={12.3} end={17.7}><EscrowScene /></Sprite>
      <Sprite start={17.7} end={22.3}><ReleaseScene /></Sprite>
      <Sprite start={22.3} end={25.7}><DisputeScene /></Sprite>
      <Sprite start={25.7} end={32}><OutroScene /></Sprite>
    </Stage>
  );
}

// chooses active step from the global timeline (so progress is continuous across scenes)
function ChromeAt({ windows }) {
  const t = useTime();
  let active = 0;
  for (const [s, e, idx] of windows) { if (t >= s && t < e) active = idx; }
  return <Chrome active={active} />;
}

// V17o — ES module export instead of window/module globals.
export default GameVaultVideo;
export { GameVaultVideo };

