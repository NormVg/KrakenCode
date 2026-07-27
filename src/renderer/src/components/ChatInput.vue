<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import History from '@tiptap/extension-history'
import HardBreak from '@tiptap/extension-hard-break'
import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommands } from './tiptap/SlashCommands'
import { slashSuggestion } from './tiptap/suggestion'
import { AtMention, atMentionSuggestion } from './tiptap/AtMention'
import { Plus, Mic, FileText, Code, Wrench, File, Terminal, Zap, Folder, Sparkles, X } from 'lucide-vue-next'
import ModelSelector from './ModelSelector.vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': []
}>()

// Tiptap editor — plain text, no markdown rendering, just raw input
const editor = useEditor({
  extensions: [
    Document,
    Paragraph,
    Text,
    History,
    HardBreak,
    Placeholder.configure({
      placeholder: props.placeholder ?? 'Plan, Build, / for skills, @ for context',
      showOnlyCurrent: true,
    }),
    SlashCommands.configure({
      suggestion: slashSuggestion,
    }),
    AtMention.configure({
      suggestion: atMentionSuggestion,
    }),
  ],
  editable: !props.disabled,
  content: props.modelValue ? `<p>${props.modelValue}</p>` : '',
  editorProps: {
    attributes: {
      class: 'tiptap-editor-content',
      spellcheck: 'true',
    },
    handleKeyDown: (_view, event) => {
      // Enter without shift = submit
      if (event.key === 'Enter' && !event.shiftKey) {
        // Don't submit if a suggestion popup is open
        const hasSuggestion = document.querySelector('.tippy-box')
        if (hasSuggestion) return false
        event.preventDefault()
        handleSubmit()
        return true
      }
      return false
    },
  },
  onUpdate: ({ editor: e }) => {
    // Emit raw plain text (raw markdown as-is, no HTML stripping)
    emit('update:modelValue', e.getText())
  },
})

const handleSubmit = () => {
  if (!editor.value) return
  const text = editor.value.getText().trim()
  if (!text) return
  emit('submit')
  // Clear the editor after submit
  editor.value.commands.clearContent(true)
}

const isFocused = computed(() => editor.value?.isFocused ?? false)

const isDrawerOpen = ref(false)
const toggleDrawer = () => {
  isDrawerOpen.value = !isDrawerOpen.value
}

