import {
  AssistantEvent,
  AssistantContentBlock,
  ResultEvent,
  BridgeOptions,
} from '../../../shared/types';

/**
 * Formats Claude CLI events into Discord-friendly markdown.
 */

export function formatAssistantMessage(event: AssistantEvent, options: BridgeOptions): string {
  const parts: string[] = [];

  for (const block of event.message.content) {
    switch (block.type) {
      case 'text':
        parts.push(block.text);
        break;
      case 'thinking':
        if (options.showThinking && block.thinking) {
          parts.push(`||${truncate(block.thinking, 300)}||`);
        }
        break;
      case 'tool_use':
        if (options.showToolCalls) {
          parts.push(formatToolUse(block));
        }
        break;
    }
  }

  return parts.join('\n').trim();
}

export function formatToolUse(block: AssistantContentBlock): string {
  if (block.type !== 'tool_use') return '';

  const summary = summarizeToolInput(block.name, block.input);
  return `> \`${block.name}\`: ${summary}`;
}

export function formatResultSummary(event: ResultEvent): string {
  const duration = (event.duration_ms / 1000).toFixed(1);
  const cost = event.total_cost_usd.toFixed(4);
  const tokens = event.usage.input_tokens + event.usage.output_tokens;

  return `*${event.num_turns} turns | ${tokens} tokens | $${cost} | ${duration}s*`;
}

export function summarizeToolInput(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
      return String(input.file_path || input.path || '(file)');
    case 'Write':
      return String(input.file_path || '(file)');
    case 'Edit':
      return String(input.file_path || '(file)');
    case 'Bash':
      return `\`${truncate(String(input.command || ''), 80)}\``;
    case 'Glob':
      return String(input.pattern || '(pattern)');
    case 'Grep':
      return `"${truncate(String(input.pattern || ''), 60)}"`;
    case 'WebSearch':
      return `"${truncate(String(input.query || ''), 60)}"`;
    case 'WebFetch':
      return truncate(String(input.url || ''), 60);
    case 'Task':
      return truncate(String(input.description || ''), 60);
    default:
      // For unknown tools, show first key-value
      const entries = Object.entries(input);
      if (entries.length > 0) {
        const [key, value] = entries[0];
        return `${key}: ${truncate(String(value), 50)}`;
      }
      return '(no input)';
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Chunk a long message into Discord-safe pieces (~1900 chars).
 * Avoids splitting mid-code-block.
 */
export function chunkMessage(text: string, maxLen = 1900): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;
  let inCodeBlock = false;
  let codeBlockLang = '';

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitAt = maxLen;

    // Try to split at a newline
    const newlineIdx = remaining.lastIndexOf('\n', maxLen);
    if (newlineIdx > maxLen * 0.5) {
      splitAt = newlineIdx + 1;
    }

    let chunk = remaining.slice(0, splitAt);

    // Check code block state
    const fenceMatches = chunk.match(/```/g);
    const fenceCount = fenceMatches ? fenceMatches.length : 0;

    if (inCodeBlock && fenceCount % 2 === 0) {
      // We're in a code block and haven't closed it - close it
      chunk += '\n```';
    } else if (!inCodeBlock && fenceCount % 2 === 1) {
      // We opened a code block but didn't close it
      // Find the language specifier
      const lastFenceIdx = chunk.lastIndexOf('```');
      const afterFence = chunk.slice(lastFenceIdx + 3);
      const langMatch = afterFence.match(/^(\w+)/);
      codeBlockLang = langMatch ? langMatch[1] : '';
      chunk += '\n```';
      inCodeBlock = true;
    } else if (inCodeBlock && fenceCount % 2 === 1) {
      // We closed the code block in this chunk
      inCodeBlock = false;
      codeBlockLang = '';
    }

    chunks.push(chunk);
    remaining = remaining.slice(splitAt);

    // If we're still in a code block, open it in the next chunk
    if (inCodeBlock && remaining.length > 0) {
      remaining = '```' + codeBlockLang + '\n' + remaining;
    }
  }

  // Add chunk indicators if multiple
  if (chunks.length > 1) {
    return chunks.map((c, i) => `${c}\n**(${i + 1}/${chunks.length})**`);
  }

  return chunks;
}
