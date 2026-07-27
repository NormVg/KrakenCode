<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
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
import { Plus, Mic } from 'lucide-vue-next'
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

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="chat-input-container" :class="{ focused: isFocused, disabled }">
    <!-- Tiptap Editor Area -->
    <EditorContent :editor="editor" class="editor-wrapper" />

    <!-- Toolbar -->
    <div class="composer-toolbar">
      <div class="toolbar-left">
        <button class="add-btn" title="Attach file">
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
</template>

<style scoped>
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
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: var(--text-muted);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
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
</style>
