import { defineTool } from 'eve/tools'
import { writeWorkspaceFile } from '../workspace.js'

export default defineTool({
  description: 'Write content to a file in the workspace. Creates the file if it does not exist, or overwrites it if it does. Creates parent directories as needed.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to write to, relative to the workspace root or absolute.'
      },
      content: {
        type: 'string',
        description: 'The full content to write to the file.'
      }
    },
    required: ['path', 'content']
  },
  async execute(input: { path: string; content: string }) {
    try {
      await writeWorkspaceFile(input.path, input.content)
      return { success: true, message: `File written: ${input.path}` }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
})
