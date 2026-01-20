import React, { useEffect, useState } from 'react';
import { useSession } from '../../store';
import styles from './ProjectMcpManager.module.css';

// MCP Server types
type McpServerStdio = { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> };
type McpServerSse = { type: 'sse'; url: string; headers?: Record<string, string> };
type McpServerHttp = { type: 'http'; url: string; headers?: Record<string, string> };
type McpServer = McpServerStdio | McpServerSse | McpServerHttp;

type TransportType = 'stdio' | 'sse' | 'http';

interface ProjectMcpManagerProps {
  onRefresh?: () => void;
}

/**
 * ProjectMcpManager - Manages PROJECT-SPECIFIC MCP servers
 * Stored in ~/.claude.json under projects[projectPath].mcpServers
 * For global MCPs, see McpManager in settings.
 */
export const ProjectMcpManager: React.FC<ProjectMcpManagerProps> = ({ onRefresh }) => {
  const { currentCwd } = useSession();
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTransport, setFormTransport] = useState<TransportType>('sse');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formEnv, setFormEnv] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formHeaders, setFormHeaders] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Load servers when project changes
  useEffect(() => {
    const loadServers = async () => {
      if (!currentCwd) {
        setServers({});
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await window.claudeUI.mcp.getProjectServers(currentCwd);
        setServers(data);
      } catch (error) {
        console.error('Failed to load project MCP servers:', error);
      } finally {
        setLoading(false);
      }
    };
    loadServers();
  }, [currentCwd]);

  const handleRefresh = async () => {
    if (!currentCwd) return;

    setIsRefreshing(true);
    try {
      const data = await window.claudeUI.mcp.getProjectServers(currentCwd);
      setServers(data);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to refresh project MCP servers:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormTransport('sse');
    setFormCommand('');
    setFormArgs('');
    setFormEnv('');
    setFormUrl('');
    setFormHeaders('');
    setFormError(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCwd) return;

    setFormError(null);

    if (!formName.trim()) {
      setFormError('Server name is required');
      return;
    }

    if (servers[formName.trim()]) {
      setFormError('A server with this name already exists');
      return;
    }

    try {
      let server: McpServer;

      if (formTransport === 'sse' || formTransport === 'http') {
        if (!formUrl.trim()) {
          setFormError(`URL is required for ${formTransport.toUpperCase()} transport`);
          return;
        }

        let headers: Record<string, string> | undefined;
        if (formHeaders.trim()) {
          headers = {};
          const lines = formHeaders.trim().split('\n');
          for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
              const key = line.slice(0, colonIndex).trim();
              const value = line.slice(colonIndex + 1).trim();
              if (key) headers[key] = value;
            }
          }
        }

        server = {
          type: formTransport,
          url: formUrl.trim(),
          ...(headers && Object.keys(headers).length > 0 && { headers })
        };
      } else {
        if (!formCommand.trim()) {
          setFormError('Command is required for stdio transport');
          return;
        }

        const args = formArgs.trim() ? formArgs.trim().split(/\s+/) : undefined;

        let env: Record<string, string> | undefined;
        if (formEnv.trim()) {
          env = {};
          const lines = formEnv.trim().split('\n');
          for (const line of lines) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
              env[key.trim()] = valueParts.join('=').trim();
            }
          }
        }

        server = {
          command: formCommand.trim(),
          ...(args && { args }),
          ...(env && { env })
        };
      }

      const updated = await window.claudeUI.mcp.addProjectServer(formName.trim(), server, currentCwd);
      setServers(updated);
      resetForm();
    } catch (error) {
      console.error('Failed to add project MCP server:', error);
      setFormError('Failed to save server configuration');
    }
  };

  const handleRemoveServer = async (name: string) => {
    if (!currentCwd) return;
    if (!confirm(`Remove "${name}" from this project?`)) return;

    try {
      const updated = await window.claudeUI.mcp.removeProjectServer(name, currentCwd);
      setServers(updated);
    } catch (error) {
      console.error('Failed to remove project MCP server:', error);
    }
  };

  const getServerType = (server: McpServer): string => {
    if ('url' in server) {
      if (server.type === 'sse') return 'SSE';
      if (server.type === 'http') return 'HTTP';
    }
    return 'stdio';
  };

  const getServerDescription = (server: McpServer): string => {
    if ('url' in server && (server.type === 'sse' || server.type === 'http')) {
      return server.url;
    }
    const stdioServer = server as McpServerStdio;
    return `${stdioServer.command}${stdioServer.args ? ' ' + stdioServer.args.join(' ') : ''}`;
  };

  if (!currentCwd) {
    return (
      <div className={styles.noProject}>
        Start a chat to configure project-specific MCP servers.
      </div>
    );
  }

  const serverNames = Object.keys(servers);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.hint}>
          MCP servers for this project only
        </span>
        <button
          className={styles.refreshButton}
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh servers"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={isRefreshing ? styles.spinning : ''}
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : showAddForm ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          {formError && <div className={styles.formError}>{formError}</div>}

          <input
            type="text"
            className={styles.input}
            placeholder="Server name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <div className={styles.transportRow}>
            {(['sse', 'http', 'stdio'] as TransportType[]).map(t => (
              <button
                key={t}
                type="button"
                className={`${styles.transportBtn} ${formTransport === t ? styles.active : ''}`}
                onClick={() => setFormTransport(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {(formTransport === 'sse' || formTransport === 'http') ? (
            <>
              <input
                type="text"
                className={styles.input}
                placeholder="URL (e.g., https://mcp.example.com/v1)"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
              <textarea
                className={styles.textarea}
                placeholder="Headers (optional)&#10;Authorization: Bearer token"
                value={formHeaders}
                onChange={(e) => setFormHeaders(e.target.value)}
                rows={2}
              />
            </>
          ) : (
            <>
              <input
                type="text"
                className={styles.input}
                placeholder="Command (e.g., npx)"
                value={formCommand}
                onChange={(e) => setFormCommand(e.target.value)}
              />
              <input
                type="text"
                className={styles.input}
                placeholder="Arguments (optional)"
                value={formArgs}
                onChange={(e) => setFormArgs(e.target.value)}
              />
              <textarea
                className={styles.textarea}
                placeholder="Env vars (optional)&#10;KEY=value"
                value={formEnv}
                onChange={(e) => setFormEnv(e.target.value)}
                rows={2}
              />
            </>
          )}

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={resetForm}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn}>
              Add
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.serverList}>
            {serverNames.length === 0 ? (
              <div className={styles.empty}>No project MCP servers</div>
            ) : (
              serverNames.map(name => {
                const server = servers[name];
                return (
                  <div key={name} className={styles.serverItem}>
                    <div className={styles.serverInfo}>
                      <span className={styles.serverName}>{name}</span>
                      <span className={`${styles.badge} ${
                        getServerType(server) === 'SSE' ? styles.sseBadge :
                        getServerType(server) === 'HTTP' ? styles.httpBadge :
                        styles.stdioBadge
                      }`}>
                        {getServerType(server)}
                      </span>
                    </div>
                    <span className={styles.serverDesc}>{getServerDescription(server)}</span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemoveServer(name)}
                      title="Remove"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button className={styles.addBtn} onClick={() => setShowAddForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add MCP Server
          </button>
        </>
      )}
    </div>
  );
};
