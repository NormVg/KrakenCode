<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onMounted } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Link from '@tiptap/extension-link'
import SlashCommands from './tiptap/SlashCommands'
import { suggestion } from './tiptap/suggestion'

const content = ref(`
<h2>Scratchpad</h2>
<p>Dump your thoughts, notes, and scratchpad context here...</p>
<ul>
  <li>Supports Markdown shortcuts (e.g. <code>#</code>, <code>*</code>, <code>&gt;</code>)</li>
  <li>Rich text formatting</li>
</ul>
`)

const editor = ref<Editor | null>(null)

onMounted(() => {
  editor.value = new Editor({
    content: content.value,
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
      SlashCommands.configure({
        suggestion,
      }),
    ],
    onUpdate: ({ editor }) => {
      content.value = editor.getHTML()
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  })
})

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})
</script>

<template>
  <div class="scratchpad-panel">
    <div class="panel-header">
      <h3>Scratchpad</h3>
    </div>
    
    <div class="scratchpad-content">
      <editor-content :editor="editor" class="editor-container" />
    </div>
  </div>
</template>

<style scoped>
.scratchpad-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 16px 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.scratchpad-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;
  min-height: 0; /* Important for scrollable flex children */
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Global styles for Tiptap editor since it creates DOM outside the scoped template somewhat or inside the wrapper */
:deep(.tiptap-editor) {
  flex: 1;
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: var(--text-main);
  padding: 16px;
  font-size: 0.9em;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s ease;
  overflow-y: auto;
  line-height: 1.6;
}

:deep(.tiptap-editor:focus) {
  border-color: rgba(255, 255, 255, 0.15);
}

:deep(.tiptap-editor p) {
  margin-top: 0;
  margin-bottom: 1em;
}

:deep(.tiptap-editor p:last-child) {
  margin-bottom: 0;
}

:deep(.tiptap-editor h1),
:deep(.tiptap-editor h2),
:deep(.tiptap-editor h3),
:deep(.tiptap-editor h4) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.2;
}

:deep(.tiptap-editor h1:first-child),
:deep(.tiptap-editor h2:first-child),
:deep(.tiptap-editor h3:first-child),
:deep(.tiptap-editor h4:first-child) {
  margin-top: 0;
}

:deep(.tiptap-editor h1) { font-size: 1.5em; }
:deep(.tiptap-editor h2) { font-size: 1.3em; }
:deep(.tiptap-editor h3) { font-size: 1.1em; }

:deep(.tiptap-editor ul),
:deep(.tiptap-editor ol) {
  margin-top: 0;
  margin-bottom: 1em;
  padding-left: 24px;
}

:deep(.tiptap-editor li) {
  margin-bottom: 0.25em;
}

:deep(.tiptap-editor code) {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}

:deep(.tiptap-editor pre) {
  background: #1e1e2e;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 1em;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

:deep(.tiptap-editor pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: 0.9em;
}

:deep(.tiptap-editor blockquote) {
  border-left: 3px solid rgba(255, 255, 255, 0.2);
  margin: 0 0 1em 0;
  padding-left: 1em;
  color: var(--text-muted);
}

:deep(.tiptap-editor table) {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: 0;
  overflow: hidden;
}

:deep(.tiptap-editor td),
:deep(.tiptap-editor th) {
  min-width: 1em;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 3px 5px;
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
}

:deep(.tiptap-editor th) {
  font-weight: bold;
  text-align: left;
  background-color: rgba(255, 255, 255, 0.05);
}

:deep(.tiptap-editor a) {
  color: #4A90E2;
  text-decoration: none;
  cursor: pointer;
}

:deep(.tiptap-editor a:hover) {
  text-decoration: underline;
}
</style>
