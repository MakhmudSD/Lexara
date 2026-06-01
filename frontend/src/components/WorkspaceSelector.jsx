import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import client from '../api/client';
import { deleteWorkspace, listWorkspaces, quickCreateWorkspace, updateWorkspaceName } from '../api/workspace';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/WorkspaceSelector.css';

const NAME_RE = /^[^\x00-\x1F\x7F<>:"\/\\|?*]{1,40}$/;

function WorkspaceSelector({
  workspaceId,
  workspaceName,
  onWorkspaceChange,
  onWorkspaceNameChange,
  onConnectionError,
  onCreatingChange,
}, ref) {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [docCounts, setDocCounts] = useState({});
  const [nameInput, setNameInput] = useState(workspaceName || '');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [, setSaveStatus] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const createInputRef = useRef(null);

  // Close three-dot menu when clicking outside any .ws-menu-wrap element
  useEffect(() => {
    if (!menuOpenId) return;
    const handle = (e) => {
      if (!e.target.closest('.ws-menu-wrap')) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpenId]);

  const fetchDocCounts = async (workspaceList) => {
    const counts = {};
    await Promise.all(
      workspaceList.map(async (ws) => {
        try {
          const res = await client.get(`/documents?workspace_id=${ws.id}&limit=1`);
          counts[ws.id] = res.data?.total ?? res.data?.length ?? 0;
        } catch {
          counts[ws.id] = null;
        }
      })
    );
    setDocCounts(counts);
  };

  const loadWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const response = await listWorkspaces();
      const items = Array.isArray(response)
        ? response
        : Array.isArray(response?.workspaces)
          ? response.workspaces
          : Array.isArray(response?.data)
            ? response.data
            : [];
      setWorkspaces(items);
      fetchDocCounts(items);
    } catch {
      setWorkspaces([]);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useImperativeHandle(ref, () => ({
    retryWorkspaceCreation: handleGenerate,
  }));

  const shortWorkspaceId = workspaceId ? `${workspaceId.slice(0, 8)}…` : '';
  const normalizedName = nameInput.trim();
  const nameError = (() => {
    if (!normalizedName) return null;
    if (nameInput.trim().length < 2) return t('name_too_short');
    if (nameInput.trim().length > 40) return t('name_too_long');
    if (!NAME_RE.test(nameInput.trim())) return t('name_invalid_chars');
    return null;
  })();

  const persistName = async () => {
    const normalized = normalizedName;
    if (!workspaceId) return;
    if (!normalized) return;
    if (nameError) {
      setSaveStatus(`✗ ${nameError}`);
      return;
    }

    try {
      const workspace = await updateWorkspaceName(workspaceId, normalized);
      setNameInput(workspace.name);
      onWorkspaceNameChange(workspace.name);
      localStorage.setItem('workspaceName', workspace.name);
      setSaveStatus(t('workspace_saved'));
    } catch (err) {
      const msg = err.response?.data?.error?.message || t('workspace_save_failed');
      setSaveStatus(`✗ ${t('workspace_save_failed')}: ${msg}`);
    }
  };

  const handleSelectWorkspace = (workspace) => {
    if (!workspace?.id) return;
    setCreateError('');
    setSaveStatus('');
    setMenuOpenId(null);
    onWorkspaceChange(workspace.id);
    onWorkspaceNameChange(workspace.name || '');
    localStorage.setItem('workspaceId', workspace.id);
    localStorage.setItem('workspaceName', workspace.name || '');
  };

  const handleDeleteWorkspace = async (id) => {
    setMenuOpenId(null);
    try {
      await deleteWorkspace(id);
      if (workspaceId === id) {
        onWorkspaceChange('');
        onWorkspaceNameChange('');
        localStorage.removeItem('workspaceId');
        localStorage.removeItem('workspaceName');
        setNameInput('');
      }
      await loadWorkspaces();
    } catch (err) {
      setSaveStatus(`✗ ${err.response?.data?.error?.message || t('workspace_delete_failed')}`);
    }
  };

  const handleGenerate = async () => {
    if (!normalizedName) {
      setCreateError(t('enter_project_name_first'));
      return;
    }
    if (normalizedName.length < 2) {
      setCreateError(t('project_name_min_length'));
      return;
    }
    if (!NAME_RE.test(normalizedName)) {
      setCreateError(t('name_invalid_chars'));
      return;
    }
    setCreating(true);
    setCreateError('');
    setSaveStatus('');
    try {
      const workspace = await quickCreateWorkspace(normalizedName);
      setCreateError('');
      setNameInput('');
      setShowCreateForm(false);
      onCreatingChange?.(false);
      onWorkspaceChange(workspace.id);
      onWorkspaceNameChange(workspace.name);
      localStorage.setItem('workspaceId', workspace.id);
      localStorage.setItem('workspaceName', workspace.name);
      await loadWorkspaces();
      setSaveStatus(t('workspace_saved'));
    } catch (err) {
      setCreateError(err.response?.data?.error?.message || t('project_create_failed'));
      onConnectionError?.();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="workspace-selector">
      <div className="sidebar-section-label">{t('workspace') || 'Loyiha'}</div>
      <div className="workspace-list">
        {loadingWorkspaces && <div className="ws-loading">{t('loading') || '…'}</div>}
        {!loadingWorkspaces && workspaces.length === 0 && (
          <div className="ws-empty">{t('no_workspace') || 'No projects yet'}</div>
        )}
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={`workspace-item-row ${ws.id === workspaceId ? 'active' : ''}`}
          >
            <button
              className="workspace-item"
              onClick={() => handleSelectWorkspace(ws)}
              title={ws.name}
            >
              {ws.name}
            </button>
            <span className={`ws-doc-count ${ws.id === workspaceId ? 'active' : ''}`}>
              {docCounts[ws.id] != null
                ? docCounts[ws.id] > 0 ? docCounts[ws.id] : '—'
                : ''}
            </span>
            <div className="ws-menu-wrap">
              <button
                className="ws-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === ws.id ? null : ws.id);
                }}
                aria-label="Loyiha sozlamalari"
              >
                ···
              </button>
              {menuOpenId === ws.id && (
                <div className="ws-dropdown">
                  <button
                    className="ws-dropdown-item ws-dropdown-item--danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkspace(ws.id, ws.name);
                    }}
                  >
                    {t('delete') || "O'chirish"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!showCreateForm ? (
        <button
          className="ws-create-btn"
          onClick={() => { setShowCreateForm(true); onCreatingChange?.(true); }}
        >
          + {t('new_workspace') || 'Yangi loyiha'}
        </button>
      ) : (
        <div className="ws-create-form">
          <input
            ref={createInputRef}
            type="text"
            className="ws-create-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={t('workspace_name_placeholder') || 'Loyiha nomi…'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate();
              if (e.key === 'Escape') {
                setShowCreateForm(false);
                setNameInput('');
                setCreateError('');
              }
            }}
            autoFocus
          />
          {createError && <div className="ws-create-error">{createError}</div>}
          <div className="ws-create-actions">
            <button
              className="ws-create-submit"
              onClick={handleGenerate}
              disabled={creating || !nameInput.trim()}
            >
              {creating ? '…' : (t('create') || 'Yaratish')}
            </button>
            <button
              className="ws-create-cancel"
              onClick={() => {
                setShowCreateForm(false);
                setNameInput('');
                setCreateError('');
                onCreatingChange?.(false);
              }}
            >
              {t('cancel') || 'Bekor'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default forwardRef(WorkspaceSelector);
