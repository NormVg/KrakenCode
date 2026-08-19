# Components

> The Vue 3 component tree — views, sidebars, chat, editor, terminal, architecture.

## Component Tree

```
App.vue (521 lines)
├── SettingsModal.vue
├── ProjectsSidebar.vue (451 lines)
│   ├── ModelSelector.vue
│   └── (chat list, project list, inline)
├── [View Container] — renders all views, hides inactive
│   ├── AgentView.vue (280 lines)
│   │   ├── ChatMessage.vue (152 lines)
│   │   ├── ChatInput.vue (354 lines)
│   │   └── QueuedMessages.vue
│   ├── EditorView.vue (318 lines)
│   │   └── Monaco Editor (via @guolao/vue-monaco-editor)
│   ├── TerminalView.vue (190 lines)
│   │   └── Ghostty Terminal
│   ├── WebViewView.vue
│   ├── DiffView.vue
│   └── ArchGraphView.vue
│       ├── MermaidPreview.vue
│       └── architecture/builder/
│           ├── ArchBuilder.vue
│           ├── BuilderNodeCard.vue
│           ├── layout.ts
│           ├── mermaidCodec.ts
│           └── types.ts
├── RightSidebar.vue (63 lines)
│   ├── ScratchpadPanel.vue
│   ├── ToolsPanel.vue
│   └── Versions.vue
└── [Global Bottom Bar] (inline in App.vue)
```

## App.vue

**File:** `src/renderer/src/App.vue` — 521 lines

The root component. Handles:

### Layout
- Left sidebar (ProjectsSidebar) with toggle
- Main content area (view container)
- Right sidebar (RightSidebar) with toggle + resize
- Global bottom bar with view toggles and breadcrumbs

### View Rendering
```html
<component
  v-for="(view, key) in views"
  :key="key"
  :is="view.component"
  class="app-view"
  :class="{ 'app-view-hidden': projectsStore.activeView !== key }"
/>
```

All six views are always mounted. Inactive views are hidden via CSS (`position: absolute; top: -9999px; visibility: hidden`). This keeps component state alive when switching views but means all views consume memory.

### State
- `isSettingsOpen` — settings modal visibility
- `isRightSidebarOpen` / `isLeftSidebarOpen` — sidebar toggles
- `rightSidebarWidth` — right sidebar width (resizable)

### Initialization
```typescript
onMounted(async () => {
  await projectsStore.loadData()
  if (!isSetup.value) {
    const success = await configStore.initializeAgent()
    if (!success) isSettingsOpen.value = true
  }
})
```

## AgentView.vue

**File:** `src/renderer/src/components/views/AgentView.vue` — 280 lines

The main chat interface. Contains the full agent turn loop inline.

### State
- `prompt` — current input text
- `isLoading` — whether agent is streaming
- `queuedMessages` — messages queued while agent is busy
- `chatHistoryRef` — scroll container ref

### Turn Flow
1. User submits text via `handleChat()`
2. If agent is busy, message is queued
3. `executeMessage(text)`:
   - Creates a chat if none exists
   - Adds user message to store
   - Adds empty agent message with `isStreaming: true`
   - Builds system prompt with architecture context
   - Calls `ChatService.streamMessage()`
   - On chunk: appends to agent message
   - On end: finalizes, extracts architecture mermaid, processes next queued message
   - On error: appends error text

### Architecture Extraction
```typescript
const applyArchitectureFromAgentReply = () => {
  const last = chatStore.activeChat?.messages.at(-1)
  const { displayContent, mermaidSource, didUpdate } = extractArchitectureUpdate(last.content)
  if (didUpdate && mermaidSource) {
    projectsStore.setProjectArchitecture(projectId, mermaidSource)
    chatStore.replaceActiveChatLastAgentContent(displayContent)
  }
}
```

