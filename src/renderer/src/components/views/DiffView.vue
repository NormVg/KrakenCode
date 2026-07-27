<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { diffLines, diffWords, type Change } from 'diff'
import { Columns2, Rows2 } from 'lucide-vue-next'

// ─── Types ───────────────────────────────────────────────────────────────────
interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  oldLineNum: number | null
  newLineNum: number | null
}

interface WordSegment {
  text: string
  type: 'added' | 'removed' | 'unchanged'
}

// ─── State ───────────────────────────────────────────────────────────────────
const viewMode = ref<'split' | 'unified'>('split')

// Mock data — will be replaced by real file diffs from the agent later
const originalCode = ref(`import { createApp } from 'vue'
// fake import to avoid vite scanner
const { createStore } = require('dummy-store')
import App from './App.vue'

const store = createStore({
  state() {
    return { count: 0 }
  }
})

const app = createApp(App)
app.use(store)
app.mount('#app')
`)

const modifiedCode = ref(`import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const pinia = createPinia()

const app = createApp(App)
app.use(pinia)
app.mount('#app')
`)

const fileName = ref('src/main.ts')

// ─── Diff Computation ────────────────────────────────────────────────────────
const diffResult = computed<DiffLine[]>(() => {
  const changes = diffLines(originalCode.value, modifiedCode.value)
  const lines: DiffLine[] = []
  let oldLine = 1
  let newLine = 1

  for (const change of changes) {
    const lineTexts = change.value.replace(/\n$/, '').split('\n')

    for (const text of lineTexts) {
      if (change.added) {
        lines.push({ type: 'added', content: text, oldLineNum: null, newLineNum: newLine++ })
      } else if (change.removed) {
        lines.push({ type: 'removed', content: text, oldLineNum: oldLine++, newLineNum: null })
      } else {
        lines.push({ type: 'unchanged', content: text, oldLineNum: oldLine++, newLineNum: newLine++ })
      }
    }
  }

  return lines
})

// ─── Split View: pair removed/added lines for side-by-side ───────────────────
interface SplitRow {
  left: DiffLine | null
  right: DiffLine | null
}

const splitRows = computed<SplitRow[]>(() => {
  const rows: SplitRow[] = []
  const lines = diffResult.value
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.type === 'unchanged') {
      rows.push({ left: line, right: line })
      i++
    } else if (line.type === 'removed') {
      // Collect consecutive removed lines
      const removedBatch: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'removed') {
        removedBatch.push(lines[i])
        i++
      }
      // Collect consecutive added lines
      const addedBatch: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'added') {
        addedBatch.push(lines[i])
        i++
      }
      // Pair them up
      const maxLen = Math.max(removedBatch.length, addedBatch.length)
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          left: removedBatch[j] ?? null,
          right: addedBatch[j] ?? null,
        })
      }
    } else if (line.type === 'added') {
      rows.push({ left: null, right: line })
      i++
    }
  }

  return rows
})

// ─── Word-level diff for inline highlighting ─────────────────────────────────
function getWordDiff(oldText: string, newText: string): { oldSegments: WordSegment[]; newSegments: WordSegment[] } {
  const changes = diffWords(oldText, newText)
  const oldSegments: WordSegment[] = []
  const newSegments: WordSegment[] = []

  for (const change of changes) {
    if (change.added) {
      newSegments.push({ text: change.value, type: 'added' })
    } else if (change.removed) {
      oldSegments.push({ text: change.value, type: 'removed' })
    } else {
      oldSegments.push({ text: change.value, type: 'unchanged' })
      newSegments.push({ text: change.value, type: 'unchanged' })
    }
  }

  return { oldSegments, newSegments }
}

// ─── Synchronized Scrolling ──────────────────────────────────────────────────
const leftPanelRef = ref<HTMLElement | null>(null)
const rightPanelRef = ref<HTMLElement | null>(null)
let isSyncing = false

