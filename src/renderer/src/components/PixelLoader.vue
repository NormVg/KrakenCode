<script setup lang="ts">
/**
 * PixelLoader — universal 3x3 grid loader.
 *
 * Each variant has a distinct color and animation pattern so the user
 * can tell what kind of work is happening at a glance:
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
 *   <PixelLoader variant="reading" :size="4" />
 */

export type LoaderVariant =
  | 'thinking'
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
  size: 3
})

/**
 * Per-square animation delay (ms) for each variant.
 * Index 0-8 maps to grid positions:
 *
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
const DELAYS: Record<LoaderVariant, number[]> = {
  // Center first, then diamond, then corners — like a brain pulsing
  thinking:  [300, 150, 300, 150, 0,   150, 300, 150, 300],
  // Row-by-row, left to right — like scanning text
  reading:   [0,   100, 200, 300, 400, 500, 600, 700, 800],
  // Bottom-up, left to right — like filling a container
  writing:   [600, 700, 800, 300, 400, 500, 0,   100, 200],
  // Top-down, all columns at once — like a waterfall
  executing: [0,   0,   0,   150, 150, 150, 300, 300, 300],
  // Center out in expanding rings — like sonar
  searching: [400, 200, 400, 200, 0,   200, 400, 200, 400],
  // All together — slow breathing
  idle:      [0,   0,   0,   0,   0,   0,   0,   0,   0]
}

/** Total animation duration per variant (ms) */
const DURATION: Record<LoaderVariant, number> = {
  thinking:  1200,
  reading:   900,
  writing:   1000,
  executing: 700,
  searching: 1400,
  idle:      2500
}

const squares = Array.from({ length: 9 }, (_, i) => i)

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
      '--sq-gap': `${Math.max(1, Math.round(size * 0.6))}px`,
      '--anim-duration': durationFor()
    }"
    role="status"
    :aria-label="`Loading: ${variant}`"
  >
    <div
      v-for="i in squares"
      :key="i"
      class="pixel-loader__square"
      :style="{ '--anim-delay': delayFor(i) }"
    />
  </div>
</template>

<style scoped>
.pixel-loader {
  display: grid;
  grid-template-columns: repeat(3, var(--sq-size));
  grid-template-rows: repeat(3, var(--sq-size));
  gap: var(--sq-gap);
  contain: strict;
}

.pixel-loader__square {
  width: var(--sq-size);
  height: var(--sq-size);
  border-radius: 1px;
  opacity: 0.12;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  animation-duration: var(--anim-duration);
  animation-delay: var(--anim-delay);
  will-change: opacity, transform, filter;
}

/* ── Bloom: each square glows with its variant color ──────────── */
/* The glow intensity is driven by the keyframe opacity, so the bloom
   breathes in sync with the square. We keep blur at 4px per AGENTS.md
   performance rules (cap blurs at 4-8px). */
.pixel-loader--thinking .pixel-loader__square {
  background: #9374BE;
  box-shadow: 0 0 4px 1px rgba(147, 116, 190, 0.6);
  animation-name: px-thinking;
}
@keyframes px-thinking {
  0%   { opacity: 0.12; transform: scale(0.8); box-shadow: 0 0 2px 0px rgba(147, 116, 190, 0.2); }
  40%  { opacity: 1;     transform: scale(1);   box-shadow: 0 0 6px 2px rgba(147, 116, 190, 0.8); }
  60%  { opacity: 1;     transform: scale(1);   box-shadow: 0 0 6px 2px rgba(147, 116, 190, 0.8); }
  100% { opacity: 0.12; transform: scale(0.8); box-shadow: 0 0 2px 0px rgba(147, 116, 190, 0.2); }
}

