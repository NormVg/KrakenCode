<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  FileText,
  Folder,
  Search,
  Terminal,
  FileEdit,
  FilePlus,
  ChevronRight,
  Check,
  X,
  Loader2,
  AlertCircle
} from 'lucide-vue-next'

export interface ToolCall {
  toolCallId: string
  toolName: string
  status: 'running' | 'completed' | 'failed' | 'rejected'
  input?: string
  output?: string
}

const props = defineProps<{
  tool: ToolCall
}>()

const isExpanded = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

// Map tool names to icons and labels
const toolMeta = computed(() => {
  const name = props.tool.toolName
  if (name.includes('read_file') || name.includes('read')) {
    return { icon: FileText, label: 'Read File', color: '#9DA1D3' }
  }
  if (name.includes('list_dir') || name.includes('glob')) {
    return { icon: Folder, label: 'List Files', color: '#9DA1D3' }
  }
  if (name.includes('grep') || name.includes('search')) {
    return { icon: Search, label: 'Search', color: '#5EEAD4' }
  }
  if (name.includes('run_command') || name.includes('bash')) {
    return { icon: Terminal, label: 'Run Command', color: '#FFB84D' }
  }
  if (name.includes('edit_file')) {
    return { icon: FileEdit, label: 'Edit File', color: '#9374BE' }
  }
  if (name.includes('write_file')) {
    return { icon: FilePlus, label: 'Write File', color: '#08C371' }
  }
  return { icon: Terminal, label: name, color: '#9DA1D3' }
})

const statusIcon = computed(() => {
  switch (props.tool.status) {
    case 'running':
      return Loader2
    case 'completed':
      return Check
    case 'failed':
      return AlertCircle
    case 'rejected':
      return X
    default:
      return Loader2
  }
})

const statusColor = computed(() => {
  switch (props.tool.status) {
    case 'running':
      return '#9DA1D3'
    case 'completed':
      return '#08C371'
    case 'failed':
      return '#FF5F5F'
    case 'rejected':
      return '#FFB84D'
    default:
      return '#9DA1D3'
  }
})

// Truncate input for preview
const inputPreview = computed(() => {
  if (!props.tool.input) return ''
  const str = typeof props.tool.input === 'string' ? props.tool.input : JSON.stringify(props.tool.input, null, 2)
  const firstLine = str.split('\n')[0]
  return firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine
})
</script>

<template>
  <div class="tool-call-block">
    <button class="tool-header" @click="toggleExpand">
      <div class="tool-left">
        <component
          :is="toolMeta.icon"
          :size="13"
          :stroke-width="2"
          class="tool-icon"
          :style="{ color: toolMeta.color }"
        />
        <span class="tool-label">{{ toolMeta.label }}</span>
        <span v-if="inputPreview" class="tool-preview">{{ inputPreview }}</span>
      </div>
      <div class="tool-right">
        <component
          :is="statusIcon"
          :size="13"
          :stroke-width="2"
          class="status-icon"
          :class="{ 'spin': tool.status === 'running' }"
          :style="{ color: statusColor }"
        />
        <ChevronRight :size="13" :stroke-width="2" class="chevron" :class="{ 'expanded': isExpanded }" />
      </div>
    </button>

    <Transition name="expand">
      <div v-if="isExpanded" class="tool-details">
        <div v-if="tool.input" class="detail-section">
          <div class="detail-label">Input</div>
          <pre class="detail-content">{{ typeof tool.input === 'string' ? tool.input : JSON.stringify(tool.input, null, 2) }}</pre>
        </div>
        <div v-if="tool.output" class="detail-section">
          <div class="detail-label">Output</div>
          <pre class="detail-content">{{ typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2) }}</pre>
        </div>
        <div v-if="!tool.input && !tool.output && tool.status === 'running'" class="detail-empty">
          Waiting for result...
        </div>
        <div v-if="!tool.input && !tool.output && tool.status !== 'running'" class="detail-empty">
          No data captured for this tool call.
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tool-call-block {
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.015);
  transition: border-color 0.2s;
  margin: 2px 0;
}

.tool-call-block:hover {
  border-color: rgba(255, 255, 255, 0.08);
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s;
  text-align: left;
}

.tool-header:hover {
  background-color: rgba(255, 255, 255, 0.02);
}

.tool-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.tool-icon {
  flex-shrink: 0;
}

.tool-label {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.tool-preview {
  font-size: 0.75rem;
  color: var(--text-muted-dark);
  font-family: var(--font-code);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.tool-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.status-icon {
  flex-shrink: 0;
}

.status-icon.spin {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.chevron {
  color: var(--text-muted-dark);
  transition: transform 0.2s ease;
}

.chevron.expanded {
  transform: rotate(90deg);
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: max-height 0.2s ease, opacity 0.15s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 400px;
  opacity: 1;
}

.tool-details {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted-dark);
  font-weight: 600;
}

.detail-content {
  font-family: var(--font-code);
  font-size: 0.75rem;
  color: var(--text-muted);
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 0;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

.detail-empty {
  font-size: 0.78rem;
  color: var(--text-muted-dark);
  padding: 4px 0;
}
</style>
