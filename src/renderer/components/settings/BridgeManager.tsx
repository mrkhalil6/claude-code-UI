import React, { useEffect, useState, useCallback } from 'react';
import {
  BridgeConfig,
  BridgeStatusInfo,
  DiscordBridgeConfig,
  DiscordGuild,
  DiscordChannelMapping,
} from '../../../shared/types';
import styles from './BridgeManager.module.css';

export const BridgeManager: React.FC = () => {
  const [bridges, setBridges] = useState<BridgeConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, BridgeStatusInfo>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBridge, setEditingBridge] = useState<string | null>(null);

  // Add/Edit form state
  const [formName, setFormName] = useState('');
  const [formToken, setFormToken] = useState('');
  const [formAutoConnect, setFormAutoConnect] = useState(false);
  const [formShowThinking, setFormShowThinking] = useState(false);
  const [formShowToolCalls, setFormShowToolCalls] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formTokenValid, setFormTokenValid] = useState<boolean | null>(null);
  const [formTokenUsername, setFormTokenUsername] = useState<string | null>(null);
  const [testingToken, setTestingToken] = useState(false);

  // Mapping form state
  const [addingMappingFor, setAddingMappingFor] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [mappingCwd, setMappingCwd] = useState('');

  // Expanded bridge details
  const [expandedBridge, setExpandedBridge] = useState<string | null>(null);

  const loadBridges = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.claudeUI.bridges.getAll();
      setBridges(data);
      // Load statuses
      for (const bridge of data) {
        const status = await window.claudeUI.bridges.getStatus(bridge.id);
        if (status) {
          setStatuses((prev) => ({ ...prev, [bridge.id]: status }));
        }
      }
    } catch (error) {
      console.error('Failed to load bridges:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBridges();

    // Listen for status events
    const cleanupStatus = window.claudeUI.bridges.onStatus((event) => {
      setStatuses((prev) => ({
        ...prev,
        [event.bridgeId]: {
          bridgeId: event.bridgeId,
          platform: 'discord',
          status: event.status,
          error: event.error,
          botUsername: event.botUsername,
        },
      }));
    });

    const cleanupError = window.claudeUI.bridges.onError((event) => {
      console.error(`Bridge error [${event.bridgeId}]:`, event.error);
    });

    return () => {
      cleanupStatus();
      cleanupError();
    };
  }, [loadBridges]);

  const resetForm = () => {
    setFormName('');
    setFormToken('');
    setFormAutoConnect(false);
    setFormShowThinking(false);
    setFormShowToolCalls(true);
    setFormError(null);
    setFormTokenValid(null);
    setFormTokenUsername(null);
    setShowAddForm(false);
    setEditingBridge(null);
  };

  const handleTestToken = async () => {
    if (!formToken.trim()) {
      setFormError('Bot token is required');
      return;
    }
    setTestingToken(true);
    setFormTokenValid(null);
    setFormError(null);
    try {
      const result = await window.claudeUI.bridges.testToken('discord', formToken.trim());
      setFormTokenValid(result.valid);
      if (result.valid) {
        setFormTokenUsername(result.botUsername || null);
      } else {
        setFormError(result.error || 'Invalid token');
      }
    } catch (error) {
      setFormError('Failed to test token');
      setFormTokenValid(false);
    } finally {
      setTestingToken(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Bridge name is required');
      return;
    }
    if (!formToken.trim()) {
      setFormError('Bot token is required');
      return;
    }

    try {
      if (editingBridge) {
        const updated = await window.claudeUI.bridges.update({
          id: editingBridge,
          name: formName.trim(),
          botToken: formToken.trim(),
          autoConnect: formAutoConnect,
          options: {
            showThinking: formShowThinking,
            showToolCalls: formShowToolCalls,
          },
        });
        setBridges((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      } else {
        const created = await window.claudeUI.bridges.create({
          platform: 'discord',
          name: formName.trim(),
          botToken: formToken.trim(),
          autoConnect: formAutoConnect,
          options: {
            showThinking: formShowThinking,
            showToolCalls: formShowToolCalls,
          },
        });
        setBridges((prev) => [...prev, created]);
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save bridge:', error);
      setFormError('Failed to save bridge configuration');
    }
  };

  const handleEdit = (bridge: BridgeConfig) => {
    setFormName(bridge.name);
    const dc = bridge as DiscordBridgeConfig;
    setFormToken(dc.botToken);
    setFormAutoConnect(bridge.autoConnect);
    setFormShowThinking(bridge.options.showThinking);
    setFormShowToolCalls(bridge.options.showToolCalls);
    setEditingBridge(bridge.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bridge?')) return;
    try {
      await window.claudeUI.bridges.delete(id);
      setBridges((prev) => prev.filter((b) => b.id !== id));
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      console.error('Failed to delete bridge:', error);
    }
  };

  const handleConnect = async (id: string) => {
    try {
      setStatuses((prev) => ({
        ...prev,
        [id]: { ...prev[id], bridgeId: id, platform: 'discord', status: 'connecting' },
      }));
      await window.claudeUI.bridges.connect(id);
    } catch (error) {
      console.error('Failed to connect bridge:', error);
      setStatuses((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          bridgeId: id,
          platform: 'discord',
          status: 'error',
          error: error instanceof Error ? error.message : 'Connection failed',
        },
      }));
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await window.claudeUI.bridges.disconnect(id);
      setStatuses((prev) => ({
        ...prev,
        [id]: { ...prev[id], bridgeId: id, platform: 'discord', status: 'disconnected' },
      }));
    } catch (error) {
      console.error('Failed to disconnect bridge:', error);
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedBridge((prev) => (prev === id ? null : id));
  };

  // Channel mapping handlers
  const handleStartAddMapping = async (bridgeId: string) => {
    setAddingMappingFor(bridgeId);
    setLoadingGuilds(true);
    setSelectedGuild('');
    setSelectedChannel('');
    setMappingCwd('');
    try {
      const fetchedGuilds = await window.claudeUI.bridges.getGuilds(bridgeId);
      setGuilds(fetchedGuilds);
    } catch (error) {
      console.error('Failed to fetch guilds:', error);
      setGuilds([]);
    } finally {
      setLoadingGuilds(false);
    }
  };

  const handleAddMapping = async () => {
    if (!addingMappingFor || !selectedChannel || !mappingCwd.trim()) return;

    const guild = guilds.find((g) =>
      g.channels.some((c) => c.id === selectedChannel)
    );
    const channel = guild?.channels.find((c) => c.id === selectedChannel);
    if (!guild || !channel) return;

    try {
      const updated = await window.claudeUI.bridges.addMapping({
        bridgeId: addingMappingFor,
        discordChannelId: channel.id,
        discordChannelName: channel.name,
        discordGuildId: guild.id,
        discordGuildName: guild.name,
        cwd: mappingCwd.trim(),
      });
      setBridges((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setAddingMappingFor(null);
    } catch (error) {
      console.error('Failed to add mapping:', error);
    }
  };

  const handleRemoveMapping = async (bridgeId: string, channelId: string) => {
    try {
      const updated = await window.claudeUI.bridges.removeMapping({
        bridgeId,
        discordChannelId: channelId,
      });
      setBridges((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (error) {
      console.error('Failed to remove mapping:', error);
    }
  };

  const handleSelectDirectory = async () => {
    const dir = await window.claudeUI.fs.selectDirectory();
    if (dir) setMappingCwd(dir);
  };

  const getStatusInfo = (status: BridgeStatusInfo | undefined) => {
    if (!status) return { label: 'Unknown', className: styles.statusDisconnected };
    switch (status.status) {
      case 'connected':
        return { label: 'Connected', className: styles.statusConnected };
      case 'connecting':
        return { label: 'Connecting...', className: styles.statusConnecting };
      case 'error':
        return { label: 'Error', className: styles.statusError };
      case 'reconnecting':
        return { label: 'Reconnecting', className: styles.statusReconnecting };
      default:
        return { label: 'Disconnected', className: styles.statusDisconnected };
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading bridges...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Messaging Bridges</h3>
      </div>

      <p className={styles.description}>
        Connect Claude to messaging platforms like Discord. Messages sent in mapped channels
        will be processed by Claude, and responses will be streamed back.
      </p>

      <div className={styles.warningBox}>
        <strong>Security Note:</strong> Discord users can trigger Claude commands that run with
        full permissions. Only connect to channels with trusted users. Bot tokens are stored
        locally in <code>~/.claude-ui/bridges.json</code>.
      </div>

      {!showAddForm && (
        <button className={styles.addButton} onClick={() => setShowAddForm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Discord Bridge
        </button>
      )}

      {showAddForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <h4 className={styles.formTitle}>
              {editingBridge ? 'Edit Bridge' : 'Add Discord Bridge'}
            </h4>
            <button type="button" className={styles.cancelButton} onClick={resetForm}>
              Cancel
            </button>
          </div>

          {formError && <div className={styles.formError}>{formError}</div>}
          {formTokenValid && formTokenUsername && (
            <div className={styles.formSuccess}>
              Token valid — Bot: <strong>{formTokenUsername}</strong>
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Bridge Name</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g., My Discord Bot"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <span className={styles.hint}>A friendly name to identify this bridge</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Bot Token</label>
            <div className={styles.tokenRow}>
              <input
                type="password"
                className={styles.input}
                placeholder="Paste your Discord bot token"
                value={formToken}
                onChange={(e) => {
                  setFormToken(e.target.value);
                  setFormTokenValid(null);
                }}
              />
              <button
                type="button"
                className={styles.testButton}
                onClick={handleTestToken}
                disabled={testingToken || !formToken.trim()}
              >
                {testingToken ? 'Testing...' : 'Test'}
              </button>
            </div>
            <span className={styles.hint}>
              Get a bot token from the{' '}
              <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)' }}>
                Discord Developer Portal
              </a>
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Options</label>
            <div className={styles.optionsRow}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={formAutoConnect}
                  onChange={(e) => setFormAutoConnect(e.target.checked)}
                />
                Auto-connect on startup
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={formShowToolCalls}
                  onChange={(e) => setFormShowToolCalls(e.target.checked)}
                />
                Show tool calls
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={formShowThinking}
                  onChange={(e) => setFormShowThinking(e.target.checked)}
                />
                Show thinking
              </label>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton}>
              {editingBridge ? 'Save Changes' : 'Add Bridge'}
            </button>
          </div>
        </form>
      )}

      <div className={styles.bridgeList}>
        {bridges.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No bridges configured</p>
            <span>Add a Discord bridge to interact with Claude from Discord</span>
          </div>
        ) : (
          bridges.map((bridge) => {
            const status = statuses[bridge.id];
            const statusInfo = getStatusInfo(status);
            const isConnected = status?.status === 'connected';
            const isExpanded = expandedBridge === bridge.id;
            const dc = bridge as DiscordBridgeConfig;

            return (
              <div key={bridge.id}>
                <div className={styles.bridgeItem}>
                  <div className={styles.bridgeInfo} onClick={() => handleToggleExpand(bridge.id)} style={{ cursor: 'pointer' }}>
                    <div className={styles.bridgeNameRow}>
                      <span className={styles.bridgeName}>{bridge.name}</span>
                      <span className={styles.platformBadge}>Discord</span>
                      <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <span className={styles.bridgeDetail}>
                      {status?.botUsername ? `@${status.botUsername}` : 'Not connected'}
                      {dc.channelMappings.length > 0 && ` · ${dc.channelMappings.length} channel${dc.channelMappings.length !== 1 ? 's' : ''} mapped`}
                    </span>
                  </div>

                  <div className={styles.bridgeActions}>
                    {isConnected ? (
                      <button
                        className={`${styles.actionButton} ${styles.disconnectButton}`}
                        onClick={() => handleDisconnect(bridge.id)}
                        title="Disconnect"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        className={`${styles.actionButton} ${styles.connectButton}`}
                        onClick={() => handleConnect(bridge.id)}
                        title="Connect"
                        disabled={status?.status === 'connecting'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                    )}
                    <button
                      className={styles.actionButton}
                      onClick={() => handleEdit(bridge)}
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      onClick={() => handleDelete(bridge.id)}
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded: channel mappings */}
                {isExpanded && (
                  <div className={styles.mappingsSection}>
                    <div className={styles.mappingsTitle}>Channel Mappings</div>

                    {dc.channelMappings.map((mapping: DiscordChannelMapping) => (
                      <div key={mapping.discordChannelId} className={styles.mappingItem}>
                        <div className={styles.mappingInfo}>
                          <span className={styles.mappingChannel}>
                            #{mapping.discordChannelName} ({mapping.discordGuildName})
                          </span>
                          <span className={styles.mappingCwd}>{mapping.cwd}</span>
                        </div>
                        <button
                          className={styles.removeMappingButton}
                          onClick={() => handleRemoveMapping(bridge.id, mapping.discordChannelId)}
                          title="Remove mapping"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {addingMappingFor === bridge.id ? (
                      <div className={styles.mappingForm}>
                        {loadingGuilds ? (
                          <span className={styles.hint}>Loading servers...</span>
                        ) : guilds.length === 0 ? (
                          <span className={styles.hint}>
                            No servers found. Make sure the bot is invited to a server and the bridge is connected.
                          </span>
                        ) : (
                          <>
                            <div className={styles.mappingFormRow}>
                              <div className={styles.formGroup}>
                                <label className={styles.label}>Server</label>
                                <select
                                  className={styles.select}
                                  value={selectedGuild}
                                  onChange={(e) => {
                                    setSelectedGuild(e.target.value);
                                    setSelectedChannel('');
                                  }}
                                >
                                  <option value="">Select server...</option>
                                  {guilds.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className={styles.formGroup}>
                                <label className={styles.label}>Channel</label>
                                <select
                                  className={styles.select}
                                  value={selectedChannel}
                                  onChange={(e) => setSelectedChannel(e.target.value)}
                                  disabled={!selectedGuild}
                                >
                                  <option value="">Select channel...</option>
                                  {guilds
                                    .find((g) => g.id === selectedGuild)
                                    ?.channels.map((c) => (
                                      <option key={c.id} value={c.id}>#{c.name}</option>
                                    ))}
                                </select>
                              </div>
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Working Directory</label>
                              <div className={styles.tokenRow}>
                                <input
                                  type="text"
                                  className={styles.input}
                                  placeholder="/path/to/project"
                                  value={mappingCwd}
                                  onChange={(e) => setMappingCwd(e.target.value)}
                                />
                                <button
                                  type="button"
                                  className={styles.testButton}
                                  onClick={handleSelectDirectory}
                                >
                                  Browse
                                </button>
                              </div>
                              <span className={styles.hint}>Claude will work from this directory for this channel</span>
                            </div>
                            <div className={styles.formActions}>
                              <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={() => setAddingMappingFor(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className={styles.submitButton}
                                onClick={handleAddMapping}
                                disabled={!selectedChannel || !mappingCwd.trim()}
                              >
                                Add Mapping
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        className={styles.addMappingButton}
                        onClick={() => handleStartAddMapping(bridge.id)}
                        disabled={!isConnected && dc.channelMappings.length === 0}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Channel Mapping
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