/* ── reading: blue row scan ──────────────────────────────────── */
.pixel-loader--reading .pixel-loader__square {
  background: #5B8DEF;
  box-shadow: 0 0 4px 1px rgba(91, 141, 239, 0.5);
  animation-name: px-reading;
  animation-timing-function: ease;
}
@keyframes px-reading {
  0%   { opacity: 0.1;  box-shadow: 0 0 2px 0px rgba(91, 141, 239, 0.15); }
  30%  { opacity: 1;    box-shadow: 0 0 6px 2px rgba(91, 141, 239, 0.7);  }
  60%  { opacity: 0.3;  box-shadow: 0 0 3px 1px rgba(91, 141, 239, 0.3);  }
  100% { opacity: 0.1;  box-shadow: 0 0 2px 0px rgba(91, 141, 239, 0.15); }
}

/* ── writing: green bottom-up fill ───────────────────────────── */
.pixel-loader--writing .pixel-loader__square {
  background: #08C371;
  box-shadow: 0 0 4px 1px rgba(8, 195, 113, 0.5);
  animation-name: px-writing;
}
@keyframes px-writing {
  0%   { opacity: 0.08; transform: scaleY(0.6); box-shadow: 0 0 2px 0px rgba(8, 195, 113, 0.15); }
  35%  { opacity: 1;     transform: scaleY(1);   box-shadow: 0 0 6px 2px rgba(8, 195, 113, 0.7);  }
  65%  { opacity: 0.8;   transform: scaleY(1);   box-shadow: 0 0 4px 1px rgba(8, 195, 113, 0.4);  }
  100% { opacity: 0.08; transform: scaleY(0.6); box-shadow: 0 0 2px 0px rgba(8, 195, 113, 0.15); }
}

/* ── executing: amber cascade waterfall ──────────────────────── */
.pixel-loader--executing .pixel-loader__square {
  background: #F5A623;
  box-shadow: 0 0 4px 1px rgba(245, 166, 35, 0.5);
  animation-name: px-executing;
  animation-timing-function: linear;
}
@keyframes px-executing {
  0%   { opacity: 0.1;  transform: translateY(-1.5px); box-shadow: 0 0 2px 0px rgba(245, 166, 35, 0.15); }
  25%  { opacity: 1;    transform: translateY(0);       box-shadow: 0 0 6px 2px rgba(245, 166, 35, 0.7);  }
  75%  { opacity: 0.5;  transform: translateY(1.5px);   box-shadow: 0 0 3px 1px rgba(245, 166, 35, 0.3);  }
  100% { opacity: 0.1;  transform: translateY(-1.5px); box-shadow: 0 0 2px 0px rgba(245, 166, 35, 0.15); }
}

/* ── searching: cyan sonar ripple ────────────────────────────── */
.pixel-loader--searching .pixel-loader__square {
  background: #22D3EE;
  box-shadow: 0 0 4px 1px rgba(34, 211, 238, 0.5);
  animation-name: px-searching;
  animation-timing-function: ease-out;
}
@keyframes px-searching {
  0%   { opacity: 0.08; transform: scale(0.5); box-shadow: 0 0 2px 0px rgba(34, 211, 238, 0.15); }
  30%  { opacity: 1;    transform: scale(1.1); box-shadow: 0 0 8px 3px rgba(34, 211, 238, 0.8);  }
  100% { opacity: 0.08; transform: scale(0.5); box-shadow: 0 0 2px 0px rgba(34, 211, 238, 0.15); }
}

/* ── idle: muted slow breathe ────────────────────────────────── */
.pixel-loader--idle .pixel-loader__square {
  background: #71738E;
  box-shadow: 0 0 3px 1px rgba(113, 115, 142, 0.3);
  animation-name: px-idle;
}
@keyframes px-idle {
  0%   { opacity: 0.08; box-shadow: 0 0 2px 0px rgba(113, 115, 142, 0.1);  }
  50%  { opacity: 0.35; box-shadow: 0 0 4px 1px rgba(113, 115, 142, 0.3);  }
  100% { opacity: 0.08; box-shadow: 0 0 2px 0px rgba(113, 115, 142, 0.1);  }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .pixel-loader__square {
    animation: none;
    opacity: 0.3;
    box-shadow: 0 0 3px 1px currentColor;
  }
}
</style>
