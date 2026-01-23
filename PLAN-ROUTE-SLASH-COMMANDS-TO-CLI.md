# Plan: Route Slash Commands to CLI

## Status: IMPLEMENTED

---

## Overview

Currently, the UI handles many slash commands locally (like `/help`, `/mcp`, `/cost`, `/status`, `/model`) by implementing their logic directly in `ChatContainer.tsx`. This creates maintenance burden and can lead to inconsistencies when the CLI updates its command implementations.

**Goal:** Route ALL slash commands to the CLI and display CLI's response in the UI. This ensures:
1. Future CLI updates automatically work in the UI
2. Single source of truth for command behavior
3. CLI handles all heavy lifting
4. UI remains a thin presentation layer

---

## Current Architecture

### Command Types (defined in `src/shared/slash-commands.ts`)

| Type | Current Behavior | Examples |
|------|------------------|----------|
| `local` | Handled entirely by UI | `/clear`, `/help`, `/settings`, `/new`, `/rename` |
| `cli-local` | UI implements CLI logic locally | `/mcp`, `/cost`, `/model`, `/status` |
| `cli-passthrough` | Converted to prompts, sent to Claude | `/compact`, `/review` |
| `skill` | Sent as messages to CLI | Dynamic skills from CLI |

### Key Files

- `src/shared/slash-commands.ts` - Command definitions
- `src/renderer/components/chat/ChatContainer.tsx:338-609` - Command router/handlers
- `src/main/services/claude-cli.service.ts` - CLI process management
- `src/main/ipc/handlers.ts` - IPC handlers

---

## Proposed Architecture

### New Command Classification

| Type | Behavior | Examples |
|------|----------|----------|
| `ui-only` | Must stay in UI (no CLI equivalent) | `/clear`, `/settings`, `/new` |
| `cli-routed` | Send to CLI, display response | Everything else |

### Commands That MUST Stay in UI

These commands have no CLI equivalent or require UI-only actions:

1. **`/clear`** - Clears UI message history (UI state only)
2. **`/settings`** - Opens UI settings panel
3. **`/new`** - Resets UI session state

### Commands to Route to CLI

All other commands should be routed:

- `/help` - Let CLI provide its own help text
- `/mcp` - Let CLI report its MCP status
- `/cost` - Let CLI report cost tracking
- `/model` - Let CLI report model info
- `/status` - Let CLI report session status
- `/compact` - Already works via CLI
- `/review` - Already works via CLI
- `/init` - CLI command
- `/doctor` - CLI command
- `/login` - CLI command
- `/logout` - CLI command
- `/config` - CLI command
- All skills - Already routed to CLI

---

## Implementation Plan

### Phase 1: Create CLI Command Execution Service

**File:** `src/main/services/cli-command.service.ts` (NEW)

Create a dedicated service for executing CLI commands and capturing their output:

```typescript
interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

class CliCommandService {
  // Execute a slash command and return the result
  async executeCommand(command: string, args: string, cwd: string): Promise<CommandResult>

  // Parse CLI JSON output into displayable text
  private parseCliOutput(jsonLines: string[]): string
}
```

**Key Implementation Details:**

1. Spawn CLI with command: `claude [command] [args] --output-format json`
2. Capture stdout/stderr
3. Parse JSON output into human-readable text
4. Return formatted result

### Phase 2: Add IPC Channel for Command Execution

**File:** `src/shared/ipc-channels.ts`

Add new channel:
```typescript
CLI_EXECUTE_COMMAND: 'cli:executeCommand'
```

**File:** `src/main/ipc/handlers.ts`

Add handler:
```typescript
ipcMain.handle(IPC_CHANNELS.CLI_EXECUTE_COMMAND, async (event, command, args, cwd) => {
  return cliCommandService.executeCommand(command, args, cwd);
});
```

**File:** `src/preload/index.ts`

Expose to renderer:
```typescript
executeCommand: (command: string, args: string, cwd: string) =>
  ipcRenderer.invoke(IPC_CHANNELS.CLI_EXECUTE_COMMAND, command, args, cwd)
```

### Phase 3: Update Slash Command Definitions

**File:** `src/shared/slash-commands.ts`

