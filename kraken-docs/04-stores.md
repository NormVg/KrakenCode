# Stores

> Pinia stores — the state management layer.

## Store Map

| Store | File | Lines | Domain |
|:------|:-----|:------|:-------|
| `useProjectsStore` | `stores/projects.ts` | 90 | Projects, active view, active chat, architecture, persistence |
| `useChatStore` | `stores/chat.ts` | 128 | Chat sessions, messages, streaming |
| `useEditorStore` | `stores/editor.ts` | 96 | Open files, active file, save |
| `useConfigStore` | `stores/config.ts` | 42 | Model provider, API key, setup state |

## useProjectsStore

**File:** `src/renderer/src/stores/projects.ts`

The central store. Manages projects list, active project, active chat, active view, and persistence.

### State

```typescript
projects: ref<Project[]>([])           // All projects
activeProjectId: ref<string | null>     // Currently active project
activeChatId: ref<string | null>        // Currently active chat
activeView: ref<ViewType>('agent')     // Currently active view (GLOBAL, not per-project)
isLoaded: ref(false)                   // Whether data has been loaded from disk
```

### Computed

```typescript
activeProject: computed(() =>
  projects.value.find(p => p.id === activeProjectId.value)
)
```

### Actions

| Action | Description |
|:-------|:------------|
| `loadData()` | Reads `kraken_projects` from JSON store, populates state |
| `saveData()` | Serializes entire state to `kraken_projects` JSON file |
| `addProject()` | Opens directory dialog, creates or activates project |
| `setProjectArchitecture(projectId, mermaidSource)` | Updates project's architecture field |

### Persistence

All saves go through `PersistenceService.write('kraken_projects', data)` which calls `window.api.storeWrite`. The data blob includes:

```typescript
{
  projects: Project[],      // All projects with all chats and all messages
  activeProjectId: string,
  activeChatId: string,
  activeView: ViewType
}
```

**Problem:** Every save serializes the entire app state. A single character typed in a chat triggers a full JSON rewrite of all projects, chats, and messages.

### Known Issue: `An object could not be cloned`

The `saveData()` function passes Vue reactive proxies to `window.api.storeWrite`, which uses Electron's structured clone algorithm. Vue proxies cannot be cloned. The `PersistenceService` works around this with `JSON.parse(JSON.stringify(data))`, but direct calls to `window.api.storeWrite` from other places bypass this fix.

## useChatStore

**File:** `src/renderer/src/stores/chat.ts`

Manages chat sessions and messages. Depends on `useProjectsStore` — all data lives inside the projects store's `Project.items` array.

### Computed

```typescript
activeChat: computed(() =>
  projectsStore.activeProject?.items.find(c => c.id === projectsStore.activeChatId)
)
```

### Actions

| Action | Description |
|:-------|:------------|
| `createChat(projectId, title?)` | Creates a new `ChatSession`, unshifts to project items |
| `selectChat(projectId, chatId)` | Sets active project and chat |
| `renameChat(projectId, chatId, newTitle)` | Renames a chat |
| `deleteChat(projectId, chatId)` | Removes chat, selects next if active was deleted |
| `addMessageToActiveChat(msg)` | Pushes message, auto-titles if first user message |
| `updateActiveChatStreamingMessage(chunk)` | Appends chunk to last agent message if streaming |
| `endActiveChatStreamingMessage()` | Sets `isStreaming = false`, saves data |
| `appendErrorToActiveChat(err)` | Appends error text to last agent message |
| `replaceActiveChatLastAgentContent(content)` | Replaces last agent message content (used for architecture extraction) |

### Auto-Title Logic

```typescript
if (activeChat.value.messages.length === 0
    && msg.role === 'user'
    && activeChat.value.title === 'New Chat') {
  const firstLine = msg.content.split('\n')[0].trim()
  activeChat.value.title = firstLine.length > 30
    ? firstLine.substring(0, 30) + '...'
    : firstLine
}
```

## useEditorStore

**File:** `src/renderer/src/stores/editor.ts`

Manages open files in the Monaco editor. State is **global** — not per-project.

### State

```typescript
openFiles: ref<OpenFile[]>([])        // All open files (across all projects)
activeFileId: ref<string | null>      // Currently active file
```

### Actions

| Action | Description |
|:-------|:------------|
| `openFile(node)` | Opens file, reads content, sets active, switches to editor view |
| `closeFile(id)` | Removes from openFiles, selects next if active was closed |
| `updateFileContent(id, newContent)` | Updates content, marks modified |
| `saveFile(id)` | Writes content to disk, clears modified flag |
| `renameOpenFile(oldPath, newPath, newName)` | Updates file metadata after rename |

### Language Detection

```typescript
const getLanguageFromExtension = (filename: string) => {
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript'
    case 'js': case 'jsx': return 'javascript'
    case 'vue': case 'html': return 'html'
    case 'json': return 'json'
    case 'md': return 'markdown'
    case 'css': return 'css'
    case 'py': return 'python'
    default: return 'plaintext'
  }
}
```

**Problem:** Limited language map. No Go, Rust, Java, C/C++, Ruby, PHP, etc.

### View Switching

`openFile()` calls `projectsStore.activeView = 'editor'` — the editor store reaches into the projects store to switch views. This is a cross-store dependency that makes the stores tightly coupled.

## useConfigStore

**File:** `src/renderer/src/stores/config.ts`

Manages AI model configuration.

### State

```typescript
provider: ref('ollama-local')    // Provider identifier
model: ref('gemma4:31b-cloud')   // Model name
apiKey: ref('')                  // API key (for cloud providers)
isSetup: ref(false)              // Whether model has been initialized
setupError: ref('')              // Last setup error message
```

### Actions

| Action | Description |
|:-------|:------------|
| `initializeAgent()` | Calls `window.api.setModel({ provider, model, apiKey })`, sets `isSetup` on success |

### Defaults

- Provider: `ollama-local`
- Model: `gemma4:31b-cloud`
- No API key needed for local Ollama

### Problem

Config is not persisted. If the app restarts, `isSetup` resets to `false` and the user must reconfigure. The `initializeAgent()` is called on mount in `App.vue`, but the provider/model/apiKey values are hardcoded defaults, not loaded from storage.