function syncScroll(source: 'left' | 'right') {
  if (isSyncing) return
  isSyncing = true

  const from = source === 'left' ? leftPanelRef.value : rightPanelRef.value
  const to = source === 'left' ? rightPanelRef.value : leftPanelRef.value

  if (from && to) {
    to.scrollTop = from.scrollTop
    to.scrollLeft = from.scrollLeft
  }

  requestAnimationFrame(() => { isSyncing = false })
}

// ─── Stats ───────────────────────────────────────────────────────────────────
const stats = computed(() => {
  const added = diffResult.value.filter(l => l.type === 'added').length
  const removed = diffResult.value.filter(l => l.type === 'removed').length
  return { added, removed }
})
</script>

<template>
  <div class="diff-view">
    <!-- Header -->
    <div class="diff-header">
      <div class="diff-file-info">
        <span class="diff-filename">{{ fileName }}</span>
        <div class="diff-stats">
          <span class="stat-added">+{{ stats.added }}</span>
          <span class="stat-removed">−{{ stats.removed }}</span>
        </div>
      </div>

      <div class="diff-controls">
        <button
          class="mode-btn"
          :class="{ active: viewMode === 'split' }"
          @click="viewMode = 'split'"
          title="Side by side"
        >
          <Columns2 :size="14" />
        </button>
        <button
          class="mode-btn"
          :class="{ active: viewMode === 'unified' }"
          @click="viewMode = 'unified'"
          title="Unified"
        >
          <Rows2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Split View -->
    <div v-if="viewMode === 'split'" class="diff-split">
      <div
        class="diff-panel diff-panel-left"
        ref="leftPanelRef"
        @scroll="syncScroll('left')"
      >
        <table class="diff-table">
          <tbody>
            <tr
              v-for="(row, idx) in splitRows"
              :key="'l-' + idx"
              class="diff-row"
              :class="row.left ? `diff-${row.left.type}` : 'diff-empty'"
            >
              <td class="line-num">{{ row.left?.oldLineNum ?? '' }}</td>
              <td class="line-gutter">
                <span v-if="row.left?.type === 'removed'">−</span>
              </td>
              <td class="line-content">
                <template v-if="row.left && row.right && row.left.type === 'removed' && row.right.type === 'added'">
                  <span
                    v-for="(seg, si) in getWordDiff(row.left.content, row.right.content).oldSegments"
                    :key="si"
                    :class="{ 'word-highlight-removed': seg.type === 'removed' }"
                  >{{ seg.text }}</span>
                </template>
                <template v-else>
                  {{ row.left?.content ?? '' }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="diff-divider"></div>

      <div
        class="diff-panel diff-panel-right"
        ref="rightPanelRef"
        @scroll="syncScroll('right')"
      >
        <table class="diff-table">
          <tbody>
            <tr
              v-for="(row, idx) in splitRows"
              :key="'r-' + idx"
              class="diff-row"
              :class="row.right ? `diff-${row.right.type}` : 'diff-empty'"
            >
              <td class="line-num">{{ row.right?.newLineNum ?? '' }}</td>
              <td class="line-gutter">
                <span v-if="row.right?.type === 'added'">+</span>
              </td>
              <td class="line-content">
                <template v-if="row.left && row.right && row.left.type === 'removed' && row.right.type === 'added'">
                  <span
                    v-for="(seg, si) in getWordDiff(row.left.content, row.right.content).newSegments"
                    :key="si"
                    :class="{ 'word-highlight-added': seg.type === 'added' }"
                  >{{ seg.text }}</span>
                </template>
                <template v-else>
                  {{ row.right?.content ?? '' }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Unified View -->
    <div v-else class="diff-unified">
      <table class="diff-table">
        <tbody>
          <tr
            v-for="(line, idx) in diffResult"
            :key="idx"
            class="diff-row"
            :class="`diff-${line.type}`"
          >
            <td class="line-num line-num-old">{{ line.oldLineNum ?? '' }}</td>
            <td class="line-num line-num-new">{{ line.newLineNum ?? '' }}</td>
            <td class="line-gutter">
              <span v-if="line.type === 'added'">+</span>
              <span v-else-if="line.type === 'removed'">−</span>
            </td>
            <td class="line-content">{{ line.content }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.diff-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: transparent;
}

/* ─── Header ──────────────────────────────────────────────────────────────── */
.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.diff-file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  -webkit-app-region: no-drag;
}

.diff-filename {
  font-family: var(--font-code);
  font-size: 13px;
  color: var(--text-main);
  font-weight: 500;
}

.diff-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-code);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.stat-added {
  color: hsl(152, 58%, 44%);
}

