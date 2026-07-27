import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance } from 'tippy.js'
import CommandList from './CommandList.vue'
import { Editor } from '@tiptap/core'

export const suggestion = {
  items: ({ query }: { query: string }) => {
    return [
      {
        title: 'Heading 1',
        icon: 'Type',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
        },
      },
      {
        title: 'Heading 2',
        icon: 'Type',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
        },
      },
      {
        title: 'Heading 3',
        icon: 'Type',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
        },
      },
      {
        title: 'Bullet List',
        icon: 'List',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run()
        },
      },
      {
        title: 'Numbered List',
        icon: 'ListOrdered',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run()
        },
      },
      {
        title: 'Blockquote',
        icon: 'Quote',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setBlockquote().run()
        },
      },
      {
        title: 'Code Block',
        icon: 'Code',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setCodeBlock().run()
        },
      },
      {
        title: 'Table',
        icon: 'Table',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        },
      },
      {
        title: 'Add Row Above',
        icon: 'ArrowUp',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).addRowBefore().run()
        },
      },
      {
        title: 'Add Row Below',
        icon: 'ArrowDown',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).addRowAfter().run()
        },
      },
      {
        title: 'Add Column Before',
        icon: 'ArrowLeft',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).addColumnBefore().run()
        },
      },
      {
        title: 'Add Column After',
        icon: 'ArrowRight',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).addColumnAfter().run()
        },
      },
      {
        title: 'Image',
        icon: 'Image',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).run()
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.onchange = () => {
            if (input.files && input.files[0]) {
              const reader = new FileReader()
              reader.onload = (e) => {
                if (e.target?.result) {
                  editor.chain().focus().setImage({ src: e.target.result as string }).run()
                }
              }
              reader.readAsDataURL(input.files[0])
            }
          }
          input.click()
        },
      },
      {
        title: 'Delete Row',
        icon: 'Trash2',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).deleteRow().run()
        },
      },
      {
        title: 'Delete Column',
        icon: 'Trash2',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).deleteColumn().run()
        },
      },
      {
        title: 'Delete Table',
        icon: 'Trash2',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).deleteTable().run()
        },
      }
    ].filter(item => item.title.toLowerCase().includes(query.toLowerCase())).slice(0, 15)
  },

  render: () => {
    let component: VueRenderer
    let popup: Instance | undefined

    return {
      onStart: (props: any) => {
        component = new VueRenderer(CommandList, {
          props,
          editor: props.editor as Editor,
        })

        if (!props.clientRect) {
          return
        }

        const element = component.element
        if (!element) {
          return
        }

        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },

      onUpdate(props: any) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup?.setProps({
          getReferenceClientRect: props.clientRect,
        })
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
