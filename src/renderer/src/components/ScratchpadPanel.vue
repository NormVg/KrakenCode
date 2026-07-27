<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onMounted } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Link } from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import SlashCommands from './tiptap/SlashCommands'
import { suggestion } from './tiptap/suggestion'
import { Mic, MicOff } from 'lucide-vue-next'

const content = ref(`
<h2>Scratchpad</h2>
<p>Dump your thoughts, notes, and scratchpad context here...</p>
<ul>
  <li>Type <code>/</code> for a menu to add Headings, Tables, Lists, Images...</li>
  <li>Supports Markdown shortcuts (e.g. <code>#</code>, <code>*</code>, <code>&gt;</code>)</li>
  <li>Drag and drop images directly into this space!</li>
</ul>
`)

const editor = ref<Editor | null>(null)

onMounted(() => {
  editor.value = new Editor({
    content: content.value,
    extensions: [
      StarterKit.configure({ link: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
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
      handleDrop: function(view, event: DragEvent, slice, moved) {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const files = Array.from(event.dataTransfer.files)
          const images = files.filter(file => file.type.startsWith('image/'))

          if (images.length > 0) {
            event.preventDefault()
            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })

            images.forEach(image => {
              const reader = new FileReader()
              reader.onload = (e) => {
                if (e.target?.result && coordinates) {
                  const node = view.state.schema.nodes.image.create({ src: e.target.result })
                  const transaction = view.state.tr.insert(coordinates.pos, node)
                  view.dispatch(transaction)
                }
              }
              reader.readAsDataURL(image)
            })
            return true
          }
        }
        return false
      },
      handlePaste: function(view, event: ClipboardEvent, slice) {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
          const files = Array.from(event.clipboardData.files)
          const images = files.filter(file => file.type.startsWith('image/'))

          if (images.length > 0) {
            event.preventDefault()
            images.forEach(image => {
              const reader = new FileReader()
              reader.onload = (e) => {
                if (e.target?.result) {
                  const node = view.state.schema.nodes.image.create({ src: e.target.result })
                  const transaction = view.state.tr.replaceSelectionWith(node)
                  view.dispatch(transaction)
                }
              }
              reader.readAsDataURL(image)
            })
            return true
          }
        }
        return false
      }
    },
  })

  // Initialize Speech Recognition
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SpeechRecognition) {
    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onstart = () => {
      isListening.value = true
    }

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result: any) => result[0].transcript)
        .join('')

      if (transcript && editor.value) {
        const textToInsert = transcript + ' '
        if (!editor.value.isFocused) {
          // If not focused, append to the end on a new line or just at the very end
          editor.value.chain().focus('end').insertContent(textToInsert).run()
        } else {
          // If focused, insert at cursor
          editor.value.chain().insertContent(textToInsert).run()
        }
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      isListening.value = false
    }

    recognition.onend = () => {
      isListening.value = false
    }
  }
})

const isListening = ref(false)
let recognition: any = null

const toggleListening = () => {
  if (!recognition) {
    alert("Speech recognition is not supported in this environment.")
    return
  }

  if (isListening.value) {
    recognition.stop()
  } else {
    recognition.start()
  }
}

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
  if (recognition && isListening.value) {
    recognition.stop()
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

      <!-- Speech to Text Floating Button -->
      <button
        class="stt-btn"
        :class="{ 'is-listening': isListening }"
        @click="toggleListening"
        :title="isListening ? 'Stop listening' : 'Start dictation'"
      >
        <Mic v-if="!isListening" :size="14" />
        <MicOff v-else :size="14" />
      </button>
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
  position: relative;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* STT Button */
.stt-btn {
  position: absolute;
  bottom: 24px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
}

.stt-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: var(--text-main);
}

.stt-btn.is-listening {
  background: rgba(243, 139, 168, 0.2);
  border-color: rgba(243, 139, 168, 0.4);
  color: #f38ba8;
  animation: pulse-red 1.5s infinite;
}

@keyframes pulse-red {
  0% { box-shadow: 0 0 0 0 rgba(243, 139, 168, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(243, 139, 168, 0); }
  100% { box-shadow: 0 0 0 0 rgba(243, 139, 168, 0); }
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

:deep(.tiptap-editor img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1em 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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

:deep(.tiptap-editor .selectedCell:after) {
  z-index: 2;
  position: absolute;
  content: "";
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(200, 200, 255, 0.2);
  pointer-events: none;
}

:deep(.tiptap-editor .column-resize-handle) {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: -2px;
  width: 4px;
  background-color: #4A90E2;
  pointer-events: none;
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
