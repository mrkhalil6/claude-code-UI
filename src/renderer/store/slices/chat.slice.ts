import { StateCreator } from 'zustand';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  thinking?: string;
  toolUses?: ToolUseDisplay[];
}

export interface ToolUseDisplay {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
}

export interface ChatSlice {
  // State
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  streamingThinking: string;
  toolsInProgress: ToolUseDisplay[];
  lastUserMessage: string | null;  // For retrying after permission grant

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
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set, get) => ({
  // Initial state
  messages: [],
  isStreaming: false,
  streamingContent: '',
  streamingThinking: '',
  toolsInProgress: [],
  lastUserMessage: null,

  // Actions
  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  clearMessages: () => set({ messages: [] }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (content) => set((state) => ({
    streamingContent: state.streamingContent + content
  })),

  setStreamingThinking: (thinking) => set({ streamingThinking: thinking }),

  appendStreamingThinking: (thinking) => set((state) => ({
    streamingThinking: state.streamingThinking + thinking
  })),

  clearStreaming: () => set({
    streamingContent: '',
    streamingThinking: '',
    toolsInProgress: []
  }),

  addToolInProgress: (tool) => set((state) => ({
    toolsInProgress: [...state.toolsInProgress, tool]
  })),

  updateToolStatus: (toolId, status, result) => set((state) => ({
    toolsInProgress: state.toolsInProgress.map((tool) =>
      tool.id === toolId ? { ...tool, status, result } : tool
    )
  })),

  clearToolsInProgress: () => set({ toolsInProgress: [] }),

  finalizeStreamingMessage: () => {
    const state = get();
    if (state.streamingContent || state.streamingThinking) {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: state.streamingContent,
        timestamp: new Date().toISOString(),
        thinking: state.streamingThinking || undefined,
        toolUses: state.toolsInProgress.length > 0 ? [...state.toolsInProgress] : undefined
      };

      set((state) => ({
        messages: [...state.messages, message],
        isStreaming: false,
        streamingContent: '',
        streamingThinking: '',
        toolsInProgress: []
      }));
    } else {
      set({ isStreaming: false });
    }
  },

  setLastUserMessage: (message) => set({ lastUserMessage: message })
});
