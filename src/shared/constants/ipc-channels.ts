/**
 * Central IPC channel name definitions.
 *
 * Used by main process, preload, and renderer to prevent typos
 * and provide type safety.
 */

export const IPC = {
  // Agent / Chat
  AGENT_SET_MODEL: 'agent:setModel',
  AGENT_STREAM_CHAT: 'agent:stream-chat',
  AGENT_CANCEL_CHAT: 'agent:cancel-chat',
  AGENT_CHAT_CHUNK: (id: string) => `agent:chat:chunk:${id}`,
  AGENT_CHAT_TOOL: (id: string) => `agent:chat:tool:${id}`,
  AGENT_CHAT_END: (id: string) => `agent:chat:end:${id}`,
  AGENT_CHAT_ERROR: (id: string) => `agent:chat:error:${id}`,

  // Workspace
  WORKSPACE_GET_ALL: 'workspace:getAll',
  WORKSPACE_GET_BY_ID: 'workspace:getById',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_TOUCH: 'workspace:touch',

  // Session
  SESSION_GET_ALL: 'session:getAll',
  SESSION_GET_BY_WORKSPACE: 'session:getByWorkspace',
  SESSION_CREATE: 'session:create',
  SESSION_UPDATE: 'session:update',
  SESSION_DELETE: 'session:delete',

  // Message
  MESSAGE_GET_BY_SESSION: 'message:getBySession',
  MESSAGE_CREATE: 'message:create',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_APPEND_CONTENT: 'message:appendContent',
  MESSAGE_DELETE: 'message:delete',

  // Open Files
  OPEN_FILE_GET_BY_WORKSPACE: 'openFile:getByWorkspace',
  OPEN_FILE_UPSERT: 'openFile:upsert',
  OPEN_FILE_UPDATE: 'openFile:update',
  OPEN_FILE_SET_ACTIVE: 'openFile:setActive',
  OPEN_FILE_DELETE: 'openFile:delete',

  // Terminal Sessions
  TERMINAL_GET_BY_WORKSPACE: 'terminal:getByWorkspace',
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_DELETE: 'terminal:delete',

  // App Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:getAll',

  // Ollama
  OLLAMA_LIST_MODELS: 'ollama:listModels',

  // Filesystem
  FS_READ_DIRECTORY: 'fs:readDirectory',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_CREATE_ITEM: 'fs:createItem',
  FS_DELETE_ITEM: 'fs:deleteItem',
  FS_RENAME_ITEM: 'fs:renameItem',
  FS_MOVE_ITEM: 'fs:moveItem',
  FS_COPY_ITEM: 'fs:copyItem',

  // PTY
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: (id: string) => `pty:data:${id}`,
  PTY_EXIT: (id: string) => `pty:exit:${id}`,

  // Dialog
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',

  // Window
  // Eve Agent Server
  EVE_START: 'eve:start',
  EVE_STOP: 'eve:stop',
  EVE_GET_STATUS: 'eve:getStatus',

  // Window
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_MAXIMIZE: 'window-maximize',
  WINDOW_CLOSE: 'window-close'
} as const
