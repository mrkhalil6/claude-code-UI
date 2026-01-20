import { CLIEvent } from '../../shared/types';

export class StreamParser {
  private buffer: string = '';

  /**
   * Parse incoming chunks and emit complete JSON objects
   */
  parse(chunk: Buffer | string): CLIEvent[] {
    this.buffer += chunk.toString();
    const results: CLIEvent[] = [];

    // Split by newlines (each line is a complete JSON object)
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed) as CLIEvent;
          results.push(parsed);
        } catch (e) {
          // Handle partial JSON or non-JSON output
          console.error('Failed to parse CLI output:', trimmed.slice(0, 100));
        }
      }
    }

    return results;
  }

  /**
   * Clear the buffer
   */
  reset(): void {
    this.buffer = '';
  }

  /**
   * Get any remaining content in buffer
   */
  flush(): string {
    const content = this.buffer;
    this.buffer = '';
    return content;
  }
}
