import { defineTool } from 'eve/tools'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { resolveWorkspacePath } from '../workspace.js'

export default defineTool({
  description: 'Edit a file by replacing an exact string. The old_string must match exactly one place in the file (unless replace_all is true). To create a new file, set old_string to an empty string. Never use sed/awk — use this tool instead.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to modify, relative to the workspace root or absolute.'
      },
      old_string: {
        type: 'string',
        description: 'The exact text to find in the file. Empty string creates a new file.'
      },
      new_string: {
        type: 'string',
        description: 'The text to replace it with. Must be different from old_string.'
      },
      replace_all: {
        type: 'boolean',
        description: 'Replace all occurrences of old_string. Default: false.',
        default: false
      }
    },
    required: ['path', 'old_string', 'new_string']
  },
  async execute(input: {
    path: string
    old_string: string
    new_string: string
    replace_all?: boolean
  }) {
    try {
      if (input.old_string === input.new_string) {
        return { success: false, error: 'old_string and new_string are the same' }
      }

      const fullPath = resolveWorkspacePath(input.path)

      // Create new file
      if (input.old_string === '') {
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, input.new_string, 'utf-8')
        return { success: true, message: `File created: ${input.path}` }
      }

      // Read existing file
      let content: string
      try {
        content = await readFile(fullPath, 'utf-8')
      } catch {
        return { success: false, error: `File not found: ${input.path}` }
      }

      // Count matches
      const matches = content.split(input.old_string).length - 1
      if (matches === 0) {
        return {
          success: false,
          error: `No matches found for old_string. The file may have been modified — re-read it and try again.`
        }
      }
      if (matches > 1 && !input.replace_all) {
        return {
          success: false,
          error: `Found ${matches} matches for old_string. Add more surrounding lines to make it unique, or set replace_all to true.`
        }
      }

      // Replace
      const newContent = input.replace_all
        ? content.split(input.old_string).join(input.new_string)
        : content.replace(input.old_string, input.new_string)

      await writeFile(fullPath, newContent, 'utf-8')

      // Calculate line diff
      const oldLines = input.old_string.split('\n').length
      const newLines = input.new_string.split('\n').length
      const added = Math.max(0, newLines - oldLines)
      const removed = Math.max(0, oldLines - newLines)

      return {
        success: true,
        message: `Edited ${input.path} (${matches} replacement${matches > 1 ? 's' : ''}, +${added} -${removed} lines)`,
        replacements: matches,
        added,
        removed
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
})
