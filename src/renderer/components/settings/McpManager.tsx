import React, { useEffect, useState } from 'react';
import styles from './McpManager.module.css';

// MCP Server types
type McpServerStdio = { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> };
type McpServerSse = { type: 'sse'; url: string; headers?: Record<string, string> };
type McpServerHttp = { type: 'http'; url: string; headers?: Record<string, string> };
type McpServer = McpServerStdio | McpServerSse | McpServerHttp;

type TransportType = 'stdio' | 'sse' | 'http';

interface McpManagerProps {
  onClose?: () => void;
}

/**
 * McpManager - Manages GLOBAL MCP servers (stored in ~/.claude/settings.json)
 * This component is used in the Settings panel for global MCP configuration.
 * For project-specific MCPs, see ProjectMcpManager.
 */
export const McpManager: React.FC<McpManagerProps> = ({ onClose }) => {
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTransport, setFormTransport] = useState<TransportType>('sse');
  // stdio fields
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formEnv, setFormEnv] = useState('');
  // sse fields
  const [formUrl, setFormUrl] = useState('');
  const [formHeaders, setFormHeaders] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  // Load global servers on mount
  useEffect(() => {
    const loadServers = async () => {
      setLoading(true);
      try {
        const data = await window.claudeUI.mcp.getGlobalServers();
        setServers(data);
      } catch (error) {
        console.error('Failed to load global MCP servers:', error);
      } finally {
        setLoading(false);
      }
    };
    loadServers();
  }, []);

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
    setEditingServer(null);
  };

  const handleEditServer = (name: string) => {
    const server = servers[name];
    if (server) {
      setFormName(name);

      if ('url' in server && (server.type === 'sse' || server.type === 'http')) {
        // SSE or HTTP server
        setFormTransport(server.type);
        setFormUrl(server.url);
        setFormHeaders(server.headers ? Object.entries(server.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : '');
        setFormCommand('');
        setFormArgs('');
        setFormEnv('');
      } else {
        // stdio server
        setFormTransport('stdio');
        const stdioServer = server as McpServerStdio;
        setFormCommand(stdioServer.command);
        setFormArgs(stdioServer.args?.join(' ') || '');
        setFormEnv(stdioServer.env ? Object.entries(stdioServer.env).map(([k, v]) => `${k}=${v}`).join('\n') : '');
        setFormUrl('');
        setFormHeaders('');
      }

      setEditingServer(name);
      setShowAddForm(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate name
    if (!formName.trim()) {
      setFormError('Server name is required');
      return;
    }

    // Check for duplicate name (only when adding new)
    if (!editingServer && servers[formName.trim()]) {
      setFormError('A server with this name already exists');
      return;
    }

    try {
      let server: McpServer;

      if (formTransport === 'sse' || formTransport === 'http') {
        // Validate URL fields
        if (!formUrl.trim()) {
          setFormError(`URL is required for ${formTransport.toUpperCase()} transport`);
          return;
        }

        // Parse headers
        let headers: Record<string, string> | undefined;
        if (formHeaders.trim()) {
          headers = {};
          const lines = formHeaders.trim().split('\n');
          for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
              const key = line.slice(0, colonIndex).trim();
              const value = line.slice(colonIndex + 1).trim();
              if (key) {
                headers[key] = value;
              }
            }
          }
        }

        server = {
          type: formTransport,
          url: formUrl.trim(),
          ...(headers && Object.keys(headers).length > 0 && { headers })
        };
      } else {
        // Validate stdio fields
        if (!formCommand.trim()) {
          setFormError('Command is required for stdio transport');
          return;
        }

        // Parse args
        const args = formArgs.trim() ? formArgs.trim().split(/\s+/) : undefined;

        // Parse env
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

      // If editing and name changed, remove old entry
      if (editingServer && editingServer !== formName.trim()) {
        await window.claudeUI.mcp.removeGlobalServer(editingServer);
      }

      const updated = await window.claudeUI.mcp.addGlobalServer(formName.trim(), server);
      setServers(updated);
      resetForm();
    } catch (error) {
      console.error('Failed to add global MCP server:', error);
      setFormError('Failed to save server configuration');
    }
  };

  const handleRemoveServer = async (name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) {
      return;
    }

    try {
      const updated = await window.claudeUI.mcp.removeGlobalServer(name);
      setServers(updated);
    } catch (error) {
      console.error('Failed to remove global MCP server:', error);
    }
  };

  const getServerDescription = (server: McpServer): string => {
    if ('url' in server && (server.type === 'sse' || server.type === 'http')) {
      return server.url;
    }
    const stdioServer = server as McpServerStdio;
    return `${stdioServer.command}${stdioServer.args ? ' ' + stdioServer.args.join(' ') : ''}`;
  };

  const getServerType = (server: McpServer): string => {
    if ('url' in server) {
      if (server.type === 'sse') return 'SSE';
      if (server.type === 'http') return 'HTTP';
    }
    return 'stdio';
  };

  if (loading) {
    return <div className={styles.loading}>Loading MCP servers...</div>;
  }

  const serverNames = Object.keys(servers);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Global MCP Servers</h3>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        )}
      </div>

      <p className={styles.description}>
        Configure <strong>global</strong> Model Context Protocol (MCP) servers.
        These servers are available across <strong>all projects</strong>.
        <br />
        <span className={styles.hint}>
          For project-specific MCP servers, use the lock icon next to the input field.
        </span>
      </p>

      {!showAddForm && (
        <button className={styles.addButton} onClick={() => setShowAddForm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Global MCP Server
        </button>
      )}

      {showAddForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <h4 className={styles.formTitle}>
              {editingServer ? `Edit "${editingServer}"` : 'Add New Global Server'}
            </h4>
            <button type="button" className={styles.cancelButton} onClick={resetForm}>
              Cancel
            </button>
          </div>

          {formError && (
            <div className={styles.formError}>{formError}</div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Server Name</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g., atlassian, filesystem"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={!!editingServer}
            />
            <span className={styles.hint}>Unique identifier for this server</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Transport Type</label>
            <div className={styles.transportToggle}>
              <button
                type="button"
                className={`${styles.transportOption} ${formTransport === 'sse' ? styles.active : ''}`}
                onClick={() => setFormTransport('sse')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                SSE
              </button>
              <button
                type="button"
                className={`${styles.transportOption} ${formTransport === 'http' ? styles.active : ''}`}
                onClick={() => setFormTransport('http')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                HTTP
              </button>
              <button
                type="button"
                className={`${styles.transportOption} ${formTransport === 'stdio' ? styles.active : ''}`}
                onClick={() => setFormTransport('stdio')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                stdio
              </button>
            </div>
            <span className={styles.hint}>
              {formTransport === 'sse' && 'Server-Sent Events - for streaming connections (e.g., Atlassian)'}
              {formTransport === 'http' && 'HTTP - for REST API connections (e.g., DevRev)'}
              {formTransport === 'stdio' && 'Standard I/O - for local command execution (e.g., filesystem)'}
            </span>
          </div>

          {(formTransport === 'sse' || formTransport === 'http') ? (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>URL</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g., https://mcp.atlassian.com/v1/mcp"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
                <span className={styles.hint}>The MCP server endpoint URL</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Headers (optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Authorization: Bearer token&#10;X-Custom-Header: value"
                  value={formHeaders}
                  onChange={(e) => setFormHeaders(e.target.value)}
                  rows={3}
                />
                <span className={styles.hint}>One header per line (Name: Value)</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Command</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g., npx"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                />
                <span className={styles.hint}>The executable to run</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Arguments (optional)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g., -y @modelcontextprotocol/server-filesystem /path"
                  value={formArgs}
                  onChange={(e) => setFormArgs(e.target.value)}
                />
                <span className={styles.hint}>Space-separated arguments</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Environment Variables (optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                  value={formEnv}
                  onChange={(e) => setFormEnv(e.target.value)}
                  rows={3}
                />
                <span className={styles.hint}>One KEY=value pair per line</span>
              </div>
            </>
          )}

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton}>
              {editingServer ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </form>
      )}

      <div className={styles.serverList}>
        {serverNames.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No global MCP servers configured</p>
            <span>Add a server to extend Claude's capabilities across all projects</span>
          </div>
        ) : (
          serverNames.map(name => {
            const server = servers[name];
            return (
              <div key={name} className={styles.serverItem}>
                <div className={styles.serverInfo}>
                  <div className={styles.serverNameRow}>
                    <span className={styles.serverName}>{name}</span>
                    <span className={`${styles.transportBadge} ${
                      getServerType(server) === 'SSE' ? styles.sseBadge :
                      getServerType(server) === 'HTTP' ? styles.httpBadge :
                      styles.stdioBadge
                    }`}>
                      {getServerType(server)}
                    </span>
                  </div>
                  <span className={styles.serverCommand}>
                    {getServerDescription(server)}
                  </span>
                </div>
                <div className={styles.serverActions}>
                  <button
                    className={styles.editButton}
                    onClick={() => handleEditServer(name)}
                    title="Edit server"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleRemoveServer(name)}
                    title="Remove server"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
