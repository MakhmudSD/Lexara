import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { quickCreateWorkspace, updateWorkspaceName } from '../api/workspace';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/WorkspaceSelector.css';

const NAME_RE = /^[^\x00-\x1F\x7F<>:"\/\\|?*]{1,40}$/;

function WorkspaceSelector({
  workspaceId,
  workspaceName,
  onWorkspaceChange,
  onWorkspaceNameChange,
  onConnectionError,
}, ref) {
  const { t } = useTranslation();
  const [nameInput, setNameInput] = useState(workspaceName || '');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    setNameInput(workspaceName || '');
  }, [workspaceName]);

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

  const handleGenerate = async () => {
    if (!normalizedName) {
      setCreateError('Please enter a project name first');
      return;
    }
    if (normalizedName.length < 2) {
      setCreateError('Project name must be at least 2 characters');
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
      setNameInput(workspace.name);
      onWorkspaceChange(workspace.id);
      onWorkspaceNameChange(workspace.name);
      localStorage.setItem('workspaceId', workspace.id);
      localStorage.setItem('workspaceName', workspace.name);
      setSaveStatus(t('workspace_saved'));
    } catch (err) {
      setCreateError('Could not create project. Please check your connection.');
      onConnectionError?.();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="workspace-selector">
      <div className="workspace-input-wrap">
        <input
          type="text"
          className="workspace-input"
          value={nameInput}
          onChange={(event) => {
            setNameInput(event.target.value);
            setSaveStatus('');
            setCreateError('');
          }}
          onFocus={() => setCreateError('')}
          onBlur={persistName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              persistName();
            }
          }}
          placeholder={t('workspace_name_placeholder')}
          spellCheck={false}
          autoComplete="off"
        />
        {nameInput && <div className="workspace-name-display">{nameInput}</div>}
        {workspaceId && <div className="workspace-uuid-hint">{t('workspace_id_hint')}{shortWorkspaceId}</div>}
      </div>

      {nameError && <div className="workspace-status" style={{ color: '#b45309', fontSize: 11 }}>✗ {nameError}</div>}
      {!!saveStatus && <div className={`workspace-status ${saveStatus.startsWith('✓') ? 'ok' : 'err'}`}>{saveStatus}</div>}
      {createError && <div className="workspace-status" style={{ color: '#b45309', fontSize: 11 }}>✗ {createError}</div>}
      {!workspaceId && !normalizedName && !createError && <div className="workspace-status hint">Please enter a project name first</div>}
      {!workspaceId && normalizedName && !createError && <div className="workspace-status hint">{t('paste_uuid_or_generate')}</div>}

      <button
        className="new-workspace-btn"
        onClick={handleGenerate}
        disabled={creating || !normalizedName}
        style={{ opacity: creating || !normalizedName ? 0.5 : 1 }}
      >
        {creating ? t('creating_workspace') : t('generate_workspace')}
      </button>
    </div>
  );
}

export default forwardRef(WorkspaceSelector);