Extracts ` ```architecture-mermaid ` fences from agent replies and updates the project's architecture.

### Three States
1. **Not setup** — shows welcome screen with logo
2. **Setup, no messages** — shows centered composer with banner
3. **Setup, has messages** — shows chat history + floating composer

## ChatInput.vue

**File:** `src/renderer/src/components/ChatInput.vue` — 354 lines

Rich text input using TipTap with:
- `@tiptap/starter-kit` — base editing
- `@tiptap/extension-placeholder` — placeholder text
- `@tiptap/extension-history` — undo/redo
- `@tiptap/extension-link` — link support
- `@tiptap/extension-image` — image support
- `@tiptap/extension-table` — table support
- Custom extensions: `AtMention`, `SlashCommands`, `scratchpadSuggestion`

### Features
- Slash commands (`/`) for skills
- `@` mentions for context
- Enter to submit, Shift+Enter for newline
- Auto-resizing textarea

## ChatMessage.vue

**File:** `src/renderer/src/components/ChatMessage.vue` — 152 lines

Renders a single chat message. Uses `markstream-vue` for streaming markdown rendering.

### Props
```typescript
role: 'user' | 'agent'
content: string
isStreaming?: boolean
```

### Markdown Rendering
Uses the `markstream` plugin configured in `plugins/markstream.ts`. Supports:
- Streaming markdown (renders incrementally as chunks arrive)
- Code blocks with syntax highlighting (Shiki)
- Mermaid diagrams (via `mermaid` package)
- LaTeX math (via KaTeX worker)

## EditorView.vue

**File:** `src/renderer/src/components/views/EditorView.vue` — 318 lines

Monaco-based code editor with tabs.

### Features
- Tab bar with file icons, modified indicators, close buttons
- Monaco editor with custom `kraken-theme`
- Auto-save (debounced 1 second)
- Cmd+S save shortcut
- Web Workers for language services (TS, JSON, CSS, HTML)

### Monaco Theme
```typescript
monaco.editor.defineTheme('kraken-theme', {
  base: 'vs-dark',
  colors: {
    'editor.background': '#1C1C2A',
    'editor.foreground': '#cdd6f4',
    // ...
  }
})
```

## TerminalView.vue

**File:** `src/renderer/src/components/views/TerminalView.vue` — 190 lines

Terminal using Ghostty Web + node-pty.

### Lifecycle
1. **onMounted:** Load Ghostty WASM, create Terminal, spawn PTY in project directory
2. **Data flow:** PTY → `pty:data:{id}` → `term.write(data)` | `term.onData` → `pty.write`
3. **Resize:** ResizeObserver → throttled `fitAddon.fit()` + `pty.resize()`
4. **onUnmounted:** Remove listeners, kill PTY, dispose terminal

### Theme
Custom dark theme matching the app's color palette:
- Background: `#1C1C2A`
- Foreground: `#E2E8F0`
- Cursor: `#FF5F5F`

## ProjectsSidebar.vue

**File:** `src/renderer/src/components/ProjectsSidebar.vue` — 451 lines

Left sidebar showing:
- Project list with add button
- Chat sessions for active project
- Model selector
- Settings button

## RightSidebar.vue

**File:** `src/renderer/src/components/RightSidebar.vue` — 63 lines

Right sidebar container that switches between:
- `ScratchpadPanel.vue` — TipTap rich text scratchpad
- `ToolsPanel.vue` — Tools display
- `Versions.vue` — Version history

## Architecture Components

**Directory:** `src/renderer/src/components/architecture/`

### MermaidPreview.vue
Renders Mermaid diagrams from source text using the `mermaid` package.

### ArchGraphView.vue
Full architecture view with:
- Monaco source editor (Mermaid text)
- Live Mermaid preview
- Builder mode toggle

### Builder
- `ArchBuilder.vue` — Structured node/edge builder
- `BuilderNodeCard.vue` — Individual node card
- `mermaidCodec.ts` — Compiles structured model → Mermaid source
- `layout.ts` — Layout utilities
- `types.ts` — `ArchNode`, `ArchEdge` types

### Composables
- `useArchDiagram.ts` — Diagram state management

### Templates
- `templates.ts` — Pre-built Mermaid templates (System flowchart, Sequence, C4 Context, ER)

## TipTap Extensions

**Directory:** `src/renderer/src/components/tiptap/`

| File | Purpose |
|:-----|:--------|
| `AtMention.ts` | `@` mention extension for context injection |
| `SlashCommands.ts` | `/` slash command extension for skills |
| `CommandList.vue` | Dropdown list for slash command suggestions |
| `suggestion.ts` | Suggestion utility for TipTap |
| `scratchpadSuggestion.ts` | Suggestion utility for scratchpad |

## Plugins

**File:** `src/renderer/src/plugins/markstream.ts`

Configures the `markstream-vue` plugin for streaming markdown rendering. Used by `ChatMessage.vue`.
