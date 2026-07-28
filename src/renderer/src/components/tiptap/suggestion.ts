import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance } from 'tippy.js'
import CommandList from './CommandList.vue'
import type { Editor } from '@tiptap/core'

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (props: { editor: Editor; range: any }) => void
}

const commands: SlashCommandItem[] = [
  {
    title: 'Plan',
    description: 'Ask the agent to plan a task',
    icon: 'map',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Plan: ').run()
    },
  },
  {
    title: 'Build',
    description: 'Ask the agent to build something',
    icon: 'hammer',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Build: ').run()
    },
  },
  {
    title: 'Fix',
    description: 'Ask the agent to fix a bug',
    icon: 'wrench',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Fix: ').run()
    },
  },
  {
    title: 'Explain',
    description: 'Ask the agent to explain code',
    icon: 'book-open',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Explain: ').run()
    },
  },
  {
    title: 'Review',
    description: 'Ask the agent to review code',
    icon: 'eye',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Review: ').run()
    },
  },
  {
    title: 'Refactor',
    description: 'Ask the agent to refactor code',
    icon: 'git-branch',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Refactor: ').run()
    },
  },
  {
    title: 'Test',
    description: 'Ask the agent to write tests',
    icon: 'check-circle',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Write tests for: ').run()
    },
  },
  {
    title: 'Document',
    description: 'Ask the agent to write docs',
    icon: 'file-text',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Document: ').run()
    },
  },
  {
    title: 'Optimize',
    description: 'Ask the agent to optimize code',
    icon: 'zap',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Optimize: ').run()
    },
  },
  {
    title: 'Debug',
    description: 'Ask the agent to debug an issue',
    icon: 'bug',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('Debug: ').run()
    },
  },
  {
    title: 'Architecture',
    description: 'Design or update the Mermaid system diagram',
    icon: 'network',
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(
          'Update the project architecture diagram (Mermaid) for: ',
        )
        .run()
    },
  },
]

export const slashSuggestion = {
  items: ({ query }: { query: string }): SlashCommandItem[] => {
    if (!query) return commands
    return commands
      .filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8)
  },

  render: () => {
    let component: VueRenderer
    let popup: Instance | undefined

    return {
      onStart: (props: any) => {
        component = new VueRenderer(CommandList, {
          props: { ...props, mode: 'slash' },
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
        component.updateProps({ ...props, mode: 'slash' })
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
