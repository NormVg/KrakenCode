import { defineTool } from 'eve/tools'
import { listWorkspaceDir } from '../workspace.js'

export default defineTool({
  description: 'List files and directories in a workspace path. Returns items sorted with folders first, then alphabetical. Dot-files are hidden by default.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The directory to list, relative to the workspace root. Default: workspace root.',
        default: '.'
      }
    }
  },
  async execute(input: { path?: string }) {
    try {
      const items = await listWorkspaceDir(input.path ?? '.')
      const formatted = items.map((i) => `${i.type === 'folder' ? '📁' : '📄'} ${i.name}`).join('\n')
      return { success: true, entries: items, formatted }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
})
