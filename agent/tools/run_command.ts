import { defineTool } from 'eve/tools'
import { runWorkspaceCommand } from '../workspace.js'

export default defineTool({
  description: 'Run a shell command in the workspace directory using a persistent shell session. State (cwd, env vars, aliases) persists between calls — so `cd` changes the directory for future commands. Returns stdout, stderr, and exit code. Output is truncated at 20000 characters (head + tail kept). Use this for builds, tests, linters, git, and other system commands. Do NOT use this for file operations — use read_file, write_file, edit_file, grep, or list_dir instead.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to run.'
      },
      timeout: {
        type: 'integer',
        description: 'Timeout in milliseconds. Default: 30000 (30s). Maximum: 120000 (2min).',
        minimum: 1000,
        maximum: 120000,
        default: 30000
      }
    },
    required: ['command']
  },
  async execute(input: { command: string; timeout?: number }) {
    try {
      const result = await runWorkspaceCommand(
        input.command,
        Math.min(input.timeout ?? 30000, 120000)
      )
      const output = []
      if (result.stdout) output.push(`stdout:\n${result.stdout}`)
      if (result.stderr) output.push(`stderr:\n${result.stderr}`)
      output.push(`exit code: ${result.exitCode}`)
      return {
        success: result.exitCode === 0,
        output: output.join('\n\n'),
        exitCode: result.exitCode
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
})
