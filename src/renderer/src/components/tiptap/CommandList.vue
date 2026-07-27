<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  items: Array<{ title: string; description?: string; icon?: string }>
  command: (item: any) => void
  mode?: 'slash' | 'mention'
}>()

const selectedIndex = ref(0)

watch(() => props.items, () => {
  selectedIndex.value = 0
})

const selectItem = (index: number) => {
  const item = props.items[index]
  if (item) props.command(item)
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowUp') {
    selectedIndex.value = ((selectedIndex.value + props.items.length) - 1) % props.items.length
    return true
  }
  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length
    return true
  }
  if (event.key === 'Enter') {
    selectItem(selectedIndex.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div class="command-list">
    <div class="command-list-header">
      {{ mode === 'mention' ? 'Add Context' : 'Commands' }}
    </div>
    <template v-if="items.length">
      <button
        class="command-item"
        :class="{ 'is-selected': index === selectedIndex }"
        v-for="(item, index) in items"
        :key="index"
        @click="selectItem(index)"
        @mouseenter="selectedIndex = index"
      >
        <span class="command-item-icon">
          <!-- Generic icon from icon name string -->
          <svg v-if="item.icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- map -->
            <template v-if="item.icon === 'map'">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
            </template>
            <!-- hammer -->
            <template v-else-if="item.icon === 'hammer'">
              <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 5.6a5.009 5.009 0 0 0-6.22.28 5.009 5.009 0 0 0 .28 6.22l1.25 1.25c.6.6 1.4.93 2.25.93h.86l1.79 1.79"/>
            </template>
            <!-- wrench -->
            <template v-else-if="item.icon === 'wrench'">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </template>
            <!-- book-open -->
            <template v-else-if="item.icon === 'book-open'">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </template>
            <!-- eye -->
            <template v-else-if="item.icon === 'eye'">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </template>
            <!-- git-branch -->
            <template v-else-if="item.icon === 'git-branch'">
              <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
            </template>
            <!-- check-circle -->
            <template v-else-if="item.icon === 'check-circle'">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </template>
            <!-- file-text -->
            <template v-else-if="item.icon === 'file-text'">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </template>
            <!-- zap -->
            <template v-else-if="item.icon === 'zap'">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </template>
            <!-- bug -->
            <template v-else-if="item.icon === 'bug'">
              <rect x="8" y="6" width="8" height="14" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/><path d="m10 4 1 2"/><path d="m14 4-1 2"/>
            </template>
            <!-- file -->
            <template v-else-if="item.icon === 'file'">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
            </template>
            <!-- folder -->
            <template v-else-if="item.icon === 'folder'">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </template>
            <!-- git-commit -->
            <template v-else-if="item.icon === 'git-commit'">
              <circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>
            </template>
            <!-- terminal -->
            <template v-else-if="item.icon === 'terminal'">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </template>
            <!-- clipboard -->
            <template v-else-if="item.icon === 'clipboard'">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </template>
            <!-- text-cursor -->
            <template v-else-if="item.icon === 'text-cursor'">
              <path d="M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1"/><path d="M7 22h1a4 4 0 0 0 4-4v-1"/><path d="M7 2h1a4 4 0 0 1 4 4v1"/>
            </template>
            <!-- default slash -->
            <template v-else>
              <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
            </template>
          </svg>
        </span>
        <span class="command-item-text">
          <span class="command-item-title">{{ item.title }}</span>
          <span v-if="item.description" class="command-item-desc">{{ item.description }}</span>
        </span>
      </button>
    </template>
    <div class="command-item command-item-empty" v-else>
      No results
    </div>
  </div>
</template>

<style scoped>
.command-list {
  padding: 4px;
  border-radius: 10px;
  background: #141420;
  color: var(--text-main, #e2e8f0);
  font-size: 0.82rem;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.08),
    0 8px 32px rgba(0,0,0,0.6),
    0 2px 8px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 220px;
  max-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: none;
}

.command-list::-webkit-scrollbar {
  display: none;
}

.command-list-header {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  padding: 4px 8px 6px;
  user-select: none;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 7px 8px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.command-item:hover,
.command-item.is-selected {
  background: rgba(255,255,255,0.07);
}

.command-item.is-selected .command-item-icon {
  color: var(--accent-magenta, #AA205A);
}

.command-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.35);
  flex-shrink: 0;
  transition: color 0.1s ease;
  width: 16px;
}

.command-item-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.command-item-title {
  color: rgba(255,255,255,0.85);
  font-weight: 500;
  font-size: 0.82rem;
  white-space: nowrap;
}

.command-item-desc {
  color: rgba(255,255,255,0.3);
  font-size: 0.72rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-item-empty {
  color: rgba(255,255,255,0.25);
  font-size: 0.8rem;
  justify-content: center;
  cursor: default;
}
</style>