1. Change command type enum:
```typescript
type: 'ui-only' | 'cli-routed' | 'skill'
```

2. Update command definitions:
```typescript
export const SLASH_COMMANDS: SlashCommand[] = [
  // UI-only commands
  { name: 'clear', description: 'Clear chat history', type: 'ui-only' },
  { name: 'settings', description: 'Open settings', type: 'ui-only' },
  { name: 'new', description: 'Start new session', type: 'ui-only' },

  // CLI-routed commands (let CLI handle these)
  { name: 'help', description: 'Show help', type: 'cli-routed' },
  { name: 'mcp', description: 'Show MCP servers', type: 'cli-routed' },
  { name: 'cost', description: 'Show cost info', type: 'cli-routed' },
  { name: 'model', description: 'Show model info', type: 'cli-routed' },
  { name: 'status', description: 'Show status', type: 'cli-routed' },
  { name: 'compact', description: 'Compact conversation', type: 'cli-routed' },
  { name: 'init', description: 'Initialize project', type: 'cli-routed' },
  { name: 'doctor', description: 'Check CLI health', type: 'cli-routed' },
  { name: 'config', description: 'Show/edit config', type: 'cli-routed' },
  { name: 'login', description: 'Log in to Anthropic', type: 'cli-routed' },
  { name: 'logout', description: 'Log out', type: 'cli-routed' },
  // ... etc
];
```

### Phase 4: Simplify ChatContainer Command Handler

**File:** `src/renderer/components/chat/ChatContainer.tsx`

Replace the massive `handleSlashCommand` function with a simple router:

```typescript
const handleSlashCommand = async (command: SlashCommand, args: string) => {
  switch (command.type) {
    case 'ui-only':
      handleUiOnlyCommand(command, args);
      break;

    case 'cli-routed':
      await executeCliCommand(command, args);
      break;

    case 'skill':
      // Skills still sent as messages to active session
      handleSendMessage(`/${command.packageName ? command.packageName + ':' : ''}${command.name} ${args}`.trim());
      break;
  }
};

const handleUiOnlyCommand = (command: SlashCommand, args: string) => {
  switch (command.name) {
    case 'clear':
      dispatch(clearMessages());
      break;
    case 'settings':
      setShowSettings(true);
      break;
    case 'new':
      dispatch(clearMessages());
      dispatch(setCliSessionId(null));
      dispatch(setIsPlanMode(false));
      break;
  }
};

const executeCliCommand = async (command: SlashCommand, args: string) => {
  // Show "executing command" state
  dispatch(addMessage({
    role: 'user',
    content: `/${command.name} ${args}`.trim()
  }));

  try {
    const result = await window.claudeUI.cli.executeCommand(
      command.name,
      args,
      currentCwd
    );

    // Display CLI response as system message
    dispatch(addMessage({
      role: 'system',
      content: result.output,
      isCommandResult: true
    }));
  } catch (error) {
    dispatch(addMessage({
      role: 'system',
      content: `Error executing /${command.name}: ${error.message}`,
      isError: true
    }));
  }
};
```

### Phase 5: Handle CLI Command Output Formatting

**File:** `src/main/services/cli-command.service.ts`

The CLI outputs JSON events. We need to parse and format them:

```typescript
private parseCliOutput(jsonLines: string[]): string {
  const outputParts: string[] = [];

  for (const line of jsonLines) {
    try {
      const event = JSON.parse(line);

      switch (event.type) {
        case 'assistant':
          // Extract text content
          for (const block of event.message?.content || []) {
            if (block.type === 'text') {
              outputParts.push(block.text);
            }
          }
          break;

        case 'result':
          // Final result text
          if (event.result) {
            outputParts.push(event.result);
          }
          break;

        case 'system':
          // System messages (like help text)
          if (event.message) {
            outputParts.push(event.message);
          }
          break;
      }
    } catch {
      // Non-JSON line, include as-is
      if (line.trim()) {
        outputParts.push(line);
      }
    }
  }

  return outputParts.join('\n');
}
```

### Phase 6: Update Message Types for Command Results

**File:** `src/shared/message.types.ts`

