# Claude Code UI

A modern desktop GUI wrapper for [Claude Code CLI](https://github.com/anthropics/claude-code), built with Electron and React. This application provides a visual interface for interacting with Claude Code while retaining all the power of the command-line tool.

![Claude Code UI](https://img.shields.io/badge/Electron-33+-blue) ![React](https://img.shields.io/badge/React-18+-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178c6)

## Features

- **Chat Interface** - Clean, modern chat UI with markdown rendering and syntax highlighting
- **Session History** - Browse and resume previous chat sessions from the sidebar
- **Real-time Streaming** - See Claude's responses as they're generated
- **Tool Call Display** - View tool inputs and results inline where they occur
- **Permission Management** - Grant or deny tool permissions through a visual dialog
- **Plan Mode** - Toggle plan mode for reviewing changes before execution
- **Dark Theme** - Easy on the eyes with a carefully designed dark color scheme
- **Cross-Platform** - Works on Windows, macOS, and Linux

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
   This creates credentials at `~/.claude/.credentials.json`

## Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/claude-code-ui.git
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
   This opens the app in development mode with hot reload.

### Building for Production

Build a distributable package for your platform:

```bash
# Build for your current platform
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

### Resuming a Session

Click any session in the sidebar to load its history and continue the conversation. The session will resume from where you left off.

### Tool Permissions

When Claude needs to use a tool (like reading/writing files), a permission dialog appears:
- **Allow Once** - Grant permission for this single use
- **Allow for Session** - Grant permission for the rest of the session
- **Deny** - Reject the tool use

### Plan Mode

Toggle **Plan Mode** in the header to have Claude plan changes without executing them. This is useful for reviewing what Claude intends to do before making modifications.

## Project Structure

```
claude-code-ui/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point
│   │   ├── services/
│   │   │   ├── claude-cli.service.ts    # CLI subprocess manager
│   │   │   └── session-loader.service.ts # Session history loader
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
│   │   │   ├── layout/          # Layout components
│   │   │   ├── chat/            # Chat UI components
│   │   │   ├── sidebar/         # Session history sidebar
│   │   │   ├── permissions/     # Permission dialogs
│   │   │   ├── markdown/        # Markdown rendering
│   │   │   └── common/          # Reusable UI components
│   │   ├── store/               # Zustand state management
│   │   │   └── slices/          # State slices
│   │   └── styles/              # Global styles & variables
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
- **Monaco Editor** - Code diff viewing
- **react-markdown** - Markdown rendering

### How It Works

1. **Main Process** spawns Claude Code CLI as a subprocess with `--output-format stream-json`
2. **CLI Events** are parsed and forwarded to the renderer via IPC
3. **React Components** display messages, tool calls, and handle user input
4. **User Messages** are sent back to the CLI via stdin
5. **Sessions** are stored by the CLI in `~/.claude/projects/`

## Troubleshooting

### "Claude CLI not found"
Make sure Claude Code CLI is installed globally:
```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

### "Not authenticated"
Run `claude login` to authenticate with your Anthropic API key.

### Windows: "nul" file created
This is a known Claude Code CLI issue on Windows with Git Bash. Add to your project's `CLAUDE.md`:
```markdown
## Windows Instructions
- Never use `> nul` for output redirection
- Use `> /dev/null` instead
```

### App not starting
Check the developer console (Ctrl+Shift+I / Cmd+Option+I) for errors.

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
- The Electron and React communities
