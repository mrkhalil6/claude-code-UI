export interface SessionSummary {
  id: string;
  title: string;
  slug: string;
  messageCount: number;
  lastModified: string;
  createdAt: string;
  preview: string;
}

export interface Session {
  id: string;
  messages: SessionMessage[];
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  cwd: string;
  version: string;
  gitBranch?: string;
  slug: string;
}

export interface SessionMessage {
  uuid: string;
  parentUuid: string | null;
  type: 'user' | 'assistant';
  timestamp: string;
  message: MessageContent;
  toolUseResult?: string;
  isSidechain?: boolean;
}

export interface MessageContent {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock;

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ProjectWithSessions {
  encodedName: string;
  path: string;
  sessions: SessionSummary[];
}

export interface StartSessionOptions {
  cwd: string;
  sessionId?: string;
  resume?: boolean;
  resumeSessionId?: string;  // CLI session ID to resume (for loading from sidebar)
  permissionMode?: 'default' | 'plan' | 'acceptEdits';
  model?: string;
  initialAllowedTools?: string[];  // Tools to auto-allow from global settings
}
