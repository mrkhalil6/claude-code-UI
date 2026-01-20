export type CLIEvent =
  | SystemInitEvent
  | StreamEvent
  | AssistantEvent
  | UserEvent
  | ResultEvent;

export interface SystemInitEvent {
  type: 'system';
  subtype: 'init';
  cwd: string;
  session_id: string;
  tools: string[];
  mcp_servers: string[];
  model: string;
  permissionMode: string;
  slash_commands: string[];
  apiKeySource: string;
  claude_code_version: string;
  uuid: string;
}

export interface StreamEvent {
  type: 'stream_event';
  event: StreamEventData;
  session_id: string;
  parent_tool_use_id: string | null;
  uuid: string;
}

export type StreamEventData =
  | { type: 'message_start'; message: unknown }
  | { type: 'content_block_start'; index: number; content_block: unknown }
  | { type: 'content_block_delta'; index: number; delta: ContentDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: unknown; usage: unknown }
  | { type: 'message_stop' };

export type ContentDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'input_json_delta'; partial_json: string };

export interface AssistantEvent {
  type: 'assistant';
  message: {
    model: string;
    id: string;
    type: 'message';
    role: 'assistant';
    content: AssistantContentBlock[];
    stop_reason: string | null;
    usage: UsageInfo;
  };
  parent_tool_use_id: string | null;
  session_id: string;
  uuid: string;
}

export type AssistantContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

export interface UserEvent {
  type: 'user';
  message: {
    role: 'user';
    content: UserContentBlock[];
  };
  parent_tool_use_id: string | null;
  session_id: string;
  uuid: string;
  tool_use_result?: string;
}

export type UserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  is_error: boolean;
  duration_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage: UsageInfo;
  permission_denials: PermissionDenial[];
  uuid: string;
}

export interface PermissionDenial {
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

// Events emitted by CLI service to renderer
export interface CLIServiceEvent {
  sessionId: string;
  event: CLIEvent;
}

export interface CLIPermissionRequiredEvent {
  sessionId: string;
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface CLIExitEvent {
  sessionId: string;
  code: number | null;
  signal: string | null;
}

export interface CLIErrorEvent {
  sessionId: string;
  error: string;
}
