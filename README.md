# Claude Code UI

A modern desktop GUI wrapper for [Claude Code CLI](https://github.com/anthropics/claude-code), built with Electron and React. This application provides a visual interface for interacting with Claude Code while retaining all the power of the command-line tool.

![Claude Code UI](https://img.shields.io/badge/Electron-33+-blue) ![React](https://img.shields.io/badge/React-18+-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178c6)

## Features

### Chat Interface
- **Real-time Streaming** - See Claude's responses as they're generated
- **Markdown Rendering** - Beautiful formatting with syntax highlighting for code blocks
- **Tool Call Display** - View tool inputs and results inline where they occur
- **Message Interruption** - Stop Claude mid-response when needed
- **Session Renaming** - Double-click session names to rename them

### Git Integration
- **Visual Diff Viewer** - Side-by-side diff comparison using Monaco Editor
- **Staging & Unstaging** - Stage/unstage individual files or all at once
- **Commit Interface** - Write commit messages and commit directly from the UI
- **Push/Pull** - Sync with remote repositories
- **Stash Management** - Create, apply, and drop stashes
- **Conflict Resolution** - Visual merge conflict resolution with "Accept Ours/Theirs" options

### Integrated Terminal
- **Full Terminal Emulation** - Powered by xterm.js with proper PTY support
- **Resizable Panel** - Drag to resize the terminal height
- **Theme Support** - Terminal theme matches the app theme

### MCP Server Management
- **Global MCP Servers** - Configure MCP servers in Settings (stored in `~/.claude.json`)
- **Project MCP Servers** - Per-project MCP configuration via `.mcp.json`
- **Multiple Transport Types** - Support for stdio, SSE, and HTTP transports
- **Server Status** - View connection status for each MCP server

### Appearance
- **Light/Dark/System Theme** - Three theme modes with system preference detection
- **Customizable UI** - Collapsible sidebar, resizable panels

### Task Tracking
- **Todo List** - Visual task progress tracking in the status bar
- **Progress Indicator** - See completed/total tasks with progress bar
- **Current Task Display** - Shows what Claude is currently working on

### Model Selection
- **Model Switcher** - Change models mid-session from the status bar
- **Model Display** - See current model and token usage

### Session Management
- **Session History** - Browse and resume previous chat sessions from the sidebar
- **Working Directory** - Each session tracks its working directory
- **Session Persistence** - Sessions stored by Claude CLI in `~/.claude/projects/`

### Developer Features
- **Plan Mode** - Toggle plan mode for reviewing changes before execution
- **Permission Management** - Grant or deny tool permissions through a visual dialog

## Prerequisites

Before using Claude Code UI, you need:

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Claude Code CLI** - Install the official CLI:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
3. **Anthropic API Key** - The CLI must be authenticated. Run:
   ```bash
   claude login
   ```

## Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/mrkhalil6/claude-code-ui.git
   cd claude-code-ui
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

### Building for Production

Build a distributable package for your platform:

```bash
npm run electron:build
```

The output will be in the `release/` directory:
- **Windows**: `.exe` installer (NSIS)
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage` portable app

## Usage

### Starting a New Chat

1. Click **"+ New Chat"** in the sidebar
2. Select a working directory for the session
3. Type your message and press Enter or click Send

### Git Panel

Click the **Git icon** in the header to open the Git panel:
- View all changed files grouped by staged/unstaged
- Click a file to view its diff
- Use the action buttons to stage, unstage, or discard changes
- Write a commit message and commit staged changes
- Push/pull to sync with remote

### Terminal

Click the **terminal icon** in the status bar to toggle the integrated terminal. The terminal opens in the current working directory.

### Settings

Click the **gear icon** in the header to access:
- **Appearance** - Theme selection (Light/Dark/System)
- **MCP Servers** - Add, edit, or remove global MCP servers
- **About** - Version information

### Changing Models

Click the **model name** in the status bar to switch between available models (Opus, Sonnet, Haiku).

## Project Structure

```
claude-code-ui/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point
│   │   ├── services/
│   │   │   ├── claude-cli.service.ts    # CLI subprocess manager
│   │   │   ├── git.service.ts           # Git operations
│   │   │   ├── terminal.service.ts      # PTY terminal management
│   │   │   ├── mcp.service.ts           # MCP server configuration
│   │   │   └── session-loader.service.ts
│   │   ├── ipc/
│   │   │   └── handlers.ts      # IPC message handlers
│   │   └── utils/
│   │       ├── paths.ts         # OS-specific path utilities
│   │       └── stream-parser.ts # JSON stream parser
│   │
│   ├── preload/
│   │   └── index.ts             # Context bridge (main ↔ renderer)
│   │
│   ├── renderer/                # React application
│   │   ├── main.tsx             # React entry point
│   │   ├── App.tsx              # Root component
│   │   ├── components/
│   │   │   ├── layout/          # Header, Sidebar, StatusBar
│   │   │   ├── chat/            # Chat UI, Messages, InputArea, TodoList
│   │   │   ├── git/             # GitDiffPanel, GitFileList
│   │   │   ├── terminal/        # TerminalPanel
│   │   │   ├── settings/        # SettingsPanel, McpManager
│   │   │   ├── diff/            # DiffViewer, DiffToolbar
│   │   │   ├── markdown/        # MarkdownPreview, CodeBlock
│   │   │   └── common/          # Button, Toggle, Modal, ThemeToggle
│   │   ├── store/               # Zustand state management
│   │   └── hooks/               # Custom React hooks
│   │
│   └── shared/                  # Shared types & constants
│       └── types/               # TypeScript interfaces
│
├── assets/                      # App icons
├── package.json
├── vite.config.ts               # Vite + Electron configuration
└── tsconfig.json
```

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run electron:build` | Build distributable package |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

### Tech Stack

- **Electron 33** - Desktop application framework
- **React 18** - UI library
- **TypeScript 5** - Type safety
- **Vite 6** - Fast bundler with HMR
- **Zustand** - Lightweight state management
- **Monaco Editor** - Code editing and diff viewing
- **xterm.js** - Terminal emulation
- **node-pty** - Pseudo-terminal for shell integration
- **react-markdown** - Markdown rendering

### How It Works

1. **Main Process** spawns Claude Code CLI as a subprocess with `--output-format stream-json`
2. **CLI Events** are parsed and forwarded to the renderer via IPC
3. **React Components** display messages, tool calls, and handle user input
4. **User Messages** are sent back to the CLI via stdin
5. **Sessions** are stored by the CLI in `~/.claude/projects/`
6. **Git Operations** are performed via spawned `git` commands
7. **Terminal** uses node-pty to create a real PTY connected to the system shell

## Troubleshooting

### "Claude CLI not found"
Make sure Claude Code CLI is installed globally:
```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

### "Not authenticated"
Run `claude login` to authenticate with your Anthropic API key.

### App not starting
Check the developer console (Ctrl+Shift+I / Cmd+Option+I) for errors.

### Git panel not loading
Ensure you're in a valid git repository and `git` is available in your PATH.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Anthropic](https://anthropic.com) for Claude and Claude Code CLI
- The Electron, React, and open-source communities
