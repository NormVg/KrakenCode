import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance } from 'tippy.js'
import CommandList from './CommandList.vue'
import type { Editor } from '@tiptap/core'

export interface MentionItem {
  title: string
  description: string
  icon: string
  value: string
  command: (props: { editor: Editor; range: any }) => void
}

// These are static context suggestions — in a real impl you'd pull from the file tree
const mentionItems: MentionItem[] = [
  {
    title: 'Current File',
    description: 'Add the active editor file as context',
    icon: 'file',
    value: '@currentFile',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('@currentFile ').run()
    },
  },
  {
    title: 'Current Folder',
    description: 'Add the open project folder as context',
    icon: 'folder',
    value: '@folder',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('@folder ').run()
    },
  },
  {
    title: 'Git Diff',
    description: 'Add current git diff as context',
    icon: 'git-commit',
    value: '@gitDiff',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('@gitDiff ').run()
    },
  },
  {
    title: 'Terminal Output',
    description: 'Add last terminal output as context',
    icon: 'terminal',
    value: '@terminal',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('@terminal ').run()
    },
  },
  {
    title: 'Clipboard',
    description: 'Add clipboard content as context',
    icon: 'clipboard',
    value: '@clipboard',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('@clipboard ').run()
    },
  },
  {
    title: 'Selection',
    description: 'Add current text selection as context',
    icon: 'text-cursor',
    value: '@selection',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('@selection ').run()
    },
  },
]

export const atMentionSuggestion = {
  items: ({ query }: { query: string }): MentionItem[] => {
    if (!query) return mentionItems
    return mentionItems
      .filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 6)
  },

  render: () => {
    let component: VueRenderer
    let popup: Instance | undefined

    return {
      onStart: (props: any) => {
        component = new VueRenderer(CommandList, {
          props: { ...props, mode: 'mention' },
          editor: props.editor as Editor,
        })

        if (!props.clientRect) return

        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element!,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'top-start',
          animation: 'shift-away',
          duration: [120, 80],
        })
      },

      onUpdate(props: any) {
        component.updateProps({ ...props, mode: 'mention' })
        if (!props.clientRect) return
        popup?.setProps({ getReferenceClientRect: props.clientRect })
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup?.hide()
          return true
        }
        return component.ref?.onKeyDown(props.event)
      },

      onExit() {
        popup?.destroy()
        component?.destroy()
      },
    }
  },
}

export const AtMention = Extension.create({
  name: 'atMention',

  addOptions() {
    return {
      suggestion: {
        char: '@',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
