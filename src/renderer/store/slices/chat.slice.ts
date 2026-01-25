import { StateCreator } from 'zustand';

export interface ToolUseDisplay {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
}

// Todo item from Claude's TodoWrite tool
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;  // Present tense description shown when in_progress
}

// Option for AskUserQuestion
export interface AskUserOption {
  label: string;
  description?: string;
}

// Pending question from Claude's AskUserQuestion tool
export interface PendingUserQuestion {
  toolUseId: string;
  question: string;
  header?: string;
  options?: AskUserOption[];
  multiSelect?: boolean;
}

// Content block types for preserving order of text and tool calls
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: ToolUseDisplay };

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;  // Keep for backwards compat and user messages
  timestamp: string;
  thinking?: string;
  contentBlocks?: ContentBlock[];  // Ordered blocks for assistant messages
  toolUses?: ToolUseDisplay[];  // Keep for backwards compat
}

export interface ChatSlice {
  // State
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  streamingThinking: string;
  toolsInProgress: ToolUseDisplay[];
  streamingBlocks: ContentBlock[];  // Ordered blocks during streaming
  lastUserMessage: string | null;  // For retrying after permission grant
  todos: TodoItem[];  // Current todo list from Claude's TodoWrite
  pendingUserQuestion: PendingUserQuestion | null;  // Question awaiting user response

  // Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (content: string) => void;
  setStreamingThinking: (thinking: string) => void;
  appendStreamingThinking: (thinking: string) => void;
  clearStreaming: () => void;
  addToolInProgress: (tool: ToolUseDisplay) => void;
  updateToolStatus: (toolId: string, status: ToolUseDisplay['status'], result?: string) => void;
  clearToolsInProgress: () => void;
  finalizeStreamingMessage: () => void;
  setLastUserMessage: (message: string | null) => void;
  setTodos: (todos: TodoItem[]) => void;
  clearTodos: () => void;
  setPendingUserQuestion: (question: PendingUserQuestion | null) => void;
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set, get) => ({
  // Initial state
  messages: [],
  isStreaming: false,
  streamingContent: '',
  streamingThinking: '',
  toolsInProgress: [],
  streamingBlocks: [],
  lastUserMessage: null,
  todos: [],
  pendingUserQuestion: null,

  // Actions
  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  clearMessages: () => set({ messages: [] }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (content) => set((state) => {
    // Skip empty content to avoid creating empty text blocks
    if (!content) return state;

    // Also update streamingBlocks - append to last text block or create new one
    const blocks = [...state.streamingBlocks];
    const lastBlock = blocks[blocks.length - 1];

    if (lastBlock && lastBlock.type === 'text') {
      // Append to existing text block
      blocks[blocks.length - 1] = { type: 'text', text: lastBlock.text + content };
    } else {
      // Create new text block
      blocks.push({ type: 'text', text: content });
    }

    return {
      streamingContent: state.streamingContent + content,
      streamingBlocks: blocks
    };
  }),

  setStreamingThinking: (thinking) => set({ streamingThinking: thinking }),

  appendStreamingThinking: (thinking) => set((state) => ({
    streamingThinking: state.streamingThinking + thinking
  })),

  clearStreaming: () => set({
    streamingContent: '',
    streamingThinking: '',
    toolsInProgress: [],
    streamingBlocks: []
  }),

  addToolInProgress: (tool) => set((state) => ({
    toolsInProgress: [...state.toolsInProgress, tool],
    // Add tool block to streaming blocks
    streamingBlocks: [...state.streamingBlocks, { type: 'tool', tool }]
  })),

  updateToolStatus: (toolId, status, result) => set((state) => {
    // Update in toolsInProgress
    const updatedTools = state.toolsInProgress.map((tool) =>
      tool.id === toolId ? { ...tool, status, result } : tool
    );

    // Also update in streamingBlocks
    const updatedBlocks = state.streamingBlocks.map((block) => {
      if (block.type === 'tool' && block.tool.id === toolId) {
        return { type: 'tool' as const, tool: { ...block.tool, status, result } };
      }
      return block;
    });

    return {
      toolsInProgress: updatedTools,
      streamingBlocks: updatedBlocks
    };
  }),

  clearToolsInProgress: () => set({ toolsInProgress: [] }),

  finalizeStreamingMessage: () => {
    const state = get();
    if (state.streamingBlocks.length > 0 || state.streamingThinking) {
      // Filter out empty text blocks
      const filteredBlocks = state.streamingBlocks.filter(block => {
        if (block.type === 'text') {
          return block.text.trim().length > 0;
        }
        return true; // Keep tool blocks
      });

      // Extract all tools from blocks for backwards compat
      const toolUses = filteredBlocks
        .filter((b): b is { type: 'tool'; tool: ToolUseDisplay } => b.type === 'tool')
        .map(b => b.tool);

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: state.streamingContent,
        timestamp: new Date().toISOString(),
        thinking: state.streamingThinking || undefined,
        contentBlocks: filteredBlocks.length > 0 ? [...filteredBlocks] : undefined,
        toolUses: toolUses.length > 0 ? toolUses : undefined
      };

      set((state) => ({
        messages: [...state.messages, message],
        isStreaming: false,
        streamingContent: '',
        streamingThinking: '',
        toolsInProgress: [],
        streamingBlocks: []
      }));
    } else {
      set({ isStreaming: false });
    }
  },

  setLastUserMessage: (message) => set({ lastUserMessage: message }),

  setTodos: (todos) => set({ todos }),

  clearTodos: () => set({ todos: [] }),

  setPendingUserQuestion: (question) => set({ pendingUserQuestion: question })
});
