<script setup lang="ts">
/**
 * PixelLoader — universal 3x3 grid loader.
 *
 * Displays an X pattern (corners + center) with intentional negative space
 * at edge-center positions. Each variant has a distinct color and animation
 * pattern so the user can tell what kind of work is happening at a glance:
 *
 *   thinking  — purple, center-out diamond pulse
 *   reading   — blue, row-by-row left-to-right scan
 *   writing   — green, bottom-up left-to-right fill
 *   executing — amber, top-down cascade waterfall
 *   searching — cyan, center-out ripple ring
 *   idle      — muted, slow simultaneous breathe
 *
 * Usage:
 *   <PixelLoader variant="thinking" />
 *   <PixelLoader variant="reading" :size="5" />
 */

export type LoaderVariant =
  | 'thinking'
  | 'streaming'
  | 'tooling'
  | 'reading'
  | 'writing'
  | 'executing'
  | 'searching'
  | 'idle'

const props = withDefaults(defineProps<{
  variant?: LoaderVariant
  /** Size of each square in px */
  size?: number
}>(), {
  variant: 'thinking',
  size: 5
})

/**
 * Per-square animation delay (ms) for each variant.
 * Indices map to a 3x3 grid:
 *
 *   0 1 2
 *   3 4 5
 *   6 7 8
 *
 * Only indices 0, 2, 4, 6, 8 (X pattern) are rendered visible.
 */
const DELAYS: Record<LoaderVariant, number[]> = {
  // Center first, then corners — radiates from the center
  thinking:  [200, 0, 200, 0, 0,   0, 200, 0, 200],
  // Diagonal cascade: top-left → center → bottom-right, then other diagonal
  streaming: [0,   0, 300, 0, 150, 0, 300, 0, 0],
  // Clockwise rotation: TL → TR → BR → BL, center anchored
  tooling:   [0,   0, 150, 0, 0,   0, 450, 0, 300],
  // Left column, then center, then right column
  reading:   [0,   0, 400, 0, 200, 0, 0,   0, 400],
  // Bottom row, then center, then top row
  writing:   [400, 0, 400, 0, 200, 0, 0,   0, 0],
  // Top row, then center, then bottom row
  executing: [0,   0, 0,   0, 150, 0, 300, 0, 300],
  // Center out in expanding rings — like sonar
  searching: [300, 0, 300, 0, 0,   0, 300, 0, 300],
  // All together — slow breathing
  idle:      [0,   0, 0,   0, 0,   0, 0,   0, 0]
}

/** Total animation duration per variant (ms) */
const DURATION: Record<LoaderVariant, number> = {
  thinking:  1200,
  streaming: 800,
  tooling:   900,
  reading:   900,
  writing:   1000,
  executing: 700,
  searching: 1400,
  idle:      2500
}

// All 9 grid positions; only corners + center (X pattern) are visible
const VISIBLE = new Set([0, 2, 4, 6, 8])
const allCells = [0, 1, 2, 3, 4, 5, 6, 7, 8]

function delayFor(index: number): string {
  return `${DELAYS[props.variant][index]}ms`
}

function durationFor(): string {
  return `${DURATION[props.variant]}ms`
}
</script>

<template>
  <div
    class="pixel-loader"
    :class="`pixel-loader--${variant}`"
    :style="{
      '--sq-size': `${size}px`,
      '--sq-gap': `${Math.max(1, Math.round(size * 0.25))}px`
    }"
    role="status"
    :aria-label="`Loading: ${variant}`"
  >
    <!-- Radial bloom layer behind the squares -->
    <div class="pixel-loader__bloom" />
    <!-- 3x3 grid — only X-pattern cells are visible -->
    <div class="pixel-loader__grid">
      <div
        v-for="i in allCells"
        :key="i"
        class="pixel-loader__square"
        :class="{ 'pixel-loader__square--hidden': !VISIBLE.has(i) }"
        :style="{
          '--anim-delay': delayFor(i),
          '--anim-duration': durationFor()
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.pixel-loader {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  contain: layout style;
}

/* ── Radial bloom: soft glow radiating from center ────────────── */
.pixel-loader__bloom {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.5;
  animation: px-bloom 2s ease-in-out infinite;
  will-change: opacity;
}

@keyframes px-bloom {
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 0.55; }
}

/* ── Grid container ───────────────────────────────────────────── */
.pixel-loader__grid {
  display: grid;
  grid-template-columns: repeat(3, var(--sq-size));
  grid-template-rows: repeat(3, var(--sq-size));
  gap: var(--sq-gap);
  position: relative;
  z-index: 1;
}

/* ── Individual squares ────────────────────────────────────────── */
.pixel-loader__square {
  width: var(--sq-size);
  height: var(--sq-size);
  border-radius: 1.5px;
  opacity: 0.1;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  animation-duration: var(--anim-duration);
  animation-delay: var(--anim-delay);
  will-change: opacity, transform;
}

/* Faintly show non-X-pattern cells (edge centers: indices 1, 3, 5, 7) */
.pixel-loader__square--hidden {
  opacity: 0.05 !important;
  animation: none;
}

/* ════════════════════════════════════════════════════════════════
   VARIANTS — each has its own color, bloom color, and keyframes
   ════════════════════════════════════════════════════════════════ */

/* ── thinking: purple diamond pulse ────────────────────────────── */
.pixel-loader--thinking .pixel-loader__square {
  background: #B197D9;
  animation-name: px-thinking;
}
.pixel-loader--thinking .pixel-loader__bloom {
  background: radial-gradient(circle, rgba(147, 116, 190, 0.45) 0%, transparent 70%);
}
@keyframes px-thinking {
  0%   { opacity: 0.1;  transform: scale(0.8); }
  40%  { opacity: 1;    transform: scale(1);   }
  60%  { opacity: 1;    transform: scale(1);   }
  100% { opacity: 0.1;  transform: scale(0.8); }
}

