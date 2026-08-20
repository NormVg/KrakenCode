import { disableTool } from 'eve/tools'

/**
 * Disable the framework's built-in `bash` tool.
 *
 * The framework `bash` tool runs inside a sandboxed environment, not the
 * real workspace. Our custom `run_command` tool executes commands directly
 * in the workspace directory via KRAKEN_WORKSPACE_PATH, so we disable the
 * framework default to prevent the model from using the sandboxed shell.
 */
export default disableTool()
