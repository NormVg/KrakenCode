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
import { Plus, Mic } from 'lucide-vue-next'
import ModelSelector from './ModelSelector.vue'
import CommandList from './tiptap/CommandList.vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': []
}>()

const suggestionState = ref({
  isOpen: false,
  items: [],
  command: null as any,
  mode: 'slash' as 'slash' | 'mention'
})

const commandListRef = ref()

const handleSuggestionState = (mode: 'slash' | 'mention') => {
  return {
    onStart: (props: any) => {
      suggestionState.value = {
        isOpen: true,
        items: props.items,
        command: props.command,
        mode
      }
    },
    onUpdate: (props: any) => {
      suggestionState.value.items = props.items
      suggestionState.value.command = props.command
    },
    onKeyDown: (props: any) => {
      if (props.event.key === 'Escape') {
        suggestionState.value.isOpen = false
        return true
      }
      return commandListRef.value?.onKeyDown(props.event) ?? false
    },
    onExit: () => {
      suggestionState.value.isOpen = false
    }
  }
}

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
      suggestion: {
        ...slashSuggestion,
        render: () => handleSuggestionState('slash')
      },
    }),
    AtMention.configure({
      suggestion: {
        ...atMentionSuggestion,
        render: () => handleSuggestionState('mention')
      },
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
  <div class="chat-input-wrapper">
    <!-- Sliding Action Drawer (Now houses CommandList natively) -->
    <div class="actions-drawer" :class="{ 'is-open': suggestionState.isOpen }">
      <div class="drawer-content">
        <CommandList 
          v-if="suggestionState.isOpen"
          ref="commandListRef"
          :items="suggestionState.items"
          :command="suggestionState.command"
          :mode="suggestionState.mode"
        />
      </div>
    </div>

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

/* Sliding Drawer Styles */
.actions-drawer {
  position: absolute;
  bottom: 100%;
  left: 6px;
  right: 6px;
  background-color: var(--bg-dark);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  padding: 0;
  margin-bottom: -12px; /* Hide bottom padding behind input container */
  z-index: -1;
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
  transform: translateY(100%);
  opacity: 0;
  pointer-events: none;
  max-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.actions-drawer.is-open {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 16px; /* Space for the overlap with input */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.drawer-content::-webkit-scrollbar {
  width: 6px;
}
.drawer-content::-webkit-scrollbar-track {
  background: transparent;
}
.drawer-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

/* CommandList styling override for drawer */
:deep(.command-list) {
  background: transparent;
  box-shadow: none;
  border: none;
  padding: 8px;
}
</style>
