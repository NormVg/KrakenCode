export interface ChatMessage {
  id?: string;
  role: 'user' | 'agent';
  content: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  time: string; // e.g. "Just now" or Date string
  messages: ChatMessage[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  items: ChatSession[];
  /** Mermaid source for the Architecture (Graph) view — text-first, agent-editable */
  architecture?: string;
}

export type ViewType = 'agent' | 'editor' | 'web' | 'diff' | 'graph' | 'terminal'
