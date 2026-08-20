import { disableTool } from 'eve/tools'

/**
 * Disable the framework's built-in `glob` tool.
 *
 * The framework `glob` tool uses a sandboxed filesystem, not the real
 * workspace. Our custom `list_dir` tool reads from the actual workspace
 * path via KRAKEN_WORKSPACE_PATH, so we disable the framework default
 * to prevent the model from calling the sandboxed version.
 */
export default disableTool()
