import { defineTool } from 'eve/tools'
import { grepWorkspace } from '../workspace.js'

export default defineTool({
  description: 'Search file contents with regular expressions (ripgrep). Pass the pattern as a raw regex string. Respects .gitignore. Output is ripgrep-style: file:line:match. Large results are capped at 20000 chars.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regex pattern to search for. Escape literal special characters.'
      },
      path: {
        type: 'string',
        description: 'The directory to search in, relative to the workspace root. Default: workspace root.',
        default: '.'
      },
      glob: {
        type: 'string',
        description: 'Optional file glob filter (e.g. "*.ts" or "**/*.{js,ts}").'
      },
      contextLines: {
        type: 'integer',
        description: 'Number of context lines before and after each match (0-5). Default: 0.',
        minimum: 0,
        maximum: 5,
        default: 0
      }
    },
    required: ['pattern']
  },
  async execute(input: { pattern: string; path?: string; glob?: string; contextLines?: number }) {
    try {
      const output = await grepWorkspace(
        input.pattern,
        input.path ?? '.',
        input.glob,
        input.contextLines ?? 0
      )
      return { success: true, output }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
})
