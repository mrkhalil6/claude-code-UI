/**
 * Hook event types supported by Claude CLI
 */
export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PermissionRequest'
  | 'UserPromptSubmit'
  | 'Notification'
  | 'Stop'
  | 'SubagentStop'
  | 'PreCompact'
  | 'Setup'
  | 'SessionStart'
  | 'SessionEnd';

/**
 * A single hook command definition as stored in settings.json
 */
export interface HookCommand {
  type: 'command';
  command: string;
}

/**
 * A matcher entry with its associated hooks as stored in settings.json
 * Format: { matcher: "Bash", hooks: [{ type: "command", command: "..." }] }
 */
export interface HookMatcherEntry {
  matcher: string;
  hooks: HookCommand[];
}

/**
 * A hook with an ID for UI management (flattened for easier UI handling)
 */
export interface HookWithId {
  id: string;
  type: HookEventType;
  matcher: string;
  command: string;
}

/**
 * Payload for creating or updating a hook
 */
export interface HookPayload {
  id?: string;
  type: HookEventType;
  matcher: string;
  command: string;
}

/**
 * All available hook event types
 */
export const HOOK_EVENT_TYPES: HookEventType[] = [
  'PreToolUse',
  'PostToolUse',
  'PermissionRequest',
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'SubagentStop',
  'PreCompact',
  'Setup',
  'SessionStart',
  'SessionEnd'
];

/**
 * Descriptions for each hook event type
 */
export const HOOK_EVENT_DESCRIPTIONS: Record<HookEventType, string> = {
  PreToolUse: 'Runs before a tool is executed. Can block or modify tool calls.',
  PostToolUse: 'Runs after a tool completes. Receives tool output.',
  PermissionRequest: 'Runs when Claude requests permission for an action.',
  UserPromptSubmit: 'Runs when the user submits a prompt.',
  Notification: 'Runs when Claude sends a notification.',
  Stop: 'Runs when Claude stops processing.',
  SubagentStop: 'Runs when a subagent stops processing.',
  PreCompact: 'Runs before conversation compaction.',
  Setup: 'Runs once when Claude Code starts.',
  SessionStart: 'Runs at the start of each session.',
  SessionEnd: 'Runs at the end of each session.'
};
