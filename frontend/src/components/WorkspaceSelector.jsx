import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { ORG_SLUG } from '../api/config';
import { createOrgWorkspace, getOrgWorkspaces } from '../api/workspaces';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/WorkspaceSelector.css';

function WorkspaceSelector({
  workspaceId,
  workspaceName,
  onWorkspaceChange,
  onWorkspaceNameChange,
}, ref) {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const orgConfigured = Boolean(ORG_SLUG);

  const loadWorkspaces = useCallback(async () => {
    if (!ORG_SLUG) {
      setWorkspaces([]);
      setLoadError('');
      setLoadingWorkspaces(false);
      return;
    }
    setLoadingWorkspaces(true);
    setLoadError('');
    try {
      const data = await getOrgWorkspaces(ORG_SLUG);
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.workspaces)
          ? data.workspaces
          : [];
      setWorkspaces(items);
    } catch (err) {
      setWorkspaces([]);
      setLoadError(err?.message || 'Failed to load workspaces.');
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleSelectWorkspace = useCallback((workspace) => {
    if (!workspace?.id) return;
    onWorkspaceChange(workspace.id);
    onWorkspaceNameChange?.(workspace.name || '');
    localStorage.setItem('workspaceId', workspace.id);
    localStorage.setItem('workspaceName', workspace.name || '');
  }, [onWorkspaceChange, onWorkspaceNameChange]);

  const handleNewWorkspace = useCallback(async () => {
    if (!ORG_SLUG) {
      setCreateError('ORG_SLUG not configured. Check .env.');
      return;
    }
    const name = window.prompt('Workspace name?')?.trim();
    if (!name) return;

    setCreating(true);
    setCreateError('');
    try {
      const workspace = await createOrgWorkspace(ORG_SLUG, name);
      await loadWorkspaces();
      onWorkspaceChange(workspace.id);
      onWorkspaceNameChange?.(workspace.name || name);
      localStorage.setItem('workspaceId', workspace.id);
      localStorage.setItem('workspaceName', workspace.name || name);
    } catch (err) {
      setCreateError(err?.message || 'Could not create workspace.');
    } finally {
      setCreating(false);
    }
  }, [loadWorkspaces, onWorkspaceChange, onWorkspaceNameChange]);

  useImperativeHandle(ref, () => ({
    retryWorkspaceCreation: handleNewWorkspace,
  }), [handleNewWorkspace]);

  return (
    <div className="workspace-selector">
      {!orgConfigured && (
        <div className="ws-config-notice">
          <span>Connecting to workspace…</span>
        </div>
      )}
      <div className="workspace-list">
        {loadingWorkspaces && <div className="workspace-empty">{t('loading')}</div>}
        {!loadingWorkspaces && !workspaces.length && <div className="workspace-empty">{t('no_workspace')}</div>}

        {workspaces.map((workspace) => {
          const isActive = workspace.id === workspaceId;
          const dotClass = isActive
            ? 'ws-dot--active'
            : workspace.is_active
              ? 'ws-dot--ready'
              : 'ws-dot--idle';

          return (
            <button
              key={workspace.id}
              type="button"
              className={`workspace-item ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectWorkspace(workspace)}
            >
              <span className={`ws-dot ${dotClass}`} aria-hidden="true" />
              <span className="ws-info">
                <span className="ws-name">{workspace.name}</span>
                <span className="ws-id">{String(workspace.id).slice(0, 8)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="new-workspace-btn"
        onClick={handleNewWorkspace}
        disabled={creating || !orgConfigured}
      >
        {creating ? t('creating_workspace') : t('generate_workspace')}
      </button>

      {createError && <div className="workspace-status err">{createError}</div>}
      {loadError && <div className="workspace-status err">{loadError}</div>}
      {workspaceId && workspaceName && <div className="workspace-status hint">{workspaceName}</div>}
    </div>
  );
}

export default forwardRef(WorkspaceSelector);