Add command result message type:

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  // ... existing fields
  isCommandResult?: boolean;  // NEW: marks as command output
  commandName?: string;       // NEW: which command produced this
}
```

### Phase 7: Style Command Results in UI

**File:** `src/renderer/components/chat/MessageList.tsx` (or similar)

Add distinct styling for command results:

```typescript
{message.isCommandResult && (
  <div className="command-result">
    <div className="command-result-header">
      <span className="command-name">/{message.commandName}</span>
    </div>
    <pre className="command-output">{message.content}</pre>
  </div>
)}
```

---

## Special Considerations

### 1. Commands That Need Context

Some commands may need the current session context:
- `/status` - needs current session info
- `/cost` - needs current session's cost

**Solution:** Pass session ID to CLI command execution if available.

### 2. Commands That Modify State

Some commands may change CLI state:
- `/model` with args - changes model
- `/config` with args - changes config

**Solution:** After execution, refresh relevant UI state by querying CLI.

### 3. Interactive Commands

Some CLI commands may be interactive:
- `/login` - requires user input
- `/init` - may ask questions

**Solution:**
- For now, show message that interactive commands should be run in terminal
- Future: implement interactive mode with streaming input/output

### 4. Long-Running Commands

Some commands may take time:
- `/compact` - processes conversation
- `/doctor` - runs diagnostics

**Solution:** Show loading state, use streaming output if available.

---

## Migration Path

### Step 1: Non-Breaking Addition
- Add `executeCommand` infrastructure
- Keep existing handlers working
- Add new `cli-routed` type alongside existing types

### Step 2: Gradual Migration
- Migrate one command at a time
- Start with simple read-only commands (`/help`, `/status`)
- Test each migration thoroughly

### Step 3: Remove Old Code
- Once all commands migrated, remove old handler code
- Remove `cli-local` and `cli-passthrough` types
- Simplify to just `ui-only`, `cli-routed`, `skill`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/main/services/cli-command.service.ts` | NEW - Command execution service |
| `src/shared/ipc-channels.ts` | Add `CLI_EXECUTE_COMMAND` channel |
| `src/main/ipc/handlers.ts` | Add command execution handler |
| `src/preload/index.ts` | Expose `executeCommand` to renderer |
| `src/shared/slash-commands.ts` | Simplify command types |
| `src/renderer/components/chat/ChatContainer.tsx` | Simplify command router |
| `src/shared/message.types.ts` | Add command result fields |
| `src/renderer/components/chat/MessageList.tsx` | Style command results |

---

## Testing Plan

1. **Unit Tests**
   - CLI command service parses JSON output correctly
   - Command router dispatches to correct handler
   - IPC channel works end-to-end

2. **Integration Tests**
   - `/help` returns CLI help text
   - `/status` returns CLI status
   - `/mcp` returns MCP server list
   - `/cost` returns cost info
   - Error handling works for invalid commands

3. **Manual Testing**
   - All commands work in UI
   - Output formatting looks good
   - Error states handled gracefully
   - Performance is acceptable

---

## Benefits

1. **Maintenance:** UI code is simpler, CLI handles logic
2. **Consistency:** Same behavior in CLI and UI
3. **Future-Proof:** CLI updates automatically work in UI
4. **Reliability:** Single source of truth
5. **Testing:** Only need to test CLI, not duplicate logic in UI

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| CLI command format changes | Use stable CLI flags, handle parse errors gracefully |
| Performance (spawning process per command) | Cache results where appropriate, consider persistent CLI process |
| Interactive commands don't work | Clearly indicate which commands need terminal |
| Error messages unclear | Parse CLI errors and show user-friendly messages |

---

## Timeline Estimate

- Phase 1-2 (Infrastructure): Core service and IPC setup
- Phase 3-4 (Migration): Update command definitions and router
- Phase 5-6 (Polish): Output formatting and message types
- Phase 7 (UI): Styling and UX improvements
- Testing & Refinement: Comprehensive testing

---

## Open Questions

1. Should we show raw CLI JSON output for debugging?
2. How to handle commands that need real-time streaming?
3. Should `/rename` be routed to CLI or stay in UI?
4. How to handle CLI version mismatches?