.stat-removed {
  color: hsl(0, 65%, 60%);
}

.diff-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted-dark);
  cursor: pointer;
  transition: background-color 0.15s ease-out, color 0.15s ease-out;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.mode-btn:active {
  transform: scale(0.96);
}

.mode-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-main);
}

/* ─── Split Layout ────────────────────────────────────────────────────────── */
.diff-split {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.diff-panel {
  flex: 1;
  overflow: auto;
  min-width: 0;

  /* Hide scrollbar until hover */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.diff-panel:hover {
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.diff-divider {
  width: 1px;
  background: var(--border-color);
  flex-shrink: 0;
}

/* ─── Unified Layout ─────────────────────────────────────────────────────── */
.diff-unified {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

/* ─── Table ───────────────────────────────────────────────────────────────── */
.diff-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: var(--font-code);
  font-size: 13px;
  line-height: 20px;
}

.diff-row {
  transition: background-color 0.1s ease-out;
}

/* ─── Line Numbers ────────────────────────────────────────────────────────── */
.line-num {
  width: 48px;
  min-width: 48px;
  padding: 0 8px;
  text-align: right;
  color: var(--text-muted-dark);
  font-variant-numeric: tabular-nums;
  user-select: none;
  vertical-align: top;
  opacity: 0.6;
}

/* ─── Gutter ──────────────────────────────────────────────────────────────── */
.line-gutter {
  width: 20px;
  min-width: 20px;
  text-align: center;
  user-select: none;
  vertical-align: top;
  font-weight: 600;
}

/* ─── Content ─────────────────────────────────────────────────────────────── */
.line-content {
  padding: 0 16px 0 4px;
  white-space: pre;
  overflow-x: auto;
  vertical-align: top;
}

/* ─── Diff Type Styles ────────────────────────────────────────────────────── */
.diff-added {
  background-color: hsla(152, 60%, 50%, 0.06);
}

.diff-added .line-gutter {
  color: hsl(152, 58%, 44%);
}

.diff-added .line-content {
  color: var(--text-main);
}

.diff-removed {
  background-color: hsla(0, 65%, 55%, 0.06);
}

.diff-removed .line-gutter {
  color: hsl(0, 65%, 60%);
}

.diff-removed .line-content {
  color: var(--text-main);
}

.diff-unchanged .line-content {
  color: var(--text-muted);
}

.diff-empty {
  background-color: rgba(255, 255, 255, 0.015);
}

.diff-empty .line-content::after {
  content: '';
  display: block;
  height: 20px;
}

/* ─── Word-level highlights ───────────────────────────────────────────────── */
.word-highlight-added {
  background-color: hsla(152, 60%, 50%, 0.20);
  border-radius: 2px;
  padding: 1px 0;
}

.word-highlight-removed {
  background-color: hsla(0, 65%, 55%, 0.20);
  border-radius: 2px;
  padding: 1px 0;
}

/* ─── Hover ───────────────────────────────────────────────────────────────── */
.diff-row:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.diff-added:hover {
  background-color: hsla(152, 60%, 50%, 0.10);
}

.diff-removed:hover {
  background-color: hsla(0, 65%, 55%, 0.10);
}
</style>