/* ── streaming: teal diagonal flow — text is being generated ───── */
.pixel-loader--streaming .pixel-loader__square {
  background: #5EEAD4;
  animation-name: px-streaming;
  animation-timing-function: ease;
}
.pixel-loader--streaming .pixel-loader__bloom {
  background: radial-gradient(circle, rgba(94, 234, 212, 0.35) 0%, transparent 70%);
}
@keyframes px-streaming {
  0%   { opacity: 0.08; transform: translateX(-1px) scale(0.9); }
  35%  { opacity: 1;    transform: translateX(0) scale(1);      }
  65%  { opacity: 0.7;  transform: translateX(0.5px) scale(1);  }
  100% { opacity: 0.08; transform: translateX(-1px) scale(0.9); }
}

/* ── tooling: amber clockwise spin — executing a tool ──────────── */
.pixel-loader--tooling .pixel-loader__square {
  background: #FFB84D;
  animation-name: px-tooling;
  animation-timing-function: ease-in-out;
}
.pixel-loader--tooling .pixel-loader__bloom {
  background: radial-gradient(circle, rgba(255, 184, 77, 0.4) 0%, transparent 70%);
  animation: px-bloom-tooling 0.9s ease-in-out infinite;
}
@keyframes px-tooling {
  0%   { opacity: 0.08; transform: rotate(0deg) scale(0.85);   }
  40%  { opacity: 1;    transform: rotate(0deg) scale(1.05);   }
  60%  { opacity: 0.9;  transform: rotate(0deg) scale(1);      }
  100% { opacity: 0.08; transform: rotate(0deg) scale(0.85);   }
}
@keyframes px-bloom-tooling {
  0%, 100% { opacity: 0.2; }
  50%      { opacity: 0.5; }
}

/* ── reading: blue row scan ────────────────────────────────────── */
.pixel-loader--reading .pixel-loader__square {
  background: #7BA5F5;
  animation-name: px-reading;
  animation-timing-function: ease;
}
.pixel-loader--reading .pixel-loader__bloom {
  background: radial-gradient(circle, rgba(91, 141, 239, 0.4) 0%, transparent 70%);
}
@keyframes px-reading {
  0%   { opacity: 0.1; }
  30%  { opacity: 1;   }
  60%  { opacity: 0.3; }
  100% { opacity: 0.1; }
}

/* ── writing: green bottom-up fill ─────────────────────────────── */
.pixel-loader--writing .pixel-loader__square {
  background: #2DD88C;
  animation-name: px-writing;
}
.pixel-loader--writing .pixel-loader__bloom {
  background: radial-gradient(circle, rgba(8, 195, 113, 0.4) 0%, transparent 70%);
}
@keyframes px-writing {
  0%   { opacity: 0.08; transform: scaleY(0.6); }
  35%  { opacity: 1;    transform: scaleY(1);   }
  65%  { opacity: 0.8;  transform: scaleY(1);   }
  100% { opacity: 0.08; transform: scaleY(0.6); }
}

/* ── executing: amber cascade waterfall ────────────────────────── */
.pixel-loader--executing .pixel-loader__square {
  background: #FFB84D;
  animation-name: px-executing;
  animation-timing-function: linear;
}
.pixel-loader--executing .pixel-loader__bloom {
  background: radial-gradient(circle, rgba(245, 166, 35, 0.4) 0%, transparent 70%);
}
@keyframes px-executing {
  0%   { opacity: 0.1;  transform: translateY(-1.5px); }
  25%  { opacity: 1;    transform: translateY(0);       }
  75%  { opacity: 0.5;  transform: translateY(1.5px);   }
  100% { opacity: 0.1;  transform: translateY(-1.5px); }
}

/* ── searching: cyan sonar ripple ──────────────────────────────── */
.pixel-loader--searching .pixel-loader__square {
  background: #4DE5F7;
  animation-name: px-searching;
  animation-timing-function: ease-out;
}
.pixel-loader--searching .pixel-loader__bloom {
  background: radial-gradient(circle, rgba(34, 211, 238, 0.45) 0%, transparent 70%);
  animation: px-bloom-searching 1.4s ease-out infinite;
}
@keyframes px-searching {
  0%   { opacity: 0.08; transform: scale(0.5); }
  30%  { opacity: 1;    transform: scale(1.1); }
  100% { opacity: 0.08; transform: scale(0.5); }
}
@keyframes px-bloom-searching {
  0%   { opacity: 0.15; transform: scale(0.7); }
  50%  { opacity: 0.6;  transform: scale(1.1); }
  100% { opacity: 0.15; transform: scale(0.7); }
}

/* ── idle: muted slow breathe ──────────────────────────────────── */
.pixel-loader--idle .pixel-loader__square {
  background: #8B8DAB;
  animation-name: px-idle;
}
.pixel-loader--idle .pixel-loader__bloom {
  background: radial-gradient(circle, rgba(113, 115, 142, 0.25) 0%, transparent 70%);
  animation: px-bloom 2.5s ease-in-out infinite;
}
@keyframes px-idle {
  0%   { opacity: 0.08; }
  50%  { opacity: 0.35; }
  100% { opacity: 0.08; }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .pixel-loader__square {
    animation: none;
    opacity: 0.35;
  }
  .pixel-loader__bloom {
    animation: none;
    opacity: 0.3;
  }
}
</style>
