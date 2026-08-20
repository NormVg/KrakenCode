import { defineTool } from 'eve/tools'
import { readWorkspaceFile } from '../workspace.js'

export default defineTool({
  description: 'Read a file from the workspace. Returns content with line-number anchors (LINE_NUMBER→CONTENT) on the first line and every 10th line. Use offset and limit for large files.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to read, relative to the workspace root or absolute.'
      },
      offset: {
        type: 'integer',
        description: 'Line number to start reading from (1-based). Default: 1.',
        minimum: 1
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of lines to read. Default: 2000.',
        minimum: 1,
        maximum: 5000
      }
    },
    required: ['path']
  },
  async execute(input: { path: string; offset?: number; limit?: number }) {
    try {
      const content = await readWorkspaceFile(
        input.path,
        input.offset ?? 1,
        input.limit ?? 2000
      )
      return { success: true, content }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
})
