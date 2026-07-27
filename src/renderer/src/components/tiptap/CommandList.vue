<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
  command: {
    type: Function,
    required: true,
  },
})

const selectedIndex = ref(0)

watch(() => props.items, () => {
  selectedIndex.value = 0
})

const selectItem = (index: number) => {
  const item = props.items[index]
  if (item) {
    props.command(item)
  }
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

defineExpose({
  onKeyDown,
})
</script>

<template>
  <div class="items">
    <template v-if="items.length">
      <button
        class="item"
        :class="{ 'is-selected': index === selectedIndex }"
        v-for="(item, index) in items"
        :key="index"
        @click="selectItem(index)"
      >
        {{ (item as any).title }}
      </button>
    </template>
    <div class="item" v-else>
      No result
    </div>
  </div>
</template>

<style scoped>
.items {
  padding: 0.2rem;
  position: relative;
  border-radius: 8px;
  background: var(--bg-panel, #1e1e2e);
  color: var(--text-main, #fff);
  overflow: hidden;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
}

.item {
  display: block;
  margin: 0;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.1s ease;
}

.item.is-selected,
.item:hover {
  color: var(--text-main);
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