const insertTextAtCursor = (text: string) => {
  if (!editor.value) return
  // If the editor is focused, insert at current selection, otherwise insert at end
  editor.value.chain().focus().insertContent(text + ' ').run()
  isDrawerOpen.value = false
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="chat-input-wrapper">
    <!-- Backdrop to close drawer when clicking outside -->
    <div class="drawer-backdrop" v-if="isDrawerOpen" @click="isDrawerOpen = false"></div>

    <!-- Expanding Command Space -->
    <div class="actions-drawer" :class="{ 'is-open': isDrawerOpen }">
      <div class="drawer-header">
        <h3>Command Space</h3>
        <button class="close-btn" @click="isDrawerOpen = false">
          <X :size="16" />
        </button>
      </div>

      <div class="drawer-content-grid">
        <!-- Agent Actions Section -->
        <div class="command-section">
          <h4>Agent Actions</h4>
          <div class="command-grid">
            <button class="action-card" @click="insertTextAtCursor('/plan')">
              <div class="icon-wrapper plan-icon"><FileText :size="16" /></div>
              <div class="card-text">
                <span class="card-title">Plan</span>
                <span class="card-desc">Create a structured plan</span>
              </div>
            </button>
            <button class="action-card" @click="insertTextAtCursor('/build')">
              <div class="icon-wrapper build-icon"><Code :size="16" /></div>
              <div class="card-text">
                <span class="card-title">Build</span>
                <span class="card-desc">Write new code features</span>
              </div>
            </button>
            <button class="action-card" @click="insertTextAtCursor('/fix')">
              <div class="icon-wrapper fix-icon"><Wrench :size="16" /></div>
              <div class="card-text">
                <span class="card-title">Fix</span>
                <span class="card-desc">Debug and resolve errors</span>
              </div>
            </button>
            <button class="action-card" @click="insertTextAtCursor('/explain')">
              <div class="icon-wrapper explain-icon"><Sparkles :size="16" /></div>
              <div class="card-text">
                <span class="card-title">Explain</span>
                <span class="card-desc">Break down how code works</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Context Mentions Section -->
        <div class="command-section">
          <h4>Context Mentions</h4>
          <div class="command-grid">
            <button class="action-card" @click="insertTextAtCursor('@file')">
              <div class="icon-wrapper context-icon"><File :size="16" /></div>
              <div class="card-text">
                <span class="card-title">File</span>
                <span class="card-desc">Reference a specific file</span>
              </div>
            </button>
            <button class="action-card" @click="insertTextAtCursor('@folder')">
              <div class="icon-wrapper context-icon"><Folder :size="16" /></div>
              <div class="card-text">
                <span class="card-title">Folder</span>
                <span class="card-desc">Include entire directories</span>
              </div>
            </button>
            <button class="action-card" @click="insertTextAtCursor('@terminal')">
              <div class="icon-wrapper context-icon"><Terminal :size="16" /></div>
              <div class="card-text">
                <span class="card-title">Terminal</span>
                <span class="card-desc">Attach recent shell output</span>
              </div>
            </button>
            <button class="action-card" @click="insertTextAtCursor('@git')">
              <div class="icon-wrapper context-icon"><Zap :size="16" /></div>
              <div class="card-text">
                <span class="card-title">Git Diff</span>
                <span class="card-desc">Add uncommitted changes</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input-container" :class="{ focused: isFocused, disabled }">
      <!-- Tiptap Editor Area -->
      <EditorContent :editor="editor" class="editor-wrapper" />

      <!-- Toolbar -->
      <div class="composer-toolbar">
        <div class="toolbar-left">
          <button class="add-btn" title="Quick Actions" :class="{ active: isDrawerOpen }" @click="toggleDrawer">
            <Plus :size="14" />
          </button>
          <ModelSelector />
        </div>
        <div class="toolbar-right">
          <button class="mic-btn" title="Voice input">
            <Mic :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-input-wrapper {
  position: relative;
  width: 100%;
  z-index: 10;
}

.chat-input-container {
  width: 100%;
  background-color: var(--bg-dark); /* #0A0D18 */
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.chat-input-container.focused {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4);
}

.chat-input-container.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.editor-wrapper {
  box-sizing: border-box;
  padding: 12px 16px 4px;
  max-height: 204px; /* ~8 lines */
  overflow-y: auto;
  scrollbar-width: none;
  cursor: text;
}

.editor-wrapper::-webkit-scrollbar {
  display: none;
}

/* Tiptap inner editor */
:deep(.tiptap-editor-content) {
  outline: none;
  font-size: 0.95em;
  line-height: 1.5;
  color: var(--text-main);
  font-family: var(--font-primary);
  caret-color: var(--text-main);
  word-break: break-word;
  white-space: pre-wrap;
}

:deep(.tiptap-editor-content p) {
  margin: 0;
  padding: 0;
}

/* Placeholder */
:deep(.tiptap-editor-content p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: rgba(255, 255, 255, 0.25);
  pointer-events: none;
  float: left;
  height: 0;
}

/* Selection */
:deep(.tiptap-editor-content ::selection) {
  background: rgba(170, 32, 90, 0.3);
}

.composer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.add-btn {
  background: transparent;
  border: none;
  color: var(--text-main);
  opacity: 0.6;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.add-btn:hover {
}


.mic-btn {
  background: #fff;
  border: none;
  color: #000;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease-out;
  flex-shrink: 0;
}

.mic-btn:hover {
  transform: scale(1.05);
}

.mic-btn:active {
  transform: scale(0.96);
}

/* Backdrop */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: -2;
}

/* Sliding Command Space Styles */
.actions-drawer {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background-color: var(--bg-dark);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 8px; /* Float slightly above input container */
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.03);
  backdrop-filter: blur(20px);
  z-index: -1;
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
  transform: translateY(20px) scale(0.98);
  opacity: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.actions-drawer.is-open {
  transform: translateY(0) scale(1);
  opacity: 1;
  pointer-events: auto;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.drawer-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
  letter-spacing: 0.02em;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}

.drawer-content-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.command-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.command-section h4 {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 600;
  padding-left: 2px;
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.action-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.action-card:active {
  transform: translateY(0);
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

.plan-icon { background: rgba(59, 130, 246, 0.15); color: #60A5FA; }
.build-icon { background: rgba(16, 185, 129, 0.15); color: #34D399; }
.fix-icon { background: rgba(245, 158, 11, 0.15); color: #FBBF24; }
.explain-icon { background: rgba(168, 85, 247, 0.15); color: #C084FC; }
.context-icon { background: rgba(255, 255, 255, 0.08); color: #E2E8F0; }

.card-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
}

.card-desc {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
}
</style>
